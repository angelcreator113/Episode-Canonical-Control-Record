/**
 * Script Beat Parser v3
 * 
 * Full parser for Lala's World enhanced script format.
 * 
 * v3 additions:
 *   - [EVENT: name="..." prestige=7 cost=150 strictness=6 deadline="high"]
 *   - [EPISODE_INTENT: "failure_comeback_setup"]
 *   - [RESULT: score=62 tier="mid"]
 *   - [OVERRIDE: tier="pass" reason="DREAM_FUND_BOOST" cost="stress+1"]
 *   - [STAT_CHANGE: coins-150 reputation+1]
 *   - [FX:SPARKLE Small], [SCENE:LOAD ...], [UI:HOVER ...], [UI:SELECT ...], [UI:PULSE ...]
 * 
 * Location: src/utils/scriptBeatParser.js
 */

'use strict';

// ─── CANONICAL TYPES ───

const BEAT_TYPES = [
  'opening_ritual', 'creator_welcome', 'interruption', 'reveal',
  'stakes_intention', 'transformation', 'transition', 'event_travel',
  'event_outcome', 'deliverable_creation', 'payoff_cta', 'cliffhanger'
];

const SPEAKER_MAP = {
  'lala': 'lala',
  'prime': 'prime',
  'me': 'prime',
  'you': 'prime',
  'guest': 'guest',
  'system': 'system',
  'message': 'system',
};

const UI_ACTION_TYPES = [
  'open', 'close', 'click', 'type', 'display', 'hide',
  'notification', 'voice_activate', 'scroll', 'add', 'remove',
  'check_item', 'set_background', 'play_sfx', 'play_music', 'stop_music',
  'hover', 'select', 'pulse', 'check',
];

const UI_ACTION_DURATIONS = {
  click: 0.8, open: 1.2, close: 1.0, display: 0.2, hide: 0.2,
  type: 1.5, notification: 0.6, voice_activate: 0.4, scroll: 1.0,
  add: 0.6, remove: 0.4, check_item: 0.5, set_background: 0.8,
  play_sfx: 0.0, play_music: 0.0, stop_music: 0.0,
  hover: 0.4, select: 0.6, pulse: 0.5, check: 0.5,
};

const BEAT_DEFAULTS = {
  'opening_ritual': { duration: 8, density: 'low', mood: 'calm' },
  'creator_welcome': { duration: 12, density: 'low', mood: 'warm' },
  'interruption': { duration: 6, density: 'medium', mood: 'energetic' },
  'reveal': { duration: 15, density: 'high', mood: 'dramatic' },
  'stakes_intention': { duration: 10, density: 'medium', mood: 'tense' },
  'transformation': { duration: 34, density: 'high', mood: 'energetic' },
  'transition': { duration: 4, density: 'low', mood: 'calm' },
  'event_travel': { duration: 8, density: 'medium', mood: 'energetic' },
  'event_outcome': { duration: 12, density: 'high', mood: 'dramatic' },
  'deliverable_creation': { duration: 12, density: 'medium', mood: 'playful' },
  'payoff_cta': { duration: 8, density: 'medium', mood: 'warm' },
  'cliffhanger': { duration: 5, density: 'medium', mood: 'tense' },
};

const KNOWN_CHARACTERS = {
  'lala': { id: 'lala', name: 'Lala', emoji: '👑' },
  'prime': { id: 'justawomaninherprime', name: 'Prime', emoji: '💎' },
  'me': { id: 'justawomaninherprime', name: 'Prime', emoji: '💎' },
  'you': { id: 'justawomaninherprime', name: 'Prime', emoji: '💎' },
  'guest': { id: 'guest', name: 'Guest', emoji: '🌟' },
  'system': { id: 'system', name: 'System', emoji: '⚙️' },
  'message': { id: 'system', name: 'Message', emoji: '📧' },
};


// ─── MAIN PARSER ───

function parseScript(scriptContent, options = {}) {
  if (!scriptContent || typeof scriptContent !== 'string') {
    return {
      success: false,
      error: 'No script content provided',
      beats: [], ui_actions: [], warnings: [], metadata: {},
      episode_tags: {},
    };
  }

  const lines = scriptContent.split('\n');
  const rawBeats = [];
  let currentBeat = null;
  let lineBuffer = [];
  let globalLineIndex = 0;

  // Episode-level tags (parsed first pass)
  const episodeTags = {
    event: null,
    intent: null,
    result: null,
    overrides: [],
    stat_changes: [],
  };

  // Pass 1: Split into beats + extract episode-level tags
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    globalLineIndex = i + 1;

    // ── Episode-level tags (can appear anywhere) ──
    const eventMatch = trimmed.match(/^\[EVENT:\s*(.+)\]$/i);
    if (eventMatch) {
      episodeTags.event = parseKeyValueTag(eventMatch[1]);
      if (currentBeat) lineBuffer.push({ text: line, lineNumber: globalLineIndex });
      continue;
    }

    const intentMatch = trimmed.match(/^\[EPISODE_INTENT:\s*"?([^"\]]+)"?\]$/i);
    if (intentMatch) {
      episodeTags.intent = intentMatch[1].trim();
      continue;
    }

    const resultMatch = trimmed.match(/^\[RESULT:\s*(.+)\]$/i);
    if (resultMatch) {
      episodeTags.result = parseKeyValueTag(resultMatch[1]);
      continue;
    }

    const overrideMatch = trimmed.match(/^\[OVERRIDE:\s*(.+)\]$/i);
    if (overrideMatch) {
      episodeTags.overrides.push(parseKeyValueTag(overrideMatch[1]));
      continue;
    }

    const statChangeMatch = trimmed.match(/^\[STAT_CHANGE:\s*(.+)\]$/i);
    if (statChangeMatch) {
      episodeTags.stat_changes.push(parseStatChangeTag(statChangeMatch[1]));
      continue;
    }

    // ── Beat headers ──
    const beatMatch = trimmed.match(/^##\s*BEAT:\s*(.+)$/i);
    if (beatMatch) {
      if (currentBeat) {
        currentBeat.lines = lineBuffer;
        rawBeats.push(currentBeat);
      }

      const rawTitle = beatMatch[1].trim();
      const { type, index } = parseBeatHeader(rawTitle);

      currentBeat = {
        rawTitle,
        type,
        beatIndex: index,
        headerLine: globalLineIndex,
        lines: [],
        headerPresent: true,
      };
      lineBuffer = [];
      continue;
    }

    // If no beat header seen yet, create implicit preamble
    if (!currentBeat && trimmed) {
      currentBeat = {
        rawTitle: 'PREAMBLE',
        type: 'opening_ritual',
        beatIndex: 1,
        headerLine: globalLineIndex,
        lines: [],
        headerPresent: false,
      };
      lineBuffer = [];
    }

    lineBuffer.push({ text: line, lineNumber: globalLineIndex });
  }

  // Last beat
  if (currentBeat) {
    currentBeat.lines = lineBuffer;
    rawBeats.push(currentBeat);
  }

  if (rawBeats.length === 0) {
    return {
      success: false,
      error: 'No content found in script',
      beats: [], ui_actions: [], warnings: [], metadata: {},
      episode_tags: episodeTags,
    };
  }

  // Pass 2: Parse each beat's content
  const beats = [];
  const allUiActions = [];
  const warnings = [];
  let orderPosition = 0;
  let voiceActivateSeen = false;
  let loginSeen = false;

  for (const raw of rawBeats) {
    orderPosition++;
    const tempId = `beat-${orderPosition}`;
    const speakers = new Set();
    const uiActions = [];
    const mailPayloads = [];
    const statPayloads = [];
    const fxEvents = [];
    const sceneLoads = [];
    const dialogueLines = [];
    let wordCount = 0;
    let uiTimeOffset = 0;

    for (const { text, lineNumber } of raw.lines) {
      const trimmed = text.trim();
      if (!trimmed) continue;

      // ── Dialogue ──
      const dialogueMatch = trimmed.match(/^(Lala|Prime|Me|You|Guest|System|Message)\s*(?:\(.*?\))?\s*:\s*$/i) ||
                            trimmed.match(/^(Lala|Prime|Me|You|Guest|System|Message)\s*(?:\(.*?\))?\s*:\s*["\u201C]?(.*?)["\u201D]?\s*$/i);
      if (dialogueMatch) {
        const speaker = SPEAKER_MAP[dialogueMatch[1].toLowerCase()] || 'system';
        const dialogue = dialogueMatch[2] || '';
        speakers.add(speaker);
        dialogueLines.push({ speaker, line: dialogue, lineNumber });
        if (dialogue) wordCount += dialogue.split(/\s+/).length;

        if (speaker === 'lala' && !voiceActivateSeen) {
          warnings.push({
            code: 'lala_without_voice_activate',
            severity: 'warning',
            message: `Lala speaks without VOICE_ACTIVATE before line ${lineNumber}`,
            at: { line: lineNumber, beat_temp_id: tempId },
            autofix: {
              available: true,
              action: 'insert_voice_activate',
              insert_at_line: lineNumber,
              preview: '[UI:CLICK VoiceIcon]\n[UI:VOICE_ACTIVATE Lala]',
            }
          });
        }
        continue;
      }

      // ── Stage directions ──
      const stageMatch = trimmed.match(/^\((.+)\)$/);
      if (stageMatch) {
        wordCount += stageMatch[1].split(/\s+/).length;
        continue;
      }

      // ── UI Tags ──
      const uiMatch = trimmed.match(/^\[UI:(\w+)\s*(.*?)\]$/i);
      if (uiMatch) {
        const actionType = normalizeUiAction(uiMatch[1]);
        const target = (uiMatch[2] || '').trim();

        if (actionType === 'voice_activate') voiceActivateSeen = true;
        if (target.toLowerCase().includes('login')) loginSeen = true;

        const duration = UI_ACTION_DURATIONS[actionType] || 0.5;
        uiActions.push({
          temp_id: `${tempId}-ui-${uiActions.length + 1}`,
          beat_temp_id: tempId,
          type: actionType,
          target,
          timestamp_s: Math.round(uiTimeOffset * 10) / 10,
          duration_s: duration,
          order_position: uiActions.length + 1,
          metadata: parseUiMetadata(actionType, target),
          source: { line: lineNumber },
        });
        uiTimeOffset += duration;
        continue;
      }

      // ── FX Tags ──
      const fxMatch = trimmed.match(/^\[FX:(\w+)\s*(.*?)\]$/i);
      if (fxMatch) {
        fxEvents.push({ type: fxMatch[1].toLowerCase(), target: fxMatch[2].trim() });
        continue;
      }

      // ── SCENE Tags ──
      const sceneMatch = trimmed.match(/^\[SCENE:(\w+)\s*(.*?)\]$/i);
      if (sceneMatch) {
        sceneLoads.push({ action: sceneMatch[1].toLowerCase(), target: sceneMatch[2].trim() });
        continue;
      }

      // ── MAIL Tags ──
      const mailMatch = trimmed.match(/^\[MAIL:\s*(.+)\]$/i);
      if (mailMatch) {
        mailPayloads.push(parseKeyValueTag(mailMatch[1]));
        continue;
      }

      // ── STAT Tags (inline, per-beat) ──
      const statMatch = trimmed.match(/^\[STAT:\s*(\w+)\s*([+-]?\d+(?:\.\d+)?)\]$/i);
      if (statMatch) {
        statPayloads.push({ key: statMatch[1].toLowerCase(), delta: parseFloat(statMatch[2]) });
        continue;
      }

      // ── LOCATION_HINT ──
      const locMatch = trimmed.match(/^\[LOCATION_HINT:\s*"?([^"\]]+)"?\]$/i);
      if (locMatch) {
        raw.locationHint = locMatch[1].trim();
        continue;
      }

      // ── Duration override ──
      const durMatch = trimmed.match(/^\[DURATION:\s*(\d+)s?\]$/i);
      if (durMatch) {
        raw.durationOverride = parseInt(durMatch[1]);
        continue;
      }

      // ── Other metadata tags (skip) ──
      const metaMatch = trimmed.match(/^\[(\w+):\s*(.+)\]$/i);
      if (metaMatch) continue;

      // ── Plain text / narration ──
      wordCount += trimmed.split(/\s+/).length;
    }

    // Calculate duration
    const dialogueDuration = Math.ceil(wordCount / 2.2);
    const uiDuration = Math.ceil(uiTimeOffset);
    const defaults = BEAT_DEFAULTS[raw.type] || { duration: 10 };
    const estimatedDuration = raw.durationOverride || Math.max(dialogueDuration + uiDuration, defaults.duration);

    const beat = {
      temp_id: tempId,
      type: raw.type,
      beat_index: raw.beatIndex,
      order_position: orderPosition,
      title: formatBeatTitle(raw.rawTitle),
      confidence: raw.headerPresent ? 'confident' : 'review',
      duration_s: estimatedDuration,
      source: {
        header_present: raw.headerPresent,
        line_start: raw.headerLine,
        line_end: raw.lines.length > 0 ? raw.lines[raw.lines.length - 1].lineNumber : raw.headerLine,
      },
      speakers: [...speakers],
      dialogue_count: dialogueLines.length,
      word_count: wordCount,
      density: defaults.density || 'medium',
      mood: defaults.mood || 'calm',
      tags: {},
    };

    if (mailPayloads.length > 0) beat.tags.mail = mailPayloads;
    if (statPayloads.length > 0) beat.tags.stats = statPayloads;
    if (fxEvents.length > 0) beat.tags.fx = fxEvents;
    if (sceneLoads.length > 0) beat.tags.scenes = sceneLoads;
    if (raw.locationHint) beat.tags.location_hint = raw.locationHint;

    beats.push(beat);
    allUiActions.push(...uiActions);
  }

  // Grammar warnings
  if (!loginSeen && beats.length > 0) {
    const firstBeatType = beats[0].type;
    if (['opening_ritual', 'creator_welcome'].includes(firstBeatType)) {
      warnings.push({
        code: 'missing_login',
        severity: 'warning',
        message: 'LoginWindow not detected in opening beats',
        at: { beat_temp_id: beats[0].temp_id },
        autofix: {
          available: true,
          action: 'insert_login_template',
          preview: '[UI:OPEN LoginWindow]\n[UI:TYPE Username "JustAWomanInHerPrime"]\n[UI:TYPE Password "\u2022\u2022\u2022\u2022\u2022\u2022"]\n[UI:CLICK LoginButton]\n[UI:SFX LoginSuccessDing]',
        }
      });
    }
  }

  // Event tag warning
  if (!episodeTags.event) {
    warnings.push({
      code: 'missing_event_tag',
      severity: 'info',
      message: 'No [EVENT:] tag found. Add one to enable episode evaluation scoring.',
      at: {},
      autofix: {
        available: true,
        action: 'insert_event_tag',
        preview: '[EVENT: name="Event Name" prestige=7 cost=150 strictness=6 deadline="high" dress_code="romantic couture"]',
      }
    });
  }

  // Totals
  const totalDuration = beats.reduce((sum, b) => sum + b.duration_s, 0);
  const allSpeakers = [...new Set(beats.flatMap(b => b.speakers))];
  const totalWords = beats.reduce((sum, b) => sum + b.word_count, 0);
  const totalDialogue = beats.reduce((sum, b) => sum + b.dialogue_count, 0);

  return {
    success: true,
    episodeId: options.episodeId || null,
    episodeTitle: options.episodeTitle || null,

    beats,
    ui_actions: allUiActions,
    warnings,
    episode_tags: episodeTags,

    metadata: {
      totalBeats: beats.length,
      totalDuration,
      formattedDuration: formatDuration(totalDuration),
      totalWords,
      totalDialogueLines: totalDialogue,
      totalUiActions: allUiActions.length,
      speakers: allSpeakers,
      hasHeaders: beats.some(b => b.source.header_present),
      parseMode: beats.every(b => b.source.header_present) ? 'headers' : beats.some(b => b.source.header_present) ? 'mixed' : 'inference',
      hasEventTag: !!episodeTags.event,
      hasIntent: !!episodeTags.intent,
      parsedAt: new Date().toISOString(),
    },

    // Scene plan compatibility
    totalScenes: beats.length,
    formattedDuration: formatDuration(totalDuration),
    scenes: beats.map(b => ({
      scene_number: b.order_position,
      title: b.title,
      beat_type: b.type,
      raw_beat_title: b.type,
      duration_seconds: b.duration_s,
      density: b.density,
      mood: b.mood,
      transition: b.order_position === 1 ? 'cut' : 'dissolve',
      location_hint: b.tags.location_hint || null,
      characters_expected: b.speakers.map(s => KNOWN_CHARACTERS[s] || { id: s, name: s, emoji: '\uD83D\uDC64' }),
      ui_expected: allUiActions.filter(a => a.beat_temp_id === b.temp_id).map(a => `${a.type}:${a.target}`),
      dialogue_count: b.dialogue_count,
      script_excerpt: '',
      notes: buildSceneNotes(b, allUiActions.filter(a => a.beat_temp_id === b.temp_id)),
    })),
  };
}


// ─── HELPERS ───

function parseBeatHeader(raw) {
  const indexMatch = raw.match(/#(\d+)\s*$/);
  const index = indexMatch ? parseInt(indexMatch[1]) : 1;
  let typeStr = raw.replace(/#\d+\s*$/, '').trim();
  typeStr = typeStr.replace(/[\u2014\u2013\-]/g, '_').replace(/\s+/g, '_').toLowerCase();
  const mapped = BEAT_TYPES.find(t => typeStr.includes(t));
  return { type: mapped || typeStr, index };
}

function normalizeUiAction(raw) {
  const normalized = raw.toLowerCase().replace(/_/g, '');
  const map = {
    'open': 'open', 'close': 'close', 'click': 'click',
    'type': 'type', 'display': 'display', 'hide': 'hide',
    'notification': 'notification', 'voiceactivate': 'voice_activate',
    'voice_activate': 'voice_activate', 'scroll': 'scroll',
    'add': 'add', 'remove': 'remove', 'checkitem': 'check_item',
    'check_item': 'check_item', 'check': 'check_item',
    'setbackground': 'set_background', 'set_background': 'set_background',
    'sfx': 'play_sfx', 'playsfx': 'play_sfx', 'play_sfx': 'play_sfx',
    'playmusic': 'play_music', 'play_music': 'play_music',
    'stopmusic': 'stop_music', 'stop_music': 'stop_music',
    'hover': 'hover', 'select': 'select', 'pulse': 'pulse',
  };
  return map[normalized] || normalized;
}

function parseUiMetadata(actionType, target) {
  const meta = {};
  if (actionType === 'type') {
    const match = target.match(/^(\w+)\s+["\u201C](.+)["\u201D]$/);
    if (match) { meta.field = match[1]; meta.text = match[2]; }
  }
  if (actionType === 'scroll') {
    const match = target.match(/^(.+)\s+x(\d+)$/i);
    if (match) { meta.target = match[1]; meta.scrollCount = parseInt(match[2]); }
  }
  if (actionType === 'pulse') {
    const match = target.match(/^(.+)\s+x(\d+)$/i);
    if (match) { meta.target = match[1]; meta.pulseCount = parseInt(match[2]); }
  }
  return meta;
}

function parseKeyValueTag(content) {
  const result = {};
  const pairs = content.match(/(\w+)=(?:"([^"\u201C\u201D]+)"|(\S+))/g) || [];
  for (const pair of pairs) {
    const m = pair.match(/(\w+)=(?:"([^"\u201C\u201D]+)"|(\S+))/);
    if (m) {
      const key = m[1].toLowerCase();
      const val = m[2] || m[3];
      result[key] = isNaN(val) ? val : parseFloat(val);
    }
  }
  return result;
}

function parseStatChangeTag(content) {
  // "coins-150 reputation+1 brand_trust+0 influence+1 stress+1"
  const result = {};
  const parts = content.match(/(\w+)([+-]\d+)/g) || [];
  for (const part of parts) {
    const m = part.match(/(\w+)([+-]\d+)/);
    if (m) result[m[1].toLowerCase()] = parseInt(m[2]);
  }
  return result;
}

function formatBeatTitle(raw) {
  return raw.replace(/_/g, ' ').replace(/\s*#\d+/, (m) => ` ${m.trim()}`)
    .split(/\s+/).map(w => {
      if (w.startsWith('#')) return w;
      if (w === '\u2014' || w === '\u2013') return '\u2013';
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ').trim();
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

function buildSceneNotes(beat, uiActions) {
  const parts = [];
  if (beat.speakers.length > 0) {
    parts.push(`Speakers: ${beat.speakers.map(s => ((KNOWN_CHARACTERS[s] || {}).emoji || '') + ' ' + ((KNOWN_CHARACTERS[s] || {}).name || s)).join(', ')}`);
  }
  if (uiActions.length > 0) parts.push(`${uiActions.length} UI actions`);
  if (beat.tags.mail && beat.tags.mail.length > 0) parts.push(`${beat.tags.mail.length} mail event(s)`);
  if (beat.tags.stats && beat.tags.stats.length > 0) {
    parts.push(`Stats: ${beat.tags.stats.map(s => `${s.key} ${s.delta > 0 ? '+' : ''}${s.delta}`).join(', ')}`);
  }
  if (beat.tags.fx && beat.tags.fx.length > 0) parts.push(`${beat.tags.fx.length} FX`);
  if (beat.tags.location_hint) parts.push(`\uD83D\uDCCD ${beat.tags.location_hint}`);
  return parts.join(' \u00B7 ');
}


// ─── EXPORTS ───

module.exports = {
  parseScript,
  parseBeatHeader,
  normalizeUiAction,
  parseKeyValueTag,
  parseStatChangeTag,
  BEAT_TYPES,
  SPEAKER_MAP,
  UI_ACTION_TYPES,
  UI_ACTION_DURATIONS,
  BEAT_DEFAULTS,
  KNOWN_CHARACTERS,
};
