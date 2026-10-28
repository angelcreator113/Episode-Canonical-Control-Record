/**
 * The teleprompter's phone remote (Teleprompter batch 3; Evoni, 2026-10-20):
 * /api/v1/teleprompter-remote.
 *
 * The desktop (signed in, the api client) opens a session and gets a token
 * once; the QR code carries it in the URL's fragment
 * (/teleprompter/remote#<token>), which browsers never send to a server, so
 * it stays out of access logs. The phone (no account) sends it in the
 * X-Remote-Token header with plain fetch.
 *
 * Until the database update (migration 20261020120000) has run, the server
 * answers 409 with code MIGRATION_PENDING (REMOTE_NOT_READY here).
 */
import api from '../services/api';

const BASE = '/api/v1/teleprompter-remote';

export const REMOTE_NOT_READY = "The phone remote isn't switched on yet: the database update that adds it hasn't run.";
export const REMOTE_GONE = 'This remote session has ended or expired. Open a new one on the teleprompter.';

/** What the phone can ask for (the server keeps the same list). */
// phone_take_*: the phone records and the prompter follows it (Rig mode, 2026-10-28).
export const COMMANDS = [
  'toggle', 'faster', 'slower', 'next_beat', 'prev_beat', 'bigger', 'smaller', 'record_start', 'record_stop',
  'phone_take_start', 'phone_take_stop', 'phone_take_pause', 'phone_take_resume',
];

export const isNotReady = (err) => err?.response?.status === 409 && err?.response?.data?.code === 'MIGRATION_PENDING';

/** The phone page's address for a token: the token in the fragment. */
export const remoteUrl = (origin, token) => `${origin}/teleprompter/remote#${token}`;

/** The token typed out in groups of four, for reading off the screen. */
export const groupedCode = (token) => String(token || '').replace(/(.{4})(?=.)/g, '$1 ');

/** A typed or pasted code (or the whole link) back to the token. */
export function tokenFrom(text) {
  const raw = String(text || '').trim();
  const afterHash = raw.includes('#') ? raw.slice(raw.indexOf('#') + 1) : raw;
  return afterHash.replace(/\s+/g, '');
}

/** "Ends at 4:05 PM" from an ISO time, or null. */
export function expiryText(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Ends at ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

// The desktop, signed in.
export const remoteApi = {
  open: (episodeId) => api.post(BASE, { episode_id: episodeId || null }).then((r) => r.data?.data),
  commands: (id, after) => api.get(`${BASE}/${id}/commands`, { params: { after } }).then((r) => r.data?.data),
  putState: (id, state) => api.put(`${BASE}/${id}/state`, { state }).then((r) => r.data?.data),
  end: (id) => api.delete(`${BASE}/${id}`).then((r) => r.data?.data),
};

const apiBase = () => {
  try { return import.meta.env?.VITE_API_BASE || ''; } catch (err) { console.error('[remote] API base not read:', err); return ''; }
};

/**
 * The phone's calls: plain fetch, the token in X-Remote-Token, no account.
 * Each resolves { ok, status, data, error, code }.
 */
async function phoneCall(path, token, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${apiBase()}${BASE}${path}`, {
      method,
      headers: { 'X-Remote-Token': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch (err) {
    console.error('[remote] phone request failed:', err);
    return { ok: false, status: 0, data: null, error: 'No connection. Check the phone is online.' };
  }
  let json = null;
  try { json = await res.json(); } catch (err) { console.error('[remote] phone reply was not JSON:', err); }
  return { ok: res.ok, status: res.status, data: json?.data ?? null, error: json?.error || null, code: json?.code || null };
}

export const phoneApi = {
  state: (token) => phoneCall('/phone/state', token),
  send: (token, command) => phoneCall('/phone/commands', token, { method: 'POST', body: { command } }),
};
