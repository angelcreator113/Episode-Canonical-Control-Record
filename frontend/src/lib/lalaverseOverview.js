/**
 * The LalaVerse Overview, to Evoni's mock (Lalas_Social_Media_Page_3,
 * 2026-10-06): "What the world is handing you" and "Lately in the
 * LalaVerse". Pure: the page loads the data and these say what it shows.
 *
 * Honest empty states (Evoni's ruling): each idea comes from real data or
 * says plainly that there is none yet. Trending topics have no direction
 * in the data (feedEngagementService.getTrendingTopics counts posts and
 * engagement only), so a trend reads "is trending", never "rising". There
 * is no world activity log, so "Lately" is stitched from the dates the
 * episodes and events carry, and says so.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const time = (value) => {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

/** The next cultural calendar event on or after today, or null. */
export function nextCulturalEvent(calendarEvents, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const ahead = (calendarEvents || [])
    .map((e) => ({ e, t: time(e?.start_datetime) }))
    .filter(({ e, t }) => t != null && t >= today.getTime() && e?.title)
    .sort((a, b) => a.t - b.t);
  return ahead.length ? ahead[0].e : null;
}

/** The trend with the most engagement, then the most posts, or null. */
export function topTrend(trending) {
  const rows = (trending || []).filter((t) => t?.topic);
  if (!rows.length) return null;
  return [...rows].sort((a, b) => (Number(b.total_engagement) || 0) - (Number(a.total_engagement) || 0)
    || (Number(b.post_count) || 0) - (Number(a.post_count) || 0))[0];
}

const HOT = ['explosive', 'high', 'unresolved', 'simmering'];

/** The hottest tension pair (explosive first), or null. */
export function topTension(pairs) {
  const rows = (pairs || []).filter((p) => p?.char_a?.name && p?.char_b?.name);
  if (!rows.length) return null;
  const rank = (p) => {
    const i = HOT.indexOf(String(p.tension_state || '').toLowerCase());
    return i === -1 ? HOT.length : i;
  };
  return [...rows].sort((a, b) => rank(a) - rank(b))[0];
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The three idea rows: { key, from, text, detail, action, to } when there is
 * something, or { key, from, empty } when there is not. `failed` names the
 * sources that could not be read ('culture' | 'society' | 'state'), which
 * say so instead of claiming there is nothing.
 */
export function worldIdeas({ calendarEvents, trending, tensions, showId, failed = [], now = new Date() }) {
  const producer = (tab) => (showId ? `/shows/${showId}/world?tab=${tab}` : '/universe');
  const unread = (key, from, what) => ({ key, from, empty: `The ${what} could not be read just now.` });

  const ideas = [];

  if (failed.includes('culture')) ideas.push(unread('culture', 'From Culture', 'cultural calendar'));
  else {
    const next = nextCulturalEvent(calendarEvents, now);
    ideas.push(next
      ? {
        key: 'culture', from: 'From Culture',
        text: `${next.title} is coming up in ${MONTHS[new Date(next.start_datetime).getMonth()]}`,
        action: 'Make it an event', to: '/universe?tab=culture&sub=events',
      }
      : { key: 'culture', from: 'From Culture', empty: 'Nothing on the cultural calendar ahead yet.' });
  }

  if (failed.includes('society')) ideas.push(unread('society', 'From Society', 'Feed\'s trends'));
  else {
    const trend = topTrend(trending);
    ideas.push(trend
      ? {
        key: 'society', from: 'From Society',
        text: `${trend.topic} is trending`,
        detail: plural(Number(trend.post_count) || 0, 'post'),
        action: 'Give Lala an opinion on it', to: producer('feed'),
      }
      : { key: 'society', from: 'From Society', empty: 'No trending topics in the Feed yet.' });
  }

  if (failed.includes('state')) ideas.push(unread('state', 'From State', 'tensions'));
  else {
    const pair = topTension(tensions);
    ideas.push(pair
      ? {
        key: 'state', from: 'From State',
        text: `Tension is ${String(pair.tension_state || 'building').toLowerCase()} between ${pair.char_a.name} and ${pair.char_b.name}`,
        action: 'Seed it in an episode', to: producer('episodes'),
      }
      : { key: 'state', from: 'From State', empty: 'No tensions between characters yet.' });
  }

  return ideas;
}

/**
 * "Lately in the LalaVerse": the newest episodes and events by the date
 * they were made, newest first. Returns [{ key, kind, name, verb, at }].
 */
export function latelyItems({ episodes, events, limit = 5 }) {
  const rows = [];
  for (const ep of episodes || []) {
    const at = time(ep?.created_at);
    if (at == null) continue;
    const n = ep.episode_number ?? ep.episodeNumber;
    rows.push({
      key: `episode-${ep.id}`, kind: 'episode', at,
      name: n != null ? `Episode ${n}` : 'An episode',
      verb: ep.title ? `created: ${ep.title}` : 'created',
    });
  }
  for (const ev of events || []) {
    const at = time(ev?.created_at);
    if (at == null || !ev.name) continue;
    rows.push({ key: `event-${ev.id}`, kind: 'event', at, name: ev.name, verb: 'added to the Events library' });
  }
  return rows.sort((a, b) => b.at - a.at).slice(0, limit);
}
