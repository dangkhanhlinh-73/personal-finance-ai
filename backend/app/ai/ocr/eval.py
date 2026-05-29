"""Re-run only the extractor on previously cached raw OCR JSONs.

Lets you iterate on extractor logic without re-running the slow OCR pipeline.

Usage:
    python -m ocr.src.eval                  # run all *.raw.json in outputs/
    python -m ocr.src.eval IMG_0083 IMG_0084
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .extractor import detect_format, extract_transactions


def _print_txn(idx: int, t: dict) -> None:
    print(f"  --- Transaction {idx} ---")
    for k, v in t.items():
        if v in (None, "", {}):
            continue
        print(f"    {k}: {v}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("stems", nargs="*", help="Image stems to evaluate (default: all).")
    parser.add_argument(
        "--outputs",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "outputs",
    )
    args = parser.parse_args()

    raw_files = sorted(args.outputs.glob("*.raw.json"))
    if args.stems:
        raw_files = [f for f in raw_files if f.stem.replace(".raw", "") in args.stems]

    if not raw_files:
        print("No raw OCR JSON files found.")
        return

    for raw_file in raw_files:
        items = json.loads(raw_file.read_text(encoding="utf-8"))
        fmt = detect_format(items)
        txns = extract_transactions(items)
        stem = raw_file.stem.replace(".raw", "")

        out_path = args.outputs / f"{stem}.transactions.json"
        out_path.write_text(
            json.dumps([t.to_dict() for t in txns], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        print(f"==== {stem} ====")
        print(f"  format: {fmt}  |  transactions: {len(txns)}")
        for i, t in enumerate(txns, 1):
            _print_txn(i, t.to_dict())
        print()


if __name__ == "__main__":
    main()
