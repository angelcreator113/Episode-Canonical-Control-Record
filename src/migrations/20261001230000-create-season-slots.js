'use strict';

/**
 * Season Arc slots (Evoni's rulings, 2026-10-01; docs/EVENT_EPISODE_FLOW.md
 * §8(ff); build PR 1 of docs/SEASON_ARC_DESIGN_NOTE.md):
 *
 *   A2. "A season has 24 episode slots in three phases: Foundation (1–8),
 *   Ascension (9–16), Legacy (17–24). The Season Arc page centres on this
 *   roadmap, each slot showing its state: done, in production, event ready,
 *   needs an event."
 *   Q1. "the existing "Soft Luxury Ascension" season is Season 1; my current
 *   episode is slot 1."
 *   Q4 (accepted recommendation). "fill slots in episode_number order,
 *   counting your current episode as slot 1. List any other existing episode
 *   for you to place or leave unslotted, rather than guess."
 *
 * 1. season_slots: one row per (arc, slot 1–24).
 *      show_id, arc_id, season_number, slot_number, phase
 *      event_id      an event pencilled into the slot (Q5; nullable)
 *      episode_id    the episode started in it (nullable)
 *      intention     story_purpose, career_focus, desired_pressure
 *                    (Low · Medium · High · Peak, Q7), story_thread_id,
 *                    outcome_range (JSONB, a tier range, Q10),
 *                    intention_source ('auto-drafted' | 'edited')
 *      result        actual_outcome, actual_pressure, accepted_at
 *      locked_at     set at Start Episode (A7)
 *      timestamps, deleted_at (paranoid)
 *    The intention and result columns are filled by later PRs; nothing
 *    writes them here.
 * 2. For every live, active show_arcs row: its 24 slots, phase from the
 *    arc's phases JSON (falling back to 1–8 / 9–16 / 17–24).
 * 3. Slot 1 takes the show's current episode only when the show has exactly
 *    one live episode, so it is not a guess. With several, no episode is
 *    placed: the roadmap lists them as not in a slot. Logs its counts;
 *    production counts are known only when it runs.
 *
 * Guarded: the table is created only when absent; the data step skips arcs
 * that already have slots, so a re-run changes nothing. down drops the table.
 */

const SLOTS = 24;

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

function parsePhases(value) {
  if (value == null) return [];
  if (typeof value !== 'string') return Array.isArray(value) ? value : [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[migration 20261001230000] show_arcs.phases JSON parse failed; default phases used:', err.message);
    return [];
  }
}

function phaseFor(slot, phases) {
  const match = phases.find((p) => Number(p.episode_start) <= slot && slot <= Number(p.episode_end));
  if (match && Number.isInteger(Number(match.phase))) return Number(match.phase);
  return Math.min(3, Math.ceil(slot / 8));
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, 'season_slots', transaction))) {
        await queryInterface.createTable('season_slots', {
          id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
          show_id: {
            type: Sequelize.UUID, allowNull: false,
            references: { model: 'shows', key: 'id' }, onDelete: 'CASCADE',
          },
          arc_id: {
            type: Sequelize.UUID, allowNull: false,
            references: { model: 'show_arcs', key: 'id' }, onDelete: 'CASCADE',
          },
          season_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
          slot_number: { type: Sequelize.INTEGER, allowNull: false },
          phase: { type: Sequelize.INTEGER, allowNull: false },
          event_id: { type: Sequelize.UUID, allowNull: true },
          episode_id: { type: Sequelize.UUID, allowNull: true },
          story_purpose: { type: Sequelize.TEXT, allowNull: true },
          career_focus: { type: Sequelize.TEXT, allowNull: true },
          desired_pressure: { type: Sequelize.STRING(10), allowNull: true },
          story_thread_id: { type: Sequelize.UUID, allowNull: true },
          outcome_range: { type: Sequelize.JSONB, allowNull: true },
          intention_source: { type: Sequelize.STRING(20), allowNull: true },
          actual_outcome: { type: Sequelize.STRING(10), allowNull: true },
          actual_pressure: { type: Sequelize.STRING(10), allowNull: true },
          accepted_at: { type: Sequelize.DATE, allowNull: true },
          locked_at: { type: Sequelize.DATE, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS season_slots_arc_slot_live
           ON season_slots (arc_id, slot_number) WHERE deleted_at IS NULL`, { transaction });
      await sequelize.query(
        'CREATE INDEX IF NOT EXISTS season_slots_show_id ON season_slots (show_id)', { transaction });

      if (!(await tableExists(sequelize, 'show_arcs', transaction))) return;
      const [arcs] = await sequelize.query(
        `SELECT a.id, a.show_id, a.season_number, a.phases
           FROM show_arcs a
          WHERE a.status = 'active' AND a.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM season_slots s WHERE s.arc_id = a.id AND s.deleted_at IS NULL)`,
        { transaction });
      const hasEpisodes = await tableExists(sequelize, 'episodes', transaction);

      let created = 0;
      let placed = 0;
      let unplaced = 0;
      for (const arc of arcs) {
        const phases = parsePhases(arc.phases);
        let slotOneEpisode = null;
        if (hasEpisodes) {
          const [episodes] = await sequelize.query(
            'SELECT id FROM episodes WHERE show_id = :showId AND deleted_at IS NULL',
            { replacements: { showId: arc.show_id }, transaction });
          if (episodes.length === 1) slotOneEpisode = episodes[0].id;
          else unplaced += episodes.length;
        }
        for (let slot = 1; slot <= SLOTS; slot += 1) {
          const episodeId = slot === 1 ? slotOneEpisode : null;
          await sequelize.query(
            `INSERT INTO season_slots (id, show_id, arc_id, season_number, slot_number, phase, episode_id,
                                       locked_at, created_at, updated_at)
             VALUES (gen_random_uuid(), :showId, :arcId, :season, :slot, :phase, :episodeId,
                     CASE WHEN CAST(:episodeId AS uuid) IS NULL THEN NULL ELSE NOW() END, NOW(), NOW())`,
            { replacements: {
              showId: arc.show_id, arcId: arc.id, season: arc.season_number || 1,
              slot, phase: phaseFor(slot, phases), episodeId,
            }, transaction });
          created += 1;
        }
        if (slotOneEpisode) placed += 1;
      }
      console.log(`[migration 20261001230000] ${created} slot(s) for ${arcs.length} active arc(s); `
        + `${placed} current episode(s) placed in slot 1; ${unplaced} episode(s) left for Evoni to place`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (await tableExists(sequelize, 'season_slots')) {
      await queryInterface.dropTable('season_slots');
    }
  },
};
