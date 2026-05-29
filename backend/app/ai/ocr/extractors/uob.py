"""Extractor for UOB ONE MASTERCARD app statement screens (English layout).

Each transaction card stacks vertically and contains some subset of::

    [merchant]            e.g. ``Grab% A-9BVTIIEWWVXQAV HA``  or ``MIC/mic.vn ha noi VNM``
    [location]            e.g. ``NOI VN`` | ``NOI VNM``
    [category tag]        e.g. ``Transportation`` (English, optional)
    [amount]              ``VND 127,500``
    [status]              ``Đang chờ xử ly`` (optional)
    [date]                ``18 May 2026``   <- closes the card

The date line is the only reliable per-card separator, so we walk text
lines top-down accumulating fields and finalise a transaction every time
we see a date.
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


_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
DATE_PATTERN = re.compile(
    r"^\s*(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\s*$"
)
AMOUNT_PATTERN = re.compile(r"VND\s*([\d][\d,]*)", re.IGNORECASE)
LOCATION_PATTERN = re.compile(r"^NOI\s+[A-Z]{2,4}$")
STATUS_PATTERN = re.compile(r"^Đang\s+chờ\s+xử\s+l[yý]$", re.IGNORECASE)
CATEGORY_TAG_PATTERN = re.compile(r"^[A-Z][a-z]+(?:[A-Z]?[a-z]*)?$")  # "Transportation", "Food"

HEADER_NOISE = {
    "UOB ONE MASTERCARD",
    "Chi tiết",
    "Giao dịch",
    "Dịch vụ",
    "Chuyển đổi trả góp",
    "Xem Sao kê điện tử",
    "coll",
}


def _parse_date(text: str) -> Optional[str]:
    m = DATE_PATTERN.match(text.strip())
    if not m:
        return None
    d, mo_name, y = m.groups()
    mo = _MONTHS.get(mo_name[:3].lower())
    if mo is None:
        return None
    return f"{d.zfill(2)}/{str(mo).zfill(2)}/{y}"


def _looks_like_merchant(text: str) -> bool:
    if "%" in text or "/" in text:
        return True
    return False


def _looks_like_noise(text: str) -> bool:
    t = text.strip()
    if not t:
        return True
    if t in HEADER_NOISE:
        return True
    if re.fullmatch(r"\d{1,2}:\d{2}", t):  # status-bar time
        return True
    if re.fullmatch(r"\d{1,4}", t):  # stray digit groups
        return True
    if re.fullmatch(r"[a-z]", t):  # single lowercase letter (icon misread)
        return True
    # Status bar line is the joined-up version of the above noise tokens —
    # always starts with HH:MM. Drop the whole line.
    if re.match(r"^\d{1,2}:\d{2}\b", t):
        return True
    # group_into_lines may concatenate the "Chi tiết | Giao dịch | Dịch vụ"
    # tab row into one string. Treat it as noise if every space-delimited
    # chunk (up to ~3 words each) is a header-noise phrase.
    chunks = re.split(r"\s{2,}|\s(?=[A-ZÀ-Ỹ])", t)
    if len(chunks) >= 2 and all(c.strip() in HEADER_NOISE for c in chunks if c.strip()):
        return True
    return False


def _finalize(buf: Dict, date_str: str, full_block_text: str) -> Optional[Transaction]:
    amount = buf.get("amount")
    if amount is None and not buf.get("merchant"):
        return None
    return Transaction(
        source="uob",
        datetime=date_str,
        amount=amount,
        direction="out",
        currency="VND",
        description=buf.get("merchant"),
        raw_text=normalize_spaces(full_block_text),
        merchant=buf.get("merchant"),
        category=buf.get("category"),
    )


def extract(items: List[Dict]) -> List[Transaction]:
    text_lines = lines_to_text(group_into_lines(items))

    transactions: List[Transaction] = []
    buf: Dict = {}
    block_lines: List[str] = []

    for line in text_lines:
        line_clean = line.strip()
        if not line_clean:
            continue

        # Date closes the current transaction card.
        date_str = _parse_date(line_clean)
        if date_str is not None:
            block_lines.append(line_clean)
            txn = _finalize(buf, date_str, " ".join(block_lines))
            if txn is not None:
                transactions.append(txn)
            buf = {}
            block_lines = []
            continue

        if _looks_like_noise(line_clean):
            continue

        block_lines.append(line_clean)

        m = AMOUNT_PATTERN.search(line_clean)
        if m and buf.get("amount") is None:
            buf["amount"] = parse_int_amount(m.group(1))
            continue

        if STATUS_PATTERN.match(line_clean):
            continue

        if LOCATION_PATTERN.match(line_clean):
            continue

        if _looks_like_merchant(line_clean) and buf.get("merchant") is None:
            buf["merchant"] = line_clean
            continue

        if CATEGORY_TAG_PATTERN.match(line_clean) and buf.get("category") is None:
            buf["category"] = line_clean
            continue

        # Fallback: first non-classified text line becomes merchant.
        if buf.get("merchant") is None:
            buf["merchant"] = line_clean

    return transactions
