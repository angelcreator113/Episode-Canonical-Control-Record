/**
 * The season plan on one printable page (pages/SeasonPlanPrint; Evoni,
 * 2026-10-25: "What else can we improve on the Season page?" … "I want them
 * all"; 2026-10-26, round 3): the parts and their slots with each one's
 * release day, the events with their in-world dates, the goals and the
 * release schedule. Pure: from what the Season page already reads
 * (useSeasonPlan's arc, roadmap and goals; the show's events; the release
 * schedule), and the season's bonus episodes and specials on their own days
 * (seasonSpecials, 2026-10-26). The pitch is the arc's logline when there is one; a later AI
 * step writes a two-line pitch into the same spot.
 */
import { allSlots, dateRange, dayLabel, slotCardTitle, SLOT_STATUS } from './seasonPage';
import { slotWhen, scheduleSentence, startLine, seasonOf, formatDay, formatTime } from './releaseSchedule';

const GOAL_STATUS = { active: 'Active', paused: 'Paused', completed: 'Complete', failed: 'Missed', upcoming: 'Planned' };

export function seasonPlanSheet({ arc = null, roadmap = null, events = [], goals = [], release = null } = {}) {
  const seasonNumber = roadmap?.season_number ?? arc?.season_number ?? 1;
  const byId = new Map((events || []).map((e) => [e.id, e]));
  const parts = (roadmap?.phases || []).map((p) => ({
    phase: Number(p.phase),
    title: p.title || null,
    tagline: p.tagline || null,
    range: `E${p.episode_start} – E${p.episode_end}`,
    slots: [...(p.slots || [])].sort((a, b) => a.slot_number - b.slot_number).map((s) => ({
      code: s.two_part ? s.two_part.label : `E${s.slot_number}`,
      title: slotCardTitle(s),
      event: s.event ? (byId.get(s.event.id)?.name || s.event.name || null) : null,
      status: SLOT_STATUS[s.state] || null,
      when: slotWhen(release, s, seasonNumber)?.text || null,
    })),
  }));
  const eventRow = (code, e) => {
    const ev = byId.get(e.id) || e;
    return { code, name: ev.name || 'Event', date: dayLabel(ev.event_date) || (ev.event_date ? String(ev.event_date) : null), type: ev.event_type ? String(ev.event_type).replace(/_/g, ' ') : null };
  };
  // A two-parter's event is listed once, at Part 1.
  const seen = new Set();
  const slotEvents = allSlots(roadmap).filter((s) => s.event && !seen.has(s.event.id) && seen.add(s.event.id))
    .map((s) => eventRow(s.two_part ? `E${s.slot_number}–E${s.two_part.other_slot_number}` : `E${s.slot_number}`, s.event));
  // Bonus episodes and specials (seasonSpecials), marked as specials, in season order.
  const specials = (roadmap?.specials || []).map((sp) => {
    const row = (release?.specials || []).find((r) => r.special_id === sp.id) || null;
    const date = row?.date || sp.release?.date || null;
    return {
      id: sp.id,
      code: sp.label,
      kind: sp.kind === 'bonus' ? 'Bonus episode' : 'Stand-alone special',
      title: sp.title || 'Untitled',
      place: sp.kind === 'special' ? sp.place || null : null,
      event: sp.event ? (byId.get(sp.event.id)?.name || sp.event.name || null) : null,
      status: SLOT_STATUS[sp.state] || null,
      when: date ? `${formatDay(date)}${row?.time ? ` · ${formatTime(row.time)}` : ''}` : null,
    };
  });
  for (const sp of (roadmap?.specials || []).filter((x) => x.event)) slotEvents.push(eventRow(sp.label, sp.event));
  const goalRows = (goals || []).filter((g) => g.status !== 'archived').map((g) => ({
    id: g.id, title: `${g.icon ? `${g.icon} ` : ''}${g.title}`, status: GOAL_STATUS[g.status] || g.status || null,
    progress: g.target_value != null ? `${g.current_value ?? 0} of ${g.target_value}` : null,
  }));
  const mine = seasonOf(release, seasonNumber);
  const releases = release?.schedule ? {
    line: scheduleSentence(release.schedule),
    start: mine?.first_release ? `Season ${seasonNumber} starts releasing ${formatDay(mine.first_release)}` : startLine(release),
  } : null;
  return {
    eyebrow: `Season ${seasonNumber}`,
    title: arc?.title || `Season ${seasonNumber}`,
    tagline: arc?.tagline || null,
    dates: dateRange(arc?.starts_on, arc?.ends_on),
    pitch: arc?.logline || null,
    parts,
    events: slotEvents,
    specials,
    goals: goalRows,
    releases,
    slotCount: allSlots(roadmap).length,
  };
}
