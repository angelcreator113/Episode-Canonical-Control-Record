/**
 * Production → Edit (Evoni, 2026-11-03: "add the editor as a tab in
 * episodes"; she chose a launcher pill over embedding the editor). The pill
 * says where the episode's edit stands and opens the editor full screen at
 * /episodes/:id/editor. The editor is not embedded: it is a full-screen
 * workspace with page-wide shortcuts (Space, Delete, Ctrl+Z), which must not
 * fire while the rest of the episode page is in use.
 *
 * It only reads (GET /edit, /edit/findings, /edit/versions) and writes
 * nothing. Where the episode edit is switched off (EPISODE_EDIT), it says so
 * instead of offering a button that fails.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, CircleAlert, TriangleAlert, CircleCheck, History } from 'lucide-react';
import { episodeEditApi, readFailure } from '../../lib/episodeEditApi';
import { buildTimeline, beatReadiness, mediaIndex, timecode } from '../../lib/editorModel';
import './EpisodeEditTab.css';

const STATUS = { clear: 'Ready', warning: 'Warnings', blocked: 'Blocked', empty: 'Empty' };
/** "1 ready", "2 with warnings", "1 blocked", "3 empty". */
export const beatCount = (status, n) => `${n} ${status === 'warning' ? `with ${n === 1 ? 'a warning' : 'warnings'}` : STATUS[status].toLowerCase()}`;

/** What the edit holds, counted from its rows. */
export function editContents(edit) {
  const items = edit.items || [];
  const kind = (k) => items.filter((i) => i.kind === k).length;
  return [
    ['Scene clips', (edit.sceneClips || []).length],
    ['Prime segments', (edit.segments || []).length],
    ['Lines placed', kind('dialogue_placement')],
    ['Lala & guests', kind('performer_clip')],
    ['Captions & titles', kind('caption')],
    ['Music & SFX', (edit.audioItems || []).length],
  ];
}

export default function EpisodeEditTab({ episodeId, admin = false }) {
  const [state, setState] = useState({ loading: true, data: null, findings: null, versions: null, error: null });

  useEffect(() => {
    let live = true;
    setState({ loading: true, data: null, findings: null, versions: null, error: null });
    episodeEditApi.load(episodeId).then(
      async (data) => {
        const [findings, versions] = await Promise.all([
          episodeEditApi.findings(episodeId).catch((err) => { console.error('[EpisodeEditTab] findings failed:', err?.message); return null; }),
          episodeEditApi.versions(episodeId).catch((err) => { console.error('[EpisodeEditTab] versions failed:', err?.message); return null; }),
        ]);
        if (live) setState({ loading: false, data, findings, versions, error: null });
      },
      (err) => {
        console.error('[EpisodeEditTab] the edit could not be read:', err?.message);
        if (live) setState({ loading: false, data: null, findings: null, versions: null, error: err });
      },
    );
    return () => { live = false; };
  }, [episodeId]);

  const model = useMemo(() => (state.data ? buildTimeline(state.data.edit, mediaIndex()) : null), [state.data]);
  const readiness = useMemo(() => (model && state.findings ? beatReadiness(model, state.findings.findings) : null), [model, state.findings]);
  const editorHref = `/episodes/${episodeId}/editor`;

  if (state.loading) return <section className="eet" aria-busy="true"><p className="eet-muted">Reading the episode's edit…</p></section>;

  if (state.error) {
    const why = readFailure(state.error);
    return (
      <section className="eet" data-testid="eet-unavailable">
        <h2 className="eet-title">Edit</h2>
        {why.kind === 'off' ? (
          <>
            <p>The episode editor works on the episode edit, which is switched off on this server (<code>EPISODE_EDIT</code>). Nothing was changed.</p>
            <p className="eet-muted">Turning it on is a server setting.</p>
          </>
        ) : <p role="alert">{why.message}</p>}
      </section>
    );
  }

  const { data, findings, versions } = state;
  const counts = findings?.counts;
  const latest = versions?.[0] || null;
  const tally = readiness ? readiness.beats.reduce((acc, b) => ({ ...acc, [b.status]: (acc[b.status] || 0) + 1 }), {}) : null;

  return (
    <section className="eet" data-testid="eet">
      <header className="eet-head">
        <div>
          <h2 className="eet-title">Edit</h2>
          <p className="eet-muted">
            {timecode(model.duration)} long · edit revision {data.edit_revision}
            {latest ? <> · last draft “{latest.name}”, {new Date(latest.created_at).toLocaleString()}</> : ' · no saved drafts yet'}
          </p>
        </div>
        <Link className="eet-btn is-primary" to={editorHref} data-testid="eet-open"><Film size={16} aria-hidden="true" /> Open the editor</Link>
      </header>

      {data.c1b === false && (
        <p className="eet-note" role="status">
          Lala over the scene, captions, opacity and visual modes need the C1b migration, which has not run on this server.
          The rest of the editor works.
        </p>
      )}
      {!admin && <p className="eet-note">Editing needs an admin account. You can open the editor and look; changes are refused.</p>}

      <div className="eet-cards">
        <div className="eet-card" data-testid="eet-findings">
          <h3 className="eet-card-h">Findings</h3>
          {!counts ? <p className="eet-muted">The findings could not be read.</p> : (
            <ul className="eet-list">
              <li className={counts.blocking ? 'is-blocked' : ''}><CircleAlert size={14} aria-hidden="true" /> {counts.blocking} blocking</li>
              <li className={counts.warning ? 'is-warning' : ''}><TriangleAlert size={14} aria-hidden="true" /> {counts.warning} {counts.warning === 1 ? 'warning' : 'warnings'}</li>
            </ul>
          )}
        </div>

        <div className="eet-card" data-testid="eet-beats">
          <h3 className="eet-card-h">The 14 beats</h3>
          {!tally ? <p className="eet-muted">Readiness needs the findings.</p> : (
            <ul className="eet-list">
              {['clear', 'warning', 'blocked', 'empty'].filter((s) => tally[s]).map((s) => (
                <li key={s} className={`is-${s}`}>{s === 'clear' && <CircleCheck size={14} aria-hidden="true" />} {beatCount(s, tally[s])}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="eet-card" data-testid="eet-contents">
          <h3 className="eet-card-h">In the edit</h3>
          <dl className="eet-dl">
            {editContents(data.edit).map(([label, n]) => <React.Fragment key={label}><dt>{label}</dt><dd>{n}</dd></React.Fragment>)}
          </dl>
        </div>
      </div>

      {readiness && (
        <ol className="eet-rail" aria-label="Beats">
          {readiness.beats.map((b) => {
            const beat = model.beats.find((x) => x.beat === b.beat);
            return (
              <li key={b.beat} className={`eet-beat is-${b.status}`} title={`Beat ${b.beat}: ${beat?.name || ''} · ${STATUS[b.status]}`}>
                <span className="eet-beat-n">{b.beat}</span> <span className="eet-beat-name">{beat?.name}</span>
              </li>
            );
          })}
        </ol>
      )}

      <p className="eet-foot eet-muted">
        <History size={14} aria-hidden="true" /> Every change in the editor is saved when it is made.
      </p>
    </section>
  );
}
