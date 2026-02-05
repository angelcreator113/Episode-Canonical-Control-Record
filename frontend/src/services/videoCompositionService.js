/**
 * Video Composition Service
 * Centralizes all API calls for video compositions (scene templates)
 * Includes schema versioning support for future-proofing
 */

import schema from '../components/SceneComposer/utils/schema';

async function json(req) {
  const res = await req;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

const base = (episodeId) => `/api/v1/episodes/${episodeId}/video-compositions`;

export default {
  /**
   * List all compositions for an episode
   * Applies schema migrations to each composition
   */
  list: async (episodeId) => {
    const response = await json(fetch(base(episodeId)));
    const compositions = response.data || response.compositions || [];
    
    // Apply schema migrations to each composition
    const migrated = compositions.map(comp => {
      try {
        return schema.loadComposition(comp);
      } catch (error) {
        console.error('[Service] Failed to load composition:', comp.id, error);
        return comp; // Return original on error
      }
    });
    
    return { ...response, data: migrated };
  },

  /**
   * Create a new composition
   * Ensures schema version is set
   */
  create: async (episodeId, payload) => {
    const prepared = schema.createComposition({
      ...payload,
      episode_id: episodeId
    });
    
    const response = await json(fetch(base(episodeId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prepared),
    }));
    
    return response;
  },

  /**
   * Get a single composition by ID
   * Applies schema migration if needed
   */
  get: async (episodeId, id) => {
    const response = await json(fetch(`${base(episodeId)}/${id}`));
    const composition = response.data || response;
    
    try {
      const migrated = schema.loadComposition(composition);
      return { ...response, data: migrated };
    } catch (error) {
      console.error('[Service] Failed to load composition:', id, error);
      return response;
    }
  },

  /**
   * Update a composition
   * Ensures schema version is maintained
   */
  update: async (episodeId, id, payload) => {
    const prepared = schema.prepareForSave(payload);
    
    const response = await json(fetch(`${base(episodeId)}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prepared),
    }));
    
    return response;
  },

  /**
   * Delete a composition
   */
  remove: (episodeId, id) =>
    json(fetch(`${base(episodeId)}/${id}`, { method: "DELETE" })),
};
