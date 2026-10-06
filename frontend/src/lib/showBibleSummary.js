/**
 * The Show Bible's front page in the LalaVerse hub, to Evoni's mock
 * (Lalas_Social_Media_Page_3, 2026-10-06): "Always true", "Canon guard"
 * and "Decisions, newest first". Pure: ShowBibleSummary loads and renders.
 *
 *   alwaysTrue   the active entries marked always-inject: the ones every AI
 *                prompt carries (routes/franchiseBrainRoutes.js), critical
 *                first, each labelled by its Knowledge section.
 *   decisions    the active locked decisions, newest first, with what they
 *                apply to (franchise_knowledge.applies_to) as "Affects".
 *   canonItems   the show's episodes and events as the guard's canon-check
 *                items (POST /franchise-brain/guard { items }), in batches
 *                of at most 25 (services/guardItems GUARD_MAX_ITEMS).
 *   canonFindings  the guard's warnings, each on the episode or event it
 *                names, with a link to open it.
 */
import { SECTIONS, sectionOf, UNCATEGORIZED } from '../pages/showBibleSections';

export const GUARD_BATCH = 25;

const SEVERITY_RANK = { critical: 0, important: 1, context: 2 };
const words = (s) => String(s || '').replace(/[_-]+/g, ' ').trim();
const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const time = (v) => { const t = new Date(v).getTime(); return Number.isNaN(t) ? 0 : t; };

/** The label a rule card carries: its section, else its category. */
export function ruleLabel(entry) {
  const key = sectionOf(entry);
  if (key && key !== UNCATEGORIZED) {
    const section = SECTIONS.find((s) => s.key === key);
    if (section) return section.label;
  }
  return capital(words(entry?.category)) || 'Rule';
}

/** Always true: active, always-inject; critical first, then by title. */
export function alwaysTrue(entries) {
  return (entries || [])
    .filter((e) => e?.status === 'active' && e.always_inject && e.title)
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
      || String(a.title).localeCompare(String(b.title)))
    .map((e) => ({ id: e.id, label: ruleLabel(e), text: e.title, critical: e.severity === 'critical' }));
}

const appliesTo = (raw) => {
  let list = raw;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch (err) { console.error('[ShowBible] applies_to is not JSON:', err.message); list = [list]; }
  }
  return (Array.isArray(list) ? list : []).map((a) => capital(words(a))).filter(Boolean);
};

/** Decisions: active locked decisions, newest first. */
export function decisions(entries) {
  return (entries || [])
    .filter((e) => e?.status === 'active' && e.category === 'locked_decision' && e.title)
    .sort((a, b) => time(b.created_at) - time(a.created_at))
    .map((e) => {
      const t = time(e.created_at);
      return {
        id: e.id,
        when: t ? new Date(t).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null,
        text: e.title,
        affects: appliesTo(e.applies_to),
      };
    });
}

const brief = (parts) => parts.map((p) => String(p ?? '').trim()).filter(Boolean).join('\n');

/**
 * The show's episodes and events as guard items, in batches of GUARD_BATCH:
 * [[{ key, label, brief, to }]]. An item with nothing to say beyond its
 * name is still checked (its name alone can disagree with the canon).
 */
export function canonItems({ episodes, events, showId }) {
  const items = [];
  for (const ep of episodes || []) {
    if (!ep?.id) continue;
    const n = ep.episode_number;
    const label = [n != null ? `Episode ${n}` : 'Episode', ep.title].filter(Boolean).join(' · ');
    items.push({ key: `episode:${ep.id}`, label, brief: brief([label, ep.description]), to: `/episodes/${ep.id}` });
  }
  for (const ev of events || []) {
    if (!ev?.id || !ev.name) continue;
    items.push({
      key: `event:${ev.id}`,
      label: ev.name,
      brief: brief([
        `Event: ${ev.name}`,
        ev.event_type && `Type: ${words(ev.event_type)}`,
        ev.host && `Host: ${ev.host}`,
        ev.venue_name && `Venue: ${ev.venue_name}`,
        ev.theme && `Theme: ${ev.theme}`,
        ev.dress_code && `Dress code: ${ev.dress_code}`,
        ev.description,
        ev.narrative_stakes,
      ]),
      to: showId ? `/shows/${showId}/events/${ev.id}` : null,
    });
  }
  const batches = [];
  for (let i = 0; i < items.length; i += GUARD_BATCH) batches.push(items.slice(i, i + GUARD_BATCH));
  return batches;
}

/**
 * The findings from each batch's guard result: [{ key, label, to, law,
 * risk, suggestion }]. A warning naming no item it was sent is about the
 * show as a whole (label null).
 */
export function canonFindings(results) {
  const findings = [];
  for (const { items, result } of results || []) {
    if (result?.status !== 'issues') continue;
    (result.warnings || []).forEach((w, i) => {
      const item = (items || []).find((it) => it.key === w.item) || null;
      findings.push({
        key: `${item?.key || 'show'}-${findings.length}-${i}`,
        label: item?.label || null,
        to: item?.to || null,
        kind: item?.key?.split(':')[0] || null,
        law: w.law, risk: w.risk, suggestion: w.suggestion,
      });
    });
  }
  return findings;
}
