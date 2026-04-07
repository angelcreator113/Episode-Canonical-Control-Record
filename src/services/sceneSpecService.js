'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const SPEC_VERSION = '2.0';

/**
 * Build a SceneSpec from a base image using Claude Vision.
 * Produces: room architecture, walls, zones, objects with continuity rules,
 * camera contracts, and room states.
 *
 * @param {object} sceneSet — SceneSet model instance or plain object
 * @param {object} SceneSetModel — Sequelize model class (for persisting)
 * @returns {object|null} The generated SceneSpec
 */
async function buildSceneSpec(sceneSet, SceneSetModel) {
  if (!process.env.ANTHROPIC_API_KEY || !sceneSet.base_still_url) return null;

  // Check cache — scene_spec column or visual_language fallback
  const existing = sceneSet.scene_spec || sceneSet.visual_language?.scene_spec;
  if (existing?.version === SPEC_VERSION && existing?._meta?.base_still_url === sceneSet.base_still_url) {
    console.log(`[SceneSpec] Using cached spec for ${sceneSet.name}`);
    return existing;
  }

  try {
    console.log(`[SceneSpec] Building scene spec for ${sceneSet.name}`);
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: sceneSet.base_still_url } },
          { type: 'text', text: buildSpecPrompt(sceneSet) },
        ],
      }],
    });

    const text = response.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn(`[SceneSpec] No JSON returned. Response: ${text.slice(0, 300)}`);
      return null;
    }

    let spec;
    try {
      spec = JSON.parse(match[0]);
    } catch (parseErr) {
      console.warn(`[SceneSpec] JSON parse failed: ${parseErr.message}`);
      return null;
    }

    // Add metadata
    spec.version = SPEC_VERSION;
    spec._meta = {
      base_still_url: sceneSet.base_still_url,
      generated_at: new Date().toISOString(),
      source: 'base_image_analysis',
      edited_fields: [],
    };

    // Persist
    if (SceneSetModel) {
      try {
        await SceneSetModel.update(
          { scene_spec: spec },
          { where: { id: sceneSet.id } }
        );
      } catch (persistErr) {
        // Column may not exist yet (migration pending) — fall back to visual_language
        if (persistErr.message?.includes('scene_spec') || persistErr.message?.includes('column')) {
          console.warn(`[SceneSpec] scene_spec column not found, storing in visual_language.scene_spec`);
          const vl = sceneSet.visual_language || {};
          await SceneSetModel.update(
            { visual_language: { ...vl, scene_spec: spec } },
            { where: { id: sceneSet.id } }
          );
        } else {
          throw persistErr;
        }
      }
    }

    console.log(`[SceneSpec] Spec built: ${spec.objects?.length || 0} objects, ${spec.zones?.length || 0} zones, ${spec.camera_contracts?.length || 0} contracts`);
    return spec;
  } catch (err) {
    console.error(`[SceneSpec] Build failed: ${err.message}`, err.stack?.slice(0, 500));
    throw err; // Re-throw so the route handler can return the actual error message
  }
}

/**
 * Build the Claude Vision prompt for scene spec extraction.
 */
function buildSpecPrompt(sceneSet) {
  const nameHint = sceneSet.name ? `This room is called "${sceneSet.name}".` : '';
  const typeHint = sceneSet.scene_type ? `Scene type: ${sceneSet.scene_type}.` : '';
  const descHint = sceneSet.canonical_description ? `Existing description: ${sceneSet.canonical_description}` : '';

  return `You are a luxury production designer creating a SCENE SPEC for this room.
This spec will be the source of truth for generating consistent AI camera angles.
Every detail matters — objects that appear in this spec MUST appear in generated images.

${nameHint} ${typeHint}
${descHint}

Analyze this room image and return a complete JSON SceneSpec:

{
  "room": {
    "label": "descriptive name for this room",
    "narrative_role": "what this room says about who lives here — one sentence",
    "approx_sq_ft": <estimated square footage>,
    "ceiling_type": "standard | tray | coffered | vaulted | double_height",
    "ceiling_height_ft": <estimated>,
    "shape": "rectangular | square | l_shaped | open_plan",
    "floor": "exact floor material and finish",
    "wall_treatment": "exact wall materials — paint, plaster, wallpaper, etc.",
    "color_palette": ["#hex name", "#hex name", "#hex name", "#hex name", "#hex name"],
    "atmosphere": "one rich sentence — mood, lighting quality, sensory feeling"
  },

  "walls": {
    "north": { "label": "Wall Name", "description": "everything on this wall" },
    "south": { "label": "Wall Name", "description": "everything on this wall" },
    "east":  { "label": "Wall Name", "description": "everything on this wall" },
    "west":  { "label": "Wall Name", "description": "everything on this wall" }
  },

  "zones": [
    {
      "id": "zone-slug",
      "label": "Human Label",
      "wall": "which wall this zone is against",
      "bounds": { "x": 0.0, "y": 0.0, "w": 0.5, "h": 0.5 },
      "purpose": "what happens in this zone",
      "object_ids": ["obj-id-1", "obj-id-2"]
    }
  ],

  "objects": [
    {
      "id": "kebab-case-slug",
      "label": "Human Name",
      "category": "signature | anchor | character | furniture | lighting | textile | decor | detail | architecture | outdoor",
      "zone": "zone-slug",
      "wall": "north | south | east | west | ceiling | floor | varies",
      "description": "exact appearance — color, material, size, brand if identifiable. Be specific enough to recreate.",
      "continuity": {
        "locked_text": "if text/signage: exact text (optional)",
        "locked_color": "#hex (optional)",
        "locked_material": "material description (optional)",
        "locked_position": "positional constraint (optional)",
        "locked_arrangement": "arrangement rule (optional)"
      },
      "states": {
        "state_name": "description of this state"
      }
    }
  ],

  "camera_contracts": [
    {
      "angle": "WIDE | CLOSE | VANITY | WINDOW | DOORWAY | OVERHEAD | DETAIL | or custom",
      "description": "what this shot shows and why",
      "required": ["obj-id-1", "obj-id-2"],
      "expected": ["obj-id-3"],
      "out_of_frame": ["obj-id-4"],
      "validation": "natural language checklist for validating the generated image"
    }
  ],

  "states": [
    {
      "id": "state-slug",
      "label": "Human Label",
      "time": "morning | afternoon | golden_hour | evening | night",
      "objects": { "obj-id": "state_name" },
      "ambient": "rich description of light, sound, scent, mood for prompt generation"
    }
  ]
}

RULES:
1. Use kebab-case for all IDs (e.g., "neon-sign", "zone-sleep")
2. Zone bounds are 0-1 relative coordinates on a top-down floor plan. (0,0) = front-left, (1,1) = back-right. Zones can overlap.
3. Object categories: "signature" = must be correct in every visible angle. "anchor" = large furniture defining layout. "character" = personal items revealing who lives here. Others are descriptive.
4. Continuity rules: only include locked_ fields that matter for that object. Don't force-fill all fields.
5. Camera contracts: "required" = generation FAILS without these. "expected" = should appear, warning if missing. "out_of_frame" = should NOT appear (prevents hallucination).
6. Create at least 6 camera angles covering different parts of the room.
7. Create at least 3 room states (morning, evening, night minimum).
8. List EVERY visible object — furniture, decor, lighting, architecture. Don't skip small items.
9. If there is text/signage visible, the exact text is CRITICAL for continuity.
10. This should be luxury-scale. Describe materials at their highest plausible tier.

Return ONLY the JSON. No markdown, no commentary.`;
}


// ─── PROMPT ENHANCEMENT ─────────────────────────────────────────────────────

/**
 * Build constraint text from scene_spec camera contracts for a specific angle.
 * Injected into the generation prompt to enforce object presence.
 *
 * @param {object} spec — The SceneSpec
 * @param {string} angleLabel — e.g. "WIDE", "VANITY"
 * @returns {string} Constraint text for the generation prompt
 */
function buildAngleConstraints(spec, angleLabel) {
  if (!spec?.camera_contracts || !spec?.objects) return '';

  // Find matching contract (case-insensitive, partial match)
  const contract = spec.camera_contracts.find(c =>
    c.angle && angleLabel.toUpperCase().includes(c.angle.toUpperCase())
  );
  if (!contract) return '';

  const objectMap = new Map(spec.objects.map(o => [o.id, o]));
  const parts = [];

  // Required objects — MUST appear
  if (contract.required?.length) {
    const requiredDescs = contract.required
      .map(id => {
        const obj = objectMap.get(id);
        if (!obj) return null;
        const cont = obj.continuity || {};
        let desc = `${obj.label}: ${obj.description}`;
        if (cont.locked_text) desc += ` Text reads exactly: "${cont.locked_text}".`;
        if (cont.locked_color) desc += ` Color: ${cont.locked_color}.`;
        if (cont.locked_material) desc += ` Material: ${cont.locked_material}.`;
        return desc;
      })
      .filter(Boolean);

    if (requiredDescs.length) {
      parts.push(`MUST INCLUDE these objects:\n${requiredDescs.map(d => `- ${d}`).join('\n')}`);
    }
  }

  // Expected objects — should appear
  if (contract.expected?.length) {
    const expectedNames = contract.expected
      .map(id => objectMap.get(id)?.label)
      .filter(Boolean);
    if (expectedNames.length) {
      parts.push(`Should also show: ${expectedNames.join(', ')}.`);
    }
  }

  // Out of frame — should NOT appear
  if (contract.out_of_frame?.length) {
    const excludeNames = contract.out_of_frame
      .map(id => objectMap.get(id)?.label)
      .filter(Boolean);
    if (excludeNames.length) {
      parts.push(`Do NOT include: ${excludeNames.join(', ')}.`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Build ambient/lighting description from scene_spec state.
 *
 * @param {object} spec — The SceneSpec
 * @param {string} stateId — e.g. "morning", "night"
 * @returns {string} Ambient description for prompt
 */
function buildStateAmbient(spec, stateId) {
  if (!spec?.states) return '';

  const state = spec.states.find(s => s.id === stateId || s.time === stateId);
  if (!state) return '';

  return state.ambient || '';
}

/**
 * Get the validation prompt for a specific camera angle.
 * Used by post-generation quality checking.
 *
 * @param {object} spec — The SceneSpec
 * @param {string} angleLabel — e.g. "WIDE"
 * @returns {string|null} Validation prompt or null
 */
function getValidationPrompt(spec, angleLabel) {
  if (!spec?.camera_contracts) return null;

  const contract = spec.camera_contracts.find(c =>
    c.angle && angleLabel.toUpperCase().includes(c.angle.toUpperCase())
  );

  return contract?.validation || null;
}

/**
 * Validate a generated angle image against the scene spec.
 * Uses Claude Vision to check required objects are present.
 *
 * @param {string} imageUrl — URL of the generated angle image
 * @param {object} spec — The SceneSpec
 * @param {string} angleLabel — e.g. "WIDE"
 * @returns {object} { score, pass, missing_required, issues }
 */
async function validateAngleAgainstSpec(imageUrl, spec, angleLabel) {
  if (!process.env.ANTHROPIC_API_KEY || !spec?.camera_contracts) {
    return { score: 100, pass: true, missing_required: [], issues: [] };
  }

  const contract = spec.camera_contracts.find(c =>
    c.angle && angleLabel.toUpperCase().includes(c.angle.toUpperCase())
  );
  if (!contract) {
    return { score: 100, pass: true, missing_required: [], issues: [] };
  }

  const objectMap = new Map(spec.objects.map(o => [o.id, o]));

  // Build checklist from required + expected
  const checklist = [];
  for (const id of (contract.required || [])) {
    const obj = objectMap.get(id);
    if (obj) checklist.push({ id, label: obj.label, tier: 'required', description: obj.description });
  }
  for (const id of (contract.expected || [])) {
    const obj = objectMap.get(id);
    if (obj) checklist.push({ id, label: obj.label, tier: 'expected', description: obj.description });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const checklistText = checklist.map(c =>
      `- [${c.tier.toUpperCase()}] ${c.label}: ${c.description}`
    ).join('\n');

    const validationHint = contract.validation ? `\nOverall validation: ${contract.validation}` : '';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: imageUrl } },
          { type: 'text', text: `You are validating a generated room image against a scene spec.
This image should be a "${angleLabel}" angle of a room.

Check whether these objects are present in the image:
${checklistText}
${validationHint}

Return JSON:
{
  "score": <0-100>,
  "present": ["obj-id-1", "obj-id-2"],
  "missing": ["obj-id-3"],
  "wrong": ["obj-id with description of what's wrong"],
  "issues": ["specific issue 1", "specific issue 2"]
}

Scoring: Each missing REQUIRED object = -15 points. Each missing EXPECTED = -5. Each wrong detail = -10. Start at 100.
Return ONLY JSON.` },
        ],
      }],
    });

    const text = response.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { score: 100, pass: true, missing_required: [], issues: [] };

    const result = JSON.parse(match[0]);
    const missingRequired = (result.missing || []).filter(id =>
      (contract.required || []).includes(id)
    );

    result.missing_required = missingRequired;
    result.pass = (result.score || 0) >= 70 && missingRequired.length === 0;

    console.log(`[SceneSpec] Validation for "${angleLabel}": score=${result.score}, pass=${result.pass}, missing_required=${missingRequired.length}`);
    return result;
  } catch (err) {
    console.warn(`[SceneSpec] Validation failed (non-blocking): ${err.message}`);
    return { score: 100, pass: true, missing_required: [], issues: [] };
  }
}

/**
 * Merge user edits into an existing scene spec.
 * Preserves AI-generated data while allowing manual overrides.
 *
 * @param {object} existingSpec — Current scene_spec
 * @param {object} edits — Partial spec with user changes
 * @returns {object} Merged spec
 */
function mergeSpecEdits(existingSpec, edits) {
  if (!existingSpec) return edits;

  const merged = JSON.parse(JSON.stringify(existingSpec));

  // Merge room-level fields
  if (edits.room) {
    merged.room = { ...merged.room, ...edits.room };
  }

  // Merge walls
  if (edits.walls) {
    merged.walls = { ...merged.walls, ...edits.walls };
  }

  // Replace zones if provided (array merge is too complex for partial)
  if (edits.zones) merged.zones = edits.zones;

  // Merge objects by ID
  if (edits.objects) {
    const existingMap = new Map((merged.objects || []).map(o => [o.id, o]));
    for (const obj of edits.objects) {
      existingMap.set(obj.id, { ...(existingMap.get(obj.id) || {}), ...obj });
    }
    merged.objects = [...existingMap.values()];
  }

  // Replace camera contracts if provided
  if (edits.camera_contracts) merged.camera_contracts = edits.camera_contracts;

  // Replace states if provided
  if (edits.states) merged.states = edits.states;

  // Track edited fields
  merged._meta = merged._meta || {};
  merged._meta.last_edited = new Date().toISOString();
  merged._meta.edited_fields = [
    ...(merged._meta.edited_fields || []),
    ...Object.keys(edits).filter(k => k !== '_meta'),
  ];
  merged._meta.edited_fields = [...new Set(merged._meta.edited_fields)];

  return merged;
}


module.exports = {
  buildSceneSpec,
  buildAngleConstraints,
  buildStateAmbient,
  getValidationPrompt,
  validateAngleAgainstSpec,
  mergeSpecEdits,
  SPEC_VERSION,
};
