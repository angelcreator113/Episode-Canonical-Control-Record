/**
 * Special episodes on the Roadmap (Evoni, 2026-10-26: "All three and on
 * YouTube, show me first"; lib/seasonSpecials, services/seasonSpecials).
 *
 *   SpecialsBar   above the roadmap's views: "+ Add a special" (kind, after
 *                 which episode, its event or title, its date and time), the
 *                 bonus suggestion ("This event has no Sunday near its date
 *                 and high stakes: make it a bonus episode?" — Make it / Not
 *                 now), and each two-parter with Start Part 2 and Undo.
 *                 Before the specials' migration it says so and adds nothing.
 *   SpecialCard   one bonus episode or stand-alone special among the weekly
 *                 cards (after the episode it follows): its label, its own
 *                 release day, its title and status; opens its editor.
 *   AddSpecialForm  the form, also used to make a suggestion a bonus.
 *   WillBeSpecial   on the Events tab, for an unplaced event once the
 *                 season is full (every weekly episode has an event placed
 *                 or started; Evoni, 2026-10-26): "Will be a special", Make
 *                 it a special (in story order, lib/seasonFull), or open the
 *                 event to swap it into a weekly episode.
 *
 * The weekly Sunday episodes keep their numbers and dates; a special has
 * its own date and time, set here (YouTube, like the main show).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Sparkles, Gift, X, Clapperboard } from 'lucide-react';
import { StatusChip } from './SeasonPageParts';
import { MovesChips } from './GoalCoverage';
import {
  SPECIAL_KINDS, SPECIAL_TYPES, NEEDS_MIGRATION_TEXT, afterOptions, defaultAfter, bonusSuggestions, readDismissed, saveDismissed,
  specialRow, specialWhen, suggestionText, twoPartersOf,
} from '../../lib/seasonSpecials';
import { allSlots } from '../../lib/seasonPage';
import { formatDay, formatTime } from '../../lib/releaseSchedule';
import { packageHref } from '../../lib/eventFlow';
import { hasStoryDate, makeSpecialFor } from '../../lib/seasonFull';
import { errorText } from '../../lib/releaseSchedule';
import './SeasonSpecials.css';

/** The events a special can be made from: those a weekly slot could take, and those pencilled in an open, unpaired slot. */
function eventChoices(roadmap, events) {
  const byId = new Map((events || []).map((e) => [e.id, e]));
  const free = (roadmap?.available_events || []).map((e) => ({ id: e.id, name: byId.get(e.id)?.name || e.name, where: null }));
  const pencilled = allSlots(roadmap).filter((s) => s.event && !s.episode && !s.locked && !s.two_part)
    .map((s) => ({ id: s.event.id, name: s.event.name, where: `E${s.slot_number}` }));
  return [...pencilled, ...free];
}

/** The Wednesday-style suggestion for a new special after weekly episode n: midweek after its release day. */
function newSuggestion(release, roadmap, after) {
  const season = (release?.seasons || []).find((x) => Number(x.season_number) === Number(roadmap?.season_number));
  const slots = season?.slots || release?.slots || {};
  const before = slots[after]?.date || null;
  const next = slots[after + 1]?.date || null;
  const add = (iso, n) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n)).toISOString().slice(0, 10);
  const time = release?.schedule?.time || '10:00';
  if (before) return { date: add(before, 3), time };
  if (next) return { date: add(next, -4), time };
  return null;
}

export function AddSpecialForm({ roadmap, events, release, initial = null, busy = false, onSubmit, onCancel }) {
  const [kind, setKind] = useState(initial?.kind || 'bonus');
  const [after, setAfter] = useState(initial?.after ?? defaultAfter(roadmap));
  const [eventId, setEventId] = useState(initial?.event_id || '');
  const [specialType, setSpecialType] = useState('holiday');
  const [title, setTitle] = useState('');
  const suggested = newSuggestion(release, roadmap, Number(after));
  const [date, setDate] = useState(initial?.release_date || '');
  const [time, setTime] = useState(initial?.release_time || '');
  const choices = useMemo(() => {
    const list = eventChoices(roadmap, events);
    if (initial?.event_id && !list.some((e) => e.id === initial.event_id)) list.unshift({ id: initial.event_id, name: initial.event_name || 'This event', where: null });
    return list;
  }, [roadmap, events, initial]);
  const needsEvent = kind === 'bonus' && !eventId;
  const submit = (e) => {
    e.preventDefault();
    if (needsEvent) return;
    onSubmit({
      kind,
      after_slot_number: Number(after),
      event_id: eventId || null,
      ...(kind === 'special' ? { special_type: specialType } : {}),
      title: title.trim() || null,
      release_date: date || null,
      release_time: time || null,
    });
  };
  return (
    <form className="sspec-form" onSubmit={submit} data-testid="sspec-form" aria-label="Add a special">
      <fieldset className="sspec-kinds">
        <legend className="sspec-label">Kind</legend>
        {SPECIAL_KINDS.map((k) => (
          <label key={k.key} className={`sspec-kind${kind === k.key ? ' is-on' : ''}`}>
            <input type="radio" name="sspec-kind" value={k.key} checked={kind === k.key} onChange={() => setKind(k.key)} data-testid={`sspec-kind-${k.key}`} />
            <span><strong>{k.label}</strong><small>{k.hint}</small></span>
          </label>
        ))}
      </fieldset>
      <div className="sspec-grid">
        <label className="sspec-field">
          <span className="sspec-label">After which episode</span>
          <select className="szn-select" value={after} onChange={(e) => setAfter(Number(e.target.value))} data-testid="sspec-after">
            {afterOptions(roadmap).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="sspec-field">
          <span className="sspec-label">{kind === 'bonus' ? 'Its event' : 'Its event (optional)'}</span>
          <select className="szn-select" value={eventId} onChange={(e) => setEventId(e.target.value)} data-testid="sspec-event">
            <option value="">{choices.length ? 'Pick an event…' : 'No event is free'}</option>
            {choices.map((c) => <option key={c.id} value={c.id}>{c.name}{c.where ? ` (now in ${c.where})` : ''}</option>)}
          </select>
        </label>
        {kind === 'special' && (
          <label className="sspec-field">
            <span className="sspec-label">Type</span>
            <select className="szn-select" value={specialType} onChange={(e) => setSpecialType(e.target.value)} data-testid="sspec-type">
              {SPECIAL_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
        )}
        <label className="sspec-field">
          <span className="sspec-label">Title {kind === 'bonus' ? '(the event\'s name if empty)' : ''}</span>
          <input className="sspec-input" type="text" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'special' ? 'Holiday at the Penthouse' : ''} data-testid="sspec-title" />
        </label>
        <label className="sspec-field">
          <span className="sspec-label">Releases on YouTube</span>
          <input className="sspec-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="sspec-date" />
        </label>
        <label className="sspec-field">
          <span className="sspec-label">At</span>
          <input className="sspec-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} data-testid="sspec-time" />
        </label>
      </div>
      {suggested && !date && (
        <p className="sspec-hint">
          Suggested: {formatDay(suggested.date)} · {formatTime(suggested.time)}, midweek between two Sundays.{' '}
          <button type="button" className="szn-link" onClick={() => { setDate(suggested.date); setTime(suggested.time); }} data-testid="sspec-use-suggested">Use it</button>
        </p>
      )}
      <p className="sspec-hint">The weekly Sunday episodes keep their numbers and dates.</p>
      <div className="sspec-actions">
        <button type="submit" className="szn-btn" disabled={busy || needsEvent} data-testid="sspec-save">{kind === 'bonus' ? 'Add the bonus episode' : 'Add the special'}</button>
        <button type="button" className="szn-btn is-quiet" onClick={onCancel}>Cancel</button>
      </div>
      {needsEvent && <p className="sspec-hint">A bonus episode is made from an event: pick one.</p>}
    </form>
  );
}

/** A special's own date and time, and Remove while it has no episode. */
function SpecialEditor({ special, release, specials, showId, onClose }) {
  const row = specialRow(release, special);
  const [date, setDate] = useState(special.release?.date || '');
  const [time, setTime] = useState(special.release?.time || '');
  const [title, setTitle] = useState(special.title || '');
  const suggested = suggestionText(row);
  const save = async (e) => {
    e.preventDefault();
    const ok = await specials.update(special.id, { title: title.trim() || null, release_date: date || null, release_time: time || null });
    if (ok) onClose();
  };
  return (
    <form className="sspec-editor" onSubmit={save} data-testid={`sspec-editor-${special.id}`} aria-label={`${special.label}: date and title`}>
      <div className="sspec-grid">
        <label className="sspec-field"><span className="sspec-label">Title</span>
          <input className="sspec-input" type="text" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="sspec-field"><span className="sspec-label">Releases on YouTube</span>
          <input className="sspec-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid={`sspec-editor-date-${special.id}`} /></label>
        <label className="sspec-field"><span className="sspec-label">At</span>
          <input className="sspec-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      {suggested && !date && (
        <p className="sspec-hint">Suggested: {suggested}{row?.suggested?.from === 'event' ? ', the Wednesday nearest its event' : ', midweek after the episode it follows'}.{' '}
          <button type="button" className="szn-link" onClick={() => { setDate(row.suggested.date); setTime(row.suggested.time || ''); }}>Use it</button></p>
      )}
      <div className="sspec-actions">
        <button type="submit" className="szn-btn" disabled={specials.busy}>Save</button>
        {special.episode ? <Link className="szn-btn is-quiet" to={`/episodes/${special.episode.id}`}>Open the episode</Link>
          : special.event ? <Link className="szn-btn is-quiet" to={packageHref(showId, special.event.id, { kind: 'roadmap' })}>Open the event package</Link> : null}
        {!special.episode && (
          <button type="button" className="szn-btn is-quiet" disabled={specials.busy}
            onClick={async () => { if (await specials.remove(special.id)) onClose(); }} data-testid={`sspec-remove-${special.id}`}>Remove</button>
        )}
        <button type="button" className="szn-btn is-quiet" onClick={onClose}>Close</button>
      </div>
    </form>
  );
}

/** One bonus episode or stand-alone special among the weekly cards. */
export function SpecialCard({ special, release, specials = null, showId, readOnly = false, moves = [] }) {
  const [open, setOpen] = useState(false);
  const when = specialWhen(release, special);
  const row = specialRow(release, special);
  const Icon = special.kind === 'bonus' ? Sparkles : Gift;
  // A bonus whose event has no in-world date yet sits after the part in progress (seasonFullSpecials).
  const noDate = special.kind === 'bonus' && special.event && !hasStoryDate(special.event.event_date);
  const subtitle = special.kind === 'special' ? `${special.place} · not in the parts or goals` : noDate ? 'No date yet: place it when you know' : null;
  return (
    <div className={`sspec-card is-${special.kind} is-${special.state}`} data-testid={`sspec-card-${special.id}`}>
      <button type="button" className="sspec-card-open" onClick={() => !readOnly && specials && setOpen((o) => !o)} aria-expanded={open}
        aria-label={`${special.label}: ${special.title || 'Untitled'}, ${when.text}`} disabled={readOnly || !specials}>
        <span className="sspec-card-icon" aria-hidden="true"><Icon size={20} /></span>
        <span className="sspec-card-body">
          <span className="sspec-card-num">{special.label}
            <span className={`sspec-when${when.set ? '' : ' is-unset'}${row?.due ? ` is-${row.due}` : ''}`} data-testid={`sspec-when-${special.id}`}>{when.text}</span>
          </span>
          <span className="sspec-card-title">{special.title || 'Untitled special'}</span>
          {subtitle && <span className="sspec-card-sub" data-testid={noDate ? `sspec-no-date-${special.id}` : undefined}>{subtitle}</span>}
          <StatusChip state={special.state} />
          {/* A bonus's event moves goals like any other; a stand-alone special counts toward none. */}
          {special.kind === 'bonus' && <MovesChips goals={moves} testId={`sspec-moves-${special.id}`} />}
        </span>
      </button>
      {open && specials && <SpecialEditor special={special} release={release} specials={specials} showId={showId} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** "This event has no Sunday near its date and high stakes: make it a bonus episode?" */
function BonusSuggestion({ suggestion, onMake, onNotNow, busy }) {
  return (
    <li className="sspec-suggest" data-testid={`sspec-suggest-${suggestion.event.id}`}>
      <Sparkles size={18} aria-hidden="true" />
      <span className="sspec-suggest-text">
        <strong>Make &ldquo;{suggestion.event.name}&rdquo; a bonus episode?</strong>
        <span>{suggestion.reason} It would sit after E{suggestion.after}{suggestion.slot ? `, leaving E${suggestion.slot.slot_number} open` : ''}.</span>
      </span>
      <span className="sspec-suggest-actions">
        <button type="button" className="szn-btn" disabled={busy} onClick={onMake} data-testid={`sspec-suggest-make-${suggestion.event.id}`}>Make it</button>
        <button type="button" className="szn-btn is-quiet" onClick={onNotNow} data-testid={`sspec-suggest-not-now-${suggestion.event.id}`}>Not now</button>
      </span>
    </li>
  );
}

function TwoParterRow({ tp, specials, readOnly }) {
  return (
    <li className="sspec-two" data-testid={`sspec-two-${tp.id}`}>
      <Clapperboard size={18} aria-hidden="true" />
      <span className="sspec-two-text">
        <strong>{tp.event?.name || 'Two-parter'}</strong>
        <span>{tp.part_one.label}{tp.part_one.episode ? ' started' : ''} → {tp.part_two.label}{tp.part_two.episode ? ' started' : ''}. The event completes with Part 2.</span>
      </span>
      {!readOnly && (
        <span className="sspec-suggest-actions">
          {tp.can_start_part_two && <button type="button" className="szn-btn" disabled={specials.busy} onClick={() => specials.startPartTwo(tp.id)} data-testid={`sspec-two-start-${tp.id}`}>Start Part 2</button>}
          {tp.can_undo && <button type="button" className="szn-btn is-quiet" disabled={specials.busy} onClick={() => specials.undoTwoParter(tp.id)} data-testid={`sspec-two-undo-${tp.id}`}>Undo</button>}
        </span>
      )}
    </li>
  );
}

/**
 * Above the roadmap: + Add a special, the suggestions and the two-parters.
 * specials is useSeasonSpecials' actions.
 */
export function SpecialsBar({ roadmap, events, release, specials, readOnly = false }) {
  const [adding, setAdding] = useState(null);
  const [dismissed, setDismissed] = useState(() => readDismissed());
  const ready = Boolean(roadmap?.specials_ready);
  const suggestions = useMemo(() => (readOnly ? [] : bonusSuggestions({ roadmap, events, release, dismissed })), [roadmap, events, release, dismissed, readOnly]);
  const twos = twoPartersOf(roadmap);
  const count = (roadmap?.specials || []).length;
  const notNow = (id) => { const next = [...dismissed, id]; setDismissed(next); saveDismissed(next); };
  const submit = async (body) => { if (await specials.add(body)) setAdding(null); };
  if (readOnly && !count && !twos.length) return null;
  return (
    <section className="sspec-bar" aria-label="Special episodes" data-testid="sspec-bar">
      <header className="sspec-bar-head">
        <h3 className="sspec-bar-title"><Sparkles size={18} aria-hidden="true" /> Specials
          <span className="sspec-bar-count">{count ? `${count} planned` : 'none yet'}{twos.length ? ` · ${twos.length} two-parter${twos.length === 1 ? '' : 's'}` : ''}</span>
        </h3>
        {!readOnly && (
          <button type="button" className="szn-btn" onClick={() => setAdding(adding ? null : {})} disabled={!ready} aria-expanded={Boolean(adding)} data-testid="sspec-add">
            {adding ? <><X size={16} aria-hidden="true" /> Close</> : <><Plus size={16} aria-hidden="true" /> Add a special</>}
          </button>
        )}
      </header>
      {!ready && !readOnly && <p className="sspec-hint" data-testid="sspec-needs-migration">{NEEDS_MIGRATION_TEXT}</p>}
      {ready && !readOnly && !adding && !count && !twos.length && (
        <p className="sspec-hint">A bonus episode for an event between two Sundays, a holiday or recap special, or a two-parter from a slot&apos;s ⋯ menu. The weekly episodes stay as they are.</p>
      )}
      {adding && <AddSpecialForm roadmap={roadmap} events={events} release={release} initial={adding.kind ? adding : null} busy={specials.busy} onSubmit={submit} onCancel={() => setAdding(null)} />}
      {specials.error && <p className="szn-error" role="alert" data-testid="sspec-error">{specials.error}</p>}
      {suggestions.length > 0 && !adding && (
        <ul className="sspec-list" aria-label="Suggested bonus episodes">
          {suggestions.slice(0, 2).map((s) => (
            <BonusSuggestion key={s.event.id} suggestion={s} busy={specials.busy}
              onMake={() => setAdding({ kind: 'bonus', after: s.after, event_id: s.event.id, event_name: s.event.name, release_date: s.date, release_time: release?.schedule?.time || '10:00' })}
              onNotNow={() => notNow(s.event.id)} />
          ))}
        </ul>
      )}
      {twos.length > 0 && (
        <ul className="sspec-list" aria-label="Two-parters">
          {twos.map((tp) => <TwoParterRow key={tp.id} tp={tp} specials={specials} readOnly={readOnly} />)}
        </ul>
      )}
    </section>
  );
}

/**
 * An unplaced event on a full season (the Events tab): "Will be a special",
 * Make it a special here, or Swap it into a weekly episode on its page.
 * Before the specials' migration it says they need it, and nothing else.
 */
export function WillBeSpecial({ api, showId, event, ready = true, from = null, onChanged = null, setToast = null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (!ready) {
    return <span className="sspec-will is-waiting" data-testid={`sspec-will-${event.id}`}>Season full · specials need their migration first</span>;
  }
  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const made = await makeSpecialFor(api, showId, event.id);
      if (onChanged) await onChanged();
      if (setToast) setToast(`“${event.name}” is ${made?.label || 'a special'}.`);
    } catch (err) {
      console.error('[SeasonSpecials] make it a special failed:', err);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="sspec-will-row">
      <span className="sspec-will" data-testid={`sspec-will-${event.id}`}><Sparkles size={13} aria-hidden="true" /> Will be a special</span>
      <button type="button" className="szn-btn is-quiet" disabled={busy} onClick={make} data-testid={`sspec-will-make-${event.id}`}>Make it a special</button>
      <Link className="szn-link sspec-will-swap" to={packageHref(showId, event.id, from)} data-testid={`sspec-will-swap-${event.id}`}>or swap it into a weekly episode</Link>
      {error && <span className="szn-error" role="alert">{error}</span>}
    </span>
  );
}
