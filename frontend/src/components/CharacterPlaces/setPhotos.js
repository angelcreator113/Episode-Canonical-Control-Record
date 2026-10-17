/**
 * Photos into one scene set (Evoni, 2026-10-17: "when I'm uploading a scene
 * and then I'm uploading the angles that go with this scene, it is being
 * uploaded as a whole completely different set"). A place's photos are one
 * set: the first photo its main photo, the others its angles; more angles
 * are added to that same set, never made into a new one.
 */
import api from '../../services/api';
import { uploadedAnglePayloads } from '../../lib/angleUpload';

/**
 * Adds each file as an angle of the set (one angle per photo, named from the
 * file). Returns { done, failed: [file names] }: one failed photo does not
 * stop the others.
 */
export async function addAngles(setId, files, existingLabels = []) {
  const list = Array.from(files || []);
  const payloads = uploadedAnglePayloads(list, existingLabels);
  let done = 0;
  const failed = [];
  for (let i = 0; i < list.length; i += 1) {
    try {
      const res = await api.post(`/api/v1/scene-sets/${setId}/angles`, payloads[i]);
      const angleId = res.data?.data?.id;
      if (!angleId) throw new Error('no angle id');
      const form = new FormData();
      form.append('images', list[i]);
      await api.post(`/api/v1/scene-sets/${setId}/angles/${angleId}/upload`, form);
      done += 1;
    } catch (err) {
      console.error('[setPhotos] angle upload failed:', list[i]?.name, err);
      failed.push(list[i]?.name || `photo ${i + 1}`);
    }
  }
  return { done, failed };
}

/**
 * Makes one scene set from the photos: the first is its main photo, the rest
 * its angles. When the set or its main photo cannot be made, nothing is left
 * behind (the set is deleted) and the error is thrown. Returns
 * { setId, angles: { done, failed } }.
 */
export async function makeSetFromPhotos({ name, sceneType, showId, files }) {
  const list = Array.from(files || []);
  if (!list.length) throw new Error('No photos chosen');
  let setId = null;
  try {
    const created = await api.post('/api/v1/scene-sets', { name, scene_type: sceneType, show_id: showId });
    setId = created.data?.data?.id;
    if (!setId) throw new Error('The scene set was not made');
    const form = new FormData();
    form.append('image', list[0]);
    await api.post(`/api/v1/scene-sets/${setId}/upload-base`, form);
  } catch (err) {
    if (setId) await removeSet(setId);
    throw err;
  }
  const angles = list.length > 1 ? await addAngles(setId, list.slice(1)) : { done: 0, failed: [] };
  return { setId, angles };
}

/** Deletes a set made for photos that could not be used (best effort). */
export async function removeSet(setId) {
  try {
    await api.delete(`/api/v1/scene-sets/${setId}`);
  } catch (err) {
    console.error('[setPhotos] the new set was not removed:', err);
  }
}
