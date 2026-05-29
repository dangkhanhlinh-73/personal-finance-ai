"""CLI runner for the OCR pipeline.

Usage (từ thư mục ocr/):
    python run.py --image data/bank_notification/1088294274

Usage (từ thư mục backend/):
    python -m app.ai.ocr.run --image app/ai/ocr/data/bank_notification/IMG_0083.PNG

Output layout (inside --output-dir, default: ocr/outputs/):
    {stem}/
        raw.json
        transactions.json
        debug.png
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Cho phép chạy trực tiếp: `python run.py` từ thư mục ocr/
if __name__ == "__main__" and not __package__:
    _backend = Path(__file__).resolve().parents[3]  # .../backend
    sys.path.insert(0, str(_backend))
    import runpy
    runpy.run_module("app.ai.ocr.run", run_name="__main__", alter_sys=True)
    sys.exit(0)

from .detector import TextDetector
from .extractor import detect_format, extract_transactions
from .pipeline import load_image_rgb, run as run_pipeline
from .recognizer import TextRecognizer
from .visualize import draw_boxes


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--image", required=True, type=Path, help="Path to screenshot.")
    p.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "outputs",
        help="Root output directory; a sub-folder named after the image stem is created inside it.",
    )
    p.add_argument(
        "--device",
        default="cuda:0",
        help="Device for VietOCR recognizer (e.g. cuda:0 or cpu).",
    )
    p.add_argument(
        "--recog-model",
        default="vgg_transformer",
        help="VietOCR pretrained model name.",
    )
    return p.parse_args()


def main():
    args = parse_args()

    stem = args.image.stem
    out_dir = args.output_dir / stem          # per-image subfolder
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[1/4] Loading detector (PaddleOCR)...")
    detector = TextDetector()

    print(f"[2/4] Loading recognizer (VietOCR / {args.recog_model}, {args.device})...")
    recognizer = TextRecognizer(model_name=args.recog_model, device=args.device)

    print(f"[3/4] Running OCR on {args.image}...")
    items = run_pipeline(args.image, detector, recognizer)
    print(f"     -> {len(items)} text boxes detected.")

    print(f"[4/4] Extracting transactions...")
    fmt = detect_format(items)
    print(f"     -> detected format: {fmt}")
    txns = extract_transactions(items)
    print(f"     -> {len(txns)} transaction(s) parsed.")

    raw_path   = out_dir / "raw.json"
    txn_path   = out_dir / "transactions.json"
    debug_path = out_dir / "debug.png"

    raw_path.write_text(
        json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    txn_path.write_text(
        json.dumps([t.to_dict() for t in txns], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    image_rgb = load_image_rgb(args.image)
    draw_boxes(image_rgb, items, debug_path)

    print()
    print(f"Output folder -> {out_dir}")
    print(f"  raw.json         ({raw_path})")
    print(f"  transactions.json ({txn_path})")
    print(f"  debug.png        ({debug_path})")
    print()
    for i, t in enumerate(txns, 1):
        print(f"--- Transaction {i} ---")
        for k, v in t.to_dict().items():
            print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
