/**
 * EditorHub: Sidebar → Editor, at /studio/editor (Evoni, 2026-11-03: "we need
 * a bridge or another page, that way we can see all of the different episodes
 * that's being created … not just immediately on the editor"). Every episode,
 * by show, with where its edit stands, and Open for each. It no longer jumps
 * into the last episode opened; that one is marked "Last opened" instead.
 *
 * It reads the episode list and, per episode, GET /edit/findings (four at a
 * time), and writes nothing. Where the episode edit is switched off
 * (EPISODE_EDIT), it says so once and stops asking.
 *
 * /studio/editor?episode_id=… still opens that episode's editor (old links).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Film, Search, CircleAlert, TriangleAlert, CircleCheck, Clock } from 'lucide-react';
import { episodeAPI } from '../services/api';
import { episodeEditApi, readFailure } from '../lib/episodeEditApi';
import './EditorHub.css';

const AT_ONCE = 4;
export const WORKING_KEY = 'working-episode-id';

const readWorking = () => {
  try { return localStorage.getItem(WORKING_KEY); } catch (err) { console.warn('[EditorHub] storage unavailable:', err?.message); return null; }
};
const remember = (ep) => {
  try {
    localStorage.setItem(WORKING_KEY, ep.id);
    localStorage.setItem('working-episode-title', ep.title || 'Untitled');
  } catch (err) { console.warn('[EditorHub] storage unavailable:', err?.message); }
};

/** The episode list's rows, in show then episode order: [{ show, episodes }]. */
export function groupByShow(episodes) {
  const groups = new Map();
  for (const ep of episodes) {
    const key = ep.show?.id || ep.show_id || 'none';
    if (!groups.has(key)) groups.set(key, { id: key, name: ep.show?.name || (key === 'none' ? 'No show' : 'Show'), color: ep.show?.color || null, episodes: [] });
    groups.get(key).episodes.push(ep);
  }
  const num = (ep) => Number(ep.episode_number ?? ep.episodeNumber ?? Infinity);
  const list = [...groups.values()];
  for (const g of list) g.episodes.sort((a, b) => num(a) - num(b) || String(a.title || '').localeCompare(String(b.title || '')));
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

/** Where an episode's edit stands, from GET /edit/findings: { started, revision, blocking, warning, blockedBeats }. */
export function editSummary(f) {
  const revision = String(f?.edit_revision ?? '0');
  const blockedBeats = new Set((f?.findings || []).filter((x) => x.severity === 'blocking' && x.beat != null).map((x) => x.beat)).size;
  return { started: revision !== '0', revision, blocking: f?.counts?.blocking ?? 0, warning: f?.counts?.warning ?? 0, blockedBeats };
}

function EditState({ state }) {
  if (!state) return <span className="ehub-state is-loading">Reading the edit…</span>;
  if (state.error) return <span className="ehub-state is-error" title={state.error}>The edit could not be read</span>;
  const s = state.summary;
  if (!s.started) return <span className="ehub-state"><Clock size={14} aria-hidden="true" /> Not started</span>;
  return (
    <span className="ehub-state">
      <span>Edit revision {s.revision}</span>
      {s.blocking > 0
        ? <span className="is-blocked"><CircleAlert size={14} aria-hidden="true" /> {s.blocking} blocking{s.blockedBeats ? ` · ${s.blockedBeats} of 14 beats` : ''}</span>
        : <span className="is-clear"><CircleCheck size={14} aria-hidden="true" /> Nothing blocking</span>}
      {s.warning > 0 && <span className="is-warning"><TriangleAlert size={14} aria-hidden="true" /> {s.warning} {s.warning === 1 ? 'warning' : 'warnings'}</span>}
    </span>
  );
}

export default function EditorHub() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('episode_id');
  const showFilter = params.get('show') || 'all';
  const [list, setList] = useState({ loading: true, episodes: [], error: null });
  const [states, setStates] = useState({});
  const [off, setOff] = useState(false);
  const [query, setQuery] = useState('');
  const working = useMemo(readWorking, []);

  useEffect(() => {
    if (requested) return undefined;
    let live = true;
    episodeAPI.getAll({ limit: 200 }).then(
      (res) => {
        const body = res?.data || {};
        const rows = Array.isArray(body.data) ? body.data : Array.isArray(body.episodes) ? body.episodes : Array.isArray(body) ? body : [];
        if (live) setList({ loading: false, episodes: rows, error: null });
      },
      (err) => {
        console.error('[EditorHub] the episode list could not be read:', err?.message);
        if (live) setList({ loading: false, episodes: [], error: 'The episodes could not be loaded.' });
      },
    );
    return () => { live = false; };
  }, [requested]);

  const groups = useMemo(() => groupByShow(list.episodes), [list.episodes]);
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => groups
    .filter((g) => showFilter === 'all' || String(g.id) === showFilter)
    .map((g) => ({ ...g, episodes: g.episodes.filter((ep) => !q || `${ep.episode_number ?? ''} ${ep.title || ''}`.toLowerCase().includes(q)) }))
    .filter((g) => g.episodes.length), [groups, showFilter, q]);

  // Each shown episode's edit state, a few at a time, each asked once; once the
  // episode edit is off, nothing more is asked.
  const asked = useRef(new Set());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const shownIds = shown.flatMap((g) => g.episodes.map((ep) => ep.id));
  const shownKey = shownIds.join(',');
  useEffect(() => {
    if (off) return;
    const queue = shownIds.filter((id) => !asked.current.has(id));
    if (!queue.length) return;
    queue.forEach((id) => asked.current.add(id));
    const worker = async () => {
      while (mounted.current && queue.length) {
        const id = queue.shift();
        try {
          const f = await episodeEditApi.findings(id);
          if (mounted.current) setStates((cur) => ({ ...cur, [id]: { summary: editSummary(f) } }));
        } catch (err) {
          const why = readFailure(err);
          if (why.kind === 'off') { if (mounted.current) setOff(true); queue.length = 0; return; }
          console.error('[EditorHub] an edit could not be read:', id, err?.message);
          if (mounted.current) setStates((cur) => ({ ...cur, [id]: { error: why.message } }));
        }
      }
    };
    Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker))
      .catch((err) => console.error('[EditorHub] reading the edits failed:', err?.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey, off]);

  if (requested) return <Navigate to={`/episodes/${encodeURIComponent(requested)}/editor`} replace />;

  const setShow = (id) => {
    const next = new URLSearchParams(params);
    if (id === 'all') next.delete('show'); else next.set('show', id);
    setParams(next, { replace: true });
  };
  const total = list.episodes.length;

  return (
    <div className="ehub">
      <header className="ehub-head">
        <div>
          <h1 className="ehub-title"><Film size={22} aria-hidden="true" /> Editor</h1>
          <p className="ehub-sub">Every episode and where its edit stands. Open one to edit it full screen.</p>
        </div>
        <label className="ehub-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" placeholder="Find an episode…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find an episode" />
        </label>
      </header>

      {off && (
        <p className="ehub-note" role="status" data-testid="ehub-off">
          The episode edit is switched off on this server (<code>EPISODE_EDIT</code>), so the editor can't open an episode yet. Turning it on is a server setting.
        </p>
      )}

      {groups.length > 1 && (
        <div className="ehub-shows" role="group" aria-label="Show">
          <button type="button" className={`ehub-chip${showFilter === 'all' ? ' is-on' : ''}`} aria-pressed={showFilter === 'all'} onClick={() => setShow('all')}>All shows ({total})</button>
          {groups.map((g) => (
            <button key={g.id} type="button" className={`ehub-chip${showFilter === String(g.id) ? ' is-on' : ''}`} aria-pressed={showFilter === String(g.id)} onClick={() => setShow(String(g.id))}>
              {g.color && <span className="ehub-dot" style={{ background: g.color }} aria-hidden="true" />}{g.name} ({g.episodes.length})
            </button>
          ))}
        </div>
      )}

      {list.loading && <p className="ehub-muted" aria-busy="true">Loading the episodes…</p>}
      {list.error && <p className="ehub-note is-error" role="alert">{list.error}</p>}
      {!list.loading && !list.error && !total && (
        <div className="ehub-empty">
          <p>No episodes yet.</p>
          <Link className="ehub-btn is-primary" to="/episodes/create">Create an episode</Link>
        </div>
      )}
      {!list.loading && total > 0 && !shown.length && <p className="ehub-muted">No episode matches “{query}”.</p>}

      {shown.map((g) => (
        <section key={g.id} className="ehub-show" aria-label={g.name}>
          <h2 className="ehub-show-name">{g.color && <span className="ehub-dot" style={{ background: g.color }} aria-hidden="true" />}{g.name}</h2>
          <ul className="ehub-list">
            {g.episodes.map((ep) => (
              <li key={ep.id} className={`ehub-row${working === ep.id ? ' is-working' : ''}`} data-testid={`ehub-ep-${ep.id}`}>
                <span className="ehub-num">{ep.episode_number ?? '—'}</span>
                <div className="ehub-info">
                  <div className="ehub-ep-title">
                    {ep.title || 'Untitled'}
                    {working === ep.id && <span className="ehub-badge">Last opened</span>}
                  </div>
                  <div className="ehub-meta">
                    <span className={`ehub-status is-${String(ep.status || 'draft').toLowerCase()}`}>{String(ep.status || 'draft').replace(/_/g, ' ')}</span>
                    {!off && <EditState state={states[ep.id]} />}
                  </div>
                </div>
                <div className="ehub-actions">
                  <Link className="ehub-btn" to={`/episodes/${ep.id}?tab=edit`}>Details</Link>
                  <Link className="ehub-btn is-primary" to={`/episodes/${ep.id}/editor`} onClick={() => remember(ep)}
                    aria-label={`Open episode ${ep.episode_number ?? ''} ${ep.title || ''} in the editor`.replace(/\s+/g, ' ')}>Open</Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
