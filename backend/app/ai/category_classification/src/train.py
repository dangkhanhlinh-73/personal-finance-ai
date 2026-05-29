"""Train the two category classifiers (bank notifications + invoice items).

Model = TF-IDF (word 1-2gram  ⊕  char_wb 3-5gram)  ->  LogisticRegression.
Char n-grams make it robust to OCR/diacritic noise (thăn/than, VAT/VẠT);
word n-grams capture multi-token cues (nộp quỹ, vé máy bay, sữa chua).

CPU-only, tiny (~1-2 MB), fast inference. Artifacts per model:

    models/<name>/model.joblib    full sklearn Pipeline (vectorizer + clf)
    models/<name>/metadata.json   labels, sizes, CV + hold-out metrics

Run:  python train_classifier.py
"""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple

import joblib
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline

from config import MODELS_DIR, TRAINING_BANK, TRAINING_INVOICE
from text_normalize import vn_normalize

SEED = 42

MODELS = [
    ("bank", TRAINING_BANK),
    ("invoice", TRAINING_INVOICE),
]


def load_xy(path: Path) -> Tuple[List[str], List[str]]:
    X, y = [], []
    for r in csv.DictReader(path.open(encoding="utf-8")):
        t = (r.get("text") or "").strip()
        lab = (r.get("label") or "").strip()
        if t and lab:
            X.append(t)
            y.append(lab)
    return X, y


def build_pipeline() -> Pipeline:
    # vn_normalize folds away diacritics + case so "tiền điện" == "tien dien".
    word = TfidfVectorizer(
        analyzer="word", ngram_range=(1, 2), preprocessor=vn_normalize,
        min_df=1, sublinear_tf=True,
    )
    char = TfidfVectorizer(
        analyzer="char_wb", ngram_range=(3, 5), preprocessor=vn_normalize,
        min_df=1, sublinear_tf=True,
    )
    features = FeatureUnion([("word", word), ("char", char)])
    clf = LogisticRegression(
        C=10.0, max_iter=3000, class_weight="balanced", random_state=SEED,
    )
    return Pipeline([("tfidf", features), ("clf", clf)])


def train_one(name: str, csv_path: Path) -> dict:
    print(f"\n{'='*60}\n {name.upper()}  ({csv_path.name})\n{'='*60}")
    X, y = load_xy(csv_path)
    labels = sorted(set(y))
    print(f"  samples: {len(X)}   classes: {len(labels)}")

    # ----- hold-out evaluation -----
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=SEED
    )
    pipe = build_pipeline()
    pipe.fit(X_tr, y_tr)
    y_pred = pipe.predict(X_te)
    acc = accuracy_score(y_te, y_pred)
    mf1 = f1_score(y_te, y_pred, average="macro")
    print(f"\n  hold-out (20%): accuracy={acc:.4f}  macro-F1={mf1:.4f}")
    report = classification_report(y_te, y_pred, zero_division=0)
    print(report)

    # ----- cross-validation (more stable estimate) -----
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    cv_scores = cross_val_score(build_pipeline(), X, y, cv=cv, scoring="accuracy")
    print(f"  5-fold CV accuracy: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # ----- final model trained on ALL data -----
    final = build_pipeline()
    final.fit(X, y)

    out_dir = MODELS_DIR / name
    out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(final, out_dir / "model.joblib", compress=3)
    size_kb = (out_dir / "model.joblib").stat().st_size / 1024

    meta = {
        "model": name,
        "created_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sklearn_version": sklearn.__version__,
        "source_csv": csv_path.name,
        "n_samples": len(X),
        "n_classes": len(labels),
        "labels": labels,
        "holdout_accuracy": round(acc, 4),
        "holdout_macro_f1": round(mf1, 4),
        "cv_accuracy_mean": round(float(cv_scores.mean()), 4),
        "cv_accuracy_std": round(float(cv_scores.std()), 4),
        "model_size_kb": round(size_kb, 1),
    }
    (out_dir / "metadata.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  saved -> {out_dir/'model.joblib'} ({size_kb:.1f} KB)")
    return meta


def main() -> None:
    MODELS_DIR.mkdir(exist_ok=True)
    summary = [train_one(name, path) for name, path in MODELS]
    print(f"\n{'='*60}\n SUMMARY\n{'='*60}")
    for m in summary:
        print(f"  {m['model']:<8} samples={m['n_samples']:<5} classes={m['n_classes']:<3} "
              f"CV={m['cv_accuracy_mean']:.3f}±{m['cv_accuracy_std']:.3f}  "
              f"holdout_acc={m['holdout_accuracy']:.3f}  F1={m['holdout_macro_f1']:.3f}  "
              f"size={m['model_size_kb']}KB")


if __name__ == "__main__":
    main()
