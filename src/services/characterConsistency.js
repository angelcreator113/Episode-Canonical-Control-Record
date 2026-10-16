'use strict';

/**
 * The consistency checker (Character Consistency Engine, step 3; Evoni,
 * 2026-10-16: "yes start step 3"). Flag-only: it reads a character's profile
 * and reports every place the narrator's text disagrees with their facts
 * (services/characterFacts). It never edits anything.
 *
 * Every text field is in one of three zones:
 *   narrator  what is true about them: checked
 *   mask      what they post, claim or tell themselves: not checked, since
 *             a gap there is characterization (Maren posting "still
 *             beautiful" after eleven retakes), not a bug
 *   author    author-only notes (blind spot, writer notes, what they are to
 *             JustAWoman): not checked
 * Unknown fields count as narrator.
 *
 * Checks (bugs, per the spec's Piece 4):
 *   followers      a follower count in the text more than 10% off the fact
 *   account_status the text says they went dark / were cancelled / are gone
 *                  while the fact says otherwise
 *   handle         "@@" anywhere; the handle itself malformed
 *   social_name    the character record and the feed profile name them
 *                  differently
 *   affordability  a luxury the text gives them above what their income
 *                  affords
 * A fact marked "not decided yet" is not checked. A flag Evoni marks
 * intentional (canon_facts.intentional, the spec's #10) stays listed as
 * intentional, never as a bug.
 *
 *   checkCharacter(db, { character, feedProfile }) → { flags, intentional, checked, skipped }
 */

const crypto = require('crypto');
const { factsOf } = require('./characterFacts');

const MASK_FIELDS = new Set([
  'content_persona', 'public_persona', 'posting_voice', 'sample_captions', 'sample_comments', 'pinned_post',
  'lifestyle_claim', 'front_platform', 'adult_content_framing', 'the_mask', 'mask_persona', 'self_narrative',
]);
const AUTHOR_FIELDS = new Set([
  'blind_spot', 'writer_notes', 'parasocial_function', 'emotional_activation', 'watch_reason', 'what_it_costs_her',
  'lala_relevance_reason', 'book_relevance', 'crossing_trigger', 'crossing_mechanism', 'mirror_proposed_by_amber',
  'secret_connections', 'canon_facts',
]);
const SKIP_FIELDS = new Set([
  // Fact copies and machinery, not prose.
  'handle', 'follower_count_approx', 'generation_model', 'id', 'display_name', 'creator_name', 'selected_name',
  'character_key', 'registry_id', 'feed_profile_id', 'status', 'current_state', 'follower_tier',
]);
const CHARACTER_FIELDS = [
  'description', 'prose_overview', 'core_belief', 'core_wound', 'core_desire', 'core_fear', 'hidden_want', 'mask_persona',
  'truth_persona', 'personality', 'signature_trait', 'writer_notes', 'want_architecture', 'wound', 'the_mask', 'living_state',
  'triggers', 'blind_spot', 'change_capacity', 'self_narrative', 'operative_cosmology', 'foreclosed_possibility',
  'experience_of_joy', 'dilemma', 'deep_profile', 'voice_signature', 'career_status', 'living_context', 'extra_fields',
];
const LABELS = {
  description: 'Description', prose_overview: 'Who they are', want_architecture: 'Want', wound: 'Wound', dilemma: 'Dilemma',
  living_state: 'Living state', deep_profile: 'Deep profile', vibe_sentence: 'Vibe', real_signal: 'Real signal',
  private_reality: 'Private reality', lifestyle_reality: 'Lifestyle reality', lifestyle_gap: 'Lifestyle gap',
  influencer_tier_detail: 'Tier detail', platform_presences: 'Platforms', full_profile: 'Generated profile',
  revenue_streams: 'Revenue streams', monthly_earnings_range: 'Monthly earnings', income_breakdown: 'Income breakdown',
};
const zoneOf = (key) => (MASK_FIELDS.has(key) ? 'mask' : AUTHOR_FIELDS.has(key) ? 'author' : 'narrator');
const labelOf = (path) => {
  const [top, ...rest] = path.split('.');
  const base = LABELS[top] || top.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return rest.length ? `${base} › ${rest.join(' › ').replace(/_/g, ' ')}` : base;
};

/** [{ path, zone, text }] for every text leaf; a nested key's own zone wins (full_profile.content_persona is mask). */
function textLeaves(source, prefix, value, out, inheritedZone = null) {
  if (value === null || value === undefined) return out;
  if (typeof value === 'string') {
    if (value.trim()) out.push({ path: prefix, zone: inheritedZone || 'narrator', text: value, source });
    return out;
  }
  if (typeof value === 'number') {
    out.push({ path: prefix, zone: inheritedZone || 'narrator', text: String(value), source, numeric: true });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => textLeaves(source, `${prefix}.${i}`, v, out, inheritedZone));
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const own = MASK_FIELDS.has(k) || AUTHOR_FIELDS.has(k) ? zoneOf(k) : null;
      textLeaves(source, `${prefix}.${k}`, v, out, own || inheritedZone);
    }
  }
  return out;
}

function leavesOf(character, feedProfile) {
  const out = [];
  for (const f of CHARACTER_FIELDS) textLeaves('character', f, character[f], out, zoneOf(f) === 'narrator' ? null : zoneOf(f));
  if (feedProfile) {
    const fp = typeof feedProfile.toJSON === 'function' ? feedProfile.toJSON() : feedProfile;
    for (const [k, v] of Object.entries(fp)) {
      if (SKIP_FIELDS.has(k) || k.endsWith('_at') || k.endsWith('_id') || typeof v === 'boolean') continue;
      textLeaves('feed', k, v, out, zoneOf(k) === 'narrator' ? null : zoneOf(k));
    }
  }
  return out;
}

// ── Follower counts in prose ────────────────────────────────────────────────
const WORD_NUMBERS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100, half: 0.5,
};
const SCALE = { k: 1e3, thousand: 1e3, m: 1e6, mil: 1e6, million: 1e6, b: 1e9, billion: 1e9 };
const COUNT_RE = /\b(\d[\d,]*(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|half)(?:\s+a)?\s*(k|m|b|mil|thousand|million|billion)?\b[\s\w-]{0,24}?\bfollowers?\b/gi;

/** [{ count, match, index }] for every "N followers" in the text. */
function followerMentions(text) {
  const out = [];
  for (const m of text.matchAll(COUNT_RE)) {
    const raw = m[1].toLowerCase();
    const base = /\d/.test(raw) ? Number(raw.replace(/,/g, '')) : WORD_NUMBERS[raw];
    const scale = m[2] ? SCALE[m[2].toLowerCase()] : 1;
    if (!Number.isFinite(base)) continue;
    const count = Math.round(base * scale);
    if (!m[2] && !/\d/.test(raw)) continue; // "a follower", "two followers": not a count claim
    if (count < 10) continue;
    out.push({ count, match: m[0].trim(), index: m.index });
  }
  return out;
}

// ── Account status in prose ─────────────────────────────────────────────────
const STATUS_PHRASES = [
  ['gone_dark', /\b(?:gone|went|goes|going|has gone) (?:dark|quiet|silent)\b|\bdisappeared from (?:the )?(?:feed|pulse|internet)\b/i],
  ['cancelled', /\b(?:got|was|been|is|being) cancell?ed\b/i],
  ['posthumous', /\bposthumous(?:ly)?\b/i],
];

// ── Luxuries and what they need ─────────────────────────────────────────────
const TIER_ORDER = ['struggling', 'getting_by', 'comfortable', 'well_off', 'wealthy'];
const LUXURIES = [
  ['wealthy', /\b(?:private jet|yacht|mansion|penthouse|estate in|rolls[- ]royce|bugatti|second home|beach house)\b/i],
  ['well_off', /\b(?:lamborghini|ferrari|bentley|porsche|maserati|rolex|patek|birkin|kelly bag|cartier|designer wardrobe|luxury (?:condo|apartment|loft))\b/i],
];

const excerpt = (text, index, len) => {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + len + 60);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
};
const idOf = (...parts) => crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12);

async function checkCharacter(db, { character, feedProfile = null }) {
  const facts = await factsOf(db, { character, feedProfile });
  const undecided = new Set(facts.undecided);
  const leaves = leavesOf(character, feedProfile);
  const flags = [];
  const skipped = { mask: 0, author: 0 };
  const add = (f) => flags.push({ ...f, id: idOf(f.check, f.field, f.found) });

  for (const leaf of leaves) {
    if (leaf.zone !== 'narrator') { skipped[leaf.zone] += 1; continue; }
    if (leaf.numeric) continue;
    const field = `${leaf.source === 'feed' ? 'feed' : 'character'}.${leaf.path}`;

    if (facts.followers && !undecided.has('followers')) {
      for (const m of followerMentions(leaf.text)) {
        const off = Math.abs(m.count - facts.followers.count) / Math.max(facts.followers.count, 1);
        if (off > 0.1) {
          add({ check: 'followers', field, field_label: labelOf(leaf.path), found: m.match,
            expected: `${facts.followers.label} followers`, excerpt: excerpt(leaf.text, m.index, m.match.length) });
        }
      }
    }
    if (facts.account_status && !undecided.has('account_status')) {
      for (const [status, re] of STATUS_PHRASES) {
        const m = re.exec(leaf.text);
        if (m && status !== facts.account_status) {
          add({ check: 'account_status', field, field_label: labelOf(leaf.path), found: m[0],
            expected: `account status "${facts.account_status.replace(/_/g, ' ')}"`, excerpt: excerpt(leaf.text, m.index, m[0].length) });
        }
      }
    }
    if (/@@\w/.test(leaf.text)) {
      const i = leaf.text.indexOf('@@');
      add({ check: 'handle', field, field_label: labelOf(leaf.path), found: leaf.text.slice(i, i + 30).split(/\s/)[0],
        expected: facts.handle || 'one @', excerpt: excerpt(leaf.text, i, 2) });
    }
    if (facts.affordability && !undecided.has('income')) {
      const have = TIER_ORDER.indexOf(facts.affordability.key);
      for (const [need, re] of LUXURIES) {
        const m = re.exec(leaf.text);
        if (m && TIER_ORDER.indexOf(need) > have) {
          add({ check: 'affordability', field, field_label: labelOf(leaf.path), found: m[0],
            expected: `what ${facts.affordability.label.toLowerCase()} affords (${facts.affordability.yearly.toLocaleString('en-US')} a year)`,
            excerpt: excerpt(leaf.text, m.index, m[0].length) });
          break;
        }
      }
    }
  }

  // Stored copies of the count: the generated profile's text and each platform's.
  if (facts.followers && !undecided.has('followers') && feedProfile) {
    const { parseApprox } = require('./pulseFollowers');
    const copies = [['feed.full_profile.follower_count_approx', 'Generated profile › follower count', feedProfile.full_profile?.follower_count_approx]];
    const presences = feedProfile.platform_presences && typeof feedProfile.platform_presences === 'object' ? feedProfile.platform_presences : {};
    for (const [platform, pres] of Object.entries(presences)) {
      if (pres && pres.followers != null) copies.push([`feed.platform_presences.${platform}.followers`, `Platforms › ${platform} › followers`, String(pres.followers)]);
    }
    for (const [field, label, value] of copies) {
      const n = typeof value === 'string' ? parseApprox(value) : null;
      if (n && Math.abs(n - facts.followers.count) / Math.max(facts.followers.count, 1) > 0.1) {
        add({ check: 'followers', field, field_label: label, found: value, expected: `${facts.followers.label} followers`, excerpt: `${label}: ${value}` });
      }
    }
  }

  if (facts.handle && !/^@[A-Za-z0-9._]{1,60}$/.test(facts.handle)) {
    add({ check: 'handle', field: 'feed.handle', field_label: 'Handle', found: facts.handle, expected: 'one @ then letters, numbers, dots or underscores', excerpt: facts.handle });
  }
  const own = character.display_name && String(character.display_name).trim();
  const social = feedProfile?.display_name && String(feedProfile.display_name).trim();
  if (own && social && own.toLowerCase() !== social.toLowerCase()) {
    add({ check: 'social_name', field: 'character.display_name', field_label: 'Social media name', found: own,
      expected: `the feed profile's "${social}"`, excerpt: `Character record: "${own}" · Feed profile: "${social}"` });
  }

  // One flag per id (the same sentence copied into two places is two flags; the same match twice in one field is one).
  const seen = new Set();
  const unique = flags.filter((f) => (seen.has(f.id) ? false : seen.add(f.id)));
  const marks = new Map((character.canon_facts?.intentional || []).map((m) => [m.id, m]));
  return {
    flags: unique.filter((f) => !marks.has(f.id)),
    intentional: unique.filter((f) => marks.has(f.id)).map((f) => ({ ...f, note: marks.get(f.id).note || null })),
    checked: leaves.filter((l) => l.zone === 'narrator' && !l.numeric).length,
    skipped,
    undecided: [...undecided],
  };
}

/** canon_facts with flag `id` marked intentional (note optional), or unmarked. */
function withIntentional(canonFacts, id, { note = null, on = true } = {}) {
  if (!/^[0-9a-f]{12}$/.test(String(id))) throw Object.assign(new Error('flag_id must be a flag id.'), { status: 400 });
  const next = { ...(canonFacts || {}) };
  const list = (next.intentional || []).filter((m) => m.id !== id);
  if (on) list.push({ id, note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 300) : null, at: new Date().toISOString() });
  next.intentional = list;
  return next;
}

module.exports = { checkCharacter, withIntentional, followerMentions, zoneOf, leavesOf };
