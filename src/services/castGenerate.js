'use strict';

/**
 * "Make one for me" on The Cast (Evoni, 2026-10-19: "Add character" should
 * be made for her, the way the feed's "+ Generate 5" makes Pulse people).
 *
 *   propose(db, { registryId, idea, count })   one text call (claude-sonnet-4-6,
 *       the two-attempt loop; logged and budget-gated by aiCostTracker's patch
 *       of Messages.create) for 1 or 3 proposals. With no idea the call is told
 *       what the registry already has (roles, cities) and fills the gaps, as
 *       feedScheduler.generateSmartSparks does for the feed. LalaVerse
 *       registries read the Show Bible (brainRules.loadBrainContext) and The
 *       Pulse's rules. Nothing is saved.
 *   keep(db, { registryId, proposal, by })     saves one proposal: the registry
 *       character and, in the LalaVerse, its Pulse profile, linked by
 *       feed_profile_id (the link utils/registryLink reads), in one transaction.
 *       The same name as a character already in the registry, or a handle
 *       another profile holds, is refused and nothing is written.
 *
 * Why not characterGenerationService.generateFullCharacter: it makes five calls
 * (an 8,000-token interior plus four more) for one character, so "Try again"
 * would multiply that, and it reads no Show Bible. A kept character's interior
 * is filled later by the existing deepening tools (generateMissingInterior).
 */

const MODELS = ['claude-sonnet-4-6'];
const ROUTE = 'cast-generate';
const ROLES = Object.freeze(['pressure', 'mirror', 'support', 'shadow', 'special']);
const COUNTS = Object.freeze([1, 3]);
const IDEA_MAX = 200;

class CastGenerateError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const text = (v, n) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n));
const keyFor = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** The registry's world, as characterRegistry's worldForNewCharacter reads it. */
function worldOf(registry) {
  return /book\s*1|before lala/i.test(registry?.book_tag || '') ? 'book-1' : 'lalaverse';
}

/** What the registry already has: names, and how many per role and city, for the prompt's gaps. */
async function castOf(db, registryId) {
  const rows = await db.RegistryCharacter.findAll({
    where: { registry_id: registryId },
    attributes: ['display_name', 'selected_name', 'role_type', 'role_label', 'current_city'],
    limit: 200,
  });
  const tally = (key) => rows.reduce((m, r) => (r[key] ? { ...m, [r[key]]: (m[r[key]] || 0) + 1 } : m), {});
  return { rows, roles: tally('role_type'), cities: tally('current_city') };
}

function promptFor({ world, cast, idea, count, brain }) {
  const lala = world !== 'book-1';
  const { DREAM_CITIES } = require('../utils/lalaHome');
  const worldLine = require('./characterGenerationService').worldLineFor({ world });
  const names = cast.rows.map((r) => [r.display_name, r.role_label].filter(Boolean).join(' — ')).slice(0, 80);
  return `You are adding ${count === 1 ? 'one new character' : `${count} new characters`} to the cast of a story.
${worldLine}
${brain ? `${brain}\n` : ''}${lala ? require('../utils/pulsePlatform').pulsePromptRules('lalaverse') : ''}
THE CAST ALREADY (${cast.rows.length}): ${names.join('; ') || 'nobody yet'}
Roles so far: ${JSON.stringify(cast.roles)}. Cities so far: ${JSON.stringify(cast.cities)}.
${idea ? `EVONI'S IDEA: "${idea}". Build ${count === 1 ? 'the character' : 'each character'} from it.` : 'No idea was given: fill a gap in the cast (a role, a city or a kind of person it lacks), each one different.'}

Rules:
- Each is a specific person with a contradiction, not a type. Never reuse a name above.
- Never write Lala or JustAWoman as the new character, and never name Dr. Amara Sinclair.
- role is one of: ${ROLES.join(', ')} (pressure pushes on Lala, mirror reflects her, support helps her, shadow is what she could become, special is anything else).
${lala ? `- city is one of: ${DREAM_CITIES.join(', ')}.\n- pulse is their profile on The Pulse: a handle without @, a bio of 1-2 sentences in their voice, and a whole-number follower_count fitting who they are.` : '- city is "outside_lalaverse". pulse is null.'}

Answer with JSON only, an array of exactly ${count}:
[{"display_name": "the name they go by", "real_name": "their full legal name", "role": "...", "role_label": "a few words, e.g. rival stylist", "summary": "2-3 sentences: who they are and the tension they bring", "city": "...", "age": 0, "gender": "...", "pronouns": "...", "signature_trait": "one line", "core_desire": "one line", "core_fear": "one line", "icon": "one emoji", "pulse": {"handle": "...", "bio": "...", "follower_count": 0}}]`;
}

/** One proposal as the AI gave it, checked; null when there is nothing to keep. */
function shapeProposal(raw, world) {
  if (!raw || typeof raw !== 'object') return null;
  const displayName = text(raw.display_name || raw.real_name, 120);
  if (!displayName) return null;
  const { registryCity } = require('../utils/registryDemographics');
  const lala = world !== 'book-1';
  const city = lala ? registryCity(raw.city) : 'outside_lalaverse';
  const age = Number(raw.age);
  // A handle as characterFacts' HANDLE_RE takes it: letters, numbers, dots and underscores.
  const handle = text(raw.pulse?.handle, 80).replace(/^@+/, '').replace(/\s+/g, '_').replace(/[^A-Za-z0-9._]/g, '').slice(0, 60);
  const followers = Number(raw.pulse?.follower_count);
  return {
    display_name: displayName,
    selected_name: text(raw.real_name, 120) || null,
    role_type: ROLES.includes(raw.role) ? raw.role : 'pressure',
    role_label: text(raw.role_label, 80) || null,
    description: text(raw.summary, 1200) || null,
    current_city: city || null,
    age: Number.isInteger(age) && age > 0 && age < 120 ? age : null,
    gender: text(raw.gender, 60) || null,
    pronouns: text(raw.pronouns, 40) || null,
    signature_trait: text(raw.signature_trait, 240) || null,
    core_desire: text(raw.core_desire, 400) || null,
    core_fear: text(raw.core_fear, 400) || null,
    icon: text(raw.icon, 8) || '👤',
    world,
    pulse: lala && handle ? {
      handle,
      bio: text(raw.pulse?.bio, 300) || null,
      follower_count: Number.isInteger(followers) && followers > 0 ? followers : null,
    } : null,
  };
}

/** The AI's answer as proposals; [] when it cannot be read. */
function parseProposals(answer, world) {
  const raw = String(answer || '').replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse((raw.match(/\[[\s\S]*\]/) || raw.match(/\{[\s\S]*\}/) || [raw])[0]);
    return (Array.isArray(parsed) ? parsed : [parsed]).map((p) => shapeProposal(p, world)).filter(Boolean);
  } catch (err) {
    console.error('[castGenerate] the proposals could not be read:', err.message);
    return [];
  }
}

async function propose(db, { registryId, idea = '', count = 1 } = {}) {
  const registry = await db.CharacterRegistry.findByPk(registryId);
  if (!registry) throw new CastGenerateError(404, 'Registry not found.');
  const n = COUNTS.includes(Number(count)) ? Number(count) : 1;
  const world = worldOf(registry);
  const cast = await castOf(db, registry.id);
  let brain = null;
  if (world !== 'book-1') {
    brain = (await require('./brainRules').loadBrainContext(db, { showId: registry.show_id || null, label: 'castGenerate' })).block;
  }
  const prompt = promptFor({ world, cast, idea: text(idea, IDEA_MAX), count: n, brain });
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 900 * n, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[castGenerate] proposing with ${model} failed:`, modelErr.message);
      if (modelErr.code === 'AI_BUDGET_EXCEEDED') throw new CastGenerateError(429, `${modelErr.message} Nothing was made.`);
      if (model === MODELS[MODELS.length - 1]) {
        throw new CastGenerateError(502, 'The AI could not be reached, so nothing was made and nothing was spent. Try again later.');
      }
    }
  }
  const taken = new Set(cast.rows.map((r) => keyFor(r.display_name)));
  const proposals = parseProposals(message?.content?.[0]?.text, world).filter((p) => !taken.has(keyFor(p.display_name)));
  if (!proposals.length) throw new CastGenerateError(502, 'The AI answered with nothing usable. Nothing was saved; try again.');
  return { world, proposals: proposals.slice(0, n) };
}

async function keep(db, { registryId, proposal, by = null } = {}) {
  const registry = await db.CharacterRegistry.findByPk(registryId);
  if (!registry) throw new CastGenerateError(404, 'Registry not found.');
  const world = worldOf(registry);
  // What the browser sends back is checked again; nothing it adds is written.
  const p = shapeProposal({
    ...proposal, real_name: proposal?.selected_name, role: proposal?.role_type, summary: proposal?.description,
    city: proposal?.current_city, pulse: proposal?.pulse,
  }, world);
  if (!p) throw new CastGenerateError(400, 'The proposal needs a name.');
  const key = keyFor(p.display_name);
  const same = (await castOf(db, registry.id)).rows.find((r) => keyFor(r.display_name) === key);
  if (same) throw new CastGenerateError(409, `${same.display_name} is already in this registry.`);
  if (p.pulse) {
    const { findHandleHolder } = require('../utils/socialProfileHandle');
    if (await findHandleHolder(db, p.pulse.handle)) throw new CastGenerateError(409, `@${p.pulse.handle} is already taken on The Pulse. Try again for another.`);
  }

  return db.sequelize.transaction(async (transaction) => {
    const count = await db.RegistryCharacter.count({ where: { registry_id: registry.id }, transaction });
    const character = await db.RegistryCharacter.create({
      registry_id: registry.id,
      character_key: `${key}_${Date.now().toString(36)}`,
      icon: p.icon, display_name: p.display_name, selected_name: p.selected_name,
      world, role_type: p.role_type, role_label: p.role_label, description: p.description,
      current_city: p.current_city, age: p.age, gender: p.gender, pronouns: p.pronouns,
      signature_trait: p.signature_trait, core_desire: p.core_desire, core_fear: p.core_fear,
      status: 'draft', appearance_mode: 'on_page', sort_order: count,
      // Where it came from: not the feed, so following Lala is Evoni's choice.
      extra_fields: { made_by: 'cast_generate', made_at: new Date().toISOString(), made_for: by },
    }, { transaction });

    let profile = null;
    if (p.pulse) {
      const { formatCount } = require('./characterFacts');
      const { DREAM_CITY_KEYS } = require('../utils/feedCities');
      // As characterGenerationRoutes POST /confirm-feed makes one: the bio is the vibe sentence.
      profile = await db.SocialProfile.create({
        handle: `@${p.pulse.handle}`, display_name: p.display_name, creator_name: p.selected_name,
        platform: 'pulse', feed_layer: 'lalaverse', vibe_sentence: p.pulse.bio || p.description || p.display_name,
        city: DREAM_CITY_KEYS.includes(p.current_city) ? p.current_city : null,
        current_state: 'rising', status: 'generated', auto_generated: true,
        follower_count_approx: p.pulse.follower_count ? formatCount(p.pulse.follower_count) : null,
        follower_tier: p.pulse.follower_count ? require('./pulseAudience').tierFor(p.pulse.follower_count).key : null,
      }, { transaction });
      await character.update({ feed_profile_id: profile.id, social_presence: true }, { transaction });
      // The follow system (branch claude/pulse-follows) plugs in here: a character made here is not from the feed, so no follow of Lala is made.
    }
    return { character, profile };
  }).then(async (made) => {
    // Their starting count in the follower ledger, as /confirm-feed does; a failure never undoes the save.
    if (made.profile && p.pulse.follower_count) {
      try {
        await require('./characterFacts').setFacts(db, {
          character: made.character, feedProfile: made.profile,
          body: { followers: { count: p.pulse.follower_count, reason: 'Proposed with the character by "Make one for me" and kept.' } },
          by: String(by || 'cast-generate').slice(0, 255),
        });
      } catch (ledgerErr) {
        console.error('[castGenerate] the starting count could not be written to the ledger:', ledgerErr.message);
      }
    }
    return made;
  });
}

module.exports = { propose, keep, shapeProposal, parseProposals, promptFor, worldOf, CastGenerateError, ROLES, COUNTS, ROUTE };
