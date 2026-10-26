/**
 * What is waiting on the Season page (Evoni, 2026-10-25: "What else can we
 * improve on the Season page?" … "I want them all"): the Overview's "Needs
 * attention" list, the counts on the tabs, the Episodes and Results tabs
 * kept to this season, and the stat cards' Next release. Pure helpers over
 * what the page already reads: the roadmap and arc (useSeasonPlan), the
 * show's episodes and events, the goal coverage (GET .../season/goal-coverage),
 * the release schedule (GET .../release-schedule) and the opportunities
 * (GET /opportunities/:showId). Nothing is fetched here.
 *
 * An item is { key, kind, rank, sort, title, detail, tone, link } where
 * link is { tab, extra } (a Season page tab) or { href } (another page);
 * a lower rank is more urgent: a release that is overdue or due within
 * three days first, then what blocks the part in progress, then what is
 * waiting further out.
 */
import { allSlots } from './seasonPage';
import { seasonContextOf } from './episodePipeline';
import { seasonEventViews } from './eventLibrary';
import { computeEventPackageReadiness, computeEventState, describeMissing } from '../utils/eventReadinessSections';
import { readiness } from './releaseBoard';
import { dueRows, formatDay, episodeNumberOf, formatRelease } from './releaseSchedule';
import { isCompletedEpisode, heldEpisodeName } from '../components/Show/OpportunityBeat14';
import { coveredGoalIds } from './goalCoverage';

/** How many rows the list shows before "+N more". */
export const ATTENTION_CAP = 6;

const RANK = {
  overdue: 0,
  release_soon: 1,
  held_stuck: 2,
  slots_now: 3,
  events_setup: 4,
  goal_gap_now: 5,
  slots_next: 6,
  goal_gap_later: 7,
  held_waiting: 8,
};

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (items, max = 3) => (items.length > max ? `${items.slice(0, max).join(', ')} +${items.length - max} more` : items.join(', '));

// ── This season's episodes ────────────────────────────────────────────────

/**
 * Whether an episode is in the season shown: in one of its roadmap slots,
 * else snapshotted to its arc (season_context.arc_id), else its season
 * number (season_context's, else the episode's own, else Season 1) is the
 * season's. A snapshot of another arc is another season.
 */
export function episodeInSeason(ep, { arc = null, roadmap = null, slotted = null } = {}) {
  if (!ep) return false;
  const inSlot = slotted || new Set(allSlots(roadmap).map((s) => s.episode?.id).filter(Boolean));
  if (inSlot.has(ep.id)) return true;
  const sc = seasonContextOf(ep);
  if (sc?.arc_id && arc?.id) return sc.arc_id === arc.id;
  const season = Number(sc?.season_number ?? ep.season_number ?? 1) || 1;
  return season === (Number(arc?.season_number ?? roadmap?.season_number ?? 1) || 1);
}

/** The episodes of the season shown; every episode when there is no season. */
export function seasonEpisodes(episodes = [], { arc = null, roadmap = null } = {}) {
  if (!arc && !roadmap) return episodes || [];
  const slotted = new Set(allSlots(roadmap).map((s) => s.episode?.id).filter(Boolean));
  return (episodes || []).filter((ep) => episodeInSeason(ep, { arc, roadmap, slotted }));
}

/** `?seasons=all` on the Episodes and Results tabs: every season's episodes. */
export const ALL_SEASONS_PARAM = 'seasons';
export const showsAllSeasons = (params) => params?.get?.(ALL_SEASONS_PARAM) === 'all';

// ── The sources ───────────────────────────────────────────────────────────

/** The events in this season still needing setup (the Events tab's "Still needed"), soonest slot first. */
export function eventsNeedingSetup({ roadmap = null, events = [], episodes = [] } = {}) {
  const views = seasonEventViews({ roadmap, events, episodes, seasonNumber: roadmap?.season_number ?? null });
  const byId = new Map(events.map((e) => [e.id, e]));
  return views.inSeason.flatMap(({ id, slot }) => {
    const ev = byId.get(id) || allSlots(roadmap).find((s) => s.event?.id === id)?.event;
    if (!ev) return [];
    const ready = computeEventPackageReadiness(ev);
    const state = computeEventState(ev, ready);
    if (state !== 'needs_setup' && state !== 'needs_organizer') return [];
    const missing = describeMissing(ready.blocking);
    return [{ event: ev, slot, state, missing: missing.length ? missing : ['Organizer'] }];
  });
}

/**
 * Each part from the one in progress on with a goal nothing moves: [{ phase,
 * title, gaps, current }]. Only goals being worked on of a stat events move
 * count (goal ladders, Evoni 2026-10-25: the badge read 36): the server
 * names only those, and a coverage that marks each goal's `covered` is
 * filtered by it too.
 */
export function goalGaps(coverage, { arc = null } = {}) {
  const now = Number(arc?.current_phase) || 1;
  const covered = coveredGoalIds(coverage);
  return (coverage?.parts || [])
    .map((p) => ({ ...p, gaps: (p.gaps || []).filter((g) => !covered || covered.has(String(g.goal_id))) }))
    .filter((p) => p.gaps.length && Number(p.phase) >= now)
    .map((p) => ({ ...p, current: Number(p.phase) === now }));
}

/** The season's empty slots (no event, no episode) in the part in progress and the next one. */
export function emptySlotsSoon(roadmap, { arc = null } = {}) {
  const now = Number(arc?.current_phase ?? roadmap?.arc?.current_phase) || 1;
  const open = allSlots(roadmap).filter((s) => !s.locked && !s.episode && !s.event);
  const partTitle = (n) => (roadmap?.phases || []).find((p) => Number(p.phase) === n)?.title || null;
  return [now, now + 1]
    .map((phase) => ({ phase, title: partTitle(phase), current: phase === now, slots: open.filter((s) => Number(s.phase) === phase) }))
    .filter((p) => p.slots.length);
}

/** The opportunities held for an episode's beat 14, the stuck ones (episode completed, never settled) first. */
export function heldOpportunities(opps = []) {
  return (opps || []).filter((o) => o.status === 'held')
    .map((o) => ({ opp: o, stuck: isCompletedEpisode(o.beat14_episode) }))
    .sort((a, b) => Number(b.stuck) - Number(a.stuck));
}

/** The release rows of the season due within three days or overdue, each with what its episode still needs. */
export function releaseDeadlines(view, { seasonNumber = null, episodes = [] } = {}) {
  const byId = new Map((episodes || []).map((e) => [e.id, e]));
  return dueRows(view, seasonNumber).map((row) => {
    const ep = byId.get(row.episode_id) || null;
    // The feed posts are not loaded here, so the line leaves them out.
    const missing = ep ? readiness(ep, null, row).filter((r) => r.state !== 'ready' && r.key !== 'schedule' && r.key !== 'feed').map((r) => r.label.toLowerCase()) : null;
    return { row, episode: ep, missing };
  });
}

// ── The list ──────────────────────────────────────────────────────────────

const inDays = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

/**
 * Every item waiting, ranked. `isCurrent` false (a past season, from the
 * switcher) leaves out what only the season in progress can act on: goal
 * gaps, empty slots and held opportunities.
 */
export function attentionItems({
  showId, arc = null, roadmap = null, events = [], episodes = [], coverage = null, release = null, opps = [], isCurrent = true,
} = {}) {
  const items = [];
  const seasonNumber = roadmap?.season_number ?? arc?.season_number ?? null;
  const releaseHref = `/shows/${encodeURIComponent(showId)}/world?tab=release`;

  for (const { row, missing } of releaseDeadlines(release, { seasonNumber, episodes })) {
    const n = episodeNumberOf(row);
    const who = `Episode ${n ?? '?'}`;
    const needs = missing == null ? '' : missing.length ? ` and still needs: ${missing.join(', ')}` : ' and has everything it needs';
    const overdue = row.due === 'overdue';
    const stillNeeds = missing?.length ? ` It still needs: ${missing.join(', ')}.` : '';
    items.push({
      key: `release-${row.episode_id}`, kind: 'release', rank: overdue ? RANK.overdue : RANK.release_soon, sort: row.days_until ?? 0,
      tone: overdue ? 'overdue' : 'soon',
      title: overdue ? `${who} was due ${formatRelease(row)} and is not released yet.${stillNeeds}` : `${who} releases ${inDays(row.days_until)}${needs}.`,
      detail: row.title || null,
      link: { href: releaseHref },
    });
  }

  if (isCurrent) {
    for (const { opp, stuck } of heldOpportunities(opps)) {
      items.push({
        key: `held-${opp.id}`, kind: 'held', rank: stuck ? RANK.held_stuck : RANK.held_waiting, sort: 0, tone: stuck ? 'soon' : 'calm',
        title: stuck ? `${opp.name}: ${heldEpisodeName(opp)} is completed but it was never settled.` : `${opp.name} is held for ${heldEpisodeName(opp)}'s beat 14.`,
        detail: stuck ? 'Release the offer or schedule it as an event.' : 'Offered if the episode lands, gone if it fails.',
        link: { tab: 'opportunities' },
      });
    }
    for (const part of emptySlotsSoon(roadmap, { arc })) {
      const first = part.slots[0];
      items.push({
        key: `slots-${part.phase}`, kind: 'slots', rank: part.current ? RANK.slots_now : RANK.slots_next, sort: first.slot_number, tone: part.current ? 'soon' : 'calm',
        title: `Part ${part.phase}${part.title ? ` · ${part.title}` : ''}: ${plural(part.slots.length, 'slot')} with no event yet.`,
        detail: list(part.slots.map((s) => `E${s.slot_number}`), 4),
        link: { tab: 'roadmap', extra: { slot: first.slot_number } },
      });
    }
    for (const part of goalGaps(coverage, { arc })) {
      items.push({
        key: `gap-${part.phase}`, kind: 'goals', rank: part.current ? RANK.goal_gap_now : RANK.goal_gap_later, sort: part.phase, tone: part.current ? 'soon' : 'calm',
        title: `Part ${part.phase}${part.title ? ` · ${part.title}` : ''}: nothing moves ${list(part.gaps.map((g) => g.title), 2)}.`,
        detail: 'Find an event that moves it on the Goals tab.',
        link: { tab: 'goals' },
      });
    }
  }

  const setup = eventsNeedingSetup({ roadmap, events, episodes });
  const eventLine = (x) => `${x.event.name}${x.slot ? ` (${x.slot.code || `E${x.slot.slot_number}`})` : ''}`;
  if (setup.length > 2) {
    items.push({
      key: 'events-setup', kind: 'events', rank: RANK.events_setup, sort: setup[0].slot?.slot_number ?? 99, tone: 'calm',
      title: `${plural(setup.length, 'event')} in this season still ${setup.length === 1 ? 'needs' : 'need'} setup.`,
      detail: `Soonest: ${eventLine(setup[0])} · ${setup[0].missing.join(', ')}`,
      link: { tab: 'events', extra: { show: 'in-season' } },
    });
  } else {
    for (const x of setup) {
      items.push({
        key: `event-${x.event.id}`, kind: 'events', rank: RANK.events_setup, sort: x.slot?.slot_number ?? 99, tone: 'calm',
        title: `${eventLine(x)} still needs setup.`,
        detail: `Still needed: ${x.missing.join(', ')}`,
        link: { href: `/shows/${encodeURIComponent(showId)}/events/${encodeURIComponent(x.event.id)}` },
      });
    }
  }

  return items.sort((a, b) => a.rank - b.rank || a.sort - b.sort);
}

/** The rows shown and how many more there are. */
export function capAttention(items, cap = ATTENTION_CAP) {
  return { shown: items.slice(0, cap), more: Math.max(0, items.length - cap) };
}

// ── The tab counts ────────────────────────────────────────────────────────

const WEEKDAY = (iso) => formatDay(iso)?.split(',')[0] || null;
const WEEKDAY_LONG = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };

/**
 * The tab badges, from the same sources: { [tabKey]: { count, text, tone } },
 * only where the count is above zero. text is the wide wording ("17 need
 * setup", "1 due Sunday"); on a phone the badge shows the number alone.
 */
export function tabBadges({ arc = null, roadmap = null, events = [], episodes = [], coverage = null, release = null, opps = [], isCurrent = true } = {}) {
  const out = {};
  const setup = eventsNeedingSetup({ roadmap, events, episodes }).length;
  if (setup) out.events = { count: setup, text: `${setup} need${setup === 1 ? 's' : ''} setup`, tone: 'calm' };
  if (isCurrent) {
    // Each goal once, however many parts it is missing from.
    const gaps = new Set(goalGaps(coverage, { arc }).flatMap((p) => p.gaps.map((g) => String(g.goal_id ?? g.title)))).size;
    if (gaps) out.goals = { count: gaps, text: plural(gaps, 'gap'), tone: 'calm' };
    const held = heldOpportunities(opps).length;
    if (held) out.opportunities = { count: held, text: `${held} held`, tone: 'calm' };
  }
  const due = dueRows(release, roadmap?.season_number ?? arc?.season_number ?? null);
  if (due.length) {
    const overdue = due.filter((r) => r.due === 'overdue').length;
    const day = WEEKDAY(due[0].date);
    const text = overdue ? `${overdue} overdue` : due.length === 1 ? `1 due ${due[0].days_until === 0 ? 'today' : WEEKDAY_LONG[day] || day}` : `${due.length} due soon`;
    out.episodes = { count: due.length, text, tone: overdue ? 'overdue' : 'soon' };
  }
  return out;
}
