"""Extractor for retail invoice / receipt screenshots.

Supports invoices that look like::

    [Brand title (e.g. "Invoice", "Hoá đơn điện tử")]
    [Merchant legal/brand name]
    [Số HĐ / Số CT: <invoice_no>]   [Ngày: <dd/mm/yyyy hh:mm>]
    ...
    [Items table — header row | rows | totals row]
    Tổng tiền (có VAT): / Phải thanh toán: <total>
    [Payment method line: Cà thẻ <bank>: / Tiền chuyển khoản: ...]

Each invoice produces exactly one ``Transaction`` (direction="out"). The
extractor focuses on the high-value fields for personal-finance use cases:
``total``, ``merchant``, ``datetime``, ``invoice_number``, ``payment_method``.
A best-effort list of items (name + line total) is attached as ``items``.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from .base import (
    Transaction,
    _box_center,
    group_into_lines,
    lines_to_text,
    normalize_spaces,
    parse_int_amount,
)


INVOICE_NUMBER_PATTERN = re.compile(
    r"S[ốố]\s*(?:H[ĐD]|CT|HOA\s*DON)\s*:?\s*([A-Z0-9\-]+)", re.IGNORECASE
)
DATETIME_PATTERN = re.compile(
    r"(\d{1,2}/\d{1,2}/\d{4})\s+(\d{1,2}:\d{2})"
)
TOTAL_PATTERNS = (
    re.compile(r"Ph[ảaă]i\s+thanh\s+to[áa]n[\s:]*([\d][\d,.\s]*)", re.IGNORECASE),
    re.compile(r"T[ổôo]ng\s+ti[ềe]n.*?:\s*([\d][\d,.\s]*)", re.IGNORECASE),
    re.compile(r"T[ổôo]ng\s+c[ộôo]ng[\s:]*([\d][\d,.\s]*)", re.IGNORECASE),
)
# Strict VAT line: "Thuế GTGT 5%: 12,506" — requires the tax-rate
# percentage between the keyword and the value so it never matches the
# "(VAT 5%)" annotation that appears inside item descriptions.
TAX_PATTERN = re.compile(
    r"Thu[ếê]\s*GTGT\s*\d+\s*%?\s*[:.]?\s*([\d][\d,.\s]*)",
    re.IGNORECASE,
)
# Payment method: lines like "Cà thẻ ACB:" / "Tiền mặt:" / "Tiền chuyển khoản:".
PAYMENT_PATTERNS = (
    re.compile(r"\b(C[àa]\s+th[ẻe](?:\s+\S+)?)\s*:", re.IGNORECASE),
    re.compile(r"\b(Ti[ềe]n\s+chuy[ểe]n\s+kho[ảa]n)\s*:", re.IGNORECASE),
    re.compile(r"\b(Ti[ềe]n\s+m[ặa]t)\s*:", re.IGNORECASE),
    re.compile(r"\b(V[íi]\s+\S+)\s*:", re.IGNORECASE),
)
MERCHANT_HINTS = ("CÔNG TY", "CONG TY", "PHIẾU THANH TOÁN", "PHIEU THANH TOAN")
TABLE_HEADER_HINTS = ("Thành tiền", "Đơn giá", "Giá bán", "Thanh tien", "Don gia")
TOTALS_BOUNDARY_KEYWORDS = (
    "Tổng tiền",
    "Tổng cộng",
    "Phải thanh toán",
    "Phai thanh toan",
    "Tong cong",
    "Tong tien",
    "Tổng số lượng",
)


def _find_first(text_lines: List[str], predicate) -> Optional[int]:
    for i, line in enumerate(text_lines):
        if predicate(line):
            return i
    return None


def _extract_merchant(text_lines: List[str]) -> Optional[str]:
    for line in text_lines[:15]:
        upper = line.upper()
        if "PHIẾU THANH TOÁN" in upper or "PHIEU THANH TOAN" in upper:
            cleaned = re.sub(
                r"^.*PHI[ẾE]U\s+THANH\s+TO[ÁA]N\s*",
                "",
                line,
                flags=re.IGNORECASE,
            ).strip()
            if cleaned:
                return cleaned
        if any(h in upper for h in ("CÔNG TY", "CONG TY")):
            return line.strip()
    return None


def _extract_invoice_number(full_text: str) -> Optional[str]:
    m = INVOICE_NUMBER_PATTERN.search(full_text)
    return m.group(1).strip() if m else None


def _extract_datetime(full_text: str) -> Optional[str]:
    m = DATETIME_PATTERN.search(full_text)
    if not m:
        return None
    return f"{m.group(1)} {m.group(2)}"


def _extract_total(full_text: str) -> Optional[int]:
    for pat in TOTAL_PATTERNS:
        m = pat.search(full_text)
        if m:
            value = parse_int_amount(m.group(1))
            if value is not None:
                return value
    return None


def _extract_tax(full_text: str) -> Optional[int]:
    m = TAX_PATTERN.search(full_text)
    return parse_int_amount(m.group(1)) if m else None


def _extract_payment_method(full_text: str) -> Optional[str]:
    for pat in PAYMENT_PATTERNS:
        m = pat.search(full_text)
        if m:
            return normalize_spaces(m.group(1))
    return None


_NUMBER_TOKEN = re.compile(r"^[\d][\d,.\s]*$")


def _find_column_anchors(header_line: List[Dict]) -> Dict[str, float]:
    """Return x-centers of {qty, unit_price, total} columns from the header row.

    Two layouts are supported:
        * ``Đơn giá (có VAT) | SL | Thành tiền`` (King Food: price-left)
        * ``SL | Giá bán (có VAT) | Thành tiền`` (Bách Hóa Xanh: qty-left)
    """
    anchors: Dict[str, float] = {}
    for it in header_line:
        text = it["text"].strip()
        cx, _ = _box_center(it["box"])
        upper = text.upper()
        if upper.startswith("SL") or upper == "SL":
            anchors["qty"] = cx
        elif "ĐƠN GIÁ" in upper or "GIÁ BÁN" in upper or "DON GIA" in upper:
            anchors["unit_price"] = cx
        elif "THÀNH TIỀN" in upper or "THANH TIEN" in upper:
            anchors["total"] = cx
    return anchors


def _assign_to_column(token_x: float, anchors: Dict[str, float]) -> Optional[str]:
    if not anchors:
        return None
    return min(anchors.items(), key=lambda kv: abs(kv[1] - token_x))[0]


def _extract_items(lines: List[List[Dict]], text_lines: List[str]) -> List[Dict[str, Any]]:
    """Walk lines between the table header and the totals section, pairing
    item name lines with the following values line. Returns ``[]`` if the
    section can't be located.
    """
    header_idx = _find_first(
        text_lines,
        lambda t: any(h in t for h in TABLE_HEADER_HINTS),
    )
    if header_idx is None:
        return []
    totals_idx = _find_first(
        text_lines[header_idx + 1 :],
        lambda t: any(k in t for k in TOTALS_BOUNDARY_KEYWORDS),
    )
    if totals_idx is None:
        return []
    totals_idx += header_idx + 1

    anchors = _find_column_anchors(lines[header_idx])

    items: List[Dict[str, Any]] = []
    name_buffer: List[str] = []
    for line in lines[header_idx + 1 : totals_idx]:
        numeric_tokens: List[Dict] = []
        text_tokens: List[Dict] = []
        for it in line:
            txt = it["text"].strip()
            if not txt:
                continue
            cleaned = txt.split("(")[0].strip()  # drop "(VAT 5%)" suffix
            if _NUMBER_TOKEN.match(cleaned):
                numeric_tokens.append(it)
            else:
                text_tokens.append(it)

        is_values_row = len(numeric_tokens) >= 2 and not any(
            len(it["text"].strip()) > 8
            and not _NUMBER_TOKEN.match(it["text"].strip().split("(")[0])
            for it in text_tokens
        )

        if is_values_row:
            name = normalize_spaces(" ".join(name_buffer))
            item: Dict[str, Any] = {"name": name or None}
            # Assign each numeric token to its column based on x-distance to
            # the header anchors. If anchors are missing we fall back to
            # rightmost = total.
            if anchors:
                col_to_token: Dict[str, Dict] = {}
                for tok in numeric_tokens:
                    cx, _ = _box_center(tok["box"])
                    col = _assign_to_column(cx, anchors)
                    if col and col not in col_to_token:
                        col_to_token[col] = tok
                if "total" in col_to_token:
                    item["total"] = parse_int_amount(col_to_token["total"]["text"])
                if "qty" in col_to_token:
                    item["qty"] = col_to_token["qty"]["text"].strip()
                if "unit_price" in col_to_token:
                    # Item rows like ``99,000 109,000`` carry the discounted
                    # price first followed by the struck-out original. Keep
                    # the first (effective) one.
                    raw = col_to_token["unit_price"]["text"].strip()
                    first = raw.split()[0] if raw else ""
                    item["unit_price"] = parse_int_amount(first)
            else:
                numeric_tokens.sort(key=lambda it: _box_center(it["box"])[0])
                item["total"] = parse_int_amount(numeric_tokens[-1]["text"])

            if item.get("name") or item.get("total") is not None:
                items.append(item)
            name_buffer = []
        else:
            for it in text_tokens:
                name_buffer.append(it["text"].strip())
    return items


def extract(items_in: List[Dict]) -> List[Transaction]:
    lines = group_into_lines(items_in)
    text_lines = lines_to_text(lines)
    full_text = normalize_spaces(" ".join(text_lines))

    merchant = _extract_merchant(text_lines)
    invoice_no = _extract_invoice_number(full_text)
    datetime_str = _extract_datetime(full_text)
    total = _extract_total(full_text)
    tax = _extract_tax(full_text)
    payment_method = _extract_payment_method(full_text)
    items_list = _extract_items(lines, text_lines)

    if total is None and merchant is None:
        return []

    txn = Transaction(
        source="invoice",
        datetime=datetime_str,
        amount=total,
        direction="out",
        currency="VND",
        description=merchant,
        raw_text=full_text,
        merchant=merchant,
        invoice_number=invoice_no,
        payment_method=payment_method,
        tax_amount=tax,
        items=items_list,
    )
    return [txn]
