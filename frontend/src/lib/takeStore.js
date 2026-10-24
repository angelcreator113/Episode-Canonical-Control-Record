/**
 * Where a teleprompter take's video waits until it is saved (Teleprompter
 * audit 2 and 4, Evoni, 2026-10-24: "fix all of them"). The recorder's
 * one-second pieces go to IndexedDB as they arrive, so a long take is not
 * held in the tab's memory, and a take that was recorded but not saved
 * survives the phone's Back, a reload or a crash: the next time the
 * teleprompter opens for that episode it offers the take back.
 *
 * Two object stores in the database "teleprompter-takes":
 *   takes   { id, key, startedAt, updatedAt, type, finished, seconds, meta }
 *           key: which teleprompter it belongs to ('episode:<id>' or 'text');
 *           meta: what the reader needs to review and save it (scope, beat,
 *           start line, read-as, beat markers).
 *   chunks  { id: '<takeId>:<seq, 8 digits>', takeId, seq, t, data: Blob }
 *           (index "takeId").
 *
 * Every call is wrapped: IndexedDB missing, blocked (a private window),
 * full, or failing logs and answers false / null / [], and the recorder keeps
 * the pieces in memory instead. Nothing here throws.
 */

export const DB_NAME = 'teleprompter-takes';
const DB_VERSION = 1;
const TAKES = 'takes';
const CHUNKS = 'chunks';

const chunkId = (takeId, seq) => `${takeId}:${String(seq).padStart(8, '0')}`;

// An IDBRequest as a promise.
const done = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
});
// A transaction's end as a promise.
const finished = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve(true);
  tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
  tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
});

/** The page's IndexedDB, or null where there is none (or reading it throws). */
export function browserIndexedDB() {
  try {
    return typeof window !== 'undefined' && window.indexedDB ? window.indexedDB : null;
  } catch (err) {
    console.error('[takeStore] IndexedDB not reachable:', err);
    return null;
  }
}

/** The store key of a teleprompter: its episode, or 'text' for pasted text. */
export const takeKey = (episodeId) => (episodeId ? `episode:${episodeId}` : 'text');

/**
 * The take store over `idb` (an IDBFactory; the page's by default). With no
 * IndexedDB every method answers as "not kept" and `available` is false.
 */
export function createTakeStore(idb = browserIndexedDB()) {
  let dbPromise = null;
  let broken = !idb;

  const open = () => {
    if (broken) return Promise.resolve(null);
    if (!dbPromise) {
      dbPromise = new Promise((resolve) => {
        let req;
        try {
          req = idb.open(DB_NAME, DB_VERSION);
        } catch (err) {
          console.error('[takeStore] IndexedDB did not open:', err);
          broken = true;
          resolve(null);
          return;
        }
        req.onupgradeneeded = () => {
          try {
            const db = req.result;
            if (!db.objectStoreNames.contains(TAKES)) db.createObjectStore(TAKES, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS, { keyPath: 'id' }).createIndex('takeId', 'takeId');
          } catch (err) {
            console.error('[takeStore] IndexedDB not set up:', err);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.error('[takeStore] IndexedDB did not open:', req.error);
          broken = true;
          resolve(null);
        };
        req.onblocked = () => console.warn('[takeStore] IndexedDB open is blocked by another tab');
      });
    }
    return dbPromise;
  };

  // Runs fn(tx) in one transaction; resolves its value, or `fallback` on any failure.
  const within = async (what, stores, mode, fn, fallback) => {
    try {
      const db = await open();
      if (!db) return fallback;
      const tx = db.transaction(stores, mode);
      // Both awaited together, so a failed request and the transaction's own
      // failure are one error, never an unhandled one.
      const [value] = await Promise.all([fn(tx), finished(tx)]);
      return value;
    } catch (err) {
      console.error(`[takeStore] ${what} failed:`, err);
      return fallback;
    }
  };

  return {
    get available() { return !broken; },

    /** Starts a take's record. meta: what the reader needs to save it. True when kept. */
    begin: (id, { key, type, meta = {} }) => within('begin', [TAKES], 'readwrite', (tx) => {
      const now = Date.now();
      return done(tx.objectStore(TAKES).put({ id, key, startedAt: now, updatedAt: now, type, finished: false, seconds: 0, meta })).then(() => true);
    }, false),

    /** One piece of the take (seq from 0, t: take time in seconds). True when kept. */
    addChunk: (id, seq, data, t = 0) => within('chunk', [CHUNKS], 'readwrite', (tx) => (
      done(tx.objectStore(CHUNKS).put({ id: chunkId(id, seq), takeId: id, seq, t, data })).then(() => true)
    ), false),

    /** Changes the take's record (finished, seconds, meta merged). True when kept. */
    update: (id, patch = {}) => within('update', [TAKES], 'readwrite', async (tx) => {
      const store = tx.objectStore(TAKES);
      const row = await done(store.get(id));
      if (!row) return false;
      const next = { ...row, ...patch, meta: { ...(row.meta || {}), ...(patch.meta || {}) }, updatedAt: Date.now() };
      await done(store.put(next));
      return true;
    }, false),

    /** The take's pieces, in order: [{ seq, t, data }]. */
    chunks: (id) => within('read', [CHUNKS], 'readonly', async (tx) => {
      const rows = await done(tx.objectStore(CHUNKS).index('takeId').getAll(id));
      return (rows || []).map((r) => ({ seq: r.seq, t: r.t || 0, data: r.data })).sort((a, b) => a.seq - b.seq);
    }, []),

    /**
     * Takes not saved yet for this teleprompter, newest first, with the number
     * of pieces and the length they reach: [{ ...take, count, lastT }].
     * A take with no pieces is dropped as it is found.
     */
    unsaved: async (key) => {
      const takes = await within('list', [TAKES], 'readonly', (tx) => done(tx.objectStore(TAKES).getAll()), []);
      const mine = (takes || []).filter((tk) => tk && tk.key === key).sort((a, b) => b.startedAt - a.startedAt);
      const out = [];
      for (const tk of mine) {
        // eslint-disable-next-line no-await-in-loop
        const keys = await within('count', [CHUNKS], 'readonly', (tx) => done(tx.objectStore(CHUNKS).index('takeId').getAll(tk.id)), []);
        if (!keys.length) {
          // eslint-disable-next-line no-await-in-loop
          await within('drop empty', [TAKES], 'readwrite', (tx) => done(tx.objectStore(TAKES).delete(tk.id)), null);
          continue;
        }
        const lastT = keys.reduce((m, r) => Math.max(m, Number(r.t) || 0), 0);
        out.push({ ...tk, count: keys.length, lastT });
      }
      return out;
    },

    /** Forgets the take and its pieces. True when gone. */
    remove: (id) => within('remove', [TAKES, CHUNKS], 'readwrite', async (tx) => {
      const chunks = tx.objectStore(CHUNKS);
      const keys = await done(chunks.index('takeId').getAllKeys(id));
      await Promise.all((keys || []).map((k) => done(chunks.delete(k))));
      await done(tx.objectStore(TAKES).delete(id));
      return true;
    }, false),
  };
}

let shared = null;
/** The page's one take store (created on first use). */
export function takeStore() {
  if (!shared) shared = createTakeStore();
  return shared;
}
/** Tests: use this store (or a fresh one with null). */
export function setTakeStore(store) { shared = store; }

/** "3:05 pm today" / "Oct 22, 3:05 pm": when an unsaved take was recorded. */
export function takeWhen(ms, now = Date.now()) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return 'earlier';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date(now);
  const same = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  return same ? `${time} today` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}
