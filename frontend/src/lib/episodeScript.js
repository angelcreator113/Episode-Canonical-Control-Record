/**
 * The Script page's "What the script will use" (Evoni's Episode mock,
 * 2026-10-05): what generation reads, each lavender when it is there or
 * amber when the script will fill the gap and flag it. Pure; reads the
 * brief (GET /episode-brief/:id) and the source event's planning items
 * (utils/episodePlanning.js).
 *
 * Look is the outfit locked on the Wardrobe tab (GET /wardrobe/outfit/
 * :episodeId), the one the script writer reads (services/
 * episodeScriptWriterService, "LOCKED OUTFIT"); it read the event's
 * planned look, so a locked outfit still said "not chosen" (Evoni,
 * 2026-10-08). A look planned in the event but not locked is amber: the
 * script does not use it until it is locked.
 *
 * Career is the source event's deal, what Lala owes for it (its
 * deliverables, GET /world/:showId/events/:eventId/deliverables) and her
 * goals there; the script writer pins each to its beats
 * (services/scriptCareerService, "LALA'S CAREER IN THIS EPISODE"; Evoni,
 * 2026-10-09: "in the script i dont see career opportunities").
 */
import { briefState } from './episodeOverview';
import { dealLabelFor, relationshipGoalsOf } from '../utils/eventTerms';
import { describeEventOrganizer } from '../utils/eventOrganizer';
import { beatSpeakers } from './scriptMoments';
import { beat14Delivers, BEAT } from './beat14Invitation';
import { goalPerson } from './scriptRuleChecks';
import { words, goalMatch, hookCovered, coverKey, withMark } from './coverMatch';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The Career row: the deal and who pays it, the deliverables owed, the
 * goals. `deliverables` is null while unread or unreadable.
 */
export function careerInput(event, deliverables) {
  if (!event) return { detail: 'no source event', ok: false };
  const to = event.show_id && event.id ? `/shows/${event.show_id}/events/${event.id}` : null;
  const label = dealLabelFor(event);
  const payer = event.host_brand || event.host || null;
  const parts = [];
  if (label) parts.push(payer && label !== 'Self-funded' ? `${label} from ${payer}` : label);
  else if (event.is_paid && event.payment_amount > 0) parts.push(`paid ${event.payment_amount} coins`);
  if (deliverables?.length) parts.push(`${plural(deliverables.length, 'deliverable')} owed`);
  const goals = relationshipGoalsOf(event).length;
  if (goals) parts.push(plural(goals, 'goal'));
  if (!parts.length) return { detail: 'no deal, deliverables or goals on the event', ok: false, fix: 'event', to };
  if (deliverables === null) parts.push('deliverables could not be read');
  return { detail: parts.join(' · '), ok: true };
}

/** The Look row: the locked outfit, else what is planned, else nothing. `outfit` is null while unread or unreadable. */
export function lookInput(outfit, planned) {
  if (Array.isArray(outfit) && outfit.length > 0) {
    const names = outfit.map((p) => p?.name).filter(Boolean);
    const shown = names.slice(0, 3).join(', ');
    const more = names.length > 3 ? ` +${names.length - 3}` : '';
    return { detail: `${plural(outfit.length, 'piece')} locked${shown ? `: ${shown}${more}` : ''}`, ok: true };
  }
  if (outfit === null) return { detail: 'the locked outfit could not be read', ok: false };
  if (planned?.done) return { detail: 'planned in the event, not locked on the Wardrobe tab yet', ok: false };
  return { detail: 'not locked on the Wardrobe tab yet', ok: false };
}

export function scriptInputs({ brief = null, plan = null, outfit = [], event = null, deliverables = [] } = {}) {
  const b = briefState(brief);
  const item = (key) => plan?.items?.find((i) => i.key === key) || null;
  const planned = item('event');
  const place = item('location');
  const stakes = item('stakes');
  const cast = item('cast');
  const look = item('look');
  return [
    {
      key: 'brief', label: 'Brief',
      detail: !b ? 'not read yet' : (b.complete ? 'archetype, intent, purpose, hook' : `missing ${b.missing.map((m) => m.label.toLowerCase()).join(', ')}`),
      ok: !!b?.complete,
    },
    { key: 'event', label: 'Event', detail: planned ? planned.detail.split(' · ')[0] : 'no source event', ok: !!planned },
    { key: 'place', label: 'Place', detail: place ? place.detail.split(' · ')[0] : 'no venue', ok: !!place && place.detail !== 'No venue' },
    { key: 'stakes', label: 'Stakes', detail: stakes?.done ? stakes.detail : 'not set', ok: !!stakes?.done },
    { key: 'cast', label: 'Cast', detail: cast?.done ? cast.detail : 'full guest list (none featured)', ok: !!cast?.done },
    { key: 'look', label: 'Look', ...lookInput(outfit, look), fix: 'wardrobe' },
    { key: 'career', label: 'Career', ...careerInput(event, deliverables) },
  ];
}

// ─── "THIS EPISODE MUST COVER" (Task #2884) ─────────────────────────────────
//
// Only what the episode's data holds: the event package's goals
// (canon_consequences.automation.relationship_goals), follow-ups carried
// from an earlier episode, beat 14's opportunity and the brief's forward
// hook. Nothing is written in. The matching is lib/coverMatch's, the same
// code as the writer's coverage check (src/utils/coverMatch.js): a goal by
// its verb phrase and its person, outside the to-do list, in the latest
// beat that does it; the hook in beat 14 only; and Evoni's own mark wins
// (Script tab audit 6, 2026-10-24: "smarter matching + manual override").

export { keyWords, mentionedIn, goalMatch, coverKey } from './coverMatch';

/**
 * A covered goal's line as the tab quotes it (Evoni, 2026-10-23): { before,
 * mark, after }, Markdown bold let go, at most `max` characters around the
 * name it was matched by (`mark`, emphasised; none when it is not in the
 * line as written), with an ellipsis where it is cut. Null for no line.
 */
export function quoteParts(line, mark = null, max = 140) {
  const text = String(line ?? '').replace(/\*\*|__/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const at = mark ? text.toLowerCase().indexOf(String(mark).toLowerCase()) : -1;
  const len = at >= 0 ? String(mark).length : 0;
  let start = 0;
  let end = text.length;
  if (text.length > max) {
    start = at >= 0 ? Math.max(0, Math.min(at - Math.floor((max - len) / 2), text.length - max)) : 0;
    end = start + max;
  }
  const cut = (a, b) => text.slice(a, b);
  const pre = start > 0 ? '…' : '';
  const post = end < text.length ? '…' : '';
  if (at < 0) return { before: `${pre}${cut(start, end).trim()}${post}`, mark: null, after: '' };
  return { before: `${pre}${cut(start, at).replace(/^\s+/, '')}`, mark: cut(at, at + len), after: `${cut(at + len, end).replace(/\s+$/, '')}${post}` };
}

/**
 * [{ key, markKey, label, source, beat, covered }] in the order: goals,
 * follow-ups carried from an earlier episode (`carried`: the to-do list's
 * goal tasks with a follow_up_id), beat 14's opportunity, the brief's hook.
 * beat is the number of the beat that covers it (lib/coverMatch goalMatch:
 * the latest beat that does it), or null. What she owes is not on the list:
 * deliverables are not always shown in the show (Evoni, 2026-10-18; beat 12
 * is The Fashion Challenge). `deliverables` is kept in the call for its
 * callers and read no more. A goal also has its slot, and when its person
 * is there under another name, `who`: the name the goal gives them and
 * `as`, the one the script uses ("Truthville", "Marcus Hale"). A covered
 * goal has `line`, the beat's line that covers it, and `mark`, the name in
 * it to emphasise (quoteParts). `profiles`: the event's people's social
 * profiles, by id (goalPerson). `marks`: her manual marks
 * (episode_briefs.event_metadata.cover_marks, by markKey, lib/coverMatch
 * withMark): one marked covered or not covered is so whatever the words
 * say, with `marked` set.
 */
export function mustCover({ beats = [], event = null, brief = null, opportunity = null, profiles = [], carried = [], marks = null } = {}) {
  const items = [];
  relationshipGoalsOf(event).forEach((g, n) => {
    const label = String(g.label).trim();
    const person = goalPerson(g, event, profiles);
    const m = goalMatch(beats, g, person);
    // The name the goal gives them: the one of theirs in its words.
    const inLabel = new Set(words(label));
    const named = person ? person.shown.find((s) => words(s).length && words(s).every((w) => inLabel.has(w))) || person.name : null;
    const slot = g.slot || 'relationship';
    items.push({
      key: `goal-${n}`, markKey: coverKey('goal', { slot, label }), label, source: 'Goal', slot, beat: m ? m.beat : null,
      // The line that covers it, and the name to emphasise in it: the one
      // the person goes by there, else the goal's own name for them.
      ...(m?.line ? { line: m.line, mark: m.as || named || null } : {}),
      ...(m?.as && words(m.as).join(' ') !== words(named).join(' ') ? { who: { name: named, as: m.as } } : {}),
    });
  });
  // What Lala owes from an earlier episode (Evoni, 2026-10-23): Start
  // Episode's goal tasks carried from a follow-up (follow_up_id;
  // services/storyCarryForward), matched like a goal.
  (Array.isArray(carried) ? carried : []).forEach((t) => {
    const label = String(t?.label || '').trim();
    if (!label || !t.follow_up_id) return;
    const m = goalMatch(beats, t, goalPerson(t, event, profiles));
    items.push({ key: `carried-${t.follow_up_id}`, markKey: coverKey('carried', t), label, source: 'Follow-up', slot: t.slot, beat: m ? m.beat : null });
  });
  // Beat 14's opportunity (Evoni, 2026-10-19), when one is attached and it
  // comes (the caller passes null when the episode is designed to fail or the
  // offer expired). Ticked only when beat 14 has a [UI:DM …] or [UI:NOTIFY …]
  // line naming it; a mention in another beat is not the invitation (Script
  // page audit, 2026-10-19; lib/beat14Invitation).
  const opp = typeof opportunity?.name === 'string' ? opportunity.name.trim() : '';
  if (opp) items.push({ key: 'opportunity', markKey: coverKey('opportunity'), label: opp, source: 'Opportunity', beat: beat14Delivers(beats, opp) ? BEAT : null });
  // The hook: told in beat 14, or through the invitation beat 14 delivers.
  const hook = typeof brief?.forward_hook === 'string' ? brief.forward_hook.trim() : '';
  if (hook) items.push({ key: 'hook', markKey: coverKey('hook'), label: hook, source: 'Forward hook', beat: hookCovered(beats, hook, opp || null) });
  return items.map((i) => withMark(i, marks));
}

/**
 * The to-do list's task for a covered goal (Script tab audit 6, 2026-10-24:
 * it matched on the exact label, so a label tidied since lost its task):
 * by slot and the label's words, else the only task in that slot, else the
 * follow-up's own id. Null when there is none.
 */
export function goalTaskFor(tasks, item) {
  const list = (Array.isArray(tasks) ? tasks : []).filter(Boolean);
  if (!item) return null;
  const slot = item.slot || 'relationship';
  const said = words(item.label).join(' ');
  const inSlot = list.filter((t) => (t.slot || 'relationship') === slot);
  return inSlot.find((t) => words(t.label).join(' ') === said)
    || (inSlot.length === 1 ? inSlot[0] : null)
    || (item.key?.startsWith('carried-') ? list.find((t) => `carried-${t.follow_up_id}` === item.key) || null : null);
}

/**
 * Who a Notification or DM can be from or with (Task #2885): the episode's
 * own people. The event's host, its guests (featured first), then everyone
 * who speaks in the script, each named once. Nothing is made up: an episode
 * with no event and no speakers has nobody to offer, and the name is typed.
 */
export function scriptPeople({ event = null, sourceProfile = null, beats = [] } = {}) {
  const out = [];
  const add = (name) => {
    const n = typeof name === 'string' ? name.trim() : '';
    if (n && !out.some((o) => o.toLowerCase() === n.toLowerCase())) out.push(n);
  };
  if (event) {
    add(describeEventOrganizer(event, sourceProfile).name);
    const guests = (event.canon_consequences?.automation?.guest_profiles || []).filter(Boolean);
    [...guests.filter((g) => g.featured), ...guests.filter((g) => !g.featured)].forEach((g) => add(g.display_name || g.handle));
  }
  for (const b of beats) beatSpeakers(b?.lines || []).forEach((who) => { if (who !== 'Lala') add(who); });
  return out;
}
