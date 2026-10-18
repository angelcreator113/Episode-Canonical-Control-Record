'use strict';

/**
 * Cross-character checks (Character Consistency Engine, the spec's Future
 * Enhancement #2: "the worst contradictions in an ensemble are between
 * characters, not within one (A throws a party B wasn't invited to, but
 * B's feed shows them there)"; Evoni, 2026-10-17: "start the cross-character
 * checks"). Flag-only, like the single-character check
 * (services/characterConsistency): it reads and reports, never edits, and
 * makes no AI call.
 *
 *   crossCheck(db, registryIds) → { flags, summary }
 *     flag: { id, check, character_id, character_name, where, found,
 *             expected, excerpt, other_id?, other_name?, event_id?,
 *             event_name?, post_id? }
 *
 * Checks, across the live characters of the registries asked for:
 *   at_event        a post by B that puts B at an event ("I'm at", "we were
 *                   at", "last night at"…, tagged with the event or naming
 *                   it) while B is not on its guest list (its host and the
 *                   Event Package's Guests, utils/eventAttendees). Lala is
 *                   at every event.
 *   knows_event     a post that names an event its poster could not know
 *                   about at that story moment: not there, not told by a
 *                   close friend, not yet posted publicly
 *                   (pulseKnowledge.unknownMentions). An at_event flag on
 *                   the same post and event is enough; it is not repeated.
 *   other_followers A's narrator text gives B a follower count more than
 *                   10% off B's follower fact (the sentence names B and no
 *                   other cast member, so the count is about B).
 *   other_status    A's narrator text says B went dark, was cancelled or is
 *                   gone while B's account status fact says otherwise.
 * The mask and author-only fields are not checked (a character can be
 * wrong about another on purpose there), nor a fact B has marked "not
 * decided yet".
 */

const crypto = require('crypto');

const PRESENCE_RE = /\b(?:i'?m|i am|we'?re|we are|i was|we were|was|been|here|last night|currently)\s+(?:here\s+|there\s+|out\s+)?at\b|\bhere at\b/i;
const MAX_POSTS = 2000;
// A sentence ends at . ! or ? followed by a space (so "1.2M" stays whole), or at a line break.
const sentencesOf = (text) => text.split(/(?<=[.!?])\s+|\n+/).map((t) => t.trim()).filter(Boolean);

const idOf = (...parts) => crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12);
const clip = (s, n = 200) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const nameOf = (c) => c.selected_name || c.display_name || 'Someone';

/** The names a character goes by in prose: their names and their handle. */
function namesOf(c, facts) {
  const out = new Set();
  for (const n of [c.display_name, c.selected_name, facts?.handle]) {
    const s = String(n || '').trim();
    if (s.length >= 3) out.add(s);
  }
  return [...out];
}

/** The cast members a sentence names, by their names. */
function namedIn(sentence, cast) {
  const { mentions } = require('./pulseGate');
  return cast.filter((m) => m.names.some((n) => mentions(sentence, n)));
}

async function loadCast(db, registryIds) {
  const { factsOf, showIdFor } = require('./characterFacts');
  const characters = await db.RegistryCharacter.findAll({ where: { registry_id: registryIds }, order: [['display_name', 'ASC']] });
  const cast = [];
  for (const c of characters) {
    const feedProfile = c.feed_profile_id && db.SocialProfile ? await db.SocialProfile.findByPk(c.feed_profile_id) : null;
    const showId = await showIdFor(db, c, feedProfile);
    let facts = null;
    try {
      facts = await factsOf(db, { character: c, feedProfile, showId });
    } catch (err) {
      console.error(`[castCrossCheck] the facts of ${c.id} could not be read:`, err.message);
    }
    cast.push({ character: c, feedProfile, showId, facts, names: namesOf(c, facts), profileId: feedProfile ? Number(feedProfile.id) : null });
  }
  return cast;
}

/** What A's narrator text says about other cast members' follower counts and status. */
function proseFlags(cast) {
  const { leavesOf, followerMentions, labelOf, statusMentions } = require('./characterConsistency');
  const flags = [];
  for (const a of cast) {
    const others = cast.filter((m) => m !== a && m.facts);
    if (!others.length) continue;
    for (const leaf of leavesOf(a.character, a.feedProfile)) {
      if (leaf.zone !== 'narrator' || leaf.numeric) continue;
      for (const sentence of sentencesOf(leaf.text)) {
        const named = namedIn(sentence, cast);
        if (named.length !== 1 || named[0] === a) continue;
        const b = named[0];
        if (!b.facts) continue;
        const undecided = new Set(b.facts.undecided || []);
        const where = `${leaf.source === 'feed' ? 'Feed profile' : 'Profile'}: ${labelOf(leaf.path)}`;
        const base = { character_id: a.character.id, character_name: nameOf(a.character), other_id: b.character.id, other_name: nameOf(b.character), where, excerpt: clip(sentence) };
        if (b.facts.followers && !undecided.has('followers')) {
          for (const m of followerMentions(sentence)) {
            const off = Math.abs(m.count - b.facts.followers.count) / Math.max(b.facts.followers.count, 1);
            if (off > 0.1) {
              flags.push({ ...base, id: idOf('other_followers', a.character.id, leaf.path, m.match), check: 'other_followers',
                found: m.match, expected: `${nameOf(b.character)} has ${b.facts.followers.label} followers` });
            }
          }
        }
        if (b.facts.account_status && !undecided.has('account_status')) {
          for (const m of statusMentions(sentence)) {
            if (m.status !== b.facts.account_status) {
              flags.push({ ...base, id: idOf('other_status', a.character.id, leaf.path, m.match), check: 'other_status',
                found: m.match, expected: `${nameOf(b.character)}'s account is ${b.facts.account_status.replace(/_/g, ' ')}` });
            }
          }
        }
      }
    }
  }
  return flags;
}

/** What the cast's posts say about who was at which event, and who knew. */
async function postFlags(db, cast) {
  const { showEvents, namedIn: eventsNamedIn, unknownMentions } = require('./pulseKnowledge');
  const lalaId = await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const byProfile = new Map(cast.filter((m) => m.profileId).map((m) => [m.profileId, m]));
  const shows = [...new Set(cast.map((m) => m.showId).filter(Boolean))];
  const flags = [];
  let checked = 0;
  for (const showId of shows) {
    if (!byProfile.size) break;
    const events = await showEvents(db, showId);
    if (!events.length) continue;
    const posts = await db.FeedPost.findAll({
      where: { show_id: showId, social_profile_id: [...byProfile.keys()], deleted_at: null },
      order: [['created_at', 'ASC']],
      limit: MAX_POSTS,
    });
    for (const post of posts) {
      const who = byProfile.get(Number(post.social_profile_id));
      if (!who || (lalaId != null && who.profileId === Number(lalaId))) continue;
      checked += 1;
      const text = `${post.content_text || ''}\n${post.trending_topic || ''}`;
      const base = { character_id: who.character.id, character_name: nameOf(who.character), post_id: post.id,
        where: `${post.status === 'live' ? 'Live' : 'Draft'} post`, excerpt: clip(post.content_text) };
      const placed = new Set();
      if (PRESENCE_RE.test(post.content_text || '')) {
        const at = events.filter((ev) => (post.event_id && String(post.event_id) === ev.id) || eventsNamedIn(text, [ev]).length);
        for (const ev of at) {
          if (ev.guests.has(who.profileId)) continue;
          placed.add(ev.id);
          flags.push({ ...base, id: idOf('at_event', post.id, ev.id), check: 'at_event', event_id: ev.id, event_name: ev.name,
            found: `the post puts ${nameOf(who.character)} at ${ev.name}`,
            expected: `${nameOf(who.character)} is not on the guest list of ${ev.name}` });
        }
      }
      let unknown = [];
      try {
        unknown = await unknownMentions(db, post, { lalaProfileId: lalaId, events });
      } catch (err) {
        console.error(`[castCrossCheck] what post ${post.id} knows could not be read:`, err.message);
      }
      for (const ev of unknown) {
        if (placed.has(ev.id)) continue;
        flags.push({ ...base, id: idOf('knows_event', post.id, ev.id), check: 'knows_event', event_id: ev.id, event_name: ev.name,
          found: `the post talks about ${ev.name}`,
          expected: `${nameOf(who.character)} was not there, was not told by a close friend, and it was not posted yet` });
      }
    }
  }
  return { flags, checked };
}

async function crossCheck(db, registryIds) {
  const cast = await loadCast(db, registryIds);
  const prose = proseFlags(cast);
  const posts = await postFlags(db, cast);
  const order = { at_event: 0, knows_event: 1, other_followers: 2, other_status: 3 };
  const flags = [...posts.flags, ...prose].sort((x, y) => order[x.check] - order[y.check] || String(x.character_name).localeCompare(String(y.character_name)));
  return {
    flags,
    summary: {
      characters: cast.length,
      posts_checked: posts.checked,
      flags: flags.length,
      characters_flagged: new Set(flags.map((f) => f.character_id)).size,
    },
  };
}

module.exports = { crossCheck, proseFlags, namesOf, sentencesOf, PRESENCE_RE };
