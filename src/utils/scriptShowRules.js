'use strict';

// Two show rules the script is checked and fixed against (Evoni, 2026-10-17),
// the server's copy of frontend/src/lib/scriptShowRules.js: the code between
// BEGIN SHARED and END SHARED is the same word for word (a parity test in
// frontend/src/lib/scriptShowRules.test.js checks it). The writer fixes a
// script with it after writing (groundedScriptGeneratorService).
//
// - Lala's voice: she talks only after JustAWoman clicks her voice icon,
//   unless she is answering a notification or message, or being dressed;
//   per beat. Her thoughts, `Lala (V.O.):`, are not talking.
// - Beat 5 (Reveal) shows the invitation letter, never the login screen.

// BEGIN SHARED
const UI = /^\s*\[UI:\s*([A-Za-z_]+)\s*(.*?)\s*\]\s*$/i;
const LALA = /^\s*lala\s*(?:\(([^)]*)\))?\s*:\s*\S/i;
const TAPS = new Set(['CLICK', 'TAP', 'SELECT']);
const MESSAGES = new Set(['NOTIFY', 'DM']);
const MAIL = /^\s*\[MAIL\s*:/i;
const WEAR = /^\s*\[WEAR\s*:/i;
const VOICE = /voice/i;
const INVITATION = /invit/i;
const LOGIN = /log\s*-?\s*in|sign\s*-?\s*in|start\s*button|^\s*start\s*$|password|username/i;
const REVEAL_BEAT = 5;
const BEAT_HEADER = /^\s*##\s*BEAT:\s*(.*)$/i;
const SPLIT = /(?=^[ \t]*##[ \t]*BEAT:)/im;

const moment = (line) => {
  const m = String(line || '').match(UI);
  return m ? { verb: m[1].toUpperCase(), target: m[2] } : null;
};
const isProductionEntry = (o) => o?.category === 'production';
const entryName = (o) => (o ? o.name || o.label || o.id || o.key || null : null);

/** The show's voice icon by name (the icon named for her voice), else 'Voice Icon'. */
function voiceIconName(icons = []) {
  const found = (icons || []).find((o) => o && VOICE.test(`${o.name || ''} ${o.id || ''}`));
  return entryName(found) || 'Voice Icon';
}

/** The line that brings up the show's invitation letter: OPEN for a phone screen, DISPLAY for an overlay. */
function invitationLine(on = {}) {
  const all = [...(on.screens || []), ...(on.production || []), ...(on.overlays || [])];
  const found = all.find((o) => o && INVITATION.test(`${o.name || ''} ${o.label || ''} ${o.id || ''} ${o.key || ''}`));
  const name = entryName(found) || 'Invitation';
  return `[UI:${found && (isProductionEntry(found) || on.production?.includes(found)) ? 'DISPLAY' : 'OPEN'} ${name}]`;
}

// She is being dressed in this beat: a [WEAR:] cue, or the closet opens.
const dressing = (lines) => lines.some((l) => WEAR.test(l) || (() => { const m = moment(l); return !!m && m.verb === 'OPEN' && /closet/i.test(m.target); })());

/** The lines of one beat where Lala starts talking with her voice off. */
function voiceOffLines(lines = []) {
  const off = [];
  if (dressing(lines)) return off;
  let on = false;
  lines.forEach((line, i) => {
    const m = moment(line);
    if (m) { if ((TAPS.has(m.verb) && VOICE.test(m.target)) || MESSAGES.has(m.verb)) on = true; return; }
    if (MAIL.test(line)) { on = true; return; }
    const lala = String(line || '').match(LALA);
    if (lala && !/v\.?\s*o\.?/i.test(lala[1] || '') && !on) { off.push(i); on = true; }
  });
  return off;
}

/** One beat's lines with the voice click before each place she starts talking: { lines, added }. */
function beatWithVoiceClicks(lines = [], iconName = 'Voice Icon') {
  const off = voiceOffLines(lines);
  const next = lines.slice();
  for (const i of off.slice().reverse()) next.splice(i, 0, `[UI:CLICK ${iconName}]`);
  return { lines: next, added: off.length };
}

/** What is wrong with the Reveal beat's lines: { login: [indices], invitation: bool }. */
function revealCheck(lines = []) {
  const login = [];
  let invitation = false;
  lines.forEach((line, i) => {
    const m = moment(line);
    if (!m) return;
    if (INVITATION.test(m.target)) invitation = true;
    else if (LOGIN.test(m.target)) login.push(i);
  });
  return { login, invitation };
}

/** The Reveal beat's lines with the login moments taken out and the invitation brought up: { lines, changed }. */
function revealWithInvitation(lines = [], on = {}) {
  const { login, invitation } = revealCheck(lines);
  if (invitation && !login.length) return { lines, changed: false };
  const next = lines.filter((_, i) => !login.includes(i));
  if (!invitation) next.splice(login.length ? login[0] : 0, 0, invitationLine(on));
  return { lines: next, changed: true };
}

const beatNumberOf = (header, position) => {
  const m = String(header || '').match(BEAT_HEADER);
  const n = m ? Number((m[1].match(/^\s*(\d+)/) || [])[1]) : NaN;
  return Number.isFinite(n) ? n : position + 1;
};

/**
 * The script with both rules fixed, beat by beat. `only`: the beat positions
 * to change (all when null); `skip`: positions never changed (approved
 * beats); `voice` / `reveal`: which fixes to make. Returns { script,
 * voice_clicks, reveal }: how many clicks were added, and whether the
 * Reveal beat changed.
 */
function scriptWithShowRules(scriptText, on = {}, { only = null, skip = [], voice = true, reveal = true } = {}) {
  const text = String(scriptText || '');
  const parts = text.split(SPLIT);
  const preamble = parts.length && !BEAT_HEADER.test(parts[0].split('\n')[0]) ? parts.shift().trimEnd() : '';
  const sections = parts.map((p) => p.trimEnd());
  const icon = voiceIconName(on.icons);
  let clicks = 0;
  let revealed = false;
  const fixed = sections.map((section, beatIndex) => {
    if (skip.includes(beatIndex) || (only !== null && !only.includes(beatIndex))) return section;
    const [header, ...rest] = section.split('\n');
    let lines = rest.filter((l) => l.trim());
    let changed = false;
    if (reveal && beatNumberOf(header, beatIndex) === REVEAL_BEAT) {
      const r = revealWithInvitation(lines, on);
      if (r.changed) { lines = r.lines; changed = true; revealed = true; }
    }
    if (voice) {
      const v = beatWithVoiceClicks(lines, icon);
      if (v.added) { lines = v.lines; changed = true; clicks += v.added; }
    }
    return changed ? [header, ...lines].join('\n') : section;
  });
  if (!clicks && !revealed) return { script: text, voice_clicks: 0, reveal: false };
  const body = fixed.join('\n\n');
  return { script: preamble ? `${preamble}\n\n${body}` : body, voice_clicks: clicks, reveal: revealed };
}
// END SHARED

module.exports = { REVEAL_BEAT, voiceIconName, invitationLine, voiceOffLines, beatWithVoiceClicks, revealCheck, revealWithInvitation, scriptWithShowRules };
