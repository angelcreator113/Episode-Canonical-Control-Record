'use strict';

/**
 * Deliverable formats (ruling D15 and answers 8–12, Evoni 2026-09-30;
 * docs/DEAL_COMPONENTS_DESIGN.md §5, §9). Build PR 1 of that note.
 *
 * 1. event_deliverables gains:
 *      platform  VARCHAR(20) NULL      instagram | tiktok | youtube
 *      quantity  INTEGER NOT NULL DEFAULT 1   pieces, slides or days
 * 2. The pre-D15 type keys become formats (src/utils/deliverableFormats.js
 *    LEGACY_TYPE_MAP). Fees are not touched, so a started episode pays what
 *    it agreed:
 *      reel        → instagram_reel,    instagram, ×1
 *      story_set_3 → instagram_stories, instagram, ×3
 *      post        → instagram_post,    instagram, ×1 (answer 8)
 *      photo_set   → carousel_post,     instagram, ×1
 *    A description that is exactly the old label (a drafted row: "Reel",
 *    "Story Set (3)", "Post", "Photo Set") takes the new label, so "Story
 *    Set (3)" reads "Instagram Stories (×3)". The drafted copies in
 *    world_events.canon_consequences.automation.drafted_values.deliverables
 *    are rewritten the same way, so a row that read "Auto-drafted" still
 *    does. Free-text types copied from opportunities are left as they are.
 * 3. Rate card version 2: every v1 anchor and premium copied unchanged,
 *    plus the new formats at D15's proportions of the Reel anchor
 *    (75/125/225/325/450), rounded to the nearest 5, halves up (answer 9;
 *    the table in the design note §5.3). A deal already priced keeps its
 *    pricing_version; only a new proposal reads v2.
 *
 * Guarded: each step is skipped when its table is absent, the columns use
 * IF NOT EXISTS, and v2 is seeded only when it has no rows.
 */

// Tiers 1–5 (Emerging … Elite).
const V2_NEW_ANCHORS = {
  tiktok_video: [75, 125, 225, 325, 450], // 1.0×
  grwm_video: [90, 150, 270, 390, 540], // 1.2×
  instagram_post: [40, 65, 115, 165, 225], // 0.5× (answer 8)
  carousel_post: [45, 75, 135, 195, 270], // 0.6×
  go_live: [115, 190, 340, 490, 675], // 1.5×
  try_on_haul: [75, 125, 225, 325, 450], // 1.0×
  ugc: [60, 100, 180, 260, 360], // 0.8× (usage priced on top)
  link_in_bio_week: [25, 40, 70, 100, 135], // 0.3× per 7 days
};

const TYPE_MAP = {
  reel: { type: 'instagram_reel', platform: 'instagram', quantity: 1, oldLabel: 'Reel', newLabel: 'Instagram Reel' },
  story_set_3: { type: 'instagram_stories', platform: 'instagram', quantity: 3, oldLabel: 'Story Set (3)', newLabel: 'Instagram Stories (×3)' },
  post: { type: 'instagram_post', platform: 'instagram', quantity: 1, oldLabel: 'Post', newLabel: 'Instagram post' },
  photo_set: { type: 'carousel_post', platform: 'instagram', quantity: 1, oldLabel: 'Photo Set', newLabel: 'Carousel post' },
};

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

function parseJson(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[migration 20261001160000] canon_consequences JSON parse failed; row left as it is:', err.message);
    return null;
  }
}

/** Rewrites drafted deliverable records with `map` ({ oldKey: spec }); returns the rows changed. */
async function rewriteDraftedRecords(sequelize, transaction, direction) {
  if (!(await tableExists(sequelize, 'world_events', transaction))) return 0;
  const [events] = await sequelize.query(
    `SELECT id, canon_consequences FROM world_events
      WHERE canon_consequences::text LIKE '%drafted_values%' AND canon_consequences::text LIKE '%deliverables%'`,
    { transaction });
  let changed = 0;
  for (const ev of events) {
    const cc = parseJson(ev.canon_consequences);
    const records = cc?.automation?.drafted_values?.deliverables;
    if (!records || typeof records !== 'object') continue;
    let touched = false;
    for (const record of Object.values(records)) {
      if (!record || typeof record !== 'object') continue;
      if (direction === 'up') {
        const spec = TYPE_MAP[record.type];
        if (!spec) continue;
        record.type = spec.type;
        record.platform = spec.platform;
        record.quantity = spec.quantity;
        if (record.description === spec.oldLabel) record.description = spec.newLabel;
        touched = true;
      } else {
        const entry = Object.entries(TYPE_MAP).find(([, s]) => s.type === record.type);
        if (!entry) continue;
        const [oldKey, spec] = entry;
        record.type = oldKey;
        delete record.platform;
        delete record.quantity;
        if (record.description === spec.newLabel) record.description = spec.oldLabel;
        touched = true;
      }
    }
    if (!touched) continue;
    await sequelize.query('UPDATE world_events SET canon_consequences = :cc WHERE id = :id',
      { replacements: { cc: JSON.stringify(cc), id: ev.id }, transaction });
    changed += 1;
  }
  return changed;
}

module.exports = {
  V2_NEW_ANCHORS,
  TYPE_MAP,

  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction });

      if (await tableExists(sequelize, 'event_deliverables', transaction)) {
        await q('ALTER TABLE event_deliverables ADD COLUMN IF NOT EXISTS platform VARCHAR(20)');
        await q('ALTER TABLE event_deliverables ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1');
        for (const [oldKey, spec] of Object.entries(TYPE_MAP)) {
          const [, meta] = await q(
            `UPDATE event_deliverables
                SET deliverable_type = :type, platform = :platform, quantity = :quantity,
                    description = CASE WHEN description = :oldLabel THEN :newLabel ELSE description END
              WHERE deliverable_type = :oldKey`,
            { ...spec, oldKey });
          console.log(`[migration 20261001160000] event_deliverables ${oldKey} → ${spec.type}: ${meta?.rowCount ?? 0} row(s)`);
        }
      }

      const events = await rewriteDraftedRecords(sequelize, transaction, 'up');
      console.log(`[migration 20261001160000] drafted deliverable records rewritten on ${events} event(s)`);

      if (await tableExists(sequelize, 'deal_rate_anchors', transaction)) {
        const [[{ n }]] = await q('SELECT COUNT(*)::int AS n FROM deal_rate_anchors WHERE version = 2');
        if (n === 0) {
          await q(`INSERT INTO deal_rate_anchors (id, version, component, career_tier, amount, created_at, updated_at)
                   SELECT gen_random_uuid(), 2, component, career_tier, amount, NOW(), NOW()
                     FROM deal_rate_anchors WHERE version = 1 AND deleted_at IS NULL`);
          for (const [component, amounts] of Object.entries(V2_NEW_ANCHORS)) {
            for (let i = 0; i < amounts.length; i += 1) {
              await q(`INSERT INTO deal_rate_anchors (id, version, component, career_tier, amount, created_at, updated_at)
                       VALUES (gen_random_uuid(), 2, :component, :tier, :amount, NOW(), NOW())`,
              { component, tier: i + 1, amount: amounts[i] });
            }
          }
          if (await tableExists(sequelize, 'deal_rate_premiums', transaction)) {
            await q(`INSERT INTO deal_rate_premiums (id, version, kind, key, percent, created_at, updated_at)
                     SELECT gen_random_uuid(), 2, kind, key, percent, NOW(), NOW()
                       FROM deal_rate_premiums WHERE version = 1 AND deleted_at IS NULL`);
          }
        }
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction });
      if (await tableExists(sequelize, 'deal_rate_premiums', transaction)) {
        await q('DELETE FROM deal_rate_premiums WHERE version = 2');
      }
      if (await tableExists(sequelize, 'deal_rate_anchors', transaction)) {
        await q('DELETE FROM deal_rate_anchors WHERE version = 2');
      }
      await rewriteDraftedRecords(sequelize, transaction, 'down');
      if (await tableExists(sequelize, 'event_deliverables', transaction)) {
        for (const [oldKey, spec] of Object.entries(TYPE_MAP)) {
          await q(
            `UPDATE event_deliverables
                SET deliverable_type = :oldKey,
                    description = CASE WHEN description = :newLabel THEN :oldLabel ELSE description END
              WHERE deliverable_type = :type`,
            { ...spec, oldKey });
        }
        await q('ALTER TABLE event_deliverables DROP COLUMN IF EXISTS quantity');
        await q('ALTER TABLE event_deliverables DROP COLUMN IF EXISTS platform');
      }
    });
  },
};
