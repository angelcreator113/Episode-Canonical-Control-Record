'use strict';

/**
 * Lala's closest people on The Pulse, closest first (Task #3202: Start
 * Episode's "Who's new in Lala's life this episode?" suggests existing
 * friends to feature from Pulse evidence). Reads only.
 *
 * The people: her friends (mutual follows, pulseFollows.friendsOfLala) and
 * anyone she has a relationship with (social_profile_relationships either
 * way). Each is scored by closenessOfPairs (services/pulseCloseness): the
 * relationship's base closeness moved by the accepted ledger up to the
 * show's present story moment. A friend with no relationship and no ledger
 * row still counts, at 0. LalaVerse profiles only, never the JustAWoman
 * record.
 */

const ALL = 2147483647; // no story clock yet: every accepted ledger row counts

async function lalaCloseFriends(db, showId, { limit = 12, exclude = [] } = {}) {
  const { lalaProfileId } = require('./lalaFeedProfile');
  const lala = await lalaProfileId(db.sequelize);
  if (!lala) return { lala_profile_id: null, friends: [] };

  const { friendsOfLala } = require('./pulseFollows');
  const friends = (await friendsOfLala(db, { lalaId: lala, limit: 200 })).list;
  const [related] = await db.sequelize.query(
    `SELECT DISTINCT sp.id, sp.handle, sp.display_name FROM social_profile_relationships r
       JOIN social_profiles sp ON sp.id = CASE WHEN r.source_profile_id = :lala THEN r.target_profile_id ELSE r.source_profile_id END
      WHERE (r.source_profile_id = :lala OR r.target_profile_id = :lala)
        AND sp.deleted_at IS NULL AND sp.feed_layer = 'lalaverse' AND COALESCE(sp.is_justawoman_record, false) = false`,
    { replacements: { lala: Number(lala) } });

  const skip = new Set((exclude || []).map(String));
  const people = new Map();
  for (const p of [...friends, ...related]) {
    if (String(p.id) === String(lala) || skip.has(String(p.id)) || people.has(String(p.id))) continue;
    people.set(String(p.id), { id: Number(p.id), handle: p.handle, display_name: p.display_name, friend: false });
  }
  for (const f of friends) if (people.has(String(f.id))) people.get(String(f.id)).friend = true;
  if (!people.size) return { lala_profile_id: Number(lala), friends: [] };

  const { presentOrder } = require('./storyClock');
  const { closenessOfPairs, pairOf } = require('./pulseCloseness');
  const at = (await presentOrder(db, showId)) ?? ALL;
  const scores = await closenessOfPairs(db, showId, [...people.values()].map((p) => [lala, p.id]), at);
  const list = [...people.values()].map((p) => ({ ...p, closeness: Number(scores.get(pairOf(lala, p.id).join(':')) || 0) }));
  list.sort((a, b) => b.closeness - a.closeness || Number(b.friend) - Number(a.friend)
    || String(a.display_name || a.handle).localeCompare(String(b.display_name || b.handle)));
  return { lala_profile_id: Number(lala), friends: list.slice(0, limit) };
}

module.exports = { lalaCloseFriends };
