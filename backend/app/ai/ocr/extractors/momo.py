"""Extractor for MoMo wallet "Lịch sử giao dịch" screens.

A MoMo screen shows a vertical stack of transaction cards. Each card has the
shape::

    [Title (may wrap to 2 lines)]      [Amount, e.g. +7d / -20.000d]
    [Date inside title or below]       [Số dư Túi: <balance>d]
    [HH:MM - dd/mm/yyyy]
    [Category tag]

OCR limitations on this format:
    * The leading ``+`` is consistently misread as ``4`` (green plus icon).
    * The leading ``-`` is dropped on red amounts.
    * ``đ`` is read as ``d``.

We therefore ignore the OCR-supplied sign of the amount and infer the
direction from the title keyword (Nạp/Chuyển/Thanh toán → out; Nhận/Tiền
lời/Hoàn → in). Blocks are separated by visual y-gaps between cards.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

import numpy as np

from .base import (
    Transaction,
    group_into_lines,
    normalize_spaces,
    parse_int_amount,
    _box_center,
)


TIMEDATE_PATTERN = re.compile(
    r"(\d{1,2}):(\d{2})\s*[-–\s]+\s*(\d{1,2})/(\d{1,2})/(\d{4})"
)
SHORT_DATE_PATTERN = re.compile(r"^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*$")
BALANCE_PATTERN = re.compile(
    r"S[ốoôố]\s*d[ưưuôu]?\s+T[úuư]i\s*[:\.]?\s*([\d,.]+)", re.IGNORECASE
)
# Stand-alone amount on the right, after stripping signs/currency/whitespace.
# Accepts the "4" misread of "+" so a value like "47d" still parses.
AMOUNT_TOKEN_PATTERN = re.compile(r"^\s*[+\-4]?\s*([\d][\d,.]*)\s*[dđ]?\s*$")

KNOWN_CATEGORIES = {"Lợi nhuận", "Hóa đơn", "Trợ cấp", "Mua sắm", "Ăn uống"}

OUT_KEYWORDS = (
    "Nạp",
    "Chuyển đến",
    "Chuyển tiền đến",
    "Thanh toán",
    "Mua",
    "Rút",
)
IN_KEYWORDS = (
    "Nhận từ",
    "Tiền lời",
    "Hoàn tiền",
    "Hoàn",
    "Trợ cấp",
)

UI_NOISE_PATTERNS = (
    re.compile(r"^[a-z0-9]$", re.IGNORECASE),  # single char like "z", "6", "5"
    re.compile(r"^\d{1,2}$"),  # short stray digits like "13"
    re.compile(r"^[%§\$&]+$"),
    re.compile(r"^Á\s*ẩn", re.IGNORECASE),  # "Á ẩn khỏi báo cáo" UI control
    # Bottom navbar items
    re.compile(r"^MoMo$", re.IGNORECASE),
    re.compile(r"^Ưu đãi$", re.IGNORECASE),
    re.compile(r"^Quét mọi QR$", re.IGNORECASE),
    re.compile(r"^Lịch sử GD$", re.IGNORECASE),
    re.compile(r"^Tôi$", re.IGNORECASE),
    re.compile(r"^ms$", re.IGNORECASE),
    # Top filter chips
    re.compile(r"^Tất cả$", re.IGNORECASE),
    re.compile(r"^Hoạt động$", re.IGNORECASE),
    re.compile(r"^Thống kê$", re.IGNORECASE),
    re.compile(r"^Chuyển tiền$", re.IGNORECASE),
    re.compile(r"^Nhận tiền$", re.IGNORECASE),
    re.compile(r"^Điện t$", re.IGNORECASE),
    re.compile(r"^Tìm kiếm.*$", re.IGNORECASE),
    re.compile(r"^\d+xu$", re.IGNORECASE),  # "4xu" coin badge
)


def _is_noise(text: str) -> bool:
    t = text.strip()
    if not t:
        return True
    return any(p.match(t) for p in UI_NOISE_PATTERNS)


def _cluster_blocks(
    lines: List[List[Dict]], gap_threshold: float = 120.0
) -> List[List[List[Dict]]]:
    """Cluster grouped lines into per-card blocks based on vertical gaps."""
    blocks: List[List[List[Dict]]] = []
    current: List[List[Dict]] = []
    prev_y: Optional[float] = None
    for line in lines:
        ys = [_box_center(it["box"])[1] for it in line]
        cy = float(np.mean(ys))
        if prev_y is not None and cy - prev_y > gap_threshold:
            if current:
                blocks.append(current)
                current = []
        current.append(line)
        prev_y = cy
    if current:
        blocks.append(current)
    return blocks


def _direction_from_title(title: str) -> Optional[str]:
    lo = title.lower()
    for kw in OUT_KEYWORDS:
        if kw.lower() in lo:
            return "out"
    for kw in IN_KEYWORDS:
        if kw.lower() in lo:
            return "in"
    return None


def _extract_recipient(title: str) -> Optional[str]:
    """For 'Chuyển đến X (Bank)' titles, pull the recipient name."""
    m = re.search(r"Chuyển\s+đến\s+(.+?)(?:\s*\(([^)]+)\))?$", title, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return None


def _extract_sender(title: str) -> Optional[str]:
    m = re.search(r"Nhận\s+từ\s+(.+)$", title, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return None


def _extract_recipient_bank(title: str) -> Optional[str]:
    m = re.search(r"\(([^)]+)\)\s*$", title)
    return m.group(1).strip() if m else None


def _classify_lines(block_lines: List[List[Dict]]) -> Dict:
    """Walk lines top-down and pick out title fragments, amount, time, balance, category."""
    width_max = 0
    for line in block_lines:
        for it in line:
            for x, _ in it["box"]:
                if x > width_max:
                    width_max = x
    right_threshold = width_max * 0.55  # tokens whose center sits right of this are "right column"

    title_parts: List[str] = []
    amount_raw: Optional[str] = None
    balance_raw: Optional[str] = None
    timedate: Optional[str] = None
    in_title_date: Optional[str] = None
    category: Optional[str] = None

    for line in block_lines:
        # Split the line items into left-column and right-column.
        for it in line:
            text = it["text"].strip()
            if _is_noise(text):
                continue
            cx, _ = _box_center(it["box"])
            is_right = cx > right_threshold

            if BALANCE_PATTERN.search(text):
                bm = BALANCE_PATTERN.search(text)
                if bm:
                    balance_raw = bm.group(1)
                continue
            if TIMEDATE_PATTERN.search(text):
                td = TIMEDATE_PATTERN.search(text)
                if td:
                    h, mi, d, mo, y = td.groups()
                    timedate = (
                        f"{d.zfill(2)}/{mo.zfill(2)}/{y} "
                        f"{h.zfill(2)}:{mi}"
                    )
                continue
            if SHORT_DATE_PATTERN.match(text):
                sd = SHORT_DATE_PATTERN.match(text)
                if sd:
                    d, mo, y = sd.groups()
                    in_title_date = f"{d.zfill(2)}/{mo.zfill(2)}/{y}"
                continue
            stripped = text.strip().rstrip(".,")
            if stripped in KNOWN_CATEGORIES:
                category = stripped
                continue
            am = AMOUNT_TOKEN_PATTERN.match(text)
            if is_right and am and amount_raw is None:
                # Capture only the digit portion. The leading [+\-4]? consumes
                # the OCR-misread sign character, so what remains is the true
                # amount.
                amount_raw = am.group(1)
                continue
            # Otherwise treat as a title fragment (left column or wrapped right
            # column text). Skip very short numeric-only tokens.
            if re.fullmatch(r"\d+", stripped):
                continue
            title_parts.append(stripped)

    return {
        "title": normalize_spaces(" ".join(title_parts)),
        "amount_raw": amount_raw,
        "balance_raw": balance_raw,
        "timedate": timedate,
        "in_title_date": in_title_date,
        "category": category,
    }


def _build_transaction(parsed: Dict) -> Optional[Transaction]:
    title = parsed["title"]
    if not title:
        return None
    amount = parse_int_amount(parsed["amount_raw"]) if parsed["amount_raw"] else None
    balance = parse_int_amount(parsed["balance_raw"]) if parsed["balance_raw"] else None

    direction = _direction_from_title(title)
    recipient = _extract_recipient(title)
    sender = _extract_sender(title)
    bank = _extract_recipient_bank(title)

    datetime_str = parsed["timedate"] or parsed["in_title_date"]

    txn = Transaction(
        source="momo",
        datetime=datetime_str,
        amount=amount,
        direction=direction,
        currency="VND",
        description=title,
        balance_after=balance,
        recipient_name=recipient,
        sender_name=sender,
        recipient_bank=bank,
        category=parsed["category"],
        raw_text=title,
    )
    return txn


def extract(items: List[Dict]) -> List[Transaction]:
    lines = group_into_lines(items)
    blocks = _cluster_blocks(lines)

    transactions: List[Transaction] = []
    for block_lines in blocks:
        parsed = _classify_lines(block_lines)
        # A genuine transaction card has at least one of: a HH:MM-dd/mm/yyyy
        # timestamp, a "Số dư Túi" balance, or a known category tag. Status
        # bar / search bar / tab clusters at the top of the screen have none
        # of these and would otherwise leak through with garbage like "3001"
        # parsed as an amount.
        signals = sum(
            1
            for v in (parsed["timedate"], parsed["balance_raw"], parsed["category"])
            if v
        )
        if signals < 1:
            continue
        if not parsed["title"]:
            continue
        txn = _build_transaction(parsed)
        if txn is not None:
            transactions.append(txn)
    return transactions
