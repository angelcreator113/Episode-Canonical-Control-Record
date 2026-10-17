'use strict';

/**
 * A character's facts: the hard, checkable values (Character Consistency
 * Engine, step 2; Evoni, 2026-10-16). Each lives in one place:
 *
 *   handle            social_profiles.handle (one leading @, checked here)
 *   followers         the follower ledger (services/pulseFollowers): the
 *                     latest accepted count for the show. Setting it writes a
 *                     ledger row with a reason, so every change has a cause.
 *                     follower_count_approx follows it, for the screens and
 *                     generators that read the text.
 *   account_status    social_profiles.current_state
 *   income, occupation, major_possessions, undecided
 *                     registry_characters.canon_facts (JSONB)
 *   affordability     worked out from income, never stored
 *
 * `undecided` lists facts that are not decided yet (the spec's #14): a
 * generator must not invent them, and the checker does not flag them.
 *
 *   factsOf(db, { character, feedProfile, showId })
 *   setFacts(db, { character, feedProfile, showId, body, by })
 *   formatCount(n), affordabilityOf(income), FACT_KEYS
 *
 * For the generators (Character Consistency Engine step 5, the spec's
 * Piece 2: "prose generates FROM the facts"):
 *   factsPromptBlock(facts)          the FACTS block every generator puts in
 *                                    its prompt: the decided facts, to state
 *                                    exactly or not at all, and the facts not
 *                                    decided yet, never to state; '' when none
 *   isDecided(facts, key)            the fact is set and not marked undecided
 *   factsForCharacter(db, character, feedProfile?)   factsOf with the feed
 *                                    profile loaded when not given; null when
 *                                    it cannot be read (a context loader)
 *   factsForProfile(db, profile)     the same from a feed profile, through
 *                                    its registry character; null with none
 *   agreeingFollowers(generated, fallbackTier)   a NEW profile's follower
 *                                    count and tier made to agree (step 5c):
 *                                    the tier from a count that reads as a
 *                                    number, its label normalised, the primary
 *                                    platform presence's followers set to it;
 *                                    with only a tier word, no count invented
 *   holdToFacts(section, value, facts)   a generated section with the fields a
 *                                    fact decides set from it (profession,
 *                                    follower tier) and those a fact leaves
 *                                    undecided cleared (FACT_FIELDS)
 */

const FACT_KEYS = Object.freeze(['handle', 'followers', 'account_status', 'income', 'occupation', 'major_possessions']);
const ACCOUNT_STATUSES = Object.freeze(['rising', 'peaking', 'plateauing', 'controversial', 'cancelled', 'reinventing', 'gone_dark', 'posthumous']);
const INCOME_CADENCES = Object.freeze(['per_month', 'per_year']);
const AFFORDABILITY = Object.freeze([
  ['struggling', 0, 'Struggling'], ['getting_by', 30000, 'Getting by'], ['comfortable', 60000, 'Comfortable'],
  ['well_off', 150000, 'Well off'], ['wealthy', 1000000, 'Wealthy'],
]);
const HANDLE_RE = /^[A-Za-z0-9._]{1,60}$/;

class FactsError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** 2000000 → "2M", 1200000 → "1.2M", 47000 → "47k", 3400 → "3,400". */
function formatCount(n) {
  if (!Number.isFinite(n)) return '';
  const trim = (x) => String(Number(x.toFixed(1)));
  if (n >= 1e9) return `${trim(n / 1e9)}B`;
  if (n >= 1e6) return `${trim(n / 1e6)}M`;
  if (n >= 1e4) return `${trim(n / 1e3)}k`;
  return n.toLocaleString('en-US');
}

/** The yearly amount, or null when the income does not say. */
function yearlyIncome(income) {
  const amount = Number(income?.amount);
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (income.cadence === 'per_month') return amount * 12;
  if (income.cadence === 'per_year') return amount;
  return null;
}

/** { key, label, yearly } from the income, or null. */
function affordabilityOf(income) {
  const yearly = yearlyIncome(income);
  if (yearly === null) return null;
  const [key, , label] = AFFORDABILITY.reduce((tier, t) => (yearly >= t[1] ? t : tier), AFFORDABILITY[0]);
  return { key, label, yearly };
}

const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** The show whose follower ledger holds the character's count. */
async function showIdFor(db, character, feedProfile) {
  const [[reg]] = await db.sequelize.query(
    'SELECT show_id FROM character_registries WHERE id = :id', { replacements: { id: character.registry_id } });
  if (reg?.show_id) return reg.show_id;
  if (!feedProfile) return null;
  const [[row]] = await db.sequelize.query(
    `SELECT show_id FROM pulse_followers WHERE social_profile_id = :pid AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1`, { replacements: { pid: feedProfile.id } });
  return row?.show_id || null;
}

async function factsOf(db, { character, feedProfile = null, showId = null }) {
  const stored = character.canon_facts || {};
  const show = showId || await showIdFor(db, character, feedProfile);
  let followers = null;
  if (feedProfile) {
    const { countAt, parseApprox } = require('./pulseFollowers');
    const ledger = show ? await countAt(db, show, feedProfile.id) : null;
    if (ledger !== null) followers = { count: ledger, label: formatCount(ledger), source: 'ledger', show_id: show };
    else {
      const estimate = parseApprox(feedProfile.follower_count_approx);
      if (estimate) followers = { count: estimate, label: formatCount(estimate), source: 'estimate', show_id: show };
    }
  }
  const income = stored.income || null;
  return {
    feed_linked: Boolean(feedProfile),
    handle: feedProfile?.handle ? `@${String(feedProfile.handle).replace(/^@+/, '')}` : null,
    followers,
    account_status: feedProfile?.current_state || null,
    income,
    occupation: stored.occupation || null,
    major_possessions: Array.isArray(stored.major_possessions) ? stored.major_possessions : [],
    affordability: affordabilityOf(income),
    undecided: Array.isArray(stored.undecided) ? stored.undecided.filter((k) => FACT_KEYS.includes(k)) : [],
  };
}

/** The canon_facts JSON after the body's changes; throws FactsError on a bad value. */
function nextCanonFacts(current, body) {
  const next = { ...(current || {}) };
  if ('income' in body) {
    const inc = body.income;
    if (inc === null) next.income = null;
    else {
      if (typeof inc !== 'object') throw new FactsError(400, 'income must be { amount, cadence, source }.');
      const amount = inc.amount === null || inc.amount === '' || inc.amount === undefined ? null : Number(inc.amount);
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) throw new FactsError(400, 'Income must be a number of 0 or more.');
      if (inc.cadence && !INCOME_CADENCES.includes(inc.cadence)) throw new FactsError(400, 'Income is per month or per year.');
      next.income = { amount, cadence: inc.cadence || null, source: text(inc.source, 200) };
    }
  }
  if ('occupation' in body) next.occupation = text(body.occupation, 200);
  if ('major_possessions' in body) {
    if (!Array.isArray(body.major_possessions)) throw new FactsError(400, 'major_possessions must be a list.');
    next.major_possessions = body.major_possessions.map((p) => text(p, 120)).filter(Boolean).slice(0, 30);
  }
  if ('undecided' in body) {
    if (!Array.isArray(body.undecided)) throw new FactsError(400, 'undecided must be a list of facts.');
    next.undecided = [...new Set(body.undecided.filter((k) => FACT_KEYS.includes(k)))];
  }
  return next;
}

/**
 * Applies the body's changes: { handle?, account_status?, followers?: { count,
 * reason }, income?, occupation?, major_possessions?, undecided?, reason? }.
 * Returns the facts after. Handle, status and followers need a feed
 * profile. Each other fact that changed goes into the fact history with
 * `reason` (services/factHistory); followers keep their own ledger.
 */
async function setFacts(db, { character, feedProfile = null, showId = null, body = {}, by = null }) {
  const feedChanges = {};
  if ('handle' in body || 'account_status' in body || 'followers' in body) {
    if (!feedProfile) throw new FactsError(409, 'They have no feed profile, so they have no handle, followers or account status yet.');
  }
  if ('handle' in body) {
    const raw = String(body.handle ?? '').trim();
    const bare = raw.replace(/^@/, '');
    if (!HANDLE_RE.test(bare)) throw new FactsError(400, 'A handle is one @ then letters, numbers, dots or underscores (no spaces, no second @).');
    const { findHandleHolder, handleTakenMessage } = require('../utils/socialProfileHandle');
    const holder = await findHandleHolder(db, bare, { excludeId: feedProfile.id });
    if (holder) throw new FactsError(409, handleTakenMessage(bare, holder));
    feedChanges.handle = `@${bare}`;
  }
  if ('account_status' in body) {
    const s = body.account_status || null;
    if (s !== null && !ACCOUNT_STATUSES.includes(s)) throw new FactsError(400, `Account status is one of: ${ACCOUNT_STATUSES.join(', ')}.`);
    feedChanges.current_state = s;
  }
  let followerTarget = null;
  if ('followers' in body) {
    const count = Number(body.followers?.count);
    if (!Number.isInteger(count) || count < 0) throw new FactsError(400, 'Followers must be a whole number of 0 or more.');
    followerTarget = count;
    // The count's stored copies agree with it: the label, the tier, the
    // generated profile's copy and the primary platform's (the drift the
    // consistency check found on Maren: facts 2M, copies still 1.2M).
    const label = formatCount(count);
    const tier = require('./pulseAudience').tierFor(count).key;
    feedChanges.follower_count_approx = label;
    feedChanges.follower_tier = tier;
    if (feedProfile.full_profile && typeof feedProfile.full_profile === 'object') {
      feedChanges.full_profile = { ...feedProfile.full_profile, follower_count_approx: label, follower_tier: tier };
    }
    const primary = primaryPresenceKey(feedProfile.platform_presences, feedProfile.platform);
    if (primary) {
      const presences = JSON.parse(JSON.stringify(feedProfile.platform_presences));
      presences[primary].followers = label;
      feedChanges.platform_presences = presences;
    }
  }
  const canon = nextCanonFacts(character.canon_facts, body);

  const show = showId || await showIdFor(db, character, feedProfile);
  // What they were, for the fact history (services/factHistory, the spec's #1).
  const before = await factsOf(db, { character, feedProfile, showId: show });
  await db.sequelize.transaction(async (transaction) => {
    if (followerTarget !== null && show) {
      const { countAt } = require('./pulseFollowers');
      const before = await countAt(db, show, feedProfile.id);
      const reason = text(body.followers?.reason, 500) || 'Set on the fact sheet.';
      if (before === null) {
        await db.PulseFollower.create({
          show_id: show, social_profile_id: feedProfile.id, story_order: 0, change: followerTarget, count_after: followerTarget,
          cause: 'start', reason, status: 'accepted', decided_by: by, decided_at: new Date(),
        }, { transaction });
      } else if (before !== followerTarget) {
        const [[last]] = await db.sequelize.query(
          `SELECT COALESCE(MAX(story_order), 0) AS at FROM pulse_followers
            WHERE show_id = :show AND social_profile_id = :pid AND status = 'accepted' AND deleted_at IS NULL`,
          { replacements: { show, pid: feedProfile.id }, transaction });
        await db.PulseFollower.create({
          show_id: show, social_profile_id: feedProfile.id, story_order: Number(last.at), change: followerTarget - before,
          count_after: followerTarget, cause: 'override', reason, status: 'accepted', decided_by: by, decided_at: new Date(),
        }, { transaction });
      }
    }
    if (Object.keys(feedChanges).length) await feedProfile.update(feedChanges, { transaction });
    await character.update({ canon_facts: canon }, { transaction });
  });
  const after = await factsOf(db, { character, feedProfile, showId: show });
  await require('./factHistory').recordFactChanges(db, { character, showId: show, before, after, reason: text(body.reason, 500) || null, by });
  return after;
}

const STATUS_WORDS = {
  rising: 'rising', peaking: 'at its peak', plateauing: 'plateaued', controversial: 'controversial',
  cancelled: 'cancelled (their audience turned on them)', reinventing: 'reinventing itself',
  gone_dark: 'gone dark (they stopped posting)', posthumous: 'posthumous (they have died)',
};

/** Whether a fact is set and not marked "not decided yet". */
function isDecided(facts, key) {
  if (!facts || (facts.undecided || []).includes(key)) return false;
  if (key === 'followers') return Boolean(facts.followers);
  if (key === 'income') return facts.income?.amount != null;
  if (key === 'major_possessions') return (facts.major_possessions || []).length > 0;
  return Boolean(facts[key]);
}

/**
 * The FACTS block for a generator's prompt: the decided facts, which any
 * text it writes states exactly or not at all, and the facts not decided
 * yet, which it never states, implies or invents (the spec's #14). '' when
 * there is nothing decided and nothing undecided.
 */
function factsPromptBlock(facts) {
  if (!facts) return '';
  const lines = [];
  if (facts.handle) lines.push(`- handle: ${facts.handle}`);
  if (isDecided(facts, 'followers')) lines.push(`- followers: ${facts.followers.label} (${facts.followers.count.toLocaleString('en-US')})`);
  if (isDecided(facts, 'account_status')) lines.push(`- account status: ${STATUS_WORDS[facts.account_status] || facts.account_status}`);
  if (isDecided(facts, 'occupation')) lines.push(`- what they do: ${facts.occupation}`);
  if (isDecided(facts, 'income')) {
    lines.push(`- income: ${facts.income.amount.toLocaleString('en-US')} ${facts.income.cadence === 'per_month' ? 'a month' : 'a year'}${facts.income.source ? ` from ${facts.income.source}` : ''}`);
  }
  if (isDecided(facts, 'major_possessions')) lines.push(`- what they own: ${facts.major_possessions.join('; ')}`);
  if (facts.affordability && isDecided(facts, 'income')) {
    lines.push(`- what they can afford: ${facts.affordability.label}. No home, car, purchase or lifestyle in your writing goes beyond that.`);
  }
  const notYet = (facts.undecided || []).map((k) => k.replace(/_/g, ' '));
  if (!lines.length && !notYet.length) return '';
  return [
    'FACTS (canon, the one source of truth). Where your writing mentions one of these, it states it exactly as given. Never invent, round or change a number, status, income, job or thing they own:',
    ...(lines.length ? lines : ['- (none decided yet)']),
    ...(notYet.length ? [`NOT DECIDED YET: ${notYet.join(', ')}. Never state, imply or invent these.`] : []),
  ].join('\n');
}

/**
 * The generated registry fields each fact decides, by section. A decided fact
 * sets its field; an undecided one clears it (the generator may not make it
 * canon). Prose fields (financial_status) keep the generator's words, which
 * the FACTS block told to agree with the facts.
 */
const FACT_FIELDS = Object.freeze({
  career_status: { profession: 'occupation', financial_status: 'income' },
  living_context: { financial_reality: 'income' },
  demographics: { follower_tier: 'followers' },
});

function holdToFacts(section, value, facts) {
  const fields = FACT_FIELDS[section];
  if (!fields || !facts || !value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = { ...value };
  for (const [field, key] of Object.entries(fields)) {
    if (!(field in out)) continue;
    if ((facts.undecided || []).includes(key)) out[field] = null;
    else if (key === 'occupation' && isDecided(facts, key)) out[field] = facts.occupation;
    else if (key === 'followers' && isDecided(facts, key)) out[field] = require('./pulseAudience').tierFor(facts.followers.count).key;
  }
  return out;
}

/**
 * The key of the platform presence the follower fact is about: the one
 * marked is_primary, else the one named for the profile's platform, else
 * the first. Another presence (a private or second account) has its own
 * audience. Null when there is none.
 */
function primaryPresenceKey(presences, platform = null) {
  if (!presences || typeof presences !== 'object' || Array.isArray(presences)) return null;
  const keys = Object.keys(presences).filter((k) => presences[k] && typeof presences[k] === 'object');
  return keys.find((k) => presences[k].is_primary === true) || (platform && keys.includes(platform) ? platform : null) || keys[0] || null;
}

/**
 * A newly generated profile has no facts yet, but its own numbers must agree
 * (the spec's "1.2M vs 2M" drift starts here). Sets, on `generated` itself
 * (so full_profile keeps the same values), follower_count_approx to the
 * count's label and follower_tier to the count's tier, and the primary
 * platform presence's followers to the same label. With no count that reads
 * as a number, the tier stays (fallbackTier when not one of the six) and the
 * count is null: no count is invented. Returns { follower_count_approx,
 * follower_tier, count }.
 */
function agreeingFollowers(generated, fallbackTier = 'mid') {
  const g = generated && typeof generated === 'object' ? generated : {};
  const { TIERS, tierFor } = require('./pulseAudience');
  const raw = g.follower_count_approx;
  const count = typeof raw === 'number' && raw > 0 ? Math.round(raw) : require('./pulseFollowers').parseApprox(raw);
  const keys = TIERS.map((t) => t.key);
  let out;
  if (count) out = { follower_count_approx: formatCount(count), follower_tier: tierFor(count).key, count };
  else out = { follower_count_approx: null, follower_tier: keys.includes(g.follower_tier) ? g.follower_tier : fallbackTier, count: null };
  g.follower_count_approx = out.follower_count_approx;
  g.follower_tier = out.follower_tier;
  const presences = g.platform_presences && typeof g.platform_presences === 'object' ? g.platform_presences : null;
  if (presences && out.follower_count_approx) {
    const primary = primaryPresenceKey(presences, g.platform);
    if (primary) presences[primary].followers = out.follower_count_approx;
  }
  return out;
}

/** factsOf, loading the feed profile when not given; null when it cannot be read. */
async function factsForCharacter(db, character, feedProfile) {
  if (!character) return null;
  try {
    const fp = feedProfile !== undefined ? feedProfile
      : (character.feed_profile_id && db.SocialProfile ? await db.SocialProfile.findByPk(character.feed_profile_id) : null);
    return await factsOf(db, { character, feedProfile: fp || null });
  } catch (err) {
    console.error('[characterFacts] the facts could not be read:', err.message);
    return null;
  }
}

/** The facts of the registry character a feed profile belongs to; null with none, or when unreadable. */
async function factsForProfile(db, profile) {
  if (!profile || !db.RegistryCharacter) return null;
  try {
    const character = await db.RegistryCharacter.findOne({ where: { feed_profile_id: profile.id }, order: [['updated_at', 'DESC']] });
    return character ? await factsOf(db, { character, feedProfile: profile }) : null;
  } catch (err) {
    console.error('[characterFacts] the profile\'s facts could not be read:', err.message);
    return null;
  }
}

module.exports = {
  FACT_KEYS, ACCOUNT_STATUSES, INCOME_CADENCES, AFFORDABILITY, FactsError,
  formatCount, affordabilityOf, yearlyIncome, factsOf, setFacts, nextCanonFacts, showIdFor,
  isDecided, factsPromptBlock, factsForCharacter, factsForProfile, holdToFacts, agreeingFollowers, primaryPresenceKey, FACT_FIELDS, STATUS_WORDS,
};
