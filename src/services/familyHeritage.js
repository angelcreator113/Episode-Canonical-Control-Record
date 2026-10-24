'use strict';

/**
 * Heritage in the family trees (Evoni, 2026-10-24: "how can we be sure race
 * makes sense in the family trees?"; "I want them all and show me first").
 *
 * Real families include mixed heritage, adoption, step and chosen family.
 * Everything here helps Evoni notice; nothing enforces sameness, blocks a
 * save, or changes anyone's heritage on its own. Heritage is read from
 * registry_characters.heritage_tags (utils/heritageTags) with ethnicity as
 * her own wording beside it.
 *
 *   heritageReport(sequelize, { familyId, characterId })
 *     → { people, flags, intended, gaps, starter_tags }
 *     The gentle check, for blood ties only (family_kind 'blood', or
 *     is_blood_relation with no other kind; plain parent, sibling and
 *     grandparent roles, never step-, half-, adoptive, foster, god- or
 *     in-law ones). A flag is:
 *       parents     a child with tags whose known blood parents all have
 *                   tags and none shares one with them (a child who shares
 *                   with both, or either, parent is fine: mixed heritage)
 *       siblings    full siblings by blood, both with tags, sharing none
 *       grandparent a grandparent and grandchild by blood, both with tags,
 *                   sharing none, when no parent between them is known
 *     Anyone missing tags is never flagged: they are in gaps instead.
 *     "This is intended" (markIntended) keeps a flag quiet until either
 *     person's tags change.
 *   saveHeritage(sequelize, id, body)   their tags (and ethnicity, when sent)
 *   markIntended / clearIntended(sequelize, key, { by })
 *   suggestForRelative(sequelize, { characterId, role, kind })
 *     the heritage a new blood relative of this character might have, from
 *     their blood parents (mixed = the union); a suggestion for the Make
 *     them a character dialog, never saved by itself
 *   proposeFamilyHeritage(sequelize, characters)  Propose Family's prompt
 *     section and the seed notes for any suggested heritage
 *   appearanceFamilyBlock(sequelize, characterId) the appearance
 *     suggestion's family block: their heritage and their blood relatives'
 *     heritage and saved look, so relatives can look related
 */

const ties = require('./familyTies');
const { STARTER_TAGS, heritageKey, normalizeTags, tagsOf, sharedKeys } = require('../utils/heritageTags');

const SELECT = (sequelize) => sequelize.QueryTypes.SELECT;
const nameSql = (alias) => `COALESCE(NULLIF(${alias}.selected_name, ''), ${alias}.display_name)`;
const bad = (status, message) => Object.assign(new Error(message), { status });

const PARENT = new Set(['mother', 'father', 'parent', 'mom', 'dad']);
const CHILD = new Set(['daughter', 'son', 'child']);
const SIBLING = new Set(['sister', 'brother', 'sibling', 'twin']);
const GRANDPARENT = new Set(['grandmother', 'grandfather', 'grandparent']);
const GRANDCHILD = new Set(['granddaughter', 'grandson', 'grandchild']);

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '?';
const keysOf = (tags) => tagsOf(tags).map(heritageKey).sort();
const sameKeys = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
const hasTags = (p) => !!p && tagsOf(p.heritage_tags).length > 0;
const heritageWords = (p) => (hasTags(p) ? tagsOf(p.heritage_tags).join(', ') : (p?.ethnicity || 'not set'));
const objOf = (v) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[familyHeritage] stored note is not JSON:', err.message);
    return null;
  }
};

/** Blood by the row: family_kind 'blood', or the older is_blood_relation with no other kind. */
function isBlood(row) {
  if (row.family_kind) return row.family_kind === 'blood';
  return row.is_blood_relation === true;
}

/**
 * What a blood tie row says, for the check: { type: 'parent', parent, child }
 * | { type: 'sibling', a, b } | { type: 'grand', grand, child } | null. Only
 * a plain role counts (no prefix, no in-law): a half-sibling or a
 * great-grandparent is family, but the check cannot say what they share.
 */
function bloodShape(row) {
  if (!isBlood(row)) return null;
  const a = String(row.character_id_a);
  const b = String(row.character_id_b);
  const read = (role, holder, other) => {
    const p = ties.roleParts(role);
    if (!p || p.pre.length || p.suffix) return null;
    if (PARENT.has(p.base)) return { type: 'parent', parent: holder, child: other };
    if (CHILD.has(p.base)) return { type: 'parent', parent: other, child: holder };
    if (SIBLING.has(p.base)) return { type: 'sibling', a: holder, b: other };
    if (GRANDPARENT.has(p.base)) return { type: 'grand', grand: holder, child: other };
    if (GRANDCHILD.has(p.base)) return { type: 'grand', grand: other, child: holder };
    return null;
  };
  return (row.family_role && read(row.family_role, a, b)) || (row.reverse_family_role && read(row.reverse_family_role, b, a)) || null;
}

/** Every live, confirmed, non-romantic family tie, with the heritage_ok note. */
async function loadTies(sequelize) {
  return sequelize.query(
    `SELECT cr.id, cr.character_id_a, cr.character_id_b, cr.family_role, cr.reverse_family_role, cr.family_kind,
            cr.is_blood_relation, cr.heritage_ok, cb.gender AS b_gender, cb.pronouns AS b_pronouns
       FROM character_relationships cr
       JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
       JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
      WHERE cr.deleted_at IS NULL AND cr.confirmed = true AND cr.is_romantic = false
        AND (cr.family_role IS NOT NULL OR cr.family_kind IS NOT NULL)
      ORDER BY cr.created_at ASC`, { type: SELECT(sequelize) });
}

async function loadPeople(sequelize, ids) {
  const list = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!list.length) return new Map();
  const rows = await sequelize.query(
    `SELECT rc.id, ${nameSql('rc')} AS name, rc.ethnicity, rc.heritage_tags, rc.portrait_url
       FROM registry_characters rc WHERE rc.id::text IN (:ids) AND rc.deleted_at IS NULL`,
    { replacements: { ids: list }, type: SELECT(sequelize) });
  return new Map(rows.map((r) => [String(r.id), { id: r.id, name: r.name, ethnicity: r.ethnicity || null, heritage_tags: tagsOf(r.heritage_tags), portrait_url: r.portrait_url || null }]));
}

/** The blood graph from tie rows: parents of each child, sibling rows, grandparent rows. */
function bloodGraph(rows) {
  const parentsOf = new Map(); // child → [{ parent, rel }]
  const siblings = [];
  const grands = [];
  for (const r of rows) {
    const s = bloodShape(r);
    if (!s) continue;
    if (s.type === 'parent') {
      if (!parentsOf.has(s.child)) parentsOf.set(s.child, []);
      if (!parentsOf.get(s.child).some((x) => x.parent === s.parent)) parentsOf.get(s.child).push({ parent: s.parent, rel: r });
    } else if (s.type === 'sibling') siblings.push({ ...s, rel: r });
    else grands.push({ ...s, rel: r });
  }
  return { parentsOf, siblings, grands };
}

/** Is this tie marked intended for the tags the two people have now? */
function intendedNow(rel, people) {
  const ok = objOf(rel.heritage_ok);
  if (!ok) return false;
  return sameKeys(ok.a_tags, keysOf(people.get(String(rel.character_id_a))?.heritage_tags))
    && sameKeys(ok.b_tags, keysOf(people.get(String(rel.character_id_b))?.heritage_tags));
}

/** All the flags, worked out from the ties and the people (intended ones marked). */
function computeFlags(rows, people) {
  const { parentsOf, siblings, grands } = bloodGraph(rows);
  const P = (id) => people.get(String(id));
  const flags = [];
  const line = (ids) => ids.map((id) => `${firstName(P(id)?.name)} — ${heritageWords(P(id))}`).join('; ');

  for (const [childId, parents] of parentsOf) {
    const child = P(childId);
    if (!hasTags(child) || !parents.length || !parents.every((x) => hasTags(P(x.parent)))) continue;
    if (parents.some((x) => sharedKeys(child.heritage_tags, P(x.parent).heritage_tags).length)) continue;
    const role = ties.familyRoleFor(parents[0].rel, childId) || 'child';
    const names = parents.map((x) => P(x.parent).name);
    const of = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    flags.push({
      key: `parents-${childId}`, type: 'parents', person_id: childId, people: [childId, ...parents.map((x) => x.parent)],
      rel_ids: parents.map((x) => x.rel.id), rels: parents.map((x) => x.rel),
      sentence: `${child.name} is ${of}'s ${role} by blood, but their heritage shares nothing: ${line([...parents.map((x) => x.parent), childId])}.`,
    });
  }
  for (const s of siblings) {
    const a = P(s.a);
    const b = P(s.b);
    if (!hasTags(a) || !hasTags(b) || sharedKeys(a.heritage_tags, b.heritage_tags).length) continue;
    const role = ties.familyRoleFor(s.rel, s.a) || 'sibling';
    flags.push({
      key: `siblings-${s.rel.id}`, type: 'siblings', person_id: s.a, people: [s.a, s.b], rel_ids: [s.rel.id], rels: [s.rel],
      sentence: `${a.name} is ${b.name}'s ${role} by blood, but their heritage shares nothing: ${line([s.a, s.b])}.`,
    });
  }
  for (const g of grands) {
    const grand = P(g.grand);
    const child = P(g.child);
    if (!hasTags(grand) || !hasTags(child) || sharedKeys(grand.heritage_tags, child.heritage_tags).length) continue;
    // A known parent between them: the parent check speaks for this line.
    const between = (parentsOf.get(g.child) || []).some((x) => (parentsOf.get(x.parent) || []).some((y) => y.parent === g.grand));
    if (between) continue;
    const role = ties.familyRoleFor(g.rel, g.grand) || 'grandparent';
    flags.push({
      key: `grand-${g.rel.id}`, type: 'grandparent', person_id: g.child, people: [g.grand, g.child], rel_ids: [g.rel.id], rels: [g.rel],
      sentence: `${grand.name} is ${child.name}'s ${role} by blood, with no parent between them in the family yet, and their heritage shares nothing: ${line([g.grand, g.child])}.`,
    });
  }
  return flags.map(({ rels, ...f }) => ({ ...f, intended: rels.every((r) => intendedNow(r, people)) }));
}

/** The characters in named families and in family ties. */
async function everyoneInFamilies(sequelize, rows) {
  const members = await sequelize.query(
    `SELECT DISTINCT fm.registry_character_id AS id FROM family_members fm
       JOIN families f ON f.id = fm.family_id AND f.deleted_at IS NULL
      WHERE fm.deleted_at IS NULL AND fm.registry_character_id IS NOT NULL`, { type: SELECT(sequelize) });
  return [...members.map((m) => String(m.id)), ...rows.flatMap((r) => [String(r.character_id_a), String(r.character_id_b)])];
}

async function familyMemberIds(sequelize, familyId) {
  const rows = await sequelize.query(
    `SELECT fm.registry_character_id AS id FROM family_members fm
       JOIN families f ON f.id = fm.family_id AND f.deleted_at IS NULL
      WHERE fm.family_id = :id AND fm.deleted_at IS NULL AND fm.registry_character_id IS NOT NULL`,
    { replacements: { id: familyId }, type: SELECT(sequelize) });
  return rows.map((r) => String(r.id));
}

/**
 * The heritage report for everyone (no scope), one named family (its
 * members and anyone tied to them), or one character (them and their
 * family: flags that name them; gaps among them and their family).
 */
async function heritageReport(sequelize, { familyId = null, characterId = null } = {}) {
  const rows = await loadTies(sequelize);
  let scope;
  if (characterId) {
    const id = String(characterId);
    const familyIds = await sequelize.query(
      `SELECT DISTINCT fm.family_id FROM family_members fm WHERE fm.deleted_at IS NULL AND fm.registry_character_id = :id`,
      { replacements: { id }, type: SELECT(sequelize) });
    const inFamilies = (await Promise.all(familyIds.map((f) => familyMemberIds(sequelize, f.family_id)))).flat();
    const tied = rows.filter((r) => String(r.character_id_a) === id || String(r.character_id_b) === id)
      .flatMap((r) => [String(r.character_id_a), String(r.character_id_b)]);
    scope = new Set([id, ...inFamilies, ...tied]);
  } else if (familyId) {
    const members = new Set(await familyMemberIds(sequelize, familyId));
    const tied = rows.filter((r) => members.has(String(r.character_id_a)) || members.has(String(r.character_id_b)))
      .flatMap((r) => [String(r.character_id_a), String(r.character_id_b)]);
    scope = new Set([...members, ...tied]);
  } else {
    scope = new Set(await everyoneInFamilies(sequelize, rows));
  }
  // The check reads the whole blood graph (a grandparent's line runs through
  // people outside the scope); the report keeps what touches the scope.
  const graphIds = rows.flatMap((r) => [String(r.character_id_a), String(r.character_id_b)]);
  const people = await loadPeople(sequelize, [...scope, ...graphIds]);
  const all = computeFlags(rows, people);
  const touches = characterId
    ? (f) => f.people.includes(String(characterId))
    : (f) => f.people.some((id) => scope.has(String(id)));
  const mine = all.filter(touches);
  const inScope = [...scope].map((id) => people.get(id)).filter(Boolean);
  return {
    people: inScope,
    flags: mine.filter((f) => !f.intended),
    intended: mine.filter((f) => f.intended),
    gaps: inScope.filter((p) => !hasTags(p)).sort((x, y) => String(x.name).localeCompare(String(y.name))),
    starter_tags: STARTER_TAGS,
  };
}

/** Their heritage tags (and ethnicity, when sent). Returns the person. */
async function saveHeritage(sequelize, id, body = {}) {
  const tags = normalizeTags(body.heritage_tags);
  const ethnicitySent = body.ethnicity !== undefined;
  const ethnicity = typeof body.ethnicity === 'string' && body.ethnicity.trim() ? body.ethnicity.trim().slice(0, 150) : null;
  const [row] = await sequelize.query(
    `UPDATE registry_characters SET heritage_tags = CAST(:tags AS jsonb),
        ethnicity = CASE WHEN :ethnicitySent THEN :ethnicity ELSE ethnicity END, updated_at = NOW()
      WHERE id = :id AND deleted_at IS NULL RETURNING id`,
    { replacements: { id, tags: tags.length ? JSON.stringify(tags) : null, ethnicitySent, ethnicity }, type: SELECT(sequelize) });
  if (!row) throw bad(404, 'Character not found');
  return (await loadPeople(sequelize, [id])).get(String(id));
}

/** The flag with this key, worked out now (so a stale key cannot mark the wrong tie). */
async function flagByKey(sequelize, key) {
  const rows = await loadTies(sequelize);
  const people = await loadPeople(sequelize, rows.flatMap((r) => [r.character_id_a, r.character_id_b]));
  const flag = computeFlags(rows, people).find((f) => f.key === key);
  if (!flag) throw bad(404, 'That heritage note is no longer there (someone\'s heritage or family may have changed).');
  return { flag, rows, people };
}

/** "This is intended": each of the flag's ties remembers the two people's tags as they are now. */
async function markIntended(sequelize, key, { by = null } = {}) {
  const { flag, rows, people } = await flagByKey(sequelize, key);
  for (const relId of flag.rel_ids) {
    const r = rows.find((x) => x.id === relId);
    const note = {
      at: new Date().toISOString(), by,
      a_tags: keysOf(people.get(String(r.character_id_a))?.heritage_tags),
      b_tags: keysOf(people.get(String(r.character_id_b))?.heritage_tags),
    };
    await sequelize.query('UPDATE character_relationships SET heritage_ok = CAST(:note AS jsonb), updated_at = NOW() WHERE id = :id',
      { replacements: { id: relId, note: JSON.stringify(note) } });
  }
  return { ...flag, intended: true };
}

async function clearIntended(sequelize, key) {
  const { flag } = await flagByKey(sequelize, key);
  await sequelize.query('UPDATE character_relationships SET heritage_ok = NULL, updated_at = NOW() WHERE id IN (:ids)',
    { replacements: { ids: flag.rel_ids } });
  return { ...flag, intended: false };
}

/**
 * The heritage a new relative might have, from their blood parents: a new
 * blood child of this character has them (and the one other parent of
 * their blood children, when there is exactly one) as parents; a new blood
 * full sibling has their blood parents (or, with none known, shares with
 * them). Mixed parents give the union. Any other role, or step, adoptive,
 * married or chosen family, gets no suggestion: they can differ.
 * Returns { heritage_tags, ethnicity, from: [{ id, name, heritage_tags, ethnicity }] } or null.
 */
async function suggestForRelative(sequelize, { characterId, role, kind } = {}) {
  const theKind = kind || ties.kindOf(role);
  if (theKind !== 'blood' || !characterId) return null;
  const p = ties.roleParts(role);
  if (!p || p.pre.length || p.suffix) return null;
  const id = String(characterId);
  const rows = await loadTies(sequelize);
  const { parentsOf } = bloodGraph(rows);
  let from = [];
  if (CHILD.has(p.base)) {
    const coParents = new Set();
    for (const [child, parents] of parentsOf) {
      if (!parents.some((x) => x.parent === id) || child === id) continue;
      parents.filter((x) => x.parent !== id).forEach((x) => coParents.add(x.parent));
    }
    from = [id, ...(coParents.size === 1 ? [...coParents] : [])];
  } else if (SIBLING.has(p.base)) {
    const parents = (parentsOf.get(id) || []).map((x) => x.parent);
    from = parents.length ? parents : [id];
  } else {
    return null;
  }
  const people = await loadPeople(sequelize, from);
  const list = from.map((x) => people.get(x)).filter(Boolean);
  const heritage_tags = normalizeTags(list.flatMap((x) => x.heritage_tags));
  const words = [...new Set(list.map((x) => (x.ethnicity || '').trim()).filter(Boolean))];
  const ethnicity = words.length ? words.join(' and ').slice(0, 150) : null;
  if (!heritage_tags.length && !ethnicity) return null;
  return { heritage_tags, ethnicity, from: list.map(({ id: pid, name, heritage_tags: t, ethnicity: e }) => ({ id: pid, name, heritage_tags: t, ethnicity: e })) };
}

const HERITAGE_RULE = 'Blood relatives share heritage with their blood parents (mixed when the parents differ); step, adoptive, married-in and chosen family can differ. Real families are often mixed. Heritage is how each person describes themselves: never pair people by stereotype or by how they look.';

/**
 * Propose Family's heritage: the prompt section (each person's tags and
 * their own wording, the rule, and how to suggest heritage for anyone not
 * set) and notesFor(bond), the seed's notes with any suggested heritage
 * added as words for Evoni to read. A suggestion is never saved to anyone.
 */
async function proposeFamilyHeritage(sequelize, characters = []) {
  const people = await loadPeople(sequelize, characters.map((c) => c.id));
  const nameOf = (c) => c.selected_name || c.display_name || people.get(String(c.id))?.name || '?';
  const lines = characters.map((c) => {
    const p = people.get(String(c.id));
    const tags = p ? tagsOf(p.heritage_tags) : [];
    const own = p?.ethnicity ? `in their words: "${p.ethnicity}"` : '';
    const words = tags.length ? `${tags.join(', ')}${own ? ` (${own})` : ''}` : own ? `no tags yet (${own})` : 'heritage not set';
    return `- ${nameOf(c)} [id=${c.id}]: ${words}`;
  });
  const unset = new Set(characters.filter((c) => !hasTags(people.get(String(c.id)))).map((c) => String(c.id)));
  const section = `
Heritage (as each person describes themselves):
${lines.join('\n')}

Heritage rule: ${HERITAGE_RULE}
- Optional on a bond: "suggested_heritage": { "<character id>": ["tag", ...] } for either person whose heritage is not set, following the rule. It is only a suggestion for Evoni; nothing is saved to anyone from it.
`;
  const notesFor = (bond) => {
    const base = typeof bond?.notes === 'string' && bond.notes.trim() ? bond.notes.trim() : null;
    const s = bond && typeof bond.suggested_heritage === 'object' && !Array.isArray(bond.suggested_heritage) ? bond.suggested_heritage : null;
    if (!s) return base;
    const words = Object.entries(s)
      .filter(([cid]) => unset.has(String(cid)) && [bond.character_a_id, bond.character_b_id].map(String).includes(String(cid)))
      .map(([cid, tags]) => [characters.find((c) => String(c.id) === String(cid)), normalizeTags(tags)])
      .filter(([c, tags]) => c && tags.length)
      .map(([c, tags]) => `${nameOf(c)}: ${tags.join(', ')}`);
    if (!words.length) return base;
    return `${base ? `${base}\n` : ''}Suggested heritage (not saved to anyone): ${words.join('; ')}.`;
  };
  return { section, notesFor };
}

const LOOK_KEYS = ['summary', 'face', 'hair', 'skin'];

/**
 * The appearance suggestion's family block: their own heritage, and each
 * blood parent, sibling, child and grandparent with their heritage and the
 * look already saved for them, so relatives by blood can look related.
 * '' when there is nothing to say. Adoptive, step, married and chosen
 * family are left out: they need not look alike.
 */
async function appearanceFamilyBlock(sequelize, characterId) {
  const id = String(characterId || '');
  if (!id) return '';
  const rows = (await loadTies(sequelize)).filter((r) => String(r.character_id_a) === id || String(r.character_id_b) === id);
  const blood = rows.filter((r) => bloodShape(r));
  const others = blood.map((r) => (String(r.character_id_a) === id ? String(r.character_id_b) : String(r.character_id_a)));
  const people = await loadPeople(sequelize, [id, ...others]);
  const me = people.get(id);
  const looks = others.length ? await sequelize.query(
    `SELECT id, appearance FROM registry_characters WHERE id::text IN (:ids) AND deleted_at IS NULL`,
    { replacements: { ids: others }, type: SELECT(sequelize) }) : [];
  const lookOf = (pid) => objOf(looks.find((l) => String(l.id) === pid)?.appearance) || {};
  const relLines = blood.map((r, i) => {
    const pid = others[i];
    const p = people.get(pid);
    if (!p) return null;
    const look = lookOf(pid);
    const bits = LOOK_KEYS.filter((k) => look[k]).map((k) => `${k}: ${look[k]}`).join('; ');
    return `- ${p.name}, their ${ties.familyRoleFor(r, pid) || 'family'} by blood. Heritage: ${heritageWords(p)}.${bits ? ` Their saved look: ${bits}.` : ''}`;
  }).filter(Boolean);
  const mine = me && (hasTags(me) || me.ethnicity) ? `Their heritage, as they describe it: ${heritageWords(me)}${hasTags(me) && me.ethnicity ? ` ("${me.ethnicity}")` : ''}.` : '';
  if (!mine && !relLines.length) return '';
  return `\nFAMILY AND HERITAGE (so relatives by blood can look related):
${mine}${relLines.length ? `\n${relLines.join('\n')}` : ''}
- A blood relative can share a family resemblance with them, in their own mix; adoptive, step, married-in and chosen family need not look alike. Heritage is how a person describes themselves, not a list of features: no stereotypes.\n`;
}

module.exports = {
  heritageReport, saveHeritage, markIntended, clearIntended, suggestForRelative, proposeFamilyHeritage, appearanceFamilyBlock,
  computeFlags, bloodShape, HERITAGE_RULE,
};
