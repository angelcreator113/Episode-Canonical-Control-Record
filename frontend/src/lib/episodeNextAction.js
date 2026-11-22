/**
 * An episode's production checklist at a glance, and the next action it
 * points to. Moved here unchanged from components/Show/ShowOverview (which
 * still exports both), so a page can use them without importing Producer
 * Mode's Overview.
 */
import { nextStep } from './episodeOverview';
import { hasScript } from './episodeScriptFacts';
import { CHECKLIST_SECTIONS, computeSectionState, checklistFixTarget } from '../components/Episodes/EpisodeProductionChecklist';

/** The checklist's sections that report a state (a section may still set unavailableReason). */
const LIVE_SECTIONS = CHECKLIST_SECTIONS.filter((sec) => !sec.unavailableReason);

/**
 * The checklist at a glance: items done of all items, and each section's
 * state with a short label: "Complete", "Not started" when nothing in it is
 * done, else its required items done ("0 of 1" while only optional items
 * are), or all its items for a section with none required. first_missing is
 * the first required item still open (for the card's fix link).
 */
export function checklistSummary(checks) {
  const items = LIVE_SECTIONS.flatMap((sec) => sec.items);
  const done = items.filter((item) => checks[item.id]).length;
  const sections = LIVE_SECTIONS.map((sec) => {
    const { state } = computeSectionState(sec, checks);
    const required = sec.items.filter((item) => item.required);
    const counted = required.length ? required : sec.items;
    const n = counted.filter((item) => checks[item.id]).length;
    const label = state === 'complete' ? 'Complete' : state === 'needs_setup' ? 'Not started' : `${n} of ${counted.length}`;
    const firstMissing = (required.length ? required : sec.items).find((item) => !checks[item.id]) || null;
    return { id: sec.id, title: sec.label, state, label, first_missing: firstMissing?.id || null };
  });
  return { done, total: items.length, sections };
}

/**
 * The card's primary action, from what is already known: the next step the
 * Episode Overview would name (lib/episodeOverview nextStep) and, while
 * production is under way, the first checklist section still open. An
 * episode that is not in production, or whose checks have not answered,
 * gets the plain "Open Episode".
 * { label, href, why }.
 */
export function primaryAction({ episode, showId, summary = null, producing = true }) {
  const base = `/episodes/${episode.id}`;
  const open = { key: 'open', label: 'Open Episode', href: `${base}?tab=overview`, why: null };
  if (!producing) return open;
  if (!hasScript(episode)) {
    const step = nextStep({ hasScript: false });
    return { key: step.key, label: step.action, href: `${base}?tab=${step.tab}`, why: 'This episode has no script yet.' };
  }
  if (!summary) return open;
  const step = nextStep({ hasScript: true, checks: { done: summary.done, total: summary.total } });
  if (step.key === 'results') return { key: step.key, label: step.action, href: `${base}?tab=${step.tab}`, why: step.why };
  const sec = summary.sections.find((x) => x.state !== 'complete') || null;
  if (!sec) return { key: step.key, label: 'Open Checklist', href: `${base}?tab=checklist`, why: step.why };
  const target = sec.first_missing ? checklistFixTarget(sec.first_missing, { episode, showId }) : null;
  return { key: step.key, section: sec.id, label: `Continue: ${sec.title}`, href: target?.href || `${base}?tab=checklist`, why: step.why };
}
