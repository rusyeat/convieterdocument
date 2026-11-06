// "My files": results are kept in the browser's IndexedDB. Nothing leaves the device.
(function () {
  const DB = "qalam-pdf", STORE = "files";
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, mode);
      const out = fn(t.objectStore(STORE));
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  }
  window.Store = {
    async add(name, blob) {
      const rec = { id: Date.now() + "-" + Math.random().toString(36).slice(2, 8), name, type: UI.ext(name), size: blob.size, date: new Date().toISOString(), fav: false, blob };
      try { await tx("readwrite", (s) => s.put(rec)); } catch (_) { return null; }
      return rec;
    },
    async all() {
      try {
        const list = await tx("readonly", (s) => s.getAll());
        return list.sort((a, b) => b.date.localeCompare(a.date));
      } catch (_) { return []; }
    },
    async get(id) { return tx("readonly", (s) => s.get(id)); },
    async remove(id) { return tx("readwrite", (s) => s.delete(id)); },
    async toggleFav(id) {
      const rec = await this.get(id);
      if (rec) { rec.fav = !rec.fav; await tx("readwrite", (s) => s.put(rec)); }
    },
  };
})();
