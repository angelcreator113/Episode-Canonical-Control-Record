/**
 * World moments (Producer Mode; Evoni, 2026-10-18: "start the scheduled
 * world moments"): the LalaVerse moves on a calendar. Each DREAM city's
 * weekly and monthly events, the press's weekly pieces, a trend moving a
 * stage a week in each city, and the award shows.
 *
 *   The next 7 days: what the calendar has due, each to tick and draft
 *     ("Draft these"), or all at once ("Plan next week"). An event becomes a
 *     draft in Events; a press piece or a trend post is queued for the
 *     posting engine, goes through the gate, and waits in Review or is
 *     scheduled on its day.
 *   Automatic: the show's switch; it runs only when the server also has
 *     WORLD_MOMENTS_ENABLED on (Evoni's .env change).
 *   The calendar: each city's events (name, weekly or monthly, day), the
 *     outlets' days, the trend day, the award shows.
 *   Lately: what was drafted, with where to find it.
 * API: /api/v1/world-moments (services/worldMoments).
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Globe2, CalendarDays, Newspaper, TrendingUp, Award, Sparkles, Save, Plus, Trash2 } from 'lucide-react';
import api from '../../services/api';
import './WorldMomentsTab.css';
import { seasonPageHref } from '../../lib/seasonPage';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CITIES = {
  dazzle_district: 'Dazzle District', radiance_row: 'Radiance Row', echo_park: 'Echo Park', ascent_tower: 'Ascent Tower', maverick_harbor: 'Maverick Harbor',
};
const PRESS = {
  reyna_voss: 'Reyna Voss · The Real Rate', solene_beaumont: 'Solène Beaumont · Undressed',
  taye_okafor: 'Taye Okafor · First Look', asha_brennan: 'Asha Brennan · The Cost of Wanting More',
};
const KIND = {
  city_event: { label: 'City event', Icon: CalendarDays }, award_show: { label: 'Award show', Icon: Award },
  press: { label: 'Press', Icon: Newspaper }, trend: { label: 'Trend', Icon: TrendingUp },
};
const STATUS = {
  drafted: 'Draft in Events', queued: 'Queued for the posting engine', scheduled: 'Scheduled', in_review: 'Waiting in Review',
  skipped: 'Skipped', failed: 'Failed',
};
const REVIEW = '/admin?tab=pulse&sub=review';
const errorOf = (err, fallback) => err?.response?.data?.error || fallback;
const dayLabel = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });

function DaySelect({ value, onChange, label }) {
  return (
    <select className="wm-select" aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
    </select>
  );
}

function CityEvents({ city, events, onChange }) {
  const set = (i, patch) => onChange(events.map((ev, j) => (j === i ? { ...ev, ...patch } : ev)));
  return (
    <div className="wm-city" data-testid={`wm-city-${city}`}>
      <h5 className="wm-city-name">{CITIES[city]}</h5>
      {events.map((ev, i) => (
        <div key={`${ev.id || 'new'}-${i}`} className="wm-row">
          <input className="wm-input" aria-label={`${CITIES[city]} event name`} value={ev.label} maxLength={120}
            onChange={(e) => set(i, { label: e.target.value })} />
          <select className="wm-select" aria-label={`${ev.label} how often`} value={ev.every}
            onChange={(e) => set(i, { every: e.target.value, ...(e.target.value === 'month' ? { week_of_month: ev.week_of_month || 1 } : {}) })}>
            <option value="week">Every week</option>
            <option value="month">Once a month</option>
          </select>
          {ev.every === 'month' && (
            <select className="wm-select" aria-label={`${ev.label} which week`} value={ev.week_of_month || 1}
              onChange={(e) => set(i, { week_of_month: Number(e.target.value) })}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{['First', 'Second', 'Third', 'Fourth'][n - 1]}</option>)}
            </select>
          )}
          <DaySelect label={`${ev.label} day`} value={ev.weekday} onChange={(weekday) => set(i, { weekday })} />
          <label className="wm-check"><input type="checkbox" checked={ev.on !== false} onChange={(e) => set(i, { on: e.target.checked })} /> On</label>
          <button type="button" className="wm-icon-btn" aria-label={`Remove ${ev.label}`} onClick={() => onChange(events.filter((_, j) => j !== i))}><Trash2 size={14} aria-hidden /></button>
        </div>
      ))}
      <button type="button" className="wm-btn is-quiet" onClick={() => onChange([...events, { label: 'New event', every: 'week', weekday: 6, on: true }])}>
        <Plus size={13} aria-hidden /> Add an event
      </button>
    </div>
  );
}

export default function WorldMomentsTab({ showId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(null);
  const [chosen, setChosen] = useState(new Set());
  const [draft, setDraft] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/api/v1/world-moments?show_id=${encodeURIComponent(showId)}`);
      setData(d);
      setDraft({ cities: d.settings.cities, press: d.settings.press, trends: d.settings.trends, award_shows: d.settings.award_shows });
      setError(null);
    } catch (err) {
      console.error('[WorldMomentsTab] the calendar could not be read:', err);
      setError(errorOf(err, 'World moments could not be loaded.'));
    }
  }, [showId]);
  useEffect(() => { load(); }, [load]);

  const act = async (key, fn) => {
    setBusy(key); setError(null); setNote(null);
    try { await fn(); } catch (err) {
      console.error(`[WorldMomentsTab] ${key} failed:`, err);
      setError(errorOf(err, 'That did not work. Try again.'));
    } finally { setBusy(null); }
  };

  const summary = (results = []) => {
    const n = (s) => results.filter((r) => r.status === s).length;
    const parts = [n('drafted') && `${n('drafted')} event draft${n('drafted') === 1 ? '' : 's'}`, n('queued') && `${n('queued')} post${n('queued') === 1 ? '' : 's'} queued`, n('skipped') && `${n('skipped')} skipped`, n('failed') && `${n('failed')} failed`].filter(Boolean);
    return parts.length ? `${parts.join(', ')}.` : 'Nothing new to draft.';
  };

  const draftChosen = () => act('draft', async () => {
    const { data: d } = await api.post('/api/v1/world-moments/draft', { show_id: showId, keys: [...chosen] });
    setNote(summary(d.results)); setChosen(new Set()); await load();
  });
  const planWeek = () => act('week', async () => {
    const { data: d } = await api.post('/api/v1/world-moments/plan-next-week', { show_id: showId });
    setNote(summary(d.results)); setChosen(new Set()); await load();
  });
  const toggleAuto = (on) => act('auto', async () => {
    await api.put('/api/v1/world-moments/settings', { show_id: showId, auto_enabled: on });
    await load();
  });
  const saveCalendar = () => act('save', async () => {
    await api.put('/api/v1/world-moments/settings', { show_id: showId, ...draft });
    setNote('The calendar is saved.'); await load();
  });

  if (!data && !error) return <p className="wm-muted">Loading…</p>;
  if (!data) return <p className="wm-error" role="alert">{error}</p>;

  const plan = data.plan?.moments || [];
  const byDay = plan.reduce((acc, m) => { (acc[m.date] = acc[m.date] || []).push(m); return acc; }, {});
  const open = plan.filter((m) => !m.drafted);
  const toggle = (key) => setChosen((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  return (
    <div className="wm" data-testid="world-moments">
      <header className="wm-head">
        <h3><Globe2 size={18} aria-hidden /> World moments</h3>
        <p className="wm-muted">The LalaVerse moves on its own calendar: each city&rsquo;s events, the press&rsquo;s weekly pieces, a trend moving a stage a week, the award shows. Events become drafts in Events; posts go through the gate and wait in Review or are scheduled on their day.</p>
      </header>

      <section className="wm-card" aria-labelledby="wm-auto">
        <h4 id="wm-auto" className="wm-h4">Automatic</h4>
        <label className="wm-check wm-switch">
          <input type="checkbox" checked={!!data.settings.auto_enabled} disabled={busy === 'auto'} onChange={(e) => toggleAuto(e.target.checked)} />
          Draft the coming week&rsquo;s moments on their own (up to 8 at a time)
        </label>
        <p className="wm-muted" data-testid="wm-server-note">
          {data.server?.world_moments_enabled
            ? 'The server has world moments on.'
            : 'The server also needs WORLD_MOMENTS_ENABLED=true before anything runs on its own; until then, use the buttons below.'}
          {' '}{data.server?.pulse_engine_enabled ? '' : 'Press and trend posts wait in the queue until the posting engine is on.'}
        </p>
      </section>

      <section className="wm-card" aria-labelledby="wm-next">
        <div className="wm-row-head">
          <h4 id="wm-next" className="wm-h4">The next 7 days</h4>
          <div className="wm-actions">
            <button type="button" className="wm-btn" disabled={!!busy || !chosen.size} onClick={draftChosen}>
              <Sparkles size={14} aria-hidden /> {busy === 'draft' ? 'Drafting…' : `Draft these${chosen.size ? ` (${chosen.size})` : ''}`}
            </button>
            <button type="button" className="wm-btn is-quiet" disabled={!!busy || !open.length} onClick={planWeek}>
              {busy === 'week' ? 'Planning…' : 'Plan next week'}
            </button>
          </div>
        </div>
        {note && <p className="wm-note" role="status">{note}</p>}
        {error && <p className="wm-error" role="alert">{error}</p>}
        {!plan.length && <p className="wm-muted">Nothing on the calendar this week.</p>}
        {Object.entries(byDay).map(([date, items]) => (
          <div key={date} className="wm-day">
            <h5 className="wm-day-name">{dayLabel(date)}</h5>
            <ul className="wm-list">
              {items.map((m) => {
                const { Icon, label } = KIND[m.kind] || KIND.city_event;
                return (
                  <li key={m.key} className="wm-item" data-testid={`wm-moment-${m.key}`}>
                    {m.drafted
                      ? <span className="wm-tag">{STATUS[m.drafted.status] || m.drafted.status}</span>
                      : <input type="checkbox" aria-label={`Choose ${m.label}`} checked={chosen.has(m.key)} onChange={() => toggle(m.key)} />}
                    <span className="wm-kind"><Icon size={13} aria-hidden /> {label}</span>
                    <span className="wm-item-body"><strong>{m.label}</strong><span className="wm-muted"> {m.detail}</span></span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {draft && (
        <section className="wm-card" aria-labelledby="wm-cal">
          <h4 id="wm-cal" className="wm-h4">The calendar</h4>
          {Object.keys(CITIES).map((city) => (
            <CityEvents key={city} city={city} events={draft.cities[city] || []}
              onChange={(events) => setDraft((d) => ({ ...d, cities: { ...d.cities, [city]: events } }))} />
          ))}
          <div className="wm-city">
            <h5 className="wm-city-name">The press</h5>
            {Object.keys(PRESS).map((slug) => (
              <div key={slug} className="wm-row">
                <span className="wm-row-label">{PRESS[slug]}</span>
                <DaySelect label={`${PRESS[slug]} day`} value={draft.press[slug]?.weekday ?? 1}
                  onChange={(weekday) => setDraft((d) => ({ ...d, press: { ...d.press, [slug]: { ...d.press[slug], weekday } } }))} />
                <label className="wm-check"><input type="checkbox" checked={draft.press[slug]?.on !== false}
                  onChange={(e) => setDraft((d) => ({ ...d, press: { ...d.press, [slug]: { ...d.press[slug], on: e.target.checked } } }))} /> On</label>
              </div>
            ))}
          </div>
          <div className="wm-city">
            <h5 className="wm-city-name">Trends and award shows</h5>
            <div className="wm-row">
              <span className="wm-row-label">Each city&rsquo;s trend moves a stage on</span>
              <DaySelect label="Trend day" value={draft.trends.weekday ?? 2} onChange={(weekday) => setDraft((d) => ({ ...d, trends: { ...d.trends, weekday } }))} />
              <label className="wm-check"><input type="checkbox" checked={draft.trends.on !== false}
                onChange={(e) => setDraft((d) => ({ ...d, trends: { ...d.trends, on: e.target.checked } }))} /> On</label>
            </div>
            <label className="wm-check"><input type="checkbox" checked={draft.award_shows.on !== false}
              onChange={(e) => setDraft((d) => ({ ...d, award_shows: { on: e.target.checked } }))} /> The award shows, on the first Saturday of their month</label>
          </div>
          <button type="button" className="wm-btn" disabled={!!busy} onClick={saveCalendar}>
            <Save size={14} aria-hidden /> {busy === 'save' ? 'Saving…' : 'Save the calendar'}
          </button>
        </section>
      )}

      <section className="wm-card" aria-labelledby="wm-lately">
        <h4 id="wm-lately" className="wm-h4">Lately</h4>
        {!(data.recent || []).length && <p className="wm-muted">Nothing drafted yet.</p>}
        <ul className="wm-list">
          {(data.recent || []).map((r) => (
            <li key={r.key} className="wm-item" data-testid={`wm-recent-${r.key}`}>
              <span className="wm-tag">{STATUS[r.status] || r.status}</span>
              <span className="wm-item-body"><strong>{r.label}</strong><span className="wm-muted"> {r.date}{r.why ? ` · ${r.why}` : ''}</span></span>
              {r.ref?.type === 'world_event' && <Link className="wm-link" to={seasonPageHref(showId, 'events', { show: 'all' })}>Open Events</Link>}
              {(r.status === 'in_review' || r.post_id) && <Link className="wm-link" to={REVIEW}>Open Review</Link>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
