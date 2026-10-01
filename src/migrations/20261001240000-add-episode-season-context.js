'use strict';

/**
 * Season context on the episode (Evoni's ruling A5, 2026-10-01;
 * docs/EVENT_EPISODE_FLOW.md §8(ff); build PR 3 of
 * docs/SEASON_ARC_DESIGN_NOTE.md):
 *
 *   A5. "Start Episode snapshots the season context onto the episode. The
 *   Overview shows its season position and purpose, and the script
 *   generator receives that context."
 *   Q3. "Episode numbers restart each season, shown "S1 · E7"; the
 *   show-wide count stays internal."
 *
 * 1. episodes.season_context (JSONB, nullable): the snapshot
 *      { season_number, label, slot_number, arc_id, arc_title,
 *        phase: { number, title, tagline, emotional_arc },
 *        position_in_phase, story_purpose, career_focus, desired_pressure,
 *        outcome_range, snapshotted_at }
 *    written by seasonSlotService.snapshotEpisode at Start Episode and when
 *    an episode is placed in a slot.
 * 2. Backfill: every live episode already in a slot (migration
 *    20261001230000 placed the current episode in slot 1) and with no
 *    snapshot gets one, its season_number, and its brief's arc_number /
 *    position_in_arc where those are empty. Logs its count.
 *
 * Guarded: the column is added only when absent; the backfill skips
 * episodes that already have a snapshot, so a re-run changes nothing.
 * down drops the column.
 */

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[migration 20261001240000] JSON parse failed; default used:', err.message);
    return fallback;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, 'episodes', transaction))) return;
      const [cols] = await sequelize.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'episodes' AND column_name = 'season_context'`,
        { transaction });
      if (!cols.length) {
        await queryInterface.addColumn('episodes', 'season_context', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      }

      if (!(await tableExists(sequelize, 'season_slots', transaction))) return;
      const [slots] = await sequelize.query(
        `SELECT s.episode_id, s.slot_number, s.season_number, s.phase, s.story_purpose, s.career_focus,
                s.desired_pressure, s.outcome_range, a.id AS arc_id, a.title AS arc_title, a.phases
           FROM season_slots s
           JOIN show_arcs a ON a.id = s.arc_id
           JOIN episodes ep ON ep.id = s.episode_id AND ep.deleted_at IS NULL
          WHERE s.deleted_at IS NULL AND ep.season_context IS NULL`,
        { transaction });
      const hasBriefs = await tableExists(sequelize, 'episode_briefs', transaction);

      for (const s of slots) {
        const phases = parseJson(s.phases, []);
        const phase = (Array.isArray(phases) ? phases : []).find((p) => Number(p.phase) === Number(s.phase)) || {};
        const start = Number(phase.episode_start) || ((s.phase - 1) * 8 + 1);
        const season = s.season_number || 1;
        const context = {
          season_number: season,
          label: `S${season} · E${s.slot_number}`,
          slot_number: s.slot_number,
          arc_id: s.arc_id,
          arc_title: s.arc_title,
          phase: {
            number: s.phase,
            title: phase.title || null,
            tagline: phase.tagline || null,
            emotional_arc: phase.emotional_arc || null,
          },
          position_in_phase: s.slot_number - start + 1,
          story_purpose: s.story_purpose || null,
          career_focus: s.career_focus || null,
          desired_pressure: s.desired_pressure || null,
          outcome_range: parseJson(s.outcome_range, null),
          snapshotted_at: new Date().toISOString(),
        };
        await sequelize.query(
          `UPDATE episodes SET season_context = CAST(:context AS jsonb), season_number = :season, updated_at = NOW()
            WHERE id = :episodeId`,
          { replacements: { context: JSON.stringify(context), season, episodeId: s.episode_id }, transaction });
        if (hasBriefs) {
          await sequelize.query(
            `UPDATE episode_briefs
                SET arc_number = COALESCE(arc_number, :phase), position_in_arc = COALESCE(position_in_arc, :position)
              WHERE episode_id = :episodeId AND deleted_at IS NULL`,
            { replacements: { phase: s.phase, position: context.position_in_phase, episodeId: s.episode_id }, transaction });
        }
      }
      console.log(`[migration 20261001240000] season context snapshotted on ${slots.length} slotted episode(s)`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    const [cols] = await sequelize.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'episodes' AND column_name = 'season_context'`);
    if (cols.length) await queryInterface.removeColumn('episodes', 'season_context');
  },
};
