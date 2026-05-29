"""Extractor for Vietcombank "Biến động" notification screenshots.

Each transaction starts with a short ``dd/mm/yyyy • hh:mm`` header line,
followed by a body of the form::

    Số dư TK VCB <account> <signed_amount> VND lúc <dd-mm-yyyy hh:mm:ss>.
    Số dư <balance> VND. Ref MBVCB.<id>[.<note>]
    .CT tu <from_account> <from_name>
     toi <to_account> <to_name> [tai <bank>]
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from .base import (
    Transaction,
    group_into_lines,
    lines_to_text,
    normalize_spaces,
    parse_int_amount,
)


HEADER_PATTERN = re.compile(
    r"^\s*(\d{1,2})/(\d{1,2})/(\d{4})(?:\s*[•·.\-:]?\s*(\d{1,2}):(\d{2}))?\b"
)
HEADER_REJECT_KEYWORDS = ("VND", "Số dư", "So du", "lúc", "luc", "Ref")
BODY_START_PATTERN = re.compile(
    r"S[ốoôố]\s*d[ưưuôư]\s*TKVCB\s*\d{6,}\s*[+\-?]", re.IGNORECASE
)

SIGNED_AMOUNT_PATTERN = re.compile(r"([+\-?])\s*([\d\.,]+)\s*VND", re.IGNORECASE)
BALANCE_PATTERN = re.compile(
    r"S[ốoôố]\s*d[ưuư]\s+([\d\.,]+)\s*VND", re.IGNORECASE
)
BODY_DATETIME_PATTERN = re.compile(
    r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?"
)
REF_FULL_PATTERN = re.compile(
    r"\bRef\s*(.+?)(?=\s*\.?\s*CT\s*tu\b|$)", re.IGNORECASE
)
REF_ID_SEGMENT_PATTERN = re.compile(r"^[A-Za-z0-9_]+$")
SENDER_PATTERN = re.compile(
    r"\bCT\s*tu\s+(\S+)\s+(.+?)(?=\s*[,.]?\s*toi\b|$)", re.IGNORECASE
)
RECIPIENT_PATTERN = re.compile(
    r"\btoi\s+(\S+)\s+(.+?)(?=\s*[,.]?\s*tai\b|$)", re.IGNORECASE
)
RECIPIENT_BANK_PATTERN = re.compile(r"\btai\s+([A-Za-z0-9_]+)", re.IGNORECASE)


def _is_header_line(clean: str) -> Optional[re.Match]:
    if len(clean) > 30:
        return None
    if any(kw.lower() in clean.lower() for kw in HEADER_REJECT_KEYWORDS):
        return None
    return HEADER_PATTERN.match(clean)


def _split_into_blocks(text_lines: List[str]) -> List[Dict]:
    """Split OCR text into per-transaction blocks.

    A block is delimited by EITHER:
      * a short ``dd/mm/yyyy [hh:mm]`` header line — used as date hint, OR
      * a body-start line ``Số dư TKVCB <account> ±<amount> VND`` — the
        actual first line of the transaction body. This catches the
        first card on a screen (which has no preceding header) and the
        wrap case where the OCR drops the time from a header line.
    """
    blocks: List[Dict] = []
    current: Optional[Dict] = None
    pending_header: Optional[Dict] = None  # most recent header line (date hint)

    def _new_block_from_header(h: Optional[Dict]) -> Dict:
        return {
            "header_date": (h or {}).get("header_date", ""),
            "header_time": (h or {}).get("header_time", ""),
            "body_lines": [],
        }

    for line in text_lines:
        clean = line.strip()
        if not clean:
            continue
        m = _is_header_line(clean)
        if m:
            d, mo, y, h, mi = m.groups()
            pending_header = {
                "header_date": f"{d.zfill(2)}/{mo.zfill(2)}/{y}",
                "header_time": f"{h.zfill(2)}:{mi}" if h and mi else "",
            }
            continue
        if BODY_START_PATTERN.search(clean):
            if current is not None:
                blocks.append(current)
            current = _new_block_from_header(pending_header)
            pending_header = None
            current["body_lines"].append(clean)
        elif current is not None:
            current["body_lines"].append(clean)
    if current is not None:
        blocks.append(current)
    return blocks


def _is_id_segment(s: str) -> bool:
    """A ref segment is an ID iff it's alphanumeric AND contains a digit or
    an uppercase letter. Pure-lowercase short tokens like ``"com"``,
    ``"bun"``, ``"thuoc"`` are transfer notes, not IDs.
    """
    if not REF_ID_SEGMENT_PATTERN.match(s):
        return False
    return any(c.isdigit() or c.isupper() for c in s)


def _split_ref_into_id_and_note(ref_full: str) -> Tuple[Optional[str], Optional[str]]:
    """Split text after "Ref" into an alphanumeric id prefix and a note tail."""
    parts = ref_full.split(".")
    id_parts: List[str] = []
    note_parts: List[str] = []
    for part in parts:
        if not note_parts and _is_id_segment(part):
            id_parts.append(part)
        else:
            note_parts.append(part)
    ref_id = ".".join(id_parts) if id_parts else None
    note = ".".join(note_parts).strip() if note_parts else None
    if note:
        note = _clean_ref_note(note)
    return ref_id, note or None


# Patterns that mark the start of embedded bank-transaction codes inside a
# ref note. Everything from these markers onward is noise.
_NOTE_TRAILING_NOISE = (
    re.compile(r"%[A-Za-z0-9]"),       # e.g. "%SP4020097..." appended by other banks
    re.compile(r"\bFT\d{6,}"),         # IBT FT-id, marks end of human-readable note
    re.compile(r"\bIBT\d"),            # IBT-id variant
    re.compile(r"\bVND-TGTT"),         # core-banking trailer
)


def _clean_ref_note(note: str) -> str:
    """Reduce a raw ref note to just the user-written text.

    Two cleanup passes:
      1. Cut at trailing bank-code markers (%SP..., FT-id, IBT-id, VND-TGTT).
      2. Strip leading "ID-like" whitespace tokens — tokens that contain a
         digit but no lowercase letter (e.g. ``"6106BFTVG29HEBWW"``,
         ``"13821075901:377675.14DAIL"``). These are transfer reference
         codes that snuck into the note section, not the user's text.

    Names in all caps with no digits (``"DO"``, ``"MOMO"``, ``"BACH"``) are
    kept since they may be the start of a recipient-side note.
    """
    earliest = len(note)
    for pat in _NOTE_TRAILING_NOISE:
        m = pat.search(note)
        if m and m.start() < earliest:
            earliest = m.start()
    note = note[:earliest]

    tokens = note.split()
    while tokens:
        first = tokens[0].strip(".,-:")
        # Drop leading tokens that look like alphanumeric IDs — uppercase
        # letters + digits, no lowercase.
        if first and re.search(r"\d", first) and not re.search(r"[a-z]", first):
            tokens.pop(0)
        else:
            break
    note = " ".join(tokens)

    return note.strip(" .,-:").strip()


def _extract_block(block: Dict) -> Transaction:
    body_norm = normalize_spaces(" ".join(block["body_lines"]))
    txn = Transaction(source="vcb_notification", raw_text=body_norm)

    m = SIGNED_AMOUNT_PATTERN.search(body_norm)
    if m:
        sign, num = m.groups()
        amt = parse_int_amount(num)
        if amt is not None:
            txn.amount = amt
            # OCR often misreads "-" as "?" on red (outgoing) amounts, so
            # treat "?" the same as "-".
            txn.direction = "in" if sign == "+" else "out"

    for bm in BALANCE_PATTERN.finditer(body_norm):
        balance_amt = parse_int_amount(bm.group(1))
        if balance_amt is not None and balance_amt != txn.amount:
            txn.balance_after = balance_amt
            break

    dm = BODY_DATETIME_PATTERN.search(body_norm)
    if dm:
        d, mo, y, h, mi, s = dm.groups()
        year = y if len(y) == 4 else f"20{y}"
        dt_str = f"{d.zfill(2)}/{mo.zfill(2)}/{year} {h.zfill(2)}:{mi}"
        if s:
            dt_str += f":{s}"
        txn.datetime = dt_str
    else:
        time_part = block.get("header_time") or ""
        txn.datetime = (
            f"{block['header_date']} {time_part}".strip()
            if block.get("header_date")
            else None
        )

    ref_note: Optional[str] = None
    rfm = REF_FULL_PATTERN.search(body_norm)
    if rfm:
        ref_full = rfm.group(1).strip().rstrip(".")
        ref_id, ref_note = _split_ref_into_id_and_note(ref_full)
        txn.reference = ref_id

    sm = SENDER_PATTERN.search(body_norm)
    if sm:
        txn.sender_account = sm.group(1).rstrip(".,")
        txn.sender_name = sm.group(2).strip().rstrip(".,")

    rm2 = RECIPIENT_PATTERN.search(body_norm)
    if rm2:
        txn.recipient_account = rm2.group(1).rstrip(".,")
        txn.recipient_name = rm2.group(2).strip().rstrip(".,")

    bm2 = RECIPIENT_BANK_PATTERN.search(body_norm)
    if bm2:
        txn.recipient_bank = bm2.group(1)

    # Priority: user-written note (ref_note) > counterparty name.
    # For outgoing transfers the recipient is often the user's own name (CT
    # tu / toi same person), so the note is what tells us the purpose.
    if ref_note:
        txn.description = ref_note
    elif txn.recipient_name:
        txn.description = txn.recipient_name
    elif txn.sender_name:
        txn.description = txn.sender_name

    return txn


def extract(items: List[Dict]) -> List[Transaction]:
    text_lines = lines_to_text(group_into_lines(items))
    blocks = _split_into_blocks(text_lines)
    return [_extract_block(b) for b in blocks]
