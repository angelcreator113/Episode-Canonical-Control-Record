/**
 * StateSummary — the State tab's front page in the LalaVerse hub, to
 * Evoni's mock (2026-10-06): the world after each episode, the tensions
 * that could become stories, and what changed. The World Dashboard's own
 * tabs (World State, Tensions) stay below.
 *
 * Real data or a plain line (lib/stateSummary). The page above owns the
 * snapshots and the tension scan (it lists and saves them) and passes them
 * in; this loads the show's episodes and its state ledger itself.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import useActiveShow from '../../hooks/useActiveShow';
import { fetchAllEpisodes } from '../../lib/fetchAllPages';
import { tensionBars, snapshotSummary, snapshotLine, episodeStates, whatChanged } from '../../lib/stateSummary';
import './StateSummary.css';

/**
 * snapshots: the list, or null while it loads; snapshotsFailed when it
 * could not be read. tensions: { pairs, scan } where scan is null while the
 * scan runs and { status, characters_scanned, error } after.
 */
export default function StateSummary({ snapshots = null, snapshotsFailed = false, tensions = null, onTakeSnapshot, onOpenTensions }) {
  const { show, loaded } = useActiveShow();
  const [data, setData] = useState(null);

  useEffect(() => {
    // Wait for the active show: the episodes and the ledger are the show's.
    if (!loaded) return undefined;
    let live = true;
    setData(null);
    if (!show?.id) { setData({ episodes: null, history: null, noShow: true }); return undefined; }
    Promise.all([
      fetchAllEpisodes(api, show.id).then((r) => r.items).catch((err) => {
        console.error('[State] the episodes could not be read:', err?.response?.status || err?.message);
        return null;
      }),
      api.get(`/api/v1/world/${show.id}/history`).then((r) => r.data?.history || []).catch((err) => {
        console.error('[State] the state history could not be read:', err?.response?.status || err?.message);
        return null;
      }),
    ]).then(([episodes, history]) => { if (live) setData({ episodes, history }); });
    return () => { live = false; };
  }, [loaded, show?.id]);

  const snaps = snapshotSummary(snapshots);
  const eps = data?.episodes ? episodeStates(data.episodes, data.history || []) : null;
  const changes = data?.history ? whatChanged(data.history) : null;
  const bars = tensions?.scan ? tensionBars(tensions.pairs) : null;
  const scan = tensions?.scan;

  return (
    <div className="st" data-testid="state-summary">
      <section className="st-card" aria-labelledby="st-snap-heading">
        <div className="st-head">
          <h2 id="st-snap-heading" className="st-title">Snapshots</h2>
          {snaps.temperature != null && <span className="st-sub" data-testid="st-temperature">World temperature {snaps.temperature}</span>}
          {onTakeSnapshot && <button type="button" className="st-btn" onClick={onTakeSnapshot}>Take a snapshot</button>}
        </div>

        {!data ? <p className="st-note">Reading the episodes…</p> : (
          <>
            <ul className="st-snaps" data-testid="st-episodes">
              <li className="st-snap is-baseline">
                <span className="st-snap-kicker">Season start</span>
                {snapshots === null && !snapshotsFailed ? <strong className="st-snap-title">Reading…</strong>
                  : snaps.baseline ? (
                    <>
                      <strong className="st-snap-title">{snaps.baseline.snapshot_label}</strong>
                      <span className="st-snap-meta">your first snapshot · {snapshotLine(snaps.baseline)}</span>
                    </>
                  ) : (
                    <>
                      <strong className="st-snap-title">No baseline yet</strong>
                      <span className="st-snap-meta">{snapshotsFailed ? 'The snapshots could not be read just now.' : 'Take a snapshot of the world as it starts.'}</span>
                    </>
                  )}
              </li>
              {eps?.rows.map((e) => (
                <li key={e.id} className={`st-snap${e.done ? ' is-done' : ''}`}>
                  <span className="st-snap-kicker">{e.number != null ? `Episode ${e.number}` : 'Episode'}</span>
                  <Link className="st-snap-title" to={`/episodes/${e.id}`}>{e.title || 'Untitled'}</Link>
                  <span className="st-snap-meta">
                    {e.done ? (e.changes ? `after Complete · ${e.changes}` : 'after Complete · nothing moved') : 'Not yet'}
                  </span>
                </li>
              ))}
            </ul>
            {data.noShow && <p className="st-note">No show yet, so no episodes to follow.</p>}
            {!data.noShow && !data.episodes && <p className="st-note">The episodes could not be read just now.</p>}
            {eps && eps.total === 0 && <p className="st-note" data-testid="st-no-episodes">No episodes yet. Each one you complete lands here with how it moved Lala.</p>}
            {eps?.earlier > 0 && <p className="st-foot">{eps.earlier} earlier {eps.earlier === 1 ? 'episode' : 'episodes'} not shown.</p>}
            {snaps.saved.length > 0 && (
              <p className="st-foot" data-testid="st-saved">
                {snaps.saved.length} {snaps.saved.length === 1 ? 'snapshot' : 'snapshots'} saved by hand; the latest is “{snaps.saved[0].snapshot_label}”. All of them are under World State below.
              </p>
            )}
          </>
        )}
      </section>

      <div className="st-cols">
        <section className="st-card" aria-labelledby="st-ten-heading">
          <div className="st-head">
            <h2 id="st-ten-heading" className="st-title">Tensions</h2>
            {bars?.total > 0 && <span className="st-sub">{bars.total} between characters</span>}
            <Link className="st-link" to="/world-studio" title="In World Studio, give two characters a relationship with a tension state">+ Add</Link>
          </div>
          {!scan ? <p className="st-note">Scanning the relationships…</p>
            : scan.status === 'scan_failed' ? <p className="st-note">The scan could not run, so this is not “no tension”. The Tensions tab below can rescan.</p>
            : bars.total === 0 ? (
              <p className="st-note" data-testid="st-no-tension">
                {scan.characters_scanned ? `Nothing simmering among ${scan.characters_scanned} characters.` : 'No characters with relationships to scan yet.'} A relationship set to Simmering, Unresolved, High or Explosive shows here.
              </p>
            ) : (
              <ul className="st-tensions" data-testid="st-tensions">
                {bars.rows.map((r) => (
                  <li key={r.key} className={`st-tension st-tone-${r.tone}`}>
                    <div className="st-tension-top">
                      <strong>{r.names}</strong>
                      <span className="st-tension-state">{r.label}</span>
                    </div>
                    <span className="st-bar" aria-hidden="true"><span style={{ width: `${r.level}%` }} /></span>
                    {(r.relationship || r.summary) && <span className="st-tension-text">{[r.relationship, r.summary].filter(Boolean).join(' · ')}</span>}
                  </li>
                ))}
              </ul>
            )}
          {bars?.total > bars?.rows.length && onOpenTensions && (
            <button type="button" className="st-more" onClick={onOpenTensions}>See all {bars.total} in the scanner</button>
          )}
          <p className="st-foot">The hottest tension shows on the Overview as an idea for the next episode. The scanner reads where each relationship is now, not which way it is moving.</p>
        </section>

        <section className="st-card st-changed" aria-labelledby="st-changed-heading">
          <div className="st-head">
            <h2 id="st-changed-heading" className="st-title">What changed</h2>
          </div>
          {!data ? <p className="st-note">Reading the history…</p>
            : !changes ? <p className="st-note">{data.noShow ? 'No show yet.' : 'The state history could not be read just now.'}</p>
            : changes.length === 0 ? <p className="st-note" data-testid="st-no-changes">Nothing has moved yet. Completing an episode, a wardrobe purchase or an edit to Lala’s stats lands here.</p>
            : (
              <ul className="st-changes" data-testid="st-changes">
                {changes.map((c) => (
                  <li key={c.id}>
                    <span><strong>{c.who}</strong>{c.when && <span className="st-when"> · {c.when}</span>}</span>
                    <span className="st-change-text">{c.text}</span>
                  </li>
                ))}
              </ul>
            )}
          <p className="st-foot">From the character state ledger; relationship changes are not recorded there yet.</p>
        </section>
      </div>
    </div>
  );
}
