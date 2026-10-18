'use strict';

/**
 * The world as the script writers see it (Evoni, 2026-10-18: "yes start the
 * world facts and temperature"; the world-level audit found both writers
 * loaded the world snapshot and used only Lala's character states, and the
 * world temperature recorded after each accepted episode was only shown).
 *
 *   latestTemperatureForShow(sequelize, showId)  the newest world
 *     temperature recorded for the show's universe (or for none), with its
 *     label, what it means and which way it is going, or null. Never throws.
 *   worldNowBlock({ snapshot, temperature })  the snapshot's world facts
 *     (State tab) and the temperature as a prompt section ('' for neither)
 *   worldNowForShow(sequelize, showId, snapshot)  the block for a show
 */

const { factsOf } = require('./worldFacts');
const { TEMPERATURE_LABEL } = require('./worldSnapshotForShow');

const MAX_FACTS = 12;
const TRAJECTORY_WORDS = {
  RISING_FAST: 'rising fast', RISING: 'rising', STABLE: 'steady', FALLING: 'falling', FALLING_FAST: 'falling fast',
};

async function latestTemperatureForShow(sequelize, showId) {
  try {
    const [rows] = await sequelize.query(
      `SELECT wss.metadata FROM world_state_snapshots wss
       WHERE wss.deleted_at IS NULL
         AND wss.snapshot_label = :temperature
         AND (wss.universe_id IS NULL
              OR wss.universe_id = (SELECT s.universe_id FROM shows s WHERE s.id = :showId))
       ORDER BY wss.created_at DESC
       LIMIT 2`,
      { replacements: { showId: showId || null, temperature: TEMPERATURE_LABEL } });
    const { temperatureOf } = require('./worldFacts');
    const [now, before] = (rows || []).map((r) => temperatureOf({ metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata }));
    if (!now) return null;
    const { getTemperatureLabel, computeTrajectory } = require('./worldTemperatureService');
    const label = getTemperatureLabel(now.value);
    return {
      value: now.value,
      label: label.label,
      meaning: label.meaning,
      trajectory: before ? computeTrajectory(now.value, { metadata: { world_temperature: before } }) : null,
      updated_at: now.updated_at || null,
    };
  } catch (err) {
    console.error('[worldNow] the world temperature could not be read:', err?.message);
    return null;
  }
}

function worldNowBlock({ snapshot = null, temperature = null } = {}) {
  const facts = factsOf(snapshot).slice(0, MAX_FACTS);
  const parts = [];
  if (facts.length) parts.push(`What is true in the LalaVerse now (the script agrees with it):\n${facts.map((f) => `- ${f}`).join('\n')}`);
  if (temperature) {
    const way = temperature.trajectory ? `, ${TRAJECTORY_WORDS[temperature.trajectory] || 'steady'} since the last episode` : '';
    parts.push(`World temperature: ${Math.round(temperature.value)}/100, ${temperature.label}${way}. ${temperature.meaning} Let the episode's pressure and how people treat Lala fit it.`);
  }
  return parts.length ? `═══ THE WORLD NOW ═══\n${parts.join('\n')}\n` : '';
}

async function worldNowForShow(sequelize, showId, snapshot = null) {
  return worldNowBlock({ snapshot, temperature: await latestTemperatureForShow(sequelize, showId) });
}

module.exports = { latestTemperatureForShow, worldNowBlock, worldNowForShow, MAX_FACTS };
