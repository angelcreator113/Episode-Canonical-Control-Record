'use strict';

/**
 * Deduplicate franchise_knowledge entries with substantially the same title.
 *
 * Keep-priority (highest wins):
 *   1. source_document ILIKE '%franchise_bible%'  OR  extracted_by = 'system'
 *   2. extracted_by = 'direct_entry'
 *   3. extracted_by = 'conversation_extraction'
 *   4. extracted_by = 'document_ingestion'
 *
 * Tiebreakers (same extracted_by tier):
 *   - always_inject = true  wins over false
 *   - higher id wins (newer row)
 *
 * Duplicates are soft-deleted (deleted_at set, status → 'superseded',
 * superseded_by → the kept entry's id, review_note annotated).
 *
 * Specific known duplicates targeted:
 *   "HTTP 403 on Finalized Characters Rule"
 *   "Protected Lines Never Overwritten"
 *   "Blind Generation Non-Negotiable"
 *   "Dual Memory Proposals Require Confirmation"
 *   "JustAWoman is always self-possessed"
 *   "Lala never knows she was built"
 *   "David is not the obstacle"
 *   "The reader holds all layers"
 *   "Coaching realization comes in Book 2"
 *   "Lala appears in Book 1 as ONE intrusive thought"
 */
module.exports = {
  async up(queryInterface) {
    // ── Step 1: soft-delete duplicates ────────────────────────────────────────
    const [, meta] = await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT
          id,
          LOWER(TRIM(title)) AS norm_title,
          extracted_by,
          source_document,
          always_inject,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(title))
            ORDER BY
              -- Tier: franchise_bible / system wins over document_ingestion
              CASE
                WHEN source_document ILIKE '%franchise_bible%' THEN 0
                WHEN extracted_by = 'system'                   THEN 0
                WHEN extracted_by = 'direct_entry'             THEN 1
                WHEN extracted_by = 'conversation_extraction'  THEN 2
                WHEN extracted_by = 'document_ingestion'       THEN 3
                ELSE 4
              END,
              -- Tiebreaker 1: always_inject = true wins
              CASE WHEN always_inject = true THEN 0 ELSE 1 END,
              -- Tiebreaker 2: active > pending > others
              CASE status
                WHEN 'active'         THEN 0
                WHEN 'pending_review' THEN 1
                WHEN 'superseded'     THEN 2
                WHEN 'archived'       THEN 3
                ELSE 4
              END,
              -- Tiebreaker 3: higher id (newer row) wins
              id DESC
          ) AS rn
        FROM franchise_knowledge
        WHERE deleted_at IS NULL
      ),
      keepers AS (
        SELECT norm_title, id AS keeper_id
        FROM ranked
        WHERE rn = 1
      ),
      losers AS (
        SELECT r.id AS loser_id, k.keeper_id
        FROM ranked r
        JOIN keepers k ON k.norm_title = r.norm_title
        WHERE r.rn > 1
      )
      UPDATE franchise_knowledge fk
      SET
        deleted_at    = NOW(),
        status        = 'superseded',
        superseded_by = l.keeper_id,
        review_note   = COALESCE(review_note || '; ', '') ||
                        'Auto-deduplicated: duplicate title, kept id=' || l.keeper_id
      FROM losers l
      WHERE fk.id = l.loser_id;
    `);

    // ── Step 2: report results ───────────────────────────────────────────────
    const [counts] = await queryInterface.sequelize.query(`
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL
          AND review_note LIKE '%Auto-deduplicated:%') AS removed,
        COUNT(*) FILTER (WHERE deleted_at IS NULL)     AS remaining
      FROM franchise_knowledge;
    `);

    const { removed, remaining } = counts[0];
    console.log(`\n  ✓ franchise_knowledge dedup complete`);
    console.log(`    Removed:   ${removed} duplicate(s)`);
    console.log(`    Remaining: ${remaining} active entries\n`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE franchise_knowledge
      SET
        deleted_at    = NULL,
        status        = 'pending_review',
        superseded_by = NULL,
        review_note   = REGEXP_REPLACE(
          review_note,
          '(; )?Auto-deduplicated: duplicate title, kept id=\\d+',
          '',
          'g'
        )
      WHERE review_note LIKE '%Auto-deduplicated: duplicate title, kept id=%'
        AND deleted_at IS NOT NULL;
    `);

    const [counts] = await queryInterface.sequelize.query(`
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL) AS restored_total
      FROM franchise_knowledge;
    `);
    console.log(`\n  ✓ franchise_knowledge dedup reverted — ${counts[0].restored_total} entries now active\n`);
  },
};
