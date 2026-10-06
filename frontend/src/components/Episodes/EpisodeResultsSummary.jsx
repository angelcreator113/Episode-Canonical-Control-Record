/**
 * Results as one page (Evoni's Episode mock, 2026-10-05; her ruling: one
 * page, with Evaluation, Story and Distribution kept as its pills): how it
 * went, the money, Lala's stats, her goals, and what viewers and her feed
 * see. Helpers: lib/episodeResults.js. Reads only.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { evaluationOf, howItWent, moneyRows, statRows, shareState, signedCoins } from '../../lib/episodeResults';
import './EpisodeResultsSummary.css';

function useGet(url, pick) {
  const [value, setValue] = useState(undefined);
  useEffect(() => {
    if (!url) { setValue(null); return undefined; }
    let cancelled = false;
    api.get(url)
      .then((r) => { if (!cancelled) setValue(pick(r.data)); })
      .catch((err) => { console.error(`[Results] ${url} failed:`, err); if (!cancelled) setValue(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return value;
}

export default function EpisodeResultsSummary({ episode, showId, onOpenTab }) {
  const episodeId = episode?.id;
  const brief = useGet(episodeId ? `/api/v1/episode-brief/${episodeId}` : null, (d) => d?.data || null);
  const money = useGet(showId && episodeId ? `/api/v1/world/${showId}/episodes/${episodeId}/money` : null, (d) => d?.data || null);
  const state = useGet(showId ? `/api/v1/characters/lala/state?show_id=${showId}` : null, (d) => d?.state || null);
  const goals = useGet(showId ? `/api/v1/world/${showId}/goals?status=active` : null, (d) => d?.goals || []);
  const posts = useGet(episodeId ? `/api/v1/feed-posts/episode/${episodeId}` : null, (d) => d?.data || []);

  const evaluation = evaluationOf(episode);
  const how = howItWent({ brief, evaluation });
  const m = moneyRows(money);
  const stats = statRows(state, evaluation);
  const share = shareState(episode, posts || []);

  return (
    <div className="ers" data-testid="results-summary">
      <div className="ers-head">
        <h2 className="ers-title">Results</h2>
        <span className="ers-sub">{how.done ? `Completed${how.score != null ? ` · ${how.score}/100` : ''}` : 'Not completed yet'}</span>
        {how.done && <button type="button" className="ers-btn" onClick={() => onOpenTab?.('evaluation')}>Open the evaluation</button>}
      </div>

      <div className="ers-grid">
        <section className="ers-card ers-how" data-testid="results-how">
          <h3 className="ers-label">How it went</h3>
          <div className="ers-tiers">
            <div><span className="ers-tier-label">Designed</span><strong className="ers-tier">{how.designed || 'Not set'}</strong></div>
            <ArrowRight size={18} className="ers-arrow" aria-hidden="true" />
            <div><span className="ers-tier-label">Actual</span><strong className={`ers-tier${how.done ? '' : ' is-open'}`}>{how.actual || '?'}</strong></div>
          </div>
          <p className="ers-note">{how.done ? (evaluation?.narrative_lines?.short || 'See the evaluation for the score breakdown.') : 'Decided when the episode is completed. Everything on this page fills in then.'}</p>
        </section>

        <section className="ers-card" data-testid="results-money">
          <h3 className="ers-label">Money{how.done ? ' settled' : ''}</h3>
          {m === undefined || money === undefined ? <p className="ers-note">Loading…</p> : !m ? <p className="ers-note">The money could not be read.</p> : (
            <>
              {m.rows.length === 0 && <p className="ers-note">No money lines for this episode.</p>}
              <ul className="ers-rows">
                {m.rows.map((r) => (
                  <li key={r.key}><span>{r.label}</span><strong>{signedCoins(r.amount)}{r.note ? <em> {r.note}</em> : null}</strong></li>
                ))}
                <li className="ers-total" data-testid="results-net"><span>Net for the episode</span><strong>{m.net.estimate ? 'estimate ' : ''}{signedCoins(m.net.value)}</strong></li>
              </ul>
              {m.bonus.map((b) => <p key={b.tier} className="ers-note">+ up to {Number(b.amount).toLocaleString()} if {b.tier}</p>)}
            </>
          )}
          <button type="button" className="ers-link" onClick={() => onOpenTab?.('money')}>Open Money</button>
        </section>

        <section className="ers-card" data-testid="results-stats">
          <h3 className="ers-label ers-label-pink">Lala's stats</h3>
          <ul className="ers-rows ers-stats">
            {stats.map((s) => (
              <li key={s.key} data-testid={`results-stat-${s.key}`}>
                <span>{s.label}</span>
                <strong>
                  {s.delta != null ? <em className={s.delta >= 0 ? 'is-up' : 'is-down'}>{signedCoins(s.delta)} </em> : (!how.done && <em>after Complete </em>)}
                  <b>{s.value != null ? s.value.toLocaleString() : '—'}</b>
                </strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="ers-card" data-testid="results-goals">
          <h3 className="ers-label ers-label-pink">Lala's goals</h3>
          {goals === undefined ? <p className="ers-note">Loading…</p> : !goals?.length ? <p className="ers-note">No active goals.</p> : (
            <ul className="ers-goals">
              {goals.slice(0, 3).map((g) => (
                <li key={g.id}><div><strong>{g.title}</strong>{g.description && <span>{g.description}</span>}</div><span className="ers-chip">{g.status === 'completed' ? 'Met' : 'Open'}</span></li>
              ))}
            </ul>
          )}
          {showId && <Link className="ers-link" to={`/shows/${showId}/world?tab=overview`}>Open in Producer Mode</Link>}
        </section>
      </div>

      <section className="ers-card ers-share" data-testid="results-share">
        <div className="ers-share-head"><h3 className="ers-card-title">Share</h3><span className="ers-sub">What viewers and Lala's feed see about this episode</span></div>
        <div className={`ers-teaser${share.teaser ? '' : ' is-missing'}`} data-testid="results-teaser">
          <div>
            <strong>Viewer teaser</strong> {!share.teaser && <span className="ers-chip is-warn">Missing</span>}
            <p>{share.teaser || 'Mystery-driven, never reveals the outcome, hook in the first 150 characters. Platform copy is drafted from it.'}</p>
          </div>
          {!share.teaser && <button type="button" className="ers-primary" onClick={() => onOpenTab?.('overview')}>Write teaser</button>}
        </div>
        <div className="ers-share-row">
          <div className="ers-share-box">
            <strong>Platform copy</strong>
            <p>{share.platforms.length ? `Drafted for ${share.platforms.join(', ')}` : (share.teaser ? 'Not drafted yet' : 'Drafted once the teaser exists')}</p>
            <button type="button" className="ers-link" onClick={() => onOpenTab?.('distribution')}>Open Distribution</button>
          </div>
          <div className="ers-share-box is-pink">
            <strong>Feed posts</strong>
            <p>{share.posts ? `${share.posts} post${share.posts === 1 ? '' : 's'} · ${share.live} live` : "Lala's post plus reactions that match the result"}</p>
            {showId && <Link className="ers-link" to={`/shows/${showId}/world?tab=feed`}>Open Lala's Feed</Link>}
          </div>
        </div>
      </section>
    </div>
  );
}
