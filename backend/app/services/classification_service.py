"""Thin wrapper around the category_classification models.

classify_text() is safe to call even if models are unavailable — it
returns None on any error so the OCR pipeline degrades gracefully.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Optional

# Ensure the classifier's src dir is importable before the first call.
# The joblib-pickled pipeline references text_normalize.vn_normalize by
# module path, so this directory must stay on sys.path permanently.
_CLASSIFY_SRC = (
    Path(__file__).resolve().parents[1] / "ai" / "category_classification" / "src"
)
if str(_CLASSIFY_SRC) not in sys.path:
    sys.path.insert(0, str(_CLASSIFY_SRC))

# Strip noisy reference codes that hurt classifier confidence.
# Patterns common in VietinBank iPay and interbank transfer descriptions.
_NOISE_PATTERNS = [
    re.compile(r"\bMa\s+KH[-:]\S+", re.I),          # Ma KH-0373198729
    re.compile(r"\bKH[-:]\d{6,}", re.I),              # KH-0948498729
    re.compile(r"\bCT\s+(?:DEN|DI)\s*:?\s*\S+", re.I),  # CT DEN:xxx
    re.compile(r"\bQR\s*-?\s*\S+", re.I),             # QR-xxx
    re.compile(r"\b(?:srm|cf)\b", re.I),               # trailing channel codes
    re.compile(r"\b\d{8,}\b"),                         # long bare numeric IDs
]


def _clean_text(text: str) -> str:
    """Remove reference codes and normalise whitespace."""
    for pat in _NOISE_PATTERNS:
        text = pat.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def classify_text(
    text: str,
    scan_type: str,
    direction: Optional[str] = None,
) -> Optional[dict]:
    """Return the top predicted category or *None* on any failure.

    Args:
        text:      Description, merchant name, or invoice item name.
        scan_type: ``"bank_noti"`` → bank model; anything else → invoice model.
        direction: ``"in"`` or ``"out"`` from OCR extractor. When supplied,
                   a short Vietnamese prefix is prepended to give the model a
                   directional hint (helps especially for terse bank notifications).

    Returns:
        ``{"category_name": str, "confidence": float, "alternatives": [...]}``
        or ``None`` if the text is empty or the model cannot be loaded.
    """
    if not text or not text.strip():
        return None

    model_name = "bank" if scan_type == "bank_noti" else "invoice"

    # Clean noise codes before classifying
    cleaned = _clean_text(text.strip())
    if not cleaned:
        return None

    try:
        from predict import get_classifier  # lazy — avoids import-time cost

        clf = get_classifier(model_name)

        top3 = clf.predict_proba(cleaned, topk=3)
        if not top3:
            return None
        best_top3 = top3

        # For bank transactions, also try with a direction hint and keep whichever
        # produces higher top-1 confidence (helps terse notifications like VietinBank).
        if model_name == "bank" and direction:
            hint = "Thu nhap" if direction == "in" else "Chi tieu"
            top3_dir = clf.predict_proba(f"{hint} {cleaned}", topk=3)
            if top3_dir and top3_dir[0][1] > best_top3[0][1]:
                best_top3 = top3_dir

        return {
            "category_name": str(best_top3[0][0]),
            "confidence": round(float(best_top3[0][1]), 4),
            "alternatives": [
                {"name": str(c), "confidence": round(float(s), 4)} for c, s in best_top3[1:]
            ],
        }
    except Exception:  # noqa: BLE001
        return None
