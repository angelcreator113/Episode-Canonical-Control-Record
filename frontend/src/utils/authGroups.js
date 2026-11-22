/**
 * authGroups — Cognito group checks for the signed-in user.
 *
 * The stored user (login response, cognitoPasswordAuthService) carries
 * `groups` from the token's cognito:groups claim and never a `role`, so page
 * checks must test groups. Case-insensitive, plain toLowerCase(), matching
 * authorize() in src/middleware/auth.js. Pool groups: admin, editor, viewer.
 */

// What a page shows when the server kept a scene, set or footage write for
// an admin (pass it to adminOnlyMessage below), and the notice on a page a
// signed-in person may open but not edit. Display only.
export const SCENE_ADMIN_ONLY_MESSAGE = 'Only an admin can change scenes, sets or footage.';
export const VIEW_ONLY_NOTICE = 'View-only — Admin editing required';
export function sceneAdminOnlyMessage(err) {
  return adminOnlyMessage(err, SCENE_ADMIN_ONLY_MESSAGE);
}

export const userInGroup = (user, group) => {
  if (!user || !Array.isArray(user.groups) || typeof group !== 'string') return false;
  const wanted = group.toLowerCase();
  return user.groups.some((g) => typeof g === 'string' && g.toLowerCase() === wanted);
};

export const isAdmin = (user) => userInGroup(user, 'admin');

// A write the server kept for an admin answers 403 with this code: from
// authorize(['ADMIN']) with its own wording ("User must be in one of these
// groups: ADMIN"), or from a handler that refuses one field with a sentence
// of its own. adminOnlyMessage(err) is what to show a person: the handler's
// sentence when it sent one, else the page's sentence; null when the error
// is anything else, so callers keep their own message. Display only: the
// server is the guard.
export const ADMIN_ONLY_CODE = 'AUTH_GROUP_REQUIRED';
export const PLAN_ADMIN_ONLY_MESSAGE = 'Only an admin can change the production plan.';
const MIDDLEWARE_WORDING = /^User must be in one of these groups/i;

export const adminOnlyMessage = (err, sentence = PLAN_ADMIN_ONLY_MESSAGE) => {
  const res = err?.response;
  if (!res || res.status !== 403 || res.data?.code !== ADMIN_ONLY_CODE) return null;
  const own = res.data.message;
  return typeof own === 'string' && own.trim() && !MIDDLEWARE_WORDING.test(own) ? own : sentence;
};
