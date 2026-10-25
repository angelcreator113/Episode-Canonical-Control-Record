/**
 * The Season page's Roadmap and Events tabs
 * (Evoni's mockup, 2026-10-25). They draw the Season Plan's own pieces
 * (SeasonPlan.jsx): the roadmap controls, the advance bar, the slot panel
 * (a sheet on a phone, a drawer beside the page otherwise) with its ranked
 * pencil and intention editor, and the episodes in no slot. Only the cards
 * and their layout are the page's.
 *
 *   Roadmap     Grid (three part columns of cards), Timeline (every slot in
 *               order) or This week (the next two or three releases, each
 *               with its stage, what it still needs, its event and Moves;
 *               SeasonWeek, 2026-10-25); All Parts / All Statuses; + Add
 *               Episode (the new-episode flow). `?view=`, `?part=`, `?status=`
 *               hold them; the view is also remembered per browser.
 *               No Calendar view; each card shows its release day from the
 *               show's release schedule (Evoni, 2026-10-25) when there is one.
 *   Events      the event library (EventLibrary, from Producer Mode, 2026-10-25)
 *               under In this season · Not placed yet · All (`?show=`):
 *               the slots' events in slot order, the events in no slot, each
 *               pencilled from here, or every event; the placement preview.
 *   Each slot card and event row with an event says which goals it moves
 *   ("Moves: <goal>", GoalCoverage's MovesChips; Evoni, 2026-10-25).
 * The Production Plan tab (each placed episode's steps and checklist count)
 * gave way to the Episodes tab, the production board itself (2026-10-25).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutGrid, ListOrdered, Plus, MoreHorizontal, CalendarDays, CalendarClock } from 'lucide-react';
import { useRoadmapControls, AdvanceBar, SlotSide, UnslottedEpisodes } from './SeasonPlan';
import { SeasonPlacement } from './SeasonSetup';
import { StatusChip } from './SeasonPageParts';
import { MovesChips } from './GoalCoverage';
import { useGoalCoverage, slotGoalsMap } from '../../lib/goalCoverage';
import { useReleaseSchedule, slotWhen } from '../../lib/releaseSchedule';
import {
  SLOT_STATUS, SLOT_STATUS_ORDER, allSlots, filterSlots, slotPicture, slotCardTitle, arcPart, partProgress, dayLabel,
} from '../../lib/seasonPage';
import { EVENT_SHOWS, EVENT_SHOW_STORAGE_KEY, eventShowFrom, isEventShow, seasonEventViews } from '../../lib/eventLibrary';
import EventLibrary from './EventLibrary';
import SeasonWeek from './SeasonWeek';
import { packageHref } from '../../lib/eventFlow';

// The roadmap's view, remembered per browser (the URL's ?view= wins); storage can be blocked.
export const ROADMAP_VIEW_STORAGE_KEY = 'szn-roadmap-view';
const ROADMAP_VIEWS = ['grid', 'timeline', 'week'];
function rememberedView() {
  try { return window.localStorage.getItem(ROADMAP_VIEW_STORAGE_KEY); } catch (err) { console.warn('[SeasonRoadmap] view not read:', err?.message); return null; }
}
function rememberView(value) {
  try { window.localStorage.setItem(ROADMAP_VIEW_STORAGE_KEY, value); } catch (err) { console.warn('[SeasonRoadmap] view not saved:', err?.message); }
}
/** The view to show: the URL's, else the remembered one, else Grid. */
export const roadmapViewFrom = (urlView, remembered) => (ROADMAP_VIEWS.includes(urlView) ? urlView : ROADMAP_VIEWS.includes(remembered) ? remembered : 'grid');

/** The roadmap's controls and its slot drawer, wired the way the Season Plan wires them. */
function useSlotDrawer({ plan, api, showId, setToast }) {
  return useRoadmapControls({ roadmap: plan.roadmap, api, showId, onChanged: plan.loadRoadmap, setToast });
}

function SlotDrawer({ controls, plan, S, api, showId, setToast, episodes, events, readOnly = false }) {
  return (
    <div className="szn-drawer">
      <SlotSide controls={controls} roadmap={plan.roadmap} S={S} api={api} showId={showId} onChanged={plan.loadRoadmap} setToast={setToast}
        threads={plan.threadData.threads} episodes={episodes} events={events} needs={plan.needs.data?.needs || []} onNeedsChanged={plan.loadNeeds}
        readOnly={readOnly} />
    </div>
  );
}

/** A slot card's ⋯ menu: its panel, its episode or event package, its intention. */
function CardMenu({ slot, showId, onOpen, onIntention, readOnly = false }) {
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
  const editable = !readOnly && (slot.intention_editable ?? !slot.locked);
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
          {/* ?from= keeps the way back to this slot on the Roadmap (2026-10-25). */}
          {!slot.episode && slot.event && <Link role="menuitem" to={packageHref(showId, slot.event.id, { kind: 'roadmap', slot: slot.slot_number })}>Open the event package</Link>}
        </div>
      )}
    </div>
  );
}

/**
 * One slot as a card: picture, E#, its release day (the show's release
 * schedule, or a hand-set date), title, status chip, the goals its event
 * moves, ⋯. Clicking opens its panel.
 */
export function SlotCard({ slot, picture, showId, selected, onOpen, onIntention, nextSlot, moves = [], when = null, readOnly = false }) {
  return (
    <div className={`szn-slot is-${slot.state}${selected ? ' is-selected' : ''}`} data-testid={`szn-slot-${slot.slot_number}`}>
      <button type="button" className="szn-slot-open" onClick={onOpen} aria-pressed={selected}
        aria-label={`E${slot.slot_number}: ${slotCardTitle(slot)}, ${SLOT_STATUS[slot.state] || SLOT_STATUS.needs_event}`}>
        <span className={`szn-slot-pic is-part-${slot.phase}`} aria-hidden="true">
          {picture && <img src={picture} alt="" loading="lazy" />}
        </span>
        <span className="szn-slot-body">
          <span className="szn-slot-num">E{slot.slot_number}{nextSlot && <span className="szn-slot-next">Next</span>}
            {when && <span className={`szn-slot-when${when.source === 'preview' ? ' is-preview' : ''}`} data-testid={`szn-slot-when-${slot.slot_number}`}>{when.text}</span>}
          </span>
          <span className={`szn-slot-title${slot.episode || slot.event || slot.intention?.story_purpose ? '' : ' is-empty'}`}>{slotCardTitle(slot)}</span>
          <StatusChip state={slot.state} />
          <MovesChips goals={moves} testId={`szn-slot-moves-${slot.slot_number}`} />
        </span>
      </button>
      <CardMenu slot={slot} showId={showId} onOpen={onOpen} onIntention={onIntention} readOnly={readOnly} />
    </div>
  );
}

export function SeasonRoadmapTab({ plan, S, api, showId, setToast, episodes, events, arc, params, goTab, setParams, readOnly = false }) {
  const navigate = useNavigate();
  const controls = useSlotDrawer({ plan, api, showId, setToast });
  const { roadmap } = plan;
  const coverage = useGoalCoverage({ api, showId, reloadKey: roadmap });
  const release = useReleaseSchedule({ api, showId, reloadKey: roadmap });
  // ?slot=N (a "Needs attention" row, 2026-10-25) opens that slot's panel once, then leaves the address.
  const slotParam = params.get('slot');
  useEffect(() => {
    if (!slotParam || !roadmap) return;
    const target = allSlots(roadmap).find((sl) => String(sl.slot_number) === String(slotParam));
    if (target) controls.open(target);
    setParams?.((prev) => { const next = new URLSearchParams(prev); next.delete('slot'); return next; }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotParam, roadmap]);
  const movesBySlot = slotGoalsMap(coverage.data);
  const urlView = params.get('view');
  const view = roadmapViewFrom(urlView, rememberedView());
  useEffect(() => { if (ROADMAP_VIEWS.includes(urlView)) rememberView(urlView); }, [urlView]);
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
      onOpen={() => openSlot(slot)} onIntention={() => editIntention(slot)} moves={movesBySlot[slot.id] || []} when={slotWhen(release.view, slot, roadmap.season_number)} readOnly={readOnly} />
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
              <button type="button" aria-pressed={view === 'week'} className={view === 'week' ? 'is-on' : ''} onClick={() => setFilter({ view: 'week' })} data-testid="szn-view-week">
                <CalendarClock size={16} aria-hidden="true" /> This week
              </button>
            </div>
            {/* This week picks its own slots: the part and status filters are the grid's and the timeline's. */}
            {view !== 'week' && (<>
            <select className="szn-select" aria-label="Part" value={part} onChange={(e) => setFilter({ part: e.target.value })} data-testid="szn-filter-part">
              <option value="all">All Parts</option>
              {phases.map((p) => <option key={p.phase} value={String(p.phase)}>Part {p.phase}: {p.title}</option>)}
            </select>
            <select className="szn-select" aria-label="Status" value={status} onChange={(e) => setFilter({ status: e.target.value })} data-testid="szn-filter-status">
              <option value="all">All Statuses</option>
              {SLOT_STATUS_ORDER.map((k) => <option key={k} value={k}>{SLOT_STATUS[k]}</option>)}
            </select>
            </>)}
            {!readOnly && <button type="button" className="szn-btn" onClick={newEpisode} data-testid="szn-add-episode"><Plus size={16} aria-hidden="true" /> Add Episode</button>}
          </div>
        </header>

        {/* A past season (the switcher) is read here: no advance, pencil, placement or new episode. */}
        {readOnly ? (
          <p className="szn-note is-past" data-testid="szn-roadmap-readonly">A past season: its slots are shown as they were. Pencilling, placing and advancing happen in the season in progress.</p>
        ) : (
          /* Advancing stays with the roadmap (the Season Plan's own bar and confirm step). */
          <AdvanceBar roadmap={roadmap} S={S} onAdvance={plan.handleAdvance} advancing={plan.advancing} advanceWarning={plan.warning}
            onConfirmAdvance={plan.handleConfirmAdvance} onCancelAdvance={() => plan.setWarning(null)} advanceError={plan.advanceError} />
        )}

        {view === 'week' ? (
          <SeasonWeek roadmap={roadmap} release={release} episodes={episodes} events={events} api={api} showId={showId}
            movesBySlot={movesBySlot} onOpen={openSlot} />
        ) : view === 'grid' ? (
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
                  {!readOnly && (
                    <button type="button" className="szn-add-row" onClick={newEpisode} data-testid={`szn-add-episode-part-${phase.phase}`}>
                      <Plus size={16} aria-hidden="true" /> Add Episode to Part {phase.phase}
                    </button>
                  )}
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

        {!readOnly && <UnslottedEpisodes roadmap={roadmap} controls={controls} />}
      </div>
      <SlotDrawer controls={controls} plan={plan} S={S} api={api} showId={showId} setToast={setToast} episodes={episodes} events={events} readOnly={readOnly} />
    </div>
  );
}

/** The remembered Events filter: per browser, never required (storage can be blocked). */
function rememberedShow() {
  try { return window.localStorage.getItem(EVENT_SHOW_STORAGE_KEY); } catch (err) { console.warn('[SeasonEvents] filter not read:', err?.message); return null; }
}
function rememberShow(value) {
  try { window.localStorage.setItem(EVENT_SHOW_STORAGE_KEY, value); } catch (err) { console.warn('[SeasonEvents] filter not saved:', err?.message); }
}

/**
 * Events: the event library (EventLibrary, from Producer Mode's ?tab=events,
 * Evoni's restructure step 2, 2026-10-25) under one filter, In this season ·
 * Not placed yet · All (`?show=in-season|unplaced|all`, remembered). In this
 * season: the slots' events in slot order, each card with its slot, the
 * goals it moves and Open slot; then the events this season's other
 * episodes use. Not placed yet: the events in no slot and in no episode,
 * each with a pencil into an open slot. All: the whole library. Without a
 * season (or its roadmap) the library is shown whole.
 */
export function SeasonEventsTab({ plan, S, api, showId, setToast, episodes, events, arc, params, setParams, reloadShowData, showData = null, readOnly = false }) {
  const controls = useSlotDrawer({ plan, api, showId, setToast });
  const [placing, setPlacing] = useState(false);
  const { roadmap } = plan;
  const coverage = useGoalCoverage({ api, showId, reloadKey: roadmap });
  const movesBySlot = slotGoalsMap(coverage.data);
  const urlShow = params?.get('show') || null;
  const show = eventShowFrom(urlShow, rememberedShow());
  useEffect(() => { if (isEventShow(urlShow)) rememberShow(urlShow); }, [urlShow]);
  const views = useMemo(
    () => seasonEventViews({ roadmap, events: events || [], episodes: episodes || [], seasonNumber: arc?.season_number ?? null }),
    [roadmap, events, episodes, arc?.season_number],
  );
  // A change in the library reloads the page's events and the roadmap, so the views follow it.
  const onChanged = useCallback(() => Promise.all([reloadShowData?.(), plan.loadRoadmap?.()]), [reloadShowData, plan]);
  // The library draws the page's own events and episodes (read once, by the
  // page) instead of fetching them again; without the page's state it fetches its own.
  const libraryData = useMemo(
    () => (showData ? { events: events || [], episodes: episodes || [], loaded: showData.loaded, failed: showData.failed } : null),
    [showData, events, episodes],
  );
  const counts = { 'in-season': views.inSeason.length, unplaced: views.unplaced.length, all: views.all.length };
  const slotOf = useMemo(() => new Map(views.inSeason.map((v) => [v.id, v.slot])), [views]);
  const scope = useMemo(() => {
    if (!roadmap) return null;
    if (show === 'in-season') return { ids: views.inSeason.map((v) => v.id), ordered: true, empty: 'No event is pencilled into this season yet. Pencil one from Not placed yet, or open a slot.' };
    if (show === 'unplaced') return { ids: views.unplaced, ordered: false, empty: 'Every event is in a slot or an episode.' };
    return null;
  }, [roadmap, show, views]);
  const open = controls.openSlots.filter((s) => !s.event);
  const pick = (key) => {
    rememberShow(key);
    setParams?.((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'events');
      next.set('show', key);
      next.delete('evpage');
      return next;
    }, { replace: true });
  };

  // What each card adds in this view: its slot, the goals it moves, Open slot; or a pencil.
  const cardExtra = (ev) => {
    if (!roadmap) return null;
    if (show === 'unplaced' || (show === 'all' && !slotOf.has(ev.id) && views.pencillable.has(ev.id))) {
      // A past season's slots take no new event.
      if (readOnly) return null;
      if (!views.pencillable.has(ev.id)) return <span className="szn-muted" data-testid={`szn-event-nopencil-${ev.id}`}>{ev.status || 'draft'}: not one a slot takes</span>;
      return (
        <select className="szn-select szn-event-pencil" aria-label={`Pencil ${ev.name} into a slot`} value="" disabled={!open.length}
          data-testid={`szn-event-pencil-${ev.id}`}
          onChange={(e) => { const slot = open.find((s) => s.id === e.target.value); if (slot) controls.pencil(slot, ev.id); }}>
          <option value="">{open.length ? 'Pencil into…' : 'No open slot'}</option>
          {open.map((s) => <option key={s.id} value={s.id}>E{s.slot_number}{s.intention?.story_purpose ? ` · ${s.intention.story_purpose.slice(0, 40)}` : ''}</option>)}
        </select>
      );
    }
    const slot = slotOf.get(ev.id);
    if (!slotOf.has(ev.id)) return null;
    if (!slot) return <span className="szn-muted" data-testid={`szn-event-episode-${ev.id}`}>In an episode this season, not in a slot</span>;
    return (
      <>
        <span className="szn-event-code" data-testid={`szn-event-slot-${slot.slot_number}`}>E{slot.slot_number}</span>
        <StatusChip state={slot.state} />
        <MovesChips goals={movesBySlot[slot.id] || []} max={3} testId={`szn-event-moves-${slot.slot_number}`} />
        <button type="button" className="szn-btn is-quiet" onClick={() => controls.open(slot)} data-testid={`szn-event-open-${slot.slot_number}`}>Open slot</button>
      </>
    );
  };

  if (!roadmap) {
    return (
      <div className="szn-events" data-testid="szn-events">
        {arc && <p className="szn-muted">The roadmap did not load, so the events cannot be sorted by slot: here is the whole library.</p>}
        <EventLibrary showId={showId} onChanged={onChanged} data={libraryData} packageFrom="events" />
      </div>
    );
  }
  const slots = allSlots(roadmap);
  return (
    <div className="szn-events" data-testid="szn-events">
      <div className="szn-events-bar">
        <div className="szn-seg" role="group" aria-label="Show events" data-testid="szn-events-show">
          {EVENT_SHOWS.map((o) => (
            <button key={o.key} type="button" aria-pressed={show === o.key} className={show === o.key ? 'is-on' : ''}
              onClick={() => pick(o.key)} data-testid={`szn-events-show-${o.key}`}>
              {o.label} <span className="szn-events-count">{counts[o.key]}</span>
            </button>
          ))}
        </div>
        <span className="szn-muted" data-testid="szn-events-slots">{slots.filter((s) => s.event).length} of {slots.length} slots have an event</span>
        {!readOnly && (
          <button type="button" className="szn-btn" onClick={() => setPlacing((p) => !p)} aria-expanded={placing} data-testid="szn-events-place">
            Use events and episodes
          </button>
        )}
      </div>
      {!readOnly && placing && (
        <SeasonPlacement showId={showId} api={api} onClose={() => setPlacing(false)}
          onSaved={async (text) => { setPlacing(false); if (setToast) setToast(text); await plan.loadArc(); }} />
      )}
      {controls.slotError?.where === 'event' && <p className="szn-error" role="alert">{controls.slotError.text}</p>}
      {show === 'unplaced' && <p className="szn-muted">Open a slot to see the events ranked by how well they fit it.</p>}
      {/* An event opened from here comes back to this filter (2026-10-25). */}
      <EventLibrary showId={showId} scope={scope} cardExtra={cardExtra} onChanged={onChanged} data={libraryData} packageFrom={`events:${show}`} />
      <SlotDrawer controls={controls} plan={plan} S={S} api={api} showId={showId} setToast={setToast} episodes={episodes} events={events} readOnly={readOnly} />
    </div>
  );
}
