/**
 * What to show when the server refuses a World Location write (Evoni,
 * 2026-11-22). Display only: the server is the guard.
 *
 *   403 AUTH_GROUP_REQUIRED  the write is an admin's.
 *   409                      the location is in use, its Place is locked, or
 *                            its base is approved. The server's sentence
 *                            says what uses it and that nothing was deleted;
 *                            when it sent none, one is made from `uses` or
 *                            `locked_events`.
 */
import { adminOnlyMessage } from './authGroups';

export const LOCATION_ADMIN_ONLY_MESSAGE = 'Only an admin can add, change or delete a location.';

const USE_NAMES = {
  child_locations: 'locations inside it',
  scene_sets: 'scene sets',
  events: 'events',
  looks: 'event looks',
  look_variants: 'look variants',
  calendar_events: 'calendar events',
  profile_homes: 'profiles based there',
  profile_venues: 'profiles that go there',
  feed_posts: 'feed posts',
  timeline_events: 'timeline events',
};

/** "scene sets 2, events 1" from a 409's uses; '' when there are none. */
export function listLocationUses(uses) {
  if (!uses || typeof uses !== 'object') return '';
  return Object.entries(uses)
    .filter(([kind, count]) => kind !== 'total' && Number(count) > 0)
    .map(([kind, count]) => `${USE_NAMES[kind] || kind.replace(/_/g, ' ')} ${count}`)
    .join(', ');
}

/** The admin-only sentence for a refused location write, or null when the error is anything else. */
export const locationAdminOnlyMessage = (err) => adminOnlyMessage(err, LOCATION_ADMIN_ONLY_MESSAGE);

/** One sentence for a failed location delete. */
export function locationDeleteMessage(err, fallback = 'The location could not be deleted.') {
  const admin = locationAdminOnlyMessage(err);
  if (admin) return admin;
  const res = err?.response;
  if (res?.status !== 409) return fallback;
  const data = res.data || {};
  if (typeof data.error === 'string' && data.error.trim()) return data.error;
  const locked = (Array.isArray(data.locked_events) ? data.locked_events : []).map((e) => e?.name).filter(Boolean);
  if (locked.length) return `Its Place is locked by ${locked.join(', ')}. Nothing was deleted.`;
  const uses = listLocationUses(data.uses);
  return uses ? `This location is in use (${uses}). Nothing was deleted.` : 'This location is in use. Nothing was deleted.';
}
