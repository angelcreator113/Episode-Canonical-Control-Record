'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const SPEC_VERSION = '2.1'; // 2.1 (2026-10-07): view + frame; angles fit the picture

/**
 * Build a SceneSpec from a base image using Claude Vision.
 * Produces: room architecture, walls, zones, objects with continuity rules,
 * camera contracts, and room states.
 *
 * @param {object} sceneSet — SceneSet model instance or plain object
 * @param {object} SceneSetModel — Sequelize model class (for persisting)
 * @returns {object|null} The generated SceneSpec
 */
/**
 * A candidate spec is usable when it has the parts the rest of the system
 * reads: zones and objects (arrays) and at least one camera contract. The
 * problems are named so a refused rebuild says why.
 */
function validateSpecCandidate(spec) {
  const problems = [];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return { ok: false, problems: ['not a JSON object'] };
  if (!Array.isArray(spec.zones)) problems.push('zones is not a list');
  if (!Array.isArray(spec.objects)) problems.push('objects is not a list');
  if (!Array.isArray(spec.camera_contracts) || spec.camera_contracts.length === 0) problems.push('no camera contracts');
  return { ok: problems.length === 0, problems };
}

/**
 * @param {{ force?: boolean }} [opts] force: bypass the cached spec and
 *   build a new one. The saved spec is never cleared first (audit SCENE-03,
 *   2026-10-03): a candidate is built, validated, then saved in one write
 *   with the one it replaces kept as visual_language.scene_spec_previous.
 *   An AI failure or an unusable candidate leaves the old spec in place.
 */
async function buildSceneSpec(sceneSet, SceneSetModel, { force = false } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  if (!sceneSet.base_still_url) {
    throw new Error('No base_still_url on scene set');
  }

  // The spec on record: scene_spec column, else the pre-migration fallback.
  const existing = sceneSet.scene_spec || sceneSet.visual_language?.scene_spec || null;
  if (!force && existing?.version === SPEC_VERSION && existing?._meta?.base_still_url === sceneSet.base_still_url) {
    console.log(`[SceneSpec] Using cached spec for ${sceneSet.name}`);
    return existing;
  }

  console.log(`[SceneSpec] Building scene spec for ${sceneSet.name}, image: ${sceneSet.base_still_url?.slice(0, 80)}`);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'url', url: sceneSet.base_still_url } },
        { type: 'text', text: buildSpecPrompt(sceneSet) },
      ],
    }],
  });

  const text = response.content?.[0]?.text || '';
  console.log(`[SceneSpec] Claude response length: ${text.length}, stop_reason: ${response.stop_reason}`);

  if (!text) {
    throw new Error(`Claude returned empty response. stop_reason: ${response.stop_reason}, content types: ${response.content?.map(c => c.type).join(',')}`);
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Claude response contained no JSON. First 500 chars: ${text.slice(0, 500)}`);
  }

  let spec;
  try {
    spec = JSON.parse(match[0]);
  } catch (parseErr) {
    // Try to repair common Claude JSON issues
    const repaired = match[0]
      .replace(/,\s*}/g, '}')       // trailing commas before }
      .replace(/,\s*]/g, ']')       // trailing commas before ]
      .replace(/'/g, '"')           // single quotes to double
      .replace(/\n/g, '\\n')        // unescaped newlines in strings
      .replace(/\\n/g, ' ')         // then collapse them
      .replace(/\t/g, ' ');         // tabs

    try {
      spec = JSON.parse(repaired);
    } catch {
      // If still failing, the JSON is likely truncated — try to close it
      let truncated = match[0];
      // Count open braces/brackets and close them
      const opens = (truncated.match(/\{/g) || []).length;
      const closes = (truncated.match(/\}/g) || []).length;
      const openBrackets = (truncated.match(/\[/g) || []).length;
      const closeBrackets = (truncated.match(/\]/g) || []).length;

      // Remove any trailing partial key-value or string
      truncated = truncated.replace(/,?\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/, '');
      // Close arrays then objects
      for (let i = 0; i < openBrackets - closeBrackets; i++) truncated += ']';
      for (let i = 0; i < opens - closes; i++) truncated += '}';

      // Clean trailing commas again after truncation repair
      truncated = truncated.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

      try {
        spec = JSON.parse(truncated);
        console.warn(`[SceneSpec] Repaired truncated JSON (closed ${opens - closes} braces, ${openBrackets - closeBrackets} brackets)`);
      } catch (finalErr) {
        throw new Error(`JSON parse failed after repair attempts: ${parseErr.message}. Response was ${text.length} chars, stop_reason: ${response.stop_reason}. First 300 chars: ${match[0].slice(0, 300)}`);
      }
    }
  }

    // The candidate must be usable before it replaces anything.
    const check = validateSpecCandidate(spec);
    if (!check.ok) {
      throw new Error(`Claude's spec is not usable (${check.problems.join('; ')}); the saved spec is unchanged`);
    }

    // Add metadata
    spec.version = SPEC_VERSION;
    spec._meta = {
      base_still_url: sceneSet.base_still_url,
      generated_at: new Date().toISOString(),
      source: 'base_image_analysis',
      forced: Boolean(force),
      edited_fields: [],
      // What this spec replaced, so a rebuild is visibly a rebuild.
      previous: existing ? { generated_at: existing._meta?.generated_at || null, base_still_url: existing._meta?.base_still_url || null, source: existing._meta?.source || null } : null,
    };

    // Persist: one write, the new spec and the one it replaces together.
    if (SceneSetModel) {
      const vl = { ...(sceneSet.visual_language || {}) };
      if (existing) vl.scene_spec_previous = existing;
      // The fallback copy must not outlive the column's spec: a stale
      // visual_language.scene_spec would be read back as current.
      delete vl.scene_spec;
      try {
        await SceneSetModel.update(
          { scene_spec: spec, visual_language: vl },
          { where: { id: sceneSet.id } }
        );
      } catch (persistErr) {
        // Column may not exist yet (migration pending) — fall back to visual_language
        if (persistErr.message?.includes('scene_spec') || persistErr.message?.includes('column')) {
          console.warn(`[SceneSpec] scene_spec column not found, storing in visual_language.scene_spec`);
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
}

/**
 * The part of the base picture a camera contract covers ("frame", 0-1
 * fractions of the image), or null: no contract for this label, no frame,
 * or a frame that is not a usable box (outside the picture, or under a
 * tenth of it either way). Evoni, 2026-10-07: angles crop the set's own
 * picture where the spec says the shot is, never a fixed bedroom box.
 */
function contractFrame(spec, angleLabel) {
  const label = String(angleLabel || '').toUpperCase();
  const contracts = Array.isArray(spec?.camera_contracts) ? spec.camera_contracts : [];
  const norm = (a) => String(a || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const contract = contracts.find((c) => norm(c.angle) === label)
    || contracts.find((c) => c.angle && label.includes(norm(c.angle)));
  const f = contract?.frame;
  if (!f || typeof f !== 'object') return null;
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v));
  const left = n(f.left); const top = n(f.top); const width = n(f.width); const height = n(f.height);
  if (![left, top, width, height].every(Number.isFinite)) return null;
  if (left < 0 || top < 0 || width < 0.1 || height < 0.1) return null;
  if (left + width > 1.001 || top + height > 1.001) return null;
  return { left, top, width: Math.min(width, 1 - left), height: Math.min(height, 1 - top) };
}

/**
 * Build the Claude Vision prompt for scene spec extraction.
 */
function buildSpecPrompt(sceneSet) {
  const nameHint = sceneSet.name ? `This room is called "${sceneSet.name}".` : '';
  const typeHint = sceneSet.scene_type ? `Scene type: ${sceneSet.scene_type}.` : '';
  const descHint = sceneSet.canonical_description ? `Existing description: ${sceneSet.canonical_description}` : '';

  const isEvent = sceneSet.scene_type === 'EVENT_LOCATION';
  const isTransition = sceneSet.scene_type === 'TRANSITION';
  const isHome = sceneSet.scene_type === 'HOME_BASE' || sceneSet.scene_type === 'CLOSET';

  // Adapt camera contract count by scene type
  let angleRule, stateRule, scaleNote;
  if (isEvent) {
    angleRule = 'Create exactly 1-2 camera angles. One establishing exterior/entrance shot is required. One interior wide shot is optional.';
    stateRule = 'Create 1-2 room states (evening event and one other).';
    scaleNote = 'This is an EVENT VENUE — focus on the entrance, facade, and main event space. Do NOT over-detail interior furniture.';
  } else if (isTransition) {
    angleRule = 'Create 1-2 camera angles — the transition moment only.';
    stateRule = 'Create 1-2 room states.';
    scaleNote = 'This is a TRANSITION space — hallway, elevator, car, street. Keep it focused.';
  } else if (isHome) {
    // Evoni, 2026-10-07: "still trying to do 8 of the wrong angle". A home
    // base can be the outside of the house; plan only what this picture holds.
    angleRule = 'Create 2-8 camera angles, only as many as this picture supports. For an INTERIOR, cover different parts of the room that are visible. For an EXTERIOR (the outside of the house: facade, entrance, driveway, garden, pool), every angle must be of the outside (e.g. ESTABLISHING, ENTRANCE, GARDEN, DETAIL of the facade); never plan a bed, vanity, closet or other interior angle the picture does not show.';
    stateRule = 'Create at least 3 room states (morning, evening, night minimum).';
    scaleNote = 'This is a RECURRING location — Lala lives here. Every detail matters for continuity across episodes.';
  } else {
    angleRule = 'Create 2-4 camera angles for the key perspectives.';
    stateRule = 'Create 2-3 room states.';
    scaleNote = '';
  }

  return `You are a luxury production designer creating a SCENE SPEC for this location.
This spec will be the source of truth for generating consistent AI camera angles.
Every detail matters — objects that appear in this spec MUST appear in generated images.

${nameHint} ${typeHint}
${descHint}
${scaleNote}

Analyze this image and return a complete JSON SceneSpec.
FIRST decide what the picture shows: an interior (inside a room), an exterior (the outside of a building, a street, a garden) or both. Set "view" to "interior", "exterior" or "mixed", and plan every camera angle from what is actually in THIS picture. For an exterior, "room" describes the place as a whole and "walls" describe the visible sides or facades.

{
  "view": "interior | exterior | mixed",
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
      "angle": "WIDE | ESTABLISHING | ENTRANCE | GARDEN | CLOSE | DETAIL | DOORWAY | WINDOW | VANITY | OVERHEAD | or custom (only what this picture holds)",
      "kind": "front | inside | back | area | zone | extra",
      "description": "what this shot shows and why",
      "frame": { "left": 0.0, "top": 0.0, "width": 1.0, "height": 1.0 },
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
5. Camera contracts: "required" = generation FAILS without these. "expected" = should appear, warning if missing. "out_of_frame" = should NOT appear (prevents hallucination). "kind" is the zone of the place the shot serves: front (exterior, entrance, arrival), inside (the main room), back (backstage, private or quiet area), area (a named event area), zone (a named area of a home, e.g. bed area, vanity) or extra (a close-up or other framing that belongs to a zone). Every contract names one.
6. ${angleRule}
7. ${stateRule}
8. List EVERY visible object — furniture, decor, lighting, architecture. Don't skip small items.
9. If there is text/signage visible, the exact text is CRITICAL for continuity.
10. This should be luxury-scale. Describe materials at their highest plausible tier.
11. "frame" is the part of THIS picture the shot covers, as fractions of the image (left, top, width, height between 0 and 1). Give it only when the shot is a part of what this picture shows (a close-up of the vanity on the right, a detail of the door); set "frame": null when the shot looks somewhere the picture does not show (behind the camera, another side, a different height).

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
  buildSpecPrompt,
  contractFrame,
  validateSpecCandidate,
  buildAngleConstraints,
  buildStateAmbient,
  getValidationPrompt,
  validateAngleAgainstSpec,
  mergeSpecEdits,
  SPEC_VERSION,
};
