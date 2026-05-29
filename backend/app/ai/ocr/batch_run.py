"""Batch OCR runner: walk data/, write outputs/<format>/<stem>/{raw,transactions}.json.

Usage (từ thư mục backend/):
    python -m app.ai.ocr.batch_run --data-root app/ai/ocr/data

Output layout:
    outputs/
      {detected_format}/
        {stem}/
          raw.json
          transactions.json
          debug.png

Skips images whose ``raw.json`` already exists in the per-stem folder
(so a re-run only processes new images). Use ``--force`` to re-process everything.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Iterable, List

from .detector import TextDetector
from .extractor import detect_format, extract_transactions
from .pipeline import load_image_rgb, run as run_pipeline
from .recognizer import TextRecognizer
from .visualize import draw_boxes


IMAGE_EXTS = {".png", ".PNG", ".jpg", ".JPG", ".jpeg", ".JPEG"}


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--data-root", type=Path, default=Path(__file__).resolve().parent / "data")
    p.add_argument(
        "--output-root",
        type=Path,
        default=Path(__file__).resolve().parent / "outputs",
    )
    p.add_argument("--device", default="cuda:0")
    p.add_argument("--recog-model", default="vgg_transformer")
    p.add_argument("--force", action="store_true", help="Re-OCR even if output exists.")
    p.add_argument("--limit", type=int, default=0, help="Process only first N images (debug).")
    return p.parse_args()


def find_images(root: Path) -> List[Path]:
    return sorted(p for p in root.rglob("*") if p.suffix in IMAGE_EXTS)


def existing_raw_for_stem(stem: str, output_root: Path) -> bool:
    for _ in output_root.rglob(f"{stem}/raw.json"):
        return True
    return False


def process_one(
    image_path: Path,
    output_root: Path,
    detector: TextDetector,
    recognizer: TextRecognizer,
) -> tuple[str, int]:
    items = run_pipeline(image_path, detector, recognizer)
    source = detect_format(items)
    txns = extract_transactions(items)

    # Per-image folder: outputs/{format}/{stem}/
    stem = image_path.stem
    out_dir = output_root / source / stem
    out_dir.mkdir(parents=True, exist_ok=True)

    (out_dir / "raw.json").write_text(
        json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (out_dir / "transactions.json").write_text(
        json.dumps([t.to_dict() for t in txns], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    image_rgb = load_image_rgb(image_path)
    draw_boxes(image_rgb, items, out_dir / "debug.png")
    return source, len(txns)


def main():
    args = parse_args()
    images = find_images(args.data_root)
    if args.limit:
        images = images[: args.limit]
    print(f"Found {len(images)} image(s) under {args.data_root}")

    print("Loading detector (PaddleOCR)...")
    detector = TextDetector()
    print(f"Loading recognizer (VietOCR / {args.recog_model}, {args.device})...")
    recognizer = TextRecognizer(model_name=args.recog_model, device=args.device)

    n_done = n_skip = 0
    t0 = time.time()
    for idx, image_path in enumerate(images, 1):
        if not args.force and existing_raw_for_stem(image_path.stem, args.output_root):
            n_skip += 1
            print(f"[{idx}/{len(images)}] SKIP {image_path.name} (already processed)")
            continue
        try:
            source, n_txns = process_one(image_path, args.output_root, detector, recognizer)
            n_done += 1
            print(f"[{idx}/{len(images)}] {image_path.name} -> {source} ({n_txns} txn)")
        except Exception as exc:  # pragma: no cover
            print(f"[{idx}/{len(images)}] ERROR {image_path.name}: {exc}")

    dt = time.time() - t0
    print()
    print(f"Done: processed={n_done}, skipped={n_skip}, elapsed={dt:.1f}s")


if __name__ == "__main__":
    main()
