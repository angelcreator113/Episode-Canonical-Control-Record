/**
 * phoneAIRoutes — AI-assisted commands for the phone editor.
 *
 * PR1 ships ONE command: `POST /add-zones`. Given a screen, ask Claude to propose
 * tap zones with labels, positions, and actions. The response is a *proposal* only —
 * no write happens here. The client renders it in a review modal; approve →
 * clients PUT through the existing validated /screen-links route.
 *
 * Every proposal is run through the same Joi schema + action allowlist the save
 * route uses, so AI can never output something the editor would reject.
 *
 * Mounted under `/api/v1/ui-overlays/:showId/ai/*` from app.js.
 */
const express = require('express');
const router = express.Router({ mergeParams: true });
const { optionalAuth } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk').Anthropic;
const { buildPhoneContext } = require('../services/phoneContextBuilder');
const { validateScreenLinks } = require('../services/phoneConditionSchema');

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';  // match existing services

const SYSTEM_PROMPT = `You are a show-aware co-creator inside the Lala's Phone editor.
You extend what the creator has already built — you do not invent a standalone phone.

Your job: propose 3–6 tap zones for a phone screen, using the show's existing screens as
navigation targets. Output ONLY a single JSON object with this exact shape:

{
  "zones": [
    {
      "label": "Messages",
      "x": 10, "y": 30, "w": 22, "h": 18,
      "target": "<one of the peer_screens ids, or empty string>",
      "conditions": [ { "key": "talked_to_ex", "op": "eq", "value": true } ],
      "actions": [
        { "type": "set_state", "key": "opened_messages", "value": true },
        { "type": "navigate", "target": "<peer screen id>" }
      ]
    }
  ]
}

Rules:
- x/y/w/h are percentages 0-100 of the screen area.
- Sizes should resemble real phone UI: home icons ~ 18-24% wide, list rows ~ 90% wide.
- Actions: ONLY these types are legal — navigate, set_state, show_toast, complete_episode.
  Do NOT invent other types; they will be rejected.
- conditions and actions are OPTIONAL. Omit if not needed. Keep them minimal — one or two
  per zone at most.
- state keys: snake_case, lowercase letters/digits/underscores/dots only.
- Respond with ONLY the JSON. No prose, no markdown fences.`;

// Size-correction helper — rough, not a replacement for Joi validation.
function clampZone(z) {
  const n = (v, def) => (typeof v === 'number' && isFinite(v) ? v : def);
  return {
    id: `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    x: Math.max(0, Math.min(100, n(z.x, 10))),
    y: Math.max(0, Math.min(100, n(z.y, 10))),
    w: Math.max(5, Math.min(100, n(z.w, 20))),
    h: Math.max(5, Math.min(100, n(z.h, 15))),
    target: typeof z.target === 'string' ? z.target : '',
    label: typeof z.label === 'string' ? z.label : '',
    icon_url: null,
    icon_urls: [],
    conditions: Array.isArray(z.conditions) ? z.conditions : undefined,
    actions: Array.isArray(z.actions) ? z.actions : undefined,
  };
}

// POST /api/v1/ui-overlays/:showId/ai/add-zones
// Body: { asset_id, prompt_hint? }
// Returns: { success, proposal: { zones: [...] }, context_summary: { ... } }
router.post('/add-zones', optionalAuth, async (req, res) => {
  try {
    const { asset_id, prompt_hint } = req.body || {};
    if (!asset_id) return res.status(400).json({ success: false, error: 'asset_id is required' });
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
    }

    const context = await buildPhoneContext({ showId: req.params.showId, assetId: asset_id });

    // Build the user prompt — show-aware, scoped to THIS screen.
    const userPrompt = [
      `Show: "${context.show?.name || 'Unknown'}"${context.show?.genre ? ` (${context.show.genre})` : ''}`,
      context.show?.description ? `Description: ${context.show.description.slice(0, 400)}` : null,
      `Screen being edited: "${context.screen?.name || 'Unknown'}" (${context.screen?.category || 'phone'})`,
      context.screen?.description ? `Screen description: ${context.screen.description.slice(0, 300)}` : null,
      context.screen?.existing_zones?.length
        ? `Existing zones on this screen (do NOT duplicate): ${JSON.stringify(context.screen.existing_zones.map(z => ({ label: z.label, target: z.target })))}`
        : 'Existing zones on this screen: (none — this is a blank screen)',
      `Peer screens available as navigate targets (use their id): ${JSON.stringify(context.peer_screens)}`,
      prompt_hint ? `Creator hint: ${prompt_hint}` : null,
    ].filter(Boolean).join('\n');

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response?.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ success: false, error: 'AI response did not contain JSON', raw: text.slice(0, 500) });
    }

    let parsed;
    try { parsed = JSON.parse(jsonMatch[0]); }
    catch { return res.status(502).json({ success: false, error: 'Failed to parse AI JSON' }); }

    const rawZones = Array.isArray(parsed.zones) ? parsed.zones : [];
    const clamped = rawZones.slice(0, 8).map(clampZone);

    // Validate through the SAME schema the PUT route uses — rejects unknown action types
    // and malformed conditions even if Claude hallucinates them.
    const { error, value: validated } = validateScreenLinks(clamped);
    if (error) {
      return res.status(422).json({ success: false, error: `AI proposal failed validation: ${error}`, raw: clamped });
    }

    return res.json({
      success: true,
      proposal: { zones: validated },
      context_summary: {
        show: context.show?.name,
        screen: context.screen?.name,
        peer_count: context.peer_screens.length,
      },
    });
  } catch (err) {
    console.error('[phoneAIRoutes] add-zones error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
