/**
 * FullSeasonChoice — "Will be a special", in the Event Package's season
 * panel (Evoni, 2026-10-26: "Yes placed events should be seen as full, they
 * should have both options, no limit" — "Yes to both, build it and show me
 * first"; lib/seasonFull, services/seasonFullSpecials).
 *
 * When every weekly episode of the season has an event placed or started,
 * an event in none of them will be a special, and the panel offers both
 * options every time:
 *   Make it a special          its place in story order ("Special · after
 *                              E4", between E4 and E5) and its midweek date
 *   Swap it into E_n           the weekly episode it takes (the one whose
 *                              event's date is nearest is suggested), and
 *                              what becomes of the event there now
 * plus what Start Episode will do, and Move to Season 2 instead where a next
 * season has room. Once it is a special (chosen, or made by Start Episode):
 * Move it (after any episode, or to its story position once it has a date),
 * Swap it into E_n, Move to Season 2 instead, Remove the special. Before the
 * specials' migration it says so, plainly, and offers nothing.
 */
import { useEffect, useMemo, useState } from 'react';
import { Sparkles, ArrowLeftRight, CalendarDays, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import {
  useFullSeasonChoice, releaseText, gapText, placeReason, swapChoices, swapOutcome,
} from '../../lib/seasonFull';
import './FullSeasonChoice.css';

/** The weekly episode to swap into, and what that does to its event. */
function SwapPicker({ choice, busy, onSwap, verb = 'Swap it into' }) {
  const options = useMemo(() => swapChoices(choice), [choice]);
  const first = options.find((o) => o.suggested) || options.find((o) => o.can_swap) || null;
  const [slotId, setSlotId] = useState(first?.slot_id || '');
  useEffect(() => { setSlotId(first?.slot_id || ''); }, [first?.slot_id]);
  const picked = options.find((o) => o.slot_id === slotId) || null;
  if (!options.length) return null;
  return (
    <div className="fsc-swap">
      <label className="fsc-field">
        <span className="fsc-label">Weekly episode</span>
        <select className="fsc-select" value={slotId} onChange={(e) => setSlotId(e.target.value)} data-testid="fsc-swap-slot">
          {options.map((o) => (
            <option key={o.slot_id} value={o.slot_id} disabled={!o.can_swap}>{o.label}{o.suggested ? ' · nearest date' : ''}</option>
          ))}
        </select>
      </label>
      <p className={`fsc-note${picked && !picked.can_swap ? ' is-refused' : ''}`} data-testid="fsc-swap-outcome">{swapOutcome(picked)}</p>
      <button type="button" className="epp-btn epp-btn-secondary fsc-btn" disabled={busy || !picked?.can_swap}
        onClick={() => onSwap(picked.slot_id)} data-testid="fsc-swap">
        <ArrowLeftRight size={15} aria-hidden="true" /> {verb} E{picked?.slot_number ?? ''}
      </button>
    </div>
  );
}

function NextSeason({ choice, busy, onMove }) {
  const next = choice?.next_season;
  if (!next) return null;
  return next.open_slot_number ? (
    <button type="button" className="fsc-link" disabled={busy} onClick={onMove} data-testid="fsc-next-season">
      Move to Season {next.season_number} instead <ArrowRight size={14} aria-hidden="true" />
    </button>
  ) : <span className="fsc-note">Season {next.season_number} has no open episode.</span>;
}

/** Move it: after any weekly episode (0: before E1). */
function MoveIt({ special, slotCount, busy, onMove }) {
  const [after, setAfter] = useState(String(special.after_slot_number));
  useEffect(() => { setAfter(String(special.after_slot_number)); }, [special.after_slot_number]);
  const options = [{ value: '0', label: 'Before E1' }, ...Array.from({ length: slotCount }, (_, i) => ({ value: String(i + 1), label: `After E${i + 1}` }))];
  return (
    <div className="fsc-move">
      <label className="fsc-field">
        <span className="fsc-label">Move it</span>
        <select className="fsc-select" value={after} onChange={(e) => setAfter(e.target.value)} data-testid="fsc-move-after">
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <button type="button" className="epp-btn epp-btn-secondary fsc-btn" disabled={busy || after === String(special.after_slot_number)}
        onClick={() => onMove(after)} data-testid="fsc-move">Move it</button>
    </div>
  );
}

export default function FullSeasonChoice({ showId, eventId, context, reload = null, setToast = null }) {
  const ready = context?.specials_ready !== false;
  const fsc = useFullSeasonChoice({ api, showId, eventId, enabled: ready, onChanged: reload, setToast });
  const choice = fsc.data;

  if (!ready) {
    return (
      <div className="fsc is-waiting" data-testid="fsc" data-state="needs-migration">
        <p className="fsc-head"><Sparkles size={16} aria-hidden="true" /> <strong>The season is full</strong></p>
        <p className="fsc-note" data-testid="fsc-needs-migration">
          Every weekly episode has an event. Special episodes need their migration first: until it has run through the Deploy
          workflow, this event stays unplaced, and Start Episode leaves its episode in no slot (listed on the Roadmap to place).
        </p>
      </div>
    );
  }
  if (fsc.loadError) return <p className="fsc-note is-refused" role="alert" data-testid="fsc-error">The season&apos;s choice did not load: {fsc.loadError}</p>;
  if (!choice) return <p className="fsc-note" data-testid="fsc-loading">Checking the season…</p>;
  if (choice.where === 'slot') return null;

  const place = choice.special_place;
  const when = releaseText(place?.release);
  const name = choice.event?.name || 'This event';
  const sp = choice.special;

  if (sp) {
    const storyWhen = releaseText(place?.release);
    return (
      <div className="fsc is-special" data-testid="fsc" data-state={sp.started ? 'special-started' : 'special'}>
        <p className="fsc-head">
          <span className="fsc-badge"><Sparkles size={14} aria-hidden="true" /> {sp.label}</span>
          <span className="fsc-gap">{gapText(sp.after_slot_number, choice.slot_count)}</span>
          {sp.release?.date && <span className="fsc-when"><CalendarDays size={13} aria-hidden="true" /> {releaseText(sp.release)}</span>}
        </p>
        {sp.started && (
          <p className="fsc-note" data-testid="fsc-started-note">
            Started as {sp.label}: the season was full, so Start Episode made it a special instead of leaving it outside the season.
            Move it, swap it into a weekly episode, or move it to the next season below.
          </p>
        )}
        {!choice.event?.has_date && <p className="fsc-note is-nodate" data-testid="fsc-no-date">No date yet: place it when you know.</p>}
        {choice.event?.has_date && choice.at_story_position === false && !sp.done && (
          <p className="fsc-note" data-testid="fsc-story-offer">
            Its date puts it {gapText(place.after, choice.slot_count)} ({place.label}{storyWhen ? `, ${storyWhen}` : ''}).{' '}
            <button type="button" className="fsc-link" disabled={fsc.busy} onClick={() => fsc.toStory(sp.id)} data-testid="fsc-to-story">Move it there</button>
          </p>
        )}
        {fsc.error && <p className="fsc-note is-refused" role="alert" data-testid="fsc-action-error">{fsc.error}</p>}
        {!sp.done && (
          <div className="fsc-options">
            <section className="fsc-option" aria-label="Move it">
              <MoveIt special={sp} slotCount={choice.slot_count} busy={fsc.busy} onMove={(after) => fsc.moveAfter(sp.id, after)} />
            </section>
            <section className="fsc-option" aria-label="Swap it into a weekly episode">
              <SwapPicker choice={choice} busy={fsc.busy} onSwap={fsc.swap} />
            </section>
          </div>
        )}
        {!sp.done && (
          <p className="fsc-foot">
            <NextSeason choice={choice} busy={fsc.busy} onMove={fsc.nextSeason} />
            {!sp.started && (
              <button type="button" className="fsc-link is-quiet" disabled={fsc.busy} onClick={() => fsc.remove(sp.id)} data-testid="fsc-remove">
                Remove the special (the event stays, unplaced)
              </button>
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="fsc" data-testid="fsc" data-state="will-be-special">
      <p className="fsc-head">
        <span className="fsc-badge" data-testid="fsc-will-be"><Sparkles size={14} aria-hidden="true" /> Will be a special</span>
        <span className="fsc-gap">The season is full: all {choice.slot_count} weekly episodes have an event. Choose where &ldquo;{name}&rdquo; goes.</span>
      </p>
      {fsc.error && <p className="fsc-note is-refused" role="alert" data-testid="fsc-action-error">{fsc.error}</p>}
      <div className="fsc-options">
        <section className="fsc-option" aria-label="Make it a special" data-testid="fsc-option-special">
          <h3 className="fsc-option-title"><Sparkles size={15} aria-hidden="true" /> Make it a special</h3>
          <p className="fsc-place"><strong>{place.label}</strong> · {gapText(place.after, choice.slot_count)}</p>
          {when && <p className="fsc-when"><CalendarDays size={13} aria-hidden="true" /> Releases {when} on YouTube, midweek</p>}
          <p className={`fsc-note${place.by === 'no_date' ? ' is-nodate' : ''}`} data-testid="fsc-place-reason">{placeReason(place, choice.part)}</p>
          <button type="button" className="epp-btn epp-btn-primary fsc-btn" disabled={fsc.busy} onClick={fsc.makeSpecial} data-testid="fsc-make">
            Make it a special
          </button>
        </section>
        <section className="fsc-option" aria-label="Swap it into a weekly episode" data-testid="fsc-option-swap">
          <h3 className="fsc-option-title"><ArrowLeftRight size={15} aria-hidden="true" /> Swap it into a weekly episode</h3>
          <SwapPicker choice={choice} busy={fsc.busy} onSwap={fsc.swap} />
        </section>
      </div>
      <p className="fsc-foot">
        {choice.start_note && !choice.event?.started && <span className="fsc-start" data-testid="fsc-start-note">{choice.start_note}</span>}
        <NextSeason choice={choice} busy={fsc.busy} onMove={fsc.nextSeason} />
      </p>
    </div>
  );
}
