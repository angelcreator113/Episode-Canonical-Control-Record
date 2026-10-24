/**
 * A small in-memory IndexedDB for tests (jsdom has none, and fake-indexeddb
 * is not a dependency): open with onupgradeneeded, object stores with a
 * keyPath, one index, put/get/getAll/delete, index getAll/getAllKeys, and
 * transactions that complete once their requests are done. Enough for
 * lib/takeStore; not a general IndexedDB. failOn: a set of operation names
 * ('put', 'open', …) that fail, to test the fallbacks.
 */
export function fakeIndexedDB({ failOn = new Set() } = {}) {
  const dbs = new Map();

  const request = (tx, op, run) => {
    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
    if (tx) tx.pending += 1;
    Promise.resolve().then(() => {
      try {
        if (failOn.has(op)) throw Object.assign(new Error(`fake ${op} failed`), { name: 'QuotaExceededError' });
        req.result = run();
        req.onsuccess?.({ target: req });
      } catch (err) {
        req.error = err;
        req.onerror?.({ target: req });
        if (tx) tx.failed = err;
      } finally {
        if (tx) { tx.pending -= 1; tx.settle(); }
      }
    });
    return req;
  };

  const makeTx = (db, names) => {
    const tx = {
      pending: 0, failed: null, oncomplete: null, onerror: null, onabort: null, error: null, ended: false,
      settle() {
        setTimeout(() => {
          if (tx.ended || tx.pending > 0) return;
          tx.ended = true;
          if (tx.failed) { tx.error = tx.failed; tx.onerror?.({ target: tx }); } else tx.oncomplete?.({ target: tx });
        }, 0);
      },
      objectStore(name) {
        if (!names.includes(name)) throw new Error(`store ${name} not in this transaction`);
        const st = db.stores.get(name);
        const keyOf = (v) => v[st.keyPath];
        const index = (iname) => {
          const field = st.indexes.get(iname);
          const rows = (key) => [...st.rows.values()].filter((r) => r[field] === key);
          return {
            getAll: (key) => request(tx, 'getAll', () => rows(key)),
            getAllKeys: (key) => request(tx, 'getAllKeys', () => rows(key).map(keyOf)),
          };
        };
        return {
          put: (v) => request(tx, 'put', () => { st.rows.set(keyOf(v), v); return keyOf(v); }),
          get: (k) => request(tx, 'get', () => st.rows.get(k)),
          getAll: () => request(tx, 'getAll', () => [...st.rows.values()]),
          delete: (k) => request(tx, 'delete', () => { st.rows.delete(k); }),
          index,
          createIndex: (iname, field) => { st.indexes.set(iname, field); },
        };
      },
    };
    // A transaction with no requests still completes.
    tx.settle();
    return tx;
  };

  const makeDb = (name) => {
    const db = { name, stores: new Map() };
    db.objectStoreNames = { contains: (n) => db.stores.has(n) };
    db.createObjectStore = (n, { keyPath }) => {
      db.stores.set(n, { keyPath, rows: new Map(), indexes: new Map() });
      return {
        createIndex: (iname, field) => { db.stores.get(n).indexes.set(iname, field); },
      };
    };
    db.transaction = (names) => makeTx(db, Array.isArray(names) ? names : [names]);
    return db;
  };

  return {
    dbs,
    open(name) {
      const req = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      Promise.resolve().then(() => {
        if (failOn.has('open')) { req.error = new Error('fake open failed'); req.onerror?.({ target: req }); return; }
        let db = dbs.get(name);
        const fresh = !db;
        if (fresh) { db = makeDb(name); dbs.set(name, db); }
        req.result = db;
        if (fresh) req.onupgradeneeded?.({ target: req });
        req.onsuccess?.({ target: req });
      });
      return req;
    },
  };
}
