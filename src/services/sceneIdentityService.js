'use strict';

/**
 * Scene Identity Service
 *
 * Uses Claude to auto-extract structured visual identity from a scene set's
 * canonical_description. Populates the visual_language JSONB field with:
 *   palette, mood, lighting, materials, anchors, avoid, composition_notes
 *
 * Follows the claudeService.js singleton pattern.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { SCENE_TYPE_PRIORS } = require('./sceneTypePriors');

const IDENTITY_VERSION = 'v1';
const EXTRACTION_TIMEOUT_MS = 120000; // 2 minutes — zombie threshold

class SceneIdentityService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.model = 'claude-sonnet-4-6';
  }

  /**
   * Check if the Anthropic API key is configured.
   */
  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Extract visual identity from a scene set's canonical description.
   * Returns the extracted identity object (without _meta).
   */
  async extractVisualIdentity(sceneSet) {
    if (!this.isConfigured()) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const description = sceneSet.canonical_description;
    if (!description || description.trim().length < 20) {
      throw new Error('canonical_description is too short for identity extraction');
    }

    const prior = SCENE_TYPE_PRIORS[sceneSet.scene_type] || SCENE_TYPE_PRIORS.OTHER;
    const prompt = this._buildExtractionPrompt(sceneSet, prior);

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Claude identity response');
    }

    const identity = JSON.parse(jsonMatch[0]);

    // Validate required fields
    const required = ['palette', 'mood', 'lighting', 'materials', 'anchors', 'avoid'];
    for (const field of required) {
      if (!identity[field]) {
        throw new Error(`Claude identity response missing required field: ${field}`);
      }
    }

    // Ensure arrays
    if (!Array.isArray(identity.anchors)) identity.anchors = [identity.anchors];
    if (!Array.isArray(identity.avoid)) identity.avoid = [identity.avoid];

    return {
      palette: String(identity.palette || ''),
      mood: String(identity.mood || ''),
      lighting: String(identity.lighting || ''),
      materials: String(identity.materials || ''),
      anchors: identity.anchors.map(String).slice(0, 8),
      avoid: identity.avoid.map(String).slice(0, 8),
      composition_notes: String(identity.composition_notes || ''),
    };
  }

  /**
   * Extract and merge into the scene set's visual_language, respecting
   * user-edited fields. Returns the merged visual_language object.
   *
   * @param {Object} sceneSet - The scene set record
   * @param {Object} SceneSetModel - The Sequelize model class for updating
   */
  async extractAndMerge(sceneSet, SceneSetModel) {
    const existing = sceneSet.visual_language || {};
    const editedFields = (existing._meta && existing._meta.edited_fields) || [];

    // Mark as extracting
    const extractingMeta = {
      source: 'extracting',
      version: IDENTITY_VERSION,
      extracted_at: new Date().toISOString(),
      edited_fields: editedFields,
      error: null,
    };
    await SceneSetModel.update(
      { visual_language: { ...existing, _meta: extractingMeta } },
      { where: { id: sceneSet.id } }
    );

    try {
      const extracted = await this.extractVisualIdentity(sceneSet);

      // Field-level merge: user-edited fields win
      const merged = {};
      const identityFields = ['palette', 'mood', 'lighting', 'materials', 'anchors', 'avoid', 'composition_notes'];
      for (const field of identityFields) {
        if (editedFields.includes(field) && existing[field] != null) {
          merged[field] = existing[field];
        } else {
          merged[field] = extracted[field];
        }
      }

      merged._meta = {
        source: 'claude_auto',
        version: IDENTITY_VERSION,
        extracted_at: new Date().toISOString(),
        edited_fields: editedFields,
        error: null,
      };

      await SceneSetModel.update(
        { visual_language: merged },
        { where: { id: sceneSet.id } }
      );

      return merged;
    } catch (err) {
      // Mark as failed
      const failMeta = {
        ...extractingMeta,
        source: 'failed',
        error: err.message,
      };
      await SceneSetModel.update(
        { visual_language: { ...existing, _meta: failMeta } },
        { where: { id: sceneSet.id } }
      ).catch((e) => console.warn('[sceneIdentity] failed to persist fail meta:', e?.message));

      throw err;
    }
  }

  /**
   * Derive extraction status from visual_language._meta.
   */
  deriveStatus(visualLanguage) {
    const vl = visualLanguage || {};
    const meta = vl._meta;

    if (!meta) {
      // Check if there's any identity data at all (could be manually set)
      const hasData = vl.palette || vl.mood || vl.anchors;
      return hasData ? 'ready' : 'empty';
    }

    if (meta.source === 'extracting') {
      // Zombie check
      if (meta.extracted_at && (Date.now() - new Date(meta.extracted_at).getTime()) > EXTRACTION_TIMEOUT_MS) {
        return 'failed';
      }
      return 'extracting';
    }

    if (meta.source === 'failed' || meta.error) {
      return 'failed';
    }

    if (meta.source === 'claude_auto' || meta.source === 'user_edited') {
      return 'ready';
    }

    return 'empty';
  }

  /**
   * Build the Claude prompt for identity extraction.
   * @private
   */
  _buildExtractionPrompt(sceneSet, prior) {
    const tagsSection = [];
    if (Array.isArray(sceneSet.aesthetic_tags) && sceneSet.aesthetic_tags.length) {
      tagsSection.push(`AESTHETIC TAGS: ${sceneSet.aesthetic_tags.join(', ')}`);
    }
    if (Array.isArray(sceneSet.mood_tags) && sceneSet.mood_tags.length) {
      tagsSection.push(`MOOD TAGS: ${sceneSet.mood_tags.join(', ')}`);
    }

    return `You are a cinematic art director for the LalaVerse — a literary fiction world with Final Fantasy softness, Pinterest-core femininity, and magical realism.

Given this scene description, extract a visual identity for image generation.

SCENE TYPE: ${sceneSet.scene_type || 'OTHER'} — ${prior.spatial_logic}
SCENE NAME: "${sceneSet.name}"
COMPOSITION TENDENCY: ${prior.composition_bias}

DESCRIPTION:
${sceneSet.canonical_description}

${tagsSection.length ? tagsSection.join('\n') + '\n' : ''}
Extract as JSON (respond ONLY with valid JSON, no markdown, no explanation):
{
  "palette": "5-8 specific colors/tones (be precise: 'dusty lavender' not 'purple')",
  "mood": "3-5 emotional/atmospheric words",
  "lighting": "specific sources, quality, temperature, time of day",
  "materials": "dominant textures and surfaces visible in this space",
  "anchors": ["4-6 signature visual elements that MUST appear every time this scene is shown — objects/features, not moods"],
  "avoid": ["4-6 things that would break this scene's identity, specific to this type of space"],
  "composition_notes": "what makes this space compositionally distinctive — depth, focal points, spatial flow (keep under 100 words)"
}

SCENE TYPE GUIDANCE:
- Common elements for ${sceneSet.scene_type || 'OTHER'}: ${prior.common_anchors}
- Common generation failures for ${sceneSet.scene_type || 'OTHER'}: ${prior.common_avoid}

RULES:
- Be SPECIFIC, not generic. "soft lamplight and fairy string lights at dusk" not "warm lighting"
- anchors = recurring iconic objects/features visible in frame, not moods or feelings
- avoid = most likely AI image generation failures for THIS type of space
- palette should use precise color names like "dusty lavender" or "antique gold" not "purple" or "yellow"
- composition_notes should guide camera placement and framing, not describe mood`;
  }
}

module.exports = new SceneIdentityService();
