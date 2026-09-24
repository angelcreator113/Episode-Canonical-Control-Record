'use strict';

/**
 * Character Sync Service
 *
 * Updates feed profiles and character registry after event episodes.
 * Also auto-manages profile state (rising/peaking/plateauing etc)
 * based on event outcomes.
 */

const { eventCreatorOrganizer } = require('../utils/eventOrganizer');

// ─── AUTO-STATE CALCULATOR ──────────────────────────────────────────────────
// Determines a profile's state based on their event history + trajectory

function calculateAutoState(profile, eventOutcome) {
  const fp = profile.full_profile || {};
  const hosted = fp.hosted_events || [];
  const attended = fp.attended_events || [];
  const totalEvents = hosted.length + attended.length;
  const recentEvents = [...hosted, ...attended]
    .filter(e => {
      const d = new Date(e.date);
      return Date.now() - d.getTime() < 30 * 24 * 60 * 60 * 1000; // last 30 days
    });
  const currentState = profile.current_state;
  const clout = profile.clout_score || 0;
  const drama = profile.drama_magnet || false;

  // Event outcome tiers
  const tier = eventOutcome?.tier; // slay, pass, safe, fail
  const wasHost = eventOutcome?.was_host || false;

  // ── State transition logic ──

  // First event ever → rising
  if (totalEvents <= 1) return 'rising';

  // Hosted a slay event → peaking
  if (wasHost && tier === 'slay') return 'peaking';

  // Multiple recent events + good outcomes → peaking or rising
  if (recentEvents.length >= 3 && tier !== 'fail') {
    return clout >= 60 ? 'peaking' : 'rising';
  }

  // Hosted but it failed → controversial if drama magnet, else plateauing
  if (wasHost && tier === 'fail') {
    return drama ? 'controversial' : 'plateauing';
  }

  // Failed as guest → no state change unless already controversial
  if (tier === 'fail' && currentState === 'controversial') return 'cancelled';

  // No recent events + was active → gone_dark
  if (recentEvents.length === 0 && totalEvents > 3) return 'gone_dark';

  // Was cancelled, now attending → reinventing
  if (currentState === 'cancelled' && tier !== 'fail') return 'reinventing';

  // Was gone_dark, now attending → reinventing
  if (currentState === 'gone_dark') return 'reinventing';

  // Default: keep current or derive from activity level
  if (recentEvents.length >= 2) return 'rising';
  if (totalEvents > 5) return 'plateauing';

  return currentState || 'rising';
}

// ─── AUTO-SET STATE ON PROFILE CREATION ─────────────────────────────────────

function calculateInitialState(profile) {
  const trajectory = profile.current_trajectory;
  const clout = profile.clout_score || 0;

  // Map trajectory to state
  const TRAJECTORY_STATE_MAP = {
    rising: 'rising',
    plateauing: 'plateauing',
    unraveling: 'controversial',
    pivoting: 'reinventing',
    silent: 'gone_dark',
    viral_moment: 'peaking',
  };

  if (TRAJECTORY_STATE_MAP[trajectory]) return TRAJECTORY_STATE_MAP[trajectory];

  // Fallback from clout score
  if (clout >= 70) return 'peaking';
  if (clout >= 40) return 'rising';
  return 'plateauing';
}

// ─── EVENT SYNC ─────────────────────────────────────────────────────────────
// Task #1818 (Evoni's rulings): an event's effect on its host and guest
// profiles is split in two.
//
//   recordEventHistory — at episode GENERATION. Hosted/attended history
//     only: the event happened regardless of score. It also records a
//     pending relevance boost for the host
//     (full_profile.relevance_boosts[eventId] = { status: 'pending' }).
//   applyEventOutcome — at episode COMPLETION (completeEpisode), with the
//     real tier_final: the host's lala_relevance_score boost (once per
//     event, only while its relevance_boosts entry is 'pending') and the
//     tier-based current_state/previous_state change for host and guests.
//
// Regeneration re-runs recordEventHistory; it skips every profile whose
// history already holds this event, and never reverses an earlier boost.
//
// The once-per-event marker lives on the host profile's own full_profile,
// written in the same row update as the score it guards. Only a 'pending'
// entry is boosted, so an event generated before this split (boosted at
// generation, no entry) is not boosted again at completion, and a
// full_profile replaced wholesale (profile regenerate) loses a boost
// rather than doubling one.

function parseAutomation(event) {
  let cc = event?.canon_consequences;
  if (typeof cc === 'string') {
    try { cc = JSON.parse(cc); } catch (err) {
      console.error('[CharSync] canon_consequences is not valid JSON:', err.message);
      cc = null;
    }
  }
  const auto = cc?.automation;
  return auto && typeof auto === 'object' && !Array.isArray(auto) ? auto : null;
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function historyHasEvent(list, eventId) {
  return Array.isArray(list) && list.some(e => e && String(e.event_id) === String(eventId));
}

// profile_id is the current shape (assembleGuestList); id is the pre-fix
// shape a guest written by the opportunity pipeline may still carry (Task
// #1686, docs/GUEST_OWNERSHIP_READ.md §6) — accept either so
// already-stored guests resolve without a data repair.
function eventGuests(automation) {
  const guests = Array.isArray(automation?.guest_profiles) ? automation.guest_profiles : [];
  return guests
    .map(g => ({ guest: g, profileId: g?.profile_id || g?.id }))
    .filter(g => g.profileId);
}

// Writes a calculateAutoState result into `updates`; returns the transition,
// or null when the state is unchanged.
function stateTransition(profile, newState, updates) {
  if (!newState || newState === profile.current_state) return null;
  updates.previous_state = profile.current_state;
  updates.current_state = newState;
  updates.state_changed_at = new Date();
  return { from: profile.current_state ?? null, to: newState };
}

/**
 * Generation half: hosted_events / attended_events history. Changes no
 * relevance score and no state. Once per event: a profile whose history
 * already holds this event is skipped, so regeneration adds nothing.
 */
async function recordEventHistory(event, episode, models) {
  const empty = { updated: 0, skipped: 0, host_id: null, guests_updated: 0 };
  const { SocialProfile } = models || {};
  if (!SocialProfile || !event?.id) return empty;

  // The creator organizer is read from source_profile_id first
  // (eventCreatorOrganizer); an event whose organizer was chosen in the
  // Event Package may have no automation copy at all.
  const creator = eventCreatorOrganizer(event);
  const automation = parseAutomation(event);
  if (!automation && !creator) return empty;

  const eventKey = String(event.id);
  const now = new Date().toISOString();
  let updated = 0;
  let skipped = 0;

  if (creator) {
    try {
      const host = await SocialProfile.findByPk(creator.profileId);
      if (host) {
        // Copy before changing: Sequelize compares a JSONB value with the
        // stored one, and an object mutated in place compares equal and is
        // never written.
        const fullProfile = { ...(host.full_profile || {}) };
        const hosted = Array.isArray(fullProfile.hosted_events) ? fullProfile.hosted_events : [];
        if (historyHasEvent(hosted, event.id)) {
          // Already recorded (a regeneration, or an event recorded before
          // the Task #1818 split, which boosted at generation).
          skipped++;
        } else {
          fullProfile.hosted_events = [...hosted, {
            event_id: event.id,
            event_name: event.name,
            episode_id: episode?.id ?? null,
            episode_number: episode?.episode_number ?? null,
            date: now,
          }];
          const boosts = isPlainObject(fullProfile.relevance_boosts) ? fullProfile.relevance_boosts : {};
          if (!Object.prototype.hasOwnProperty.call(boosts, eventKey)) {
            fullProfile.relevance_boosts = {
              ...boosts,
              [eventKey]: { status: 'pending', episode_id: episode?.id ?? null, recorded_at: now },
            };
          }
          await host.update({ full_profile: fullProfile });
          updated++;
        }
      }
    } catch (err) {
      console.error('[CharSync] Host history update failed:', err.message);
    }
  }

  const guests = eventGuests(automation);
  for (const { guest, profileId } of guests) {
    try {
      const profile = await SocialProfile.findByPk(profileId);
      if (!profile) continue;
      const fullProfile = { ...(profile.full_profile || {}) };
      const attended = Array.isArray(fullProfile.attended_events) ? fullProfile.attended_events : [];
      if (historyHasEvent(attended, event.id)) { skipped++; continue; }
      fullProfile.attended_events = [...attended, {
        event_id: event.id,
        event_name: event.name,
        episode_id: episode?.id ?? null,
        date: now,
      }];
      await profile.update({ full_profile: fullProfile });
      updated++;
    } catch (err) {
      console.error(`[CharSync] Guest ${guest?.handle} history update failed:`, err.message);
    }
  }

  return { updated, skipped, host_id: creator?.profileId ?? null, guests_updated: guests.length };
}

/**
 * Completion half, with the real tier (evalResult.tier_final): the host's
 * relevance boost — once per event, only while its relevance_boosts entry
 * is 'pending' — and the tier-based state change for host and guests. The
 * state change runs on every completion (a regenerated episode completed
 * again reflects its latest outcome); the boost does not.
 */
async function applyEventOutcome(event, tier, models) {
  const result = { host_id: null, host_boosted: false, host_state: null, guests_updated: 0, guest_states: [] };
  const { SocialProfile } = models || {};
  if (!SocialProfile || !event?.id) return result;

  const creator = eventCreatorOrganizer(event);
  const automation = parseAutomation(event);
  const eventKey = String(event.id);
  const evalTier = tier || null;
  result.host_id = creator?.profileId ?? null;

  if (creator) {
    try {
      const host = await SocialProfile.findByPk(creator.profileId);
      if (host) {
        const updates = {};
        const fullProfile = { ...(host.full_profile || {}) };
        const boosts = isPlainObject(fullProfile.relevance_boosts) ? fullProfile.relevance_boosts : {};
        const entry = boosts[eventKey];
        if (isPlainObject(entry) && entry.status === 'pending') {
          // Prestige boost for hosting (formula unchanged)
          const currentScore = host.lala_relevance_score || 0;
          const boost = Math.min(1, (event.prestige || 5) / 10);
          updates.lala_relevance_score = Math.min(10, currentScore + boost);
          fullProfile.relevance_boosts = {
            ...boosts,
            [eventKey]: { ...entry, status: 'applied', applied_at: new Date().toISOString(), tier: evalTier, boost },
          };
          updates.full_profile = fullProfile;
          result.host_boosted = true;
        }

        const newState = calculateAutoState(host, { tier: evalTier, was_host: true });
        result.host_state = stateTransition(host, newState, updates);
        if (result.host_state) {
          console.log(`[CharSync] State: ${host.handle} ${result.host_state.from} → ${newState}`);
        }

        if (Object.keys(updates).length > 0) await host.update(updates);
      }
    } catch (err) {
      console.error('[CharSync] Host outcome update failed:', err.message);
    }
  }

  for (const { guest, profileId } of eventGuests(automation)) {
    try {
      const profile = await SocialProfile.findByPk(profileId);
      if (!profile) continue;
      const updates = {};
      const guestState = calculateAutoState(profile, { tier: evalTier, was_host: false });
      const transition = stateTransition(profile, guestState, updates);
      if (transition) {
        await profile.update(updates);
        result.guest_states.push({ profile_id: profileId, ...transition });
      }
      result.guests_updated++;
    } catch (err) {
      console.error(`[CharSync] Guest ${guest?.handle} outcome update failed:`, err.message);
    }
  }

  return result;
}

// ─── POST-EVENT OPPORTUNITY GENERATOR ────────────────────────────────────────
// Events lead to opportunities based on performance + guest connections

const OPPORTUNITY_TEMPLATES = {
  slay: [
    { type: 'modeling', name: '{brand} Campaign Shoot', payment: [3000, 8000], prestige: [7, 9] },
    { type: 'editorial', name: '{brand} Magazine Feature', payment: [2000, 5000], prestige: [7, 9] },
    { type: 'ambassador', name: '{brand} Brand Ambassador Offer', payment: [5000, 15000], prestige: [8, 10] },
    { type: 'runway', name: 'Fashion Week Casting — {brand}', payment: [1000, 3000], prestige: [8, 10] },
  ],
  pass: [
    { type: 'brand_deal', name: '{brand} Sponsored Post', payment: [500, 2000], prestige: [4, 6] },
    { type: 'podcast', name: 'Podcast Guest — Creator Spotlight', payment: [200, 500], prestige: [4, 6] },
    { type: 'campaign', name: '{brand} Content Collaboration', payment: [1000, 3000], prestige: [5, 7] },
  ],
  safe: [
    { type: 'brand_deal', name: '{brand} PR Gifting', payment: [0, 200], prestige: [3, 5] },
    { type: 'interview', name: 'Quick Q&A — {brand} Blog', payment: [100, 300], prestige: [3, 4] },
  ],
  fail: [], // No opportunities from failed events
};

const postEventNote = (event) => `From event: ${event.name}`;

/**
 * True when post-event opportunities already exist for this event (Task
 * #1818: once per event). The marker is the opportunity's first
 * status_history entry: source_event_id (written from Task #1818 on), or
 * the exact "From event: <name>" note in the same show that earlier
 * generation-time rows carry. Soft-deleted rows count: an opportunity
 * that was generated and then removed is not generated again.
 */
async function postEventOpportunitiesExist(event, models) {
  const sequelize = models?.sequelize;
  if (!sequelize?.query) throw new Error('no sequelize to check for existing post-event opportunities');
  const rows = await sequelize.query(
    `SELECT id FROM opportunities
     WHERE show_id IS NOT DISTINCT FROM :showId
       AND (status_history @> CAST(:byEventId AS jsonb) OR status_history @> CAST(:byNote AS jsonb))
     LIMIT 1`,
    {
      replacements: {
        showId: event.show_id ?? null,
        byEventId: JSON.stringify([{ source_event_id: event.id }]),
        byNote: JSON.stringify([{ note: postEventNote(event) }]),
      },
      type: sequelize.QueryTypes?.SELECT || 'SELECT',
    }
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Post-event opportunities from the real tier (evalResult.tier_final),
 * called at episode completion. Once per event: returns [] when this
 * event's opportunities already exist (or the check itself fails).
 */
async function generatePostEventOpportunities(event, tierFinal, models) {
  const tier = OPPORTUNITY_TEMPLATES[tierFinal] ? tierFinal : 'safe';
  const templates = OPPORTUNITY_TEMPLATES[tier];
  if (templates.length === 0) return [];

  const auto = parseAutomation(event) || {};
  const guests = auto.guest_profiles || [];
  const prestige = event.prestige || 5;

  // Pick 1-2 opportunities based on prestige
  const count = prestige >= 8 ? 2 : prestige >= 5 ? 1 : (Math.random() > 0.5 ? 1 : 0);
  if (count === 0) return [];

  try {
    if (await postEventOpportunitiesExist(event, models)) {
      console.log(`[CharSync] Post-event opportunities already exist for event ${event.id}; skipping`);
      return [];
    }
  } catch (err) {
    // Fail closed: a duplicate set of offers is the harm this guard prevents.
    console.error('[CharSync] Post-event opportunity check failed; not generating:', err.message);
    return [];
  }

  // Get brand names from guest list or event
  const brandSources = [
    event.host_brand,
    ...guests.filter(g => g.relationship === 'industry').map(g => g.display_name || g.handle),
    ...(auto.brand_partnerships || []).map(b => b.brand),
  ].filter(Boolean);

  const { v4: uuidv4 } = require('uuid');
  const created = [];

  for (let i = 0; i < Math.min(count, templates.length); i++) {
    const template = templates[Math.floor(Math.random() * templates.length)];
    const brand = brandSources[Math.floor(Math.random() * brandSources.length)] || event.host || 'Industry Contact';
    const payment = template.payment[0] + Math.floor(Math.random() * (template.payment[1] - template.payment[0]));
    const oppPrestige = template.prestige[0] + Math.floor(Math.random() * (template.prestige[1] - template.prestige[0]));

    const oppData = {
      id: uuidv4(),
      show_id: event.show_id,
      name: template.name.replace('{brand}', brand),
      opportunity_type: template.type,
      category: auto.content_category || 'fashion',
      status: 'offered',
      brand_or_company: brand,
      connector_handle: eventCreatorOrganizer(event)?.handle || null,
      connection_story: `Met at ${event.name}. ${tier === 'slay' ? 'Lala crushed it and caught their attention.' : 'Made a connection during the event.'}`,
      payment_amount: payment,
      prestige: oppPrestige,
      narrative_stakes: `This opportunity came from ${event.name}. ${tier === 'slay' ? 'Lala is in demand.' : 'A door opened — will she walk through?'}`,
      career_impact: tier === 'slay' ? 'Career-defining moment if she lands this' : 'Good for the portfolio',
      status_history: [{ status: 'offered', date: new Date().toISOString(), note: postEventNote(event), source_event_id: event.id, tier }],
    };

    try {
      if (models.Opportunity) {
        const opp = await models.Opportunity.create(oppData);
        created.push(opp.toJSON ? opp.toJSON() : opp);
      } else {
        await models.sequelize.query(
          `INSERT INTO opportunities (id, show_id, name, opportunity_type, category, status, brand_or_company,
           connector_handle, connection_story, payment_amount, prestige, narrative_stakes, status_history, created_at, updated_at)
           VALUES (:id, :show_id, :name, :opportunity_type, :category, 'offered', :brand_or_company,
           :connector_handle, :connection_story, :payment_amount, :prestige, :narrative_stakes, :status_history, NOW(), NOW())`,
          { replacements: { ...oppData, status_history: JSON.stringify(oppData.status_history) } }
        );
        created.push(oppData);
      }
      console.log(`[CharSync] Opportunity created: ${oppData.name} ($${payment})`);
    } catch (err) {
      console.warn('[CharSync] Opportunity creation failed:', err.message);
    }
  }

  return created;
}

module.exports = {
  recordEventHistory,
  applyEventOutcome,
  calculateAutoState,
  calculateInitialState,
  generatePostEventOpportunities,
};
