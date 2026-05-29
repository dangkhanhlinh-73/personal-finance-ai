"""Async OCR job service.

Models (PaddleOCR + VietOCR) are loaded once and reused across jobs via a
module-level singleton protected by a threading.Lock.

Storage layout
--------------
uploads/ocr/
  {job_id}_{yyyyMMdd_HHmmss}_{original_stem}/
    image{suffix}          <- uploaded image
    raw.json               <- raw OCR boxes (written after processing)
    transactions.json      <- extracted transactions
    debug.png              <- visualised bounding boxes
"""

from __future__ import annotations

import json
import shutil
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.ocr_job import OcrJob

# ── Model singleton ────────────────────────────────────────────────────────────
_detector = None
_recognizer = None
_model_lock = threading.Lock()

# Canonical root for all API-uploaded OCR assets (relative to backend/)
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "ocr"


def _get_models():
    global _detector, _recognizer
    if _detector is None or _recognizer is None:
        with _model_lock:
            if _detector is None:
                from app.ai.ocr.detector import TextDetector
                _detector = TextDetector()
            if _recognizer is None:
                from app.ai.ocr.recognizer import TextRecognizer
                _recognizer = TextRecognizer(device="cpu")
    return _detector, _recognizer


def _job_folder_name(job_id: int, dt: datetime, original_stem: str) -> str:
    return f"{job_id}_{dt.strftime('%Y%m%d_%H%M%S')}_{original_stem}"


# ── Background task ────────────────────────────────────────────────────────────

def process_ocr_job(job_id: int) -> None:
    """Run OCR pipeline for a job. Called by FastAPI BackgroundTasks."""
    db: Session = SessionLocal()
    try:
        job = db.query(OcrJob).filter(OcrJob.job_id == job_id).first()
        if not job:
            return

        job.status = "processing"
        db.commit()

        from app.ai.ocr.pipeline import load_image_rgb, run as run_pipeline
        from app.ai.ocr.extractor import detect_format, extract_transactions
        from app.ai.ocr.visualize import draw_boxes

        detector, recognizer = _get_models()
        items = run_pipeline(job.image_path, detector, recognizer)
        fmt = detect_format(items)
        txns = extract_transactions(items)

        # Serialize to plain dicts so we can annotate with AI suggestions
        txn_dicts = [t.to_dict() for t in txns]

        # Category classification (best-effort — never blocks the pipeline)
        try:
            from app.services.classification_service import classify_text

            for txn_dict in txn_dicts:
                text = txn_dict.get("description") or txn_dict.get("merchant") or ""
                direction = txn_dict.get("direction")
                result = classify_text(text, job.scan_type, direction=direction)
                if result:
                    txn_dict["ai_category"] = result["category_name"]
                    txn_dict["ai_category_confidence"] = result["confidence"]
                # Classify invoice items individually
                for item in txn_dict.get("items") or []:
                    item_text = item.get("name") or ""
                    item_result = classify_text(item_text, "invoice")
                    if item_result:
                        item["ai_category"] = item_result["category_name"]
                        item["ai_category_confidence"] = item_result["confidence"]
        except Exception:  # noqa: BLE001
            pass

        # Write output files into the same folder as the image
        job_dir = Path(job.image_path).parent
        (job_dir / "raw.json").write_text(
            json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (job_dir / "transactions.json").write_text(
            json.dumps(txn_dicts, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        image_rgb = load_image_rgb(job.image_path)
        draw_boxes(image_rgb, items, job_dir / "debug.png")

        job.status = "done"
        job.detected_format = fmt
        job.extracted_json = {
            "format": fmt,
            "transactions": txn_dicts,
        }
        job.completed_at = datetime.now()
        db.commit()

    except Exception as exc:  # noqa: BLE001
        db.rollback()
        job = db.query(OcrJob).filter(OcrJob.job_id == job_id).first()
        if job:
            job.status = "error"
            job.error_message = str(exc)
            db.commit()
    finally:
        db.close()


# ── CRUD helpers ───────────────────────────────────────────────────────────────

async def create_job(db: Session, user_id: int, file: UploadFile, scan_type: str) -> OcrJob:
    # 1. Insert record first to obtain the auto-generated job_id
    job = OcrJob(
        user_id=user_id,
        scan_type=scan_type,
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # 2. Build folder name: {job_id}_{yyyyMMdd_HHmmss}_{original_stem}
    now = datetime.now()
    original_stem = Path(file.filename or "image").stem
    suffix = Path(file.filename or "image.png").suffix or ".png"
    folder_name = _job_folder_name(job.job_id, now, original_stem)
    job_dir = UPLOAD_DIR / folder_name
    job_dir.mkdir(parents=True, exist_ok=True)

    # 3. Save image as image{suffix} inside the job folder
    image_path = job_dir / f"image{suffix}"
    contents = await file.read()
    with open(image_path, "wb") as f:
        f.write(contents)

    # 4. Update job with the final image path
    job.image_path = str(image_path)
    db.commit()
    db.refresh(job)
    return job


def _job_to_dict(job: OcrJob, saved_count: int = 0) -> dict:
    return {
        "job_id": job.job_id,
        "user_id": job.user_id,
        "scan_type": job.scan_type,
        "status": job.status,
        "detected_format": job.detected_format,
        "extracted_json": job.extracted_json,
        "error_message": job.error_message,
        "created_at": job.created_at,
        "completed_at": job.completed_at,
        "saved_count": saved_count,
    }


def get_jobs(db: Session, user_id: int) -> list:
    from sqlalchemy import func
    from app.models.transaction import Transaction as TxnModel

    jobs = (
        db.query(OcrJob)
        .filter(OcrJob.user_id == user_id)
        .order_by(OcrJob.created_at.desc())
        .limit(30)
        .all()
    )
    if not jobs:
        return []
    job_ids = [j.job_id for j in jobs]
    counts = dict(
        db.query(TxnModel.ocr_job_id, func.count(TxnModel.transaction_id))
        .filter(TxnModel.ocr_job_id.in_(job_ids))
        .group_by(TxnModel.ocr_job_id)
        .all()
    )
    return [_job_to_dict(j, counts.get(j.job_id, 0)) for j in jobs]


def get_job(db: Session, user_id: int, job_id: int) -> Optional[OcrJob]:
    return (
        db.query(OcrJob)
        .filter(OcrJob.job_id == job_id, OcrJob.user_id == user_id)
        .first()
    )


def get_job_detail_dict(db: Session, user_id: int, job_id: int) -> Optional[dict]:
    from sqlalchemy import func
    from app.models.transaction import Transaction as TxnModel

    job = get_job(db, user_id, job_id)
    if not job:
        return None
    count = (
        db.query(func.count(TxnModel.transaction_id))
        .filter(TxnModel.ocr_job_id == job_id)
        .scalar() or 0
    )
    return _job_to_dict(job, count)


def get_job_transactions(db: Session, user_id: int, job_id: int) -> list:
    from app.models.transaction import Transaction as TxnModel

    rows = (
        db.query(TxnModel)
        .filter(TxnModel.ocr_job_id == job_id, TxnModel.user_id == user_id)
        .order_by(TxnModel.txn_index.asc().nullslast(), TxnModel.transaction_id.asc())
        .all()
    )
    return [
        {
            "transaction_id": r.transaction_id,
            "txn_index": r.txn_index,
            "account_id": r.account_id,
            "category_id": r.category_id,
            "amount": str(r.amount),
            "transaction_type": r.transaction_type,
            "transaction_date": r.transaction_date.isoformat() if r.transaction_date else None,
            "description": r.description,
            "merchant_name": r.merchant_name,
            "status": r.status,
        }
        for r in rows
    ]


def delete_job(db: Session, user_id: int, job_id: int) -> None:
    job = get_job(db, user_id, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Không tìm thấy job")
    # Delete the entire job folder (image + all output files)
    if job.image_path:
        try:
            job_dir = Path(job.image_path).parent
            if job_dir.is_dir() and job_dir.parent == UPLOAD_DIR:
                shutil.rmtree(job_dir, ignore_errors=True)
            else:
                Path(job.image_path).unlink(missing_ok=True)
        except Exception:
            pass
    db.delete(job)
    db.commit()
