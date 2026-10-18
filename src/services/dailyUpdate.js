'use strict';

/**
 * The daily update (automation step 2; Evoni, 2026-10-18: "how can we
 * automate these conversations so i dont have to approve but instead im able
 * to get a daily update easy ... one day i want this fully automated"). One
 * page, read once a day, across every show:
 *
 *   since_yesterday  what happened since `since`: posts that went live (the
 *                    quality gate's own releases marked auto), drafts
 *                    scheduled, posts that went out on trust (a fully
 *                    trusted poster's post the gate would have held; undo:
 *                    POST /pulse-trust/undo/:postId; services/pulseTrust),
 *                    new characters, and changes made on their own (fact
 *                    changes, voices built, findings resolved)
 *   waiting          what waits for her, each group with the existing
 *                    endpoint that decides one item (the page calls those,
 *                    so every rule they keep still holds):
 *                      drafts   publish  PUT /feed-posts/:id { status: 'live' }
 *                               delete   DELETE /feed-posts/:id (kept, restorable)
 *                      voices   approve  POST /pulse-voices/:id/approve
 *                               (undo: POST /pulse-voices/:id/unapprove)
 *                      secrets  keep     PUT /cast/characters/:cid/secrets/:id { status: 'confirmed' }
 *                               (undo: { status: 'candidate' })
 *                               discard  DELETE /cast/characters/:cid/secrets/:id
 *                      deals    consider POST /opportunities/:showId/:id/advance { to_status: 'considering' }
 *                               decline  ... { to_status: 'declined' }
 *                      findings read only: open consistency findings per
 *                               character (the flag log), fixed on Facts & checks
 *   coming_up        the next three days: scheduled posts (move or hold:
 *                    PUT /feed-posts/:id/release-time), episode air dates,
 *                    those episodes' events, deal dates, and each posting
 *                    schedule's next open time (services/postingSchedule;
 *                    Evoni, 2026-10-18: "yes do the two posting schedule
 *                    follow-ups")
 *   cost             today's AI spend (UTC day) against the daily budget,
 *                    and the features it went to
 *
 *   dailyUpdate(db, { since, now }) → { since, now, since_yesterday, waiting, coming_up, cost }
 *
 * Reads only; no AI call. Every list is capped (LIMIT) and carries its full
 * count. Dr. Amara Sinclair and any confidential professional stay out
 * (utils/confidentialCharacters); the Talk sessions themselves are never read.
 */

const { notConfidentialSql } = require('../utils/confidentialCharacters');

const LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const AHEAD_DAYS = 3;
const REVIEW = '/admin?tab=pulse&sub=review';
const VOICES = '/admin?tab=pulse&sub=voices';
const CAST = '/character-registry';
const OPPORTUNITIES = '/admin?tab=opportunities';

const clip = (v, n = 160) => (v == null ? null : String(v).replace(/\s+/g, ' ').trim().slice(0, n));
const iso = (d) => (d ? new Date(d).toISOString() : null);
const num = (v) => Number(v) || 0;
const dateOnly = (d) => new Date(d).toISOString().slice(0, 10);

class DailyUpdateError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** `since` and `now` as dates: since defaults to a day before now and must be before it. */
function windowOf({ since, now } = {}) {
  const end = now ? new Date(now) : new Date();
  const start = since ? new Date(since) : new Date(end.getTime() - DAY_MS);
  if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) throw new DailyUpdateError(400, 'since and now must be dates.');
  if (start >= end) throw new DailyUpdateError(400, 'since must be before now.');
  // At most a week back: the page is a daily read, and every query stays bounded.
  if (end.getTime() - start.getTime() > 7 * DAY_MS) throw new DailyUpdateError(400, 'since is at most seven days back.');
  return { start, end };
}

// A query and its count together; a missing table (an older database) is an empty list, logged.
async function rows(db, sql, replacements, label) {
  try {
    return await db.sequelize.query(sql, { replacements, type: db.sequelize.QueryTypes.SELECT });
  } catch (err) {
    console.error(`[dailyUpdate] ${label} could not be read:`, err.message);
    return [];
  }
}
async function count(db, sql, replacements, label) {
  const [row] = await rows(db, sql, replacements, label);
  return num(row?.n);
}

const showNames = async (db) => {
  const list = await rows(db, 'SELECT id, name FROM shows WHERE deleted_at IS NULL', {}, 'shows');
  return new Map(list.map((s) => [s.id, s.name]));
};

const postItem = (p, shows) => ({
  id: p.id,
  show_id: p.show_id,
  show: shows.get(p.show_id) || null,
  handle: p.poster_handle || null,
  name: p.poster_display_name || null,
  text: clip(p.content_text),
  image_url: p.image_url || null,
  release_state: p.release_state || null,
  release_at: iso(p.release_at),
  posted_at: iso(p.posted_at),
  // The quality gate released it on its own (services/pulseGate).
  auto: Boolean(p.ai_generated && p.gate_json && p.gate_json.pass === true),
});

async function sinceYesterday(db, { start, end }, shows) {
  const r = { start, end };
  const liveWhere = `status = 'live' AND deleted_at IS NULL
    AND (created_at >= :start OR (posted_at >= :start AND posted_at <= :end))`;
  const live = await rows(db, `SELECT * FROM feed_posts WHERE ${liveWhere} ORDER BY COALESCE(posted_at, created_at) DESC LIMIT ${LIMIT}`, r, 'live posts');
  const liveTotal = await count(db, `SELECT COUNT(*) AS n FROM feed_posts WHERE ${liveWhere}`, r, 'live posts');

  const schedWhere = `status = 'draft' AND deleted_at IS NULL AND release_state = 'scheduled' AND updated_at >= :start`;
  const scheduled = await rows(db, `SELECT * FROM feed_posts WHERE ${schedWhere} ORDER BY release_at ASC LIMIT ${LIMIT}`, r, 'scheduled posts');
  const scheduledTotal = await count(db, `SELECT COUNT(*) AS n FROM feed_posts WHERE ${schedWhere}`, r, 'scheduled posts');

  const charWhere = `rc.deleted_at IS NULL AND rc.created_at >= :start AND ${notConfidentialSql('rc')}`;
  const characters = await rows(db, `SELECT rc.id, rc.display_name, rc.selected_name, rc.status, rc.world, rc.created_at
    FROM registry_characters rc WHERE ${charWhere} ORDER BY rc.created_at DESC LIMIT ${LIMIT}`, r, 'new characters');
  const charactersTotal = await count(db, `SELECT COUNT(*) AS n FROM registry_characters rc WHERE ${charWhere}`, r, 'new characters');

  // Changes made on their own: fact changes, voices built, findings resolved.
  const facts = await rows(db, `SELECT f.id, f.registry_character_id, f.fact_key, f.before_value, f.after_value, f.reason, f.changed_by, f.source, f.created_at,
      COALESCE(rc.selected_name, rc.display_name) AS name
    FROM character_fact_changes f JOIN registry_characters rc ON rc.id = f.registry_character_id
    WHERE f.deleted_at IS NULL AND f.created_at >= :start AND ${notConfidentialSql('rc')}
    ORDER BY f.created_at DESC LIMIT ${LIMIT}`, r, 'fact changes');
  const voices = await rows(db, `SELECT v.id, v.registry_character_id, v.built_at, v.approved_at, COALESCE(rc.selected_name, rc.display_name) AS name
    FROM pulse_voices v JOIN registry_characters rc ON rc.id = v.registry_character_id
    WHERE v.deleted_at IS NULL AND v.built_at >= :start AND rc.deleted_at IS NULL AND ${notConfidentialSql('rc')}
    ORDER BY v.built_at DESC LIMIT ${LIMIT}`, r, 'voices built');
  // Went out on trust (services/pulseTrust): a fully trusted poster's post the
  // gate would have held, each with Undo (POST /pulse-trust/undo/:postId).
  const trustWhere = `deleted_at IS NULL AND gate_json->'released_on_trust' IS NOT NULL
    AND gate_json->'released_on_trust'->>'undone_at' IS NULL AND (gate_json->'released_on_trust'->>'at')::timestamptz >= :start`;
  const onTrust = await rows(db, `SELECT * FROM feed_posts WHERE ${trustWhere} ORDER BY (gate_json->'released_on_trust'->>'at') DESC LIMIT ${LIMIT}`, r, 'posts on trust');
  const onTrustTotal = await count(db, `SELECT COUNT(*) AS n FROM feed_posts WHERE ${trustWhere}`, r, 'posts on trust');
  // Comments too (feed_comments.released_on_trust; undo: POST /pulse-trust/undo-comment/:id).
  const commentTrustWhere = `c.deleted_at IS NULL AND c.released_on_trust IS NOT NULL
    AND c.released_on_trust->>'undone_at' IS NULL AND (c.released_on_trust->>'at')::timestamptz >= :start`;
  const commentsOnTrust = await rows(db, `SELECT c.id, c.handle, c.text, c.show_id, c.feed_post_id, c.status, c.released_on_trust
    FROM feed_comments c WHERE ${commentTrustWhere} ORDER BY (c.released_on_trust->>'at') DESC LIMIT ${LIMIT}`, r, 'comments on trust');
  const commentsOnTrustTotal = await count(db, `SELECT COUNT(*) AS n FROM feed_comments c WHERE ${commentTrustWhere}`, r, 'comments on trust');
  const resolved = await rows(db, `SELECT l.status, COUNT(*) AS n FROM consistency_flag_log l
    JOIN registry_characters rc ON rc.id = l.registry_character_id
    WHERE l.deleted_at IS NULL AND l.status IN ('fixed', 'gone', 'intentional') AND l.resolved_at >= :start AND ${notConfidentialSql('rc')}
    GROUP BY l.status`, r, 'resolved findings');

  return {
    went_live: { total: liveTotal, auto: live.filter((p) => p.ai_generated && p.gate_json?.pass === true).length, items: live.map((p) => postItem(p, shows)) },
    scheduled: { total: scheduledTotal, items: scheduled.map((p) => postItem(p, shows)) },
    on_trust: {
      total: onTrustTotal + commentsOnTrustTotal,
      items: [
        ...onTrust.map((p) => ({ ...postItem(p, shows), kind: 'post', status: p.status, waived_flags: p.gate_json?.released_on_trust?.flags || [] })),
        ...commentsOnTrust.map((c) => ({
          id: c.id, kind: 'comment', handle: c.handle, text: clip(c.text), show_id: c.show_id, show: shows.get(c.show_id) || null,
          post_id: c.feed_post_id, status: c.status, waived_flags: c.released_on_trust?.flags || [],
        })),
      ],
    },
    new_characters: {
      total: charactersTotal,
      items: characters.map((c) => ({ id: c.id, name: c.selected_name || c.display_name, status: c.status || null, world: c.world || null, created_at: iso(c.created_at) })),
    },
    automatic: {
      facts: facts.map((f) => ({
        id: f.id, character_id: f.registry_character_id, name: f.name, fact: f.fact_key,
        from: f.before_value, to: f.after_value, reason: clip(f.reason), by: f.changed_by || null, source: f.source, at: iso(f.created_at),
      })),
      voices_built: voices.map((v) => ({ id: v.id, character_id: v.registry_character_id, name: v.name, built_at: iso(v.built_at), approved: Boolean(v.approved_at) })),
      findings_resolved: Object.fromEntries(resolved.map((x) => [x.status, num(x.n)])),
    },
  };
}

async function waiting(db, shows) {
  // Drafts: not scheduled (those are in Coming up); held ones wait for her too.
  const draftWhere = `status = 'draft' AND deleted_at IS NULL AND (release_state IS NULL OR release_state = 'held')`;
  const drafts = await rows(db, `SELECT * FROM feed_posts WHERE ${draftWhere} ORDER BY created_at DESC LIMIT ${LIMIT}`, {}, 'drafts');
  const draftsTotal = await count(db, `SELECT COUNT(*) AS n FROM feed_posts WHERE ${draftWhere}`, {}, 'drafts');

  const voiceWhere = `v.deleted_at IS NULL AND v.approved_at IS NULL AND rc.deleted_at IS NULL AND ${notConfidentialSql('rc')}`;
  const voices = await rows(db, `SELECT v.id, v.registry_character_id, v.status, v.built_at, v.habits_json, COALESCE(rc.selected_name, rc.display_name) AS name
    FROM pulse_voices v JOIN registry_characters rc ON rc.id = v.registry_character_id
    WHERE ${voiceWhere} ORDER BY v.built_at DESC NULLS LAST LIMIT ${LIMIT}`, {}, 'voices');
  const voicesTotal = await count(db, `SELECT COUNT(*) AS n FROM pulse_voices v JOIN registry_characters rc ON rc.id = v.registry_character_id WHERE ${voiceWhere}`, {}, 'voices');

  const secretWhere = `s.deleted_at IS NULL AND s.status = 'candidate' AND rc.deleted_at IS NULL AND ${notConfidentialSql('rc')}`;
  const secrets = await rows(db, `SELECT s.id, s.registry_character_id, s.text, s.source_field, s.created_by, s.created_at, COALESCE(rc.selected_name, rc.display_name) AS name
    FROM character_secrets s JOIN registry_characters rc ON rc.id = s.registry_character_id
    WHERE ${secretWhere} ORDER BY s.created_at DESC LIMIT ${LIMIT}`, {}, 'secrets');
  const secretsTotal = await count(db, `SELECT COUNT(*) AS n FROM character_secrets s JOIN registry_characters rc ON rc.id = s.registry_character_id WHERE ${secretWhere}`, {}, 'secrets');

  const dealWhere = `deleted_at IS NULL AND status = 'offered'`;
  const deals = await rows(db, `SELECT id, show_id, name, opportunity_type, brand_or_company, payment_amount, payment_type, response_deadline, connector_handle, created_at
    FROM opportunities WHERE ${dealWhere} ORDER BY response_deadline ASC NULLS LAST, created_at DESC LIMIT ${LIMIT}`, {}, 'deals');
  const dealsTotal = await count(db, `SELECT COUNT(*) AS n FROM opportunities WHERE ${dealWhere}`, {}, 'deals');

  // Findings: the flag log's open ones per character (no check is run here).
  const findingWhere = `l.deleted_at IS NULL AND l.status = 'open' AND rc.deleted_at IS NULL AND ${notConfidentialSql('rc')}`;
  const findings = await rows(db, `SELECT rc.id, COALESCE(rc.selected_name, rc.display_name) AS name, COUNT(*) AS n, MAX(l.last_seen_at) AS last_seen_at
    FROM consistency_flag_log l JOIN registry_characters rc ON rc.id = l.registry_character_id
    WHERE ${findingWhere} GROUP BY rc.id, rc.selected_name, rc.display_name ORDER BY n DESC LIMIT ${LIMIT}`, {}, 'findings');
  const findingsTotal = await count(db, `SELECT COUNT(*) AS n FROM consistency_flag_log l JOIN registry_characters rc ON rc.id = l.registry_character_id WHERE ${findingWhere}`, {}, 'findings');

  return [
    {
      key: 'drafts', label: 'Pulse drafts', total: draftsTotal, link: REVIEW,
      items: drafts.map((p) => postItem(p, shows)),
    },
    {
      key: 'voices', label: 'Voices', total: voicesTotal, link: VOICES,
      items: voices.map((v) => ({
        id: v.id, character_id: v.registry_character_id, name: v.name, status: v.status, built_at: iso(v.built_at),
        summary: clip(v.habits_json?.summary || v.habits_json?.tone || v.habits_json?.register || null),
      })),
    },
    {
      key: 'secrets', label: 'Secrets', total: secretsTotal, link: null,
      items: secrets.map((s) => ({ id: s.id, character_id: s.registry_character_id, name: s.name, text: clip(s.text, 300), source: s.source_field || null, by: s.created_by || null, created_at: iso(s.created_at) })),
    },
    {
      key: 'deals', label: 'Brand deals', total: dealsTotal, link: OPPORTUNITIES,
      items: deals.map((d) => ({
        id: d.id, show_id: d.show_id, show: shows.get(d.show_id) || null, name: d.name, type: d.opportunity_type, brand: d.brand_or_company || null,
        amount: d.payment_amount == null ? null : Number(d.payment_amount), payment_type: d.payment_type || null,
        deadline: d.response_deadline || null, connector: d.connector_handle || null,
      })),
    },
    {
      key: 'findings', label: 'Findings to fix', total: findingsTotal, link: CAST, read_only: true,
      items: findings.map((f) => ({ id: f.id, character_id: f.id, name: f.name, open: num(f.n), last_seen_at: iso(f.last_seen_at) })),
    },
  ];
}

async function comingUp(db, { end }, shows) {
  const until = new Date(end.getTime() + AHEAD_DAYS * DAY_MS);
  const r = { now: end, until, today: dateOnly(end), last: dateOnly(until) };
  const posts = await rows(db, `SELECT * FROM feed_posts WHERE status = 'draft' AND deleted_at IS NULL AND release_state = 'scheduled'
    AND release_at >= :now AND release_at < :until ORDER BY release_at ASC LIMIT ${LIMIT}`, r, 'scheduled posts ahead');
  const episodes = await rows(db, `SELECT id, show_id, episode_number, title, air_date FROM episodes
    WHERE deleted_at IS NULL AND air_date >= :now AND air_date < :until ORDER BY air_date ASC LIMIT ${LIMIT}`, r, 'episodes ahead');
  const episodeIds = episodes.map((e) => e.id);
  const events = episodeIds.length
    ? await rows(db, `SELECT id, show_id, name, event_type, used_in_episode_id FROM world_events
        WHERE deleted_at IS NULL AND used_in_episode_id IN (:ids) ORDER BY name ASC LIMIT ${LIMIT}`, { ids: episodeIds }, 'events ahead')
    : [];
  const airOf = new Map(episodes.map((e) => [e.id, e]));
  const deals = await rows(db, `SELECT id, show_id, name, brand_or_company, status, shoot_date, publish_date, response_deadline FROM opportunities
    WHERE deleted_at IS NULL AND status NOT IN ('declined', 'expired', 'cancelled', 'archived')
      AND (shoot_date BETWEEN :today AND :last OR publish_date BETWEEN :today AND :last OR response_deadline BETWEEN :today AND :last)
    ORDER BY LEAST(COALESCE(shoot_date, '9999-12-31'), COALESCE(publish_date, '9999-12-31'), COALESCE(response_deadline, '9999-12-31')) ASC LIMIT ${LIMIT}`, r, 'deal dates');
  const inWindow = (d) => d && d >= r.today && d <= r.last;
  const slots = await nextSlots(db, { now: end, until });

  return {
    until: until.toISOString(),
    posts: posts.map((p) => postItem(p, shows)),
    episodes: episodes.map((e) => ({ id: e.id, show_id: e.show_id, show: shows.get(e.show_id) || null, number: e.episode_number, title: e.title, air_date: iso(e.air_date) })),
    events: events.map((ev) => ({
      id: ev.id, show_id: ev.show_id, show: shows.get(ev.show_id) || null, name: ev.name, type: ev.event_type || null,
      episode_id: ev.used_in_episode_id, episode_number: airOf.get(ev.used_in_episode_id)?.episode_number ?? null, air_date: iso(airOf.get(ev.used_in_episode_id)?.air_date),
    })),
    deals: deals.map((d) => ({
      id: d.id, show_id: d.show_id, show: shows.get(d.show_id) || null, name: d.name, brand: d.brand_or_company || null, status: d.status,
      dates: [
        inWindow(d.response_deadline) && { kind: 'Answer by', date: d.response_deadline },
        inWindow(d.shoot_date) && { kind: 'Shoot', date: d.shoot_date },
        inWindow(d.publish_date) && { kind: 'Goes public', date: d.publish_date },
      ].filter(Boolean),
    })),
    slots,
  };
}

/**
 * Each posting schedule's next open time before `until`: the first slot on
 * their days, in their windows, with room in the week, counting what they
 * already have scheduled (services/postingSchedule.nextSlot). Characters and
 * brand accounts alike; Dr. Sinclair stays out. Reads only.
 */
async function nextSlots(db, { now, until }) {
  const ps = require('./postingSchedule');
  const profiles = await rows(db, `SELECT sp.id, sp.handle, sp.display_name, sp.posting_schedule, rc.id AS character_id
    FROM social_profiles sp LEFT JOIN registry_characters rc ON rc.feed_profile_id = sp.id AND rc.deleted_at IS NULL
    WHERE sp.deleted_at IS NULL AND sp.posting_schedule IS NOT NULL AND ${notConfidentialSql('rc')}
    ORDER BY sp.display_name ASC NULLS LAST LIMIT ${LIMIT}`, {}, 'posting schedules');
  if (!profiles.length) return [];
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const taken = await rows(db, `SELECT social_profile_id, COALESCE(release_at, posted_at, created_at) AS at FROM feed_posts
    WHERE deleted_at IS NULL AND social_profile_id IN (:ids)
      AND ((status = 'draft' AND release_state = 'scheduled' AND release_at >= :weekAgo AND release_at < :until)
        OR (status = 'live' AND COALESCE(posted_at, created_at) >= :weekAgo))`,
  { ids: profiles.map((p) => p.id), weekAgo, until }, 'scheduled times');
  const takenBy = new Map();
  for (const t of taken) takenBy.set(t.social_profile_id, [...(takenBy.get(t.social_profile_id) || []), new Date(t.at)]);
  const out = [];
  for (const p of profiles) {
    const schedule = typeof p.posting_schedule === 'string' ? JSON.parse(p.posting_schedule) : p.posting_schedule;
    let at = null;
    try {
      at = ps.nextSlot(schedule, { after: now, tzOffset: schedule.tz_offset || 0, taken: takenBy.get(p.id) || [] });
    } catch (err) {
      console.error(`[dailyUpdate] no next slot for profile ${p.id}:`, err.message);
    }
    if (!at || at >= until) continue;
    out.push({
      profile_id: p.id, character_id: p.character_id || null, name: p.display_name || p.handle, handle: p.handle,
      at: iso(at), schedule: ps.describe(schedule),
    });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

async function cost(db, { end }) {
  const tracker = require('./aiCostTracker');
  let spent = 0;
  try { spent = await tracker.getFreshDailySpend(); } catch (err) {
    console.error('[dailyUpdate] today\'s AI spend could not be read:', err.message);
  }
  const day = `${dateOnly(end)}T00:00:00.000Z`;
  const features = await rows(db, `SELECT COALESCE(route_name, 'other') AS feature, SUM(cost_usd) AS usd, COUNT(*) AS calls
    FROM ai_usage_logs WHERE created_at >= :day GROUP BY COALESCE(route_name, 'other') ORDER BY usd DESC LIMIT 8`, { day }, 'AI usage');
  const budget = tracker.DAILY_BUDGET;
  return {
    spent_usd: Math.round(spent * 100) / 100,
    budget_usd: budget,
    left_usd: Math.max(0, Math.round((budget - spent) * 100) / 100),
    share: budget ? Math.min(1, spent / budget) : 0,
    features: features.map((f) => ({ feature: f.feature, usd: Math.round(num(f.usd) * 100) / 100, calls: num(f.calls) })),
  };
}

async function dailyUpdate(db, { since, now } = {}) {
  const { start, end } = windowOf({ since, now });
  const shows = await showNames(db);
  return {
    since: start.toISOString(),
    now: end.toISOString(),
    since_yesterday: await sinceYesterday(db, { start, end }, shows),
    waiting: await waiting(db, shows),
    coming_up: await comingUp(db, { end }, shows),
    cost: await cost(db, { end }),
  };
}

module.exports = { dailyUpdate, windowOf, DailyUpdateError, LIMIT, AHEAD_DAYS };
