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
import { goalPerson, personLine } from './scriptRuleChecks';

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
// Only what the episode's data holds: the event package's deliverables
// (what Lala owes for the deal) and goals (canon_consequences.automation.
// relationship_goals), and the brief's forward hook. Nothing is written in.
// An item is ticked when the script mentions it: its key words (all of one
// or two, three quarters of more) appear in one beat; the first such beat
// is named. The script writer is told which beats to put them in
// (services/scriptCareerService) but writes no tag, so the words are the
// only trace.

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'her', 'his', 'their', 'your', 'about', 'post', 'piece', 'content', 'make', 'made', 'lala', 'episode', 'event']);
const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
export const keyWords = (s) => [...new Set(words(s).filter((w) => w.length >= 4 && !STOP.has(w)))];

/** The first beat (its number) whose lines mention the text, else null. */
export function mentionedIn(beats = [], text) {
  const keys = keyWords(text);
  if (!keys.length) return null;
  // One or two key words: all of them; more: three quarters, so a shared
  // name alone (the host's) does not tick a deliverable.
  const need = keys.length <= 2 ? keys.length : Math.ceil(keys.length * 0.75);
  for (const b of beats) {
    const have = new Set(words((b.lines || []).join(' ')));
    if (keys.filter((k) => have.has(k)).length >= need) return b.number;
  }
  return null;
}

// How many of the key words a line has.
const hits = (line, keys) => { const have = new Set(words(line)); return keys.filter((k) => have.has(k)).length; };

/**
 * The line that shows a covered goal, { line, as }: the one with most of
 * the goal's key words, the person's (personLine) first when two have as
 * many; `mustName`, only lines where the person is. The first such
 * (utils/scriptCoverage coveringLine, the server's copy).
 */
function coveringLine(lines, keys, person, { mustName = false } = {}) {
  let best = null;
  for (const l of lines) {
    const named = personLine([l], person);
    if (mustName && !named) continue;
    const score = hits(l, keys) + (named ? 0.5 : 0);
    if ((score > 0 || mustName) && (!best || score > best.score)) best = { score, line: l, as: named?.as || null };
  }
  return best ? { line: best.line, as: best.as } : null;
}

/**
 * Where a relationship goal is covered, { beat, as, line } or null (Evoni,
 * 2026-10-23: "Get to know Truthville" never ticked when the script named
 * her by her real name; utils/scriptCoverage goalCovered, the server's
 * copy). Covered when the goal is mentioned as written, or when the rest
 * of its words are and the person (goalPerson) is there by any of their
 * names or speaks. `line` is the beat's line that shows it, `as` the name
 * the person goes by in it (null when the goal is there as written and
 * they are not named in that line).
 */
export function goalMatch(beats = [], goal, person) {
  const label = String(goal?.label || '').trim();
  const keys = keyWords(label);
  // A brand's goal as written needs the brand named in that beat: "studio"
  // with the rest of the goal is not Studio by Sable.
  const linesAt = (n) => beats.find((b) => b.number === n)?.lines || [];
  const first = mentionedIn(beats, label);
  const literal = first !== null && (!person?.whole || personLine(linesAt(first), person)) ? first : null;
  if (literal !== null) {
    const shown = coveringLine(linesAt(literal), keys, person);
    return { beat: literal, as: shown?.as || null, line: shown?.line || null };
  }
  if (!person?.names?.length) return null;
  const own = new Set(person.names.flatMap(words));
  const rest = keys.filter((k) => !own.has(k));
  const need = rest.length <= 2 ? rest.length : Math.ceil(rest.length * 0.75);
  for (const b of beats) {
    const lines = b.lines || [];
    if (hits(lines.join(' '), rest) < need || !personLine(lines, person)) continue;
    const shown = coveringLine(lines, keys, person, { mustName: true });
    return { beat: b.number, as: shown.as, line: shown.line };
  }
  return null;
}

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
 * [{ key, label, source, beat }] in the order: goals, follow-ups carried
 * from an earlier episode (`carried`: the to-do list's goal tasks with a
 * follow_up_id), beat 14's opportunity, the brief's hook. beat
 * is the number of the beat that mentions it, or null. What she owes is not
 * on the list: deliverables are not always shown in the show (Evoni,
 * 2026-10-18; beat 12 is The Fashion Challenge). `deliverables` is kept in
 * the call for its callers and read no more. A goal also has its slot, and
 * when its person is there under another name, `who`: the name the goal
 * gives them and `as`, the one the script uses ("Truthville", "Marcus
 * Hale"). A covered goal has `line`, the beat's line that covers it, and
 * `mark`, the name in it to emphasise (quoteParts). `profiles`: the
 * event's people's social profiles, by id (goalPerson).
 */
export function mustCover({ beats = [], event = null, brief = null, opportunity = null, profiles = [], carried = [] } = {}) {
  const items = [];
  relationshipGoalsOf(event).forEach((g, n) => {
    const label = String(g.label).trim();
    const person = goalPerson(g, event, profiles);
    const m = goalMatch(beats, g, person);
    // The name the goal gives them: the one of theirs in its words.
    const inLabel = new Set(words(label));
    const named = person ? person.shown.find((s) => words(s).length && words(s).every((w) => inLabel.has(w))) || person.name : null;
    items.push({
      key: `goal-${n}`, label, source: 'Goal', slot: g.slot || 'relationship', beat: m ? m.beat : null,
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
    items.push({ key: `carried-${t.follow_up_id}`, label, source: 'Follow-up', slot: t.slot, beat: m ? m.beat : null });
  });
  // Beat 14's opportunity (Evoni, 2026-10-19), when one is attached and it
  // comes (the caller passes null when the episode is designed to fail or the
  // offer expired). Ticked only when beat 14 has a [UI:DM …] or [UI:NOTIFY …]
  // line naming it; a mention in another beat is not the invitation (Script
  // page audit, 2026-10-19; lib/beat14Invitation).
  const opp = typeof opportunity?.name === 'string' ? opportunity.name.trim() : '';
  if (opp) items.push({ key: 'opportunity', label: opp, source: 'Opportunity', beat: beat14Delivers(beats, opp) ? BEAT : null });
  const hook = typeof brief?.forward_hook === 'string' ? brief.forward_hook.trim() : '';
  if (hook) items.push({ key: 'hook', label: hook, source: 'Forward hook' });
  return items.map((i) => ('beat' in i ? i : { ...i, beat: mentionedIn(beats, i.label) }));
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
