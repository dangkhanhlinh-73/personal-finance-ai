from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.ocr_job_schema import OcrJobResponse
from app.services.ocr_job_service import (
    create_job,
    delete_job,
    get_job,
    get_job_detail_dict,
    get_job_transactions,
    get_jobs,
    process_ocr_job,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/api/ocr", tags=["OCR Jobs"])


@router.post("/jobs", response_model=OcrJobResponse)
async def upload_for_ocr(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    scan_type: str = Form("bank_noti"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload image, create OCR job, kick off background processing."""
    job = await create_job(db, current_user.user_id, file, scan_type)
    background_tasks.add_task(process_ocr_job, job.job_id)
    return job


@router.get("/jobs", response_model=list[OcrJobResponse])
def list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_jobs(db, current_user.user_id)


@router.get("/jobs/{job_id}", response_model=OcrJobResponse)
def get_job_detail(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = get_job_detail_dict(db, current_user.user_id, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Không tìm thấy job")
    return job


@router.get("/jobs/{job_id}/transactions")
def list_job_transactions(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = get_job(db, current_user.user_id, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Không tìm thấy job")
    return get_job_transactions(db, current_user.user_id, job_id)


@router.get("/jobs/{job_id}/image")
def get_job_image(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = get_job(db, current_user.user_id, job_id)
    if not job or not job.image_path:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")
    path = Path(job.image_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File ảnh không còn tồn tại")
    suffix = path.suffix.lower()
    media = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png"
    return FileResponse(str(path), media_type=media)


@router.get("/jobs/{job_id}/debug")
def get_job_debug_image(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = get_job(db, current_user.user_id, job_id)
    if not job or not job.image_path:
        raise HTTPException(status_code=404, detail="Không tìm thấy job")
    debug_path = Path(job.image_path).parent / "debug.png"
    if not debug_path.exists():
        raise HTTPException(status_code=404, detail="Debug image chưa có")
    return FileResponse(str(debug_path), media_type="image/png")


@router.delete("/jobs/{job_id}")
def remove_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    delete_job(db, current_user.user_id, job_id)
    return {"status": "success"}
