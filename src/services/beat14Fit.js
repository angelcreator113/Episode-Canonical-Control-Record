'use strict';

/**
 * How well an open opportunity fits the episode's event, for beat 14's
 * picker (Evoni, 2026-10-25: "Yes build the weekly release and beat 14
 * ranking"). Kept light, inside the beat 14 flow: no new tables, no AI.
 *
 * A candidate scores for each of:
 *   brand    the same company or brand as the event's host or a guest
 *   type     its opportunity_type suits the event's format, name, category
 *            or event_type (EVENT_TYPE_FIT, below)
 *   goal     it moves an active career goal nothing placed in the season
 *            moves yet (seasonGoalCoverage), or is linked to one by
 *            career_goal_id
 *   prestige within one point of the event's prestige
 * Each scoring part gives one reason chip. The best scores get "Best fit";
 * candidates with no reason keep their order (newest first) below.
 *
 * draftSuggestion builds "Suggest one": a new opportunity from someone at
 * the event, prefilled into beat 14's create form; nothing is saved here.
 *
 * Pure; no I/O. beat14Opportunity reads the context (contextFor there).
 */

// The host's brand counts more than a guest's: the host is whose event it is.
const WEIGHT = { hostBrand: 5, guestBrand: 4, goal: 4, format: 3, category: 2, prestige: 1 };
// A candidate is a "Best fit" only with at least one strong reason (a
// brand, a goal, or a type that suits the event's format plus prestige).
const BEST_MIN = 4;

const TYPE_LABEL = {
  modeling: 'Modeling', runway: 'Runway', editorial: 'Editorial', campaign: 'Campaign', ambassador: 'Ambassador',
  brand_deal: 'Brand deal', podcast: 'Podcast', interview: 'Interview', panel: 'Panel', award_show: 'Award show',
  pr_gifting: 'PR gifting', casting_call: 'Casting call',
};

// Which opportunity types suit an event, by its format (world_events.format,
// models/WorldEvent FORMAT_VALUES). The first type is what "Suggest one"
// drafts when no goal prefers another.
const FORMAT_FIT = {
  showcase: ['runway', 'modeling'],
  photoshoot: ['editorial', 'modeling', 'campaign'],
  panel: ['panel', 'interview', 'podcast'],
  masterclass: ['panel', 'interview'],
  workshop: ['panel', 'interview'],
  brand_launch: ['brand_deal', 'campaign', 'ambassador', 'pr_gifting'],
  pop_up: ['brand_deal', 'pr_gifting', 'campaign'],
  preview: ['editorial', 'campaign', 'pr_gifting'],
  gala: ['award_show', 'ambassador', 'interview'],
  premiere: ['interview', 'award_show', 'ambassador'],
  competition: ['casting_call', 'award_show'],
  concert: ['interview', 'podcast'],
  performance: ['interview', 'podcast'],
  gallery_opening: ['editorial', 'ambassador'],
  cocktail_party: ['brand_deal', 'ambassador'],
  dinner: ['brand_deal', 'ambassador'],
  garden_soiree: ['brand_deal', 'pr_gifting'],
  brunch: ['brand_deal', 'pr_gifting'],
  tasting: ['brand_deal', 'pr_gifting'],
  retreat: ['ambassador', 'brand_deal'],
  workout_class: ['ambassador', 'brand_deal'],
  run_club: ['ambassador', 'brand_deal'],
  meetup: ['podcast', 'interview'],
};

// Words in the event's name that say what kind of event it is, when its
// format does not ("Nova Prime Fashion Week Runway" with no format).
const NAME_FIT = [
  { word: /\brunway\b/i, label: 'runway event', types: ['runway', 'modeling'] },
  { word: /\bfashion week\b/i, label: 'fashion week', types: ['runway', 'modeling', 'editorial'] },
  { word: /\b(photo ?shoot|shoot)\b/i, label: 'shoot', types: ['editorial', 'modeling', 'campaign'] },
  { word: /\bcasting\b/i, label: 'casting', types: ['casting_call', 'modeling'] },
  { word: /\b(awards?|gala)\b/i, label: 'awards night', types: ['award_show', 'ambassador'] },
  { word: /\b(panel|summit|talk)\b/i, label: 'talk', types: ['panel', 'interview', 'podcast'] },
  { word: /\blaunch\b/i, label: 'launch', types: ['brand_deal', 'campaign', 'ambassador'] },
];

// By the event's category (world_events.category), a weaker match.
const CATEGORY_FIT = {
  fashion: ['runway', 'modeling', 'editorial', 'campaign'],
  beauty_wellness: ['campaign', 'brand_deal', 'pr_gifting'],
  creator_brand: ['brand_deal', 'ambassador', 'campaign'],
  luxury_prestige: ['ambassador', 'editorial', 'award_show'],
  arts_entertainment: ['interview', 'podcast', 'award_show', 'panel'],
  social: ['brand_deal', 'pr_gifting'],
  brunch_dining: ['brand_deal', 'pr_gifting'],
  fitness: ['ambassador', 'brand_deal'],
  community_local: ['panel', 'brand_deal'],
  travel_destination: ['campaign', 'ambassador'],
};

// And by event_type, for a deal event.
const EVENT_TYPE_FIT = { brand_deal: ['brand_deal', 'campaign', 'ambassador'] };

// The types an uncovered goal prefers, when "Suggest one" picks a type.
const GOAL_TYPES = {
  coins: ['brand_deal', 'campaign'],
  followers: ['campaign', 'ambassador'],
  reputation: ['editorial', 'runway', 'award_show'],
  influence: ['ambassador', 'podcast'],
  brand_trust: ['ambassador', 'brand_deal'],
  engagement_rate: ['campaign', 'podcast'],
  portfolio_strength: ['editorial', 'modeling'],
};

// What "Suggest one" calls it: "<brand> <noun>".
const TYPE_NOUN = {
  modeling: 'modeling booking', runway: 'runway booking', editorial: 'editorial shoot', campaign: 'campaign shoot',
  ambassador: 'ambassadorship', brand_deal: 'brand deal', podcast: 'podcast guest spot', interview: 'interview',
  panel: 'panel seat', award_show: 'award show invitation', pr_gifting: 'PR package', casting_call: 'casting call',
};

const human = (v) => String(v || '').replace(/_/g, ' ');
const key = (v) => String(v || '').trim().toLowerCase();
const num = (v) => (v == null || v === '' ? null : Number(v));

/**
 * What the event suits, strongest first: [{ kind: 'format'|'category',
 * label, types }]. Format, then words in its name, then category, then
 * event_type.
 */
function eventKinds(event) {
  if (!event) return [];
  const out = [];
  if (FORMAT_FIT[event.format]) out.push({ kind: 'format', label: human(event.format), types: FORMAT_FIT[event.format] });
  for (const n of NAME_FIT) {
    if (n.word.test(String(event.name || ''))) { out.push({ kind: 'format', label: n.label, types: n.types }); break; }
  }
  if (CATEGORY_FIT[event.category]) out.push({ kind: 'category', label: `${human(event.category)} event`, types: CATEGORY_FIT[event.category] });
  if (EVENT_TYPE_FIT[event.event_type]) out.push({ kind: 'category', label: `${human(event.event_type)} event`, types: EVENT_TYPE_FIT[event.event_type] });
  return out;
}

/** Every type the event suits, in order, once each. */
function typesForEvent(event) {
  return [...new Set(eventKinds(event).flatMap((k) => k.types))];
}

/**
 * Whether the opportunity moves the goal: linked by career_goal_id, or by
 * what it carries — coins by a payment, reputation by prestige above hers,
 * followers by its social boost. A goal to reduce stress only by the link.
 */
function oppMovesGoal(opp, goal, state = {}) {
  if (!opp || !goal) return false;
  if (opp.career_goal_id && String(opp.career_goal_id) === String(goal.id)) return true;
  const metric = goal.target_metric;
  if (metric === 'coins') return (Number(opp.payment_amount) || 0) > 0;
  if (metric === 'reputation') return (Number(opp.prestige) || 0) > (Number(state.reputation) || 0);
  if (metric === 'followers') return (Number(opp.social_boost) || 0) > 0;
  return false;
}

/** The company or brand the opportunity is with, matched against the event's people. */
function brandMatch(opp, brands) {
  for (const b of brands || []) {
    const sameCompany = opp.company_id && b.company_id && String(opp.company_id) === String(b.company_id);
    const sameName = !opp.company_id && key(opp.brand_or_company) && key(opp.brand_or_company) === key(b.name);
    if (sameCompany || sameName) return b;
  }
  return null;
}

/**
 * The fit of one candidate: { score, reasons: [{ kind, text }] }.
 * ctx: { event, brands: [{ company_id, name, role, person }], goals (the
 * uncovered ones), state (Lala's stats) }.
 */
function scoreCandidate(opp, ctx = {}) {
  const reasons = [];
  let score = 0;
  const { event = null, brands = [], goals = [], state = {} } = ctx;
  if (!opp) return { score, reasons };

  const b = brandMatch(opp, brands);
  if (b) {
    score += b.role === 'host' ? WEIGHT.hostBrand : WEIGHT.guestBrand;
    reasons.push({ kind: 'brand', text: b.role === 'host' ? 'Same brand as the host' : `Same brand as a guest${b.person ? `, ${b.person}` : ''}` });
  }

  const kind = eventKinds(event).find((k) => k.types.includes(opp.opportunity_type));
  if (kind) {
    score += WEIGHT[kind.kind];
    reasons.push({ kind: 'type', text: `${TYPE_LABEL[opp.opportunity_type] || human(opp.opportunity_type)} suits a ${kind.label}` });
  }

  const goal = (goals || []).find((g) => oppMovesGoal(opp, g, state));
  if (goal) {
    score += WEIGHT.goal;
    reasons.push({ kind: 'goal', text: `Moves ${goal.title}` });
  }

  const p = num(opp.prestige);
  const ep = num(event?.prestige);
  if (p != null && ep != null && Number.isFinite(p) && Number.isFinite(ep) && Math.abs(p - ep) <= 1) {
    score += WEIGHT.prestige;
    reasons.push({ kind: 'prestige', text: p === ep ? `Prestige ${p}, as the event's` : `Prestige ${p}, near the event's ${ep}` });
  }
  return { score, reasons };
}

/**
 * The candidates in order of fit, each with fit: { score, reasons, best }.
 * Those with a reason first, best score first (ties keep their order);
 * the rest after, as they came. `best` on the top score when it reaches
 * BEST_MIN.
 */
function rankCandidates(candidates, ctx = {}) {
  const scored = (candidates || []).map((c, i) => ({ c, i, fit: scoreCandidate(c, ctx) }));
  const top = scored.reduce((m, s) => Math.max(m, s.fit.score), 0);
  return scored
    .sort((a, b) => (b.fit.score - a.fit.score) || (a.i - b.i))
    .map(({ c, fit }) => ({ ...c, fit: { ...fit, best: top >= BEST_MIN && fit.score === top } }));
}

const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

/**
 * "Suggest one": a draft opportunity from `person` (someone at the event),
 * { name, opportunity_type, pitch, connector_profile_id }, or null with no
 * event or nobody to offer it. `brand` is the person's company name if
 * known; `goal` an uncovered goal it should move.
 */
function draftSuggestion({ event, person, brand = null, goal = null } = {}) {
  if (!event || !person) return null;
  const eventTypes = typesForEvent(event);
  const goalTypes = GOAL_TYPES[goal?.target_metric] || [];
  const type = eventTypes.find((t) => goalTypes.includes(t)) || eventTypes[0] || goalTypes[0] || 'brand_deal';
  const company = String(brand || (person.role === 'host' ? event.host_brand : '') || '').trim() || null;
  const by = company || person.name;
  const noun = TYPE_NOUN[type] || human(type);
  const name = `${by} ${noun}`.slice(0, 255);
  const at = person.role === 'host' ? `hosted ${event.name}` : `was at ${event.name}`;
  const pitch = [
    `${person.name} ${at} and wants Lala for ${article(noun)} ${noun}${company && company !== person.name ? ` with ${company}` : ''}.`,
    goal ? `Done well, it moves ${goal.title}.` : null,
  ].filter(Boolean).join(' ');
  return { name, opportunity_type: type, pitch, connector_profile_id: person.profile_id, brand: company };
}

module.exports = {
  WEIGHT, BEST_MIN, FORMAT_FIT, NAME_FIT, CATEGORY_FIT, EVENT_TYPE_FIT, GOAL_TYPES, TYPE_NOUN,
  eventKinds, typesForEvent, oppMovesGoal, scoreCandidate, rankCandidates, draftSuggestion,
};
