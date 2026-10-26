/**
 * phoneDeadLinks — links on Lala's Phone that lead to a screen the phone
 * doesn't have (phone round step 1, D1). The Phone Hub's health check reads
 * these; deleting a screen removes the same links on the server
 * (DELETE /ui-overlays/:showId/types/:typeId).
 *
 * A zone's own "Go to" action wins over its target on the phone
 * (phoneRuntime.actionsForZone), so a navigate action to a missing screen is
 * a dead link even when the zone's target is fine. A mission needs a screen
 * when a reward opens it or an objective or start condition asks for
 * "visited:<key>".
 */

const VISITED = 'visited:';

const navigateTargets = (actions) => (Array.isArray(actions) ? actions : [])
  .filter(a => a?.type === 'navigate' && a.target)
  .map(a => a.target);

const visitedKeys = (conditions) => (Array.isArray(conditions) ? conditions : [])
  .map(c => c?.key)
  .filter(k => typeof k === 'string' && k.startsWith(VISITED) && k.length > VISITED.length)
  .map(k => k.slice(VISITED.length));

// Zones whose navigate actions name a screen not in `screenKeys` (a Set).
export function deadNavigateZones(links, screenKeys) {
  return (Array.isArray(links) ? links : [])
    .filter(link => navigateTargets(link?.actions).some(t => !screenKeys.has(t)));
}

// Missions that need a screen not in `screenKeys`: for each, the missing
// keys its rewards open, and the objectives and start condition that ask
// for a visit to one.
export function missionScreenIssues(missions, screenKeys) {
  const out = [];
  for (const mission of Array.isArray(missions) ? missions : []) {
    if (!mission) continue;
    const rewards = [...new Set(navigateTargets(mission.reward_actions).filter(t => !screenKeys.has(t)))];
    const objectives = (Array.isArray(mission.objectives) ? mission.objectives : [])
      .flatMap(o => visitedKeys(o?.condition).filter(k => !screenKeys.has(k))
        .map(key => ({ label: o.label || o.id || 'An objective', key })));
    const start = [...new Set(visitedKeys(mission.start_condition).filter(k => !screenKeys.has(k)))];
    if (rewards.length || objectives.length || start.length) out.push({ mission, rewards, objectives, start });
  }
  return out;
}

// The zones as deleting screen `key` leaves them: zones that target it go,
// navigate actions to it go, and a zone left with no target and nothing to
// do goes too (the server does the same).
export function stripScreenFromLinks(links, key) {
  const out = [];
  for (const link of Array.isArray(links) ? links : []) {
    if (link?.target === key) continue;
    const actions = Array.isArray(link?.actions) ? link.actions : null;
    if (!actions || !actions.some(a => a?.type === 'navigate' && a.target === key)) { out.push(link); continue; }
    const rest = actions.filter(a => !(a?.type === 'navigate' && a.target === key));
    if (!link.target && rest.length === 0) continue;
    out.push({ ...link, actions: rest });
  }
  return out;
}
