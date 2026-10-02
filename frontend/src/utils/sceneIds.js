/**
 * The Timeline's save updates scene rows in place (Evoni's answer L12a,
 * 2026-10-02, docs/EVENT_EPISODE_FLOW.md §8(hh)) and answers
 * scenes: [{ client_id, id }]. A scene the editor added under a local id
 * ("scene-1717") takes the id of the row the save created, so the next
 * autosave updates that row instead of creating another.
 * Returns the same array when no id changes.
 */
export function adoptSceneIds(scenes, mapping) {
  // Each mapping entry, in the order the save sent its scenes, claims the
  // next unclaimed editor scene with its client id (a scene sent twice
  // under one id took two rows).
  const next = [...scenes];
  const claimed = new Set();
  let changed = false;
  for (const m of mapping || []) {
    if (!m || m.client_id == null || !m.id) continue;
    const i = next.findIndex((s, k) => !claimed.has(k) && String(s.id) === String(m.client_id));
    if (i < 0) continue;
    claimed.add(i);
    if (String(m.id) !== String(next[i].id)) {
      next[i] = { ...next[i], id: m.id };
      changed = true;
    }
  }
  return changed ? next : scenes;
}
