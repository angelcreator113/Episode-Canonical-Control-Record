'use strict';
/**
 * pulsePlatform.js — a LalaVerse feed profile's social is The Pulse.
 *
 * Evoni, 2026-10-15: characters and feed profiles in Lala's world do not get
 * real apps (Instagram, TikTok, OnlyFans …); their social is The Pulse.
 * JustAWoman's feed (feed_layer 'real_world', Book 1) is our world and keeps
 * its real apps.
 *
 * The public account is `pulse`. A hidden second account is a private
 * Pulse account, `pulse_private`. Adult content is on The PlayRoom
 * (`playroom`; Evoni, 2026-10-15: "any characters that do adult content we
 * will call it The PlayRoom"), where an OnlyFans or Fansly account goes.
 * They live in platform_presences / front_platform / real_platform; the
 * profile's platform is `pulse`. The SocialProfile model's hooks apply
 * this on every create and update.
 */

const PULSE = 'pulse';
const PULSE_PRIVATE = 'pulse_private';
const PLAYROOM = 'playroom';
const PULSE_ACCOUNTS = Object.freeze([PULSE, PULSE_PRIVATE, PLAYROOM]);
// Real apps whose account is adult content: it becomes The PlayRoom.
const isAdultApp = (k) => ['onlyfans', 'fansly', PLAYROOM].includes(String(k || '').toLowerCase());

const LABELS = Object.freeze({
  pulse: 'The Pulse',
  pulse_private: 'a private Pulse account',
  playroom: 'The PlayRoom',
  lalaverse: 'The Pulse', // feed_posts.poster_platform for a Pulse post
});

const isPulseLayer = (layer) => layer === 'lalaverse';

/** How a platform reads in prose and on screen: The Pulse, or the app's own name. */
function platformLabel(platform) {
  if (!platform) return null;
  return LABELS[platform] || String(platform);
}

const HIDDEN = /discreet|hidden|private|secret|alt/i;
const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

/**
 * A profile's accounts in the LalaVerse: the public one becomes `pulse`, an
 * adult-content one (OnlyFans, Fansly) `playroom`, another hidden or "real
 * money" one `pulse_private`. Other real-app presences are dropped (the
 * migration keeps a copy in former_platforms).
 */
function toPulsePresences({ platform_presences: presences, front_platform: front, real_platform: real, platform, handle } = {}) {
  const map = isObject(presences) ? presences : {};
  const keys = Object.keys(map).filter((k) => isObject(map[k]));
  if (keys.some((k) => PULSE_ACCOUNTS.includes(k))) {
    // Already in LalaVerse shape: keep only its accounts.
    const kept = {};
    for (const k of PULSE_ACCOUNTS) if (map[k]) kept[k] = map[k];
    return {
      platform_presences: kept,
      front_platform: front ? (front === PLAYROOM ? PLAYROOM : PULSE) : null,
      real_platform: real ? (PULSE_ACCOUNTS.includes(real) ? real : (kept[PULSE_PRIVATE] ? PULSE_PRIVATE : PULSE)) : null,
    };
  }

  const playroomKey = keys.find(isAdultApp) || null;
  const hasPlayroom = !!playroomKey || isAdultApp(platform) || isAdultApp(real) || isAdultApp(front);
  const publicKey = [front, platform].find((k) => k && keys.includes(k) && !isAdultApp(k))
    || keys.find((k) => !isAdultApp(k) && !HIDDEN.test(map[k].visibility || ''))
    || keys.find((k) => !isAdultApp(k))
    || null;
  const hasHiddenAccount = !!(real && front && real !== front && !isAdultApp(real));
  const privateKey = (real && !isAdultApp(real) && real !== publicKey && keys.includes(real) ? real : null)
    || keys.find((k) => k !== publicKey && !isAdultApp(k) && HIDDEN.test(map[k].visibility || ''))
    || null;

  const out = {};
  if (publicKey) {
    out[PULSE] = { ...map[publicKey], visibility: 'public', is_primary: true };
  } else if (handle) {
    out[PULSE] = { handle, visibility: 'public', is_primary: true };
  }
  if (privateKey || hasHiddenAccount) {
    const { is_primary: _primary, ...rest } = privateKey ? map[privateKey] : {};
    out[PULSE_PRIVATE] = { ...rest, visibility: 'private' };
  }
  if (hasPlayroom) {
    const { is_primary: _primary, ...rest } = playroomKey ? map[playroomKey] : {};
    // Openly adult (it was their main app) or kept quiet (discreet).
    const open = isAdultApp(front) || isAdultApp(platform);
    out[PLAYROOM] = { ...rest, visibility: rest.visibility || (open ? 'public' : 'discreet') };
  }
  return {
    platform_presences: out,
    front_platform: isAdultApp(front) ? PLAYROOM : (front || publicKey ? PULSE : null),
    real_platform: isAdultApp(real) || (!real && isAdultApp(platform)) ? PLAYROOM
      : (out[PULSE_PRIVATE] && (real || privateKey) ? PULSE_PRIVATE : (real ? PULSE : null)),
  };
}

/**
 * The fields to set on a LalaVerse profile (instance or plain record) so its
 * social is The Pulse. Returns {} for any other layer.
 */
function pulseFieldsFor(record) {
  if (!record || !isPulseLayer(record.feed_layer)) return {};
  return { platform: PULSE, ...toPulsePresences(record) };
}

/**
 * The lines a profile-generation prompt adds for a LalaVerse creator, so the
 * writing never names a real app. Empty for any other layer.
 */
function pulsePromptRules(layer) {
  if (!isPulseLayer(layer)) return '';
  return `
THE PULSE (LalaVerse rule):
- In the LalaVerse there is ONE social app: The Pulse. Instagram, TikTok, YouTube, Twitter/X, OnlyFans, Twitch and Substack do not exist here. Never name them.
- Every creator posts on The Pulse. A post format is a Pulse post, Pulse story, Pulse video or Pulse live.
- A creator may also keep a private Pulse account (close friends or an alt). That is where a hidden life lives.
- Adult content (subscriptions, explicit content) is sold on The PlayRoom, the LalaVerse's adult platform. A creator who does adult content has a PlayRoom account; their public face is on The Pulse.
- Nobody in the LalaVerse knows JustAWoman exists, and Lala does not know she was made (docs/CANON.md). Never name JustAWoman, and never say Lala was built, created or is a game character.
`;
}

/**
 * The poster_platform a feed post by this profile carries (the quick wins,
 * 2026-10-18: "posts default to The Pulse"): 'lalaverse' (The Pulse) for a
 * LalaVerse profile or no profile, the profile's own app on JustAWoman's
 * real-world feed (fallback when it has none).
 */
function postPlatformFor(profile, fallback = null) {
  if (!profile || profile.feed_layer !== 'real_world') return 'lalaverse';
  return profile.platform || fallback;
}

module.exports = {
  postPlatformFor,
  PULSE,
  PULSE_PRIVATE,
  PLAYROOM,
  PULSE_ACCOUNTS,
  isAdultApp,
  isPulseLayer,
  platformLabel,
  toPulsePresences,
  pulseFieldsFor,
  pulsePromptRules,
};
