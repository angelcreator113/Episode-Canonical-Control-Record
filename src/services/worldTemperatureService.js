/**
 * World Temperature Service — v1.1 (field-corrected)
 *
 * Scoping corrections:
 *   - StoryThread: scoped by universe_id (has it), NOT show_id
 *   - WorldStateSnapshot: scoped by universe_id (has it), NOT show_id
 *   - CharacterRelationship: scoped through characters join (no direct universe_id)
 *
 * Field corrections:
 *   - CharacterRelationship.tension_state (STRING) → parsed to numeric via weight map
 *   - CharacterRelationship has NO tension_level → derive from tension_state string
 *   - StoryThread.tension_level (INTEGER) → use directly
 *   - StoryThread missing tension_state → use tension_level directly, no state weight
 *   - StoryThread missing stakes_level → dropped
 *   - StoryThread missing visibility_score → use chapters_since_last_reference (inverted)
 *   - WorldStateSnapshot.snapshot_label (not snapshot_type)
 *   - WorldStateSnapshot: no show_id → use universe_id for upsert key
 */

const { Op } = require('sequelize');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TEMPERATURE_LABELS = {
  COLD:     { range: [0, 15],   label: 'COLD',     meaning: 'Lala is invisible. No heat, no threat, no opportunity.' },
  COOL:     { range: [16, 30],  label: 'COOL',     meaning: 'Lala is present but unproven. World is indifferent.' },
  NEUTRAL:  { range: [31, 50],  label: 'NEUTRAL',  meaning: 'Steady state. World is watching without strong opinion.' },
  WARM:     { range: [51, 65],  label: 'WARM',     meaning: 'Lala is noticed. Interest is building — in both directions.' },
  HOT:      { range: [66, 80],  label: 'HOT',      meaning: 'High attention. Brands are curious. Rivals are activated.' },
  VOLATILE: { range: [81, 100], label: 'VOLATILE', meaning: 'World is polarized around Lala. High risk, high reward.' },
};

// Maps tension_state string → numeric weight (0-10 scale)
// Used for CharacterRelationship which has tension_state but not tension_level
const TENSION_STATE_TO_LEVEL = {
  volatile:  10,
  fractured: 8.5,
  simmering: 6.5,
  calm:      3,
  healing:   2,
};

const DOMAIN_WEIGHTS = {
  brand:     0.35,
  social:    0.30,
  personal:  0.20,
  narrative: 0.15,
};

// Max chapters_since_last_reference before a thread is considered invisible
const MAX_CHAPTERS_FOR_VISIBILITY = 10;

// ─── MAIN AGGREGATOR ──────────────────────────────────────────────────────────

/**
 * Compute current world temperature.
 *
 * @param {string} universeId  — scope for StoryThread + WorldStateSnapshot
 * @param {object} models      — { StoryThread, CharacterRelationship, WorldStateSnapshot, Character }
 * @param {object} options     — { characterIds: [] } optional pre-fetched character IDs for relationship scoping
 * @returns {object} World temperature reading
 */
async function computeWorldTemperature(universeId, models, options = {}) {
  const { StoryThread, CharacterRelationship, WorldStateSnapshot, Character } = models;

  // ── Load StoryThreads scoped by universe_id ───────────────────────────────
  const threads = await StoryThread.findAll({
    where: {
      universe_id: universeId,
      status: { [Op.notIn]: ['resolved', 'abandoned'] },
    },
    attributes: [
      'id', 'tension_level', 'thread_type', 'status',
      'chapters_since_last_reference',
    ],
  }).catch(() => []);

  // ── Load CharacterRelationships scoped through characters ─────────────────
  // CharacterRelationship has no universe_id — scope via character IDs
  let relationships = [];
  try {
    // Get character IDs for this universe
    let characterIds = options.characterIds || [];
    if (!characterIds.length && Character) {
      const chars = await Character.findAll({
        where: { universe_id: universeId },
        attributes: ['id'],
      });
      characterIds = chars.map(c => c.id);
    }

    if (characterIds.length > 0) {
      relationships = await CharacterRelationship.findAll({
        where: {
          [Op.or]: [
            { character_id_a: { [Op.in]: characterIds } },
            { character_id_b: { [Op.in]: characterIds } },
          ],
          deleted_at: null,
          // Only relationships with meaningful tension
          tension_state: { [Op.in]: ['volatile', 'fractured', 'simmering'] },
        },
        attributes: ['id', 'tension_state', 'relationship_type', 'role_tag'],
      });
    }
  } catch (err) {
    // Graceful degradation — relationship data is enrichment, not required
    console.warn('[WorldTemp] CharacterRelationship query failed (non-blocking):', err.message);
  }

  // ── Load most recent WorldStateSnapshot ───────────────────────────────────
  const latestSnapshot = await WorldStateSnapshot.findOne({
    where: { universe_id: universeId },
    order: [['created_at', 'DESC']],
    attributes: ['world_facts', 'active_threads', 'relationship_states'],
  }).catch(() => null);

  // ── Compute domain temperatures ───────────────────────────────────────────

  const brandRelationships    = relationships.filter(r => isBrandRelationship(r));
  const socialRelationships   = relationships.filter(r => isSocialRelationship(r));
  const personalThreads       = threads.filter(t => isPersonalThread(t));
  const narrativeThreads      = threads.filter(t => !isPersonalThread(t));

  const domainTemps = {
    brand:     computeRelationshipDomainTemp(brandRelationships),
    social:    computeRelationshipDomainTemp(socialRelationships),
    personal:  computeThreadDomainTemp(personalThreads),
    narrative: computeThreadDomainTemp(narrativeThreads),
  };

  // ── Weighted aggregate ────────────────────────────────────────────────────
  const rawTemp = Object.entries(DOMAIN_WEIGHTS).reduce((total, [domain, weight]) => {
    return total + (domainTemps[domain].score * weight);
  }, 0);

  const temperature = Math.round(Math.min(100, Math.max(0, rawTemp)));
  const label = getTemperatureLabel(temperature);
  const trajectory = computeTrajectory(temperature, latestSnapshot);
  const directorFeed = buildDirectorFeed(temperature, domainTemps, trajectory);

  // ── Top active tensions for UI ────────────────────────────────────────────
  const activeTensions = buildActiveTensions(threads, relationships);

  return {
    universeId,
    temperature,
    label: label.label,
    meaning: label.meaning,
    trajectory,
    domains: domainTemps,
    activeTensions,
    directorFeed,
    computedAt: new Date().toISOString(),
    dataPoints: {
      threadsAnalyzed: threads.length,
      relationshipsAnalyzed: relationships.length,
      hasSnapshot: !!latestSnapshot,
    },
  };
}

// ─── DOMAIN TEMPERATURE COMPUTERS ────────────────────────────────────────────

/**
 * CharacterRelationship domain — derives numeric tension from tension_state string
 */
function computeRelationshipDomainTemp(relationships) {
  if (relationships.length === 0) {
    return { score: 30, itemCount: 0, dominantState: 'calm' };
  }

  const scores = relationships.map(r => {
    const level = TENSION_STATE_TO_LEVEL[r.tension_state] || 3;
    // Normalize 0-10 level to 0-100 score
    return Math.round((level / 10) * 100);
  });

  const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
  const max = Math.max(...scores);
  const blended = Math.round((avg * 0.6) + (max * 0.4));

  const stateCounts = relationships.reduce((acc, r) => {
    acc[r.tension_state] = (acc[r.tension_state] || 0) + 1;
    return acc;
  }, {});
  const dominantState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'calm';

  return { score: blended, itemCount: relationships.length, dominantState, hottest: max };
}

/**
 * StoryThread domain — uses tension_level (INTEGER, 0-10) directly
 * Visibility derived from chapters_since_last_reference (inverted)
 */
function computeThreadDomainTemp(threads) {
  if (threads.length === 0) {
    return { score: 20, itemCount: 0, dominantState: 'calm' };
  }

  const scores = threads.map(t => {
    const tensionLevel = t.tension_level || 0;

    // Visibility: fewer chapters since last reference = more visible = more temperature contribution
    const chapsSince = t.chapters_since_last_reference || 0;
    const visibility = Math.max(0, 1 - (chapsSince / MAX_CHAPTERS_FOR_VISIBILITY));

    // Score = tension × visibility (inactive threads contribute less)
    return Math.round((tensionLevel / 10) * 100 * (0.5 + visibility * 0.5));
  });

  const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
  const max = Math.max(...scores);
  const blended = Math.round((avg * 0.6) + (max * 0.4));

  // Derive dominant state from tension_level ranges (no tension_state on StoryThread)
  const avgTension = threads.reduce((s, t) => s + (t.tension_level || 0), 0) / threads.length;
  const dominantState = avgTension >= 8 ? 'volatile'
                      : avgTension >= 6 ? 'simmering'
                      : avgTension >= 3 ? 'calm'
                      : 'healing';

  return { score: blended, itemCount: threads.length, dominantState, hottest: max };
}

// ─── CLASSIFICATION HELPERS ───────────────────────────────────────────────────

function isBrandRelationship(r) {
  const tags = ['brand', 'sponsor', 'partner', 'client', 'management'];
  const text = `${r.role_tag || ''} ${r.relationship_type || ''}`.toLowerCase();
  return tags.some(tag => text.includes(tag));
}

function isSocialRelationship(r) {
  const tags = ['rival', 'ally', 'feud', 'shade', 'copycat', 'collab'];
  const text = `${r.role_tag || ''} ${r.relationship_type || ''}`.toLowerCase();
  return tags.some(tag => text.includes(tag));
}

function isPersonalThread(t) {
  const personalTypes = ['wound', 'belief', 'belonging', 'identity', 'self', 'internal'];
  return personalTypes.some(type => (t.thread_type || '').toLowerCase().includes(type));
}

// ─── LABEL + TRAJECTORY ───────────────────────────────────────────────────────

function getTemperatureLabel(temp) {
  for (const [, def] of Object.entries(TEMPERATURE_LABELS)) {
    if (temp >= def.range[0] && temp <= def.range[1]) return def;
  }
  return TEMPERATURE_LABELS.NEUTRAL;
}

function computeTrajectory(currentTemp, snapshot) {
  if (!snapshot) return 'STABLE';
  const prevTemp = snapshot.world_facts?.worldTemperature;
  if (typeof prevTemp !== 'number') return 'STABLE';

  const delta = currentTemp - prevTemp;
  if (delta >= 15) return 'RISING_FAST';
  if (delta >= 5)  return 'RISING';
  if (delta <= -15) return 'FALLING_FAST';
  if (delta <= -5)  return 'FALLING';
  return 'STABLE';
}

// ─── DIRECTOR BRAIN FEED ──────────────────────────────────────────────────────

function buildDirectorFeed(temp, domains, trajectory) {
  const feed = { episodeSuggestions: [], eventModifiers: [], narrativePressure: null };

  if (temp >= 81) {
    feed.episodeSuggestions.push('High volatility — ideal for FAIL or high-stakes SLAY episode');
    feed.episodeSuggestions.push('Rivals are active — consider introducing rival antagonism');
    feed.narrativePressure = 'MAXIMUM';
  } else if (temp >= 66) {
    feed.episodeSuggestions.push('Lala is HOT right now — brands are watching');
    feed.episodeSuggestions.push('Good window for brand deal or prestige event');
    feed.narrativePressure = 'HIGH';
  } else if (temp >= 51) {
    feed.episodeSuggestions.push('World is warming to Lala — build on momentum');
    feed.episodeSuggestions.push('PASS or SLAY episode appropriate');
    feed.narrativePressure = 'MODERATE';
  } else if (temp >= 31) {
    feed.episodeSuggestions.push('Steady state — good for character development');
    feed.narrativePressure = 'LOW';
  } else {
    feed.episodeSuggestions.push('World is cold — Lala needs to create heat');
    feed.episodeSuggestions.push('Trial episode moment — prove herself');
    feed.narrativePressure = 'NONE';
  }

  if (domains.brand.score >= 60) {
    feed.eventModifiers.push('Brand relationships are tense — complications likely in any brand episode');
  }
  if (domains.social.score >= 60) {
    feed.eventModifiers.push('Social circle is charged — rival or ally appearance is earned here');
  }
  if (trajectory === 'RISING_FAST') {
    feed.eventModifiers.push('Temperature rising fast — elevated stakes regardless of design');
  } else if (trajectory === 'FALLING_FAST') {
    feed.eventModifiers.push('Temperature dropping — Lala is losing heat. Recovery or bold move needed.');
  }

  return feed;
}

// ─── ACTIVE TENSIONS BUILDER ─────────────────────────────────────────────────

function buildActiveTensions(threads, relationships) {
  const threadItems = threads.map(t => ({
    type: 'thread',
    id: t.id,
    tension: Math.round((t.tension_level || 0) / 10 * 100),
    label: t.thread_type || 'Narrative Thread',
    state: t.tension_level >= 8 ? 'volatile' : t.tension_level >= 5 ? 'simmering' : 'calm',
  }));

  const relItems = relationships.map(r => ({
    type: 'relationship',
    id: r.id,
    tension: Math.round((TENSION_STATE_TO_LEVEL[r.tension_state] || 3) / 10 * 100),
    label: r.role_tag || r.relationship_type || 'Relationship',
    state: r.tension_state,
  }));

  return [...threadItems, ...relItems]
    .sort((a, b) => b.tension - a.tension)
    .slice(0, 5);
}

// ─── SNAPSHOT WRITER ─────────────────────────────────────────────────────────

/**
 * Persist current temperature to WorldStateSnapshot after episode accept.
 * Uses universe_id (not show_id). Uses snapshot_label (not snapshot_type).
 */
async function snapshotTemperature(universeId, temperature, models) {
  const { WorldStateSnapshot } = models;

  try {
    const existing = await WorldStateSnapshot.findOne({
      where: { universe_id: universeId },
      order: [['created_at', 'DESC']],
    });

    const worldFacts = {
      ...(existing?.world_facts || {}),
      worldTemperature: temperature,
      temperatureUpdatedAt: new Date().toISOString(),
    };

    // WorldStateSnapshot has no show_id — create new snapshot record
    await WorldStateSnapshot.create({
      universe_id: universeId,
      world_facts: worldFacts,
      snapshot_label: 'temperature_update',
    });
  } catch (err) {
    console.warn('[WorldTemp] Snapshot write failed (non-blocking):', err.message);
  }
}

module.exports = {
  computeWorldTemperature,
  snapshotTemperature,
  getTemperatureLabel,
  TEMPERATURE_LABELS,
};
