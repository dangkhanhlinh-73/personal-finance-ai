"""Inference for the category classifiers (CPU-only).

Load once, reuse for many predictions.

Python:
    from predict import CategoryClassifier

    inv = CategoryClassifier("invoice")
    inv.predict("THỊT BÒ XAY - (KG) - VAT 5%")        -> "Thịt cá hải sản"

CLI:
    python predict.py bank "cơm tấm sườn"
    python predict.py invoice "sữa chua vinamilk"
"""

from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path
from typing import List, Tuple, Union

# Ensure this dir is importable so joblib can unpickle the model's reference to
# ``text_normalize.vn_normalize`` even when predict.py is imported from elsewhere.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import joblib

from config import MODELS_DIR

VALID = ("bank", "invoice")


class CategoryClassifier:
    def __init__(self, name: str):
        if name not in VALID:
            raise ValueError(f"name must be one of {VALID}, got {name!r}")
        path = MODELS_DIR / name / "model.joblib"
        if not path.exists():
            raise FileNotFoundError(f"{path} not found — run train.py first.")
        self.name = name
        self.pipe = joblib.load(path)
        self.labels = list(self.pipe.classes_)

    def predict(self, text: Union[str, List[str]]):
        single = isinstance(text, str)
        out = self.pipe.predict([text] if single else text)
        return out[0] if single else list(out)

    def predict_proba(self, text: str, topk: int = 3) -> List[Tuple[str, float]]:
        probs = self.pipe.predict_proba([text])[0]
        ranked = sorted(zip(self.labels, probs), key=lambda x: x[1], reverse=True)
        return [(lab, float(p)) for lab, p in ranked[:topk]]


@lru_cache(maxsize=None)
def get_classifier(name: str) -> CategoryClassifier:
    """Cached singleton accessor (loads the model only once)."""
    return CategoryClassifier(name)


def _cli() -> None:
    if len(sys.argv) < 3 or sys.argv[1] not in VALID:
        print(f"usage: python predict.py <{'|'.join(VALID)}> \"<text>\"")
        raise SystemExit(1)
    name, text = sys.argv[1], " ".join(sys.argv[2:])
    clf = get_classifier(name)
    print(f"[{name}] {text!r}")
    for lab, p in clf.predict_proba(text, topk=3):
        print(f"  {p:6.2%}  {lab}")


if __name__ == "__main__":
    _cli()
