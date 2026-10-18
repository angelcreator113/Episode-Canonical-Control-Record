'use strict';

/**
 * The season blueprint's reveal plan (Evoni, 2026-10-17, stage E of the
 * storytelling plan: "Inner Life + Season Blueprint -> Episode -> Short
 * Story -> Chapter Book, with continuity and revelation permissions checked
 * at every stage"; "The chapter book should shape what characters do in
 * episodes, even when the audience won't discover why until much later").
 *
 * Which kept secret the season hints at or reveals in which slot
 * (season_reveals). The plan becomes each episode's permission:
 *   - the episode script and episode story for that slot's episode read the
 *     planned secrets as hint or reveal, whatever the secret's own setting;
 *   - the chapter writer reads the whole season: the arc and this slot's
 *     purpose, what is planned here, and what comes later (to foreshadow,
 *     never to reveal early).
 * The plan checks itself: a reveal with no hint before it, a hint after the
 * reveal, a reveal of a secret the audience already knows, two reveals.
 *
 *   getPlan(sequelize, showId)                    { arc, slots, secrets, reveals, warnings }
 *   setReveal(sequelize, showId, body, { by })    adds or changes one (slot + secret)
 *   deleteReveal(sequelize, showId, revealId)
 *   planForEpisode(sequelize, episodeId)          Map secret_id -> { intent, note }
 *   withPlan(secrets, plan, layer)                the secrets with this episode's plan applied
 *   seasonBlock(sequelize, episodeId)             the season, as prompt text for the chapter writer; ''
 *
 * Raw SQL (season_reveals, migration 20261018070000); no model.
 */

const { episodeLabel } = require('./seasonSlotService');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INTENTS = ['hint', 'reveal'];

class RevealPlanError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.name = 'RevealPlanError'; }
}

const parse = (v, fallback) => {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[seasonRevealPlan] unreadable JSON:', err.message);
    return fallback;
  }
};

async function activeArc(sequelize, showId) {
  const [[arc]] = await sequelize.query(
    `SELECT id, title, tagline, season_number, phases, current_phase FROM show_arcs
      WHERE show_id = :showId AND deleted_at IS NULL ORDER BY (status = 'active') DESC, arc_number ASC LIMIT 1`,
    { replacements: { showId } });
  return arc || null;
}

/** The show's kept secrets (every character in a registry of the show), with whose they are. */
async function showSecrets(sequelize, showId) {
  const [rows] = await sequelize.query(
    `SELECT s.id, s.text, s.state, s.permissions, rc.id AS character_id, COALESCE(rc.selected_name, rc.display_name) AS character_name
       FROM character_secrets s
       JOIN registry_characters rc ON rc.id = s.registry_character_id AND rc.deleted_at IS NULL
       JOIN character_registries cr ON cr.id = rc.registry_id AND cr.deleted_at IS NULL
      WHERE cr.show_id = :showId AND s.deleted_at IS NULL AND s.status = 'confirmed'
      ORDER BY rc.display_name, s.created_at`, { replacements: { showId } });
  return rows;
}

/** What is wrong with the plan, slot by slot. */
function checkPlan(reveals, secrets) {
  const warnings = [];
  const byId = new Map(secrets.map((s) => [s.id, s]));
  const bySecret = new Map();
  for (const r of reveals) bySecret.set(r.secret_id, [...(bySecret.get(r.secret_id) || []), r]);
  for (const [secretId, list] of bySecret) {
    const secret = byId.get(secretId);
    if (!secret) continue;
    const name = `${secret.character_name}: ${secret.text}`;
    const reveals_ = list.filter((r) => r.intent === 'reveal');
    const hints = list.filter((r) => r.intent === 'hint');
    if (reveals_.length > 1) warnings.push({ secret_id: secretId, text: `${name} is revealed in ${reveals_.map((r) => r.label).join(' and ')}. Reveal it once.` });
    const first = reveals_.sort((a, b) => a.slot_number - b.slot_number)[0];
    if (first) {
      if (secret.state === 'revealed') warnings.push({ secret_id: secretId, text: `${name}: the audience already knows it; ${first.label} cannot reveal it again.` });
      else if (secret.state === 'hidden' && !hints.some((h) => h.slot_number < first.slot_number)) {
        warnings.push({ secret_id: secretId, text: `${name} is revealed in ${first.label} with no hint before it.` });
      }
      const late = hints.filter((h) => h.slot_number > first.slot_number);
      if (late.length) warnings.push({ secret_id: secretId, text: `${name} is hinted in ${late.map((h) => h.label).join(', ')}, after it is revealed in ${first.label}.` });
    }
  }
  return warnings;
}

/** The season's slots, the show's kept secrets, the plan and what is wrong with it. */
async function getPlan(sequelize, showId) {
  if (!UUID_RE.test(String(showId || ''))) throw new RevealPlanError('showId must be a UUID');
  const arc = await activeArc(sequelize, showId);
  if (!arc) return { arc: null, slots: [], secrets: [], reveals: [], warnings: [] };
  const [slotRows] = await sequelize.query(
    `SELECT s.id, s.slot_number, s.phase, s.story_purpose, s.accepted_at, ep.id AS episode_id, ep.title AS episode_title
       FROM season_slots s LEFT JOIN episodes ep ON ep.id = s.episode_id AND ep.deleted_at IS NULL
      WHERE s.arc_id = :arcId AND s.deleted_at IS NULL ORDER BY s.slot_number`, { replacements: { arcId: arc.id } });
  const label = (n) => episodeLabel(arc.season_number, n);
  const slots = slotRows.map((s) => ({
    id: s.id, slot_number: s.slot_number, phase: s.phase, label: label(s.slot_number), story_purpose: s.story_purpose,
    episode: s.episode_id ? { id: s.episode_id, title: s.episode_title } : null, done: Boolean(s.accepted_at),
  }));
  const secrets = await showSecrets(sequelize, showId);
  const [rows] = await sequelize.query(
    `SELECT r.id, r.slot_id, r.secret_id, r.intent, r.note, s.slot_number
       FROM season_reveals r JOIN season_slots s ON s.id = r.slot_id AND s.deleted_at IS NULL AND s.arc_id = :arcId
      WHERE r.show_id = :showId AND r.deleted_at IS NULL ORDER BY s.slot_number, r.created_at`,
    { replacements: { showId, arcId: arc.id } });
  const reveals = rows.map((r) => ({ ...r, label: label(r.slot_number) }));
  return {
    arc: { id: arc.id, title: arc.title, tagline: arc.tagline, season_number: arc.season_number || 1 },
    slots, secrets, reveals, warnings: checkPlan(reveals, secrets),
  };
}

/** Adds a secret to a slot's plan, or changes it; a RevealPlanError when it does not belong to the show. */
async function setReveal(sequelize, showId, body = {}, { by = null } = {}) {
  if (!UUID_RE.test(String(showId || ''))) throw new RevealPlanError('showId must be a UUID');
  const intent = body.intent || 'hint';
  if (!INTENTS.includes(intent)) throw new RevealPlanError('The plan is to hint at it or reveal it.');
  if (!UUID_RE.test(String(body.slot_id || '')) || !UUID_RE.test(String(body.secret_id || ''))) throw new RevealPlanError('Choose a slot and a secret.');
  const [[slot]] = await sequelize.query(
    'SELECT id, accepted_at FROM season_slots WHERE id = :id AND show_id = :showId AND deleted_at IS NULL', { replacements: { id: body.slot_id, showId } });
  if (!slot) throw new RevealPlanError('That slot is not in this show\'s season.', 404);
  if (slot.accepted_at) throw new RevealPlanError('That episode is done; its story record says what it showed.', 409);
  if (!(await showSecrets(sequelize, showId)).some((s) => s.id === body.secret_id)) {
    throw new RevealPlanError('That secret is not kept by anyone in this show.', 404);
  }
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  const [[existing]] = await sequelize.query(
    'SELECT id FROM season_reveals WHERE slot_id = :slot AND secret_id = :secret AND deleted_at IS NULL',
    { replacements: { slot: body.slot_id, secret: body.secret_id } });
  if (existing) {
    await sequelize.query('UPDATE season_reveals SET intent = :intent, note = :note, updated_at = NOW() WHERE id = :id',
      { replacements: { id: existing.id, intent, note } });
  } else {
    await sequelize.query(
      `INSERT INTO season_reveals (show_id, slot_id, secret_id, intent, note, created_by, created_at, updated_at)
       VALUES (:showId, :slot, :secret, :intent, :note, :by, NOW(), NOW())`,
      { replacements: { showId, slot: body.slot_id, secret: body.secret_id, intent, note, by } });
  }
  return getPlan(sequelize, showId);
}

async function deleteReveal(sequelize, showId, revealId) {
  if (!UUID_RE.test(String(revealId || ''))) throw new RevealPlanError('revealId must be a UUID');
  const [rows] = await sequelize.query(
    'UPDATE season_reveals SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id AND show_id = :showId AND deleted_at IS NULL RETURNING id',
    { replacements: { id: revealId, showId } });
  if (!rows.length) throw new RevealPlanError('Not in the plan.', 404);
  return getPlan(sequelize, showId);
}

/** The plan for the episode's slot: secret id -> { intent, note }; empty with none or no table yet. */
async function planForEpisode(sequelize, episodeId) {
  const out = new Map();
  if (!UUID_RE.test(String(episodeId || ''))) return out;
  try {
    const [rows] = await sequelize.query(
      `SELECT r.secret_id, r.intent, r.note FROM season_reveals r
         JOIN season_slots s ON s.id = r.slot_id AND s.deleted_at IS NULL
        WHERE s.episode_id = :episodeId AND r.deleted_at IS NULL`, { replacements: { episodeId } });
    for (const r of rows) out.set(r.secret_id, { intent: r.intent, note: r.note });
  } catch (err) {
    // Before the migration has run the table is not there: the writers go without a plan.
    console.error('[seasonRevealPlan] the plan could not be read:', err.message);
  }
  return out;
}

/** The secrets with this episode's plan as their permission for the layer, marked planned. */
function withPlan(secrets, plan, layer) {
  if (!plan || !plan.size) return secrets || [];
  return (secrets || []).map((s) => {
    const p = plan.get(s.id);
    return p ? { ...s, permissions: { ...(s.permissions || {}), [layer]: p.intent }, planned: p.note || true } : s;
  });
}

/** The season as the chapter writer needs it: the arc, this slot, and the plan around it; ''. */
async function seasonBlock(sequelize, episodeId) {
  if (!UUID_RE.test(String(episodeId || ''))) return '';
  try {
    const [[slot]] = await sequelize.query(
      `SELECT s.id, s.show_id, s.arc_id, s.slot_number, s.phase, s.story_purpose, a.title, a.tagline, a.season_number, a.phases
         FROM season_slots s JOIN show_arcs a ON a.id = s.arc_id AND a.deleted_at IS NULL
        WHERE s.episode_id = :episodeId AND s.deleted_at IS NULL LIMIT 1`, { replacements: { episodeId } });
    if (!slot) return '';
    const phase = (parse(slot.phases, []) || []).find((p) => Number(p.phase) === Number(slot.phase));
    const [rows] = await sequelize.query(
      `SELECT r.intent, r.note, s.slot_number, cs.text, COALESCE(rc.selected_name, rc.display_name) AS name
         FROM season_reveals r
         JOIN season_slots s ON s.id = r.slot_id AND s.deleted_at IS NULL AND s.arc_id = :arcId
         JOIN character_secrets cs ON cs.id = r.secret_id AND cs.deleted_at IS NULL
         JOIN registry_characters rc ON rc.id = cs.registry_character_id
        WHERE r.deleted_at IS NULL ORDER BY s.slot_number, r.created_at`, { replacements: { arcId: slot.arc_id } });
    const label = (n) => episodeLabel(slot.season_number, n);
    const line = (r) => `- ${label(r.slot_number)}: ${r.intent === 'reveal' ? 'reveal' : 'hint at'} ${r.name}'s secret: ${r.text}${r.note ? ` (${r.note})` : ''}`;
    const out = [`THE SEASON (${slot.title || 'this season'}${slot.tagline ? `: ${slot.tagline}` : ''}). This is ${label(slot.slot_number)}${phase?.name || phase?.title ? `, in the phase "${phase.name || phase.title}"` : ''}.`];
    if (slot.story_purpose) out.push(`What this episode is for in the season: ${slot.story_purpose}`);
    const before = rows.filter((r) => r.slot_number < slot.slot_number);
    const now = rows.filter((r) => r.slot_number === slot.slot_number);
    const later = rows.filter((r) => r.slot_number > slot.slot_number);
    if (before.length) out.push('Planned before this episode:', ...before.map(line));
    if (now.length) out.push('Planned for this episode:', ...now.map(line));
    if (later.length) out.push('Coming later in the season (let the chapter foreshadow it; never reveal it before its episode):', ...later.map(line));
    return out.join('\n');
  } catch (err) {
    console.error('[seasonRevealPlan] the season could not be read:', err.message);
    return '';
  }
}

module.exports = { RevealPlanError, INTENTS, getPlan, setReveal, deleteReveal, planForEpisode, withPlan, seasonBlock, checkPlan };
