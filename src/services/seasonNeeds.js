'use strict';

/**
 * The relationships the season needs (Evoni, 2026-10-24, planner PR 3:
 * "relationships the season needs, and the planner reads more").
 *
 * Each twist (its plant or payoff slot and its people), each open thread and
 * each slot's story purpose depends on relationships between people. This
 * finds those pairs, the slot each is needed by, and whether the story has
 * it: there (confirmed, with its stage and tension), seed only (an
 * unconfirmed seed, kept idea or Later) or missing.
 *
 *   getNeeds(sequelize, showId, { arcId }) { arc, needs, counts }; arcId: another season's (?season=N)
 *   seasonCharacters(sequelize, showId)    the show's registry characters and the
 *                                          Relationships page's cast, with names
 *   seasonRelationshipBlock(sequelize, showId, { cap })
 *                                          the confirmed pairs between them as prompt
 *                                          text for the season planners; ''
 *   slotNotes(sequelize, showId, slotId)   { twists: { plant, payoff }, reveals } for the slot panel; null when
 *                                          the slot is not the show's
 *   seasonKnows(sequelize, showId)         { record, follow_ups }: what the planners read of the story so far
 *   nameMatcher(characters)                (text) => the ids it names; pure
 *   needsFrom({ ... }) / classify(...)     pure, for the tests
 *
 * People in a purpose or a thread are found by their names, not by an AI
 * call: the purposes and threads Evoni writes name the people ("Lala and
 * Marcus fall out at the launch"), a read on every Season Plan load should
 * cost nothing and give the same answer twice, and a pair the matcher
 * misses ("her mentor") is still found from a twist's own people.
 *
 * A need with a company in it (a registry character marked as a company,
 * services/companyCharacters; Evoni, 2026-10-24) is there when the show has
 * a deal with the company (opportunities.company_id; a deal names no
 * character, so any of the show's deals with it), when the other side is
 * one of its representatives (extra_fields.brand_id or representative_of,
 * as services/brandProfile reads them), or when a confirmed relationship
 * joins them. Its row says company, and how it is there (there_by).
 *
 * Reads only. The Season Plan's arc and slots come from the slot service
 * (getRoadmap) and the twists' own read (seasonTwists.getTwists).
 */

const truth = require('./relationshipTruth');
const { usableFirstName } = require('../utils/firstNames');

const WHY_MAX = 140;
const MAX_NEEDS = 80;
const MAX_PAIRS_PER_SOURCE = 6;
const PLANNER_CAP = 25;

const pairKey = (a, b) => [String(a), String(b)].sort().join('|');
const clip = (v, n) => {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Who a text names: each character's full name, any case, and their first
 * name when it is at least three letters, nobody else has it, and it is not
 * an article, title or connector ("The" of "The Column", "Dr", "de";
 * utils/firstNames). A first name alone counts only written as in the name,
 * capitalised: "Marcus's" names Marcus, "marcus" and "the" name nobody
 * (Evoni, 2026-10-24: every "the" in her purposes named The Column).
 * Whole words only. Returns ids in the order first named.
 */
function nameMatcher(characters) {
  const people = (characters || []).filter((c) => c && c.id && String(c.name || '').trim());
  const firstCount = new Map();
  for (const c of people) {
    const first = String(c.name).trim().split(/\s+/)[0].toLowerCase();
    firstCount.set(first, (firstCount.get(first) || 0) + 1);
  }
  const wordRe = (names, flags) => new RegExp(`(^|[^\\p{L}\\p{N}])(${names.map(escapeRe).join('|')})(?=$|[^\\p{L}\\p{N}])`, flags);
  const patterns = people.map((c) => {
    const full = String(c.name).trim();
    const first = usableFirstName(full);
    const res = [wordRe([full], 'iu')];
    if (first && firstCount.get(first.toLowerCase()) === 1) res.push(wordRe([first], 'u'));
    return { id: String(c.id), res };
  });
  return (text) => {
    const s = String(text || '');
    if (!s.trim()) return [];
    return patterns
      .map((p) => {
        const at = p.res.map((re) => re.exec(s)).filter(Boolean).map((m) => m.index);
        return at.length ? { id: p.id, at: Math.min(...at) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.at - b.at)
      .map((m) => m.id)
      .filter((id, i, all) => all.indexOf(id) === i);
  };
}

/** Every pair among ids, in order, at most MAX_PAIRS_PER_SOURCE. */
function pairsOf(ids) {
  const list = [...new Set(ids.map(String))];
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) out.push([list[i], list[j]]);
  }
  return out.slice(0, MAX_PAIRS_PER_SOURCE);
}

const slotRef = (s) => (s ? { id: s.id, slot_number: s.slot_number, label: s.label } : null);
const whyFor = (slot, what) => clip(slot ? `Needed by E${slot.slot_number}: ${what}` : `Needed for ${what}`, WHY_MAX);

/**
 * The pairs the season depends on, before they are looked up. Pure.
 *   slots     the roadmap's slots ({ id, slot_number, label, state, intention.story_purposes })
 *   twists    getTwists' twists (status, character_ids, plant, payoff)
 *   threads   the show's threads ({ id, title, description, status })
 *   matcher   nameMatcher's
 * A twist still planned is needed by its plant slot; one planted, by its
 * payoff. A thread is needed by the first slot still to come whose purposes
 * name it, else by no slot yet. A done slot needs nothing any more.
 */
function needsFrom({ slots = [], twists = [], threads = [], matcher }) {
  const ahead = slots.filter((s) => s.state !== 'done');
  const aheadById = new Map(ahead.map((s) => [String(s.id), s]));
  const out = [];
  const seen = new Set();
  const add = (source, pairs, slot) => {
    for (const [a, b] of pairs) {
      const key = `${source.kind}:${source.id}:${pairKey(a, b)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, kind: source.kind, source_id: source.id, title: source.title, a, b, slot: slotRef(slot), seed_why: whyFor(slot, source.title) });
    }
  };

  for (const t of twists) {
    if (!['planned', 'planted'].includes(t.status)) continue;
    const people = (t.character_ids || []).map(String);
    if (people.length < 2) continue;
    const at = t.status === 'planned' ? t.plant : t.payoff;
    const slot = at ? aheadById.get(String(at.id)) : null;
    if (at && !slot) continue;
    add({ kind: 'twist', id: t.id, title: clip(t.title, 120) }, pairsOf(people), slot || null);
  }

  for (const th of threads) {
    if (th.status === 'closed') continue;
    const people = matcher(`${th.title || ''}\n${th.description || ''}`);
    if (people.length < 2) continue;
    const slot = ahead.find((s) => (s.intention?.story_purposes || []).some((p) => String(p.story_thread?.id || '') === String(th.id))) || null;
    add({ kind: 'thread', id: th.id, title: clip(th.title, 120) }, pairsOf(people), slot);
  }

  for (const s of ahead) {
    (s.intention?.story_purposes || []).forEach((p, i) => {
      const people = matcher(p.text);
      if (people.length < 2) return;
      add({ kind: 'purpose', id: `${s.id}:${i}`, title: clip(p.text, 120) }, pairsOf(people), s);
    });
  }
  return out.slice(0, MAX_NEEDS);
}

const STATE_ORDER = { missing: 0, seed: 1, there: 2 };

/**
 * Each need marked there, seed or missing from the live rows between the
 * people (relationshipsBetween, seeds included), sorted by the slot it is
 * needed by (none last), then missing first. `companies` (optional):
 * { byCharacter: Map(character id → company), deals: Map(company id →
 * { id, name }), reps: Set('<company id>|<character id>') } for the needs
 * with a company in them. Pure.
 */
function classify(needs, rows, names, companies = null) {
  const byPair = new Map();
  for (const r of rows || []) {
    const k = pairKey(r.character_id_a, r.character_id_b);
    byPair.set(k, [...(byPair.get(k) || []), r]);
  }
  const person = (id) => ({ id, name: names.get(String(id)) || '?' });
  const list = needs.map((n) => {
    const found = byPair.get(pairKey(n.a, n.b)) || [];
    const there = found.find((r) => r.confirmed);
    const seed = found.find((r) => !r.confirmed);
    let state = 'missing';
    let relationship = null;
    if (there) {
      state = 'there';
      relationship = {
        id: there.id, type: there.relationship_type, is_romantic: Boolean(there.is_romantic),
        stage: there.stage || null, tension_state: there.tension_state || null,
      };
    }
    const company = companies && (companies.byCharacter.get(String(n.a)) || companies.byCharacter.get(String(n.b)));
    let companyOut = null;
    let thereBy = there ? 'relationship' : null;
    let deal = null;
    if (company) {
      const side = companies.byCharacter.get(String(n.a))?.id === company.id ? 'a' : 'b';
      const other = side === 'a' ? n.b : n.a;
      const both = Boolean(companies.byCharacter.get(String(n.a)) && companies.byCharacter.get(String(n.b)));
      companyOut = { id: company.id, slug: company.slug, name: company.name, kind: company.kind || 'brand', side, both };
      if (!there) {
        deal = companies.deals.get(String(company.id)) || null;
        if (deal) thereBy = 'deal';
        else if (companies.reps.has(`${company.id}|${other}`)) thereBy = 'representative';
        if (thereBy) state = 'there';
      }
    }
    if (state !== 'there' && seed) {
      state = 'seed';
      relationship = { id: seed.id, type: seed.relationship_type, seed_state: seed.seed_state || null };
    }
    return {
      ...n, a: person(n.a), b: person(n.b), state, relationship,
      ...(companyOut ? { company: companyOut, there_by: thereBy, deal } : {}),
    };
  });
  list.sort((x, y) => (x.slot?.slot_number ?? Infinity) - (y.slot?.slot_number ?? Infinity)
    || STATE_ORDER[x.state] - STATE_ORDER[y.state]);
  const counts = { there: 0, seed: 0, missing: 0 };
  for (const n of list) counts[n.state] += 1;
  return { needs: list, counts };
}

/**
 * The season's people: everyone in a registry of the show, and the
 * Relationships page's cast (services/whichLala: the feed-linked people
 * and Lala) so a pair the page shows is a pair the season can name. A
 * cast name the show already has is left out (the show's own person wins).
 */
async function seasonCharacters(sequelize, showId) {
  const { showCharacters } = require('./seasonTwists');
  const own = await showCharacters(sequelize, showId);
  const out = own.map((c) => ({ id: String(c.id), name: c.name }));
  try {
    const whichLala = require('./whichLala');
    const links = await whichLala.castLinks(sequelize);
    const lala = await whichLala.findLala(sequelize, { links });
    const known = new Set(out.map((c) => c.id));
    const extra = [...new Set([...links.map((l) => String(l.id)), ...(lala ? [String(lala.id)] : [])])].filter((id) => !known.has(id));
    if (extra.length) {
      const [rows] = await sequelize.query(
        'SELECT id, COALESCE(selected_name, display_name) AS name FROM registry_characters WHERE id IN (:extra) AND deleted_at IS NULL',
        { replacements: { extra } });
      const taken = new Set(out.map((c) => String(c.name || '').trim().toLowerCase()));
      for (const r of rows) {
        const n = String(r.name || '').trim().toLowerCase();
        if (!n || taken.has(n)) continue;
        taken.add(n);
        out.push({ id: String(r.id), name: r.name });
      }
    }
  } catch (err) {
    console.error('[seasonNeeds] the Relationships cast could not be read (the show\'s people only):', err.message);
  }
  return out;
}

/**
 * The relationships the season needs: { arc, needs, counts }; no arc, no
 * needs. arcId: that season's (the Season page's switcher, 2026-10-26; the
 * caller checks it is this show's).
 */
async function getNeeds(sequelize, showId, { arcId = null } = {}) {
  const { getRoadmap } = require('./seasonSlotService');
  const { getTwists } = require('./seasonTwists');
  const roadmap = await getRoadmap(sequelize, showId, { arcId });
  if (!roadmap) return { arc: null, needs: [], counts: { there: 0, seed: 0, missing: 0 } };
  const season = await getTwists(sequelize, showId, { arcId: roadmap.arc?.id || arcId || null });
  const characters = await seasonCharacters(sequelize, showId);
  const names = new Map(characters.map((c) => [c.id, c.name]));
  const specs = needsFrom({
    slots: roadmap.phases.flatMap((p) => p.slots),
    twists: season.twists,
    threads: season.threads,
    matcher: nameMatcher(characters),
  });
  const people = [...new Set(specs.flatMap((n) => [n.a, n.b]))];
  if (people.some((id) => !names.has(id))) {
    // A twist can name someone outside the season's people (a registry since detached): named here.
    const [rows] = await sequelize.query(
      'SELECT id, COALESCE(selected_name, display_name) AS name FROM registry_characters WHERE id IN (:ids)',
      { replacements: { ids: people.filter((id) => !names.has(id)) } });
    for (const r of rows) names.set(String(r.id), r.name);
  }
  const rows = await truth.relationshipsBetween(sequelize, people, { confirmedOnly: false, limit: 500 });
  const companies = await companyFacts(sequelize, showId, people);
  return { arc: roadmap.arc, season_number: roadmap.season_number, show_id: String(showId), ...classify(specs, rows, names, companies) };
}

/**
 * What classify needs for the needs with a company in them: which of the
 * people are companies, the show's newest deal with each, and who among the
 * people represents each. null when none of them is a company.
 */
async function companyFacts(sequelize, showId, people) {
  const byCharacter = await require('./companyCharacters').companyIdsAmong(sequelize, people);
  if (!byCharacter.size) return null;
  const ids = [...new Set([...byCharacter.values()].map((c) => String(c.id)))];
  const deals = new Map();
  const reps = new Set();
  try {
    const [found] = await sequelize.query(
      `SELECT DISTINCT ON (company_id) company_id, id, name FROM opportunities
        WHERE deleted_at IS NULL AND show_id = :showId AND company_id IN (:ids)
        ORDER BY company_id, created_at DESC`, { replacements: { showId, ids } });
    for (const d of found) deals.set(String(d.company_id), { id: d.id, name: d.name });
    const [linked] = await sequelize.query(
      `SELECT id, extra_fields->>'brand_id' AS brand_id, extra_fields->>'representative_of' AS rep_of
         FROM registry_characters WHERE id IN (:people) AND deleted_at IS NULL`, { replacements: { people } });
    const companies = [...byCharacter.values()];
    for (const r of linked) {
      for (const c of companies) {
        if (String(r.brand_id || '') === String(c.id) || (r.rep_of && r.rep_of === c.slug)) reps.add(`${c.id}|${r.id}`);
      }
    }
  } catch (err) {
    console.error('[seasonNeeds] the companies\' deals and people could not be read:', err.message);
  }
  return { byCharacter, deals, reps };
}

/**
 * The confirmed relationships between the season's people, as the season's
 * AI calls read them (the slot drafter, Draft the season, the proposals,
 * Suggest twists; services/seasonAiContext): at most `cap` lines, never a
 * seed. `characters` ({ id, name }) narrows the people (Suggest twists: the
 * show's own, the ids it may use); `detail` adds each pair's situation, up
 * to that many characters. '' with none or when it cannot be read.
 */
async function seasonRelationshipBlock(sequelize, showId, { cap = PLANNER_CAP, characters = null, detail = 0 } = {}) {
  try {
    const people = (characters || await seasonCharacters(sequelize, showId)).map((c) => ({ id: String(c.id), name: c.name }));
    const names = new Map(people.map((c) => [c.id, c.name]));
    const rows = await truth.confirmedBetween(sequelize, people.map((c) => c.id), { limit: cap });
    if (!rows.length) return '';
    const situation = (r) => {
      const t = detail ? String(r.situation || r.conflict_summary || '').replace(/\s+/g, ' ').trim().slice(0, detail) : '';
      return t ? ` — ${t}` : '';
    };
    const lines = rows.slice(0, cap).map((r) => `${truth.relationshipLine(r, (id) => names.get(String(id)))}${situation(r)}`);
    return `RELATIONSHIPS BETWEEN THE SEASON'S PEOPLE (confirmed; build on them, never contradict them):\n${lines.join('\n')}\n`;
  } catch (err) {
    console.error('[seasonNeeds] the season\'s relationships could not be read:', err.message);
    return '';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What a slot plants and pays off (seasonTwists.twistsAtSlot) and hints at
 * or reveals (seasonRevealPlan.revealsAtSlot), for the Season Plan's slot
 * panel (Evoni's review, 2026-10-24, item 17). Null when the slot is not
 * the show's.
 */
async function slotNotes(sequelize, showId, slotId) {
  if (!UUID_RE.test(String(slotId || '')) || !UUID_RE.test(String(showId || ''))) return null;
  const [[slot]] = await sequelize.query(
    'SELECT id, arc_id, slot_number FROM season_slots WHERE id = :slotId AND show_id = :showId AND deleted_at IS NULL',
    { replacements: { slotId, showId } });
  if (!slot) return null;
  let twists = { plant: [], payoff: [] };
  try {
    twists = await require('./seasonTwists').twistsAtSlot(sequelize, slot);
  } catch (err) {
    console.error('[seasonNeeds] the slot\'s twists could not be read:', err.message);
  }
  const reveals = await require('./seasonRevealPlan').revealsAtSlot(sequelize, slot.id);
  return { slot_id: slot.id, slot_number: slot.slot_number, twists, reveals };
}

/**
 * What the season's AI already reads of the story so far (Evoni's review,
 * 2026-10-24, item 19): the latest approved "What changed" record and the
 * open follow-ups (services/storyCarryForward, the same reads).
 */
async function seasonKnows(sequelize, showId) {
  const carry = require('./storyCarryForward');
  const record = await carry.lastRecord(sequelize, showId);
  const followUps = await carry.openFollowUps(sequelize, showId);
  return {
    record: record ? {
      episode_number: record.episode_number, title: record.title || null, what_happened: clip(record.what_happened, 600) || null,
      relationships: record.relationships.slice(0, 6).map((r) => ({
        a_name: r.a_name || null, b_name: r.b_name || null, type: r.type || null, stage_after: r.stage_after || null, is_romantic: Boolean(r.is_romantic),
      })),
      threads: record.threads.filter((t) => t.action !== 'close').slice(0, 6).map((t) => ({ title: t.title || null, note: t.note || null })),
    } : null,
    follow_ups: followUps.slice(0, 12).map((f) => ({ id: f.id, text: f.text, due_hint: f.due_hint || null, episode_number: f.episode_number ?? null })),
  };
}

module.exports = {
  slotNotes, seasonKnows,
  WHY_MAX, PLANNER_CAP, nameMatcher, pairsOf, needsFrom, classify, seasonCharacters, getNeeds, seasonRelationshipBlock,
};
