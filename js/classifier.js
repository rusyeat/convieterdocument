// AI model inference in the browser: TF-IDF (char n-grams) + logistic regression.
// The weights come from ml/train.py (scikit-learn) via assets/model/doc-classifier.json.
// This file re-implements sklearn's TfidfVectorizer(analyzer="char_wb") and
// LogisticRegression.predict_proba exactly, so results match Python (see the
// parity test in tests/unit.test.js). No text ever leaves the device.
(function (root) {
  // sklearn _char_wb_ngrams: pad every word with spaces, take n-grams inside it
  function charWbNgrams(text, minN, maxN) {
    const out = [];
    for (const word of text.toLowerCase().split(/\s+/).filter(Boolean)) {
      const w = Array.from(" " + word + " ");
      for (let n = minN; n <= maxN; n++) {
        let offset = 0;
        out.push(w.slice(offset, offset + n).join(""));
        while (offset + n < w.length) { offset++; out.push(w.slice(offset, offset + n).join("")); }
        if (offset === 0) break; // word shorter than n: counted once
      }
    }
    return out;
  }

  function create(model) {
    const [minN, maxN] = model.ngram_range;
    const terms = [];
    for (const [term, i] of Object.entries(model.vocabulary)) terms[i] = term;

    // sparse TF-IDF vector, sublinear tf, L2-normalised (same as sklearn)
    function vectorize(text) {
      const counts = new Map();
      for (const g of charWbNgrams(text, minN, maxN)) {
        const i = model.vocabulary[g];
        if (i !== undefined) counts.set(i, (counts.get(i) || 0) + 1);
      }
      const vec = new Map();
      let norm = 0;
      for (const [i, c] of counts) {
        const v = (model.sublinear_tf ? 1 + Math.log(c) : c) * model.idf[i];
        vec.set(i, v); norm += v * v;
      }
      norm = Math.sqrt(norm) || 1;
      for (const [i, v] of vec) vec.set(i, v / norm);
      return vec;
    }

    function predict(text) {
      const x = vectorize(text);
      const logits = model.coef.map((w, k) => { let s = model.intercept[k]; for (const [i, v] of x) s += w[i] * v; return s; });
      const m = Math.max(...logits);
      const e = logits.map((z) => Math.exp(z - m));
      const sum = e.reduce((a, b) => a + b, 0);
      const proba = e.map((v) => v / sum);
      const best = proba.indexOf(Math.max(...proba));
      // explanation: the n-grams that pushed the winning class up the most
      const why = [...x].map(([i, v]) => ({ term: terms[i], score: model.coef[best][i] * v }))
        .filter((t) => t.score > 0 && t.term.trim().length > 1).sort((a, b) => b.score - a.score).slice(0, 8).map((t) => t.term.trim());
      return { label: model.classes[best], confidence: proba[best], sure: proba[best] >= model.threshold, proba, classes: model.classes, why: [...new Set(why)], features: x.size };
    }
    return { predict, vectorize };
  }

  let cached = null;
  async function load(url = "assets/model/doc-classifier.json") {
    if (!cached) cached = fetch(url).then((r) => r.json()).then(create);
    return cached;
  }

  const api = { create, load, charWbNgrams };
  root.Classifier = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
