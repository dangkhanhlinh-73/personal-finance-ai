"""Extractor for Vietnamese credit-card transaction notification screens.

Each block has the body shape::

    The tin dung X<last4> da thuc hien
    giao dich VND<amount> tai <merchant> ngay <dd/mm/yyyy>.
    Du no hien tai tren the la VND<debt>
    va han muc kha dung la VND<available>

OCR adds noise: a sidebar date ``<dd> thg <mm>`` is interleaved into the
body, ``la`` is sometimes read as ``Ia`` (capital i + a), and stray words
appear from icons (``tranh``, ``thu``, ``ovo``, ``ooo``, ``Anh``). The
extractor first removes those, then splits the stream by the unique block
header ``The tin dung X<last4> da thuc hien`` and runs independent regexes
on each block — far more tolerant than a single mega-pattern.
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


BLOCK_START = re.compile(
    r"The\s+tin\s+dung\s+X(\d+)\s+da\s+thuc\s+hien", re.IGNORECASE
)
AMOUNT_PATTERN = re.compile(
    r"giao\s+dich\s+VND\s*([\d][\d,.\s]*?)\s+tai\s+", re.IGNORECASE
)
MERCHANT_PATTERN = re.compile(
    r"\btai\s+(.+?)\s+ngay\s+\d{1,2}/\d{1,2}/\d{4}", re.IGNORECASE
)
DATE_PATTERN = re.compile(r"ngay\s+(\d{1,2}/\d{1,2}/\d{4})", re.IGNORECASE)
# "la" is often misread as "Ia" — accept both. Allow noise tokens between
# "tren the" and "la".
DEBT_PATTERN = re.compile(
    r"tren\s+the\b[^.]{0,40}?\b[IlL]a\s+VND\s*([\d][\d,.\s]*?)(?=\s+(?:va|kha|han)\b|$)",
    re.IGNORECASE,
)
AVAIL_PATTERN = re.compile(
    r"kha\s+dung\s+[IlL]a\s+VND\s*([\d][\d,.\s]*?)(?=\s+(?:thu|Giao|The|$)|$)",
    re.IGNORECASE,
)

# Phrases / tokens that are pure OCR noise on this format.
NOISE_REPLACEMENTS = [
    re.compile(r"\b\d{1,2}\s+thg\s+\d{1,2}\b", re.IGNORECASE),  # sidebar date
    re.compile(r"\btranh\b", re.IGNORECASE),  # checkmark icon misread
    re.compile(r"\bovo\b|\booo\b", re.IGNORECASE),  # menu dots
    re.compile(r'["“”]'),  # stray quotation marks
]


def _scrub(text: str) -> str:
    cleaned = text
    for pat in NOISE_REPLACEMENTS:
        cleaned = pat.sub(" ", cleaned)
    return normalize_spaces(cleaned)


def _split_blocks(text: str) -> List[str]:
    """Split the full screen text into per-transaction blocks."""
    matches = list(BLOCK_START.finditer(text))
    if not matches:
        return []
    blocks: List[str] = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        blocks.append(text[start:end])
    return blocks


def _extract_block(block_text: str) -> Optional[Transaction]:
    m = BLOCK_START.search(block_text)
    if not m:
        return None
    card_last4 = m.group(1)

    amount_m = AMOUNT_PATTERN.search(block_text)
    merchant_m = MERCHANT_PATTERN.search(block_text)
    date_m = DATE_PATTERN.search(block_text)
    debt_m = DEBT_PATTERN.search(block_text)
    avail_m = AVAIL_PATTERN.search(block_text)

    # A real block must have the core trio (amount, date, debt). Anything
    # less is almost always a truncated card at the screen edge.
    if not (amount_m and date_m and debt_m):
        return None

    amount = parse_int_amount(amount_m.group(1))
    debt = parse_int_amount(debt_m.group(1)) if debt_m else None
    avail = parse_int_amount(avail_m.group(1)) if avail_m else None

    merchant: Optional[str] = None
    if merchant_m:
        merchant = re.sub(r"\s+", " ", merchant_m.group(1).strip().rstrip(".,"))

    return Transaction(
        source="credit_card",
        datetime=date_m.group(1),
        amount=amount,
        direction="out",
        currency="VND",
        description=merchant,
        raw_text=normalize_spaces(block_text),
        card_last4=f"X{card_last4}",
        merchant=merchant,
        debt_after=debt,
        credit_available=avail,
    )


def extract(items: List[Dict]) -> List[Transaction]:
    text_lines = lines_to_text(group_into_lines(items))
    full = _scrub(" ".join(text_lines))
    transactions: List[Transaction] = []
    for block in _split_blocks(full):
        txn = _extract_block(block)
        if txn is not None:
            transactions.append(txn)
    return transactions
