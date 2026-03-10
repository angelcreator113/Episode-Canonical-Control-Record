'use strict';

/**
 * Deduplicate franchise_knowledge entries with substantially the same title.
 *
 * Priority: keep entries sourced from 'franchise_bible vv3.1 · system'
 * (extracted_by = 'system' OR source_document ILIKE '%franchise_bible%')
 * over entries from 'document_ingestion'.
 *
 * Duplicates are soft-deleted (deleted_at set, status → 'superseded',
 * superseded_by → the kept entry's id).
 */
module.exports = {
  async up(queryInterface) {
    // Find duplicate groups: entries whose LOWER(TRIM(title)) matches another row.
    // For each group, keep the "best" row (franchise_bible / system source wins)
    // and soft-delete the rest.
    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT
          id,
          LOWER(TRIM(title)) AS norm_title,
          extracted_by,
          source_document,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(title))
            ORDER BY
              -- Priority 1: franchise_bible source or system extractor wins
              CASE
                WHEN source_document ILIKE '%franchise_bible%' THEN 0
                WHEN extracted_by = 'system'                   THEN 0
                WHEN extracted_by = 'direct_entry'             THEN 1
                WHEN extracted_by = 'conversation_extraction'  THEN 2
                WHEN extracted_by = 'document_ingestion'       THEN 3
                ELSE 4
              END,
              -- Priority 2: active > pending > others
              CASE status
                WHEN 'active'         THEN 0
                WHEN 'pending_review' THEN 1
                WHEN 'superseded'     THEN 2
                WHEN 'archived'       THEN 3
                ELSE 4
              END,
              -- Priority 3: newer is better
              created_at DESC
          ) AS rn
        FROM franchise_knowledge
        WHERE deleted_at IS NULL
      ),
      -- Identify the "keeper" id for each duplicate group
      keepers AS (
        SELECT norm_title, id AS keeper_id
        FROM ranked
        WHERE rn = 1
      ),
      -- Identify losers (rn > 1) that belong to groups with more than one entry
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
  },

  async down(queryInterface) {
    // Reverse: restore any rows that were auto-deduplicated by this migration
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
  },
};
