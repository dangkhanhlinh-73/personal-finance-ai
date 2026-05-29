"""Extractor for VietinBank iPay "Biến động số dư" notification screenshots.

Each transaction is a label-value card::

    <dd/mm/yyyy> • <hh:mm>                       (card header — ignored)
    Thời gian: <dd/mm/yyyy hh:mm>
    Tài khoản: <account>
    Giao dịch: <±amount>VND                       (green + = in, red - = out)
    Số dư hiện tại: <amount>VND
    Nội dung: <content ...>; tai iPay             (may wrap onto next line(s))

Blocks are split on the ``Thời gian:`` label line. The labels make parsing
robust, but the OCR introduces a few quirks this module corrects:

  * the "+" sign on incoming (green) amounts is often misread as "%" or as the
    digit "4" glued to the number (``+500,000`` → ``4500,000``);
  * the balance sometimes uses "." instead of "," as the thousands separator;
  * the "Nội dung" content wraps across lines, carries a trailing channel
    marker ("; tai iPay"), and interbank notes are prefixed with a code
    ``CT DEN:<code>`` / ``CT DI:<code>``.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from .base import (
    Transaction,
    group_into_lines,
    lines_to_text,
    normalize_spaces,
    parse_int_amount,
)

TIME_LABEL = re.compile(
    r"Th[ờoơ]i\s*gian\s*:?\s*(\d{1,2})/(\d{1,2})/(\d{4})\s+(\d{1,2}):(\d{2})", re.I
)
ACCOUNT_LABEL = re.compile(r"T[àa]i\s*kho[ảa]n\s*:?\s*(\d{6,})", re.I)
TXN_LABEL = re.compile(
    r"Giao\s*d[ịi]ch\s*:?\s*([%+\-]?\s*[\d.,]+)\s*VND", re.I
)
BALANCE_LABEL = re.compile(
    r"S[ốo]\s*d[ưu]\s*hi[ệe]n\s*t[ạa]i\s*:?\s*([\d.,]+)\s*VND", re.I
)
CONTENT_LABEL = re.compile(r"N[ộo]i\s*dung\s*:?\s*(.*)$", re.I)
DATE_HEADER = re.compile(r"^\s*-?\s*\d{1,2}/\d{1,2}/\d{4}")
DIGITS = re.compile(r"[\d.,]+")


def _split_blocks(lines: List[str]) -> List[List[str]]:
    """One block per ``Thời gian:`` label line (lines before the first are dropped)."""
    blocks: List[List[str]] = []
    current: Optional[List[str]] = None
    for line in lines:
        s = line.strip()
        if not s:
            continue
        if TIME_LABEL.search(s):
            if current is not None:
                blocks.append(current)
            current = [s]
        elif current is not None:
            current.append(s)
    if current is not None:
        blocks.append(current)
    return blocks


def _clean_magnitude(num: str) -> Optional[int]:
    """Parse a comma-grouped VND number, fixing the "+ misread as a glued digit"
    case: a valid VietinBank amount has a first thousands-group of 1–3 digits, so
    a 4-digit first group means a misread sign digit was glued on (``4500,000`` →
    ``500,000``).
    """
    n = num.strip().rstrip(".")
    if "," in n:
        groups = n.split(",")
        if len(groups[0]) == 4:
            groups[0] = groups[0][1:]
        n = "".join(groups)
    return parse_int_amount(n)


def _amount_and_direction(raw: str) -> Tuple[Optional[int], Optional[str]]:
    """``raw`` is the sign+number before VND, e.g. ``%500,000`` / ``4500,000`` /
    ``-20,000`` / ``+1,320,000``. Red (``-``) is outgoing; everything else
    (``+``, ``%``, glued ``4``) is incoming.
    """
    direction = "out" if "-" in raw else "in"
    m = DIGITS.search(raw)
    if not m:
        return None, direction
    return _clean_magnitude(m.group(0)), direction


def _collect_content(block: List[str]) -> str:
    """Content of the ``Nội dung:`` field + wrapped continuation lines."""
    out: List[str] = []
    collecting = False
    for s in block:
        if collecting:
            if DATE_HEADER.match(s):
                break
            out.append(s)
            continue
        m = CONTENT_LABEL.search(s)
        if m:
            collecting = True
            rest = m.group(1).strip()
            if rest:
                out.append(rest)
    return normalize_spaces(" ".join(out))


def _clean_content(text: str) -> str:
    """Drop the channel trailer and the interbank reference-code prefix."""
    # cut "; tai iPay" / "; tai ..." channel marker
    text = re.split(r";\s*tai\b", text, maxsplit=1, flags=re.I)[0]
    text = re.sub(r"\s+tai\s+iPay\s*$", "", text, flags=re.I)
    # strip "CT DEN:<code>" / "CT DI:<code>" prefix, keep the human note
    m = re.match(r"^\s*CT\s*(?:DEN|DI)\s*:?\s*\S+\s+(.*)$", text, flags=re.I)
    if m:
        text = re.sub(r"^QR\s*-?\s*", "", m.group(1), flags=re.I)
    return normalize_spaces(text).strip(" .,-;")


def _extract_block(block: List[str]) -> Transaction:
    full = normalize_spaces(" ".join(block))
    txn = Transaction(source="vietin", raw_text=full)

    for s in block:
        tm = TIME_LABEL.search(s)
        if tm:
            d, mo, y, h, mi = tm.groups()
            txn.datetime = f"{d.zfill(2)}/{mo.zfill(2)}/{y} {h.zfill(2)}:{mi}"
            break

    am = ACCOUNT_LABEL.search(full)
    if am:
        txn.extras["account"] = am.group(1)

    gm = TXN_LABEL.search(full)
    if gm:
        amt, direction = _amount_and_direction(gm.group(1))
        txn.amount = amt
        txn.direction = direction

    bm = BALANCE_LABEL.search(full)
    if bm:
        bal = parse_int_amount(bm.group(1))
        if bal is not None:
            txn.balance_after = bal

    desc = _clean_content(_collect_content(block))
    if desc:
        txn.description = desc

    return txn


def extract(items: List[dict]) -> List[Transaction]:
    text_lines = lines_to_text(group_into_lines(items))
    blocks = _split_blocks(text_lines)
    return [_extract_block(b) for b in blocks]
