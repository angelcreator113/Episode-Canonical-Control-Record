/**
 * Script Beat Parser
 * 
 * Parses Lala's World enhanced script format into structured Scene Plans.
 * The Scene Plan pre-populates Scene Composer with labeled scenes,
 * character expectations, UI hints, and duration estimates.
 * 
 * SCRIPT FORMAT SPEC:
 * 
 *   ## BEAT: BEAT_NAME
 *   [LOCATION_HINT: "description"]
 *   [CHARACTERS: lala, justawoman, guest]
 *   [UI:OPEN ElementName]
 *   [UI:CLOSE ElementName]
 *   [DURATION: 8s]
 *   [DENSITY: low|medium|high]
 *   [MOOD: energetic|calm|tense|playful|dramatic]
 *   [TRANSITION: cut|fade|dissolve|swipe]
 *   
 *   Script dialogue and action lines go here...
 *   
 *   LALA: "Dialogue line"
 *   JUSTAWOMAN: "Dialogue line"
 *   (action description)
 * 
 * EXAMPLE SCRIPT:
 * 
 *   ## BEAT: OPENING RITUAL
 *   [CHARACTERS: justawoman]
 *   [DURATION: 8s]
 *   [DENSITY: low]
 *   [MOOD: calm]
 *   
 *   (Headphones on. Login sequence. The world outside fades.)
 *   JUSTAWOMAN: "Let's see what today brings."
 *   
 *   ## BEAT: INTERRUPTION — INVITE
 *   [CHARACTERS: lala]
 *   [UI:OPEN MailIcon]
 *   [UI:OPEN MailPanel]
 *   [DURATION: 10s]
 *   [DENSITY: medium]
 *   
 *   (A notification slides in. Lala's eyes light up.)
 *   LALA: "Oh... this is interesting."
 *   [UI:CLOSE MailPanel]
 * 
 * OUTPUT: Scene Plan JSON (see parseScript return value)
 * 
 * Location: src/utils/scriptBeatParser.js
 */

'use strict';

// Known characters in the Lala universe
const KNOWN_CHARACTERS = {
  'lala': { id: 'lala', name: 'Lala', emoji: '👑' },
  'justawoman': { id: 'justawomaninherprime', name: 'JustAWomanInHerPrime', emoji: '💎' },
  'justawomaninherprime': { id: 'justawomaninherprime', name: 'JustAWomanInHerPrime', emoji: '💎' },
  'guest': { id: 'guest', name: 'Guest', emoji: '🌟' },
};

// Beat type classification for duration/density defaults
const BEAT_DEFAULTS = {
  'opening': { duration: 8, density: 'low', mood: 'calm' },
  'opening ritual': { duration: 8, density: 'low', mood: 'calm' },
  'interruption': { duration: 10, density: 'medium', mood: 'energetic' },
  'reveal': { duration: 12, density: 'high', mood: 'dramatic' },
  'transformation': { duration: 15, density: 'high', mood: 'energetic' },
  'deliverable': { duration: 10, density: 'medium', mood: 'playful' },
  'deliverable_creation': { duration: 10, density: 'medium', mood: 'playful' },
  'cliffhanger': { duration: 6, density: 'medium', mood: 'tense' },
  'closing': { duration: 8, density: 'low', mood: 'calm' },
  'montage': { duration: 12, density: 'high', mood: 'energetic' },
  'dialogue': { duration: 15, density: 'medium', mood: 'calm' },
  'conflict': { duration: 12, density: 'high', mood: 'tense' },
  'resolution': { duration: 10, density: 'medium', mood: 'calm' },
  'tutorial': { duration: 20, density: 'medium', mood: 'calm' },
  'reaction': { duration: 8, density: 'medium', mood: 'playful' },
};

/**
 * Parse a script string into a structured Scene Plan
 * 
 * @param {string} scriptContent - Raw script text with ## BEAT: tags
 * @param {object} options - Optional overrides
 * @param {string} options.episodeId - Episode UUID
 * @param {string} options.episodeTitle - Episode title for scene naming
 * @returns {object} Scene Plan with scenes array
 */
function parseScript(scriptContent, options = {}) {
  if (!scriptContent || typeof scriptContent !== 'string') {
    return {
      success: false,
      error: 'No script content provided',
      scenes: [],
      metadata: { totalBeats: 0 }
    };
  }

  const lines = scriptContent.split('\n');
  const beats = [];
  let currentBeat = null;
  let lineBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect beat header: ## BEAT: NAME or ## BEAT: NAME — SUBTITLE
    const beatMatch = trimmed.match(/^##\s*BEAT:\s*(.+)$/i);
    if (beatMatch) {
      // Save previous beat
      if (currentBeat) {
        currentBeat.scriptLines = lineBuffer.filter(l => l.trim());
        currentBeat.dialogueLines = extractDialogue(lineBuffer);
        beats.push(currentBeat);
      }

      const beatTitle = beatMatch[1].trim();
      currentBeat = {
        rawTitle: beatTitle,
        title: formatBeatTitle(beatTitle),
        beatType: classifyBeatType(beatTitle),
        characters: [],
        uiElements: [],
        locationHint: null,
        duration: null,
        density: null,
        mood: null,
        transition: null,
        scriptLines: [],
        dialogueLines: [],
        lineNumber: i + 1,
      };
      lineBuffer = [];
      continue;
    }

    if (!currentBeat) continue;

    // Parse metadata tags within a beat
    const parsed = parseMetadataLine(trimmed);
    if (parsed) {
      switch (parsed.type) {
        case 'characters':
          currentBeat.characters = parsed.value;
          break;
        case 'location':
          currentBeat.locationHint = parsed.value;
          break;
        case 'ui_open':
          currentBeat.uiElements.push({ element: parsed.value, action: 'open' });
          break;
        case 'ui_close':
          currentBeat.uiElements.push({ element: parsed.value, action: 'close' });
          break;
        case 'duration':
          currentBeat.duration = parsed.value;
          break;
        case 'density':
          currentBeat.density = parsed.value;
          break;
        case 'mood':
          currentBeat.mood = parsed.value;
          break;
        case 'transition':
          currentBeat.transition = parsed.value;
          break;
        default:
          lineBuffer.push(line);
      }
    } else {
      lineBuffer.push(line);

      // Auto-detect characters from dialogue lines: LALA: "..."
      const dialogueMatch = trimmed.match(/^([A-Z_]+)\s*:\s*["'"]/);
      if (dialogueMatch) {
        const charName = dialogueMatch[1].toLowerCase();
        if (KNOWN_CHARACTERS[charName] && !currentBeat.characters.includes(charName)) {
          currentBeat.characters.push(charName);
        }
      }
    }
  }

  // Don't forget the last beat
  if (currentBeat) {
    currentBeat.scriptLines = lineBuffer.filter(l => l.trim());
    currentBeat.dialogueLines = extractDialogue(lineBuffer);
    beats.push(currentBeat);
  }

  // Build Scene Plan from parsed beats
  const scenes = beats.map((beat, index) => {
    const defaults = BEAT_DEFAULTS[beat.beatType] || BEAT_DEFAULTS['dialogue'] || {};
    const duration = beat.duration || defaults.duration || 10;
    const density = beat.density || defaults.density || 'medium';
    const mood = beat.mood || defaults.mood || 'calm';

    // Resolve character references
    const characters = beat.characters.map(c => {
      const known = KNOWN_CHARACTERS[c.toLowerCase()];
      return known || { id: c, name: c, emoji: '👤' };
    });

    // Extract unique UI elements (only opens, not closes)
    const uiExpected = [...new Set(
      beat.uiElements
        .filter(ui => ui.action === 'open')
        .map(ui => ui.element)
    )];

    return {
      scene_number: index + 1,
      title: beat.title,
      beat_type: beat.beatType,
      raw_beat_title: beat.rawTitle,
      duration_seconds: duration,
      density: density,
      mood: mood,
      transition: beat.transition || (index === 0 ? 'cut' : 'dissolve'),
      location_hint: beat.locationHint,
      characters_expected: characters,
      ui_expected: uiExpected,
      dialogue_count: beat.dialogueLines.length,
      script_excerpt: beat.scriptLines.slice(0, 3).join(' ').substring(0, 200),
      notes: buildSceneNotes(beat, characters, uiExpected),
    };
  });

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration_seconds, 0);

  return {
    success: true,
    episodeId: options.episodeId || null,
    episodeTitle: options.episodeTitle || null,
    totalScenes: scenes.length,
    totalDuration: totalDuration,
    formattedDuration: formatDuration(totalDuration),
    scenes: scenes,
    metadata: {
      totalBeats: beats.length,
      totalDialogueLines: beats.reduce((sum, b) => sum + b.dialogueLines.length, 0),
      charactersUsed: [...new Set(beats.flatMap(b => b.characters))],
      uiElementsUsed: [...new Set(beats.flatMap(b => b.uiElements.map(u => u.element)))],
      hasLocationHints: beats.some(b => b.locationHint),
      densityBreakdown: {
        low: scenes.filter(s => s.density === 'low').length,
        medium: scenes.filter(s => s.density === 'medium').length,
        high: scenes.filter(s => s.density === 'high').length,
      },
      parsedAt: new Date().toISOString(),
    }
  };
}

// ─── HELPER FUNCTIONS ───

/**
 * Parse a metadata line like [CHARACTERS: lala, guest] or [UI:OPEN MailPanel]
 */
function parseMetadataLine(line) {
  // [CHARACTERS: lala, justawoman, guest]
  const charMatch = line.match(/^\[CHARACTERS?:\s*(.+)\]$/i);
  if (charMatch) {
    const chars = charMatch[1].split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
    return { type: 'characters', value: chars };
  }

  // [LOCATION_HINT: "Parisian rooftop garden"]
  const locMatch = line.match(/^\[LOCATION_HINT:\s*"?([^"\]]+)"?\]$/i);
  if (locMatch) {
    return { type: 'location', value: locMatch[1].trim() };
  }

  // [LOCATION: "Parisian rooftop garden"] (alternate syntax)
  const locMatch2 = line.match(/^\[LOCATION:\s*"?([^"\]]+)"?\]$/i);
  if (locMatch2) {
    return { type: 'location', value: locMatch2[1].trim() };
  }

  // [UI:OPEN ElementName]
  const uiOpenMatch = line.match(/^\[UI:OPEN\s+(.+)\]$/i);
  if (uiOpenMatch) {
    return { type: 'ui_open', value: uiOpenMatch[1].trim() };
  }

  // [UI:CLOSE ElementName]
  const uiCloseMatch = line.match(/^\[UI:CLOSE\s+(.+)\]$/i);
  if (uiCloseMatch) {
    return { type: 'ui_close', value: uiCloseMatch[1].trim() };
  }

  // [DURATION: 8s] or [DURATION: 12]
  const durMatch = line.match(/^\[DURATION:\s*(\d+)s?\]$/i);
  if (durMatch) {
    return { type: 'duration', value: parseInt(durMatch[1]) };
  }

  // [DENSITY: low|medium|high]
  const densMatch = line.match(/^\[DENSITY:\s*(low|medium|high)\]$/i);
  if (densMatch) {
    return { type: 'density', value: densMatch[1].toLowerCase() };
  }

  // [MOOD: energetic|calm|tense|playful|dramatic]
  const moodMatch = line.match(/^\[MOOD:\s*(\w+)\]$/i);
  if (moodMatch) {
    return { type: 'mood', value: moodMatch[1].toLowerCase() };
  }

  // [TRANSITION: cut|fade|dissolve|swipe]
  const transMatch = line.match(/^\[TRANSITION:\s*(\w+)\]$/i);
  if (transMatch) {
    return { type: 'transition', value: transMatch[1].toLowerCase() };
  }

  return null;
}

/**
 * Format beat title: "OPENING RITUAL" → "Opening Ritual"
 */
function formatBeatTitle(raw) {
  return raw
    .replace(/—/g, '–')
    .split(/[\s]+/)
    .map(word => {
      if (word === '–' || word === '—') return '–';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Classify beat type from title for default lookups
 * "INTERRUPTION — INVITE" → "interruption"
 * "OPENING RITUAL" → "opening ritual"
 */
function classifyBeatType(raw) {
  const normalized = raw.toLowerCase().replace(/[—–]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Check exact matches first
  if (BEAT_DEFAULTS[normalized]) return normalized;
  
  // Check first word
  const firstWord = normalized.split(/[\s–—]/)[0].trim();
  if (BEAT_DEFAULTS[firstWord]) return firstWord;

  // Fuzzy match known types
  for (const key of Object.keys(BEAT_DEFAULTS)) {
    if (normalized.includes(key)) return key;
  }

  return normalized;
}

/**
 * Extract dialogue lines from script content
 */
function extractDialogue(lines) {
  return lines
    .map(l => l.trim())
    .filter(l => l.match(/^[A-Z_]+\s*:\s*["'"]/))
    .map(l => {
      const match = l.match(/^([A-Z_]+)\s*:\s*["'"](.+?)["'"]?\s*$/);
      if (match) {
        return { character: match[1].toLowerCase(), line: match[2] };
      }
      return { character: 'unknown', line: l };
    });
}

/**
 * Build human-readable scene notes
 */
function buildSceneNotes(beat, characters, uiExpected) {
  const parts = [];
  
  if (characters.length > 0) {
    parts.push(`Characters: ${characters.map(c => `${c.emoji} ${c.name}`).join(', ')}`);
  }
  if (uiExpected.length > 0) {
    parts.push(`UI: ${uiExpected.join(', ')}`);
  }
  if (beat.locationHint) {
    parts.push(`Location: ${beat.locationHint}`);
  }
  if (beat.dialogueLines.length > 0) {
    parts.push(`${beat.dialogueLines.length} dialogue line${beat.dialogueLines.length > 1 ? 's' : ''}`);
  }

  return parts.join(' · ');
}

/**
 * Format seconds into readable duration
 */
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

// ─── EXPORTS ───

module.exports = {
  parseScript,
  parseMetadataLine,
  formatBeatTitle,
  classifyBeatType,
  extractDialogue,
  KNOWN_CHARACTERS,
  BEAT_DEFAULTS,
};
