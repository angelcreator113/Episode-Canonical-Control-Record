'use strict';

/**
 * Brain sync (Evoni, 2026-10-03, Brain Update step 1;
 * docs/BRAIN_OWNERSHIP.md): compares what a source page says, through its
 * Brain Manifest, with what the Brain holds for that source, and applies
 * the difference. No AI: a card's source_key says which entry it owns and
 * its source_hash says whether it changed.
 *
 *   new       — a card whose key has no active entry
 *   changed   — a card whose key has an active entry with another hash
 *   unchanged — same key, same hash; nothing is written
 *   retired   — an active entry whose key the page no longer has
 *
 * Applying inserts new cards as active entries, supersedes a changed
 * entry with a new one (old row: status 'superseded', superseded_by the new
 * id), and archives retired entries. The review in the drawer is the
 * approval, so nothing lands as pending_review. Entries this source never
 * keyed (seeders, document ingestion, the old Push to Brain) are counted as
 * legacy and never touched.
 *
 * A card's words belong to its page; its always_inject ("In every prompt"),
 * scope and show_id belong to the Show Bible, which may set them on a synced
 * card (routes/franchiseBrainRoutes.js PATCH). A new card starts out of every
 * prompt, in the franchise tier. A changed card's new entry keeps the marks
 * of the entry it supersedes: they used to reset, so a card marked for every
 * prompt dropped out the next time its page changed (Evoni's ruling, card by
 * card, 2026-10-08; wiring map fix-list item 24).
 *
 * Reads and writes franchise_knowledge only.
 */

const crypto = require('crypto');

const MANIFESTS = Object.fromEntries([
  require('./brainManifests/socialSystems'),
  require('./brainManifests/culturalCalendar'),
  require('./brainManifests/culturalMemory'),
  require('./brainManifests/worldFoundation'),
  require('./brainManifests/socialTimeline'),
  require('./brainManifests/socialPersonality'),
  require('./brainManifests/characterLifeSimulation'),
  require('./brainManifests/characterDepthEngine'),
].map((m) => [m.SOURCE, m]));

class SyncError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const cardHash = (card) => sha256(`${card.title}\n${card.content}`);

function manifestFor(source) {
  const manifest = MANIFESTS[source];
  if (!manifest) throw new SyncError(404, `No Brain Manifest for "${source}"`);
  return manifest;
}

async function readState(sequelize, manifest, transaction) {
  const prefix = `${manifest.SOURCE}:`;
  const [active] = await sequelize.query(
    `SELECT id, source_key, source_hash, title, content, updated_at, always_inject, scope, show_id
       FROM franchise_knowledge
      WHERE source_key IS NOT NULL AND LEFT(source_key, LENGTH(:prefix)) = :prefix
        AND status = 'active' AND deleted_at IS NULL
      ORDER BY id ASC${transaction ? ' FOR UPDATE' : ''}`,
    { replacements: { prefix }, transaction });
  const [[{ legacy }]] = await sequelize.query(
    `SELECT COUNT(*)::int AS legacy FROM franchise_knowledge
      WHERE source_key IS NULL AND source_document = :doc
        AND status IN ('active', 'pending_review') AND deleted_at IS NULL`,
    { replacements: { doc: manifest.SOURCE_DOCUMENT }, transaction });
  return { active: active || [], legacy };
}

function diff(manifest, pageData, state) {
  const { cards, skipped } = manifest.buildCards(pageData);
  const byKey = new Map(state.active.map((e) => [e.source_key, e]));
  const added = [];
  const changed = [];
  const unchanged = [];
  for (const card of cards) {
    const hash = cardHash(card);
    const entry = byKey.get(card.source_key);
    if (!entry) added.push({ ...card, source_hash: hash });
    else if (entry.source_hash !== hash) {
      changed.push({
        ...card, source_hash: hash, entry_id: entry.id, before: { title: entry.title, content: entry.content },
        keep: { always_inject: !!entry.always_inject, scope: entry.scope || 'franchise', show_id: entry.show_id || null },
      });
    } else unchanged.push({ source_key: card.source_key, title: card.title, entry_id: entry.id });
  }
  const keys = new Set(cards.map((c) => c.source_key));
  const retired = state.active.filter((e) => !keys.has(e.source_key))
    .map((e) => ({ source_key: e.source_key, title: e.title, entry_id: e.id, content: e.content }));

  // What apply must still see to write what was reviewed: every card's key
  // and hash, and every active entry's id and hash.
  const fingerprint = sha256(JSON.stringify({
    cards: cards.map((c) => [c.source_key, cardHash(c)]),
    active: state.active.map((e) => [e.id, e.source_key, e.source_hash]),
  }));
  const connected = state.active.length > 0;
  const pending = added.length + changed.length + retired.length;
  const lastSynced = state.active.reduce((m, e) => (!m || new Date(e.updated_at) > new Date(m) ? e.updated_at : m), null);
  return {
    source: manifest.SOURCE,
    label: manifest.LABEL,
    domains: manifest.DOMAINS,
    state: !connected ? 'not_connected' : (pending ? 'updates' : 'up_to_date'),
    pending,
    new: added,
    changed,
    unchanged,
    retired,
    skipped,
    legacy: state.legacy,
    last_synced: lastSynced,
    fingerprint,
  };
}

/** What a sync of this page would do. Reads only. */
async function previewSync(sequelize, source, pageData) {
  const manifest = manifestFor(source);
  if (!pageData || typeof pageData !== 'object' || Array.isArray(pageData)) throw new SyncError(400, 'page_data must be an object');
  return diff(manifest, pageData, await readState(sequelize, manifest));
}

/**
 * Applies the sync the person reviewed. fingerprint is the preview's; when
 * the page or the Brain changed since, nothing is written (409). Returns
 * { applied: { new, changed, retired }, preview } where preview is the
 * state after.
 */
async function applySync(sequelize, source, pageData, fingerprint) {
  const manifest = manifestFor(source);
  if (!pageData || typeof pageData !== 'object' || Array.isArray(pageData)) throw new SyncError(400, 'page_data must be an object');
  if (typeof fingerprint !== 'string' || !fingerprint) throw new SyncError(400, 'fingerprint is required (from the preview)');

  const applied = await sequelize.transaction(async (transaction) => {
    const plan = diff(manifest, pageData, await readState(sequelize, manifest, transaction));
    if (plan.fingerprint !== fingerprint) throw new SyncError(409, 'The page or the Brain changed since this review. Review the update again.');

    // A new card is out of every prompt, franchise-wide; a changed card keeps its entry's marks.
    const insert = async (card, marks = { always_inject: false, scope: 'franchise', show_id: null }) => {
      const [[row]] = await sequelize.query(
        `INSERT INTO franchise_knowledge
           (title, content, category, severity, applies_to, always_inject, scope, show_id, source_document, source_version,
            source_key, source_hash, extracted_by, status, created_at, updated_at)
         VALUES (:title, :content, :category, :severity, '[]'::jsonb, :always_inject, :scope, :show_id, :doc, '1.0',
            :key, :hash, 'system', 'active', NOW(), NOW())
         RETURNING id`,
        { replacements: { title: card.title, content: card.content, category: card.category, severity: card.severity,
          always_inject: marks.always_inject, scope: marks.scope, show_id: marks.show_id,
          doc: manifest.SOURCE_DOCUMENT, key: card.source_key, hash: card.source_hash }, transaction });
      return row.id;
    };

    for (const card of plan.new) await insert(card);
    for (const card of plan.changed) {
      await sequelize.query(
        `UPDATE franchise_knowledge SET status = 'superseded', updated_at = NOW() WHERE id = :id`,
        { replacements: { id: card.entry_id }, transaction });
      const id = await insert(card, card.keep);
      await sequelize.query(
        'UPDATE franchise_knowledge SET superseded_by = :id WHERE id = :old',
        { replacements: { id, old: card.entry_id }, transaction });
    }
    for (const entry of plan.retired) {
      await sequelize.query(
        `UPDATE franchise_knowledge
            SET status = 'archived', review_note = :note, updated_at = NOW()
          WHERE id = :id`,
        { replacements: { id: entry.entry_id, note: `Removed from ${manifest.LABEL}; retired by Brain sync` }, transaction });
    }
    return { new: plan.new.length, changed: plan.changed.length, retired: plan.retired.length };
  }).catch((err) => {
    if (err instanceof SyncError) throw err;
    // Two syncs racing to add the same key: the partial unique index refuses
    // the second, and its transaction rolled back.
    if (err.name === 'SequelizeUniqueConstraintError' || err.original?.code === '23505') {
      throw new SyncError(409, 'Another Brain update for this page landed first. Review the update again.');
    }
    throw err;
  });

  return { applied, preview: await previewSync(sequelize, source, pageData) };
}

/**
 * Per page, what the Brain holds from it (World Setup, 2026-10-06: a page
 * full of built-in content that was never synced read as "0 sections"):
 * { [source]: { label, cards, legacy, last_synced } }. cards are the active
 * cards the page's Brain Update owns (source_key prefix); legacy counts the
 * older Push to Brain entries of its source document. Reads only.
 */
async function syncStatus(sequelize) {
  const out = {};
  for (const manifest of Object.values(MANIFESTS)) {
    const prefix = `${manifest.SOURCE}:`;
    const [[row]] = await sequelize.query(
      `SELECT COUNT(*)::int AS cards, MAX(updated_at) AS last_synced FROM franchise_knowledge
        WHERE source_key IS NOT NULL AND LEFT(source_key, LENGTH(:prefix)) = :prefix
          AND status = 'active' AND deleted_at IS NULL`,
      { replacements: { prefix } });
    const [[{ legacy }]] = await sequelize.query(
      `SELECT COUNT(*)::int AS legacy FROM franchise_knowledge
        WHERE source_key IS NULL AND source_document = :doc
          AND status IN ('active', 'pending_review') AND deleted_at IS NULL`,
      { replacements: { doc: manifest.SOURCE_DOCUMENT } });
    out[manifest.SOURCE] = { label: manifest.LABEL, cards: row?.cards || 0, legacy: legacy || 0, last_synced: row?.last_synced || null };
  }
  return out;
}

/** The source label for a source_key ('social_systems:…' → 'Social Systems'), or null. */
function sourceLabelFor(sourceKey) {
  if (typeof sourceKey !== 'string') return null;
  const manifest = MANIFESTS[sourceKey.split(':')[0]];
  return manifest ? manifest.LABEL : null;
}

module.exports = { MANIFESTS, SyncError, cardHash, previewSync, applySync, sourceLabelFor, syncStatus };
