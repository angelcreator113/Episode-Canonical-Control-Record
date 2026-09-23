/**
 * authGroups — Cognito group checks for the signed-in user.
 *
 * The stored user (login response, cognitoPasswordAuthService) carries
 * `groups` from the token's cognito:groups claim and never a `role`, so page
 * checks must test groups. Case-insensitive, plain toLowerCase(), matching
 * authorize() in src/middleware/auth.js. Pool groups: admin, editor, viewer.
 */

export const userInGroup = (user, group) => {
  if (!user || !Array.isArray(user.groups) || typeof group !== 'string') return false;
  const wanted = group.toLowerCase();
  return user.groups.some((g) => typeof g === 'string' && g.toLowerCase() === wanted);
};

export const isAdmin = (user) => userInGroup(user, 'admin');
