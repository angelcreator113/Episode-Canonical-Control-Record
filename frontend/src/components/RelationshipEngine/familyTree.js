/**
 * The Family tab's tree, as data (Evoni, 2026-10-23: "I want them all"):
 * people from the named families (GET /families) and the cast's family
 * ties (the page's relationships), grouped into families, each person on a
 * generation row, eldest at the top. A romantic relationship is never part
 * of it.
 *
 *   generationStep(role)            how far below the other the role's holder sits
 *   buildFamilyTrees({ families, rels, charById })
 *     → [{ key, name, rows: [[node…]…], edges: [edge…] }]
 *       node  { key, name, kind: 'character'|'profile'|'ghost', id, gen }
 *       edge  { from, to, role, kind, relId, rel }   ("from is to's role")
 */
import { cname, isFamily, isLoveInterest } from './tokens';

// As services/familyTies on the server: a base role's step, and the
// prefixes that ride along ("great-" adds a generation).
const STEP = {
  mother: -1, father: -1, parent: -1, mom: -1, dad: -1,
  daughter: 1, son: 1, child: 1,
  sister: 0, brother: 0, sibling: 0, twin: 0, cousin: 0, 'chosen family': 0,
  aunt: -1, uncle: -1, niece: 1, nephew: 1,
  grandmother: -2, grandfather: -2, grandparent: -2, granddaughter: 2, grandson: 2, grandchild: 2,
};
const PREFIX = /^(great-|great |step-|step|half-|half |adoptive |adopted |foster |chosen |god)/;
const SPOUSE = /^(ex-)?(wife|husband|spouse|partner|fianc[ée]e?|girlfriend|boyfriend)$/;

export function generationStep(role) {
  let r = String(role || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/(-| )in(-| )law$/, '');
  let greats = 0;
  for (let i = 0; i < 4 && STEP[r] === undefined; i += 1) {
    const m = r.match(PREFIX);
    if (!m || r.length === m[0].length) break;
    if (m[0].startsWith('great')) greats += 1;
    r = r.slice(m[0].length);
  }
  if (STEP[r] === undefined) return null;
  return STEP[r] === 0 ? 0 : STEP[r] + Math.sign(STEP[r]) * greats;
}

/** A family tie on the page: family, not romance, not a partner role. */
export const isFamilyTie = (r) => !!r && !isLoveInterest(r) && !SPOUSE.test(String(r.family_role || '').toLowerCase())
  && (isFamily(r) || !!r.family_kind);
const kindOfRel = (r) => r.family_kind || (r.is_blood_relation ? 'blood' : null);
export const isDashed = (kind) => kind === 'step' || kind === 'chosen';

export function buildFamilyTrees({ families = [], rels = [], charById = {} } = {}) {
  const nodes = new Map();
  const node = (key, fields) => {
    if (!nodes.has(key)) nodes.set(key, { key, gen: null, families: [], ...fields });
    return nodes.get(key);
  };
  const charKey = (id) => `c:${id}`;
  const edges = [];

  for (const f of families) {
    for (const m of f.members || []) {
      const key = m.kind === 'character' && m.registry_character_id ? charKey(m.registry_character_id)
        : m.kind === 'profile' && m.social_profile_id ? `p:${m.social_profile_id}` : `g:${m.id}`;
      const n = node(key, { name: m.name, kind: m.kind, id: m.registry_character_id || m.social_profile_id || m.id });
      n.families.push(f.id);
      if (m.generation != null && n.gen == null) n.gen = m.generation;
      if (m.role && m.role_of_character_id) {
        edges.push({ from: key, to: charKey(m.role_of_character_id), role: m.role, kind: null, relId: null, rel: null, family: f.id });
      }
    }
  }
  for (const r of rels.filter(isFamilyTie)) {
    const a = node(charKey(r.character_id_a), { name: cname(charById[r.character_id_a]) !== '?' ? cname(charById[r.character_id_a]) : (r.character_a_name || '?'), kind: 'character', id: r.character_id_a });
    const b = node(charKey(r.character_id_b), { name: cname(charById[r.character_id_b]) !== '?' ? cname(charById[r.character_id_b]) : (r.character_b_name || '?'), kind: 'character', id: r.character_id_b });
    // A member edge saying the same thing gives way to the tie (it has a kind and an Inspector).
    for (let i = edges.length - 1; i >= 0; i -= 1) {
      const e = edges[i];
      if (!e.relId && ((e.from === a.key && e.to === b.key) || (e.from === b.key && e.to === a.key))) edges.splice(i, 1);
    }
    edges.push({ from: a.key, to: b.key, role: r.family_role || null, reverse: r.reverse_family_role || null, kind: kindOfRel(r), relId: r.id, rel: r });
  }
  // A member edge to someone not in any family nor tie names a person we cannot draw.
  const drawn = edges.filter((e) => nodes.has(e.from) && nodes.has(e.to));

  // Groups: everyone joined by a tie or a family.
  const parent = new Map([...nodes.keys()].map((k) => [k, k]));
  const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  const join = (x, y) => { const a = find(x); const b = find(y); if (a !== b) parent.set(b, a); };
  drawn.forEach((e) => join(e.from, e.to));
  const byFamily = new Map();
  nodes.forEach((n) => n.families.forEach((fid) => { if (byFamily.has(fid)) join(byFamily.get(fid), n.key); else byFamily.set(fid, n.key); }));

  const groups = new Map();
  nodes.forEach((n) => {
    const root = find(n.key);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(n);
  });

  const out = [];
  groups.forEach((members, root) => {
    const keys = new Set(members.map((n) => n.key));
    const gEdges = drawn.filter((e) => keys.has(e.from));
    if (!gEdges.length && members.length < 2) return; // nobody to draw a family with
    // Generations: the stored ones, then outwards along the ties
    // (from = to + step); someone with neither starts at 0.
    const gen = new Map(members.filter((n) => n.gen != null).map((n) => [n.key, n.gen]));
    const spread = () => {
      let moved = true;
      while (moved) {
        moved = false;
        for (const e of gEdges) {
          const step = generationStep(e.role) ?? 0;
          if (gen.has(e.to) && !gen.has(e.from)) { gen.set(e.from, gen.get(e.to) + step); moved = true; }
          else if (gen.has(e.from) && !gen.has(e.to)) { gen.set(e.to, gen.get(e.from) - step); moved = true; }
        }
      }
    };
    spread();
    for (const n of members) {
      if (!gen.has(n.key)) { gen.set(n.key, 0); spread(); }
    }
    const min = Math.min(...members.map((n) => gen.get(n.key)));
    const rows = [];
    members
      .map((n) => ({ ...n, gen: gen.get(n.key) - min }))
      .sort((x, y) => x.gen - y.gen || x.name.localeCompare(y.name))
      .forEach((n) => { (rows[n.gen] = rows[n.gen] || []).push(n); });
    const fid = members.flatMap((n) => n.families)[0];
    const named = fid && families.find((f) => f.id === fid);
    const names = members.filter((n) => n.kind === 'character').map((n) => n.name);
    out.push({
      key: root,
      name: named ? named.name : `Family of ${names.slice(0, 2).join(' & ') || members[0].name}`,
      city: named?.home_city || null,
      rows: rows.filter(Boolean),
      edges: gEdges,
    });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
