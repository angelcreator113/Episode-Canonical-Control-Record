/**
 * Season Plan › setting up a season (Evoni, 2026-10-24, PR 1: "Set up the
 * season" form, Season 2 and on, place the episodes already made, draft the
 * whole season in one AI call, one setup checklist; "and we can use the
 * current events?" — yes).
 *
 *   SeasonSetupForm   the form: title, tagline, the three parts' names and
 *                     taglines, and how the 24 episodes split between them;
 *                     and the Season page's fields (2026-10-25): logline,
 *                     description, start and end dates, a cover and a
 *                     picture per part, chosen from Files; and each part's
 *                     moods (2026-10-25): its emotional arc and the feed's
 *                     tone, empty for the part's default.
 *                     Seeds a season (POST .../arc/seed) or edits it (PUT
 *                     .../arc/setup); the page passes onSubmit.
 *   SeasonPlacement   "Use your events and episodes": the preview from GET
 *                     .../season/placement, each slot's episode or event, to
 *                     move to another slot or leave out. Nothing is placed
 *                     until Save (POST, one transaction).
 *   SeasonDraft       "Draft the season" or one part, in one AI call (POST
 *                     .../season/draft). Each draft is accepted on its own or
 *                     all at once (POST .../season/draft/accept); the slots
 *                     Evoni edited or that started are never offered.
 *   SeasonChecklist   the steps of a new season, each with its action; gone
 *                     once all are done.
 *
 * Messages are shown in the page, never alert or prompt.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, X, Sparkles, ListChecks, CalendarDays, Film, Pencil, RotateCcw, Circle, CheckCircle2 } from 'lucide-react';
import SeasonPicturePicker from './SeasonPicturePicker';
import './SeasonSetup.css';

export const SEASON_SLOTS = 24;
const PART_DEFAULTS = [
  { title: 'Foundation', tagline: 'Prove you belong' },
  { title: 'Ascension', tagline: 'Climb the ladder' },
  { title: 'Legacy', tagline: 'Become uncopyable' },
];
// What a part's moods are when left empty (the server's PART_DEFAULTS), shown as the placeholder.
export const MOOD_DEFAULTS = [
  { emotional_arc: 'curiosity → first stumble → finding her footing', feed_tone: 'Lala watches from the outside. Everything feels aspirational and slightly out of reach.' },
  { emotional_arc: 'ambition → competition → first real loss → determination', feed_tone: 'Lala is in the mix now. People know her name. The shade gets personal.' },
  { emotional_arc: 'confidence → crisis of identity → building her own room → transcendence', feed_tone: 'Lala stops watching and starts being watched. The feed follows her.' },
];
// The longest moods the server takes (seasonSetupService.MOOD_MAX).
export const MOOD_MAX = { emotional_arc: 300, feed_tone: 500 };
const errorOf = (err, fallback) => err?.response?.data?.error || fallback;

// The Season page's fields, empty (2026-10-25).
const PAGE_FIELDS_EMPTY = { logline: '', description: '', starts_on: '', ends_on: '', cover_url: null };

/** The form's defaults: Season 1's original wording, or "Season N" after it. */
export function defaultForm(seasonNumber = 1) {
  const first = Number(seasonNumber) <= 1;
  return {
    title: first ? 'Soft Luxury Ascension' : `Season ${seasonNumber}`,
    tagline: first ? 'Lala earns her place in the luxury tier' : '',
    ...PAGE_FIELDS_EMPTY,
    phases: PART_DEFAULTS.map((p) => ({ ...p, picture_url: null, emotional_arc: '', feed_tone: '' })),
    split: [8, 8, 8],
  };
}

/** The form from a season's arc, for Edit season. */
export function formFromArc(arc) {
  const phases = (arc?.phases || []).slice(0, 3);
  return {
    title: arc?.title || '',
    tagline: arc?.tagline || '',
    logline: arc?.logline || '',
    description: arc?.description || '',
    starts_on: arc?.starts_on ? String(arc.starts_on).slice(0, 10) : '',
    ends_on: arc?.ends_on ? String(arc.ends_on).slice(0, 10) : '',
    cover_url: arc?.cover_url || null,
    phases: [0, 1, 2].map((i) => ({
      title: phases[i]?.title || '', tagline: phases[i]?.tagline || '', picture_url: phases[i]?.picture_url || null,
      emotional_arc: phases[i]?.emotional_arc || '', feed_tone: phases[i]?.feed_behavior?.feed_tone || '',
    })),
    split: [0, 1, 2].map((i) => (phases[i] ? Number(phases[i].episode_end) - Number(phases[i].episode_start) + 1 : 8)),
  };
}

/** A part's mood that is too long, in words (the server's rule); null when every mood fits. */
export function moodProblem(phases) {
  for (const [i, p] of (phases || []).entries()) {
    if ((p.emotional_arc || '').trim().length > MOOD_MAX.emotional_arc) return `Part ${i + 1}'s emotional arc is longer than ${MOOD_MAX.emotional_arc} characters.`;
    if ((p.feed_tone || '').trim().length > MOOD_MAX.feed_tone) return `Part ${i + 1}'s feed tone is longer than ${MOOD_MAX.feed_tone} characters.`;
  }
  return null;
}

/** The dates' problem, in words (the server's rule): the end is not before the start. */
export function datesProblem(startsOn, endsOn) {
  if (startsOn && endsOn && endsOn < startsOn) return 'The season cannot end before it starts.';
  return null;
}

/** What is wrong with a split, in words; null when it is three whole numbers ≥ 1 adding up to 24 (the server's rule). */
export function splitProblem(split) {
  const nums = split.map((n) => (n === '' || n == null ? NaN : Number(n)));
  if (nums.some((n) => !Number.isInteger(n))) return 'Each part takes a whole number of episodes.';
  if (nums.some((n) => n < 1)) return 'Each part needs at least one episode.';
  const total = nums.reduce((a, b) => a + b, 0);
  if (total !== SEASON_SLOTS) return `These add up to ${total}; the season has ${SEASON_SLOTS} episodes.`;
  return null;
}

/** "E1–E8" for each part, from a valid split. */
export function splitRanges(split) {
  let start = 1;
  return split.map((n) => {
    const r = `E${start}–E${start + Number(n) - 1}`;
    start += Number(n);
    return r;
  });
}

export function SeasonSetupForm({ mode = 'create', seasonNumber = 1, initial = null, onSubmit, onCancel, showId = null }) {
  const [form, setForm] = useState(() => ({ ...defaultForm(seasonNumber), ...(initial || {}) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const problem = splitProblem(form.split);
  const missing = !form.title.trim() ? 'The season needs a title.'
    : form.phases.findIndex((p) => !p.title.trim()) >= 0 ? `Part ${form.phases.findIndex((p) => !p.title.trim()) + 1} needs a name.`
      : datesProblem(form.starts_on, form.ends_on) || moodProblem(form.phases);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const ranges = problem ? null : splitRanges(form.split);
  const total = form.split.reduce((a, n) => a + (Number(n) || 0), 0);

  const setPart = (i, key, value) => setForm((f) => ({ ...f, phases: f.phases.map((p, j) => (j === i ? { ...p, [key]: value } : p)) }));
  const setSplit = (i, value) => setForm((f) => ({ ...f, split: f.split.map((n, j) => (j === i ? value : n)) }));

  const submit = async (e) => {
    e.preventDefault();
    if (problem || missing) return;
    setBusy(true); setError(null);
    try {
      await onSubmit({
        title: form.title.trim(),
        tagline: form.tagline.trim(),
        logline: (form.logline || '').trim(),
        description: (form.description || '').trim(),
        starts_on: form.starts_on || null,
        ends_on: form.ends_on || null,
        cover_url: form.cover_url || null,
        phases: form.phases.map((p) => ({
          title: p.title.trim(), tagline: p.tagline.trim(), picture_url: p.picture_url || null,
          emotional_arc: (p.emotional_arc || '').trim(), feed_tone: (p.feed_tone || '').trim(),
        })),
        split: form.split.map(Number),
      });
    } catch (err) {
      console.error('[SeasonSetupForm] save failed:', err);
      setError(errorOf(err, mode === 'edit' ? 'The season was not saved.' : 'The season was not set up.'));
    } finally { setBusy(false); }
  };

  return (
    <form className="sst-card sst-form" onSubmit={submit} data-testid="season-setup-form" aria-labelledby="sst-form-title">
      <header className="sst-head">
        <h3 id="sst-form-title" className="sst-title"><BookOpen size={18} aria-hidden="true" />
          {mode === 'edit' ? `Edit Season ${seasonNumber}` : `Set up Season ${seasonNumber}`}
        </h3>
        <p className="sst-about">
          {mode === 'edit'
            ? 'Rename the season and its parts, or move where the parts begin and end. An episode that has started keeps its part.'
            : 'Name the season and its three parts, and choose how its 24 episodes split between them. You can change all of it later.'}
        </p>
      </header>

      <div className="sst-fields">
        <label className="sst-field is-wide">
          <span>Season title</span>
          <input type="text" value={form.title} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} data-testid="sst-title" />
        </label>
        <label className="sst-field is-wide">
          <span>Tagline <em>(optional)</em></span>
          <input type="text" value={form.tagline} maxLength={300} placeholder="What the season is about, in a line" onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} data-testid="sst-tagline" />
        </label>
      </div>

      {/* The Season page's fields (Evoni's mockup, 2026-10-25). */}
      <fieldset className="sst-page-fields" data-testid="sst-page-fields">
        <legend className="sst-legend">On the Season page</legend>
        <div className="sst-fields">
          <label className="sst-field is-wide">
            <span>Logline <em>(optional)</em></span>
            <input type="text" value={form.logline} maxLength={500} placeholder="The season in a sentence" onChange={set('logline')} data-testid="sst-logline" />
          </label>
          <label className="sst-field is-wide">
            <span>Description <em>(optional)</em></span>
            <textarea rows={3} value={form.description} maxLength={4000} onChange={set('description')} data-testid="sst-description" />
          </label>
          <label className="sst-field">
            <span>Starts <em>(optional)</em></span>
            <input type="date" value={form.starts_on} onChange={set('starts_on')} data-testid="sst-starts-on" />
          </label>
          <label className="sst-field">
            <span>Ends <em>(optional)</em></span>
            <input type="date" value={form.ends_on} min={form.starts_on || undefined} onChange={set('ends_on')} data-testid="sst-ends-on" />
          </label>
          <div className="sst-field is-wide">
            <span>Cover picture <em>(optional)</em></span>
            <SeasonPicturePicker showId={showId} label="Cover" value={form.cover_url} disabled={busy}
              onChange={(url) => setForm((f) => ({ ...f, cover_url: url }))} />
          </div>
        </div>
      </fieldset>

      <div className="sst-parts" role="group" aria-label="The three parts">
        {form.phases.map((p, i) => (
          <fieldset key={i} className="sst-part" data-testid={`sst-part-${i + 1}`}>
            <legend className="sst-legend">Part {i + 1}{ranges ? <span className="sst-range"> · {ranges[i]}</span> : null}</legend>
            <label className="sst-field">
              <span>Name</span>
              <input type="text" value={p.title} maxLength={100} onChange={(e) => setPart(i, 'title', e.target.value)} data-testid={`sst-part-title-${i + 1}`} />
            </label>
            <label className="sst-field">
              <span>Tagline <em>(optional)</em></span>
              <input type="text" value={p.tagline} maxLength={300} onChange={(e) => setPart(i, 'tagline', e.target.value)} data-testid={`sst-part-tagline-${i + 1}`} />
            </label>
            <label className="sst-field is-count">
              <span>Episodes</span>
              <input type="number" inputMode="numeric" min={1} max={22} step={1} value={form.split[i]}
                onChange={(e) => setSplit(i, e.target.value)} data-testid={`sst-split-${i + 1}`} />
            </label>
            <div className="sst-field">
              <span>Picture <em>(optional)</em></span>
              <SeasonPicturePicker showId={showId} label={`Part ${i + 1} picture`} value={p.picture_url || null} disabled={busy}
                onChange={(url) => setPart(i, 'picture_url', url)} />
            </div>
            <label className="sst-field">
              <span>Emotional arc <em>(empty: the default)</em></span>
              <textarea rows={2} value={p.emotional_arc || ''} maxLength={MOOD_MAX.emotional_arc} placeholder={MOOD_DEFAULTS[i]?.emotional_arc}
                onChange={(e) => setPart(i, 'emotional_arc', e.target.value)} data-testid={`sst-part-arc-${i + 1}`} />
            </label>
            <label className="sst-field">
              <span>Feed tone <em>(empty: the default)</em></span>
              <textarea rows={2} value={p.feed_tone || ''} maxLength={MOOD_MAX.feed_tone} placeholder={MOOD_DEFAULTS[i]?.feed_tone}
                onChange={(e) => setPart(i, 'feed_tone', e.target.value)} data-testid={`sst-part-tone-${i + 1}`} />
            </label>
          </fieldset>
        ))}
      </div>

      {/* The split as one bar, so the parts' sizes read at a glance. */}
      <div className="sst-bar" aria-hidden="true">
        {form.split.map((n, i) => <span key={i} className={`sst-bar-part is-${i + 1}`} style={{ flexGrow: Math.max(0, Number(n) || 0) }} />)}
      </div>
      <p className={`sst-note${problem ? ' is-error' : ''}`} role="status" data-testid="sst-split-note">
        {problem || `${total} episodes: ${ranges.join(' · ')}`}
      </p>
      {missing && !problem && <p className="sst-note is-error" data-testid="sst-missing">{missing}</p>}
      {error && <p className="sst-note is-error" role="alert" data-testid="sst-error">{error}</p>}

      <div className="sst-actions">
        <button type="submit" className="sst-btn" disabled={busy || Boolean(problem) || Boolean(missing)} data-testid="sst-submit">
          {busy ? 'Saving…' : mode === 'edit' ? 'Save the season' : `Set up Season ${seasonNumber}`}
        </button>
        {onCancel && <button type="button" className="sst-btn is-quiet" disabled={busy} onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

// ─── Use your events and episodes ──────────────────────────────────────

const itemKey = (it) => (it.kind === 'episode' ? `ep:${it.episode.id}` : `ev:${it.event.id}`);
const itemTitle = (it) => (it.kind === 'episode' ? it.episode?.title || 'Untitled episode' : it.event?.name || 'Untitled event');

export function SeasonPlacement({ showId, api, onSaved, onClose }) {
  const base = `/api/v1/world/${showId}/season/placement`;
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    setNote(null);
    try {
      const res = await api.get(base);
      setData(res.data);
      setItems((res.data.items || []).map((it) => ({ ...it, key: itemKey(it) })));
      setRemoved([]);
    } catch (err) {
      console.error('[SeasonPlacement] preview failed:', err);
      setData({ items: [], open_slots: [], left_over: [] });
      setNote({ error: true, text: errorOf(err, 'The preview could not be loaded.') });
    }
  }, [api, base]);
  useEffect(() => { load(); }, [load]);

  const slots = data?.open_slots || [];
  const slotById = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
  const taken = new Set(items.map((it) => it.slot_id));
  const sorted = [...items].sort((a, b) => (slotById.get(a.slot_id)?.slot_number || 0) - (slotById.get(b.slot_id)?.slot_number || 0));

  const move = (key, slotId) => setItems((list) => list.map((it) => (it.key === key ? { ...it, slot_id: slotId, moved: true } : it)));
  const remove = (it) => { setItems((list) => list.filter((x) => x.key !== it.key)); setRemoved((r) => [...r, it]); };
  const putBack = (it) => {
    const free = slots.find((s) => !taken.has(s.id));
    if (!free) { setNote({ error: true, text: 'Every open slot is in use; leave another out first.' }); return; }
    setRemoved((r) => r.filter((x) => x.key !== it.key));
    setItems((list) => [...list, { ...it, slot_id: free.id, moved: true }]);
  };

  const save = async () => {
    setBusy(true); setNote(null);
    try {
      const body = { items: items.map((it) => (it.kind === 'episode' ? { slot_id: it.slot_id, episode_id: it.episode.id } : { slot_id: it.slot_id, event_id: it.event.id })) };
      const res = await api.post(base, body);
      const { episodes = 0, events = 0 } = res.data || {};
      const parts = [];
      if (episodes) parts.push(`${episodes} ${episodes === 1 ? 'episode' : 'episodes'} placed`);
      if (events) parts.push(`${events} ${events === 1 ? 'event' : 'events'} pencilled`);
      if (onSaved) await onSaved(parts.join(' · ') || 'Saved');
    } catch (err) {
      console.error('[SeasonPlacement] save failed:', err);
      setNote({ error: true, text: errorOf(err, 'Nothing was placed. Try again.') });
    } finally { setBusy(false); }
  };

  if (!data) return <section className="sst-card" data-testid="season-placement"><p className="sst-note" role="status">Reading your episodes and events…</p></section>;
  const episodes = items.filter((i) => i.kind === 'episode').length;
  const events = items.length - episodes;
  const nothing = !items.length && !removed.length;

  return (
    <section className="sst-card" aria-labelledby="sst-place-title" data-testid="season-placement">
      <header className="sst-head">
        <h3 id="sst-place-title" className="sst-title"><CalendarDays size={18} aria-hidden="true" /> Use your events and episodes</h3>
        <p className="sst-about">
          The episodes you have made go first, in episode order, with their events. Your draft and ready events fill the open slots after
          them: dated ones by date, undated ones where they fit best. Move or leave out any of them; nothing is placed until you save.
        </p>
      </header>
      {note && <p className={`sst-note${note.error ? ' is-error' : ''}`} role="status">{note.text}</p>}

      {nothing ? (
        <p className="sst-note" data-testid="sst-place-empty">Nothing to place: every episode is in a slot, and every draft or ready event is pencilled in.</p>
      ) : (
        <>
          <p className="sst-count" data-testid="sst-place-count">{episodes} {episodes === 1 ? 'episode' : 'episodes'} · {events} {events === 1 ? 'event' : 'events'}</p>
          <ol className="sst-list" aria-label="Where each one goes">
            {sorted.map((it) => {
              const slot = slotById.get(it.slot_id);
              return (
                <li key={it.key} className={`sst-row is-${it.kind}`} data-testid={`sst-place-${it.key}`}>
                  <span className="sst-slot">{slot?.label?.split(' · ')[1] || slot?.label}<span className="sst-slot-part">Part {slot?.phase}</span></span>
                  <div className="sst-row-body">
                    <span className="sst-row-title">
                      {it.kind === 'episode' ? <Film size={14} aria-hidden="true" /> : <CalendarDays size={14} aria-hidden="true" />}
                      {itemTitle(it)}
                    </span>
                    <span className="sst-row-meta">
                      {it.kind === 'episode' ? 'Episode' : 'Event'}
                      {it.kind === 'episode' && it.event ? ` · with ${it.event.name}` : ''}
                      {it.event?.event_date ? ` · ${it.event.event_date}` : it.kind === 'event' ? ' · no date' : ''}
                    </span>
                    {!it.moved && it.why && <span className="sst-row-why">{it.why}</span>}
                  </div>
                  <div className="sst-row-actions">
                    <label className="sst-move">
                      <span className="sst-sr">Move {itemTitle(it)} to</span>
                      <select value={it.slot_id} onChange={(e) => move(it.key, e.target.value)} disabled={busy} data-testid={`sst-move-${it.key}`}>
                        {slots.filter((s) => s.id === it.slot_id || !taken.has(s.id)).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </label>
                    <button type="button" className="sst-icon-btn" onClick={() => remove(it)} disabled={busy} aria-label={`Leave ${itemTitle(it)} out`} data-testid={`sst-remove-${it.key}`}>
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          {removed.length > 0 && (
            <div className="sst-aside" data-testid="sst-removed">
              <p className="sst-aside-title">Left out ({removed.length})</p>
              <ul className="sst-chips">
                {removed.map((it) => (
                  <li key={it.key}>
                    <button type="button" className="sst-chip-btn" onClick={() => putBack(it)} aria-label={`Put ${itemTitle(it)} back`}>
                      <RotateCcw size={13} aria-hidden="true" /> {itemTitle(it)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {(data.left_over || []).length > 0 && (
        <div className="sst-aside" data-testid="sst-left-over">
          <p className="sst-aside-title">No open slot left for {data.left_over.length}</p>
          <p className="sst-note">{data.left_over.map((l) => (l.kind === 'episode' ? l.episode?.title : l.event?.name)).join(' · ')}</p>
        </div>
      )}

      <div className="sst-actions">
        {!nothing && (
          <button type="button" className="sst-btn" onClick={save} disabled={busy || !items.length} data-testid="sst-place-save">
            {busy ? 'Saving…' : `Save ${items.length} ${items.length === 1 ? 'placement' : 'placements'}`}
          </button>
        )}
        <button type="button" className="sst-btn is-quiet" onClick={onClose} disabled={busy}>{nothing ? 'Close' : 'Cancel'}</button>
      </div>
    </section>
  );
}

// ─── Draft the season, or one part ─────────────────────────────────────

const PRESSURE_CLASS = { Low: 'is-low', Medium: 'is-medium', High: 'is-high', Peak: 'is-peak' };

export function SeasonDraft({ showId, api, phases = [], onSaved, onClose }) {
  const [scope, setScope] = useState(null); // null = the season, else a part number
  const [drafts, setDrafts] = useState(null);
  const [info, setInfo] = useState(null);
  const [drafting, setDrafting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const draft = async () => {
    setDrafting(true); setNote(null); setDrafts(null); setInfo(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/season/draft`, scope ? { phase: scope } : {});
      setDrafts(res.data.drafts || []);
      setInfo({ skipped: res.data.skipped || [], dropped: res.data.dropped_threads || 0 });
    } catch (err) {
      console.error('[SeasonDraft] draft failed:', err);
      setNote({ error: true, text: errorOf(err, 'Nothing was drafted. Try again.') });
    } finally { setDrafting(false); }
  };

  const accept = async (list) => {
    setBusy(true); setNote(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/season/draft/accept`, {
        drafts: list.map((d) => ({ slot_id: d.slot_id, story_purpose: d.story_purpose, desired_pressure: d.desired_pressure, story_thread_id: d.story_thread_id })),
      });
      const saved = res.data.saved || [];
      const skipped = res.data.skipped || [];
      const done = new Set(list.map((d) => d.slot_id));
      setDrafts((ds) => (ds || []).filter((d) => !done.has(d.slot_id)));
      const text = [
        saved.length ? `Saved ${saved.map((n) => `E${n}`).join(', ')}.` : null,
        skipped.length ? `Not saved: ${skipped.map((s) => `E${s.slot_number ?? '?'} (${s.reason === 'edited' ? 'you edited it since' : 'it has started'})`).join(', ')}.` : null,
      ].filter(Boolean).join(' ');
      setNote({ text: text || 'Saved.' });
      if (onSaved) await onSaved();
    } catch (err) {
      console.error('[SeasonDraft] accept failed:', err);
      setNote({ error: true, text: errorOf(err, 'The drafts were not saved.') });
    } finally { setBusy(false); }
  };
  const skip = (d) => setDrafts((ds) => ds.filter((x) => x.slot_id !== d.slot_id));

  const scopeName = scope ? `Part ${scope}${phases.find((p) => Number(p.phase) === scope)?.title ? `: ${phases.find((p) => Number(p.phase) === scope).title}` : ''}` : 'the whole season';
  const notOffered = info?.skipped || [];

  return (
    <section className="sst-card" aria-labelledby="sst-draft-title" data-testid="season-draft">
      <header className="sst-head">
        <h3 id="sst-draft-title" className="sst-title"><Sparkles size={18} aria-hidden="true" /> Draft the season</h3>
        <p className="sst-about">
          One AI call drafts each open slot&apos;s story purpose and pressure, from the season, its parts, the events and episodes in its slots,
          your threads and goals, and what the last episode changed. Slots you edited and slots that have started are left alone.
          Nothing is saved until you accept it.
        </p>
      </header>

      <div className="sst-scope" role="radiogroup" aria-label="What to draft">
        <button type="button" role="radio" aria-checked={scope == null} className={`sst-scope-btn${scope == null ? ' is-on' : ''}`} onClick={() => setScope(null)} disabled={drafting}>The whole season</button>
        {phases.map((p) => (
          <button key={p.phase} type="button" role="radio" aria-checked={scope === Number(p.phase)}
            className={`sst-scope-btn${scope === Number(p.phase) ? ' is-on' : ''}`} onClick={() => setScope(Number(p.phase))} disabled={drafting}
            data-testid={`sst-scope-${p.phase}`}>
            Part {p.phase}{p.title ? `: ${p.title}` : ''}
          </button>
        ))}
      </div>
      <div className="sst-actions">
        <button type="button" className="sst-btn" onClick={draft} disabled={drafting || busy} data-testid="sst-draft-go">
          <Sparkles size={14} aria-hidden="true" /> {drafting ? 'Drafting…' : drafts ? `Draft ${scopeName} again` : `Draft ${scopeName}`}
        </button>
        <button type="button" className="sst-btn is-quiet" onClick={onClose} disabled={drafting || busy}>Close</button>
      </div>
      {drafting && <p className="sst-note" role="status" data-testid="sst-drafting">Reading the season and drafting {scopeName} in one call…</p>}
      {note && <p className={`sst-note${note.error ? ' is-error' : ' is-done'}`} role="status" data-testid="sst-draft-note">{note.text}</p>}

      {drafts && (
        <div className="sst-drafts" data-testid="sst-drafts">
          <div className="sst-drafts-head">
            <p className="sst-drafts-about">Drafted by AI: {drafts.length} {drafts.length === 1 ? 'slot' : 'slots'} to review.</p>
            {drafts.length > 1 && (
              <button type="button" className="sst-btn" onClick={() => accept(drafts)} disabled={busy} data-testid="sst-accept-all">
                <Check size={14} aria-hidden="true" /> Accept all {drafts.length}
              </button>
            )}
          </div>
          {(notOffered.length > 0 || info?.dropped > 0) && (
            <p className="sst-note" data-testid="sst-not-offered">
              {notOffered.length > 0 && `Left alone: ${notOffered.map((s) => `E${s.slot_number} (${s.reason === 'edited' ? 'yours' : 'started'})`).join(', ')}. `}
              {info?.dropped > 0 && `${info.dropped} ${info.dropped === 1 ? 'thread' : 'threads'} the AI named ${info.dropped === 1 ? 'is' : 'are'} not one of yours, so ${info.dropped === 1 ? 'it was' : 'they were'} left off.`}
            </p>
          )}
          <ol className="sst-list" aria-label="Drafted slots">
            {drafts.map((d) => (
              <li key={d.slot_id} className="sst-row is-draft" data-testid={`sst-draft-${d.slot_number}`}>
                <span className="sst-slot">E{d.slot_number}<span className="sst-slot-part">Part {d.phase}</span></span>
                <div className="sst-row-body">
                  <span className="sst-row-purpose">{d.story_purpose}</span>
                  <span className="sst-tags">
                    {d.desired_pressure && <span className={`sst-tag ${PRESSURE_CLASS[d.desired_pressure] || ''}`}>{d.desired_pressure} pressure</span>}
                    {d.story_thread_title && <span className="sst-tag is-thread">Thread: {d.story_thread_title}</span>}
                    {d.current_purpose && <span className="sst-tag is-replaces">Replaces an earlier draft</span>}
                  </span>
                </div>
                <div className="sst-row-actions">
                  <button type="button" className="sst-small-btn" onClick={() => accept([d])} disabled={busy} aria-label={`Accept the draft for E${d.slot_number}`}>
                    <Check size={14} aria-hidden="true" /> Accept
                  </button>
                  <button type="button" className="sst-icon-btn" onClick={() => skip(d)} disabled={busy} aria-label={`Skip the draft for E${d.slot_number}`}>
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {drafts.length === 0 && <p className="sst-note">Every draft is accepted or skipped.</p>}
        </div>
      )}
    </section>
  );
}

// ─── The setup checklist ───────────────────────────────────────────────

/**
 * The steps of setting up a season, from what the page already loaded:
 * the roadmap, the show's goals and its threads. Pure, for the tests.
 */
export function setupSteps({ roadmap, goals = [], threads = [] }) {
  const slots = (roadmap?.phases || []).flatMap((p) => p.slots || []);
  const open = slots.filter((s) => !s.locked);
  const freeSlots = open.filter((s) => !s.event).length;
  const unslotted = (roadmap?.unslotted_episodes || []).length;
  const unplaced = (roadmap?.available_events || []).length;
  const waiting = unslotted + (freeSlots > 0 ? unplaced : 0);
  const liveGoals = goals.filter((g) => g.status === 'active' || g.status === 'paused').length;
  const undrafted = open.filter((s) => !s.intention?.story_purpose).length;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  return [
    { key: 'setup', label: 'Season set up', done: true, detail: `${slots.length} slots in 3 parts` },
    {
      key: 'place', label: 'Events and episodes placed', done: waiting === 0,
      detail: waiting === 0 ? 'Nothing waiting for a slot'
        : [unslotted ? `${plural(unslotted, 'episode', 'episodes')} not in a slot` : null, freeSlots && unplaced ? `${plural(unplaced, 'event', 'events')} not pencilled` : null].filter(Boolean).join(' · '),
    },
    { key: 'goals', label: 'Goals', done: liveGoals > 0, detail: liveGoals ? `${plural(liveGoals, 'goal', 'goals')} for this season` : goals.length ? 'No goal is active for this season' : 'No goals yet' },
    { key: 'threads', label: 'Threads', done: threads.length > 0, detail: threads.length ? plural(threads.length, 'thread', 'threads') : 'No story threads yet' },
    { key: 'draft', label: 'Season drafted', done: undrafted === 0, detail: undrafted ? `${plural(undrafted, 'open slot', 'open slots')} with no purpose yet` : 'Every open slot has a purpose' },
  ];
}

export function SeasonChecklist({ steps, actions = {} }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <section className="sst-card sst-check" aria-labelledby="sst-check-title" data-testid="season-checklist">
      <header className="sst-check-head">
        <h3 id="sst-check-title" className="sst-title"><ListChecks size={18} aria-hidden="true" /> Set up the season</h3>
        <span className="sst-count" data-testid="sst-check-count">{done} of {steps.length} done</span>
      </header>
      <ol className="sst-steps">
        {steps.map((s) => {
          const action = actions[s.key];
          return (
            <li key={s.key} className={`sst-step${s.done ? ' is-done' : ''}`} data-testid={`sst-step-${s.key}`}>
              <span className="sst-step-mark" aria-hidden="true">{s.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}</span>
              <div className="sst-step-body">
                <span className="sst-step-label">{s.label}<span className="sst-sr">{s.done ? ' (done)' : ' (to do)'}</span></span>
                <span className="sst-step-detail">{s.detail}</span>
              </div>
              {action && (
                <button type="button" className={`sst-small-btn${s.done ? ' is-quiet' : ''}`} onClick={action.onClick} disabled={action.busy} data-testid={`sst-step-action-${s.key}`}>
                  {action.icon === 'edit' ? <Pencil size={14} aria-hidden="true" /> : null}
                  {action.busy ? 'Working…' : action.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
