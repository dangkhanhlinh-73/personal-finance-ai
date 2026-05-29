"""Shared types and OCR-line utilities used by every format-specific extractor."""

from __future__ import annotations

import re
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np


@dataclass
class Transaction:
    """Unified transaction record across all supported formats.

    Each format populates only the fields that make sense for it; the rest
    stay ``None``. ``source`` identifies which extractor produced the record
    and is useful when post-processing or debugging.
    """

    # provenance
    source: Optional[str] = None  # e.g. "vcb_notification" | "credit_card" | "momo"

    # universal
    datetime: Optional[str] = None
    amount: Optional[int] = None
    direction: Optional[str] = None  # "in" | "out"
    currency: str = "VND"
    description: Optional[str] = None
    raw_text: str = ""

    # account-balance style (VCB notification, MoMo)
    balance_after: Optional[int] = None

    # bank-transfer counterparties (VCB)
    sender_name: Optional[str] = None
    sender_account: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_account: Optional[str] = None
    recipient_bank: Optional[str] = None
    reference: Optional[str] = None

    # credit-card specific
    card_last4: Optional[str] = None
    merchant: Optional[str] = None
    debt_after: Optional[int] = None
    credit_available: Optional[int] = None

    # MoMo specific
    category: Optional[str] = None  # "Lợi nhuận" | "Hóa đơn" | "Trợ cấp" | ...

    # invoice / receipt specific
    invoice_number: Optional[str] = None
    payment_method: Optional[str] = None  # "Cà thẻ ACB" | "Tiền mặt" | "Tiền chuyển khoản" | ...
    tax_amount: Optional[int] = None
    items: List[Dict[str, Any]] = field(default_factory=list)

    # extras (any format may stash extra fields here)
    extras: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return asdict(self)


def _box_center(box) -> Tuple[float, float]:
    arr = np.asarray(box, dtype=np.float32)
    return float(arr[:, 0].mean()), float(arr[:, 1].mean())


def _box_height(box) -> float:
    arr = np.asarray(box, dtype=np.float32)
    return float(arr[:, 1].max() - arr[:, 1].min())


def group_into_lines(
    items: List[Dict], y_tol_ratio: float = 0.6
) -> List[List[Dict]]:
    """Group OCR items by visual line. Two boxes belong to the same line when
    their y-centers differ by less than ``y_tol_ratio`` of the average box
    height. Items within a line are sorted left-to-right.
    """
    if not items:
        return []
    enriched = []
    for it in items:
        cx, cy = _box_center(it["box"])
        h = _box_height(it["box"])
        enriched.append((cy, cx, h, it))
    enriched.sort(key=lambda t: (t[0], t[1]))

    lines: List[List[Tuple]] = []
    avg_h = float(np.mean([e[2] for e in enriched])) or 20.0
    tol = avg_h * y_tol_ratio
    for cy, cx, h, it in enriched:
        placed = False
        for line in lines:
            line_cy = float(np.mean([e[0] for e in line]))
            if abs(cy - line_cy) <= tol:
                line.append((cy, cx, h, it))
                placed = True
                break
        if not placed:
            lines.append([(cy, cx, h, it)])

    lines.sort(key=lambda line: float(np.mean([e[0] for e in line])))
    return [
        [it for _, _, _, it in sorted(line, key=lambda e: e[1])] for line in lines
    ]


def lines_to_text(lines: List[List[Dict]]) -> List[str]:
    return [
        " ".join(it["text"] for it in line if it["text"]).strip() for line in lines
    ]


def parse_int_amount(raw: str) -> Optional[int]:
    """Parse a Vietnamese-style amount string to int (drop commas/dots)."""
    digits = re.sub(r"[^\d]", "", raw)
    return int(digits) if digits else None


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()
