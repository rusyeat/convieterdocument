"""Trains the document-type classifier used by the "AI: document type" tool.

Model: TF-IDF over character n-grams (2-4, inside word boundaries) + multinomial
logistic regression. Syllabus link: week 6 (supervised learning, metrics,
GridSearchCV) and week 7 (text processing / NLP, TF-IDF, text classification).

Why character n-grams: Kazakh is agglutinative ("келісімшарт", "келісімшарттың",
"келісімшартқа" are one word in different forms). Character pieces like "келіс"
are shared by all forms, so the model generalises without a Kazakh lemmatiser,
and the same features work for Russian and English too.

Why logistic regression: small (fits in ~300 KB of JSON), fast enough to run in the
browser with plain JavaScript, gives calibrated probabilities (we show a
confidence and say "not sure" below a threshold), and its weights can be read to
explain a prediction. A Naive Bayes baseline is trained for comparison.

Outputs:
  assets/model/doc-classifier.json   weights loaded by js/classifier.js
  ml/results/metrics.json            all numbers quoted in the README
  ml/results/report.md               human-readable report
  ml/results/confusion_matrix.png    confusion matrix on the handwritten test set
  ml/results/parity.json             reference probabilities for the JS parity test

Run:  uv run --python 3.12 --with-requirements ml/requirements.txt ml/train.py
"""
import csv
import json
import random
from pathlib import Path

import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "ml" / "data"
RES = ROOT / "ml" / "results"
MODEL_OUT = ROOT / "assets" / "model" / "doc-classifier.json"
RES.mkdir(parents=True, exist_ok=True)
MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)


def load(path):
    with open(path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return [r["text"] for r in rows], [r["label"] for r in rows], [r["lang"] for r in rows]


def scores(y_true, y_pred):
    p, r, f, _ = precision_recall_fscore_support(y_true, y_pred, average="macro", zero_division=0)
    return {"accuracy": round(accuracy_score(y_true, y_pred), 4), "precision_macro": round(p, 4), "recall_macro": round(r, 4), "f1_macro": round(f, 4)}


X, y, lang = load(DATA / "train.csv")
Xh, yh, langh = load(DATA / "test_handwritten.csv")
X_tr, X_val, y_tr, y_val = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)
print(f"train {len(X_tr)}  validation {len(X_val)}  handwritten test {len(Xh)}")

# ---------- baseline: word TF-IDF + Naive Bayes ----------
baseline = Pipeline([("tfidf", TfidfVectorizer(lowercase=True)), ("clf", MultinomialNB())]).fit(X_tr, y_tr)

# ---------- main model: char n-gram TF-IDF + logistic regression, tuned with CV ----------
pipe = Pipeline([
    ("tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), lowercase=True, sublinear_tf=True, min_df=2, max_features=6000)),
    ("clf", LogisticRegression(max_iter=3000, random_state=SEED)),
])
grid = GridSearchCV(pipe, {"clf__C": [0.3, 1, 3, 10, 30, 100]}, cv=StratifiedKFold(5, shuffle=True, random_state=SEED), scoring="neg_log_loss", n_jobs=1)
grid.fit(X_tr, y_tr)
model = grid.best_estimator_
# Selected by log-loss, not F1: on this data every C reaches F1 = 1.0, but only a
# well-chosen C gives confident, calibrated probabilities (the UI shows confidence).
print("best params:", grid.best_params_, "cv log-loss:", round(-grid.best_score_, 4))

classes = list(model.classes_)
metrics = {
    "seed": SEED,
    "dataset": {"train": len(X_tr), "validation": len(X_val), "handwritten_test": len(Xh), "classes": classes, "languages": ["kk", "ru", "en"]},
    "grid_search": {"param": "C", "values": [0.3, 1, 3, 10, 30, 100], "scoring": "log-loss", "best": grid.best_params_["clf__C"], "cv_log_loss": round(-grid.best_score_, 4)},
    "validation": {"logreg_char": scores(y_val, model.predict(X_val)), "naive_bayes_word": scores(y_val, baseline.predict(X_val))},
    "handwritten_test": {"logreg_char": scores(yh, model.predict(Xh)), "naive_bayes_word": scores(yh, baseline.predict(Xh))},
}
pred_h = model.predict(Xh)
metrics["handwritten_test"]["per_language"] = {
    l: scores([a for a, g in zip(yh, langh) if g == l], [b for b, g in zip(pred_h, langh) if g == l]) for l in ["kk", "ru", "en"]
}
metrics["handwritten_test"]["errors"] = [{"text": t[:90], "true": a, "pred": b} for t, a, b in zip(Xh, yh, pred_h) if a != b]
report = classification_report(yh, pred_h, digits=3, zero_division=0)

# ---------- confusion matrix ----------
cm = confusion_matrix(yh, pred_h, labels=classes)
fig, ax = plt.subplots(figsize=(6, 5))
ax.imshow(cm, cmap="Purples")
ax.set_xticks(range(len(classes)), classes, rotation=40, ha="right")
ax.set_yticks(range(len(classes)), classes)
for i in range(len(classes)):
    for j in range(len(classes)):
        ax.text(j, i, cm[i, j], ha="center", va="center", color="white" if cm[i, j] > cm.max() / 2 else "black")
ax.set_xlabel("Predicted")
ax.set_ylabel("True")
ax.set_title("Handwritten test set (unseen sentences)")
fig.tight_layout()
fig.savefig(RES / "confusion_matrix.png", dpi=130)

# ---------- export for the browser ----------
tfidf, clf = model.named_steps["tfidf"], model.named_steps["clf"]
vocab = {term: int(i) for term, i in tfidf.vocabulary_.items()}
export = {
    "version": 1,
    "classes": classes,
    "analyzer": "char_wb",
    "ngram_range": list(tfidf.ngram_range),
    "lowercase": True,
    "sublinear_tf": True,
    "vocabulary": vocab,
    "idf": [round(float(v), 5) for v in tfidf.idf_],
    "coef": [[round(float(v), 5) for v in row] for row in clf.coef_],
    "intercept": [round(float(v), 5) for v in clf.intercept_],
    "threshold": 0.45,
    "trained_on": "synthetic kk/ru/en document snippets (ml/data/train.csv), seed 42",
}
MODEL_OUT.write_text(json.dumps(export, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

# reference outputs so tests/unit.test.js can check the JS inference matches sklearn
proba = model.predict_proba(Xh)
(RES / "parity.json").write_text(json.dumps([{"text": t, "proba": [round(float(p), 5) for p in row]} for t, row in zip(Xh, proba)], ensure_ascii=False, indent=1), encoding="utf-8")
(RES / "metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")

h = metrics["handwritten_test"]
md = f"""# Document classifier — training report

Generated by `ml/train.py` (seed {SEED}). Do not edit by hand.

| Set | Model | Accuracy | Precision (macro) | Recall (macro) | F1 (macro) |
|---|---|---|---|---|---|
| Validation (20% of synthetic) | Char TF-IDF + LogReg | {metrics['validation']['logreg_char']['accuracy']} | {metrics['validation']['logreg_char']['precision_macro']} | {metrics['validation']['logreg_char']['recall_macro']} | {metrics['validation']['logreg_char']['f1_macro']} |
| Validation (20% of synthetic) | Word TF-IDF + Naive Bayes | {metrics['validation']['naive_bayes_word']['accuracy']} | {metrics['validation']['naive_bayes_word']['precision_macro']} | {metrics['validation']['naive_bayes_word']['recall_macro']} | {metrics['validation']['naive_bayes_word']['f1_macro']} |
| Handwritten test (unseen) | Char TF-IDF + LogReg | {h['logreg_char']['accuracy']} | {h['logreg_char']['precision_macro']} | {h['logreg_char']['recall_macro']} | {h['logreg_char']['f1_macro']} |
| Handwritten test (unseen) | Word TF-IDF + Naive Bayes | {h['naive_bayes_word']['accuracy']} | {h['naive_bayes_word']['precision_macro']} | {h['naive_bayes_word']['recall_macro']} | {h['naive_bayes_word']['f1_macro']} |

Best C = {metrics['grid_search']['best']} (chosen by 5-fold CV log-loss = {metrics['grid_search']['cv_log_loss']}).

Per language on the handwritten test: """ + ", ".join(f"{k}: acc {v['accuracy']}" for k, v in h["per_language"].items()) + f"""

```
{report}
```

Misclassified handwritten examples:
""" + ("\n".join(f"- true **{e['true']}**, predicted **{e['pred']}**: {e['text']}…" for e in h["errors"]) or "- none") + "\n"
(RES / "report.md").write_text(md, encoding="utf-8")
print(md)
print(f"model -> {MODEL_OUT} ({MODEL_OUT.stat().st_size // 1024} KB)")
