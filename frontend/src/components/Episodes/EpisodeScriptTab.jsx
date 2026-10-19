// frontend/src/components/Episodes/EpisodeScriptTab.jsx
// Beat-by-beat script reviewer with Show Brain AI rewrite

import { Fragment, useState, useEffect, useLayoutEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { PenLine, GripVertical, ArrowUp, ArrowDown, Smartphone, Image as ImageIcon, X, Plus, Coins, Shirt, MapPin, Users, ListChecks, Check, Circle, AlertTriangle, Bell, MessageCircle, Send, Clock, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { episodePlanning } from '../../utils/episodePlanning';
import { scriptInputs, mustCover, scriptPeople } from '../../lib/episodeScript';
import Beat14Opportunity from './Beat14Opportunity';
import { beat14Outcome } from '../../lib/beat14Invitation';
import { beatState } from '../../lib/beatState';
import { moveBeat, moveLine, dropIndex, replaceBeat, appendLine, insertLine } from '../../lib/scriptBeatOrder';
import { parseMoment, resolveMoment, momentLine, verbLabel, beatOnScreen, phoneUpAtBeat, deviceLabel, phoneIcons, PHONE_KEY, PHONE_NAME, PHONE_VERBS, OVERLAY_VERBS, DEVICE_VERBS, EXPECTED_ON_SCREEN, hasPhoneMoment, beatSpeakers, phoneCheck, phoneStartScreens, messageLine, closetBeat, wearFlags, uncuedPieces, lastGettingReadyIndex, todoModeAt, deliveredAt, dealCueFlags, TODO_MODE_LABELS } from '../../lib/scriptMoments';
import { isScreen, isIcon, isProduction } from '../../lib/overlayUtils';
import { draftLine, lalaLine, lalaLineSlots } from '../../lib/lalaLineDraft';
import { headerNumber, BEAT_SPLIT, HAS_BEAT_HEADER, normalizeBeatHeaders } from '../../lib/beatLabelNumber';
import { speakerLine, unquote } from '../../lib/scriptSpeaker';
import { beatImage, beatImageLabel } from '../BeatPlan/BeatPlanParts';
import { beatSeconds, scriptSeconds, formatRuntime } from '../../lib/scriptRuntime';
import { scriptHealth } from '../../lib/scriptHealth';
import { scriptMoneyFrom, shoppingListApproved, eventCast, featuredGuestIds } from '../../lib/scriptRuleChecks';
import { scriptWithPhonePaths } from '../../lib/phonePaths';
import { scriptWithShowRules, isCutsceneBeat } from '../../lib/scriptShowRules';
import ScriptHealthPanel from './ScriptHealthPanel';
import ScriptReadActions from './ScriptReadActions';
import ScriptHistory from './ScriptHistory';
import useScriptDraft from '../../hooks/useScriptDraft';
import useDialogLayer from '../../hooks/useDialogLayer';
import './EpisodeScriptPage.css';

// Track 6 CP15 partial-migration extension (5th instance) — file already
// has 5 pre-existing api.* sites (lines 152, 161, 177, 191, 194). Add
// helpers for the 2 remaining raw fetch sites (world locations + world map).
// listLocationsApi is a CP8/CP11 cross-CP duplicate, reaches 3-fold.
export const listLocationsApi = () =>
  api.get('/api/v1/world/locations').then((r) => r.data);
export const getWorldMapApi = () =>
  api.get('/api/v1/world/map').then((r) => r.data);

const DreamMap = lazy(() => import('../DreamMap'));

// The element that scrolls the page around `el`: <body> on a phone,
// .app-content on a desktop (hooks/useScrolledPast's pageScrollTop).
export function scrollerOf(el) {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return document.scrollingElement || document.documentElement;
}

// A dialog or sheet on the page (Script page audit, 2026-10-19): while it
// is open, Escape closes it (unless something inside answered it already,
// a line editor's Escape), focus goes to `focusRef`, and it goes back to
// what opened it when it closes.
// Only the dialog on top answers Escape (Script page re-audit, 2026-10-19:
// one Escape closed the map and History under it; hooks/useDialogLayer).
// `trapRef`: a modal sheet's box; while it is on top, Tab and Shift+Tab stay
// in it (Script page audit 3, 2026-10-19: Tab left the phone's Context sheet
// for the page behind it).
const TRAP_FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function useDialogKeys(open, onClose, focusRef = null, trapRef = null) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const isTop = useDialogLayer(open);
  const isTopRef = useRef(isTop);
  isTopRef.current = isTop;
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    focusRef?.current?.focus?.();
    const onKey = (e) => {
      if (e.defaultPrevented || !isTopRef.current()) return;
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return; }
      const box = trapRef?.current;
      if (e.key !== 'Tab' || !box) return;
      const all = [...box.querySelectorAll(TRAP_FOCUSABLE)];
      // Hidden controls are skipped where there is layout to tell.
      const shown = all.filter((el) => el.getClientRects().length > 0);
      const items = shown.length ? shown : all;
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      const inside = box.contains(at);
      if (e.shiftKey && (!inside || at === first)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (!inside || at === last)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && opener !== document.body && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    };
  }, [open, focusRef, trapRef]);
}

const BEAT_NAMES = [
  { number: 1,  name: 'Opening Ritual',        icon: '🎬', color: 'var(--primary-text)' },
  { number: 2,  name: 'Login Sequence',         icon: '🔐', color: 'var(--primary-text)' },
  { number: 3,  name: 'Welcome',                icon: '👋', color: 'var(--primary-text)' },
  { number: 4,  name: 'Interruption Pulse 1',   icon: '📩', color: 'var(--lala-gold-text)' },
  { number: 5,  name: 'Reveal',                 icon: '✨', color: 'var(--lala-gold-text)' },
  { number: 6,  name: 'Strategic Reaction',     icon: '🎯', color: 'var(--lala-gold-text)' },
  { number: 7,  name: 'Interruption Pulse 2',   icon: '💬', color: 'var(--lala-gold-text)' },
  { number: 8,  name: 'Transformation Loop',    icon: '👗', color: 'var(--accent-dark)' },
  { number: 9,  name: 'Reminder / Deadline',    icon: '⏰', color: 'var(--accent-dark)' },
  { number: 10, name: 'Event Travel',           icon: '✈️', color: 'var(--info-text)' },
  { number: 11, name: 'The Event',              icon: '🏆', color: 'var(--info-text)' },
  { number: 12, name: 'Fashion Challenge',   icon: '🎨', color: 'var(--info-text)' },
  { number: 13, name: 'Recap Panel',            icon: '📊', color: 'var(--success-text)' },
  { number: 14, name: 'Cliffhanger',            icon: '🔥', color: 'var(--success-text)' },
];

// Episode creation step 7 (§8(j)): a canonical header, `## BEAT: 5 · Reveal`,
// names its beat by number (src/utils/canonicalScriptBeats.js); an older
// name-only header still falls back to its position. Text before the first
// header (an [EVENT:] tag) is not a beat; scriptPreamble keeps it. A beat
// whose number is in lockedBeats is approved, and locked
// (src/utils/scriptBeatLocks.js numbers beats the same way).
const BEAT_HEADER_START = /^\s*##\s*BEAT:/i;
export function scriptPreamble(text) {
  const scriptText = normalizeBeatHeaders(text);
  if (!HAS_BEAT_HEADER.test(scriptText)) return '';
  const first = scriptText.split(BEAT_SPLIT)[0];
  return BEAT_HEADER_START.test(first) ? '' : first.trimEnd();
}

export function parseScriptIntoBeats(text, lockedBeats = []) {
  const scriptText = normalizeBeatHeaders(text);
  if (!scriptText.trim()) return [];
  const locked = new Set(lockedBeats);
  if (HAS_BEAT_HEADER.test(scriptText)) {
    const sections = scriptText.split(BEAT_SPLIT).filter(s => BEAT_HEADER_START.test(s));
    const seen = new Map();
    return sections.map((section, i) => {
      const lines = section.split('\n').filter(l => l.trim());
      const header = lines[0] || '';
      const beatMatch = header.match(/##\s*BEAT:\s*(.+)/i);
      const beatLabel = beatMatch?.[1]?.trim() || `Beat ${i + 1}`;
      // A number, or a canonical beat's name (`## BEAT: TRANSFORMATION`, as
      // the skeleton writes it; lib/beatLabelNumber.js), else its place.
      // A number past 14 is the beat's own (re-audit 2, lib/beatLabelNumber.js headerNumber).
      const named = headerNumber(beatLabel);
      const canon = named && named <= BEAT_NAMES.length ? BEAT_NAMES[named - 1] : null;
      const own = named && !canon ? { number: named, name: beatLabel.replace(/^\d+\s*(?:[·:.\-–—]\s*)?/, '') || `Beat ${named}`, icon: '📌', color: 'var(--text-secondary)' } : null;
      const info = canon || own || BEAT_NAMES[i] || { number: i + 1, name: beatLabel, icon: '📌', color: 'var(--text-secondary)' };
      const number = named || i + 1;
      // The id follows the beat, not its place, so a moved beat stays open.
      const n = (seen.get(number) || 0) + 1; seen.set(number, n);
      return { id: n === 1 ? `beat-${number}` : `beat-${number}-${n}`, number, name: info.name, icon: info.icon, color: info.color, rawLabel: beatLabel, lines: lines.slice(1).filter(l => l.trim()), approved: locked.has(number), raw: section };
    });
  }
  const lines = scriptText.split('\n').filter(l => l.trim());
  const per = Math.max(1, Math.ceil(lines.length / 14));
  return BEAT_NAMES.map((b, i) => {
    const bl = lines.slice(i * per, (i + 1) * per);
    return { id: `beat-${b.number}`, ...b, rawLabel: b.name, lines: bl, approved: locked.has(b.number), raw: bl.join('\n') };
  }).filter(b => b.lines.length > 0);
}

// The script with one line of one beat changed. Only that beat is written
// again; the text before the first beat and every other beat stay exactly as
// they are (a locked beat included). null: the beat is gone or locked.
export function scriptWithLine(scriptText, lockedBeats, beatId, lineIndex, newText) {
  return scriptWithBeatLines(scriptText, lockedBeats, beatId, (lines) => { lines[lineIndex] = newText; });
}

// The script with one line of one beat taken out (Script tab audit,
// 2026-10-15), written the way scriptWithLine writes it. null: the beat is
// gone or locked, or it has no such line.
export function scriptWithoutLine(scriptText, lockedBeats, beatId, lineIndex) {
  return scriptWithBeatLines(scriptText, lockedBeats, beatId, (lines) => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= lines.length) return false;
    lines.splice(lineIndex, 1);
  });
}

function scriptWithBeatLines(scriptText, lockedBeats, beatId, edit) {
  const beats = parseScriptIntoBeats(scriptText, lockedBeats);
  const target = beats.find(b => b.id === beatId);
  if (!target || target.approved) return null;
  const lines = [...target.lines];
  if (edit(lines) === false) return null;
  const body = beats.map((b) => {
    if (b === target) {
      return `## BEAT: ${b.rawLabel}\n${lines.join('\n')}`;
    }
    return !b.raw?.trim() || !BEAT_HEADER_START.test(b.raw) ? `## BEAT: ${b.rawLabel}\n${b.lines.join('\n')}` : b.raw.trimEnd();
  }).join('\n\n');
  const preamble = scriptPreamble(scriptText);
  return preamble ? `${preamble}\n\n${body}` : body;
}

// A script with no `## BEAT:` header is shown as up to 14 beats by place;
// moving, adding, regenerating and locking work on headed beats, so they
// first give it headers, one per shown beat (Script tab audit, 2026-10-15:
// on such a script they did nothing). A headed script comes back as it is.
// At phone width only the open beat shows (EpisodeScriptPage.css), so its
// header doesn't close it: closing it left no beat on screen.
const isPhoneWidth = () => {
  try { return window.matchMedia?.('(max-width: 760px)').matches || false; } catch (err) { console.error('[EpisodeScript] width check failed:', err); return false; }
};

//
// A header that names no beat (`## BEAT: Bonus scene`) is numbered by its
// place, so moving another beat past it gave it, and its lock, another
// number (Script tab re-audit, 2026-10-15). Its number is written in first
// (`## BEAT: 2 · Bonus scene`), so it keeps it wherever beats move; the
// server puts a locked beat back the same way (src/utils/scriptBeatLocks.js).
export function withBeatHeaders(scriptText, lockedBeats = []) {
  if (!String(scriptText || '').trim()) return scriptText;
  const text = normalizeBeatHeaders(scriptText);
  if (!HAS_BEAT_HEADER.test(text)) {
    return parseScriptIntoBeats(text, lockedBeats).map((b) => `## BEAT: ${b.number} · ${b.name}\n${b.lines.join('\n')}`).join('\n\n');
  }
  let place = 0;
  const numbered = text.split('\n').map((line) => {
    const m = line.match(/^\s*##[ \t]*BEAT:[ \t]*(.*)$/i);
    if (!m) return line;
    place += 1;
    const label = m[1].trim();
    if (headerNumber(label)) return line;
    return `## BEAT: ${place}${label ? ` · ${label}` : ''}`;
  }).join('\n');
  return numbered === scriptText ? scriptText : numbered;
}

const CUE_LINE = /^\[(TRANSITION|WEAR|DELIVER|TODO_MODE|SCENE|LOCATION_HINT|EVENT|EPISODE_INTENT|SFX|EDIT)\s*:?\s*(.*?)\s*\]$/i;
function cueLabel(text) {
  const m = String(text || '').match(CUE_LINE);
  if (!m) return null;
  const kind = m[1].toUpperCase();
  const rest = m[2].replace(/^["']|["']$/g, '');
  if (kind === 'TRANSITION') return `Transition${rest ? `: ${rest}` : ''}`;
  // JustAWoman's sound and edit cues (Evoni, 2026-10-17).
  if (kind === 'SFX') return `Sound${rest ? `: ${rest}` : ''}`;
  if (kind === 'EDIT') return `Edit${rest ? `: ${rest}` : ''}`;
  if (kind === 'WEAR') return 'Puts on a piece of the look';
  if (kind === 'DELIVER') return 'Delivers a deal item';
  if (kind === 'TODO_MODE') return `Phone to-do list: ${TODO_MODE_LABELS[rest.toLowerCase()] || rest || 'not set'}`;
  if (kind === 'SCENE') return `Scene${rest ? `: ${rest}` : ''}`;
  if (kind === 'LOCATION_HINT') return `Location${rest ? `: ${rest}` : ''}`;
  return `${kind === 'EVENT' ? 'Event' : 'Episode intent'}${rest ? `: ${rest}` : ''}`;
}

// Beats 11–13 are the cutscene: no phone (lib/scriptShowRules; Script page re-audit, 2026-10-19).
const CUTSCENE_NO_PHONE = 'Beats 11–13 are the cutscene: no phone.';

const COVERAGE_KINDS = { deliverable: 'Deliverable', goal: 'Goal', hook: 'Forward hook', opportunity: 'Opportunity', wear: 'Wear cue', phone: 'Phone moment', beat: 'Beat missing', rule: 'Show rule' };

function parseLine(line) {
  const t = (typeof line === 'string' ? line : '').trim();
  if (!t) return null;
  // A UI line is a moment on screen: a phone screen or an overlay (Task #2789).
  const moment = parseMoment(t);
  if (moment) return { type: 'moment', text: t, ...moment };
  // [STAT:] and [MAIL:] are read by the game, not shown. A [UI: line the
  // moment reader can't read shows as written, so it can be seen and fixed
  // (Script tab re-audit, 2026-10-15: it was hidden).
  if (/^\[STAT:|^\[MAIL:/i.test(t)) return { type: 'ui', text: t, hidden: true };
  // A cue the page reads but nobody says (Script tab audit, 2026-10-15: these
  // showed as narration, a [WEAR] cue as a raw id): a short muted note.
  const cue = cueLabel(t);
  if (cue) return { type: 'cue', text: cue };
  if (/^\(.*\)$/.test(t)) return { type: 'action', text: t };
  // A speaker may carry a note, `Lala (V.O.): …`; a label such as
  // `Location:` is not a speaker (lib/scriptSpeaker.js, shared with Rewrite,
  // the runtime and the export).
  const sp = speakerLine(t);
  if (sp && sp.words) return { type: 'dialogue', speaker: sp.speaker, text: unquote(sp.words) };
  return { type: 'narration', text: t };
}

/**
 * The rewritten line in the original's shape: its speaker label and quotes
 * kept, the new words inside. Null when nothing came back or nothing changed.
 */
export function rewrittenLine(original, words) {
  const from = speakerLine(original);
  // The reply may repeat the line's own speaker (`Lala (whisper): "…"`); only
  // its words count. Another lead-in ("Listen: …") is part of the words
  // (re-audit 2, 2026-10-15).
  const reply = String(words || '').trim();
  const again = speakerLine(reply);
  const text = unquote(again && from && again.speaker === from.speaker ? again.words : reply);
  if (!text) return null;
  if (!from) return text === String(original || '').trim() ? null : text;
  // A direction before the words, `(softly)`, stays with the speaker.
  const direction = (from.words.match(/^(\([^)]*\))\s*/) || [])[0] || '';
  const said = from.words.slice(direction.length);
  const quoted = /^["“]/.test(said);
  const prefix = /\s$/.test(from.prefix) ? from.prefix : `${from.prefix} `;
  const next = `${prefix}${direction}${quoted ? `"${text}"` : text}`;
  return next.trim() === String(original || '').trim() ? null : next;
}

function ScriptLine({ line, beatId, lineId = null, onOpenEdit = null, onFocusLater = null, beatNumber = null, lineIndex, onEdit, onDelete, onRewrite, rewriting, locked, prevLine = null, nextLine = null, onMoveLine, drag, onScreen, withOnScreen, phoneDown = false }) {
  const [editing, setEditing] = useState(false);
  const [dropAt, setDropAt] = useState(null);
  const [editText, setEditText] = useState('');
  const lineStr = typeof line === 'string' ? line : '';
  // An open editor with changed words is known to the tab, so nothing that
  // replaces the beat or the script throws them away (Script page audit 3,
  // 2026-10-19: "Use it" and History dropped them without a word).
  const changed = editing && editText !== lineStr;
  useEffect(() => {
    if (!changed || !onOpenEdit) return undefined;
    return onOpenEdit(beatId, lineId ?? lineIndex);
  }, [changed, onOpenEdit, beatId, lineId, lineIndex]);
  const parsed = parseLine(lineStr);
  if (!parsed || parsed.hidden) return null;
  const sc = { Prime: 'var(--primary-text)', Lala: 'var(--accent-dark)', Kelli: 'var(--info-text)', Guest: 'var(--success-text)' };
  // Focus goes back to the line's row once its editor closes, found by its
  // place, since a changed line is drawn anew (Script page audit, 2026-10-19).
  // `at`: where the line is now (a moved line); Delete and Move give focus
  // back too (Script page re-audit, 2026-10-19: it fell to the page).
  // `changed`: the script changed, so the rows are drawn anew once the beat
  // is parsed again; focus waits for them (onFocusLater, the tab's layout
  // effect on its beats) instead of a timer that could land on a row about
  // to be replaced, leaving focus on the page (Script page audit 3, 2026-10-19).
  const closeEditor = (at = lineIndex, changed = false) => {
    setEditing(false);
    if (changed && onFocusLater) { onFocusLater(beatId, at); return; }
    setTimeout(() => document.querySelector(`[data-beat-id="${beatId}"] [data-line-index="${at}"]`)?.focus(), 0);
  };

  if (editing) return (
    <div className="esp-line-edit">
      {/* The beat was approved while the line was open (Script page audit,
          2026-10-19: Save then dropped the typed words without a word). The
          words stay here until Cancel; unlocking the beat lets Save put them in. */}
      {locked && <p className="esp-line-edit-note" role="alert" data-testid="script-line-locked-note">This beat was approved while you were editing, so this line can&apos;t change. Your words are still here: unlock the beat to put them in, or copy them.</p>}
      {/* Escape cancels, Ctrl/Cmd+Enter keeps the line; Ctrl/Cmd+S goes on
          to the tab's own save (Script tab audit, 2026-10-15). */}
      <textarea className="esp-line-input" value={editText} onChange={e => setEditText(e.target.value)} autoFocus rows={3} aria-label="Edit line"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); closeEditor(); }
          else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (onEdit(beatId, lineIndex, editText) !== false) closeEditor(lineIndex, editText !== lineStr); }
          // The line goes in first, then the tab saves (Script tab re-audit,
          // 2026-10-15: the save left the open line out).
          else if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); if (onEdit(beatId, lineIndex, editText, { thenSave: true }) !== false) closeEditor(lineIndex, editText !== lineStr); }
        }} />
      <div className="esp-line-edit-actions">
        {/* A refused edit (a new script is being written) keeps the editor open. */}
        <button type="button" className="esp-btn-primary is-small" onClick={() => { if (onEdit(beatId, lineIndex, editText) !== false) closeEditor(lineIndex, editText !== lineStr); }}>Save</button>
        <button type="button" className="esp-btn is-small" onClick={() => closeEditor()}>Cancel</button>
        {onDelete && <button type="button" className="esp-btn is-small esp-line-delete" data-testid="script-line-delete" onClick={() => { if (!window.confirm('Delete this line?')) return; if (onDelete(beatId, lineIndex) !== false) closeEditor(lineIndex, true); }}><Trash2 size={13} aria-hidden="true" /> Delete line</button>}
        {/* Moving without dragging (touch screens, keyboards). */}
        <span className="esp-move esp-move--end">
          {/* Past the next line shown, not a hidden [STAT:] line (Script tab re-audit, 2026-10-15). */}
          {/* Typed words go in with Save first (re-audit 2: a move threw them away). */}
          <button type="button" className="esp-move-btn" aria-label="Move line up" title={editText !== lineStr ? 'Save the line first' : undefined} disabled={prevLine === null || editText !== lineStr} onClick={() => { if (onMoveLine(beatId, lineIndex, prevLine) !== false) closeEditor(prevLine, true); }}><ArrowUp size={14} aria-hidden="true" /></button>
          <button type="button" className="esp-move-btn" aria-label="Move line down" title={editText !== lineStr ? 'Save the line first' : undefined} disabled={nextLine === null || editText !== lineStr} onClick={() => { if (onMoveLine(beatId, lineIndex, nextLine) !== false) closeEditor(nextLine, true); }}><ArrowDown size={14} aria-hidden="true" /></button>
        </span>
      </div>
    </div>
  );

  // Rewrite sits beside the row, not inside its role="button" (Script page
  // audit, 2026-10-19: a button in a button).
  return (
    <div className="esp-line-row">
    <div
      className={`esp-line${locked ? ' is-locked' : ''}${dropAt ? ` esp-drop-${dropAt}` : ''}`}
      data-testid="script-line"
      data-line-index={lineIndex}
      draggable={!locked}
      onDragStart={locked ? undefined : (e) => { e.stopPropagation(); drag.start(e, { kind: 'line', beatId, from: lineIndex }); }}
      onDragEnd={() => drag.end()}
      onDragOver={(e) => { const d = drag.current(); if (locked || d?.kind !== 'line' || d.beatId !== beatId) return; e.preventDefault(); e.stopPropagation(); setDropAt(drag.half(e)); }}
      onDragLeave={() => setDropAt(null)}
      onDrop={(e) => { const d = drag.current(); setDropAt(null); if (locked || d?.kind !== 'line' || d.beatId !== beatId) return; e.preventDefault(); e.stopPropagation(); onMoveLine(beatId, d.from, dropIndex(d.from, lineIndex, drag.half(e) === 'after')); drag.end(); }}
      onClick={locked ? undefined : () => { setEditText(lineStr); setEditing(true); }}
      // A line opens from the keyboard too (Script tab audit, 2026-10-15).
      role={locked ? undefined : 'button'}
      tabIndex={locked ? undefined : 0}
      aria-label={locked ? undefined : `Edit line: ${parsed.type === 'dialogue' ? `${parsed.speaker}: ${parsed.text}` : parsed.text}`}
      onKeyDown={locked ? undefined : (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setEditText(lineStr); setEditing(true); }
      }}
    >
      {parsed.type === 'dialogue' && (
        <div>
          <span className="esp-line-speaker" style={{ '--speaker': sc[parsed.speaker] || 'var(--text-primary)' }}>{parsed.speaker}</span>
          <span className="esp-line-text">"{parsed.text}"</span>
        </div>
      )}
      {parsed.type === 'moment' && <MomentCard moment={parsed} shown={resolveMoment(parsed, onScreen)} alongside={withOnScreen} phoneDown={phoneDown} beatNumber={beatNumber} postDrafts={onScreen.postDrafts} />}
      {parsed.type === 'action' && <div className="esp-line-action">{parsed.text}</div>}
      {parsed.type === 'narration' && <div className="esp-line-text">{parsed.text}</div>}
      {parsed.type === 'cue' && <div className="esp-line-cue">{parsed.text}</div>}
    </div>
    {parsed.type === 'dialogue' && !locked && <button type="button" className="esp-rewrite" onClick={() => onRewrite(beatId, lineIndex, lineStr, lineId)} disabled={rewriting} aria-label={rewriting ? 'Rewriting…' : undefined}>{rewriting ? '⏳' : '✦ Rewrite'}</button>}
    </div>
  );
}

// A moment on screen in the script: what the phone or an overlay shows, with
// its picture, so the beat reads the way it will play (Task #2789).
const MESSAGE_ICONS = { notify: Bell, dm: MessageCircle, post: Send };
function MomentCard({ moment, shown, alongside = [], phoneDown = false, beatNumber = null, postDrafts = [] }) {
  // A notification, a DM or a post (Task #2885): who and the words, and for
  // a post whether its draft is in Lala's Feed.
  if (shown && MESSAGE_ICONS[shown.kind]) {
    const MIcon = MESSAGE_ICONS[shown.kind];
    const draft = shown.kind === 'post' ? (postDrafts || []).find((d) => d.beat === beatNumber && d.text === shown.text && d.post_id) : null;
    return (
      <div className={`esp-moment is-${shown.kind}`} data-testid="script-moment">
        <span className="esp-moment-thumb"><MIcon size={18} aria-hidden="true" /></span>
        <span className="esp-moment-text">
          <span className="esp-moment-kind">Lala&apos;s phone</span>
          <span className="esp-moment-what">{shown.name}</span>
          {shown.text && <span className="esp-moment-words">&ldquo;{shown.text}&rdquo;</span>}
          {shown.kind === 'post' && (draft
            ? <span className="esp-moment-drafted" data-testid="script-post-drafted">{draft.status === 'live' ? '✓ Live in Lala\u2019s posts' : '✓ Draft in Lala\u2019s posts, waiting for approval'}</span>
            : <span className="esp-moment-opens" data-testid="script-post-pending">Drafted in Lala&apos;s posts when the script is saved</span>)}
          {/* A message in the cutscene is flagged too (Script page re-audit, 2026-10-19). */}
          {phoneDown && <span className="esp-moment-missing" data-testid="script-moment-phone-down">{isCutsceneBeat(beatNumber) ? CUTSCENE_NO_PHONE : <>Lala&apos;s phone isn&apos;t on screen here. Bring it up first: Phone / overlay, The phone itself.</>}</span>}
          {alongside.length > 0 && <span className="esp-moment-with" data-testid="script-moment-with">With: {alongside.join(', ')}</span>}
        </span>
      </div>
    );
  }
  const Icon = shown?.kind === 'overlay' ? ImageIcon : Smartphone;
  // The phone itself reads "Lala's phone · Comes on screen" (Task #2797).
  const what = shown?.kind === 'device' ? deviceLabel(moment.verb)
    : shown?.kind === 'icon' ? `Taps ${shown.name}` : `${verbLabel(moment.verb)} ${shown ? shown.name : moment.target}`;
  return (
    <div className={`esp-moment is-${shown ? shown.kind : 'unknown'}`} data-testid="script-moment">
      <span className="esp-moment-thumb">{shown?.url ? <img src={shown.url} alt="" loading="lazy" /> : <Icon size={18} aria-hidden="true" />}</span>
      <span className="esp-moment-text">
        <span className="esp-moment-kind">{shown?.kind === 'overlay' ? 'On screen' : "Lala's phone"}</span>
        <span className="esp-moment-what">{what}</span>
        {shown?.kind === 'icon' && (shown.opens || shown.on) && (
          <span className="esp-moment-opens" data-testid="script-moment-opens">
            {shown.on ? `On ${shown.on}` : ''}{shown.on && shown.opens ? ' · ' : ''}{shown.opens ? `Opens ${shown.opens}` : ''}
          </span>
        )}
        {!shown && <span className="esp-moment-missing">No icon, screen or overlay by this name yet</span>}
        {phoneDown && <span className="esp-moment-missing" data-testid="script-moment-phone-down">{isCutsceneBeat(beatNumber) ? CUTSCENE_NO_PHONE : <>Lala&apos;s phone isn&apos;t on screen here. Bring it up first: Phone / overlay, The phone itself.</>}</span>}
        {alongside.length > 0 && <span className="esp-moment-with" data-testid="script-moment-with">With: {alongside.join(', ')}</span>}
      </span>
    </div>
  );
}

// Add a moment to a beat: a Lala's Phone screen or one of the episode's
// overlays, from their pictures, and what happens with it. The line goes at
// the end of the beat; it moves like any line, and Save keeps it.
// A line as the picker's "Put it after" names it.
function lineLabel(line, on) {
  const p = parseLine(line);
  if (!p || p.hidden) return null;
  const shown = p.type === 'moment' ? resolveMoment(p, on) : null;
  const text = p.type === 'moment' ? (shown && ['notify', 'dm', 'post'].includes(shown.kind) ? `${shown.name}: ${shown.text}` : `${shown?.kind === 'icon' ? 'Taps' : verbLabel(p.verb)} ${shown?.name || p.target}`)
    : p.type === 'dialogue' ? `${p.speaker}: ${p.text}` : p.text;
  return text.length > 48 ? `${text.slice(0, 47)}…` : text;
}

// preset (Task #2884): { verb, title } from an "Add:" chip. A phone screen
// picked gets that verb ("Scroll the feed": SCROLL), and a screen whose name
// says feed is picked to start with.
function MomentPicker({ screens, icons = [], overlays, look = [], production = [], lines = [], onScreen, phoneFrame = null, onAdd, onClose, preset = null }) {
  const presetScreen = preset?.feed ? screens.find((s) => /feed/i.test(s.name || s.id)) : null;
  const [picked, setPicked] = useState(presetScreen ? { kind: 'phone', key: presetScreen.id, name: presetScreen.name || presetScreen.id, url: presetScreen.url || null } : null);
  // Where it goes: after a line of the beat, or at the end (Task #2793).
  const [after, setAfter] = useState('end');
  const [added, setAdded] = useState(null);
  const verbs = picked?.kind === 'overlay' ? OVERLAY_VERBS : picked?.kind === 'device' ? DEVICE_VERBS : PHONE_VERBS;
  const [verb, setVerb] = useState(preset?.verb || 'OPEN');
  const iconByKey = new Map(icons.map((i) => [i.key, i]));
  // An icon two taps in is the taps that reach it, in order (Task #2801).
  const tapsTo = (icon) => (icon?.path || [icon?.key]).map((k) => iconByKey.get(k)).filter(Boolean);
  const pickedLabel = picked?.kind === 'device' ? `${PHONE_NAME}: ${deviceLabel(verb).toLowerCase()}`
    : picked?.kind === 'icon' ? `Taps ${tapsTo(picked.icon).map((i) => i.name).join(' → ')}`
      : picked ? `${verbLabel(verb)} ${picked.name}` : '';
  const pick = (item) => { setPicked(item); setVerb(item.kind === 'overlay' ? 'DISPLAY' : item.kind === 'device' ? 'SHOW' : item.kind === 'icon' ? 'CLICK' : (preset?.verb || 'OPEN')); };
  const tile = (item) => (
    <button key={`${item.kind}:${item.key}`} type="button"
      className={`esp-pick-tile${picked?.kind === item.kind && picked?.key === item.key ? ' is-picked' : ''}`}
      data-testid={`script-pick-${item.kind}-${item.key}`} onClick={() => pick(item)} aria-pressed={picked?.key === item.key && picked?.kind === item.kind}>
      <span className="esp-pick-img">{item.url ? <img src={item.url} alt="" loading="lazy" /> : (item.kind === 'overlay' ? <ImageIcon size={18} aria-hidden="true" /> : <Smartphone size={18} aria-hidden="true" />)}</span>
      <span className="esp-pick-name">{item.name}</span>
      {item.kind === 'icon' && item.icon.opensName && <span className="esp-pick-sub">→ {item.icon.opensName}</span>}
      {item.kind === 'icon' && item.icon.path.length > 1 && <span className="esp-pick-steps">{item.icon.path.length} taps</span>}
    </button>
  );
  // The phone itself first (Task #2797), then its icons, grouped by the
  // screen they sit on, the home screen's first (Task #2801). A screen no
  // icon opens can still be opened by name.
  const phoneItems = [{ kind: 'device', key: PHONE_KEY, name: 'The phone itself', url: phoneFrame || null }];
  const iconGroups = [];
  for (const icon of icons) {
    const title = icon.onName === 'Every screen' ? 'On every screen'
      : icon.path.length === 1 && icon.onName ? `On the home screen (${icon.onName})` : `Inside ${icon.onName || 'the phone'}`;
    let g = iconGroups.find((x) => x.title === title);
    if (!g) { g = { title, items: [] }; iconGroups.push(g); }
    g.items.push({ kind: 'icon', key: icon.key, name: icon.name, url: icon.url, icon });
  }
  const opened = new Set(icons.map((i) => i.opens).filter(Boolean));
  const screenItems = screens.filter((s) => !opened.has(s.id))
    .map((s) => ({ kind: 'phone', key: s.id, name: s.name || s.id, url: s.url || null }));
  const ownGroup = new Set([...look, ...production].map((o) => o.key));
  const asOverlay = (o) => ({ kind: 'overlay', key: o.key, name: o.label || o.key, url: o.image_url || null });
  const overlayItems = overlays.filter((o) => !ownGroup.has(o.key)).map(asOverlay);
  const lookItems = look.map(asOverlay);
  const productionItems = production.map(asOverlay);
  return (
    <div className="esp-picker" data-testid="script-moment-picker" onClick={(e) => e.stopPropagation()}
      // Escape closes it (Script page audit 3, 2026-10-19).
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } }}>
      <div className="esp-picker-head">
        <span className="esp-picker-title">{preset?.title || 'Add to this beat'}</span>
        <button type="button" className="esp-picker-close" aria-label="Close" onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </div>
      <p className="esp-picker-group">Lala&apos;s Phone</p>
      <div className="esp-pick-grid">{phoneItems.map(tile)}</div>
      {iconGroups.map((g) => (
        <div key={g.title} data-testid="script-pick-icon-group">
          <p className="esp-picker-sub">{g.title}</p>
          <div className="esp-pick-grid is-icons">{g.items.map(tile)}</div>
        </div>
      ))}
      {screenItems.length > 0 && (
        <>
          <p className="esp-picker-sub">{icons.length ? 'Screens no icon opens' : 'Screens'}</p>
          <div className="esp-pick-grid">{screenItems.map(tile)}</div>
        </>
      )}
      {!screens.length && <p className="esp-picker-empty">No phone screens yet. Make them in Lala&apos;s Phone.</p>}
      {screens.length > 0 && !icons.length && <p className="esp-picker-empty">No icons on the phone yet. Place them on the home screen in Lala&apos;s Phone, and the script can tap them.</p>}
      <p className="esp-picker-group">Overlays</p>
      {overlayItems.length ? <div className="esp-pick-grid">{overlayItems.map(tile)}</div> : <p className="esp-picker-empty">No overlays for this episode yet.</p>}
      <p className="esp-picker-group">Lala&apos;s look</p>
      {lookItems.length ? <div className="esp-pick-grid">{lookItems.map(tile)}</div> : <p className="esp-picker-empty">No wardrobe pieces approved for this episode yet. Lock the look on the Wardrobe tab.</p>}
      <p className="esp-picker-group">Production overlays</p>
      {productionItems.length ? <div className="esp-pick-grid">{productionItems.map(tile)}</div> : <p className="esp-picker-empty">No production overlays yet. Make them in the show&apos;s Overlays.</p>}
      {picked && (
        <div className="esp-picker-do">
          {picked.kind !== 'icon' && <span className="esp-picker-verbs" role="group" aria-label="What happens">
            {verbs.map((v) => (
              <button key={v.verb} type="button" className={`esp-verb${verb === v.verb ? ' is-on' : ''}`} aria-pressed={verb === v.verb} onClick={() => setVerb(v.verb)}>{v.label}</button>
            ))}
          </span>}
          {picked.kind === 'icon' && tapsTo(picked.icon).length > 1 && (
            <span className="esp-picker-taps" data-testid="script-moment-taps">
              {tapsTo(picked.icon).map((i, n) => `${n + 1}. ${i.name}${i.opensName ? ` (opens ${i.opensName})` : ''}`).join('  ')}
            </span>
          )}
          <label className="esp-picker-where">
            <span>Put it after</span>
            <select data-testid="script-moment-where" value={after} onChange={(e) => setAfter(e.target.value)}>
              {lines.map((l, i) => { const label = lineLabel(l, onScreen); return label ? <option key={i} value={String(i)}>{label}</option> : null; })}
              <option value="end">The end of the beat</option>
            </select>
          </label>
          <button type="button" className="esp-btn-primary is-small" data-testid="script-moment-add" onClick={() => {
            const at = after === 'end' ? null : Number(after);
            const written = picked.kind === 'icon' ? tapsTo(picked.icon).map((i) => momentLine('CLICK', i.key)) : [momentLine(verb, picked.key)];
            if (onAdd(written.join('\n'), at) === false) return;
            setAdded(pickedLabel);
            // The next one goes after this one.
            if (at !== null) setAfter(String(at + written.length));
          }}>
            Add &ldquo;{pickedLabel}&rdquo;
          </button>
        </div>
      )}
      <div className="esp-picker-foot">
        {added && <span className="esp-picker-added" role="status" data-testid="script-moment-added">Added: {added}</span>}
        <button type="button" className="esp-btn is-small" data-testid="script-moment-done" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

// Who a new line is for, and how it is written (the script's own shapes:
// "Lala: …", "Me: …" for Prime, "(…)" for an action, plain narration).
const LINE_KINDS = [
  { key: 'Lala', label: 'Lala', write: (t) => `Lala: ${t}` },
  { key: 'Prime', label: 'Prime', write: (t) => `Me: ${t}` },
  { key: 'Kelli', label: 'Kelli', write: (t) => `Kelli: ${t}` },
  { key: 'Guest', label: 'Guest', write: (t) => `Guest: ${t}` },
  { key: 'action', label: 'Action', write: (t) => (/^\(.*\)$/.test(t) ? t : `(${t.replace(/^\(|\)$/g, '')})`) },
  { key: 'narration', label: 'Narration', write: (t) => t },
];

// Add a line anywhere in a beat (Evoni, 2026-10-09; Task #2795): who it is
// for, the words, and where it goes. It stays open for the next line, which
// goes after this one; Save keeps them.
function LineAdder({ lines = [], onScreen, onAdd, onClose, initialKind = 'Lala' }) {
  const [kind, setKind] = useState(initialKind);
  const [text, setText] = useState('');
  const [after, setAfter] = useState('end');
  const [added, setAdded] = useState(0);
  const textRef = useRef(null);
  const words = text.trim().replace(/\s+/g, ' ');
  const add = () => {
    if (!words) return;
    const at = after === 'end' ? null : Number(after);
    if (onAdd(LINE_KINDS.find((k) => k.key === kind).write(words), at) === false) return;
    // Add goes disabled once the words clear, so focus goes back to the
    // words for the next line (Script page audit 3, 2026-10-19: it fell to the page).
    textRef.current?.focus();
    setText('');
    setAdded((n) => n + 1);
    if (at !== null) setAfter(String(at + 1));
  };
  return (
    <div className="esp-picker esp-adder" data-testid="script-line-adder" onClick={(e) => e.stopPropagation()}
      // Escape closes it (Script page audit 3, 2026-10-19).
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } }}>
      <div className="esp-picker-head">
        <span className="esp-picker-title">Add a line</span>
        <button type="button" className="esp-picker-close" aria-label="Close" onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </div>
      <span className="esp-picker-verbs" role="group" aria-label="Who">
        {LINE_KINDS.map((k) => (
          <button key={k.key} type="button" className={`esp-verb${kind === k.key ? ' is-on' : ''}`} aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</button>
        ))}
      </span>
      <textarea ref={textRef} className="esp-line-input esp-adder-text" data-testid="script-line-adder-text" aria-label="The line" rows={3} value={text}
        placeholder={kind === 'action' ? 'What happens' : kind === 'narration' ? 'Narration' : `What ${LINE_KINDS.find((k) => k.key === kind).label} says`}
        onChange={(e) => setText(e.target.value)} />
      <div className="esp-picker-do">
        <label className="esp-picker-where">
          <span>Put it after</span>
          <select data-testid="script-line-adder-where" value={after} onChange={(e) => setAfter(e.target.value)}>
            {lines.map((l, i) => { const label = lineLabel(l, onScreen); return label ? <option key={i} value={String(i)}>{label}</option> : null; })}
            <option value="end">The end of the beat</option>
          </select>
        </label>
        <button type="button" className="esp-btn-primary is-small" data-testid="script-line-adder-add" disabled={!words} onClick={add}>Add line</button>
      </div>
      <div className="esp-picker-foot">
        {added > 0 && <span className="esp-picker-added" role="status">{added === 1 ? 'Line added' : `${added} lines added`}</span>}
        <button type="button" className="esp-btn is-small" data-testid="script-line-adder-done" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

// A notification, a DM or a post for this beat (Task #2885). Who it is from
// or with is typed or picked from the episode's own people (`people`: the
// event's host and guests, who speaks in the script); a post is Lala's.
const MESSAGE_KINDS = {
  notify: { title: 'Add a notification', who: 'From', placeholder: 'What the notification says' },
  dm: { title: 'Add a DM', who: 'With', placeholder: 'What the message says' },
  post: { title: 'Add a post', who: null, placeholder: 'What Lala posts' },
};
function MessageAdder({ kind, people = [], lines = [], onScreen, onAdd, onClose }) {
  const info = MESSAGE_KINDS[kind];
  const [who, setWho] = useState('');
  const [text, setText] = useState('');
  const [after, setAfter] = useState('end');
  const [added, setAdded] = useState(0);
  const line = messageLine(kind, info.who ? who : null, text);
  const listId = `esp-people-${kind}`;
  const textRef = useRef(null);
  const add = () => {
    if (!line) return;
    const at = after === 'end' ? null : Number(after);
    if (onAdd(line, at) === false) return;
    // As the line adder's (Script page audit 3, 2026-10-19).
    textRef.current?.focus();
    setText('');
    setAdded((n) => n + 1);
    if (at !== null) setAfter(String(at + 1));
  };
  return (
    <div className="esp-picker esp-adder" data-testid={`script-message-adder-${kind}`} onClick={(e) => e.stopPropagation()}
      // Escape closes it (Script page audit 3, 2026-10-19).
      onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(); } }}>
      <div className="esp-picker-head">
        <span className="esp-picker-title">{info.title}</span>
        <button type="button" className="esp-picker-close" aria-label="Close" onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </div>
      {info.who && (
        <label className="esp-picker-where">
          <span>{info.who}</span>
          <input type="text" list={listId} value={who} onChange={(e) => setWho(e.target.value)} data-testid="script-message-who" aria-label={info.who} />
          <datalist id={listId}>{people.map((p) => <option key={p} value={p} />)}</datalist>
        </label>
      )}
      <textarea ref={textRef} className="esp-line-input esp-adder-text" data-testid="script-message-text" aria-label="The words" rows={3} value={text}
        placeholder={info.placeholder} onChange={(e) => setText(e.target.value)} />
      {kind === 'post' && <p className="esp-picker-empty">Saving the script drafts this post in Lala&apos;s posts; it goes live when you approve it there (Requests).</p>}
      <div className="esp-picker-do">
        <label className="esp-picker-where">
          <span>Put it after</span>
          <select data-testid="script-message-where" value={after} onChange={(e) => setAfter(e.target.value)}>
            {lines.map((l, i) => { const label = lineLabel(l, onScreen); return label ? <option key={i} value={String(i)}>{label}</option> : null; })}
            <option value="end">The end of the beat</option>
          </select>
        </label>
        <button type="button" className="esp-btn-primary is-small" data-testid="script-message-add" disabled={!line} onClick={add}>Add</button>
      </div>
      <div className="esp-picker-foot">
        {added > 0 && <span className="esp-picker-added" role="status">{added === 1 ? 'Added' : `${added} added`}</span>}
        <button type="button" className="esp-btn is-small" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

// request: { kind: 'line' | 'phone', n } from the phone's bottom bar (Task
// #2881), opening this beat's line adder or phone picker as its own buttons do.
// Lala's line after a piece she puts on (Task 3190; Evoni, 2026-10-14, phone
// phase 3 ruling 5): a draft from a free template (lib/lalaLineDraft), shown
// under the cue; Insert writes it after the cue for Evoni to edit. Nothing
// is written without her click. The later AI draft goes behind its own
// button here (onAiDraft), under the daily cap; nothing passes it yet.
function LalaLineSlot({ piece, dressCode = '', onInsert, onAiDraft = null }) {
  const draft = draftLine(piece, { dressCode });
  return (
    <div className="esp-lala-slot" data-testid="script-lala-slot">
      <span className="esp-lala-slot-label">Add Lala&apos;s line</span>
      <span className="esp-lala-slot-draft" data-testid="script-lala-draft">&ldquo;{draft}&rdquo;</span>
      <span className="esp-lala-slot-actions">
        <button type="button" className="esp-btn-primary is-small" data-testid="script-lala-insert" onClick={() => onInsert(lalaLine(draft))}>Insert</button>
        {onAiDraft && <button type="button" className="esp-btn is-small" onClick={() => onAiDraft(piece)}>Draft with AI</button>}
      </span>
    </div>
  );
}

// A rewrite or a regenerated beat before it goes in (Script tab audit,
// 2026-10-15): the new words beside what they replace, "Use it" or "Keep mine".
function ProposalCard({ proposal, onAccept, onDiscard }) {
  const shown = (line) => { const p = parseLine(line); return !p || p.hidden ? null : p.type === 'dialogue' ? `${p.speaker}: ${p.text}` : p.text; };
  const lines = proposal.kind === 'beat'
    ? proposal.text.split('\n').slice(1).map(shown).filter(Boolean)
    : [shown(proposal.text) || proposal.text];
  return (
    <div className="esp-proposal" role="region" aria-label={proposal.kind === 'beat' ? `New version of beat ${proposal.number}` : 'Rewritten line'} data-testid="script-proposal">
      <p className="esp-proposal-title">{proposal.kind === 'beat' ? `↻ New version of beat ${proposal.number}` : '✦ Rewritten line'}</p>
      {proposal.kind === 'line' && <p className="esp-proposal-was">Was: {shown(proposal.originalLine) || proposal.originalLine}</p>}
      <ul className="esp-proposal-lines">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <div className="esp-proposal-actions">
        <button type="button" className="esp-btn-primary is-small" data-testid="script-proposal-accept" onClick={(e) => { e.stopPropagation(); onAccept(); }}>Use it</button>
        <button type="button" className="esp-btn is-small" data-testid="script-proposal-discard" onClick={(e) => { e.stopPropagation(); onDiscard(); }}>Keep mine</button>
      </div>
    </div>
  );
}

// Each line's identity in its beat (Script page re-audit, 2026-10-19): keyed
// by its words, a line added above an open editor, or deleted before it,
// with the same words moved the editor onto another line or closed it, and
// what was typed went to the wrong line or was lost. Ids are carried from the
// lines before to the lines now: by the change the page just made (`op`, a
// splice or a move) when it describes the change exactly, else by the
// longest run of lines kept in order. A line with no match gets a new id.
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
export function nextLineIds(prev, prevIds, next, op, newId) {
  if (op?.kind === 'move') {
    const ids = prevIds.slice();
    const lines = prev.slice();
    if (op.from >= 0 && op.from < lines.length && op.to >= 0 && op.to < lines.length) {
      const [l] = lines.splice(op.from, 1); lines.splice(op.to, 0, l);
      const [i] = ids.splice(op.from, 1); ids.splice(op.to, 0, i);
      if (sameList(lines, next)) return ids;
    }
  } else if (op?.kind === 'splice') {
    const added = next.length - prev.length + op.removed;
    const tail = prev.length - op.at - op.removed;
    if (op.at >= 0 && added >= 0 && tail >= 0
      && sameList(prev.slice(0, op.at), next.slice(0, op.at))
      && sameList(prev.slice(op.at + op.removed), next.slice(op.at + added))) {
      return [...prevIds.slice(0, op.at), ...next.slice(op.at, op.at + added).map(() => newId()), ...prevIds.slice(op.at + op.removed)];
    }
  }
  // The longest common run, earliest lines matched first.
  const n = prev.length; const m = next.length;
  const len = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      len[i][j] = prev[i] === next[j] ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1]);
    }
  }
  const ids = new Array(m).fill(null);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (prev[i] === next[j] && len[i][j] === len[i + 1][j + 1] + 1) { ids[j] = prevIds[i]; i += 1; j += 1; }
    else if (len[i + 1][j] >= len[i][j + 1]) i += 1;
    else j += 1;
  }
  return ids.map((id) => id ?? newId());
}
let lineSeq = 0;
const newLineId = () => { lineSeq += 1; return `line-${lineSeq}`; };
// The ids of a beat's lines, carried across each change (nextLineIds).
// `opRef.current`: { n, beatId, kind, … }, the last change the page made.
function useLineIds(beatId, lines, opRef) {
  const held = useRef(null);
  if (!held.current) held.current = { lines, ids: lines.map(newLineId), opN: opRef?.current?.n ?? null };
  else if (!sameList(held.current.lines, lines)) {
    const op = opRef?.current;
    const fresh = op && op.beatId === beatId && op.n !== held.current.opN ? op : null;
    held.current = { lines, ids: nextLineIds(held.current.lines, held.current.ids, lines, fresh, newLineId), opN: op?.n ?? held.current.opN };
  }
  return held.current.ids;
}

function BeatSection({ beat, index, beatCount, scenePlan, expanded, onToggle, onApprove, proposal = null, onAcceptProposal, onDiscardProposal, onEdit, onDeleteLine, onRewrite, rewritingLine, locking, onOpenMap, onMoveBeat, onMoveLine, drag, onRegenerate, regenerating, writing = false, onScreen, onAddMoment, phoneUpAtStart = false, request = null, onRequestDone, people = [], lalaSlots = [], dressCode = '', lineOpRef = null, lineIdsRef = null, onOpenEdit = null, onFocusLater = null }) {
  const scene = scenePlan?.find(p => p.beat_number === beat.number);
  const cardRef = useRef(null);
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [messaging, setMessaging] = useState(null);
  const [zoomed, setZoomed] = useState(false);
  // Each bottom-bar tap acts once: collapsing and reopening the beat no
  // longer opens the adder again (Script tab audit, 2026-10-15).
  const handledRequest = useRef(null);
  // The adder or picker a bar tap opened, to be shown (Script page audit, 2026-10-19).
  const [reveal, setReveal] = useState(null);
  // An "Add:" chip shows its adder and focuses it as the bar does, and focus
  // goes back to the chip when the adder closes (Script page audit 3,
  // 2026-10-19: the adder opened above the chip, out of Tab's reach).
  const chipRef = useRef(null);
  const openFromChip = (e) => { chipRef.current = e.currentTarget; setReveal({ n: Date.now() }); };
  const closeAdder = (close) => {
    close();
    const back = chipRef.current?.isConnected ? chipRef.current : cardRef.current?.querySelector(`[data-testid="script-add-line-${beat.number}"]`);
    chipRef.current = null;
    if (back) setTimeout(() => back.focus(), 0);
  };
  // Ask for a change (Script tab audit, 2026-10-15): words for Regenerate beat.
  const [ask, setAsk] = useState('');
  // One beat is written at a time, and none while a new script is: Regenerate
  // and Ask wait (Script tab re-audit, 2026-10-15: Ask cleared the words and
  // sent nothing).
  const cantWrite = regenerating || writing || locking;
  const cutsceneBeat = isCutsceneBeat(beat.number);
  // The words are cleared only once a new version came back, and only if they
  // weren't changed meanwhile (Script page audit, 2026-10-19: a failed
  // request lost them).
  const askChange = async () => {
    const words = ask.trim();
    if (!words || cantWrite) return;
    if (await onRegenerate(beat.id, words)) setAsk((now) => (now.trim() === words ? '' : now));
  };
  useEffect(() => {
    if (!request || !expanded || beat.approved || handledRequest.current === request.n) return;
    handledRequest.current = request.n;
    // The kind asked for, already open, is shown as it is, with what was
    // typed (Script page re-audit, 2026-10-19: Line over an open Action adder
    // replaced it and lost the words); otherwise it opens in place of the other.
    const alreadyOpen = request.kind === 'line' ? !!adding : !!picking;
    if (!alreadyOpen) {
      setMessaging(null);
      setAdding(request.kind === 'line' ? 'Lala' : false);
      setPicking(request.kind === 'phone' && !isCutsceneBeat(beat.number) ? {} : false);
    }
    // Answered, so a remount (Raw editor and back) doesn't open it again.
    onRequestDone?.();
    setReveal({ n: request.n });
  }, [request, expanded, beat.approved, beat.number, onRequestDone, adding, picking]);
  // The adder opens at the end of the beat, often below the screen: it is
  // scrolled to the middle and its first control takes focus, so the bar's
  // tap shows where it went (Script page audit, 2026-10-19).
  useEffect(() => {
    if (!reveal) return;
    // Whichever adder or picker is open (one at a time).
    const box = cardRef.current?.querySelector('.esp-picker');
    if (!box) return;
    box.scrollIntoView?.({ block: 'center' });
    (box.querySelector('textarea, input, .esp-pick-tile') || box.querySelector('button'))?.focus({ preventScroll: true });
  }, [reveal]);
  // The scene picture, larger: Escape closes it; focus goes to its Close and back.
  const zoomCloseRef = useRef(null);
  useDialogKeys(zoomed && !!scene?.image, () => setZoomed(false), zoomCloseRef);
  const picture = scene?.image || null;
  const expects = EXPECTED_ON_SCREEN[beat.number] || null;
  // The lines the beat shows, by their place in the beat (hidden tags left out).
  const shownLines = beat.lines.map((l, i) => { const p = parseLine(l); return p && !p.hidden ? i : -1; }).filter((i) => i >= 0);
  // What is on screen through the beat, line by line, and everything it uses (Task #2793).
  const { withByLine, used: usedHere, phoneDownAt } = beatOnScreen(beat.lines, onScreen, { phoneUp: phoneUpAtStart, cutscene: isCutsceneBeat(beat.number) });
  // The phone carries in from an earlier beat (Task #2797): it builds this scene too.
  const used = phoneUpAtStart
    ? [{ name: PHONE_NAME, kind: 'device', url: onScreen.phoneFrame || null }, ...usedHere.filter((u) => u.kind !== 'device')] : usedHere;
  const [dropAt, setDropAt] = useState(null);
  const visibleLines = beat.lines.filter(l => { const p = parseLine(l); return p && !p.hidden && p.type !== 'cue'; }).length;
  // A line is keyed by its own id, not its place (Script page audit,
  // 2026-10-19) nor its words (re-audit: identical lines swapped keys).
  const lineKeys = useLineIds(beat.id, beat.lines, lineOpRef);
  // The tab finds a rewritten line again by its id, not its words (Script
  // page audit 3, 2026-10-19: of two same lines, the first was rewritten).
  useLayoutEffect(() => {
    if (!lineIdsRef) return undefined;
    const ids = lineIdsRef.current;
    ids[beat.id] = lineKeys;
    return () => { if (ids[beat.id] === lineKeys) delete ids[beat.id]; };
  });
  return (
    <div
      ref={cardRef}
      data-testid={`script-beat-${beat.number}`}
      data-beat-id={beat.id}
      data-locked={beat.approved ? 'true' : 'false'}
      className={`esp-beat${beat.approved ? ' is-locked' : ''}${expanded ? ' is-open' : ''}${dropAt ? ` esp-drop-${dropAt}` : ''}`}
      style={{ '--beat-color': beat.color }}
      onDragOver={(e) => { if (drag.current()?.kind !== 'beat') return; e.preventDefault(); setDropAt(drag.half(e)); }}
      onDragLeave={() => setDropAt(null)}
      onDrop={(e) => { const d = drag.current(); setDropAt(null); if (d?.kind !== 'beat') return; e.preventDefault(); onMoveBeat(d.from, dropIndex(d.from, index, drag.half(e) === 'after')); drag.end(); }}
    >
      <div
        className="esp-beat-head"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onToggle(); } }}
      >
        {beat.approved
          ? <span className="esp-grip is-locked" aria-hidden="true" />
          : (
            <span
              className="esp-grip"
              data-testid={`script-drag-${beat.number}`}
              draggable
              title="Drag to move this beat. It keeps its number and name."
              onClick={e => e.stopPropagation()}
              onDragStart={(e) => { if (cardRef.current) e.dataTransfer?.setDragImage?.(cardRef.current, 24, 24); drag.start(e, { kind: 'beat', from: index }); }}
              onDragEnd={() => drag.end()}
            ><GripVertical size={16} aria-hidden="true" /></span>
          )}
        <span className="esp-beat-num" data-testid={`script-beat-label-${beat.number}`}>Beat {beat.number}</span>
        <div className="esp-beat-title">
          <div className="esp-beat-name-row">
            <span className="esp-beat-icon" aria-hidden="true">{beat.icon}</span>
            <span className="esp-beat-name">{beat.name}</span>
            {beat.approved && <span className="esp-chip-approved" title="Approved beats are locked: they can't be edited, and Regenerate keeps them as they are.">🔒 APPROVED</span>}
          </div>
        </div>
        {picture && <span className="esp-beat-thumb" aria-hidden="true"><img src={picture} alt="" loading="lazy" /></span>}
        <span className="esp-beat-count">{visibleLines} line{visibleLines === 1 ? '' : 's'}<span className="esp-beat-runtime" data-testid={`script-beat-runtime-${beat.number}`} title="Rough length: words at 150 a minute, a few seconds per action or moment">{formatRuntime(beatSeconds(beat.lines))}</span></span>
        <span className="esp-beat-chev" aria-hidden="true">▼</span>
      </div>
      {/* The scene's map link sits under the head, not inside its
          role="button" (Script page audit, 2026-10-19). */}
      {scene?.scene_set_name && <button type="button" className="esp-beat-scene" onClick={(e) => { e.stopPropagation(); onOpenMap(); }} title="Open DREAM Map">📍 {scene.scene_set_name}{scene?.angle_label ? ` · ${scene.angle_label}` : ''}</button>}
      {expanded && (
        <div className="esp-beat-body">
          {proposal && <ProposalCard proposal={proposal} onAccept={onAcceptProposal} onDiscard={onDiscardProposal} />}
          {/* The scene this beat plays in (Task #2789), the picture the Scenes tab shows. */}
          {picture ? (
            <button type="button" className="esp-beat-picture" data-testid={`script-picture-${beat.number}`} onClick={(e) => { e.stopPropagation(); setZoomed(true); }} aria-label="See the scene larger">
              <img src={picture} alt={scene?.image_label || scene?.scene_set_name || 'The scene'} loading="lazy" />
              {(scene?.image_label || scene?.scene_set_name) && <span className="esp-beat-picture-label">{scene.image_label || scene.scene_set_name}</span>}
            </button>
          ) : (
            <p className="esp-beat-nopicture" data-testid={`script-nopicture-${beat.number}`}>No picture for this beat yet · <Link className="esp-link" to="?tab=beatplan" onClick={(e) => e.stopPropagation()}>Open Beat Plan</Link></p>
          )}
          {used.length > 0 && (
            <div className="esp-build" data-testid={`script-build-${beat.number}`}>
              <span className="esp-build-title">Builds the scene</span>
              <span className="esp-build-strip">
                {picture && <span className="esp-build-item is-scene"><img src={picture} alt="" loading="lazy" /><span>Scene</span></span>}
                {used.map((u) => (
                  <span key={u.name} className={`esp-build-item is-${u.kind}`}>
                    {u.url ? <img src={u.url} alt="" loading="lazy" /> : (u.kind === 'phone' || u.kind === 'device' ? <Smartphone size={16} aria-hidden="true" /> : <ImageIcon size={16} aria-hidden="true" />)}
                    <span>{u.name}</span>
                  </span>
                ))}
              </span>
            </div>
          )}
          {expects && (
            <p className="esp-beat-expects" data-testid={`script-expects-${beat.number}`}>
              <Smartphone size={13} aria-hidden="true" /> On screen: {expects.what}{expects.where ? ` · ${expects.where}` : ''}
            </p>
          )}
          {scene?.scene_context && <div className="esp-beat-context">🎬 {scene.scene_context.slice(0, 200)}{scene.scene_context.length > 200 ? '...' : ''}</div>}
          {scene?.emotional_intent && <div className="esp-beat-intent">✦ {scene.emotional_intent}</div>}
          <div className="esp-lines">{beat.lines.map((line, i) => {
            const slot = beat.approved ? null : lalaSlots.find((s) => s.lineIndex === i);
            const at = shownLines.indexOf(i);
            return (
              <Fragment key={lineKeys[i]}>
                <ScriptLine line={line} beatId={beat.id} lineId={lineKeys[i]} onOpenEdit={onOpenEdit} onFocusLater={onFocusLater} lineIndex={i} prevLine={at > 0 ? shownLines[at - 1] : null} nextLine={at >= 0 && at < shownLines.length - 1 ? shownLines[at + 1] : null} onEdit={onEdit} onDelete={onDeleteLine} onRewrite={onRewrite} rewriting={rewritingLine === `${beat.id}-${lineKeys[i]}`} locked={beat.approved} onMoveLine={onMoveLine} drag={drag} onScreen={onScreen} withOnScreen={withByLine[i]} phoneDown={phoneDownAt.includes(i)} beatNumber={beat.number} />
                {slot && <LalaLineSlot piece={slot.piece} dressCode={dressCode} onInsert={(text) => onAddMoment(beat.id, text, i)} />}
              </Fragment>
            );
          })}</div>
          {adding && !beat.approved && (
            <LineAdder key={`adder-${adding}`} initialKind={typeof adding === 'string' ? adding : 'Lala'} lines={beat.lines} onScreen={onScreen} onClose={() => closeAdder(() => setAdding(false))}
              onAdd={(line, after) => onAddMoment(beat.id, line, after)} />
          )}
          {messaging && !beat.approved && (
            <MessageAdder key={`message-${messaging}`} kind={messaging} people={people} lines={beat.lines} onScreen={onScreen}
              onClose={() => closeAdder(() => setMessaging(null))} onAdd={(line, after) => onAddMoment(beat.id, line, after)} />
          )}
          {picking && !beat.approved && (
            <MomentPicker key={`picker-${picking?.verb || 'open'}`} preset={picking?.verb ? picking : null} screens={onScreen.screens} icons={onScreen.icons} overlays={onScreen.overlays} look={onScreen.look} production={onScreen.production} lines={beat.lines} onScreen={onScreen} phoneFrame={onScreen.phoneFrame}
              onClose={() => closeAdder(() => setPicking(false))}
              onAdd={(line, after) => onAddMoment(beat.id, line, after)} />
          )}
          <div className="esp-beat-foot">
            {beat.approved && <span className="esp-beat-locked-note">Locked: unlock to edit it, move it, or let Regenerate rewrite it.</span>}
            {!beat.approved && (
              <span className="esp-move">
                <button type="button" className="esp-move-btn" aria-label="Move beat up" data-testid={`script-beat-up-${beat.number}`} disabled={index === 0 || locking} onClick={e => { e.stopPropagation(); onMoveBeat(index, index - 1); }}><ArrowUp size={14} aria-hidden="true" /> Up</button>
                <button type="button" className="esp-move-btn" aria-label="Move beat down" data-testid={`script-beat-down-${beat.number}`} disabled={index >= beatCount - 1 || locking} onClick={e => { e.stopPropagation(); onMoveBeat(index, index + 1); }}><ArrowDown size={14} aria-hidden="true" /> Down</button>
              </span>
            )}
            {/* "Add:" (Task #2884): one tap to each kind the parser knows. */}
            {!beat.approved && (
              <span className="esp-add-chips" role="group" aria-label="Add" data-testid={`script-add-chips-${beat.number}`}>
                <span className="esp-add-label">Add:</span>
                <button type="button" className="esp-moment-btn" data-testid={`script-add-action-${beat.number}`} onClick={e => { e.stopPropagation(); openFromChip(e); setPicking(false); setMessaging(null); setAdding('action'); }}>Action</button>
                <button type="button" className="esp-moment-btn" data-testid={`script-add-line-${beat.number}`} onClick={e => { e.stopPropagation(); openFromChip(e); setPicking(false); setMessaging(null); setAdding('Lala'); }}>Dialogue</button>
                {/* No phone in the cutscene, beats 11–13 (Script page re-audit,
                    2026-10-19): its chips are not offered there, and it says why. */}
                {cutsceneBeat && <span className="esp-beat-nophone" data-testid={`script-cutscene-note-${beat.number}`}>{CUTSCENE_NO_PHONE}</span>}
                {!cutsceneBeat && <button type="button" className="esp-moment-btn" data-testid={`script-add-moment-${beat.number}`} onClick={e => { e.stopPropagation(); openFromChip(e); setAdding(false); setMessaging(null); setPicking({}); }}>Open a screen</button>}
                {!cutsceneBeat && <button type="button" className="esp-moment-btn" data-testid={`script-add-scroll-${beat.number}`} onClick={e => { e.stopPropagation(); openFromChip(e); setAdding(false); setMessaging(null); setPicking({ verb: 'SCROLL', title: 'Scroll the feed', feed: true }); }}>Scroll the feed</button>}
                {/* Task #2885: a notification, a DM or a post. */}
                {!cutsceneBeat && Object.keys(MESSAGE_KINDS).map((k) => (
                  <button key={k} type="button" className="esp-moment-btn" data-testid={`script-add-${k}-${beat.number}`}
                    onClick={e => { e.stopPropagation(); openFromChip(e); setAdding(false); setPicking(false); setMessaging(k); }}>
                    {k === 'notify' ? 'Notification' : k === 'dm' ? 'DM' : 'Post'}
                  </button>
                ))}
              </span>
            )}
            {!beat.approved && <button type="button" className="esp-regen-btn" data-testid={`script-regen-beat-${beat.number}`} disabled={cantWrite} onClick={e => { e.stopPropagation(); onRegenerate(beat.id); }}>{regenerating ? '⏳ Writing…' : '↻ Regenerate beat'}</button>}
            {!beat.approved && (
              <span className="esp-ask" data-testid={`script-ask-${beat.number}`}>
                <input type="text" className="esp-ask-input" data-testid={`script-ask-input-${beat.number}`} value={ask} maxLength={300}
                  placeholder="Ask for a change: punchier, more Lala, add a closet moment…" aria-label={`Ask for a change to beat ${beat.number}`}
                  onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); askChange(); } }} />
                <button type="button" className="esp-regen-btn" data-testid={`script-ask-send-${beat.number}`} disabled={cantWrite || !ask.trim()} onClick={(e) => { e.stopPropagation(); askChange(); }}>Ask</button>
              </span>
            )}
            <button type="button" className={`esp-lock-btn${beat.approved ? ' is-locked' : ''}`} data-testid={`script-lock-${beat.number}`} aria-disabled={locking || undefined} onClick={e => { e.stopPropagation(); if (locking) return; onApprove(beat.id); }}>{beat.approved ? 'Unlock' : '✓ Approve & lock'}</button>
          </div>
        </div>
      )}
      {zoomed && picture && (
        <div className="esp-zoom" role="dialog" aria-modal="true" aria-label="The scene" data-testid="script-picture-zoom" onClick={(e) => { e.stopPropagation(); setZoomed(false); }}>
          <img src={picture} alt={scene?.image_label || scene?.scene_set_name || 'The scene'} />
          <button type="button" ref={zoomCloseRef} className="esp-zoom-close" aria-label="Close" onClick={(e) => { e.stopPropagation(); setZoomed(false); }}><X size={20} aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}

export default function EpisodeScriptTab({ episode, show, onSaved, onDirtyChange }) {
  const episodeId = episode?.id;
  const showId = show?.id || episode?.show_id;
  const [scriptText, setScriptText] = useState(episode?.script_content || '');
  // The script as last saved, so locking knows whether the page has edits
  // to save with the lock.
  const [savedScript, setSavedScript] = useState(episode?.script_content || '');
  const [lockedBeats, setLockedBeats] = useState(() => (Array.isArray(episode?.script_locked_beats) ? episode.script_locked_beats : []));
  const [locking, setLocking] = useState(false);
  // Unsaved edits kept in this browser, offered back when the tab opens.
  const draft = useScriptDraft({ episodeId, scriptText, savedScript });
  const [beats, setBeats] = useState([]);
  // undefined: nothing chosen yet, so the first beat is open.
  const [expandedBeat, setExpandedBeat] = useState(undefined);
  const [scenePlan, setScenePlan] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rewritingLine, setRewritingLine] = useState(null);
  // A rewrite or regenerated beat waiting for "Use it" / "Keep mine".
  const [proposal, setProposal] = useState(null);
  const [regeneratingBeat, setRegeneratingBeat] = useState(null);
  // Regenerate outlasted its request: the page waits for the saved script.
  const [waitingForScript, setWaitingForScript] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  // The script as the page has it now, for a reply that lands after more edits.
  const scriptRef = useRef(scriptText);
  scriptRef.current = scriptText;
  const lockedRef = useRef(lockedBeats);
  lockedRef.current = lockedBeats;
  const savedRef = useRef(savedScript);
  savedRef.current = savedScript;
  // Bumped by each whole-script Regenerate: a rewrite asked for before it is
  // written against the script it replaced (re-audit 2, 2026-10-15).
  const genSeqRef = useRef(0);
  const [developerMode, setDeveloperMode] = useState(false);
  const [toast, setToast] = useState(null);
  const [generating, setGenerating] = useState(false);
  // While a new script is being written (or awaited), the page's script is
  // about to be replaced: edits, moves, locks and saves wait for it (Script
  // tab audit, 2026-10-15), so nothing done meanwhile is lost or mixed in.
  const busy = generating || waitingForScript;
  const [genError, setGenError] = useState(null);
  // What the writer covered after generating (utils/scriptCoverage.js): the
  // beats it rewrote to cover the episode, and what is still not covered.
  const [coverage, setCoverage] = useState(null);
  // Audit GATE-03 (2026-10-03): a script the server generated but could not
  // save. It lives here as a draft until Save keeps it; the reason is shown.
  const [unsaved, setUnsaved] = useState(null);
  const [showMap, setShowMap] = useState(false);
  // The DREAM Map closes on Escape, focus in and back (Script page audit, 2026-10-19).
  const mapCloseRef = useRef(null);
  useDialogKeys(showMap, () => setShowMap(false), mapCloseRef);
  const [mapLocations, setMapLocations] = useState([]);
  const [mapImageUrl, setMapImageUrl] = useState(null);
  // What the script will use (Evoni's Episode mock): the brief and the
  // brief's source event, as the Overview reads them.
  const [brief, setBrief] = useState(null);
  const [source, setSource] = useState(null);
  // The featured guests' profiles, so beat 11 names them as the writer does,
  // creator_name first (Script page audit 3, 2026-10-19).
  const [guestProfiles, setGuestProfiles] = useState([]);
  const guestKey = featuredGuestIds(source?.event).join(',');
  useEffect(() => {
    let live = true;
    Promise.all(guestKey.split(',').filter(Boolean).map((id) => api.get(`/api/v1/social-profiles/${id}`)
      .then((res) => res.data?.profile || null)
      .catch((err) => { console.error('[EpisodeScript] guest profile load failed:', err); return null; })))
      .then((list) => { if (live) setGuestProfiles(list.filter(Boolean)); });
    return () => { live = false; };
  }, [guestKey]);
  const [deliverables, setDeliverables] = useState([]);
  // Beat 14's opportunity (Evoni, 2026-10-19; Beat14Opportunity): null until
  // read; a read that fails or answers in another shape leaves it null, so
  // nothing is claimed about it.
  const [beat14, setBeat14] = useState(null);
  // A failed read says so in the side panel, not nothing (Script page audit,
  // 2026-10-19).
  const [beat14Failed, setBeat14Failed] = useState(false);
  const loadBeat14 = useCallback(async () => {
    if (!showId || !episodeId) return;
    try {
      const res = await api.get(`/api/v1/opportunities/${showId}/episode/${episodeId}/beat14`);
      const d = res?.data?.data;
      const ok = d && typeof d === 'object' && !Array.isArray(d) && 'opportunity' in d;
      if (!ok) console.error('[EpisodeScript] beat 14 opportunity answered in another shape:', d);
      setBeat14(ok ? d : null);
      setBeat14Failed(!ok);
    } catch (err) {
      console.error('[EpisodeScript] beat 14 opportunity load failed:', err);
      setBeat14(null);
      setBeat14Failed(true);
    }
  }, [showId, episodeId]);
  useEffect(() => { loadBeat14(); }, [loadBeat14]);
  // The outfit locked on the Wardrobe tab, which the script writer reads (null: could not be read).
  const [outfit, setOutfit] = useState([]);
  // What can be on screen in a beat (Task #2789): the episode's Lala's Phone
  // screens and its overlays, each with its picture.
  const [onScreen, setOnScreen] = useState({ screens: [], icons: [], overlays: [], look: [], production: [] });
  // The phone layout (Task #2881): Lala's coins for the context chips (null
  // until read, or when it could not be), the bottom bar's request to the
  // open beat, and whether the context panel is open. `balance` is the
  // balance before this episode (Task #2882).
  const [balance, setBalance] = useState(null);
  // Lala's money as the show's rules read it (lib/scriptRuleChecks; Evoni,
  // 2026-10-18): the look's costs and the event's, from the Money page's
  // lines (null: not read, so no coin rows).
  const [scriptMoney, setScriptMoney] = useState(null);
  useEffect(() => {
    if (!showId || !episodeId) { setScriptMoney(null); return undefined; }
    let cancelled = false;
    api.get(`/api/v1/world/${showId}/episodes/${episodeId}/money`)
      .then((res) => { if (!cancelled) setScriptMoney(scriptMoneyFrom(res?.data?.data)); })
      .catch((err) => { console.error('[EpisodeScript] money load failed:', err); if (!cancelled) setScriptMoney(null); });
    return () => { cancelled = true; };
  }, [showId, episodeId]);
  const [barRequest, setBarRequest] = useState(null);
  const clearBarRequest = useCallback(() => setBarRequest(null), []);
  const [contextOpen, setContextOpen] = useState(false);
  // The phone's Context sheet closes on Escape too (Script page audit, 2026-10-19).
  const contextCloseRef = useRef(null);
  // A modal sheet: Tab stays in it while it is on top (Script page audit 3, 2026-10-19).
  const contextSheetRef = useRef(null);
  useDialogKeys(contextOpen, () => setContextOpen(false), contextCloseRef, contextSheetRef);
  // Lala's posts in the script (Task #2885): each Post line's draft in her
  // Feed, as the server has it (null: not read yet, or could not be).
  const [postDrafts, setPostDrafts] = useState(null);
  useEffect(() => {
    if (!episodeId) return undefined;
    let cancelled = false;
    api.get(`/api/v1/feed-posts/episodes/${episodeId}/script-drafts`)
      .then((res) => { if (!cancelled) setPostDrafts(Array.isArray(res?.data?.data) ? res.data.data : null); })
      .catch((err) => { console.error('[EpisodeScript] post drafts load failed:', err); if (!cancelled) setPostDrafts(null); });
    return () => { cancelled = true; };
  }, [episodeId]);
  // A saved script drafts its new Post lines in Lala's Feed (as drafts; they
  // wait for approval in Requests). A failure says so; the script stays saved.
  const syncPostDrafts = useCallback(async () => {
    try {
      const res = await api.post(`/api/v1/feed-posts/episodes/${episodeId}/script-drafts`);
      setPostDrafts(Array.isArray(res?.data?.data) ? res.data.data : null);
      return true;
    } catch (err) {
      console.error('[EpisodeScript] post drafts sync failed:', err);
      return false;
    }
  }, [episodeId]);
  useEffect(() => {
    if (!showId) return undefined;
    let cancelled = false;
    // The balance before this episode (Task #2882): the "True at Beat N"
    // card adds the script's coin changes to it, beat by beat.
    const url = episodeId ? `/api/v1/world/${showId}/balance?episode_id=${encodeURIComponent(episodeId)}` : `/api/v1/world/${showId}/balance`;
    api.get(url)
      .then((res) => {
        const b = episodeId ? res?.data?.balance_before_episode : res?.data?.balance;
        if (!cancelled) setBalance(Number.isFinite(Number(b)) && b !== null && b !== undefined ? Number(b) : null);
      })
      .catch((err) => { console.error('[EpisodeScript] balance load failed:', err); if (!cancelled) setBalance(null); });
    return () => { cancelled = true; };
  }, [showId, episodeId]);
  useEffect(() => {
    if (!episodeId) return undefined;
    let cancelled = false;
    // The show's overlays: its phone screens, and its production overlays
    // (Show Title, Lower Third…), each an overlay the script can show (Task #2793).
    const screens = showId
      ? api.get(`/api/v1/ui-overlays/${showId}?episode_id=${encodeURIComponent(episodeId)}`)
        .then((res) => {
          const all = (Array.isArray(res.data?.data) ? res.data.data : []).filter((o) => o && o.id);
          const phone = all.filter(isScreen);
          return {
            phone,
            // The icons on the phone, and the taps that reach each one (Task #2801).
            icons: phoneIcons(phone, all.filter(isIcon)),
            production: all.filter(isProduction).map((o) => ({ key: o.id, label: o.name || o.id, image_url: o.url || null })),
          };
        })
        .catch((err) => { console.error('[EpisodeScript] show overlays load failed:', err); return { phone: [], icons: [], production: [] }; })
      : Promise.resolve({ phone: [], icons: [], production: [] });
    // The episode's overlays, and its look's approved wardrobe pieces, each an overlay too (Task #2791).
    const overlays = api.get(`/api/v1/episodes/${episodeId}/overlays`)
      .then((res) => {
        const list = (v) => (Array.isArray(v) ? v : []).filter((o) => o && o.key);
        return { pieces: list(res.data?.data?.pieces), look: list(res.data?.data?.wardrobe) };
      })
      .catch((err) => { console.error('[EpisodeScript] overlays load failed:', err); return { pieces: [], look: [] }; });
    // The phone itself: its frame from the Phone Hub (Task #2797).
    const frame = showId
      ? api.get(`/api/v1/ui-overlays/${showId}/frame`)
        .then((res) => (typeof res.data?.frame_url === 'string' ? res.data.frame_url : null))
        .catch((err) => { console.error('[EpisodeScript] phone frame load failed:', err); return null; })
      : Promise.resolve(null);
    Promise.all([screens, overlays, frame]).then(([s, o, f]) => {
      if (!cancelled) setOnScreen({ screens: s.phone, icons: s.icons, overlays: [...o.pieces, ...o.look, ...s.production], look: o.look, production: s.production, phoneFrame: f });
    });
    return () => { cancelled = true; };
  }, [episodeId, showId]);

  // Evoni, 2026-10-09 (Task #2783): on a phone, tapping in the Script tab
  // jumped the page. One beat is open at a time, so opening a beat closes
  // the one above it and everything below moves up by that beat's height;
  // the episode page turns scroll anchoring off (EpisodeDetail.css) and iOS
  // Safari has none, so nothing put the tapped beat back. A tap inside a
  // beat now notes where that beat sits on screen, and the render it causes
  // scrolls the page so the beat is where it was.
  const pinRef = useRef(null);
  const pinTappedBeat = (e) => {
    const el = e.target?.closest?.('.esp-beat');
    if (!el) return;
    const pin = { el, top: el.getBoundingClientRect().top };
    pinRef.current = pin;
    // The pin holds for the tap's renders only (a moved beat lands on the
    // second one, after the script is parsed again), never a later render.
    requestAnimationFrame(() => requestAnimationFrame(() => { if (pinRef.current === pin) pinRef.current = null; }));
  };
  // A beat chosen in the beat list or the pills (Task #2881) opens; the page
  // scrolls to it only when its card is off screen, never otherwise.
  const chosenRef = useRef(null);
  const chooseBeat = (id) => { chosenRef.current = id; setExpandedBeat(id); };
  useLayoutEffect(() => {
    const id = chosenRef.current;
    if (!id) return;
    chosenRef.current = null;
    const card = document.querySelector(`[data-beat-id="${id}"]`);
    if (!card) return;
    const top = card.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight - 80) card.scrollIntoView?.({ block: 'start' });
  });
  useLayoutEffect(() => {
    const pin = pinRef.current;
    if (!pin || !pin.el.isConnected) return;
    const moved = pin.el.getBoundingClientRect().top - pin.top;
    if (Math.abs(moved) >= 1) scrollerOf(pin.el).scrollTop += moved;
  });

  // Load map data when map is opened
  useEffect(() => {
    if (!showMap) return;
    listLocationsApi().then(d => setMapLocations(d.locations || [])).catch((err) => console.error('[EpisodeScript] map locations load failed:', err));
    getWorldMapApi().then(d => { if (d.url) setMapImageUrl(d.url); }).catch((err) => console.error('[EpisodeScript] world map load failed:', err));
  }, [showMap]);

  useEffect(() => {
    if (!episodeId) return;
    const script = episode?.script_content || '';
    const locks = Array.isArray(episode?.script_locked_beats) ? episode.script_locked_beats : [];
    setScriptText(script); setSavedScript(script); setLockedBeats(locks);
    if (script) setBeats(parseScriptIntoBeats(script, locks));
    // The episode the page holds can be older than the saved script: a new
    // script still being written when the tab closed is saved after (Script
    // tab re-audit, 2026-10-15). The tab reads the saved one, and takes it
    // while nothing has been edited here.
    api.get(`/api/v1/episodes/${episodeId}`).then((res) => {
      const ep = res?.data?.data || {};
      if (!mountedRef.current || typeof ep.script_content !== 'string' || ep.script_content === script) return;
      if (scriptRef.current !== script) return;
      const nowLocks = Array.isArray(ep.script_locked_beats) ? ep.script_locked_beats : lockedRef.current;
      setScriptText(ep.script_content); setSavedScript(ep.script_content); setLockedBeats(nowLocks);
      reportSaved(ep.script_content, nowLocks);
    }).catch((err) => console.error('[EpisodeScript] saved script check failed:', err));
    api.get(`/api/v1/episode-brief/${episodeId}`).then(({ data }) => {
      const b = data?.data || null;
      setBrief(b);
      if (b?.event_id && showId) {
        api.get(`/api/v1/world/${showId}/events/${b.event_id}`)
          .then((res) => setSource(res.data || null))
          .catch((err) => console.error('[EpisodeScript] source event load failed:', err));
        api.get(`/api/v1/world/${showId}/events/${b.event_id}/deliverables`)
          .then((res) => setDeliverables(res.data?.deliverables || []))
          .catch((err) => { console.error('[EpisodeScript] deliverables load failed:', err); setDeliverables(null); });
      }
    }).catch((err) => console.error('[EpisodeScript] brief load failed:', err));
    api.get(`/api/v1/wardrobe/outfit/${episodeId}`)
      .then((res) => setOutfit(res.data?.items || []))
      .catch((err) => { console.error('[EpisodeScript] locked outfit load failed:', err); setOutfit(null); });
    api.get(`/api/v1/episode-brief/${episodeId}/plan`).then(res => {
      setScenePlan((res.data?.data || []).map(p => ({ ...p, scene_set_name: p.sceneSet?.name || null, scene_context: p.scene_context || p.sceneSet?.script_context || null, image: beatImage(p), image_label: beatImageLabel(p) })));
    }).catch((err) => console.error('[EpisodeScript] scene plan load failed:', err));
  }, [episodeId]);

  // The page's episode can change after the tab opened: a Regenerate or a
  // Save begun before the tab closed reports there when it lands (re-audit 2,
  // 2026-10-15: the tab kept showing the old script as saved, and the next
  // Save wrote it over the new one). The tab takes it while nothing has been
  // edited here; edits made here stay, and say so.
  const propScript = episode?.script_content;
  const propLocks = episode?.script_locked_beats;
  useEffect(() => {
    if (typeof propScript !== 'string' || propScript === savedRef.current) return;
    if (scriptRef.current !== savedRef.current) {
      flash('A newer script was saved while you were away. Your unsaved edits are on the older one; check History before saving.', 'error', 8000);
      return;
    }
    const nowLocks = Array.isArray(propLocks) ? propLocks : lockedRef.current;
    reportedRef.current = JSON.stringify([propScript, nowLocks]);
    setScriptText(propScript); setSavedScript(propScript); setLockedBeats(nowLocks);
  }, [propScript, propLocks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setBeats(scriptText ? parseScriptIntoBeats(scriptText, lockedBeats) : []); }, [scriptText, lockedBeats]);

  // One drag at a time: a beat (by position) or a line inside one beat.
  const dragRef = useRef(null);
  const drag = {
    start: (e, item) => { dragRef.current = item; if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.kind); } },
    end: () => { dragRef.current = null; },
    current: () => dragRef.current,
    // Top half of the target: before it; bottom half: after it.
    half: (e) => { const r = e.currentTarget.getBoundingClientRect(); return Number.isFinite(e.clientY) && r.height > 0 && e.clientY > r.top + r.height / 2 ? 'after' : 'before'; },
  };

  // Reordering edits the script on the page; Save keeps it. A locked beat
  // doesn't move itself, and its lines don't move (src/lib/scriptBeatOrder.js).
  const handleMoveBeat = (from, to) => {
    if (busy || beats[from]?.approved) return;
    // Not while a lock saves (Script page audit 3, 2026-10-19).
    if (refuseWhileLocking()) return;
    const base = withBeatHeaders(scriptText, lockedBeats);
    const next = moveBeat(base, from, to);
    if (next === base) return;
    // The open beat stays open where it lands (the default open beat is
    // whichever is first, so it is pinned before the order changes).
    if (expandedBeat === undefined) setExpandedBeat(beats[0]?.id ?? null);
    setScriptText(next);
  };
  const handleMoveLine = (beatId, from, to) => {
    const at = beats.findIndex(b => b.id === beatId);
    if (busy) { flash('Wait for the new script before editing it.', 'error'); return false; }
    if (refuseWhileLocking()) return false;
    if (at < 0 || beats[at].approved) return false;
    const base = withBeatHeaders(scriptText, lockedBeats);
    const next = moveLine(base, at, from, to);
    if (next !== base) { noteLineOp(beatId, { kind: 'move', from, to }); setScriptText(next); }
  };

  // Phone paths (2026-10-16): before each tap the phone can't make from where
  // it is, a step to the icon's screen (lib/phonePaths). `fix` is a health
  // row's ({ beatIndex }), or null for every beat. Approved beats keep their
  // words; the steps are on the page until Save.
  // A fix from "Ready to film?": one row's (`fix`), or all of them (null).
  // The show's rules go first (lib/scriptShowRules: Lala's voice click, the
  // invitation in beat 5), then the phone steps, so a new tap gets its path too.
  const handleFixPhonePaths = (fix) => {
    if (busy) { flash('Wait for the new script before editing it.', 'error'); return; }
    // A fix could write into the beat being locked (Script page audit 3, 2026-10-19).
    if (refuseWhileLocking()) return;
    let base = withBeatHeaders(scriptText, lockedBeats);
    const skip = parseScriptIntoBeats(base, lockedBeats).map((b, i) => (b.approved ? i : -1)).filter((i) => i >= 0);
    const only = fix ? [fix.beatIndex] : null;
    const done = [];
    if (!fix || fix.kind === 'voice' || fix.kind === 'reveal') {
      const r = scriptWithShowRules(base, onScreen, { only, skip, voice: !fix || fix.kind === 'voice', reveal: !fix || fix.kind === 'reveal' });
      base = r.script;
      if (r.voice_clicks) done.push(`${r.voice_clicks} voice click${r.voice_clicks === 1 ? '' : 's'}`);
      if (r.reveal) done.push('the invitation in beat 5');
    }
    if (!fix || fix.kind === 'phone' || fix.kind === 'voice') {
      const { script, added } = scriptWithPhonePaths(base, onScreen, { only, skip });
      base = script;
      if (added) done.push(`${added} phone step${added === 1 ? '' : 's'}`);
    }
    if (!done.length) { flash(fix?.kind === 'phone' ? 'No phone step could fix this one; open the beat to change the tap.' : 'Nothing could be fixed here; open the beat to change it.', 'error', 6000); return; }
    setScriptText(base);
    flash(`Added ${done.join(', ')} ✦ Save to keep the changes.`, 'success', 5000);
  };

  // A phone moment or an overlay, added at the end of the beat (Task #2789).
  // false when it was not added (the adders then keep what was typed).
  const handleAddMoment = (beatId, line, after = null) => {
    const at = beats.findIndex(b => b.id === beatId);
    if (busy) { flash('Wait for the new script before adding to it.', 'error'); return false; }
    if (refuseWhileLocking()) return false;
    if (at < 0 || beats[at].approved) return false;
    const base = withBeatHeaders(scriptText, lockedBeats);
    const next = after === null ? appendLine(base, at, line) : insertLine(base, at, after, line);
    if (next !== base) {
      const count = beats[at].lines.length;
      noteLineOp(beatId, { kind: 'splice', at: after === null ? count : Math.max(0, Math.min(count, Number.isInteger(after) ? after + 1 : count)), removed: 0 });
      setScriptText(next);
    }
    return true;
  };

  // The last change made to a beat's lines, so an open line editor stays with
  // its own line (BeatSection useLineIds; Script page re-audit, 2026-10-19).
  const lineOpRef = useRef(null);
  const noteLineOp = (beatId, op) => { lineOpRef.current = { ...op, beatId, n: (lineOpRef.current?.n || 0) + 1 }; };
  // A lock on its way locks the beat as it was sent: an edit made meanwhile
  // ended up in the locked beat unsent (Script page re-audit, 2026-10-19).
  // Refused, the editor or adder keeps what was typed.
  const refuseWhileLocking = () => {
    if (!locking) return false;
    flash('Wait for the lock to finish.', 'error');
    return true;
  };
  // Line editors open with changed words, by beat (ScriptLine onOpenEdit),
  // and each line's id by beat (BeatSection lineIdsRef) (Script page audit 3,
  // 2026-10-19). Replacing a beat, or the script, waits for an open line:
  // refused, never confirmed, so typed words are never lost.
  const openEditsRef = useRef(new Set());
  const lineIdsRef = useRef({});
  const trackOpenEdit = useCallback((beatId, lineId) => {
    const key = `${beatId}\n${lineId}`;
    openEditsRef.current.add(key);
    return () => { openEditsRef.current.delete(key); };
  }, []);
  // A line's row to focus once the script it changed is parsed into beats
  // and drawn (ScriptLine closeEditor; Script page audit 3, 2026-10-19).
  const focusLineRef = useRef(null);
  // A request no new beats answered (nothing changed after all) is answered
  // two frames on, never by a later, unrelated change.
  const focusLineLater = useCallback((beatId, at) => {
    const f = { beatId, at };
    focusLineRef.current = f;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (focusLineRef.current !== f) return;
      focusLineRef.current = null;
      document.querySelector(`[data-beat-id="${beatId}"] [data-line-index="${at}"]`)?.focus();
    }));
  }, []);
  useLayoutEffect(() => {
    const f = focusLineRef.current;
    if (!f) return;
    focusLineRef.current = null;
    document.querySelector(`[data-beat-id="${f.beatId}"] [data-line-index="${f.at}"]`)?.focus();
  }, [beats]);
  // beatId null: any beat.
  const refuseOpenEdit = (beatId = null) => {
    const open = [...openEditsRef.current].some((k) => beatId === null || k.startsWith(`${beatId}\n`));
    if (open) flash("Save or cancel the line you're editing first.", 'error', 6000);
    return open;
  };

  // One timer for the toast: an earlier toast's timer no longer clears a
  // later one early (Script tab audit, 2026-10-15).
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const flash = (msg, type, ms = 3000) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  // The server puts a locked beat back as it was (src/utils/scriptBeatLocks.js)
  // and names it; the page then shows the script as saved.
  const keptNote = (kept) => `Beat${kept.length === 1 ? '' : 's'} ${kept.join(', ')} ${kept.length === 1 ? 'is' : 'are'} locked, so ${kept.length === 1 ? 'it was' : 'they were'} kept as approved`;

  const handleSave = useCallback(async () => {
    // A save waits for a lock on its way (Script page audit 3, 2026-10-19).
    if (busy || locking) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/v1/episodes/${episodeId}`, { script_content: scriptText });
      const stored = typeof res?.data?.data?.script_content === 'string' ? res.data.data.script_content : scriptText;
      const kept = res?.data?.locked_beats_kept || [];
      // Edits made while the save ran stay on the page (still unsaved).
      if (stored !== scriptText && scriptRef.current === scriptText) { setScriptText(stored); }
      setSavedScript(stored); reportSaved(stored, lockedRef.current);
      setUnsaved(null); setSaved(true); setTimeout(() => setSaved(false), 3000);
      // Saved, and the lock held: shown as news, not in red (Script page audit, 2026-10-19).
      if (kept.length) flash(`Saved. ${keptNote(kept)}.`, 'success', 5000);
      if (/\[UI:\s*POST\s/i.test(stored) && !(await syncPostDrafts())) flash("Saved, but Lala's post drafts could not be made. Save again to retry.", 'error', 6000);
    }
    catch (err) { console.error('[EpisodeScript] save failed:', err); flash('Save failed', 'error'); }
    finally { setSaving(false); }
  }, [busy, locking, episodeId, scriptText, syncPostDrafts]);

  // The episode page holds the episode the tab started from. Each saved
  // script and lock goes back to it, so leaving the tab and coming back
  // shows what was saved, not what the page first read.
  // A save, an approval or a new script that lands after the tab has closed
  // can't set the tab's state any more (Script tab re-audit, 2026-10-15:
  // coming back showed the old script, and the next Save wrote it over the
  // new one), so each success path also reports straight to the page.
  // Each report names its episode (Script page audit, 2026-10-19): one that
  // lands after the page has moved to another episode was merged into that
  // one, so the page ignores a report for an episode it no longer holds
  // (EpisodeDetail withSavedScript).
  const reportedRef = useRef(null);
  const reportSaved = (script, locks) => {
    const now = JSON.stringify([script, locks]);
    if (now === reportedRef.current) return;
    reportedRef.current = now;
    onSaved?.({ id: episodeId, script_content: script, script_locked_beats: locks });
  };
  useEffect(() => {
    const now = JSON.stringify([savedScript, lockedBeats]);
    if (reportedRef.current === null) { reportedRef.current = now; return; }
    if (now === reportedRef.current) return;
    reportedRef.current = now;
    onSaved?.({ id: episodeId, script_content: savedScript, script_locked_beats: lockedBeats });
  }, [savedScript, lockedBeats, onSaved]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unsaved edits: the episode page asks before another tab is opened, the
  // browser asks before the page is closed or reloaded, and Ctrl/Cmd+S saves.
  const dirty = scriptText !== savedScript;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  // A link out of the tab (Open Scenes, the wardrobe, the sidebar) asks
  // first while there are unsaved changes, as the episode's tabs do (Script
  // tab re-audit, 2026-10-15: they left with no word). Caught before the
  // router sees the click; a cancelled click goes nowhere.
  useEffect(() => {
    if (!dirty) return undefined;
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target?.closest?.('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const to = new URL(a.href, window.location.href);
      if (to.origin !== window.location.origin || (to.pathname === window.location.pathname && to.search === window.location.search)) return;
      if (!window.confirm('You have unsaved script changes. Leave without saving?')) { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      if (dirty && !saving && !busy && !locking) handleSave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, saving, busy, locking, handleSave]);

  const [saveAfterEdit, setSaveAfterEdit] = useState(false);
  const handleEditLine = (beatId, lineIndex, newText, { thenSave = false } = {}) => {
    if (busy) { flash('Wait for the new script before editing it.', 'error'); return false; }
    if (refuseWhileLocking()) return false;
    if (thenSave) setSaveAfterEdit(true);
    // A line saved as it was leaves the script as it was.
    if (beats.find(b => b.id === beatId)?.lines[lineIndex] === newText) return true;
    const next = scriptWithLine(scriptText, lockedBeats, beatId, lineIndex, newText);
    // A beat approved (or gone) while its line was open keeps the editor open
    // with the typed words, and says why (Script page audit, 2026-10-19:
    // they vanished without a word).
    if (next === null) {
      if (thenSave) setSaveAfterEdit(false);
      flash(beats.find(b => b.id === beatId)?.approved
        ? 'This beat is approved, so the line was not changed. Your words are still in the editor; unlock the beat to put them in.'
        : 'This line\'s beat is no longer in the script, so the line was not changed. Your words are still in the editor.', 'error', 6000);
      return false;
    }
    noteLineOp(beatId, { kind: 'splice', at: lineIndex, removed: 1 });
    setScriptText(next);
    return true;
  };
  // Waits for a save already running, then saves (re-audit 2: the line was
  // committed, and the save it asked for was dropped).
  useEffect(() => {
    if (!saveAfterEdit || saving || busy || locking) return;
    setSaveAfterEdit(false);
    if (scriptText !== savedScript) handleSave();
  }, [saveAfterEdit, scriptText, savedScript, saving, busy, locking, handleSave]);

  // Delete a line (Script tab audit, 2026-10-15): asked in the line's editor;
  // an approved beat keeps its lines. Save keeps it.
  const handleDeleteLine = (beatId, lineIndex) => {
    if (busy) { flash('Wait for the new script before editing it.', 'error'); return false; }
    if (refuseWhileLocking()) return false;
    const next = scriptWithoutLine(scriptText, lockedBeats, beatId, lineIndex);
    // Refused (the beat was approved meanwhile): the editor stays open, and says why.
    if (next === null) { flash('This beat is approved, so the line was not deleted. Unlock the beat to change it.', 'error', 6000); return false; }
    noteLineOp(beatId, { kind: 'splice', at: lineIndex, removed: 1 });
    setScriptText(next);
    return true;
  };

  // Rewrite one line (Evoni, 2026-10-08: "when i click rewrite in script
  // nothing happens? ... is it reading what i already have?"). The rewrite
  // reads the whole beat around the line, and keeps the line's speaker: the
  // route returns the words only, and putting them in place of the whole
  // line dropped "Prime:", so the line turned into narration and lost its
  // Rewrite button. A failure says why.
  // `lineId`: the line's id in its beat, so the spinner and "Use it" stay
  // with it when lines above it change (Script page audit 3, 2026-10-19).
  const handleRewriteLine = async (beatId, lineIndex, originalLine, lineId = null) => {
    const beat = beats.find(b => b.id === beatId);
    if (busy || beat?.approved) return;
    const key = `${beatId}-${lineId ?? lineIndex}`;
    setRewritingLine(key);
    const seq = genSeqRef.current;
    try {
      const parsed = parseLine(originalLine);
      const res = await api.post(`/api/v1/episode-brief/${episodeId}/rewrite-line`, {
        line: originalLine, speaker: parsed?.speaker || 'Prime', beatName: beat?.name,
        beatContext: scenePlan.find(p => p.beat_number === beat?.number)?.emotional_intent,
        beatLines: (beat?.lines || []).filter((l) => typeof l === 'string' && l.trim() && !parseLine(l)?.hidden),
        showId,
      });
      if (!mountedRef.current) return;
      if (seq !== genSeqRef.current) { flash('A new script was written while the line was being rewritten, so the rewrite was not kept.', 'error', 6000); return; }
      const next = rewrittenLine(originalLine, res.data?.rewrittenLine);
      if (!next) { flash('The rewrite came back the same; try again.', 'error'); return; }
      if (parseScriptIntoBeats(scriptRef.current, lockedRef.current).find(b => b.id === beatId)?.approved !== false) { flash('The line changed or was approved while it was being rewritten, so the rewrite was not put in.', 'error', 6000); return; }
      // Shown in its beat first; "Use it" puts it in (acceptProposal).
      setProposal({ kind: 'line', beatId, lineIndex, lineId, originalLine, text: next });
    } catch (err) {
      console.error('[EpisodeScript] rewrite failed:', err);
      flash(`Rewrite failed: ${err.response?.data?.error || err.message || 'no answer'}`, 'error', 6000);
    } finally { if (mountedRef.current) setRewritingLine((r) => (r === key ? null : r)); }
  };

  // Regenerate one beat (Evoni, 2026-10-09, Task #2785: "what if I only want
  // to regenerate a line or a beat?"). The beat is written again against the
  // script as the page has it and put in place; Save keeps it.
  // `instruction`: Evoni's words from Ask for a change, sent with the beat.
  // true when a new version is waiting for "Use it" (Ask for a change then
  // clears its words); false otherwise.
  const handleRegenerateBeat = async (beatId, instruction = '') => {
    const beat = beats.find(b => b.id === beatId);
    if (busy || !beat || beat.approved || regeneratingBeat) return false;
    setRegeneratingBeat(beatId);
    const requested = parseScriptIntoBeats(withBeatHeaders(scriptText, lockedBeats), lockedBeats).find(b => b.id === beatId);
    const seq = genSeqRef.current;
    try {
      const res = await api.post(`/api/v1/episode-brief/${episodeId}/regenerate-beat`, { showId, beatNumber: beat.number, script: withBeatHeaders(scriptText, lockedBeats), ...(instruction ? { instruction } : {}) });
      if (!mountedRef.current) return false;
      const proposed = String(res.data?.beat || '');
      const nowBeat = parseScriptIntoBeats(withBeatHeaders(scriptRef.current, lockedRef.current), lockedRef.current).find(b => b.id === beatId);
      if (!nowBeat || nowBeat.approved) { flash(`Beat ${beat.number} was approved or removed while it was being written, so the new version was not put in.`, 'error', 6000); return false; }
      if (!/^\s*##\s*BEAT:/i.test(proposed) || (nowBeat && nowBeat.raw.trimEnd() === proposed.trimEnd())) { flash('The beat came back the same; try again.', 'error'); return false; }
      // Shown in the beat first; "Use it" puts it in (acceptProposal).
      // `base`: the beat as it was asked for, so "Use it" can tell whether
      // it has changed since.
      if (seq !== genSeqRef.current) { flash(`A new script was written while beat ${beat.number} was being rewritten, so the rewrite was not kept.`, 'error', 6000); return false; }
      // `base`: the beat's lines as it was asked for (its lines, not its
      // header, which an edit to a header-less script writes another way).
      setProposal({ kind: 'beat', beatId, number: beat.number, text: proposed, base: requested ? requested.lines.join('\n') : null });
      return true;
    } catch (err) {
      console.error('[EpisodeScript] beat regenerate failed:', err);
      flash(`Regenerate failed: ${err.response?.data?.error || err.message || 'no answer'}`, 'error', 6000);
      return false;
    } finally { if (mountedRef.current) setRegeneratingBeat(null); }
  };

  // A rewrite or a regenerated beat is a suggestion until "Use it" (Script
  // tab audit, 2026-10-15: they replaced the text straight away). It goes
  // into the script as it is then: edits made meanwhile stay, a line is
  // found again by its words if it moved, a beat by its id, and one
  // approved meanwhile is left as approved.
  const acceptProposal = () => {
    const p = proposal;
    if (!p || busy) return;
    // Kept for "Use it" once the lock is done (Script page re-audit, 2026-10-19).
    if (refuseWhileLocking()) return;
    // A line open in this beat keeps its words; the suggestion waits (Script page audit 3, 2026-10-19).
    if (refuseOpenEdit(p.beatId)) return;
    setProposal(null);
    if (p.kind === 'line') {
      const current = scriptRef.current;
      const nowBeat = parseScriptIntoBeats(current, lockedRef.current).find(b => b.id === p.beatId);
      // Found by its id where it has one (of two same lines, the first was
      // rewritten); by its words only for a proposal without one.
      const ids = lineIdsRef.current[p.beatId];
      let at;
      if (p.lineId != null && ids) {
        const i = ids.indexOf(p.lineId);
        at = i >= 0 && nowBeat?.lines[i] === p.originalLine ? i : -1;
      } else {
        at = nowBeat?.lines[p.lineIndex] === p.originalLine ? p.lineIndex : (nowBeat?.lines.indexOf(p.originalLine) ?? -1);
      }
      const written = at < 0 ? null : scriptWithLine(current, lockedRef.current, p.beatId, at, p.text);
      if (written === null) { flash('The line changed or was approved while it was being rewritten, so the rewrite was not put in.', 'error', 6000); return; }
      noteLineOp(p.beatId, { kind: 'splice', at, removed: 1 });
      setScriptText(written);
      flash('Line rewritten ✦ Save to keep it.', 'success');
      return;
    }
    const current = withBeatHeaders(scriptRef.current, lockedRef.current);
    const nowBeats = parseScriptIntoBeats(current, lockedRef.current);
    const at = nowBeats.findIndex(b => b.id === p.beatId);
    if (at < 0 || nowBeats[at].approved) { flash(`Beat ${p.number} was approved or removed while it was being written, so the new version was not put in.`, 'error', 6000); return; }
    // Edits made to this beat meanwhile are not written over (Script tab
    // re-audit, 2026-10-15).
    if (typeof p.base === 'string' && nowBeats[at].lines.join('\n') !== p.base) { flash(`Beat ${p.number} changed while it was being written, so your version stays. Regenerate it again to write it from what is there now.`, 'error', 6000); return; }
    const next = replaceBeat(current, at, p.text);
    if (next === current) { flash('The beat came back the same; try again.', 'error'); return; }
    setScriptText(next);
    flash(`Beat ${p.number} rewritten ✦ Save to keep it.`, 'success');
  };

  // Approve = lock (Evoni, 2026-10-08). The lock is kept on the episode, so
  // it survives a reload, and Regenerate leaves the beat as it is. Edits the
  // page hasn't saved go with the lock, so the beat is locked as shown.
  const handleApprove = async (beatId) => {
    const beat = beats.find(b => b.id === beatId);
    if (busy || !beat || locking) return;
    const next = beat.approved ? lockedBeats.filter(n => n !== beat.number) : [...lockedBeats, beat.number].sort((a, b) => a - b);
    // A lock holds a headed beat on the server, so a script without headers
    // is saved with them, as the page shows its beats.
    const text = withBeatHeaders(scriptText, lockedBeats);
    const sendText = text !== savedScript;
    setLocking(true);
    try {
      const res = await api.put(`/api/v1/episodes/${episodeId}/script-locks`, { locked_beats: next, ...(sendText ? { script_content: text } : {}) });
      const data = res?.data?.data || {};
      const nowLocks = Array.isArray(data.script_locked_beats) ? data.script_locked_beats : next;
      setLockedBeats(nowLocks);
      const stored = sendText ? (typeof data.script_content === 'string' ? data.script_content : text) : savedScript;
      reportSaved(stored, nowLocks);
      if (sendText) {
        if (stored !== scriptText && scriptRef.current === scriptText) { setScriptText(stored); }
        setSavedScript(stored); setUnsaved(null);
        // A save with the lock drafts Lala's posts as Save does.
        if (/\[UI:\s*POST\s/i.test(stored) && !(await syncPostDrafts())) flash("Saved, but Lala's post drafts could not be made. Save again to retry.", 'error', 6000);
      }
      const kept = res?.data?.locked_beats_kept || [];
      if (kept.length) flash(`${keptNote(kept)}.`, 'success', 5000);
    } catch (err) {
      console.error('[EpisodeScript] lock failed:', err);
      flash(err.response?.data?.error || (beat.approved ? 'Could not unlock the beat' : 'Could not approve the beat'), 'error');
    } finally { setLocking(false); }
  };

  const [guardResult, setGuardResult] = useState(null);

  // keepsLocked: the person already agreed to replace the unlocked beats, so
  // the server's "replace the script?" check is answered for them.
  // Evoni, 2026-10-09 (Task #2785): "when I regenerate I have to refresh the
  // page to see it". Writing all 14 beats can outlast the request, which then
  // fails at the gateway while the server goes on to save the script. When
  // the request fails without the server's own answer, the page asks for the
  // episode every 8 seconds for 4 minutes and shows the script once it
  // changes.
  const waitForSavedScript = async (before) => {
    setWaitingForScript(true);
    try {
      for (let i = 0; i < 30 && mountedRef.current; i += 1) {
        await new Promise((r) => setTimeout(r, 8000));
        if (!mountedRef.current) return;
        try {
          const res = await api.get(`/api/v1/episodes/${episodeId}`);
          const ep = res.data?.data || res.data || {};
          const script = typeof ep.script_content === 'string' ? ep.script_content : null;
          if (script !== null && script !== before) {
            setScriptText(script); setSavedScript(script); setUnsaved(null); setProposal(null);
            const locks = Array.isArray(ep.script_locked_beats) ? ep.script_locked_beats : lockedRef.current;
            setLockedBeats(locks); reportSaved(script, locks);
            flash('✦ Script generated and saved.', 'success', 5000);
            return;
          }
        } catch (err) { console.error('[EpisodeScript] waiting for the script:', err); }
      }
      if (mountedRef.current) setGenError('The new script has not arrived after 4 minutes. Refresh later to see whether it was saved.');
    } finally { if (mountedRef.current) setWaitingForScript(false); }
  };

  const handleGenerate = async (keepsLocked = false) => {
    // A pending "Use it" was written against the script being replaced.
    genSeqRef.current += 1;
    setGenerating(true); setGenError(null); setGuardResult(null); setCoverage(null); setProposal(null);
    const before = savedScript;
    const post = (confirmOverwrite) => api.post(`/api/v1/episode-brief/${episodeId}/generate-script`, {
      showId, ...(confirmOverwrite ? { confirmOverwrite: true } : {}),
    });
    try {
      let res;
      try {
        res = await post(keepsLocked);
      } catch (err) {
        if (err.response?.status === 409 && err.response?.data?.code === 'SCRIPT_OVERWRITE_CONFIRMATION_REQUIRED') {
          if (!window.confirm('This episode already has a script. Replace it?')) return;
          res = await post(true);
        } else {
          throw err;
        }
      }
      const script = res.data.script || res.data.script_text || '';
      setScriptText(script);
      setProposal(null);
      if (res.data.saved !== false) { setSavedScript(script); reportSaved(script, lockedRef.current); if (/\[UI:\s*POST\s/i.test(script)) syncPostDrafts(); }
      // The server saves as part of success (audit GATE-03). Generated but
      // not saved: keep the draft here and say so; Save keeps it without
      // another generation.
      const notSaved = res.data.saved === false ? (res.data.error || 'The script was generated but could not be saved.') : null;
      setUnsaved(notSaved);

      // §8(j): every canonical beat should come back under its own header.
      const check = res.data.beat_check;
      setCoverage(res.data.coverage || null);
      const beatGap = check && !check.complete
        ? ` — ⚠️ beat${check.missing?.length === 1 ? '' : 's'} ${(check.missing || []).join(', ') || '?'} came back without ${check.missing?.length === 1 ? 'its' : 'their'} header`
        : '';
      // Check for auto-guard results
      if (notSaved) {
        setToast({ msg: `⚠️ Script generated but not saved — press Save to keep it${beatGap}`, type: 'error' });
      } else if (res.data.guardResult) {
        setGuardResult(res.data.guardResult);
        const v = res.data.guardResult.violations?.length || 0;
        setToast({ msg: (v > 0 ? `✦ Script generated — ⚠️ ${v} franchise violation(s)` : '✦ Script generated — ✅ Passed franchise guard') + beatGap, type: v > 0 || beatGap ? 'error' : 'success' });
      } else {
        setToast({ msg: `✦ Script generated!${beatGap}`, type: beatGap ? 'error' : 'success' });
      }
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    } catch (err) {
      console.error('[EpisodeScript] generate failed:', err);
      const status = err.response?.status;
      if (!err.response || status === 502 || status === 504) { await waitForSavedScript(before); return; }
      setGenError(err.response?.data?.error || 'Generation failed');
    }
    finally { if (mountedRef.current) setGenerating(false); }
  };

  // Whether Lala's phone is on screen as each beat starts: it stays up from
  // the beat that brings it up until one takes it away (Task #2797).
  const phoneUpAtStart = [];
  // From the Start button to Event Travel the phone is up by the show's rule
  // (lib/scriptMoments.js phoneUpAtBeat; Evoni, 2026-10-16).
  beats.reduce((up, b, i) => {
    const start = phoneUpAtBeat(b.number, up, i > 0 ? beats[i - 1].number : null);
    phoneUpAtStart[i] = start;
    return beatOnScreen(b.lines, onScreen, { phoneUp: start, cutscene: isCutsceneBeat(b.number) }).phoneUpAtEnd;
  }, false);

  // The beat list and pills (Task #2881): the script's own beats, each marked
  // when it has a phone moment; the open beat's context for the chips.
  // A chosen beat whose id is gone (renumbered, removed) falls back to the
  // first: at phone width only the open beat shows, so none was on screen
  // (Script page audit, 2026-10-19). null (closed on a desktop) stays closed.
  const openId = expandedBeat === undefined || (expandedBeat !== null && !beats.some((b) => b.id === expandedBeat)) ? beats[0]?.id : expandedBeat;
  const openBeat = beats.find((b) => b.id === openId) || null;
  // The Shopping list as of the open beat, from the saved script (Task
  // #3188): crossed off from the line each piece is put on.
  const [shoppingAt, setShoppingAt] = useState(null);
  const openBeatNumber = openBeat?.number ?? null;
  // The server reads the saved script, so this is read again after a save,
  // not on every keystroke (Script tab audit, 2026-10-15).
  useEffect(() => {
    if (!episodeId || !openBeatNumber) { setShoppingAt(null); return undefined; }
    let cancelled = false;
    api.get(`/api/v1/episodes/${episodeId}/todo?beat=${openBeatNumber}`)
      .then((res) => { if (!cancelled) setShoppingAt(res.data?.data || null); })
      .catch((err) => { console.error('[EpisodeScript] shopping list as of the beat failed:', err); if (!cancelled) setShoppingAt(null); });
    return () => { cancelled = true; };
  }, [episodeId, openBeatNumber, savedScript]);
  // The deal checklist (Task #3191): the episode's deal, its location label
  // and whether its terms are locked here; ticks and the mode are read from
  // the script being edited. Read-only: nothing here moves a status.
  const [deal, setDeal] = useState(null);
  useEffect(() => {
    if (!episodeId) { setDeal(null); return undefined; }
    let cancelled = false;
    api.get(`/api/v1/episodes/${episodeId}/todo/at`)
      .then((res) => { if (!cancelled) setDeal(res.data?.data?.deal || null); })
      .catch((err) => { console.error('[EpisodeScript] deal checklist load failed:', err); if (!cancelled) setDeal(null); });
    return () => { cancelled = true; };
  }, [episodeId]);
  const dealItems = (deal?.items || []).map((i) => ({ ...i, id: i.deliverable_id }));
  // A cutscene beat is never marked as having a phone moment (Script page re-audit, 2026-10-19).
  const phoneBeats = new Set(beats.filter((b) => !isCutsceneBeat(b.number) && hasPhoneMoment(b.lines, onScreen)).map((b) => b.id));
  const openInCutscene = !!openBeat && isCutsceneBeat(openBeat.number);
  const openScene = openBeat ? scenePlan.find((p) => p.beat_number === openBeat.number) : null;
  const inRoom = openBeat ? beatSpeakers(openBeat.lines) : [];
  // What is true at the open beat (Task #2882; Evoni's choices of 2026-10-11).
  const truth = openBeat ? beatState(beats, beats.indexOf(openBeat), {
    balanceBefore: balance, outfit, closetAt: closetBeat(scriptText), scenePlan,
    event: source?.event || null, episodeNumber: episode?.episode_number ?? null,
  }) : null;
  const people = scriptPeople({ event: source?.event || null, sourceProfile: source?.sourceProfile || null, beats });
  const onScreenWithDrafts = postDrafts ? { ...onScreen, postDrafts } : onScreen;
  const approvedCount = beats.filter(b => b.approved).length;
  const allApproved = beats.length > 0 && approvedCount === beats.length;
  const hasScript = !!scriptText?.trim();
  // A script cleared in the raw editor keeps Save, History and the view
  // toggle (Script tab re-audit, 2026-10-15: only Generate was left).
  const hasWork = hasScript || !!savedScript?.trim();
  const plan = source?.event
    ? episodePlanning({ episode, event: source.event, sourceProfile: source.sourceProfile, sceneSet: source.sceneSet, venueLocation: source.venueLocation })
    : null;
  const inputs = scriptInputs({ brief, plan, outfit, event: source?.event || null, deliverables });
  // What the episode must cover, ticked from the script, and the open beat's
  // phone check (Task #2884).
  // Beat 14's opportunity is on the list only when it comes: not when the
  // episode is designed to fail, nor once it expired (Script page audit,
  // 2026-10-19; lib/beat14Invitation beat14Outcome).
  const cover = mustCover({ beats, event: source?.event || null, brief, opportunity: beat14Outcome(beat14?.opportunity, brief?.designed_intent || null) === 'invitation' ? beat14.opportunity : null });
  // The phone starts each beat where the beat before left it, not on the
  // home screen (Script tab audit, 2026-10-15); at home when it was put
  // away (from beat 11; Script page audit, 2026-10-19).
  const phoneScreenAt = phoneStartScreens(beats, onScreen);
  const openIndex = openBeat ? beats.indexOf(openBeat) : -1;
  const check = openBeat ? phoneCheck(openBeat.lines, onScreen, { startAt: phoneScreenAt[openIndex] }) : null;
  // Wear cues that name no single piece of the locked look (Task #3180):
  // checked once a look is locked, flagged, never fixed.
  const wearIssues = openBeat && Array.isArray(outfit) && outfit.length
    ? wearFlags(beats, outfit).filter((f) => f.beatIndex === beats.indexOf(openBeat))
    : [];
  // A piece of the look no cue puts on is crossed off at the last
  // getting-ready beat and flagged there (Task #3188; ruling 2).
  if (openBeat && Array.isArray(outfit) && outfit.length
    && beats.indexOf(openBeat) === Math.max(0, lastGettingReadyIndex(beats, outfit, closetBeat(scriptText)))) {
    for (const p of uncuedPieces(beats, outfit)) {
      wearIssues.push({ beatIndex: beats.indexOf(openBeat), lineIndex: `uncued-${p.id}`, flag: 'uncued', text: `"${p.name}" is in the look, never equipped on screen` });
    }
  }

  // Lala line slots after worn pieces with no line of hers (Task #3190).
  const lineSlots = Array.isArray(outfit) && outfit.length ? lalaLineSlots(beats, outfit) : [];
  // The open beat's to-do list and what of the deal is delivered by its end
  // (Task #3191); [DELIVER] and [TODO_MODE] cues that do nothing are flagged.
  const todoMode = openBeat ? todoModeAt(beats, openIndex, { closetNumber: closetBeat(scriptText), dealLocked: Boolean(deal?.locked) }) : null;
  const delivered = openBeat ? deliveredAt(beats, openIndex, Infinity, dealItems) : new Set();
  const dealIssues = openBeat ? dealCueFlags(beats, dealItems).filter((f) => f.beatIndex === openIndex) : [];

  const showBeatList = hasScript && !developerMode && beats.length > 0;
  // Ready to film? (Script tab audit, 2026-10-15): the checks above, script-wide.
  const healthRows = showBeatList ? scriptHealth({
    beats, canonical: BEAT_NAMES, cover, onScreen, outfit, dealItems,
    rules: { money: scriptMoney, shoppingApproved: shoppingListApproved(source?.event || null), cast: source?.event ? eventCast(source.event, [source.sourceProfile, ...guestProfiles]) : [] },
    closetNumber: closetBeat(scriptText), dirty: scriptText !== savedScript, unsaved,
    beat14, designedIntent: brief?.designed_intent || null,
  }) : [];
  return (
    <div className={`esp${showBeatList ? ' has-beatlist' : ''}${contextOpen ? ' is-context-open' : ''}`}>
    {/* The beat list (Evoni's mock; Task #2881): the beats this script has,
        a phone where the beat has a phone moment; choosing one opens it. */}
    {showBeatList && (
      <nav className="esp-beatlist" aria-label="Beats" data-testid="script-beatlist">
        <h3 className="esp-side-title">Beats</h3>
        <ol className="esp-beatlist-items">
          {beats.map((b) => (
            <li key={b.id}>
              <button type="button" className={`esp-beatlist-btn${b.id === openId ? ' is-open' : ''}`} aria-current={b.id === openId ? 'true' : undefined}
                data-testid={`script-nav-${b.number}`} onClick={() => chooseBeat(b.id)}>
                <span className="esp-beatlist-num">{b.number}</span>
                <span className="esp-beatlist-name">{b.name}</span>
                {phoneBeats.has(b.id) && <Smartphone size={14} className="esp-beatlist-phone" aria-label="Has a phone moment" data-testid={`script-nav-phone-${b.number}`} />}
              </button>
            </li>
          ))}
        </ol>
        <p className="esp-beatlist-legend"><Smartphone size={12} aria-hidden="true" /> = has a phone moment</p>
      </nav>
    )}
    <div className="esp-main" onClickCapture={pinTappedBeat}>
      {toast && <div className={`esp-toast is-${toast.type === 'error' ? 'error' : 'success'}`} role="status">{toast.msg}</div>}

      {unsaved && (
        <div className="esp-unsaved-banner" data-testid="script-unsaved" role="alert">
          <span className="esp-unsaved-banner-text"><strong>Not saved.</strong> {unsaved} The draft is only on this page until it is saved.</span>
          <button type="button" className="esp-btn-primary is-small" data-testid="script-unsaved-save" onClick={handleSave} disabled={saving || busy || locking}>{saving ? '⏳ Saving…' : '💾 Save now'}</button>
        </div>
      )}
      {/* The script's card (Evoni's Episode mock): its state, and its actions. */}
      <section className="esp-head" data-testid="script-head">
        <div className="esp-head-text">
          <h2 className="esp-title">Script</h2>
          <p className="esp-sub">
            {hasScript ? <>{beats.length} beats · <span data-testid="script-runtime">{formatRuntime(scriptSeconds(beats))}</span> · {approvedCount} approved{allApproved && <span className="esp-complete"> · Complete</span>}{scriptText !== savedScript ? <span className="esp-unsaved" data-testid="script-dirty"> · Unsaved changes</span> : <span className="esp-saved-state" data-testid="script-saved"> · Saved</span>}</> : 'Not generated yet'}
          </p>
        </div>
        {hasWork ? (
          <div className="esp-actions">
            {/* Table read and Export (Script tab audit, 2026-10-15): the script as on the page. */}
            {/* false: refused, so History stays open on the version (Script page audit, 2026-10-19). */}
            <ScriptHistory episodeId={episodeId} dirty={scriptText !== savedScript} onRestore={(text) => {
              if (busy) { flash('Wait for the new script before putting a version back.', 'error'); return false; }
              // Not while a lock saves, nor over an open line's words (Script page audit 3, 2026-10-19).
              if (refuseWhileLocking() || refuseOpenEdit()) return false;
              setScriptText(text); setProposal(null);
              flash('An earlier version is on the page ✦ Save to keep it.', 'success', 5000);
              return true;
            }} />
            <ScriptReadActions scriptText={scriptText} title={episode?.title || (episode?.episode_number ? `Episode ${episode.episode_number}` : 'Script')} dirty={scriptText !== savedScript} onScreen={onScreenWithDrafts} scenePlan={scenePlan} startBeat={Math.max(0, beats.indexOf(openBeat))} />
            <button type="button" className={`esp-btn${developerMode ? ' is-on' : ''}`} onClick={() => setDeveloperMode(d => !d)}>{developerMode ? 'Beat view' : 'Raw editor'}</button>
            {/* Not while a lock or a save is on its way (Script page audit,
                2026-10-19: the new script landed over the lock's or save's answer). */}
            <button type="button" className="esp-btn" data-testid="script-regenerate" onClick={() => {
              const ask = approvedCount > 0
                ? `Regenerate the unlocked beats? The ${approvedCount} approved beat${approvedCount === 1 ? '' : 's'} stay${approvedCount === 1 ? 's' : ''} exactly as ${approvedCount === 1 ? 'it is' : 'they are'}; the rest of the script is replaced.`
                : 'Regenerate the entire script? Your current script will be replaced.';
              if (!window.confirm(ask)) return;
              // Already confirmed here, so the server's own "replace it?" is answered.
              handleGenerate(true);
            }} disabled={busy || !!regeneratingBeat || locking || saving}>{waitingForScript ? 'Still writing…' : generating ? 'Generating…' : approvedCount > 0 ? 'Regenerate unlocked' : 'Regenerate'}</button>
            <button type="button" className={`esp-btn-primary${saved ? ' is-saved' : ''}`} onClick={handleSave} disabled={saving || busy || locking}>{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}</button>
          </div>
        ) : (
          <button type="button" className="esp-btn-primary is-large" onClick={() => handleGenerate()} disabled={generating}>
            {waitingForScript ? 'Still writing the 14 beats…' : generating ? 'Generating the 14 beats…' : 'Generate Script'}
          </button>
        )}
      </section>
      {genError && <div className="esp-error" role="alert">{genError}</div>}
      {coverage && (coverage.missing?.length > 0 || coverage.fixed_beats?.length > 0 || coverage.phone_steps > 0 || coverage.voice_clicks > 0 || coverage.reveal_fixed || coverage.coin_lines > 0 || coverage.story_gaps?.length > 0) && (
        <div className={`esp-coverage${coverage.missing?.length ? ' is-gaps' : ''}`} role="status" data-testid="script-coverage">
          {coverage.fixed_beats?.length > 0 && <p className="esp-coverage-line">✦ The writer rewrote beat{coverage.fixed_beats.length === 1 ? '' : 's'} {coverage.fixed_beats.join(', ')} to cover what the episode needs.</p>}
          {coverage.phone_steps > 0 && <p className="esp-coverage-line" data-testid="script-coverage-phone">✦ The writer added {coverage.phone_steps} phone step{coverage.phone_steps === 1 ? '' : 's'}, so every tap is on the screen its icon is on.</p>}
          {coverage.voice_clicks > 0 && <p className="esp-coverage-line" data-testid="script-coverage-voice">✦ The writer added {coverage.voice_clicks} voice click{coverage.voice_clicks === 1 ? '' : 's'}, so Lala talks only once her voice icon is clicked.</p>}
          {coverage.coin_lines > 0 && <p className="esp-coverage-line" data-testid="script-coverage-coins">✦ The writer added {coverage.coin_lines} coin line{coverage.coin_lines === 1 ? '' : 's'}, so each piece Lala buys comes off her coins as it goes on.</p>}
          {coverage.reveal_fixed && <p className="esp-coverage-line" data-testid="script-coverage-reveal">✦ Beat 5 now shows the invitation letter, not the login screen.</p>}
          {coverage.missing?.length > 0 && (
            <>
              <p className="esp-coverage-line">Still not in the script:</p>
              <ul className="esp-coverage-list">
                {coverage.missing.slice(0, 8).map((m, i) => <li key={`${m.kind}-${i}`}>{COVERAGE_KINDS[m.kind] || m.kind}: {m.label}{m.target ? ` (beat ${m.target})` : ''}</li>)}
              </ul>
            </>
          )}
          {coverage.story_gaps?.length > 0 && (
            <div data-testid="script-coverage-story">
              <p className="esp-coverage-line">Not set for this episode yet, so the writer kept it to this episode and invented no history:</p>
              <ul className="esp-coverage-list">
                {coverage.story_gaps.map((g) => <li key={g.layer}>{g.label}</li>)}
              </ul>
            </div>
          )}
          <button type="button" className="esp-btn is-small" onClick={() => setCoverage(null)}>Dismiss</button>
        </div>
      )}
      {draft.offer && (
        <div className="esp-draft" role="region" aria-label="Unsaved changes kept in this browser" data-testid="script-draft">
          <span className="esp-draft-text">
            Unsaved changes{draft.offer.at ? ` from ${new Date(draft.offer.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''} were kept in this browser.
            {draft.offer.baseChanged ? ' The saved script has changed since.' : ''}
          </span>
          <button type="button" className="esp-btn-primary is-small" data-testid="script-draft-restore" onClick={() => {
            if (busy) { flash('Wait for the new script before putting your changes back.', 'error'); return; }
            if (refuseWhileLocking() || refuseOpenEdit()) return;
            if (scriptText !== savedScript && !window.confirm('Put the kept changes back? The unsaved changes on the page now are replaced.')) return;
            // Kept against an older saved script (re-audit 2: a newer one the tab had just taken was replaced without a word).
            if (scriptText === savedScript && draft.offer.baseChanged && !window.confirm('The saved script has changed since these changes were kept. Put them back over it? Save keeps them; History has the saved one.')) return;
            setScriptText(draft.offer.text); setProposal(null); draft.discard(); flash('Your unsaved changes are back ✦ Save to keep them.', 'success', 5000); }}>Put them back</button>
          <button type="button" className="esp-btn is-small" data-testid="script-draft-discard" onClick={draft.discard}>Discard</button>
        </div>
      )}
      {showBeatList && <ScriptHealthPanel rows={healthRows} beatNumbers={Object.fromEntries(beats.map((b) => [b.id, b.number]))} onOpenBeat={chooseBeat} onFix={handleFixPhonePaths} busy={busy || locking} />}
      {/* At phone width (Task #2881): the beats as pills, and the open beat's
          context from the episode's own data. */}
      {showBeatList && (
        <>
          {/* A list of buttons, not buttons playing list items (Script page audit, 2026-10-19). */}
          <ul className="esp-pills" aria-label="Beats" data-testid="script-pills">
            {beats.map((b) => (
              <li key={b.id}>
                <button type="button" className={`esp-pill${b.id === openId ? ' is-open' : ''}`} aria-current={b.id === openId ? 'true' : undefined}
                  data-testid={`script-pill-${b.number}`} onClick={() => chooseBeat(b.id)}>
                  {b.number} · {b.name}
                  {phoneBeats.has(b.id) && <Smartphone size={13} aria-label="Has a phone moment" />}
                </button>
              </li>
            ))}
          </ul>
          <ul className="esp-chips" data-testid="script-chips">
            <li data-testid="script-chip-coins"><Coins size={13} aria-hidden="true" />{truth?.coins.value != null ? `Lala has ${truth.coins.value.toLocaleString()} coins` : 'Coins not read'}</li>
            <li data-testid="script-chip-look"><Shirt size={13} aria-hidden="true" />{truth?.wearing.beforeCloset ? truth.wearing.text : outfit === null ? 'Look not read' : outfit.length ? `Dressed · ${outfit.length} piece${outfit.length === 1 ? '' : 's'}` : 'Not dressed yet'}</li>
            <li data-testid="script-chip-scene"><MapPin size={13} aria-hidden="true" />{openScene?.scene_set_name || 'No scene set'}</li>
            <li data-testid="script-chip-room"><Users size={13} aria-hidden="true" />{inRoom.length ? inRoom.join(', ') : 'No one speaks yet'}</li>
          </ul>
        </>
      )}
      {generating && !waitingForScript && hasScript && <div className="esp-waiting" role="status" data-testid="script-generating">Writing the new script. Editing, approving and saving are paused until it arrives.</div>}
      {waitingForScript && <div className="esp-waiting" role="status" data-testid="script-waiting">Still writing. The new script will show here as soon as it is saved; no need to refresh.</div>}

      {hasScript && developerMode && approvedCount > 0 && <p className="esp-raw-note" data-testid="script-raw-locked-note">🔒 Approved beats are locked. Changes to them here are put back when the script is saved.</p>}
      {/* The raw editor is the script itself, so a line edit or rewrite shows
          here, and it stays open when its text is cleared. */}
      {developerMode && <textarea className="esp-raw" aria-label="Raw script" value={scriptText} readOnly={busy || locking} onChange={e => setScriptText(e.target.value)} rows={30} />}

      {!developerMode && (hasScript ? (
        <div className={busy ? 'esp-beats is-busy' : 'esp-beats'} aria-busy={busy || undefined} data-testid="script-beats">
          {beats.length > 1 && <p className="esp-order-hint">Drag a beat by its handle, or a line within its beat, to change the order. A beat keeps its number and name wherever it goes. Approved beats stay where they are.</p>}
          {beats.map((beat, index) => {
            const open = openId === beat.id;
            const phoneUp = phoneUpAtStart[index] || false;
            return <BeatSection key={beat.id} request={open && barRequest?.beatId === beat.id ? barRequest : null} beat={beat} index={index} beatCount={beats.length} scenePlan={scenePlan} expanded={open} onToggle={() => setExpandedBeat(open && !isPhoneWidth() ? null : beat.id)} onApprove={handleApprove} proposal={proposal?.beatId === beat.id ? proposal : null} onAcceptProposal={acceptProposal} onDiscardProposal={() => setProposal(null)} onEdit={handleEditLine} onDeleteLine={handleDeleteLine} onRewrite={handleRewriteLine} rewritingLine={rewritingLine} locking={locking || busy} onOpenMap={() => setShowMap(true)} onMoveBeat={handleMoveBeat} onMoveLine={handleMoveLine} drag={drag} onRegenerate={handleRegenerateBeat} regenerating={regeneratingBeat === beat.id} writing={!!regeneratingBeat || busy} onRequestDone={clearBarRequest} onScreen={onScreenWithDrafts} onAddMoment={handleAddMoment} lineOpRef={lineOpRef} lineIdsRef={lineIdsRef} onOpenEdit={trackOpenEdit} onFocusLater={focusLineLater} phoneUpAtStart={phoneUp} people={people} lalaSlots={lineSlots.filter((s) => s.beatIndex === index)} dressCode={source?.event?.dress_code || ''} />;
          })}
          {/* Franchise Guard Results */}
          {guardResult && (
            <div className={`esp-guard ${guardResult.violations?.length > 0 ? 'is-bad' : 'is-ok'}`}>
              <div className="esp-guard-title">
                {guardResult.violations?.length > 0 ? `🛡️ ${guardResult.violations.length} franchise violation(s)` : '🛡️ Passed franchise guard'}
                <span className="esp-guard-count">({guardResult.rules_checked || '?'} rules checked)</span>
              </div>
              {guardResult.violations?.map((v, i) => (
                <div key={i} className="esp-guard-item">
                  <strong>{v.rule}:</strong> {v.explanation}
                </div>
              ))}
            </div>
          )}

          {allApproved && (
            <div className="esp-done">
              <p className="esp-done-text">✦ All beats approved — script is ready</p>
              <button type="button" className="esp-btn-primary" onClick={handleSave} disabled={saving || busy || locking}>💾 Save Final Script</button>
            </div>
          )}
        </div>
      ) : (
        <section className="esp-empty" data-testid="script-empty">
          <PenLine size={30} className="esp-empty-icon" aria-hidden="true" />
          <h3 className="esp-empty-title">No script yet</h3>
          <p className="esp-empty-text">
            Generating writes every beat from the brief and the event. Each beat then shows what it needs from
            Production, like a scene, Lala's look or a phone screen.
          </p>
        </section>
      ))}

      {/* Evoni, 2026-10-09 (Task #2785): "to save I need to scroll all the
          way up even if I'm at beat 11". While there are unsaved changes,
          Save rides along the bottom of the screen. */}
      {hasWork && scriptText !== savedScript && (
        <div className="esp-savebar" data-testid="script-savebar" role="region" aria-label="Unsaved changes">
          <span className="esp-savebar-text">Unsaved changes</span>
          <button type="button" className="esp-btn-primary is-small" data-testid="script-savebar-save" onClick={handleSave} disabled={saving || busy || locking}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      )}

      {/* At phone width (Task #2881): add to the open beat, or see its context. */}
      {showBeatList && (
        <div className="esp-mobilebar" data-testid="script-mobilebar" role="region" aria-label="Add to the open beat">
          <button type="button" className="esp-mobilebar-btn" disabled={!openBeat || openBeat.approved} data-testid="script-bar-line"
            onClick={() => setBarRequest({ kind: 'line', n: Date.now(), beatId: openId })}><Plus size={16} aria-hidden="true" /> Line</button>
          <button type="button" className="esp-mobilebar-btn" disabled={!openBeat || openBeat.approved || openInCutscene} data-testid="script-bar-phone"
            title={openInCutscene ? CUTSCENE_NO_PHONE : undefined} aria-label={openInCutscene ? `Phone: ${CUTSCENE_NO_PHONE}` : undefined}
            onClick={() => setBarRequest({ kind: 'phone', n: Date.now(), beatId: openId })}><Smartphone size={16} aria-hidden="true" /> Phone</button>
          <button type="button" className={`esp-mobilebar-btn${contextOpen ? ' is-on' : ''}`} aria-expanded={contextOpen} data-testid="script-bar-context"
            onClick={() => setContextOpen((o) => !o)}><ListChecks size={16} aria-hidden="true" /> Context</button>
        </div>
      )}
    </div>

    {/* What generation reads, and where the voices come from (Evoni's Episode mock). */}
    {/* On a phone, open, it is a modal sheet (Script page audit 3, 2026-10-19). */}
    <aside className="esp-side" data-testid="script-side" ref={contextSheetRef}
      {...(contextOpen ? { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Context' } : {})}>
      {contextOpen && (
        <button type="button" ref={contextCloseRef} className="esp-side-close" onClick={() => setContextOpen(false)} data-testid="script-context-close"><X size={16} aria-hidden="true" /> Close</button>
      )}
      <section className="esp-uses" data-testid="script-uses">
        <h3 className="esp-side-title">What the script will use</h3>
        <ul className="esp-uses-list">
          {inputs.map((i) => (
            <li key={i.key} className={i.ok ? 'is-ok' : 'is-gap'} data-testid={`script-uses-${i.key}`} data-ok={i.ok ? 'true' : 'false'}>
              <span className="esp-dot" aria-hidden="true" />
              <span><strong>{i.label}</strong> {i.detail}
                {i.fix === 'wardrobe' && !i.ok && <> · <Link className="esp-link" to="?tab=wardrobe">Open Wardrobe</Link></>}
                {i.fix === 'event' && !i.ok && i.to && <> · <Link className="esp-link" to={i.to}>Open the event</Link></>}
              </span>
            </li>
          ))}
        </ul>
        <p className="esp-uses-note">Amber items won't block generating; the script fills the gap and flags it.</p>
      </section>
      {hasScript && (
        <section className="esp-cover" data-testid="script-cover">
          <h3 className="esp-side-title">This episode must cover</h3>
          {cover.length ? (
            <ul className="esp-cover-list">
              {cover.map((c) => (
                <li key={c.key} className={c.beat ? 'is-covered' : ''} data-testid={`script-cover-${c.key}`} data-covered={c.beat ? 'true' : 'false'}>
                  {c.beat ? <Check size={14} aria-label="In the script" /> : <Circle size={14} aria-label="Not in the script yet" />}
                  <span><strong>{c.source}</strong> {c.label}{c.beat ? <span className="esp-cover-beat"> · Beat {c.beat}</span> : null}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="esp-cover-empty" data-testid="script-cover-empty">Nothing to cover: the event has no goals, the brief has no forward hook, and beat 14 has no opportunity coming.</p>
          )}
          <p className="esp-uses-note">From the event package, the brief and beat 14&apos;s opportunity. Ticked when the script mentions it; the opportunity, when beat 14 delivers it as a DM or notification.</p>
        </section>
      )}
      {hasScript && truth && (
        <section className="esp-truth" data-testid="script-beat-state">
          <h3 className="esp-side-title">True at Beat {truth.number}</h3>
          <dl className="esp-truth-list">
            <div data-testid="script-truth-coins"><dt><Coins size={14} aria-hidden="true" /> Coins</dt><dd>{truth.coins.text}{truth.coins.detail && <span className="esp-truth-note">{truth.coins.detail}</span>}
              {/* Spent so far on the look by this beat (Task #3189), from the saved script; hidden at zero. */}
              {Number(shoppingAt?.spent_so_far) > 0 && <span className="esp-truth-note" data-testid="script-truth-spent">Spent on the look so far: 🪙 {Number(shoppingAt.spent_so_far).toLocaleString('en-US')}</span>}</dd></div>
            <div data-testid="script-truth-wearing"><dt><Shirt size={14} aria-hidden="true" /> Wearing</dt><dd>{truth.wearing.text}</dd></div>
            {shoppingAt?.tasks?.length > 0 && (
              <div data-testid="script-truth-shopping"><dt><ListChecks size={14} aria-hidden="true" /> Shopping list</dt><dd>
                {shoppingAt.completion?.completed ?? 0} of {shoppingAt.completion?.total ?? shoppingAt.tasks.length} crossed off
                {shoppingAt.tasks.some((t) => t.completed) && <span className="esp-truth-note">{shoppingAt.tasks.filter((t) => t.completed).map((t) => t.label || t.slot).join(' · ')}</span>}
              </dd></div>
            )}
            {todoMode && (
              <div data-testid="script-truth-todo" data-mode={todoMode.mode}><dt><ListChecks size={14} aria-hidden="true" /> To-do on her phone</dt><dd>
                {TODO_MODE_LABELS[todoMode.mode]}{todoMode.source === 'cue' ? ' (set in this beat)' : ''}
                {todoMode.mode === 'deal' && dealItems.length > 0 && (
                  <span className="esp-truth-note">{deal.label} · {delivered.size} of {dealItems.length} delivered
                    {dealItems.some((i) => delivered.has(String(i.id)) && i.status !== 'approved') ? ' · ready to approve in Money' : ''}</span>
                )}
              </dd></div>
            )}
            <div data-testid="script-truth-where"><dt><MapPin size={14} aria-hidden="true" /> Where</dt><dd>{truth.where}</dd></div>
            <div data-testid="script-truth-room"><dt><Users size={14} aria-hidden="true" /> In the room</dt><dd>Speaking: {truth.speaking}{truth.cast && <span className="esp-truth-note">Cast: {truth.cast}</span>}</dd></div>
            <div data-testid="script-truth-time"><dt><Clock size={14} aria-hidden="true" /> Story time</dt><dd>{truth.storyTime}{truth.eventTimed && <span className="esp-truth-note">The event&apos;s date and time; a beat has no clock of its own</span>}</dd></div>
          </dl>
        </section>
      )}
      {hasScript && openBeatNumber === 14 && beat14 && (
        <Beat14Opportunity showId={showId} episodeId={episodeId} data={beat14} onChange={loadBeat14} designedIntent={brief?.designed_intent || null} />
      )}
      {hasScript && openBeatNumber === 14 && !beat14 && beat14Failed && (
        <p className="esp-cover-empty" role="status" data-testid="script-beat14-unread">Couldn&apos;t read beat 14&apos;s opportunity.</p>
      )}
      {hasScript && openBeat && check && (
        <section className="esp-phonecheck" data-testid="script-phone-check">
          <h3 className="esp-side-title">Phone check · Beat {openBeat.number}</h3>
          {check.moments === 0 ? (
            <p className="esp-cover-empty">No phone or overlay moments in this beat.</p>
          ) : (
            <ul className="esp-cover-list">
              {check.taps.map((t) => (
                <li key={`tap-${t.i}`} className={t.ok ? 'is-covered' : 'is-gap'} data-testid="script-phone-check-tap" data-ok={t.ok ? 'true' : 'false'}>
                  {t.ok ? <Check size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
                  <span>{t.ok ? `Tap ${t.name}: a real path` : t.why}</span>
                </li>
              ))}
              {check.missing.map((m) => (
                <li key={`missing-${m.i}`} className="is-gap" data-testid="script-phone-check-missing">
                  <AlertTriangle size={14} aria-hidden="true" /><span>Not made yet: {m.name}</span>
                </li>
              ))}
              {!check.taps.length && !check.missing.length && <li className="is-covered"><Check size={14} aria-hidden="true" /><span>Every screen and overlay it names is made.</span></li>}
            </ul>
          )}
        </section>
      )}
      {hasScript && openBeat && wearIssues.length > 0 && (
        <section className="esp-phonecheck" data-testid="script-wear-check">
          <h3 className="esp-side-title">Wardrobe cues · Beat {openBeat.number}</h3>
          <ul className="esp-cover-list">
            {wearIssues.map((f) => (
              <li key={`wear-${f.lineIndex}`} className="is-gap" data-testid="script-wear-flag" data-flag={f.flag}>
                <AlertTriangle size={14} aria-hidden="true" /><span>{f.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {hasScript && openBeat && dealIssues.length > 0 && (
        <section className="esp-phonecheck" data-testid="script-deliver-check">
          <h3 className="esp-side-title">Deal cues · Beat {openBeat.number}</h3>
          <ul className="esp-cover-list">
            {dealIssues.map((f) => (
              <li key={`deal-${f.lineIndex}`} className="is-gap" data-testid="script-deliver-flag" data-flag={f.flag}>
                <AlertTriangle size={14} aria-hidden="true" /><span>{f.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="esp-voice" data-testid="script-voice">
        <h3 className="esp-side-title">Voice</h3>
        <p>Lala's voice signature and the cast's voices come from their profiles.</p>
        <Link className="esp-link" to="/character-registry?view=world">Open Character Studio</Link>
      </section>
    </aside>

      {/* DREAM Map Modal */}
      {showMap && (
        <div className="esp-map-backdrop" onClick={() => setShowMap(false)}>
          <div className="esp-map" role="dialog" aria-modal="true" aria-label="DREAM Map" onClick={e => e.stopPropagation()}>
            <div className="esp-map-bar">
              <span className="esp-map-title">DREAM MAP</span>
              <button type="button" ref={mapCloseRef} className="esp-map-close" aria-label="Close map" onClick={() => setShowMap(false)}>×</button>
            </div>
            <Suspense fallback={<div className="esp-map-loading">Loading map...</div>}>
              <DreamMap locations={mapLocations} mapImageUrl={mapImageUrl} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
