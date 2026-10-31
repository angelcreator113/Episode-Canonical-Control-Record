/**
 * Uploads that did not finish, kept on this device so they can carry on
 * after a reload (Evoni, 2026-10-31: a dropped 1 GB upload started again
 * from zero). One list per episode in localStorage, by the file's name, size
 * and date: choosing the same file again resumes it. An entry older than the
 * server keeps an upload (6 hours) is dropped; the server would start again
 * anyway. Storage that can't be read or written (private mode, full) just
 * means no resume after a reload; nothing fails.
 */

const KEY = (episodeId) => `rawClipUploads:${episodeId}`;
export const RESUME_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** The key a file is kept under: its name, size and last-changed time. */
export const fileSignature = (file) => `${file?.name || ''}|${Number(file?.size) || 0}|${Number(file?.lastModified) || 0}`;

function read(episodeId) {
  try {
    const raw = window.localStorage.getItem(KEY(episodeId));
    const all = raw ? JSON.parse(raw) : {};
    return all && typeof all === 'object' ? all : {};
  } catch (err) {
    console.warn('[uploadResume] unfinished uploads not read:', err);
    return {};
  }
}

function write(episodeId, all) {
  try {
    if (Object.keys(all).length) window.localStorage.setItem(KEY(episodeId), JSON.stringify(all));
    else window.localStorage.removeItem(KEY(episodeId));
  } catch (err) {
    console.warn('[uploadResume] unfinished upload not kept:', err);
  }
}

/** The episode's unfinished uploads still young enough: [{ signature, name, performer, state, savedAt }]. */
export function unfinishedUploads(episodeId, now = Date.now()) {
  const all = read(episodeId);
  const fresh = {};
  for (const [signature, e] of Object.entries(all)) {
    if (e && e.state?.uploadId && now - Number(e.savedAt) < RESUME_MAX_AGE_MS) fresh[signature] = e;
  }
  if (Object.keys(fresh).length !== Object.keys(all).length) write(episodeId, fresh);
  return Object.entries(fresh).map(([signature, e]) => ({ signature, ...e }));
}

/** Keeps (or, with state null, forgets) an upload's progress. */
export function keepUpload(episodeId, signature, entry, now = Date.now()) {
  const all = read(episodeId);
  if (entry && entry.state?.uploadId) all[signature] = { ...entry, savedAt: now };
  else delete all[signature];
  write(episodeId, all);
}

/** How much of an upload was sent, in whole percent, from its state. */
export function sentPercent(state) {
  const size = Number(state?.size) || 0;
  const part = Number(state?.partSize) || 0;
  if (!size || !part || !Array.isArray(state?.done)) return 0;
  return Math.min(99, Math.floor((Math.min(size, state.done.length * part) * 100) / size));
}
