"""Fallback extractor for screens that don't match any known source.

Pulls the most generic signals it can: amount (largest VND/đ number on the
screen), datetime (first ``dd/mm/yyyy hh:mm`` style match), and full
``raw_text`` for the downstream classifier to use. Always returns exactly
one ``Transaction`` so the app has something for the user to review.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional

from .base import (
    Transaction,
    group_into_lines,
    lines_to_text,
    normalize_spaces,
    parse_int_amount,
)


AMOUNT_PATTERN = re.compile(
    r"([+\-]?)\s*([\d][\d.,\s]{2,})\s*(?:VND|VNĐ|đ|d)\b",
    re.IGNORECASE,
)
DATETIME_PATTERN = re.compile(
    r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?"
)


def _pick_amount(text: str) -> tuple[Optional[int], Optional[str]]:
    """Return (largest_amount, direction) found in text, or (None, None)."""
    best_amount: Optional[int] = None
    best_sign: Optional[str] = None
    for m in AMOUNT_PATTERN.finditer(text):
        sign = m.group(1)
        amt = parse_int_amount(m.group(2))
        if amt is None:
            continue
        if best_amount is None or amt > best_amount:
            best_amount = amt
            best_sign = sign
    direction: Optional[str] = None
    if best_sign == "+":
        direction = "in"
    elif best_sign == "-":
        direction = "out"
    return best_amount, direction


def _pick_datetime(text: str) -> Optional[str]:
    m = DATETIME_PATTERN.search(text)
    if not m:
        return None
    d, mo, y, h, mi, s = m.groups()
    year = y if len(y) == 4 else f"20{y}"
    out = f"{d.zfill(2)}/{mo.zfill(2)}/{year}"
    if h and mi:
        out += f" {h.zfill(2)}:{mi}"
        if s:
            out += f":{s}"
    return out


def extract(items: List[Dict]) -> List[Transaction]:
    text_lines = lines_to_text(group_into_lines(items))
    full = normalize_spaces(" ".join(text_lines))
    if not full:
        return []
    amount, direction = _pick_amount(full)
    datetime_str = _pick_datetime(full)
    return [
        Transaction(
            source="Unknown",
            datetime=datetime_str,
            amount=amount,
            direction=direction,
            currency="VND",
            description=None,
            raw_text=full,
        )
    ]
