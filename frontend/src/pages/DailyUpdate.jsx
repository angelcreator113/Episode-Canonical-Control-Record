/**
 * DailyUpdate — "Today" (route /today; Sidebar, top). Automation step 2
 * (Evoni, 2026-10-18: "how can we automate these conversations so i dont have
 * to approve but instead im able to get a daily update easy ... one day i
 * want this fully automated"). One read a day, across every show:
 *
 *   Since yesterday  what went live (the gate's own releases marked), what was
 *                    scheduled, who is new, and what changed on its own
 *   Waiting for you  drafts, voices, secrets, brand deals and findings; each
 *                    decided here through that item's own endpoint (so every
 *                    rule it keeps still holds), one at a time or all at once,
 *                    with Undo where the feature has one
 *   Coming up        the next three days: scheduled posts (move or hold),
 *                    episode air dates and their events, deal dates
 *   Cost             today's AI spend against the daily budget
 *
 * Reads GET /api/v1/daily-update (services/dailyUpdate). Styles: DailyUpdate.css.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sun, RefreshCw, Send, Trash2, Check, X, Undo2, Clock, PauseCircle, CalendarDays, Sparkles,
  Mic, Lock, Briefcase, AlertTriangle, Coins, Users, ArrowRight,
} from 'lucide-react';
import api from '../services/api';
import './DailyUpdate.css';

const REVIEW = '/admin?tab=pulse&sub=review';
const errorText = (err, fallback) => err?.response?.data?.error || fallback;
const tzOffset = () => new Date().getTimezoneOffset();
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const day = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '');
const usd = (n) => `$${Number(n || 0).toFixed(2)}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const words = (v) => (v == null ? '—' : typeof v === 'object' ? (v.amount != null ? `${v.amount}${v.cadence ? ` / ${v.cadence}` : ''}` : Array.isArray(v) ? v.join(', ') : JSON.stringify(v)) : String(v));
// A local datetime-local value for a date.
const localInput = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * How each waiting group is decided: the existing endpoint for one item, what
 * it is called, and its undo where the feature has one.
 */
export const DECIDE = Object.freeze({
  drafts: {
    icon: Send,
    all: 'Publish all',
    confirmAll: (n) => `Publish ${plural(n, 'draft')} on The Pulse now?`,
    yes: { label: 'Publish', done: 'Published', call: (it) => api.put(`/api/v1/feed-posts/${it.id}`, { status: 'live' }) },
    no: {
      label: 'Delete', done: 'Deleted (kept under Deleted in Review)', call: (it) => api.delete(`/api/v1/feed-posts/${it.id}`),
      undo: (it) => api.post(`/api/v1/feed-posts/${it.id}/restore`),
    },
  },
  voices: {
    icon: Mic,
    all: 'Approve all',
    yes: {
      label: 'Approve', done: 'Approved: they can post in it', call: (it) => api.post(`/api/v1/pulse-voices/${it.id}/approve`),
      undo: (it) => api.post(`/api/v1/pulse-voices/${it.id}/unapprove`),
    },
  },
  secrets: {
    icon: Lock,
    all: 'Keep all',
    yes: {
      label: 'Keep', done: 'Kept', call: (it) => api.put(`/api/v1/cast/characters/${it.character_id}/secrets/${it.id}`, { status: 'confirmed' }),
      undo: (it) => api.put(`/api/v1/cast/characters/${it.character_id}/secrets/${it.id}`, { status: 'candidate' }),
    },
    no: { label: 'Discard', done: 'Discarded', call: (it) => api.delete(`/api/v1/cast/characters/${it.character_id}/secrets/${it.id}`) },
  },
  deals: {
    icon: Briefcase,
    all: 'Consider all',
    yes: { label: 'Consider', done: 'Considering', call: (it) => api.post(`/api/v1/opportunities/${it.show_id}/${it.id}/advance`, { to_status: 'considering' }) },
    no: { label: 'Decline', done: 'Declined', call: (it) => api.post(`/api/v1/opportunities/${it.show_id}/${it.id}/advance`, { to_status: 'declined' }) },
  },
  findings: { icon: AlertTriangle },
});

function ItemText({ group, item }) {
  if (group === 'drafts') {
    return (
      <>
        <span className="du-who">{item.handle || item.name || 'A post'}{item.show && <span className="du-muted"> · {item.show}</span>}{item.release_state === 'held' && <span className="du-tag">Held</span>}</span>
        <p className="du-text">{item.text || <em>No words yet</em>}</p>
      </>
    );
  }
  if (group === 'voices') {
    return (
      <>
        <span className="du-who"><Link to={`/character/${item.character_id}`}>{item.name}</Link>{item.status === 'edited' && <span className="du-tag">Edited</span>}</span>
        {item.summary && <p className="du-text">{item.summary}</p>}
        {item.built_at && <span className="du-muted">Built {when(item.built_at)}</span>}
      </>
    );
  }
  if (group === 'secrets') {
    return (
      <>
        <span className="du-who"><Link to={`/character/${item.character_id}`}>{item.name}</Link></span>
        <p className="du-text">{item.text}</p>
      </>
    );
  }
  if (group === 'deals') {
    return (
      <>
        <span className="du-who">{item.brand || item.name}{item.show && <span className="du-muted"> · {item.show}</span>}</span>
        <p className="du-text">{item.name}{item.amount ? ` · ${usd(item.amount)}${item.payment_type ? ` ${item.payment_type.replace(/_/g, ' ')}` : ''}` : ''}</p>
        {item.deadline && <span className="du-muted">Answer by {day(item.deadline)}</span>}
      </>
    );
  }
  return (
    <span className="du-who">
      <Link to={`/character/${item.character_id}`}>{item.name}</Link>
      <span className="du-muted"> · {plural(item.open, 'open finding')}</span>
    </span>
  );
}

function WaitingGroup({ group }) {
  const how = DECIDE[group.key] || {};
  const Icon = how.icon || Sparkles;
  const [done, setDone] = useState({}); // id -> { text, undo?, error? }
  const [busy, setBusy] = useState(null);
  const [allNote, setAllNote] = useState(null);
  const open = group.items.filter((it) => !done[it.id] || done[it.id].error);

  const decide = async (item, verb) => {
    try {
      await verb.call(item);
      setDone((d) => ({ ...d, [item.id]: { text: verb.done, undo: verb.undo || null } }));
      return true;
    } catch (err) {
      console.error(`[DailyUpdate] ${group.key} ${verb.label} failed:`, err);
      setDone((d) => ({ ...d, [item.id]: { error: true, text: errorText(err, `${verb.label} did not work.`) } }));
      return false;
    }
  };
  const one = async (item, verb) => { setBusy(item.id); await decide(item, verb); setBusy(null); };
  const undo = async (item) => {
    setBusy(item.id);
    try {
      await done[item.id].undo(item);
      setDone((d) => { const next = { ...d }; delete next[item.id]; return next; });
    } catch (err) {
      console.error(`[DailyUpdate] ${group.key} undo failed:`, err);
      setDone((d) => ({ ...d, [item.id]: { ...d[item.id], text: `${d[item.id].text}. ${errorText(err, 'Undo did not work.')}` } }));
    } finally { setBusy(null); }
  };
  // One at a time through each item's own endpoint; each result shows on its item.
  const all = async () => {
    if (how.confirmAll && !window.confirm(how.confirmAll(open.length))) return;
    setBusy('all'); setAllNote(null);
    let ok = 0;
    for (const item of open) {
      // eslint-disable-next-line no-await-in-loop
      if (await decide(item, how.yes)) ok += 1;
    }
    setAllNote(`${ok} of ${open.length} done.${ok < open.length ? ' The rest say why.' : ''}`);
    setBusy(null);
  };

  return (
    <section className="du-group" data-testid={`du-waiting-${group.key}`} aria-labelledby={`du-g-${group.key}`}>
      <header className="du-group-head">
        <h3 id={`du-g-${group.key}`}><Icon size={16} aria-hidden /> {group.label} <span className="du-count">{group.total}</span></h3>
        <span className="du-group-actions">
          {how.yes && open.length > 1 && (
            <button type="button" className="du-btn" disabled={!!busy} onClick={all}>
              <Check size={14} aria-hidden /> {busy === 'all' ? 'Working…' : `${how.all} ${open.length}`}
            </button>
          )}
          {group.link && <Link className="du-link" to={group.link}>Open <ArrowRight size={13} aria-hidden /></Link>}
        </span>
      </header>
      {allNote && <p className="du-muted" role="status">{allNote}</p>}
      {group.items.length === 0 ? (
        <p className="du-muted">Nothing waiting.</p>
      ) : (
        <ul className="du-items">
          {group.items.map((item) => {
            const d = done[item.id];
            return (
              <li key={item.id} className={`du-item${d && !d.error ? ' is-done' : ''}`} data-testid={`du-item-${item.id}`}>
                <div className="du-item-body"><ItemText group={group.key} item={item} /></div>
                <div className="du-item-actions">
                  {d && !d.error ? (
                    <>
                      <span className="du-done"><Check size={13} aria-hidden /> {d.text}</span>
                      {d.undo && <button type="button" className="du-btn is-quiet" disabled={!!busy} onClick={() => undo(item)}><Undo2 size={13} aria-hidden /> Undo</button>}
                    </>
                  ) : (
                    <>
                      {how.yes && <button type="button" className="du-btn" disabled={!!busy} onClick={() => one(item, how.yes)}>{how.yes.label}</button>}
                      {how.no && (
                        <button type="button" className="du-btn is-quiet" disabled={!!busy} onClick={() => one(item, how.no)}>
                          {group.key === 'drafts' ? <Trash2 size={13} aria-hidden /> : <X size={13} aria-hidden />} {how.no.label}
                        </button>
                      )}
                      {group.read_only && <Link className="du-link" to={`/character/${item.character_id}`}>Fix them</Link>}
                    </>
                  )}
                </div>
                {d?.error && <p className="du-error" role="alert">{d.text}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {group.total > group.items.length && <p className="du-muted">Showing {group.items.length} of {group.total}.{group.link && <> <Link to={group.link}>See all</Link></>}</p>}
      {group.read_only && <p className="du-muted">Fixed on The Cast, Facts &amp; checks, or on each character's page.</p>}
    </section>
  );
}

function ScheduledPost({ post }) {
  const [state, setState] = useState({ at: post.release_at, held: false, error: null, problems: null });
  const [moving, setMoving] = useState(false);
  const [value, setValue] = useState(localInput(post.release_at));
  const [busy, setBusy] = useState(false);

  const send = async (body, after) => {
    setBusy(true); setState((s) => ({ ...s, error: null, problems: null }));
    try {
      await api.put(`/api/v1/feed-posts/${post.id}/release-time`, { ...body, tz_offset: tzOffset() });
      after();
    } catch (err) {
      if (err?.response?.status === 409 && err.response.data?.problems) {
        setState((s) => ({ ...s, problems: err.response.data.problems }));
      } else {
        console.error('[DailyUpdate] the release time did not change:', err);
        setState((s) => ({ ...s, error: errorText(err, 'That did not save.') }));
      }
    } finally { setBusy(false); }
  };
  const hold = () => send({ mode: 'hold' }, () => setState((s) => ({ ...s, held: true })));
  const move = (anyway = false) => {
    const at = new Date(value).toISOString();
    return send({ mode: 'schedule', at, ...(anyway ? { anyway: true } : {}) }, () => { setState((s) => ({ ...s, at })); setMoving(false); });
  };

  return (
    <li className="du-item" data-testid={`du-post-${post.id}`}>
      <div className="du-item-body">
        <span className="du-who"><Clock size={13} aria-hidden /> {state.held ? 'Held until you release it' : when(state.at)} · {post.handle || 'A post'}{post.show && <span className="du-muted"> · {post.show}</span>}</span>
        <p className="du-text">{post.text}</p>
      </div>
      {!state.held && (
        <div className="du-item-actions">
          {moving ? (
            <>
              <label className="du-sr" htmlFor={`du-move-${post.id}`}>New time</label>
              <input id={`du-move-${post.id}`} type="datetime-local" className="du-input" value={value} onChange={(e) => setValue(e.target.value)} />
              <button type="button" className="du-btn" disabled={busy || !value} onClick={() => move(false)}>Move</button>
              <button type="button" className="du-btn is-quiet" disabled={busy} onClick={() => setMoving(false)}>Cancel</button>
            </>
          ) : (
            <>
              <button type="button" className="du-btn is-quiet" disabled={busy} onClick={() => setMoving(true)}><CalendarDays size={13} aria-hidden /> Move</button>
              <button type="button" className="du-btn is-quiet" disabled={busy} onClick={hold}><PauseCircle size={13} aria-hidden /> Hold</button>
            </>
          )}
        </div>
      )}
      {state.problems && (
        <div className="du-error" role="alert">
          <p>This time breaks the story order:</p>
          <ul>{state.problems.map((p, i) => <li key={i}>{typeof p === 'string' ? p : p.message || p.text || JSON.stringify(p)}</li>)}</ul>
          <button type="button" className="du-btn is-quiet" disabled={busy} onClick={() => move(true)}>Move anyway</button>
        </div>
      )}
      {state.error && <p className="du-error" role="alert">{state.error}</p>}
    </li>
  );
}

/**
 * Went out on trust (services/pulseTrust): a fully trusted poster's post the
 * gate would have held, and their comments too. Undo puts a post back in
 * Review (POST /pulse-trust/undo/:id) and a comment back to a draft
 * (POST /pulse-trust/undo-comment/:id).
 */
function OnTrust({ group }) {
  const [undone, setUndone] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const undo = async (p) => {
    setBusy(p.id); setError(null);
    try {
      await api.post(p.kind === 'comment' ? `/api/v1/pulse-trust/undo-comment/${p.id}` : `/api/v1/pulse-trust/undo/${p.id}`);
      setUndone((u) => ({ ...u, [p.id]: true }));
    } catch (err) {
      console.error('[DailyUpdate] undo on trust failed:', err);
      setError(errorText(err, 'That could not be undone. Try again.'));
    } finally { setBusy(null); }
  };
  if (!group?.items?.length) return null;
  return (
    <details className="du-more" open data-testid="du-on-trust">
      <summary>Went out on trust ({group.total})</summary>
      {error && <p className="du-error" role="alert">{error}</p>}
      <ul className="du-items">
        {group.items.map((p) => (
          <li key={p.id} className="du-item">
            <div className="du-item-body">
              <span className="du-who">{p.handle || 'A post'}{p.kind === 'comment' && <span className="du-tag">Comment</span>}{p.show && <span className="du-muted"> · {p.show}</span>}</span>
              <p className="du-text">{p.text}</p>
              {p.waived_flags?.length > 0 && <span className="du-muted">Let through: {p.waived_flags.map((f) => TRUST_FLAG_WORDS[f] || f).join(', ')}</span>}
            </div>
            <div className="du-item-actions">
              {undone[p.id]
                ? <span className="du-muted">Back in Review</span>
                : <button type="button" className="du-btn is-quiet" disabled={!!busy} onClick={() => undo(p)}><Undo2 size={13} aria-hidden /> Undo</button>}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

const TRUST_FLAG_WORDS = { voice: 'voice match', off_lane: 'off their usual content', banned_phrase: 'an AI-sounding phrase' };

function SinceYesterday({ s }) {
  const facts = s.automatic.facts;
  const resolved = Object.values(s.automatic.findings_resolved || {}).reduce((a, b) => a + b, 0);
  const chips = [
    [`${s.went_live.total} went live`, s.went_live.auto ? `${s.went_live.auto} on their own` : null],
    [`${s.scheduled.total} scheduled`],
    ...(s.on_trust?.total ? [[`${s.on_trust.total} on trust`]] : []),
    [plural(s.new_characters.total, 'new character')],
    [plural(facts.length, 'fact changed', 'facts changed')],
    [plural(s.automatic.voices_built.length, 'voice built', 'voices built')],
    [plural(resolved, 'finding resolved', 'findings resolved')],
    ...((s.deals_done || []).length ? [[plural(s.deals_done.length, 'deal delivered', 'deals delivered')]] : []),
  ];
  return (
    <section className="du-section" aria-labelledby="du-since" data-testid="du-since">
      <h2 id="du-since"><Sun size={18} aria-hidden /> Since yesterday</h2>
      <ul className="du-chips">
        {chips.map(([a, b]) => <li key={a} className="du-chip">{a}{b && <span className="du-muted"> · {b}</span>}</li>)}
      </ul>
      {s.went_live.items.length > 0 && (
        <details className="du-more">
          <summary>What went live</summary>
          <ul className="du-items">
            {s.went_live.items.map((p) => (
              <li key={p.id} className="du-item">
                <div className="du-item-body">
                  <span className="du-who">{p.handle || 'A post'}{p.show && <span className="du-muted"> · {p.show}</span>}{p.auto && <span className="du-tag">On its own</span>}</span>
                  <p className="du-text">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
      {(s.deals_done || []).length > 0 && (
        <details className="du-more" open data-testid="du-deals-done">
          <summary>Deals with all deliverables done</summary>
          <ul className="du-names">
            {s.deals_done.map((d) => (
              <li key={d.id}><Briefcase size={13} aria-hidden /> <strong>{d.brand || d.name}</strong> {d.brand && d.name !== d.brand ? <span className="du-muted">{d.name} · </span> : null}<span className="du-muted">{d.lines.join(' · ')}</span></li>
            ))}
          </ul>
        </details>
      )}
      <OnTrust group={s.on_trust} />
      {s.new_characters.items.length > 0 && (
        <details className="du-more">
          <summary>New characters</summary>
          <ul className="du-names">
            {s.new_characters.items.map((c) => <li key={c.id}><Users size={13} aria-hidden /> <Link to={`/character/${c.id}`}>{c.name}</Link></li>)}
          </ul>
        </details>
      )}
      {(facts.length > 0 || s.automatic.voices_built.length > 0) && (
        <details className="du-more">
          <summary>What changed on its own</summary>
          <ul className="du-items">
            {facts.map((f) => (
              <li key={f.id} className="du-item">
                <div className="du-item-body">
                  <span className="du-who"><Link to={`/character/${f.character_id}`}>{f.name}</Link> · {f.fact.replace(/_/g, ' ')}</span>
                  <p className="du-text">{words(f.from)} → {words(f.to)}{f.reason && <span className="du-muted"> · {f.reason}</span>}</p>
                </div>
              </li>
            ))}
            {s.automatic.voices_built.map((v) => (
              <li key={v.id} className="du-item">
                <div className="du-item-body"><span className="du-who"><Link to={`/character/${v.character_id}`}>{v.name}</Link> · voice built{v.approved ? ', approved' : ', waiting for you'}</span></div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function ComingUp({ c }) {
  const slots = c.slots || [];
  const due = c.deliverables_due || [];
  const empty = !c.posts.length && !c.episodes.length && !c.events.length && !c.deals.length && !slots.length && !due.length;
  return (
    <section className="du-section" aria-labelledby="du-coming" data-testid="du-coming">
      <h2 id="du-coming"><CalendarDays size={18} aria-hidden /> Coming up <span className="du-muted">the next three days</span></h2>
      {empty && <p className="du-muted">Nothing scheduled in the next three days.</p>}
      {c.episodes.length > 0 && (
        <ul className="du-names">
          {c.episodes.map((e) => <li key={e.id}><strong>Episode {e.number}</strong> {e.title} airs {when(e.air_date)}{e.show && <span className="du-muted"> · {e.show}</span>}</li>)}
          {c.events.map((ev) => <li key={ev.id}>{ev.name} <span className="du-muted">· in episode {ev.episode_number}</span></li>)}
        </ul>
      )}
      {c.deals.length > 0 && (
        <ul className="du-names">
          {c.deals.map((d) => <li key={d.id}><Briefcase size={13} aria-hidden /> {d.brand || d.name}: {d.dates.map((x) => `${x.kind} ${day(x.date)}`).join(' · ')}</li>)}
        </ul>
      )}
      {due.length > 0 && (
        <>
          <h3 className="du-sub">Deliverables still to post</h3>
          <ul className="du-names" data-testid="du-deliverables-due">
            {due.map((d) => (
              <li key={d.id}><Briefcase size={13} aria-hidden /> <strong>{d.brand || d.name}</strong> goes public {day(d.publish_date)}<span className="du-muted"> · {d.left.join(' · ')}</span></li>
            ))}
          </ul>
        </>
      )}
      {c.posts.length > 0 && (
        <>
          <h3 className="du-sub">Scheduled posts</h3>
          <ul className="du-items">{c.posts.map((p) => <ScheduledPost key={p.id} post={p} />)}</ul>
        </>
      )}
      {slots.length > 0 && (
        <>
          <h3 className="du-sub">Next open time on their schedule</h3>
          <ul className="du-names" data-testid="du-slots">
            {slots.map((sl) => (
              <li key={sl.profile_id}>
                {sl.character_id ? <Link to={`/character/${sl.character_id}`}>{sl.name}</Link> : <strong>{sl.name}</strong>}
                {' '}{when(sl.at)}<span className="du-muted"> · {sl.schedule}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Cost({ cost }) {
  const pct = Math.round((cost.share || 0) * 100);
  return (
    <section className="du-section" aria-labelledby="du-cost" data-testid="du-cost">
      <h2 id="du-cost"><Coins size={18} aria-hidden /> Cost today</h2>
      <p className="du-cost-line">{usd(cost.spent_usd)} of {usd(cost.budget_usd)} <span className="du-muted">· {usd(cost.left_usd)} left</span></p>
      <div className="du-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Today's AI budget used">
        <span className={pct >= 80 ? 'is-high' : ''} style={{ width: `${pct}%` }} />
      </div>
      {cost.image_budget_usd != null && (
        <p className="du-muted">Images: {usd(cost.image_spent_usd)} of {usd(cost.image_budget_usd)}</p>
      )}
      {(cost.alerts || []).length > 0 && (
        <ul className="du-alerts" data-testid="du-cost-alerts">
          {cost.alerts.map((a) => (
            <li key={a.budget} className={`du-alert is-${a.level}`} role={a.level === 'over' ? 'alert' : 'status'}>
              <AlertTriangle size={16} aria-hidden />
              <span>{a.message} <Link className="du-link" to="/ai-costs">Open AI Costs</Link></span>
            </li>
          ))}
        </ul>
      )}
      {cost.features.length > 0 && (
        <ul className="du-names">
          {cost.features.map((f) => <li key={f.feature}><span className="du-mono">{f.feature}</span> {usd(f.usd)} <span className="du-muted">· {plural(f.calls, 'call')}</span></li>)}
        </ul>
      )}
    </section>
  );
}

export default function DailyUpdate() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const res = await api.get(`/api/v1/daily-update?since=${encodeURIComponent(since)}`);
      setData(res.data);
    } catch (err) {
      console.error('[DailyUpdate] the update could not be read:', err);
      setError(errorText(err, 'The daily update could not be loaded.'));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const waitingTotal = (data?.waiting || []).reduce((n, g) => n + (g.read_only ? 0 : g.total), 0);

  return (
    <div className="du-page" data-testid="daily-update">
      <header className="du-head">
        <div>
          <h1><Sun size={22} aria-hidden /> Today</h1>
          {data && <p className="du-muted">Since {when(data.since)} · {waitingTotal ? `${waitingTotal} waiting for you` : 'Nothing waiting for you'}</p>}
        </div>
        <button type="button" className="du-btn is-quiet" disabled={loading} onClick={load}><RefreshCw size={14} aria-hidden /> {loading ? 'Loading…' : 'Refresh'}</button>
      </header>
      {error && <p className="du-error" role="alert">{error}</p>}
      {data && (
        <>
          <SinceYesterday s={data.since_yesterday} />
          <section className="du-section" aria-labelledby="du-waiting" data-testid="du-waiting">
            <h2 id="du-waiting"><Check size={18} aria-hidden /> Waiting for you</h2>
            {data.waiting.map((g) => <WaitingGroup key={g.key} group={g} />)}
            <p className="du-muted">Comments, numbers, follower and closeness changes and DMs wait in <Link to={REVIEW}>Pulse Review</Link>.</p>
          </section>
          <ComingUp c={data.coming_up} />
          <Cost cost={data.cost} />
        </>
      )}
    </div>
  );
}
