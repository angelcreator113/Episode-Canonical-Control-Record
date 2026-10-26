/**
 * The season plan on one printable page (pages/SeasonPlanPrint; Evoni,
 * 2026-10-25: "What else can we improve on the Season page?" … "I want them
 * all"; 2026-10-26, round 3): the parts and their slots with each one's
 * release day, the events with their in-world dates, the goals and the
 * release schedule. Pure: from what the Season page already reads
 * (useSeasonPlan's arc, roadmap and goals; the show's events; the release
 * schedule). The pitch is the arc's logline when there is one; a later AI
 * step writes a two-line pitch into the same spot.
 */
import { allSlots, dateRange, dayLabel, slotCardTitle, SLOT_STATUS } from './seasonPage';
import { slotWhen, scheduleSentence, startLine, seasonOf, formatDay } from './releaseSchedule';

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
      code: `E${s.slot_number}`,
      title: slotCardTitle(s),
      event: s.event ? (byId.get(s.event.id)?.name || s.event.name || null) : null,
      status: SLOT_STATUS[s.state] || null,
      when: slotWhen(release, s, seasonNumber)?.text || null,
    })),
  }));
  const slotEvents = allSlots(roadmap).filter((s) => s.event).map((s) => {
    const ev = byId.get(s.event.id) || s.event;
    return { code: `E${s.slot_number}`, name: ev.name || 'Event', date: dayLabel(ev.event_date) || (ev.event_date ? String(ev.event_date) : null), type: ev.event_type ? String(ev.event_type).replace(/_/g, ' ') : null };
  });
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
    goals: goalRows,
    releases,
    slotCount: allSlots(roadmap).length,
  };
}
