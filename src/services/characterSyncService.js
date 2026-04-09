'use strict';

/**
 * Character Sync Service
 *
 * Updates feed profiles and character registry after event episodes.
 * Also auto-manages profile state (rising/peaking/plateauing etc)
 * based on event outcomes.
 */

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

// ─── SYNC AFTER EVENT ───────────────────────────────────────────────────────

async function syncAfterEvent(event, episode, models) {
  const { SocialProfile } = models;
  if (!SocialProfile) return { updated: 0 };

  const automation = event.canon_consequences?.automation;
  if (!automation) return { updated: 0 };

  // Get episode evaluation for tier
  const evalTier = episode.evaluation_json?.tier_final || null;

  let updated = 0;

  // Update host profile
  if (automation.host_profile_id) {
    try {
      const host = await SocialProfile.findByPk(automation.host_profile_id);
      if (host) {
        const fullProfile = host.full_profile || {};
        const hostedEvents = fullProfile.hosted_events || [];
        hostedEvents.push({
          event_id: event.id,
          event_name: event.name,
          episode_id: episode.id,
          episode_number: episode.episode_number,
          date: new Date().toISOString(),
        });
        fullProfile.hosted_events = hostedEvents;

        // Prestige boost for hosting
        const currentScore = host.lala_relevance_score || 0;
        const boost = Math.min(1, (event.prestige || 5) / 10);

        // Auto-calculate new state
        const newState = calculateAutoState(host, { tier: evalTier, was_host: true });

        const updates = {
          full_profile: fullProfile,
          lala_relevance_score: Math.min(10, currentScore + boost),
        };

        // Only update state if it changed
        if (newState && newState !== host.current_state) {
          updates.previous_state = host.current_state;
          updates.current_state = newState;
          updates.state_changed_at = new Date();
          console.log(`[CharSync] State: ${host.handle} ${host.current_state} → ${newState}`);
        }

        await host.update(updates);
        updated++;
      }
    } catch (err) {
      console.warn(`[CharSync] Host update failed:`, err.message);
    }
  }

  // Update guest profiles
  const guests = automation.guest_profiles || [];
  for (const guest of guests) {
    if (!guest.profile_id) continue;
    try {
      const profile = await SocialProfile.findByPk(guest.profile_id);
      if (profile) {
        const fullProfile = profile.full_profile || {};
        const attendedEvents = fullProfile.attended_events || [];
        attendedEvents.push({
          event_id: event.id,
          event_name: event.name,
          episode_id: episode.id,
          date: new Date().toISOString(),
        });
        fullProfile.attended_events = attendedEvents;

        // Auto-calculate new state for guests too
        const guestState = calculateAutoState(profile, { tier: evalTier, was_host: false });
        const updates = { full_profile: fullProfile };

        if (guestState && guestState !== profile.current_state) {
          updates.previous_state = profile.current_state;
          updates.current_state = guestState;
          updates.state_changed_at = new Date();
        }

        await profile.update(updates);
        updated++;
      }
    } catch (err) {
      console.warn(`[CharSync] Guest ${guest.handle} update failed:`, err.message);
    }
  }

  return { updated, host_id: automation.host_profile_id, guests_updated: guests.length };
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

async function generatePostEventOpportunities(event, episode, models) {
  const tier = episode.evaluation_json?.tier_final || 'safe';
  const templates = OPPORTUNITY_TEMPLATES[tier] || OPPORTUNITY_TEMPLATES.safe;
  if (templates.length === 0) return [];

  const auto = event.canon_consequences?.automation || {};
  const guests = auto.guest_profiles || [];
  const prestige = event.prestige || 5;

  // Pick 1-2 opportunities based on prestige
  const count = prestige >= 8 ? 2 : prestige >= 5 ? 1 : (Math.random() > 0.5 ? 1 : 0);
  if (count === 0) return [];

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
      connector_handle: auto.host_handle || null,
      connection_story: `Met at ${event.name}. ${tier === 'slay' ? 'Lala crushed it and caught their attention.' : 'Made a connection during the event.'}`,
      payment_amount: payment,
      prestige: oppPrestige,
      narrative_stakes: `This opportunity came from ${event.name}. ${tier === 'slay' ? 'Lala is in demand.' : 'A door opened — will she walk through?'}`,
      career_impact: tier === 'slay' ? 'Career-defining moment if she lands this' : 'Good for the portfolio',
      status_history: [{ status: 'offered', date: new Date().toISOString(), note: `From event: ${event.name}` }],
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

module.exports = { syncAfterEvent, calculateAutoState, calculateInitialState, generatePostEventOpportunities };
