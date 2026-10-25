'use strict';

/**
 * Brand and company profiles (Evoni, 2026-10-18: "do the brand and companies
 * get their own profiles that customed for a brand instead of a character?"
 * ... "yes start the brand and company profile pages").
 *
 * Every company in Lala's world is a row of lalaverse_brands with a `kind`
 * (brand | outlet | agency | venue; constants/companyKinds, migration
 * 20261019100000). A profile shows only the sections its kind has
 * (SECTIONS_BY_KIND):
 *
 *   identity       three layers kept apart (the Brand Canon Protection
 *                  Rule): its established history (the canon columns),
 *                  what it believes and its tone (personality). Written by
 *                  Evoni only; no AI writes here.
 *   people         its founder (as recorded), its representatives (the
 *                  characters linked by extra_fields.brand_id or
 *                  representative_of, with their authority), and for an
 *                  outlet its publisher (extra_fields.publication).
 *   pulse          its own Pulse account (services/brandPulse) with recent
 *                  posts and replies waiting; with none, its people's posts.
 *   business       its deals: linked by opportunities.company_id, or naming
 *                  it in brand_or_company; event_id lets the page show each
 *                  deal's deliverable progress (services/deliverableProgress).
 *   pictures       read by the page itself from GET /api/v1/media (the
 *                  library's own visibility rules); nothing here.
 *   wardrobe       pieces tagged with it (wardrobe_brand_tags) or naming it
 *                  (wardrobe.brand).
 *   press          a brand: coverage written about its pieces and Pulse
 *                  posts by the press that name it, and events it hosted
 *                  (world_events.host_brand); an outlet: what its people
 *                  published; a venue: events held there (venue_name).
 *   relationships  how it sees the other brands (personality.relationships,
 *                  else constants/brandPersonalities BRAND_RELATIONSHIPS).
 *
 *   listCompanies(db, { kind })        the list page
 *   profileOf(db, slugOrId)            one profile, its sections by kind
 *   createCompany(db, fields)          a new company (Evoni)
 *   updateCompany(db, slugOrId, fields)  her edits to its identity
 *   companyForName(db, name)           the one company of that name, or null
 *   linkDeal(db, body)                 sets a deal's company_id from its typed
 *                                      name, or its name from company_id
 *
 * Reads are bounded (LIMIT). Confidential characters (Dr. Sinclair) never
 * appear. Nothing from the Talk sessions is read.
 */

const { COMPANY_KINDS, SECTIONS_BY_KIND, sectionLabel, normalizeName } = require('../constants/companyKinds');
const { BRAND_PERSONALITIES, BRAND_RELATIONSHIPS, REPRESENTATIVES } = require('../constants/brandPersonalities');
const { notConfidentialSql } = require('../utils/confidentialCharacters');

const LIMIT = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NORM = (col) => `LOWER(TRIM(REGEXP_REPLACE(${col}, '\\s+', ' ', 'g')))`;

class CompanyError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Identity: the layers, each field with its label.
const HISTORY_FIELDS = [
  ['founder', 'Founder'], ['description', 'What it is'], ['category', 'Category'], ['aesthetic', 'Aesthetic'],
  ['niche', 'Niche'], ['press_angle', 'How the press tells it'], ['website', 'Website'],
];
const BELIEF_FIELDS = [
  ['defining_principle', 'Defining principle'], ['beliefs', 'What it believes'],
  ['earns_trust', 'Earns its trust'], ['damages_trust', 'Damages its trust'],
];
const TONE_FIELDS = [
  ['direction', 'Its tone'], ['creator_selection', 'How it chooses creators'],
  ['deal_behavior', 'How it deals'], ['preferred_content', 'The content it wants'],
];
// What Evoni may edit (updateCompany): the canon columns and the personality fields above.
const EDITABLE_COLUMNS = ['name', 'kind', 'founder', 'description', 'category', 'aesthetic', 'niche', 'press_angle', 'website', 'contact_name', 'contact_email', 'partnership_status'];
const EDITABLE_PERSONALITY = ['defining_principle', 'beliefs', 'direction', 'creator_selection', 'deal_behavior', 'earns_trust', 'damages_trust', 'preferred_content'];
const LIST_FIELDS = new Set(['earns_trust', 'damages_trust', 'preferred_content']);

const clean = (v, n = 4000) => (v == null ? null : String(v).replace(/\r/g, '').trim().slice(0, n) || null);
const iso = (d) => (d ? new Date(d).toISOString() : null);
const slugOf = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);

async function rows(db, sql, replacements, label) {
  try {
    return await db.sequelize.query(sql, { replacements, type: db.sequelize.QueryTypes.SELECT });
  } catch (err) {
    console.error(`[brandProfile] ${label} could not be read:`, err.message);
    return [];
  }
}

/** Its saved personality, else the approved one for the six (constants/brandPersonalities). */
function personalityOf(company) {
  const saved = company?.personality;
  if (saved && typeof saved === 'object' && Object.keys(saved).length) return saved;
  return BRAND_PERSONALITIES[company?.slug] || {};
}

/** The tabs a kind shows, with their labels. */
function sectionsFor(kind) {
  const k = SECTIONS_BY_KIND[kind] ? kind : 'brand';
  return SECTIONS_BY_KIND[k].map((key) => ({ key, label: sectionLabel(key, k) }));
}

async function findCompany(db, slugOrId) {
  const key = String(slugOrId || '').trim();
  if (!key) throw new CompanyError(404, 'Company not found.');
  const [row] = await rows(db, `SELECT * FROM lalaverse_brands WHERE deleted_at IS NULL AND ${UUID_RE.test(key) ? 'id = :key' : 'slug = :key'} LIMIT 1`, { key }, 'company');
  if (!row) throw new CompanyError(404, 'Company not found.');
  return row;
}

async function accountOf(db, companyId) {
  const [row] = await rows(db, `SELECT id, handle, display_name, posting_schedule FROM social_profiles
    WHERE deleted_at IS NULL AND full_profile->>'lalaverse_brand_id' = :id ORDER BY id ASC LIMIT 1`, { id: String(companyId) }, 'Pulse account');
  return row || null;
}

// ── The list ────────────────────────────────────────────────────────────────

async function listCompanies(db, { kind = null } = {}) {
  if (kind && !COMPANY_KINDS[kind]) throw new CompanyError(400, `kind must be one of ${Object.keys(COMPANY_KINDS).join(', ')}.`);
  const list = await rows(db, `SELECT b.id, b.slug, b.name, b.kind, b.category, b.description, b.founder, b.personality,
      (SELECT sp.handle FROM social_profiles sp WHERE sp.deleted_at IS NULL AND sp.full_profile->>'lalaverse_brand_id' = b.id::text ORDER BY sp.id LIMIT 1) AS handle,
      (SELECT COUNT(*) FROM opportunities o WHERE o.deleted_at IS NULL AND o.company_id = b.id) AS deals
    FROM lalaverse_brands b WHERE b.deleted_at IS NULL ${kind ? 'AND b.kind = :kind' : ''}
    ORDER BY CASE b.kind WHEN 'brand' THEN 0 WHEN 'outlet' THEN 1 WHEN 'agency' THEN 2 ELSE 3 END, b.name ASC LIMIT 200`, { kind }, 'companies');
  return list.map((c) => ({
    id: c.id, slug: c.slug, name: c.name, kind: c.kind || 'brand', kind_label: COMPANY_KINDS[c.kind] || COMPANY_KINDS.brand,
    category: c.category || null, description: clean(c.description, 240), founder: c.founder || null,
    defining_principle: personalityOf(c).defining_principle || null, handle: c.handle || null, deals: Number(c.deals) || 0,
  }));
}

// ── The sections ────────────────────────────────────────────────────────────

function identityOf(company) {
  const p = personalityOf(company);
  const pick = (source, fields) => fields
    .map(([key, label]) => ({ key, label, value: Array.isArray(source[key]) ? source[key] : clean(source[key]) }))
    .filter((f) => (Array.isArray(f.value) ? f.value.length : f.value));
  return {
    history: pick(company, HISTORY_FIELDS),
    beliefs: pick(p, BELIEF_FIELDS),
    tone: pick(p, TONE_FIELDS),
  };
}

async function peopleOf(db, company) {
  const linked = await rows(db, `SELECT rc.id, rc.character_key, rc.display_name, rc.selected_name, rc.status, rc.extra_fields
      FROM registry_characters rc
     WHERE rc.deleted_at IS NULL AND ${notConfidentialSql('rc')}
       AND (rc.extra_fields->>'brand_id' = :id OR rc.extra_fields->>'representative_of' = :slug
            OR ${NORM("rc.extra_fields->>'publication'")} = ${NORM(':name')})
     ORDER BY rc.created_at ASC LIMIT ${LIMIT}`, { id: String(company.id), slug: company.slug, name: company.name }, 'people');
  const seen = new Set();
  const people = [];
  for (const rc of linked) {
    if (seen.has(rc.character_key)) continue;
    seen.add(rc.character_key);
    const extra = (typeof rc.extra_fields === 'string' ? JSON.parse(rc.extra_fields) : rc.extra_fields) || {};
    const rep = REPRESENTATIVES.find((r) => r.key === rc.character_key);
    const authority = extra.authority || rep?.authority || null;
    people.push({
      character_id: rc.id, key: rc.character_key, name: rc.selected_name || rc.display_name, status: rc.status,
      title: extra.title || rep?.title || (extra.publication ? `Publisher of ${extra.publication}` : null),
      core_belief: rep?.core_belief || null,
      authority: authority && {
        label: authority.label || null, creative: authority.creative || null, negotiate: authority.negotiate || null,
        spend: authority.spend || null, finalize: authority.finalize || null,
      },
    });
  }
  // A representative in the constants with no character yet still shows, unlinked.
  for (const rep of REPRESENTATIVES.filter((r) => r.brand === company.slug && !seen.has(r.key))) {
    people.push({
      character_id: null, key: rep.key, name: rep.name, status: null, title: rep.title, core_belief: rep.core_belief,
      authority: { label: rep.authority.label, creative: rep.authority.creative, negotiate: rep.authority.negotiate, spend: rep.authority.spend, finalize: rep.authority.finalize },
    });
  }
  return { founder: company.founder || null, people };
}

async function pulseOf(db, company, people) {
  const account = await accountOf(db, company.id);
  let profileIds = account ? [account.id] : [];
  let from = account ? 'account' : 'people';
  if (!account) {
    const ids = people.map((p) => p.character_id).filter(Boolean);
    profileIds = ids.length
      ? (await rows(db, `SELECT feed_profile_id FROM registry_characters WHERE id IN (:ids) AND feed_profile_id IS NOT NULL`, { ids }, 'people\'s profiles')).map((r) => r.feed_profile_id)
      : [];
    if (!profileIds.length) from = null;
  }
  const posts = profileIds.length
    ? await rows(db, `SELECT id, show_id, poster_handle, content_text, status, release_state, release_at, posted_at, created_at
        FROM feed_posts WHERE deleted_at IS NULL AND social_profile_id IN (:ids)
        ORDER BY COALESCE(posted_at, release_at, created_at) DESC LIMIT 10`, { ids: profileIds }, 'posts')
    : [];
  const replies = account
    ? await rows(db, `SELECT fc.id, fc.text, fc.feed_post_id, fp.poster_handle FROM feed_comments fc JOIN feed_posts fp ON fp.id = fc.feed_post_id
        WHERE fc.social_profile_id = :id AND fc.status = 'draft' AND fc.deleted_at IS NULL ORDER BY fc.created_at DESC LIMIT 10`, { id: account.id }, 'replies')
    : [];
  return {
    account: account && { id: account.id, handle: account.handle, display_name: account.display_name, has_schedule: Boolean(account.posting_schedule) },
    from,
    posts: posts.map((p) => ({
      id: p.id, show_id: p.show_id, handle: p.poster_handle, text: clean(p.content_text, 400), status: p.status,
      release_state: p.release_state || null, at: iso(p.posted_at || p.release_at || p.created_at),
    })),
    replies: replies.map((r) => ({ id: r.id, text: clean(r.text, 300), post_id: r.feed_post_id, to: r.poster_handle })),
  };
}

async function businessOf(db, company) {
  const deals = await rows(db, `SELECT o.id, o.show_id, o.name, o.status, o.opportunity_type, o.brand_or_company, o.company_id,
      o.payment_amount, o.response_deadline, o.shoot_date, o.publish_date, o.created_at, o.event_id, s.name AS show
    FROM opportunities o LEFT JOIN shows s ON s.id = o.show_id
    WHERE o.deleted_at IS NULL AND (o.company_id = :id OR (o.company_id IS NULL AND ${NORM('o.brand_or_company')} = ${NORM(':name')}))
    ORDER BY o.created_at DESC LIMIT ${LIMIT}`, { id: company.id, name: company.name }, 'deals');
  return deals.map((d) => ({
    id: d.id, show_id: d.show_id, show: d.show || null, name: d.name, status: d.status, type: d.opportunity_type || null, event_id: d.event_id || null,
    amount: d.payment_amount == null ? null : Number(d.payment_amount), linked: d.company_id === company.id,
    dates: [
      d.response_deadline && { kind: 'Answer by', date: d.response_deadline },
      d.shoot_date && { kind: 'Shoot', date: d.shoot_date },
      d.publish_date && { kind: 'Goes public', date: d.publish_date },
    ].filter(Boolean),
  }));
}

async function wardrobeOf(db, company) {
  const pieces = await rows(db, `SELECT w.id, w.name, w.clothing_category, w.color,
      COALESCE(w.s3_url_processed, w.s3_url, w.thumbnail_url) AS image, MAX(t.event_name) AS event_name, MAX(t.coverage_status) AS coverage
    FROM wardrobe w LEFT JOIN wardrobe_brand_tags t ON t.wardrobe_item_id = w.id AND t.brand_id = :id
    WHERE w.deleted_at IS NULL AND (t.id IS NOT NULL OR ${NORM('w.brand')} = ${NORM(':name')})
    GROUP BY w.id ORDER BY w.name ASC LIMIT 60`, { id: company.id, name: company.name }, 'wardrobe');
  return pieces.map((w) => ({
    id: w.id, name: w.name, category: w.clothing_category || null, color: w.color || null, image: w.image || null,
    event: w.event_name || null, coverage: w.coverage || null,
  }));
}

async function pressOf(db, company, people) {
  const kind = company.kind || 'brand';
  const out = { coverage: [], posts: [], events: [] };
  if (kind === 'brand') {
    out.coverage = (await rows(db, `SELECT id, wardrobe_item_name, coverage_author, coverage_status, coverage_content, coverage_url, coverage_published
        FROM wardrobe_brand_tags WHERE brand_id = :id AND coverage_content IS NOT NULL
        ORDER BY COALESCE(coverage_published, coverage_generated, updated_at) DESC LIMIT 10`, { id: company.id }, 'coverage'))
      .map((c) => ({ id: c.id, piece: c.wardrobe_item_name, author: c.coverage_author, status: c.coverage_status, text: clean(c.coverage_content, 500), url: c.coverage_url || null, at: iso(c.coverage_published) }));
    out.posts = (await rows(db, `SELECT fp.id, fp.poster_handle, fp.content_text, fp.status, COALESCE(fp.posted_at, fp.created_at) AS at
        FROM feed_posts fp JOIN registry_characters rc ON rc.feed_profile_id = fp.social_profile_id AND rc.deleted_at IS NULL
        WHERE fp.deleted_at IS NULL AND rc.extra_fields->>'publication' IS NOT NULL AND fp.content_text ILIKE :like
        ORDER BY at DESC LIMIT 10`, { like: `%${company.name}%` }, 'press posts'))
      .map((p) => ({ id: p.id, handle: p.poster_handle, text: clean(p.content_text, 400), status: p.status, at: iso(p.at) }));
  }
  if (kind === 'outlet') {
    const ids = people.map((p) => p.character_id).filter(Boolean);
    out.posts = ids.length
      ? (await rows(db, `SELECT fp.id, fp.poster_handle, fp.content_text, fp.status, COALESCE(fp.posted_at, fp.created_at) AS at
          FROM feed_posts fp JOIN registry_characters rc ON rc.feed_profile_id = fp.social_profile_id
          WHERE fp.deleted_at IS NULL AND rc.id IN (:ids) ORDER BY at DESC LIMIT 10`, { ids }, 'published'))
        .map((p) => ({ id: p.id, handle: p.poster_handle, text: clean(p.content_text, 400), status: p.status, at: iso(p.at) }))
      : [];
    out.coverage = (await rows(db, `SELECT t.id, t.wardrobe_item_name, t.coverage_author, t.coverage_status, t.coverage_content, t.coverage_url, t.coverage_published, b.name AS brand
        FROM wardrobe_brand_tags t LEFT JOIN lalaverse_brands b ON b.id = t.brand_id
        WHERE t.coverage_content IS NOT NULL AND ${NORM('t.coverage_author')} IN (SELECT ${NORM('display_name')} FROM registry_characters WHERE id IN (:ids))
        ORDER BY COALESCE(t.coverage_published, t.coverage_generated, t.updated_at) DESC LIMIT 10`, { ids: ids.length ? ids : ['00000000-0000-0000-0000-000000000000'] }, 'outlet coverage'))
      .map((c) => ({ id: c.id, piece: c.wardrobe_item_name, brand: c.brand || null, author: c.coverage_author, status: c.coverage_status, text: clean(c.coverage_content, 500), url: c.coverage_url || null, at: iso(c.coverage_published) }));
  }
  if (kind === 'brand' || kind === 'venue') {
    const col = kind === 'brand' ? 'e.host_brand' : 'e.venue_name';
    out.events = (await rows(db, `SELECT e.id, e.show_id, e.name, e.event_type, e.event_date, e.status, e.venue_name, e.host_brand
        FROM world_events e WHERE e.deleted_at IS NULL AND ${NORM(col)} = ${NORM(':name')}
        ORDER BY e.created_at DESC LIMIT ${LIMIT}`, { name: company.name }, 'events'))
      .map((e) => ({ id: e.id, show_id: e.show_id, name: e.name, type: e.event_type || null, date: e.event_date || null, status: e.status, venue: e.venue_name || null, host: e.host_brand || null }));
  }
  return out;
}

async function relationshipsOf(db, company) {
  const saved = personalityOf(company).relationships;
  const list = Array.isArray(saved) && saved.length
    ? saved
    : BRAND_RELATIONSHIPS.filter((r) => r.brands.includes(company.slug)).map((r) => ({ with: r.brands.find((b) => b !== company.slug), kind: r.kind, note: r.note }));
  if (!list.length) return [];
  const others = await rows(db, 'SELECT slug, name FROM lalaverse_brands WHERE deleted_at IS NULL AND slug IN (:slugs)', { slugs: list.map((r) => r.with) }, 'related companies');
  const nameOf = new Map(others.map((o) => [o.slug, o.name]));
  return list.map((r) => ({ slug: r.with, name: nameOf.get(r.with) || r.with, kind: r.kind, note: r.note || null, linked: nameOf.has(r.with) }));
}

/** One company's profile: its identity and the sections its kind has. */
async function profileOf(db, slugOrId) {
  const company = await findCompany(db, slugOrId);
  const kind = COMPANY_KINDS[company.kind] ? company.kind : 'brand';
  const sections = sectionsFor(kind);
  const has = new Set(sections.map((s) => s.key));
  const people = has.has('people') || has.has('pulse') || has.has('press') ? await peopleOf(db, company) : { founder: company.founder || null, people: [] };
  return {
    company: {
      id: company.id, slug: company.slug, name: company.name, kind, kind_label: COMPANY_KINDS[kind],
      category: company.category || null, defining_principle: personalityOf(company).defining_principle || null,
      contact_name: company.contact_name || null, contact_email: company.contact_email || null,
      partnership_status: company.partnership_status || null, website: company.website || null,
    },
    sections,
    identity: identityOf(company),
    people: has.has('people') ? people : null,
    pulse: has.has('pulse') ? await pulseOf(db, company, people.people) : null,
    business: has.has('business') ? await businessOf(db, company) : null,
    wardrobe: has.has('wardrobe') ? await wardrobeOf(db, company) : null,
    press: has.has('press') ? await pressOf(db, company, people.people) : null,
    relationships: has.has('relationships') ? await relationshipsOf(db, company) : null,
    // The registry character marked as this company, if any (services/companyCharacters).
    registry_character: await require('./companyCharacters').characterOf(db, company.id),
  };
}

// ── Evoni's writes ──────────────────────────────────────────────────────────

/** The one live company whose name matches (trimmed, one space, any case), or null. */
async function companyForName(db, name) {
  const n = normalizeName(name);
  if (!n) return null;
  const found = await rows(db, `SELECT id, slug, name, kind FROM lalaverse_brands WHERE deleted_at IS NULL AND ${NORM('name')} = :n LIMIT 2`, { n }, 'company by name');
  return found.length === 1 ? found[0] : null;
}

function personalityPatch(fields, current) {
  const next = { ...current };
  let changed = false;
  for (const key of EDITABLE_PERSONALITY) {
    if (!(key in fields)) continue;
    changed = true;
    const v = fields[key];
    if (LIST_FIELDS.has(key)) {
      const list = (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => clean(x, 300)).filter(Boolean).slice(0, 12);
      if (list.length) next[key] = list; else delete next[key];
    } else {
      const text = clean(v, 2000);
      if (text) next[key] = text; else delete next[key];
    }
  }
  return changed ? next : null;
}

function columnPatch(fields) {
  const out = {};
  for (const key of EDITABLE_COLUMNS) {
    if (!(key in fields)) continue;
    if (key === 'kind') {
      if (!COMPANY_KINDS[fields.kind]) throw new CompanyError(400, `kind must be one of ${Object.keys(COMPANY_KINDS).join(', ')}.`);
      out.kind = fields.kind;
    } else if (key === 'name') {
      const name = clean(fields.name, 200);
      if (!name) throw new CompanyError(400, 'A company needs a name.');
      out.name = name;
    } else {
      out[key] = clean(fields[key], key === 'description' || key === 'founder' ? 4000 : 255);
    }
  }
  return out;
}

async function createCompany(db, fields = {}) {
  const name = clean(fields.name, 200);
  if (!name) throw new CompanyError(400, 'A company needs a name.');
  const kind = fields.kind || 'brand';
  if (!COMPANY_KINDS[kind]) throw new CompanyError(400, `kind must be one of ${Object.keys(COMPANY_KINDS).join(', ')}.`);
  if (await companyForName(db, name)) throw new CompanyError(409, `${name} is already a company.`);
  let slug = slugOf(name) || 'company';
  const [taken] = await rows(db, 'SELECT 1 AS x FROM lalaverse_brands WHERE slug = :slug LIMIT 1', { slug }, 'slug');
  if (taken) slug = `${slug}_${Date.now().toString(36)}`;
  const personality = personalityPatch(fields, {});
  const row = await db.LalaverseBrand.create({
    ...columnPatch({ ...fields, name, kind }), slug, type: 'lalaverse',
    personality: personality && Object.keys(personality).length ? personality : null,
  });
  return profileOf(db, row.id);
}

async function updateCompany(db, slugOrId, fields = {}) {
  const company = await findCompany(db, slugOrId);
  const cols = columnPatch(fields);
  if (cols.name && normalizeName(cols.name) !== normalizeName(company.name)) {
    const other = await companyForName(db, cols.name);
    if (other && other.id !== company.id) throw new CompanyError(409, `${cols.name} is already a company.`);
  }
  const personality = personalityPatch(fields, personalityOf(company));
  const patch = { ...cols, ...(personality ? { personality } : {}) };
  if (!Object.keys(patch).length) throw new CompanyError(400, 'Nothing to change.');
  const row = await db.LalaverseBrand.findByPk(company.id);
  await row.update(patch);
  return profileOf(db, company.id);
}

/**
 * A deal's company (routes/opportunityRoutes create and update): a company_id
 * given wins and fills brand_or_company when it is blank; a typed name with
 * no company_id links to the one company of that name, or unlinks.
 */
async function linkDeal(db, body = {}) {
  if (!body || typeof body !== 'object') return body;
  if (body.company_id) {
    const [row] = await rows(db, 'SELECT id, name FROM lalaverse_brands WHERE id = :id AND deleted_at IS NULL LIMIT 1',
      { id: UUID_RE.test(String(body.company_id)) ? body.company_id : '00000000-0000-0000-0000-000000000000' }, 'deal company');
    if (!row) throw new CompanyError(400, 'company_id is not a company.');
    return { ...body, company_id: row.id, brand_or_company: clean(body.brand_or_company, 200) || row.name };
  }
  if ('brand_or_company' in body) {
    const match = await companyForName(db, body.brand_or_company);
    return { ...body, company_id: match ? match.id : null };
  }
  return body;
}

module.exports = {
  CompanyError, LIMIT, EDITABLE_COLUMNS, EDITABLE_PERSONALITY,
  personalityOf, sectionsFor, identityOf, listCompanies, profileOf, createCompany, updateCompany, companyForName, linkDeal,
};
