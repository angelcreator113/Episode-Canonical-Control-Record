/**
 * The Episode Ledger: how each episode turned out (its tier, score, money
 * from the ledger and what it changed for Lala), with filter and sort chips
 * and an opened episode's case file (Evoni's layout list, 2026-10-22).
 *
 * It was Producer Mode's Episodes → Results sub-tab (inline in
 * WorldAdmin.jsx); since 2026-10-25 it is the first half of the Season
 * page's Results tab, and Producer Mode's ?tab=episodes-ledger opens it
 * there. It reads what it needs itself: the show's state history, its
 * money by episode (GET /shows/:id/financial-summary, never
 * episodes.total_income/expenses), its scene sets and its closet; the
 * episodes and events come from the page.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import defaultApi from '../../services/api';
import EpisodeTasksPanel from '../EpisodeTasksPanel';
import { getEpisodeAnchorEvent } from '../../services/episodeEventsApi';
import { fetchAllSceneSets } from '../../lib/fetchAllPages';
import { fetchClosetWithTotal } from '../../lib/closetGrouping';
import { S, STAT_ICONS, TIER_COLORS, TIER_BG, TIER_BORDER, TIER_EMOJIS, EVENT_TYPE_ICONS, EVALUATION_LABEL } from './producerStyles';
import './EpisodeLedger.css';

export const listEpisodeTodoSocialApi = (epId) =>
  defaultApi.get(`/api/v1/episodes/${epId}/todo/social`).then((r) => r.data);

/**
 * An opened episode's "Tasks & Details" panel: the episode's event (the
 * anchor from GET /episodes/:id/events, audit LINK-01, 2026-10-03; the same
 * one the episode page, its checklist and its phone read, never a scan of
 * the show's event list by used_in_episode_id) and its social tasks.
 */
export const loadEpisodeTaskDetails = async (epId) => {
  const [todoRes, event] = await Promise.all([
    listEpisodeTodoSocialApi(epId).catch((err) => { console.error('[EpisodeLedger] social tasks load failed:', err); return {}; }),
    getEpisodeAnchorEvent(epId).catch((err) => { console.error('[EpisodeLedger] episode event load failed:', err); return null; }),
  ]);
  return { event, automation: event?.canon_consequences?.automation, socialTasks: todoRes.social_tasks || [] };
};

const parseJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

export default function EpisodeLedger({ showId, api = defaultApi, episodes = [], events = [], setToast = () => {}, title = 'Results' }) {
  const [episodeMoney, setEpisodeMoney] = useState({});
  const [stateHistory, setStateHistory] = useState([]);
  const [sceneSets, setSceneSets] = useState([]);
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [scripted, setScripted] = useState({});
  const [expandedEpisode, setExpandedEpisode] = useState(null);
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [ledgerSort, setLedgerSort] = useState('number');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let live = true;
    api.get(`/api/v1/shows/${showId}/financial-summary`).then((r) => {
      const byId = {};
      for (const e of r.data?.by_episode || []) byId[e.episode_id] = e;
      if (live) setEpisodeMoney(byId);
    }).catch((err) => console.error('[EpisodeLedger] episode money load failed:', err));
    api.get(`/api/v1/world/${showId}/history`).then((r) => { if (live) setStateHistory(r.data?.history || []); })
      .catch((err) => console.error('[EpisodeLedger] state history load failed:', err));
    fetchAllSceneSets(api, showId).then((list) => { if (live) setSceneSets(list.items || []); })
      .catch((err) => console.error('[EpisodeLedger] scene sets load failed:', err));
    fetchClosetWithTotal(api, showId).then((list) => { if (live) setWardrobeItems(list.items || []); })
      .catch((err) => console.error('[EpisodeLedger] wardrobe load failed:', err));
    return () => { live = false; };
  }, [api, showId]);

  // An event's script, from the opened episode's event (asks before replacing one).
  const handleGenerateScriptFromEvent = async (eventId, episodeId) => {
    setGenerating(true);
    const post = (confirmOverwrite) => api.post(`/api/v1/world/${showId}/events/${eventId}/generate-script`, {
      episode_id: episodeId, ...(confirmOverwrite ? { confirmOverwrite: true } : {}),
    });
    try {
      let res;
      try {
        res = await post(false);
      } catch (err) {
        if (err.response?.status === 409 && err.response?.data?.code === 'SCRIPT_OVERWRITE_CONFIRMATION_REQUIRED') {
          if (!window.confirm('This episode already has a script. Replace it?')) return;
          res = await post(true);
        } else {
          throw err;
        }
      }
      if (res.data.success) {
        setToast('Script generated. Check the episode.');
        setScripted((prev) => ({ ...prev, [eventId]: true }));
      }
    } catch (err) {
      console.error('[EpisodeLedger] script generation failed:', err);
      setToast(err.response?.data?.error || 'Script generation failed');
    } finally { setGenerating(false); }
  };

  const worldEvents = events.map((ev) => (scripted[ev.id] ? { ...ev, status: 'scripted' } : ev));
  const acceptedEpisodes = episodes.filter((ep) => ep.evaluation_status === 'accepted');
  const tierCounts = acceptedEpisodes.reduce((acc, ep) => {
    const tier = ep.evaluation_json?.tier_final; if (tier) acc[tier] = (acc[tier] || 0) + 1; return acc;
  }, {});

  // From the ledger (M4): each listed episode's posted rows.
  const moneyOf = (e) => episodeMoney[e.id] || { income: 0, expenses: 0 };
  const totalIncome = episodes.reduce((sum, e) => sum + (Number(moneyOf(e).income) || 0), 0);
  const totalExpenses = episodes.reduce((sum, e) => sum + (Number(moneyOf(e).expenses) || 0), 0);
  const net = totalIncome - totalExpenses;
  const epsWithFinancials = episodes.filter(e => moneyOf(e).income > 0 || moneyOf(e).expenses > 0).length;
  const evaluated = (ep) => ep.evaluation_status === 'accepted';
  // Filter and sort (Evoni, 2026-10-22 layout list).
  const shown = episodes
    .filter((ep) => ledgerFilter === 'all' || (ledgerFilter === 'evaluated' ? evaluated(ep) : !evaluated(ep)))
    .slice()
    .sort((a, b) => (ledgerSort === 'score'
      ? (Number(b.evaluation_json?.score) || -1) - (Number(a.evaluation_json?.score) || -1)
      : (a.episode_number || 0) - (b.episode_number || 0)));
  const filters = [
    ['all', 'All', episodes.length],
    ['evaluated', 'Evaluated', acceptedEpisodes.length],
    ['open', 'Not evaluated', episodes.length - acceptedEpisodes.length],
  ];
  return (
    <div style={S.content} className="wa-ledger">
      {/* Results in the Producer Mode look (2026-10-07): the title in the prose face with its line. */}
      <div className="wa-results-head">
        <div>
          <h2 className="wa-results-title">{title}</h2>
          <p className="wa-results-line">How each episode turned out: its score, its money and what it changed for Lala.</p>
        </div>
        <div className="wa-results-count">{episodes.length} episodes · {acceptedEpisodes.length} evaluated</div>
      </div>

      {/* One summary strip: the tiers and the season's money (Evoni,
          2026-10-22 layout list; two rows of four big boxes before). */}
      {(Object.keys(tierCounts).length > 0 || epsWithFinancials > 0) && (
        <div className="wa-ledger-strip" data-testid="ledger-summary">
          {Object.keys(tierCounts).length > 0 && (
            <ul className="wa-ledger-tiers" aria-label="Tiers">
              {['slay', 'pass', 'safe', 'fail'].map(tier => (
                <li key={tier} style={{ background: TIER_BG[tier], borderColor: TIER_BORDER[tier] }}>
                  <span aria-hidden="true">{TIER_EMOJIS[tier]}</span> <strong>{tierCounts[tier] || 0}</strong> {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </li>
              ))}
            </ul>
          )}
          {epsWithFinancials > 0 && (
            <dl className="wa-ledger-money">
              <div className="is-in"><dt>Total Income</dt><dd>{totalIncome.toLocaleString()}</dd></div>
              <div className="is-out"><dt>Total Expenses</dt><dd>{totalExpenses.toLocaleString()}</dd></div>
              <div className={net >= 0 ? 'is-in' : 'is-out'}><dt>Net P&L</dt><dd>{net >= 0 ? '+' : ''}{net.toLocaleString()}</dd></div>
              <div><dt>Episodes with P&L</dt><dd>{epsWithFinancials} / {episodes.length}</dd></div>
            </dl>
          )}
        </div>
      )}

      {episodes.length > 0 && (
        <div className="wa-ledger-tools">
          <div className="wa-ledger-filters" role="group" aria-label="Show">
            {filters.map(([key, label, n]) => (
              <button key={key} type="button" aria-pressed={ledgerFilter === key} className={ledgerFilter === key ? 'active' : ''} onClick={() => setLedgerFilter(key)}>
                {label} <span className="wa-ledger-n">{n}</span>
              </button>
            ))}
          </div>
          <label className="wa-ledger-sort">
            <span>Sort</span>
            <select value={ledgerSort} onChange={(e) => setLedgerSort(e.target.value)}>
              <option value="number">Episode number</option>
              <option value="score">Score, highest first</option>
            </select>
          </label>
        </div>
      )}
      {episodes.length > 0 && shown.length === 0 && <p className="wa-ledger-none">No episodes here.</p>}

      {shown.map((ep, i) => {
        const ej = ep.evaluation_json;
        const tier = ej?.tier_final;
        const score = ej?.score;
        const isExpanded = expandedEpisode === ep.id;
        // This episode's posted money, from the ledger (M4; #2278).
        const epIncome = Number(episodeMoney[ep.id]?.income) || 0;
        const epExpenses = Number(episodeMoney[ep.id]?.expenses) || 0;
        const epHistory = stateHistory.filter(h => h.episode_id === ep.id);
        const deltas = epHistory.length > 0 ? parseJson(epHistory[0].deltas_json) : null;
        const stateAfter = epHistory.length > 0 ? parseJson(epHistory[0].state_after_json) : null;
        // The saved event–episode link (the event's used_in_episode_id), not
        // the event's name appearing in the script.
        const linkedEvent = worldEvents.find(ev => ev.used_in_episode_id && String(ev.used_in_episode_id) === String(ep.id));

        return (
          <div key={ep.id} className={`wa-ledger-row${isExpanded ? ' is-open' : ''}`} data-testid={`ledger-row-${ep.id}`}>
            {/* The row's header: a button, so it opens from the keyboard and says whether it is open. */}
            <button type="button" className="wa-ledger-row-head" aria-expanded={isExpanded} aria-controls={`ledger-case-${ep.id}`} onClick={() => setExpandedEpisode(isExpanded ? null : ep.id)}>
              <span className="wa-ledger-num">{ep.episode_number || i + 1}</span>
              <span className="wa-ledger-name">
                <span className="wa-ledger-title">{ep.title || 'Untitled'}</span>
                {linkedEvent && <span className="wa-ledger-event">{EVENT_TYPE_ICONS[linkedEvent.event_type]} {linkedEvent.name}</span>}
              </span>
              <span className="wa-ledger-meta">
                {tier && <span style={S.tierPill(tier)}>{TIER_EMOJIS[tier]} {tier.toUpperCase()}</span>}
                {score && <span className="wa-ledger-score">{score}</span>}
                {/* The evaluation in words; it read the raw value, so an episode never evaluated said "draft" whatever its status. */}
                <span style={S.statusPill(ep.evaluation_status)}>{EVALUATION_LABEL[ep.evaluation_status] || 'Not evaluated yet'}</span>
                {deltas && Object.entries(deltas).filter(([, v]) => typeof v === 'number' && v !== 0).slice(0, 3).map(([k, v]) => (
                  <span key={k} style={{ ...S.deltaBadge(v), fontSize: 10 }}>{STAT_ICONS[k]}{v > 0 ? '+' : ''}{v}</span>
                ))}
              </span>
              <span className="wa-ledger-chev" aria-hidden="true">{isExpanded ? '▲' : '▼'}</span>
            </button>

            {/* Expanded case file: its actions first, then the stats, the money and the event side by side. */}
            {isExpanded && (
              <div className="wa-ledger-case" id={`ledger-case-${ep.id}`}>
                <div className="wa-ledger-actions">
                  <Link to={`/episodes/${ep.id}`} style={{ ...S.smBtn, textDecoration: 'none' }}>Open episode</Link>
                  <Link to={`/episodes/${ep.id}/evaluate`} style={{ ...S.smBtn, textDecoration: 'none', background: 'var(--primary-subtle)', borderColor: 'var(--primary-light)', color: 'var(--primary-text)' }}>{evaluated(ep) ? 'Re-evaluate' : 'Evaluate'}</Link>
                  <Link to={`/episodes/${ep.id}/todo`} style={{ ...S.smBtn, textDecoration: 'none', background: 'var(--surface-bg)', borderColor: 'var(--lala-parchment-3)', color: 'var(--lala-gold-text)' }}>Todo List</Link>
                  {ep.script_content && <span style={{ ...S.smBtn, color: 'var(--success-text)' }}>✅ Has Script ({(ep.script_content || '').split('\n').length} lines)</span>}
                </div>

                <div className="wa-ledger-cols">
                    {/* ── Stat Impact ── */}
                    {deltas && (
                      <div className="wa-ledger-col">
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📊 Stat Impact</div>
                        <div className="wa-ledger-stats">
                          {Object.entries(deltas).map(([k, v]) => {
                            if (typeof v !== 'number') return null;
                            const afterVal = stateAfter ? stateAfter[k] : null;
                            const beforeVal = afterVal !== null ? afterVal - v : null;
                            return (
                              <div key={k} style={{ padding: 10, background: v > 0 ? 'var(--success-bg)' : v < 0 ? 'var(--danger-bg)' : 'var(--surface-bg)', borderRadius: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: 14 }}>{STAT_ICONS[k]}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{k.replace(/_/g, ' ')}</div>
                                {beforeVal !== null ? (
                                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{beforeVal}</span>
                                    <span style={{ color: 'var(--text-secondary)', margin: '0 3px' }}>→</span>
                                    <span style={{ color: v > 0 ? 'var(--success-text)' : v < 0 ? 'var(--danger-text)' : 'var(--text-primary)' }}>{afterVal}</span>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 14, fontWeight: 700, color: v > 0 ? 'var(--success-text)' : v < 0 ? 'var(--danger-text)' : 'var(--text-secondary)' }}>
                                    {v > 0 ? '+' : ''}{v}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Episode Financials ── */}
                    {(epIncome > 0 || epExpenses > 0) && (
                      <div className="wa-ledger-col">
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>💰 Episode P&L</div>
                        {/* Lala's money across the season has one home: Cast & Continuity → Lala's Finances. */}
                        <Link to={`/shows/${showId}/world?tab=finances`} data-testid={`ledger-finances-link-${ep.id}`}
                      style={{ display: 'inline-block', marginBottom: 8, color: 'var(--lala-gold-text)', fontSize: 12, fontWeight: 600, textDecoration: 'underline' }}>
                      Lala's Finances →
                    </Link>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ padding: '8px 14px', background: 'var(--success-bg)', borderRadius: 8, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--success-text)' }}>Income</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--success-text)' }}>{epIncome}</div>
                          </div>
                          <div style={{ padding: '8px 14px', background: 'var(--danger-bg)', borderRadius: 8, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--danger-text)' }}>Expenses</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger-text)' }}>{epExpenses}</div>
                          </div>
                          <div style={{ padding: '8px 14px', background: epIncome >= epExpenses ? 'var(--success-bg)' : 'var(--danger-bg)', borderRadius: 8, textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Net</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: epIncome >= epExpenses ? 'var(--success-text)' : 'var(--danger-text)' }}>
                              {(epIncome - epExpenses).toFixed(0)}
                            </div>
                          </div>
                          {ep.financial_score && (
                            <div style={{ padding: '8px 14px', background: 'var(--surface-bg)', borderRadius: 8, textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: 'var(--lala-gold-text)' }}>Financial IQ</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--lala-gold-text)' }}>{ep.financial_score}/10</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {(linkedEvent || wardrobeItems.some(w => w.episode_id === ep.id)) && (
                      <div className="wa-ledger-col">
                        {/* ── Event Reference ── */}
                        {linkedEvent && (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>💌 Event</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ fontSize: 14, fontWeight: 700 }}>{linkedEvent.name}</span>
                              <span style={S.eTag}>⭐ {linkedEvent.prestige}</span>
                              {/* No 🪙 cost_coins tag (§8(ff) Q14): the Episode Ledger's money is the ledger's. A deal's difficulty is not money. */}
                              {linkedEvent.deal_type && <span style={S.eTag}>Difficulty {linkedEvent.cost_coins}</span>}
                              <span style={S.eTag}>📏 {linkedEvent.strictness}</span>
                              {linkedEvent.is_paid && <span style={{ padding: '2px 8px', background: 'var(--success-bg)', borderRadius: 4, fontSize: 10, fontWeight: 600, color: 'var(--success-text)' }}>💰 Paid</span>}
                              {linkedEvent.career_milestone && <span style={{ padding: '2px 8px', background: 'var(--primary-subtle)', borderRadius: 4, fontSize: 10, color: 'var(--primary-text)' }}>🎯 {linkedEvent.career_milestone}</span>}
                            </div>
                            {linkedEvent.narrative_stakes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 4 }}>{linkedEvent.narrative_stakes}</div>}
                          </div>
                        )}

                        {/* ── Scene Set ── */}
                        {linkedEvent?.scene_set_id && (() => {
                          const ss = sceneSets.find(s => s.id === linkedEvent.scene_set_id);
                          return ss ? (
                            <div style={{ marginTop: 14 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📍 Location</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {ss.base_still_url && <img src={ss.base_still_url} alt={ss.name} style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 6 }} />}
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{ss.name}</div>
                                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{ss.scene_type?.replace(/_/g, ' ')} · {ss.angles?.length || 0} angles</div>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* ── Wardrobe for this episode ── */}
                        {(() => {
                          const epWardrobe = wardrobeItems.filter(w => w.episode_id === ep.id);
                          return epWardrobe.length > 0 ? (
                            <div style={{ marginTop: 14 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>👗 Wardrobe ({epWardrobe.length})</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {epWardrobe.slice(0, 6).map(w => (
                                  <span key={w.id} style={{ padding: '3px 8px', background: 'var(--accent-subtle)', border: '1px solid var(--accent-light)', borderRadius: 6, fontSize: 10, color: 'var(--accent-dark)', fontWeight: 600 }}>
                                    {w.name || w.category || 'Item'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* ── Generate Script button ── */}
                        {linkedEvent && (
                          <div style={{ marginTop: 14 }}>
                            <button onClick={() => handleGenerateScriptFromEvent(linkedEvent.id, ep.id)} disabled={generating}
                              style={{ padding: '6px 16px', background: generating ? 'var(--lala-parchment-2)' : 'var(--primary)', color: generating ? 'var(--text-secondary)' : 'var(--text-inverse)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: generating ? 'wait' : 'pointer' }}>
                              {generating ? '⏳ Generating...' : '📝 Generate Script from Event'}
                            </button>
                          </div>
                        )}

                      </div>
                    )}
                </div>

                {/* ── Social Tasks + Beats (load on demand; opens and closes) ── */}
                <EpisodeTasksPanel
                  episodeId={ep.id}
                  load={loadEpisodeTaskDetails}
                  buttonStyle={{ ...S.smBtn, background: 'var(--surface-bg)', borderColor: 'var(--lala-parchment-3)', color: 'var(--lala-gold-text)' }}
                />

                {/* ── Evaluation Details ── */}
                {/* Only when there is something to show (it was often an empty heading). */}
                {ej && (ej.outfit_match !== undefined || ej.accessory_match !== undefined || ej.event_prestige_score !== undefined || ej.timing_score !== undefined || (ej.overrides || []).length > 0 || ej.narrative_line) && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏆 Evaluation</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {ej.outfit_match !== undefined && (
                        <div style={{ padding: '8px 14px', background: 'var(--surface-bg)', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Outfit Match</div>
                          <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.outfit_match}/25</div>
                        </div>
                      )}
                      {ej.accessory_match !== undefined && (
                        <div style={{ padding: '8px 14px', background: 'var(--surface-bg)', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Accessory</div>
                          <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.accessory_match}/25</div>
                        </div>
                      )}
                      {ej.event_prestige_score !== undefined && (
                        <div style={{ padding: '8px 14px', background: 'var(--surface-bg)', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Prestige</div>
                          <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.event_prestige_score}/30</div>
                        </div>
                      )}
                      {ej.timing_score !== undefined && (
                        <div style={{ padding: '8px 14px', background: 'var(--surface-bg)', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Timing</div>
                          <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.timing_score}/20</div>
                        </div>
                      )}
                      {(ej.overrides || []).length > 0 && (
                        <div style={{ padding: '8px 14px', background: 'var(--warning-bg)', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--warning-text)' }}>Overrides</div>
                          <div style={{ fontSize: 16, fontWeight: 800 }}>{ej.overrides.length} ⬆️</div>
                        </div>
                      )}
                    </div>
                    {ej.narrative_line && (
                      <div style={{ marginTop: 8, padding: 10, background: 'var(--surface-bg)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: `3px solid ${TIER_COLORS[tier] || 'var(--primary)'}` }}>
                        "{ej.narrative_line}"
                      </div>
                    )}
                  </div>
                )}

                {/* ── Unlocks ── */}
                {linkedEvent?.success_unlock && tier && (tier === 'slay' || tier === 'pass') && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>✨ Unlocked</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {linkedEvent.success_unlock.split(',').map((u, ui) => (
                        <span key={ui} style={{ padding: '4px 10px', background: 'var(--warning-bg)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: 'var(--warning-text)' }}>
                          ✨ {u.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        );
      })}

      {episodes.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 12 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No episodes yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Add one from the Episodes tab, then come back here.</div>
        </div>
      )}
    </div>
  );
}
