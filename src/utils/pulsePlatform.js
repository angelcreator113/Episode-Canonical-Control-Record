'use strict';
/**
 * pulsePlatform.js — a LalaVerse feed profile's social is The Pulse.
 *
 * Evoni, 2026-10-15: characters and feed profiles in Lala's world do not get
 * real apps (Instagram, TikTok, OnlyFans …); their social is The Pulse.
 * JustAWoman's feed (feed_layer 'real_world', Book 1) is our world and keeps
 * its real apps.
 *
 * The public account is `pulse`. The hidden second account a creator may
 * keep (where "the real money is", once a discreet real app) is a private
 * Pulse account, `pulse_private`, in platform_presences / real_platform.
 * The SocialProfile model's hooks apply this on every create and update.
 */

const PULSE = 'pulse';
const PULSE_PRIVATE = 'pulse_private';

const LABELS = Object.freeze({
  pulse: 'The Pulse',
  pulse_private: 'a private Pulse account',
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
 * A profile's accounts as Pulse accounts: the public one becomes `pulse`,
 * a hidden or "real money" one becomes `pulse_private`. Other real-app
 * presences are dropped (the migration keeps a copy in former_platforms).
 */
function toPulsePresences({ platform_presences: presences, front_platform: front, real_platform: real, platform, handle } = {}) {
  const map = isObject(presences) ? presences : {};
  const keys = Object.keys(map).filter((k) => isObject(map[k]));
  if (keys.includes(PULSE) || keys.includes(PULSE_PRIVATE)) {
    // Already Pulse-shaped: keep only the two Pulse accounts.
    const kept = {};
    if (map[PULSE]) kept[PULSE] = map[PULSE];
    if (map[PULSE_PRIVATE]) kept[PULSE_PRIVATE] = map[PULSE_PRIVATE];
    return {
      platform_presences: kept,
      front_platform: front ? PULSE : null,
      real_platform: real ? (real === PULSE_PRIVATE || kept[PULSE_PRIVATE] ? PULSE_PRIVATE : PULSE) : null,
    };
  }

  const publicKey = [front, platform].find((k) => k && keys.includes(k))
    || keys.find((k) => !HIDDEN.test(map[k].visibility || ''))
    || keys[0]
    || null;
  const hasHiddenAccount = !!(real && front && real !== front);
  const privateKey = (real && real !== publicKey && keys.includes(real) ? real : null)
    || keys.find((k) => k !== publicKey && HIDDEN.test(map[k].visibility || ''))
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
  return {
    platform_presences: out,
    front_platform: front || publicKey ? PULSE : null,
    real_platform: out[PULSE_PRIVATE] && (real || privateKey) ? PULSE_PRIVATE : (real ? PULSE : null),
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
- A creator may also keep a private Pulse account (close friends, subscribers, or an alt). That is where a hidden life or "the real money" lives.
`;
}

module.exports = {
  PULSE,
  PULSE_PRIVATE,
  isPulseLayer,
  platformLabel,
  toPulsePresences,
  pulseFieldsFor,
  pulsePromptRules,
};
