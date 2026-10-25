/**
 * The Season page's Roadmap and Events tabs
 * (Evoni's mockup, 2026-10-25). They draw the Season Plan's own pieces
 * (SeasonPlan.jsx): the roadmap controls, the advance bar, the slot panel
 * (a sheet on a phone, a drawer beside the page otherwise) with its ranked
 * pencil and intention editor, and the episodes in no slot. Only the cards
 * and their layout are the page's.
 *
 *   Roadmap     Grid (three part columns of cards) or Timeline (every slot in
 *               order); All Parts / All Statuses; + Add Episode (the
 *               new-episode flow). `?view=`, `?part=`, `?status=` hold them.
 *               No Calendar: the slots carry no dates (only the season does).
 *   Events      the slots' events in slot order, and the events in no slot,
 *               each pencilled from here; the placement preview.
 *   Each slot card and event row with an event says which goals it moves
 *   ("Moves: <goal>", GoalCoverage's MovesChips; Evoni, 2026-10-25).
 * The Production Plan tab (each placed episode's steps and checklist count)
 * gave way to the Episodes tab, the production board itself (2026-10-25).
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutGrid, ListOrdered, Plus, MoreHorizontal, CalendarDays } from 'lucide-react';
import { useRoadmapControls, AdvanceBar, SlotSide, UnslottedEpisodes } from './SeasonPlan';
import { SeasonPlacement } from './SeasonSetup';
import { StatusChip } from './SeasonPageParts';
import { MovesChips } from './GoalCoverage';
import { useGoalCoverage, slotGoalsMap } from '../../lib/goalCoverage';
import {
  SLOT_STATUS, SLOT_STATUS_ORDER, allSlots, filterSlots, slotPicture, slotCardTitle, arcPart, partProgress, dayLabel,
} from '../../lib/seasonPage';

/** The roadmap's controls and its slot drawer, wired the way the Season Plan wires them. */
function useSlotDrawer({ plan, api, showId, setToast }) {
  return useRoadmapControls({ roadmap: plan.roadmap, api, showId, onChanged: plan.loadRoadmap, setToast });
}

function SlotDrawer({ controls, plan, S, api, showId, setToast, episodes, events }) {
  return (
    <div className="szn-drawer">
      <SlotSide controls={controls} roadmap={plan.roadmap} S={S} api={api} showId={showId} onChanged={plan.loadRoadmap} setToast={setToast}
        threads={plan.threadData.threads} episodes={episodes} events={events} needs={plan.needs.data?.needs || []} onNeedsChanged={plan.loadNeeds} />
    </div>
  );
}

/** A slot card's ⋯ menu: its panel, its episode or event package, its intention. */
function CardMenu({ slot, showId, onOpen, onIntention }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);
  const editable = slot.intention_editable ?? !slot.locked;
  return (
    <div className="szn-menu-wrap szn-card-menu" ref={ref}>
      <button type="button" className="szn-icon-btn" aria-label={`More for E${slot.slot_number}`} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)} data-testid={`szn-slot-menu-${slot.slot_number}`}>
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="szn-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpen(); }}>Open the slot</button>
          {editable && <button type="button" role="menuitem" onClick={() => { setOpen(false); onIntention(); }}>Edit intention</button>}
          {slot.episode && <Link role="menuitem" to={`/episodes/${slot.episode.id}`}>Open the episode</Link>}
          {!slot.episode && slot.event && <Link role="menuitem" to={`/shows/${showId}/events/${slot.event.id}`}>Open the event package</Link>}
        </div>
      )}
    </div>
  );
}

/** One slot as a card: picture, E#, title, status chip, the goals its event moves, ⋯. Clicking opens its panel. */
export function SlotCard({ slot, picture, showId, selected, onOpen, onIntention, nextSlot, moves = [] }) {
  return (
    <div className={`szn-slot is-${slot.state}${selected ? ' is-selected' : ''}`} data-testid={`szn-slot-${slot.slot_number}`}>
      <button type="button" className="szn-slot-open" onClick={onOpen} aria-pressed={selected}
        aria-label={`E${slot.slot_number}: ${slotCardTitle(slot)}, ${SLOT_STATUS[slot.state] || SLOT_STATUS.needs_event}`}>
        <span className={`szn-slot-pic is-part-${slot.phase}`} aria-hidden="true">
          {picture && <img src={picture} alt="" loading="lazy" />}
        </span>
        <span className="szn-slot-body">
          <span className="szn-slot-num">E{slot.slot_number}{nextSlot && <span className="szn-slot-next">Next</span>}</span>
          <span className={`szn-slot-title${slot.episode || slot.event || slot.intention?.story_purpose ? '' : ' is-empty'}`}>{slotCardTitle(slot)}</span>
          <StatusChip state={slot.state} />
          <MovesChips goals={moves} testId={`szn-slot-moves-${slot.slot_number}`} />
        </span>
      </button>
      <CardMenu slot={slot} showId={showId} onOpen={onOpen} onIntention={onIntention} />
    </div>
  );
}

export function SeasonRoadmapTab({ plan, S, api, showId, setToast, episodes, events, arc, params, goTab }) {
  const navigate = useNavigate();
  const controls = useSlotDrawer({ plan, api, showId, setToast });
  const { roadmap } = plan;
  const coverage = useGoalCoverage({ api, showId, reloadKey: roadmap });
  const movesBySlot = slotGoalsMap(coverage.data);
  const view = params.get('view') === 'timeline' ? 'timeline' : 'grid';
  const part = params.get('part') || 'all';
  const status = params.get('status') || 'all';
  if (!roadmap) return <p className="szn-muted">The roadmap did not load.</p>;
  const phases = roadmap.phases || [];
  const setFilter = (patch) => goTab('roadmap', { view, part, status, ...patch });
  const newEpisode = () => navigate(`/shows/${showId}/new-episode`);
  const openSlot = (slot) => controls.open(slot);
  const editIntention = (slot) => { controls.open(slot); controls.setEditingSlotId(slot.id); };
  const card = (slot) => (
    <SlotCard key={slot.id} slot={slot} showId={showId} picture={slotPicture(slot, { episodes, events, arc })}
      selected={controls.sheetOpen && controls.selected?.id === slot.id} nextSlot={!slot.locked && slot.slot_number === roadmap.next_slot_number}
      onOpen={() => openSlot(slot)} onIntention={() => editIntention(slot)} moves={movesBySlot[slot.id] || []} />
  );
  const shownPhases = phases.filter((p) => part === 'all' || Number(p.phase) === Number(part));
  const timeline = filterSlots(allSlots(roadmap), { part, status });

  return (
    <div className="szn-roadmap" data-testid="szn-roadmap">
      <div className="szn-card szn-roadmap-card">
        <header className="szn-roadmap-head">
          <h2 className="szn-section-title"><CalendarDays size={22} aria-hidden="true" /> Episode Roadmap</h2>
          <div className="szn-toolbar">
            <div className="szn-seg" role="group" aria-label="View">
              <button type="button" aria-pressed={view === 'grid'} className={view === 'grid' ? 'is-on' : ''} onClick={() => setFilter({ view: 'grid' })} data-testid="szn-view-grid">
                <LayoutGrid size={16} aria-hidden="true" /> Grid
              </button>
              <button type="button" aria-pressed={view === 'timeline'} className={view === 'timeline' ? 'is-on' : ''} onClick={() => setFilter({ view: 'timeline' })} data-testid="szn-view-timeline">
                <ListOrdered size={16} aria-hidden="true" /> Timeline
              </button>
            </div>
            <select className="szn-select" aria-label="Part" value={part} onChange={(e) => setFilter({ part: e.target.value })} data-testid="szn-filter-part">
              <option value="all">All Parts</option>
              {phases.map((p) => <option key={p.phase} value={String(p.phase)}>Part {p.phase}: {p.title}</option>)}
            </select>
            <select className="szn-select" aria-label="Status" value={status} onChange={(e) => setFilter({ status: e.target.value })} data-testid="szn-filter-status">
              <option value="all">All Statuses</option>
              {SLOT_STATUS_ORDER.map((k) => <option key={k} value={k}>{SLOT_STATUS[k]}</option>)}
            </select>
            <button type="button" className="szn-btn" onClick={newEpisode} data-testid="szn-add-episode"><Plus size={16} aria-hidden="true" /> Add Episode</button>
          </div>
        </header>

        {/* Advancing stays with the roadmap (the Season Plan's own bar and confirm step). */}
        <AdvanceBar roadmap={roadmap} S={S} onAdvance={plan.handleAdvance} advancing={plan.advancing} advanceWarning={plan.warning}
          onConfirmAdvance={plan.handleConfirmAdvance} onCancelAdvance={() => plan.setWarning(null)} advanceError={plan.advanceError} />

        {view === 'grid' ? (
          <div className={`szn-parts is-${shownPhases.length}`} data-testid="szn-roadmap-grid">
            {shownPhases.map((phase) => {
              const slots = filterSlots(phase.slots, { status });
              const prog = partProgress(phase);
              return (
                <section key={phase.phase} className={`szn-part is-part-${phase.phase}`} aria-label={`Part ${phase.phase}: ${phase.title}`} data-testid={`szn-part-col-${phase.phase}`}>
                  <header className="szn-part-head">
                    <h3 className="szn-part-title"><span className="szn-part-num">Part {phase.phase}</span> {phase.title}
                      <span className="szn-part-range">E{phase.episode_start} – E{phase.episode_end}</span></h3>
                    <span className="szn-part-count">{prog.done} of {prog.total} completed</span>
                  </header>
                  <div className="szn-slot-list">
                    {slots.length ? slots.map(card) : <p className="szn-muted">No slot here is {SLOT_STATUS[status]?.toLowerCase()}.</p>}
                  </div>
                  <button type="button" className="szn-add-row" onClick={newEpisode} data-testid={`szn-add-episode-part-${phase.phase}`}>
                    <Plus size={16} aria-hidden="true" /> Add Episode to Part {phase.phase}
                  </button>
                </section>
              );
            })}
          </div>
        ) : (
          <ol className="szn-timeline" data-testid="szn-roadmap-timeline" aria-label="Every slot in order">
            {timeline.map((slot) => {
              const p = arcPart(arc, slot.phase);
              const ev = slot.event ? events.find((e) => e.id === slot.event.id) : null;
              const when = dayLabel(ev?.event_date) || (ev?.event_date ? String(ev.event_date) : null);
              return (
                <li key={slot.id} className={`szn-tl-item is-${slot.state}`}>
                  <span className="szn-tl-dot" aria-hidden="true" />
                  <span className="szn-tl-part">Part {slot.phase}{p?.title ? ` · ${p.title}` : ''}{when ? ` · ${when}` : ''}</span>
                  {card(slot)}
                </li>
              );
            })}
            {timeline.length === 0 && <li className="szn-muted">No slot matches these filters.</li>}
          </ol>
        )}

        <UnslottedEpisodes roadmap={roadmap} controls={controls} />
      </div>
      <SlotDrawer controls={controls} plan={plan} S={S} api={api} showId={showId} setToast={setToast} episodes={episodes} events={events} />
    </div>
  );
}

export function SeasonEventsTab({ plan, S, api, showId, setToast, episodes, events, arc }) {
  const controls = useSlotDrawer({ plan, api, showId, setToast });
  const [placing, setPlacing] = useState(false);
  const { roadmap } = plan;
  const coverage = useGoalCoverage({ api, showId, reloadKey: roadmap });
  if (!roadmap) return <p className="szn-muted">The roadmap did not load.</p>;
  const movesBySlot = slotGoalsMap(coverage.data);
  const slots = allSlots(roadmap);
  const withEvents = slots.filter((s) => s.event);
  const open = controls.openSlots.filter((s) => !s.event);
  const unplaced = roadmap.available_events || [];
  const eventRow = (id) => events.find((e) => e.id === id) || null;
  return (
    <div className="szn-events" data-testid="szn-events">
      <section className="szn-card">
        <header className="szn-card-head">
          <h2 className="szn-card-title">Events in the season</h2>
          <span className="szn-muted">{withEvents.length} of {slots.length} slots</span>
        </header>
        {withEvents.length === 0 && <p className="szn-muted">No event is pencilled in yet.</p>}
        <ul className="szn-list">
          {withEvents.map((slot) => {
            const ev = eventRow(slot.event.id);
            const pic = slotPicture({ ...slot, episode: null }, { events, arc });
            return (
              <li key={slot.id} className="szn-list-row" data-testid={`szn-event-slot-${slot.slot_number}`}>
                <span className={`szn-list-pic is-part-${slot.phase}`} aria-hidden="true">{pic && <img src={pic} alt="" loading="lazy" />}</span>
                <span className="szn-list-main">
                  <span className="szn-list-title">E{slot.slot_number} · {slot.event.name}</span>
                  <span className="szn-list-sub">{[ev?.event_type, dayLabel(ev?.event_date) || ev?.event_date].filter(Boolean).join(' · ') || 'No date yet'}</span>
                  <MovesChips goals={movesBySlot[slot.id] || []} max={3} testId={`szn-event-moves-${slot.slot_number}`} />
                </span>
                <StatusChip state={slot.state} />
                <button type="button" className="szn-btn is-quiet" onClick={() => controls.open(slot)}>Open</button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="szn-card">
        <header className="szn-card-head">
          <h2 className="szn-card-title">Not in a slot yet</h2>
          <button type="button" className="szn-btn" onClick={() => setPlacing((p) => !p)} aria-expanded={placing} data-testid="szn-events-place">
            Use events and episodes
          </button>
        </header>
        {placing && (
          <SeasonPlacement showId={showId} api={api} onClose={() => setPlacing(false)}
            onSaved={async (text) => { setPlacing(false); if (setToast) setToast(text); await plan.loadArc(); }} />
        )}
        {unplaced.length === 0 && <p className="szn-muted">Every draft or ready event is pencilled in.</p>}
        <ul className="szn-list">
          {unplaced.map((ev) => (
            <li key={ev.id} className="szn-list-row" data-testid={`szn-event-free-${ev.id}`}>
              <span className="szn-list-main">
                <span className="szn-list-title">{ev.name}</span>
                <span className="szn-list-sub">{ev.status || 'draft'}</span>
              </span>
              {/* Pencilled through the slot rules; a slot's panel ranks every event by fit. */}
              <select className="szn-select" aria-label={`Pencil ${ev.name} into a slot`} value="" disabled={!open.length}
                onChange={(e) => { const slot = open.find((s) => s.id === e.target.value); if (slot) controls.pencil(slot, ev.id); }}>
                <option value="">{open.length ? 'Pencil into…' : 'No open slot'}</option>
                {open.map((s) => <option key={s.id} value={s.id}>E{s.slot_number}{s.intention?.story_purpose ? ` · ${s.intention.story_purpose.slice(0, 40)}` : ''}</option>)}
              </select>
            </li>
          ))}
        </ul>
        {controls.slotError?.where === 'event' && <p className="szn-error" role="alert">{controls.slotError.text}</p>}
        <p className="szn-muted">Open a slot to see the events ranked by how well they fit it.</p>
      </section>
      <SlotDrawer controls={controls} plan={plan} S={S} api={api} showId={showId} setToast={setToast} episodes={episodes} events={events} />
    </div>
  );
}
