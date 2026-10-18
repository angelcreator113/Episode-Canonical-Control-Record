/**
 * Photos into one scene set (Evoni, 2026-10-17: "when I'm uploading a scene
 * and then I'm uploading the angles that go with this scene, it is being
 * uploaded as a whole completely different set"). A place's photos are one
 * set: the first photo its main photo, the others its angles; more angles
 * are added to that same set, never made into a new one.
 */
import api from '../../services/api';
import { uploadedAnglePayloads } from '../../lib/angleUpload';

// The upload routes' limit (sceneSetRoutes multer limits.fileSize): a larger
// photo is refused here, before its angle or set is made (sixth audit).
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const tooBig = (file) => Number(file?.size) > MAX_PHOTO_BYTES;

/**
 * Adds each file as an angle of the set (one angle per photo, named from the
 * file). Returns { done, failed: [file names] }: one failed photo does not
 * stop the others. A photo over 10 MB is not sent; an angle whose photo did
 * not upload is deleted again, so the set keeps no empty angle and its name
 * is free for the next try (sixth audit).
 */
export async function addAngles(setId, files, existingLabels = []) {
  const list = Array.from(files || []);
  const payloads = uploadedAnglePayloads(list, existingLabels);
  let done = 0;
  const failed = [];
  for (let i = 0; i < list.length; i += 1) {
    const label = list[i]?.name || `photo ${i + 1}`;
    if (tooBig(list[i])) {
      failed.push(`${label} (over 10 MB)`);
      continue;
    }
    let angleId = null;
    try {
      const res = await api.post(`/api/v1/scene-sets/${setId}/angles`, payloads[i]);
      angleId = res.data?.data?.id;
      if (!angleId) throw new Error('no angle id');
      const form = new FormData();
      form.append('images', list[i]);
      await api.post(`/api/v1/scene-sets/${setId}/angles/${angleId}/upload`, form);
      done += 1;
    } catch (err) {
      console.error('[setPhotos] angle upload failed:', label, err);
      failed.push(label);
      if (angleId) {
        try {
          await api.delete(`/api/v1/scene-sets/${setId}/angles/${angleId}`);
        } catch (cleanupErr) {
          console.error('[setPhotos] the empty angle was not removed:', cleanupErr);
        }
      }
    }
  }
  return { done, failed };
}

/**
 * Makes one scene set from the photos: the first is its main photo, the rest
 * its angles. When the set or its main photo cannot be made, nothing is left
 * behind (the set is deleted) and the error is thrown. Returns
 * { setId, angles: { done, failed } }.
 *
 * prepare(setId), when given, runs on the empty set before any photo is
 * sent: a step that can refuse (an event's place locked) refuses before the
 * photos are uploaded and analysed (sixth audit). undo(setId) reverses it
 * when a later step fails, before the set is deleted.
 *
 * worldLocationId, when given, ties the set to that World Location (a
 * creator's studio, from its card on Universe › Locations, 2026-10-18).
 */
export async function makeSetFromPhotos({ name, sceneType, showId, files, prepare = null, undo = null, worldLocationId = null }) {
  const list = Array.from(files || []);
  if (!list.length) throw new Error('No photos chosen');
  if (tooBig(list[0])) throw new Error(`${list[0].name || 'The main photo'} is over 10 MB`);
  let setId = null;
  let prepared = false;
  try {
    const created = await api.post('/api/v1/scene-sets', { name, scene_type: sceneType, show_id: showId, ...(worldLocationId ? { world_location_id: worldLocationId } : {}) });
    setId = created.data?.data?.id;
    if (!setId) throw new Error('The scene set was not made');
    if (prepare) {
      await prepare(setId);
      prepared = true;
    }
    const form = new FormData();
    form.append('image', list[0]);
    await api.post(`/api/v1/scene-sets/${setId}/upload-base`, form);
  } catch (err) {
    if (prepared && undo) {
      try {
        await undo(setId);
      } catch (undoErr) {
        console.error('[setPhotos] the step before the photos was not undone:', undoErr);
      }
    }
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
