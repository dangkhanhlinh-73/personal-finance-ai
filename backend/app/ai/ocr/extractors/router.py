"""Auto-detect which extractor to apply, based on the recognised text.

Source rules live in ``src/config/sources.yaml``. Each entry maps a
canonical source name (e.g. ``VCB``) to a list of keywords and the name
of the extractor module under ``src/extractors/`` that handles it. When
no source has a keyword hit, the pipeline falls back to ``general``.
"""

from __future__ import annotations

import importlib
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import yaml

from .base import Transaction, group_into_lines, lines_to_text, normalize_spaces


CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "sources.yaml"
FALLBACK_SOURCE = "Unknown"
FALLBACK_MODULE = "general"


@dataclass
class SourceRule:
    name: str  # canonical name written into Transaction.source
    keywords: List[str]
    module_name: str


def _load_rules(path: Path = CONFIG_PATH) -> List[SourceRule]:
    with path.open("r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    rules: List[SourceRule] = []
    for name, spec in (cfg.get("sources") or {}).items():
        keywords = list(spec.get("keywords") or [])
        module_name = spec.get("extractor")
        if not module_name:
            raise ValueError(f"sources.yaml: '{name}' missing 'extractor'")
        rules.append(SourceRule(name=name, keywords=keywords, module_name=module_name))
    return rules


_RULES: List[SourceRule] = _load_rules()


def _full_text(items: List[Dict]) -> str:
    text_lines = lines_to_text(group_into_lines(items))
    return normalize_spaces(" ".join(text_lines)).lower()


def _best_rule(items: List[Dict]) -> Optional[SourceRule]:
    full = _full_text(items)
    best: Optional[SourceRule] = None
    best_hits = 0
    for rule in _RULES:
        hits = sum(1 for kw in rule.keywords if kw.lower() in full)
        if hits > best_hits:
            best_hits = hits
            best = rule
    return best


def detect_format(items: List[Dict]) -> str:
    """Return the canonical source name for these OCR items.

    Returns ``"Unknown"`` when no configured source has any keyword hit.
    """
    rule = _best_rule(items)
    return rule.name if rule is not None else FALLBACK_SOURCE


def extract_transactions(items: List[Dict]) -> List[Transaction]:
    """Pick the best-matching extractor and run it on ``items``.

    If no configured source matches, falls back to the ``general`` extractor
    so callers still receive a (best-effort) ``Transaction`` for review.
    The canonical source name is written into ``Transaction.source`` of every
    returned record, overriding whatever the extractor wrote internally.
    """
    rule = _best_rule(items)
    if rule is not None:
        module = importlib.import_module(f".{rule.module_name}", package=__package__)
        source_name = rule.name
    else:
        module = importlib.import_module(f".{FALLBACK_MODULE}", package=__package__)
        source_name = FALLBACK_SOURCE

    txns = module.extract(items)
    for txn in txns:
        txn.source = source_name
    return txns
