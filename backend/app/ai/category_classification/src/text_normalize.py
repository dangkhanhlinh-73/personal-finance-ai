"""Shared text normalizer used as the TF-IDF preprocessor.

Imported by both ``train_classifier.py`` and ``predict.py`` (the trained
pipeline pickles a *reference* to ``vn_normalize`` by module path, so this
module must stay importable next to the model).

Vietnamese bank OCR is inconsistent about diacritics — VCB notification bodies
are often stripped ("tien dien", "com") while MoMo keeps them
("Nhận từ ...", "Tiền lời ..."). Folding to a diacritic-free, lowercase form
makes the classifier invariant to that, so both spellings share features.
"""

from __future__ import annotations

import unicodedata


def vn_normalize(s: str) -> str:
    s = s.lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn")
