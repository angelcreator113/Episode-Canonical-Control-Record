/**
 * Small readers shared by The Pulse (pages/SocialMediaPage) and Admin ›
 * The Pulse › Review (components/Admin/PulseReviewPost; Task 2925).
 */

/**
 * Lala's view of The Pulse's posts at a story moment (Task 2986): the same
 * read for Admin › The Pulse › Story clock and the Phone's Pulse zone, so a
 * beat shows exactly what The Pulse shows then. `at` is an order, else the
 * present.
 */
export const pulseFeedUrl = (showId, at, limit = 20) =>
  `/api/v1/feed-posts?show_id=${encodeURIComponent(showId)}&status=live&with=comments&limit=${limit}&at=${Number.isInteger(at) ? at : 'present'}`;

export const posterOf = (post) => {
  const p = post.socialProfile || {};
  return {
    name: post.poster_display_name || p.display_name || post.poster_handle || p.handle || 'Unknown',
    handle: post.poster_handle || p.handle || '',
    platform: post.poster_platform || p.platform || '',
  };
};

/** "Just now", "Today at 4:10pm", "Yesterday at 11:42pm", "Tuesday at 9:02am", else the date. */
export function whenLabel(ts, now = new Date()) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const mins = Math.round((now - d) / 60000);
  if (mins >= 0 && mins < 2) return 'Just now';
  if (mins >= 0 && mins < 60) return `${mins} minutes ago`;
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 86400000);
  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Yesterday at ${time}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString([], { weekday: 'long' })} at ${time}`;
  return d.toLocaleDateString();
}

/** A name's first letter or digit, for an initial tile. */
export const initial = (name) => ((name || '').match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase();
/** One of four tile tones, steady for a handle. */
export const toneOf = (handle) => ['c', 'd', 'e', 'f'][(handle || '').length % 4];
