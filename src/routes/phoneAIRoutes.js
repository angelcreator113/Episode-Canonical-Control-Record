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
// Body: { asset_id, prompt_hint?, episode_id? }
// Returns: { success, proposal: { zones: [...] }, context_summary: { ... } }
router.post('/add-zones', optionalAuth, async (req, res) => {
  try {
    const { asset_id, prompt_hint, episode_id } = req.body || {};
    if (!asset_id) return res.status(400).json({ success: false, error: 'asset_id is required' });
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
    }

    const context = await buildPhoneContext({ showId: req.params.showId, episodeId: episode_id, assetId: asset_id });

    // Build the user prompt — show-aware, scoped to THIS screen. Characters and
    // recent beats land here so the AI can ground zones in story moments, not
    // generic phone UI.
    const userPrompt = [
      `Show: "${context.show?.name || 'Unknown'}"${context.show?.genre ? ` (${context.show.genre})` : ''}`,
      context.show?.description ? `Description: ${context.show.description.slice(0, 400)}` : null,
      context.characters.length
        ? `Main characters: ${context.characters.map(c => `${c.name} (${c.role})${c.personality ? ` — ${c.personality.slice(0, 80)}` : ''}`).join('; ')}`
        : null,
      context.episode ? `Current episode: "${context.episode.title}"${context.episode.description ? ` — ${context.episode.description.slice(0, 200)}` : ''}` : null,
      context.recent_beats.length
        ? `Recent story beats: ${context.recent_beats.slice(0, 4).map(b => `${b.type}${b.label ? ` "${b.label}"` : ''}${b.line ? `: ${b.line.slice(0, 60)}` : ''}`).join(' / ')}`
        : null,
      `Screen being edited: "${context.screen?.name || 'Unknown'}" (${context.screen?.category || 'phone'})`,
      context.screen?.description ? `Screen description: ${context.screen.description.slice(0, 300)}` : null,
      context.screen?.existing_zones?.length
        ? `Existing zones on this screen (do NOT duplicate): ${JSON.stringify(context.screen.existing_zones.map(z => ({ label: z.label, target: z.target })))}`
        : 'Existing zones on this screen: (none — this is a blank screen)',
      `Peer screens available as navigate targets (use their id): ${JSON.stringify(context.peer_screens)}`,
      context.state_keys_in_use.length
        ? `State keys already in use (PREFER reusing these over inventing new ones): ${context.state_keys_in_use.join(', ')}`
        : null,
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

// ── fill-content-zone ────────────────────────────────────────────────────────
//
// Given a specific content zone (feed_posts, dm_thread, notifications,
// custom_text, etc.), propose a content_config that grounds the zone in
// current show characters + recent beats. Returns a proposal only — the
// client merges the config into the zone and PUTs through the existing
// /content-zones route (which stays schema-validated).
//
// Body: { asset_id, zone_id, prompt_hint?, episode_id? }
// Returns: { success, proposal: { content_config, content_preview? }, context_summary }

const FILL_SYSTEM_PROMPT = `You extend an existing Lala's Phone content zone with
show-aware content. You will be given the zone's content_type and current config,
plus show + character context. Output ONLY a JSON object:

{
  "content_config": { ...fields appropriate for content_type... },
  "content_preview": "short plain-text description of what the zone will show"
}

Rules:
- Match the shape expected by the zone's content_type. Common fields:
    feed_posts   → { profile_id, max_items, show_likes, show_comments }
    dm_thread    → { thread_id, max_messages, sender_handle }
    notifications→ { max_items, style: 'lockscreen' | 'drawer' }
    custom_text  → { text, color, bg, font_size, align }
    profile_header→ { profile_id }
- NEVER invent fields outside the schema the client expects — keep it minimal.
- Ground choices in characters and recent beats where it fits (e.g. pick a
  character as sender for a DM thread based on their relationship).
- Respond with ONLY the JSON. No prose, no markdown fences.`;

router.post('/fill-content-zone', optionalAuth, async (req, res) => {
  try {
    const { asset_id, zone_id, prompt_hint, episode_id } = req.body || {};
    if (!asset_id || !zone_id) {
      return res.status(400).json({ success: false, error: 'asset_id and zone_id are required' });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
    }

    const models = require('../models');
    const [rows] = await models.sequelize.query(
      `SELECT metadata::text AS metadata_text FROM assets
       WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { assetId: asset_id, showId: req.params.showId } }
    );
    let meta = {};
    try { meta = JSON.parse(rows?.[0]?.metadata_text || '{}'); } catch { /* noop */ }
    const zone = (meta.content_zones || []).find(z => z.id === zone_id);
    if (!zone) {
      return res.status(404).json({ success: false, error: 'content zone not found on this asset' });
    }

    const context = await buildPhoneContext({ showId: req.params.showId, episodeId: episode_id, assetId: asset_id });

    const userPrompt = [
      `Show: "${context.show?.name || 'Unknown'}"`,
      context.show?.description ? `Description: ${context.show.description.slice(0, 300)}` : null,
      context.characters.length
        ? `Characters available: ${context.characters.map(c => `${c.name} (${c.role})`).join(', ')}`
        : null,
      context.episode ? `Current episode: "${context.episode.title}"` : null,
      context.recent_beats.length
        ? `Recent beats: ${context.recent_beats.slice(0, 3).map(b => `${b.label || b.type}${b.line ? `: ${b.line.slice(0, 50)}` : ''}`).join(' / ')}`
        : null,
      `Zone content_type: ${zone.content_type}`,
      `Current content_config: ${JSON.stringify(zone.content_config || {})}`,
      prompt_hint ? `Creator hint: ${prompt_hint}` : null,
    ].filter(Boolean).join('\n');

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: FILL_SYSTEM_PROMPT,
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

    // Shallow shape check. We don't validate the config against a strict schema
    // (each content_type has its own renderer-defined shape); the client renders
    // a preview before the user approves, so bad configs are caught visually.
    if (!parsed.content_config || typeof parsed.content_config !== 'object') {
      return res.status(422).json({ success: false, error: 'AI did not return a content_config object', raw: parsed });
    }

    return res.json({
      success: true,
      proposal: {
        content_config: parsed.content_config,
        content_preview: parsed.content_preview || null,
      },
      context_summary: {
        show: context.show?.name,
        zone_type: zone.content_type,
        characters_used: context.characters.length,
      },
    });
  } catch (err) {
    console.error('[phoneAIRoutes] fill-content-zone error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
