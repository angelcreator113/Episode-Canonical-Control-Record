/**
 * Script Beat Parser v2
 * 
 * Full parser for Lala's World enhanced script format.
 * Supports:
 *   - ## BEAT: headers (canonical + repeatables with #N)
 *   - Speaker dialogue (Lala, Prime/Me, Guest, System)
 *   - UI action tags ([UI:OPEN], [UI:CLICK], [UI:DISPLAY], etc.)
 *   - Mail tags ([MAIL: type=invite from="Maison Belle" ...])
 *   - Stat tags ([STAT: coins +120])
 *   - Duration estimation from word count (words / 2.2)
 *   - Grammar warnings (login presence, voice activate before Lala)
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
  'guest': 'guest',
  'system': 'system',
};

const UI_ACTION_TYPES = [
  'open', 'close', 'click', 'type', 'display', 'hide',
  'notification', 'voice_activate', 'scroll', 'add', 'remove',
  'check_item', 'set_background', 'play_sfx', 'play_music', 'stop_music'
];

const UI_ACTION_DURATIONS = {
  click: 0.8, open: 1.2, close: 1.0, display: 0.2, hide: 0.2,
  type: 1.5, notification: 0.6, voice_activate: 0.4, scroll: 1.0,
  add: 0.6, remove: 0.4, check_item: 0.5, set_background: 0.8,
  play_sfx: 0.0, play_music: 0.0, stop_music: 0.0,
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
  'guest': { id: 'guest', name: 'Guest', emoji: '🌟' },
  'system': { id: 'system', name: 'System', emoji: '⚙️' },
};


// ─── MAIN PARSER ───

function parseScript(scriptContent, options = {}) {
  if (!scriptContent || typeof scriptContent !== 'string') {
    return {
      success: false,
      error: 'No script content provided',
      beats: [], ui_actions: [], warnings: [], metadata: {}
    };
  }

  const lines = scriptContent.split('\n');
  const rawBeats = [];
  let currentBeat = null;
  let lineBuffer = [];
  let globalLineIndex = 0;

  // Pass 1: Split into beats
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    globalLineIndex = i + 1;

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

    // If no beat header seen yet, create an implicit "preamble" beat
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

  // Don't forget last beat
  if (currentBeat) {
    currentBeat.lines = lineBuffer;
    rawBeats.push(currentBeat);
  }

  if (rawBeats.length === 0) {
    return {
      success: false,
      error: 'No content found in script',
      beats: [], ui_actions: [], warnings: [], metadata: {}
    };
  }

  // Pass 2: Parse each beat's content
  const beats = [];
  const allUiActions = [];
  const warnings = [];
  let orderPosition = 0;
  let lalaHasSpoken = false;
  let voiceActivateSeen = false;
  let loginSeen = false;

  for (const raw of rawBeats) {
    orderPosition++;
    const tempId = `beat-${orderPosition}`;
    const speakers = new Set();
    const uiActions = [];
    const mailPayloads = [];
    const statPayloads = [];
    const dialogueLines = [];
    let wordCount = 0;
    let uiTimeOffset = 0;

    for (const { text, lineNumber } of raw.lines) {
      const trimmed = text.trim();
      if (!trimmed) continue;

      // ── Dialogue ──
      const dialogueMatch = trimmed.match(/^(Lala|Prime|Me|Guest|System)\s*(?:\(.*?\))?\s*:\s*["\u201C]?(.*?)["\u201D]?\s*$/i);
      if (dialogueMatch) {
        const speaker = SPEAKER_MAP[dialogueMatch[1].toLowerCase()] || 'system';
        const dialogue = dialogueMatch[2];
        speakers.add(speaker);
        dialogueLines.push({ speaker, line: dialogue, lineNumber });
        wordCount += dialogue.split(/\s+/).length;

        if (speaker === 'lala' && !voiceActivateSeen) {
          lalaHasSpoken = true;
          warnings.push({
            code: 'lala_without_voice_activate',
            severity: 'warning',
            message: `Lala speaks without VOICE_ACTIVATE before line ${lineNumber}`,
            at: { line: lineNumber, beat_temp_id: tempId },
            autofix: {
              available: true,
              action: 'insert_voice_activate',
              insert_at_line: lineNumber,
              preview: '[UI:VOICE_ACTIVATE Lala]',
            }
          });
        }
        continue;
      }

      // ── Stage directions (parenthetical) ──
      const stageMatch = trimmed.match(/^\((.+)\)$/);
      if (stageMatch) {
        wordCount += stageMatch[1].split(/\s+/).length;
        continue;
      }

      // ── UI Tags ──
      const uiMatch = trimmed.match(/^\[UI:(\w+)\s+(.+)\]$/i);
      if (uiMatch) {
        const actionType = normalizeUiAction(uiMatch[1]);
        const target = uiMatch[2].trim();

        if (actionType === 'voice_activate') {
          voiceActivateSeen = true;
        }
        if (target.toLowerCase().includes('login')) {
          loginSeen = true;
        }

        const duration = UI_ACTION_DURATIONS[actionType] || 0.5;
        uiActions.push({
          temp_id: `${tempId}-ui-${uiActions.length + 1}`,
          beat_temp_id: tempId,
          type: actionType,
          target: target,
          timestamp_s: Math.round(uiTimeOffset * 10) / 10,
          duration_s: duration,
          order_position: uiActions.length + 1,
          metadata: parseUiMetadata(actionType, target),
          source: { line: lineNumber },
        });
        uiTimeOffset += duration;
        continue;
      }

      // ── MAIL Tags ──
      const mailMatch = trimmed.match(/^\[MAIL:\s*(.+)\]$/i);
      if (mailMatch) {
        mailPayloads.push(parseMailTag(mailMatch[1]));
        continue;
      }

      // ── STAT Tags ──
      const statMatch = trimmed.match(/^\[STAT:\s*(\w+)\s*([+-]?\d+(?:\.\d+)?)\]$/i);
      if (statMatch) {
        statPayloads.push({
          key: statMatch[1].toLowerCase(),
          delta: parseFloat(statMatch[2]),
        });
        continue;
      }

      // ── Duration override ──
      const durMatch = trimmed.match(/^\[DURATION:\s*(\d+)s?\]$/i);
      if (durMatch) {
        raw.durationOverride = parseInt(durMatch[1]);
        continue;
      }

      // ── Other metadata tags ──
      const metaMatch = trimmed.match(/^\[(\w+):\s*(.+)\]$/i);
      if (metaMatch) {
        // Store but don't process further
        continue;
      }

      // ── Plain text (narration) ──
      wordCount += trimmed.split(/\s+/).length;
    }

    // Calculate duration
    const dialogueDuration = Math.ceil(wordCount / 2.2);
    const uiDuration = Math.ceil(uiTimeOffset);
    const defaults = BEAT_DEFAULTS[raw.type] || { duration: 10 };
    const estimatedDuration = raw.durationOverride || Math.max(dialogueDuration + uiDuration, defaults.duration);

    // Build beat object
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

  // Calculate totals
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
      parsedAt: new Date().toISOString(),
    },

    // Scene plan compatibility (for ScenePlanLoader)
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
      location_hint: null,
      characters_expected: b.speakers.map(s => KNOWN_CHARACTERS[s] || { id: s, name: s, emoji: '👤' }),
      ui_expected: allUiActions.filter(a => a.beat_temp_id === b.temp_id).map(a => `${a.type}:${a.target}`),
      dialogue_count: b.dialogue_count,
      script_excerpt: '',
      notes: buildSceneNotes(b, allUiActions.filter(a => a.beat_temp_id === b.temp_id)),
    })),
  };
}


// ─── HELPERS ───

function parseBeatHeader(raw) {
  // "INTERRUPTION #2" → { type: 'interruption', index: 2 }
  // "OPENING_RITUAL" → { type: 'opening_ritual', index: 1 }
  const indexMatch = raw.match(/#(\d+)\s*$/);
  const index = indexMatch ? parseInt(indexMatch[1]) : 1;
  
  let typeStr = raw.replace(/#\d+\s*$/, '').trim();
  typeStr = typeStr.replace(/[\u2014\u2013]/g, '_').replace(/\s+/g, '_').toLowerCase();
  
  // Map to canonical
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
  };
  return map[normalized] || normalized;
}

function parseUiMetadata(actionType, target) {
  const meta = {};
  // [UI:TYPE Username "JustAWomanInHerPrime"]
  if (actionType === 'type') {
    const match = target.match(/^(\w+)\s+"(.+)"$/);
    if (match) {
      meta.field = match[1];
      meta.text = match[2];
    }
  }
  // [UI:SCROLL ClosetItems x5]
  if (actionType === 'scroll') {
    const match = target.match(/^(.+)\s+x(\d+)$/i);
    if (match) {
      meta.target = match[1];
      meta.scrollCount = parseInt(match[2]);
    }
  }
  return meta;
}

function parseMailTag(content) {
  // type=invite from="Maison Belle" prestige=4 cost=150
  const mail = {};
  const pairs = content.match(/(\w+)=(?:"([^"]+)"|(\S+))/g) || [];
  for (const pair of pairs) {
    const match = pair.match(/(\w+)=(?:"([^"]+)"|(\S+))/);
    if (match) {
      const key = match[1];
      const value = match[2] || match[3];
      mail[key] = isNaN(value) ? value : parseFloat(value);
    }
  }
  return mail;
}

function formatBeatTitle(raw) {
  return raw
    .replace(/_/g, ' ')
    .replace(/\s*#\d+/, (m) => ` ${m.trim()}`)
    .split(/\s+/)
    .map(w => {
      if (w.startsWith('#')) return w;
      if (w === '\u2014' || w === '\u2013') return '\u2013';
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ')
    .trim();
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
    parts.push(`Speakers: ${beat.speakers.map(s => (KNOWN_CHARACTERS[s] || {}).emoji + ' ' + (KNOWN_CHARACTERS[s] || {}).name || s).join(', ')}`);
  }
  if (uiActions.length > 0) {
    parts.push(`${uiActions.length} UI actions`);
  }
  if (beat.tags.mail && beat.tags.mail.length > 0) {
    parts.push(`${beat.tags.mail.length} mail event(s)`);
  }
  if (beat.tags.stats && beat.tags.stats.length > 0) {
    parts.push(`Stat changes: ${beat.tags.stats.map(s => `${s.key} ${s.delta > 0 ? '+' : ''}${s.delta}`).join(', ')}`);
  }
  return parts.join(' \u00b7 ');
}


// ─── EXPORTS ───

module.exports = {
  parseScript,
  parseBeatHeader,
  normalizeUiAction,
  parseMailTag,
  BEAT_TYPES,
  SPEAKER_MAP,
  UI_ACTION_TYPES,
  UI_ACTION_DURATIONS,
  BEAT_DEFAULTS,
  KNOWN_CHARACTERS,
};
