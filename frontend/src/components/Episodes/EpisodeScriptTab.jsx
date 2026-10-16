// frontend/src/components/Episodes/EpisodeScriptTab.jsx
// Beat-by-beat script reviewer with Show Brain AI rewrite

import { Fragment, useState, useEffect, useLayoutEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { PenLine, GripVertical, ArrowUp, ArrowDown, Smartphone, Image as ImageIcon, X, Plus, Coins, Shirt, MapPin, Users, ListChecks, Check, Circle, AlertTriangle, Bell, MessageCircle, Send, Clock, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { episodePlanning } from '../../utils/episodePlanning';
import { scriptInputs, mustCover, scriptPeople } from '../../lib/episodeScript';
import { beatState } from '../../lib/beatState';
import { moveBeat, moveLine, dropIndex, replaceBeat, appendLine, insertLine } from '../../lib/scriptBeatOrder';
import { parseMoment, resolveMoment, momentLine, verbLabel, beatOnScreen, deviceLabel, phoneIcons, PHONE_KEY, PHONE_NAME, PHONE_VERBS, OVERLAY_VERBS, DEVICE_VERBS, EXPECTED_ON_SCREEN, hasPhoneMoment, beatSpeakers, phoneCheck, messageLine, closetBeat, wearFlags, uncuedPieces, lastGettingReadyIndex, todoModeAt, deliveredAt, dealCueFlags, TODO_MODE_LABELS } from '../../lib/scriptMoments';
import { isScreen, isIcon, isProduction } from '../../lib/overlayUtils';
import { draftLine, lalaLine, lalaLineSlots } from '../../lib/lalaLineDraft';
import { beatNumberForLabel, BEAT_SPLIT, HAS_BEAT_HEADER } from '../../lib/beatLabelNumber';
import { speakerLine, unquote } from '../../lib/scriptSpeaker';
import { beatImage, beatImageLabel } from '../BeatPlan/BeatPlanParts';
import { beatSeconds, scriptSeconds, formatRuntime } from '../../lib/scriptRuntime';
import { scriptHealth } from '../../lib/scriptHealth';
import ScriptHealthPanel from './ScriptHealthPanel';
import ScriptReadActions from './ScriptReadActions';
import ScriptHistory from './ScriptHistory';
import useScriptDraft from '../../hooks/useScriptDraft';
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
  { number: 11, name: 'Event Outcome',          icon: '🏆', color: 'var(--info-text)' },
  { number: 12, name: 'Deliverable Creation',   icon: '🎨', color: 'var(--info-text)' },
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
export function scriptPreamble(scriptText) {
  if (!HAS_BEAT_HEADER.test(scriptText || '')) return '';
  const first = scriptText.split(BEAT_SPLIT)[0];
  return BEAT_HEADER_START.test(first) ? '' : first.trimEnd();
}

export function parseScriptIntoBeats(scriptText, lockedBeats = []) {
  if (!scriptText?.trim()) return [];
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
      const named = beatNumberForLabel(beatLabel);
      const canon = named ? BEAT_NAMES[named - 1] : null;
      const info = canon || BEAT_NAMES[i] || { number: i + 1, name: beatLabel, icon: '📌', color: 'var(--text-secondary)' };
      const number = canon ? canon.number : i + 1;
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

export function withBeatHeaders(scriptText, lockedBeats = []) {
  if (!String(scriptText || '').trim() || HAS_BEAT_HEADER.test(scriptText)) return scriptText;
  return parseScriptIntoBeats(scriptText, lockedBeats).map((b) => `## BEAT: ${b.number} · ${b.name}\n${b.lines.join('\n')}`).join('\n\n');
}

const CUE_LINE = /^\[(TRANSITION|WEAR|DELIVER|TODO_MODE|SCENE|LOCATION_HINT|EVENT|EPISODE_INTENT)\s*:?\s*(.*?)\s*\]$/i;
function cueLabel(text) {
  const m = String(text || '').match(CUE_LINE);
  if (!m) return null;
  const kind = m[1].toUpperCase();
  const rest = m[2].replace(/^["']|["']$/g, '');
  if (kind === 'TRANSITION') return `Transition${rest ? `: ${rest}` : ''}`;
  if (kind === 'WEAR') return 'Puts on a piece of the look';
  if (kind === 'DELIVER') return 'Delivers a deal item';
  if (kind === 'TODO_MODE') return `Phone to-do list: ${TODO_MODE_LABELS[rest.toLowerCase()] || rest || 'not set'}`;
  if (kind === 'SCENE') return `Scene${rest ? `: ${rest}` : ''}`;
  if (kind === 'LOCATION_HINT') return `Location${rest ? `: ${rest}` : ''}`;
  return `${kind === 'EVENT' ? 'Event' : 'Episode intent'}${rest ? `: ${rest}` : ''}`;
}

const COVERAGE_KINDS = { deliverable: 'Deliverable', goal: 'Goal', hook: 'Forward hook', wear: 'Wear cue', phone: 'Phone moment', beat: 'Beat missing' };

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

function ScriptLine({ line, beatId, beatNumber = null, lineIndex, onEdit, onDelete, onRewrite, rewriting, locked, prevLine = null, nextLine = null, onMoveLine, drag, onScreen, withOnScreen, phoneDown = false }) {
  const [editing, setEditing] = useState(false);
  const [dropAt, setDropAt] = useState(null);
  const [editText, setEditText] = useState('');
  const lineStr = typeof line === 'string' ? line : '';
  const parsed = parseLine(lineStr);
  if (!parsed || parsed.hidden) return null;
  const sc = { Prime: 'var(--primary-text)', Lala: 'var(--accent-dark)', Kelli: 'var(--info-text)', Guest: 'var(--success-text)' };

  if (editing) return (
    <div className="esp-line-edit">
      {/* Escape cancels, Ctrl/Cmd+Enter keeps the line; Ctrl/Cmd+S goes on
          to the tab's own save (Script tab audit, 2026-10-15). */}
      <textarea className="esp-line-input" value={editText} onChange={e => setEditText(e.target.value)} autoFocus rows={3} aria-label="Edit line"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
          else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (onEdit(beatId, lineIndex, editText) !== false) setEditing(false); }
        }} />
      <div className="esp-line-edit-actions">
        {/* A refused edit (a new script is being written) keeps the editor open. */}
        <button type="button" className="esp-btn-primary is-small" onClick={() => { if (onEdit(beatId, lineIndex, editText) !== false) setEditing(false); }}>Save</button>
        <button type="button" className="esp-btn is-small" onClick={() => setEditing(false)}>Cancel</button>
        {onDelete && <button type="button" className="esp-btn is-small esp-line-delete" data-testid="script-line-delete" onClick={() => { if (!window.confirm('Delete this line?')) return; if (onDelete(beatId, lineIndex) !== false) setEditing(false); }}><Trash2 size={13} aria-hidden="true" /> Delete line</button>}
        {/* Moving without dragging (touch screens, keyboards). */}
        <span className="esp-move esp-move--end">
          {/* Past the next line shown, not a hidden [STAT:] line (Script tab re-audit, 2026-10-15). */}
          {/* Typed words go in with Save first (re-audit 2: a move threw them away). */}
          <button type="button" className="esp-move-btn" aria-label="Move line up" title={editText !== lineStr ? 'Save the line first' : undefined} disabled={prevLine === null || editText !== lineStr} onClick={() => { if (onMoveLine(beatId, lineIndex, prevLine) !== false) setEditing(false); }}><ArrowUp size={14} aria-hidden="true" /></button>
          <button type="button" className="esp-move-btn" aria-label="Move line down" title={editText !== lineStr ? 'Save the line first' : undefined} disabled={nextLine === null || editText !== lineStr} onClick={() => { if (onMoveLine(beatId, lineIndex, nextLine) !== false) setEditing(false); }}><ArrowDown size={14} aria-hidden="true" /></button>
        </span>
      </div>
    </div>
  );

  return (
    <div
      className={`esp-line${locked ? ' is-locked' : ''}${dropAt ? ` esp-drop-${dropAt}` : ''}`}
      data-testid="script-line"
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
        <div className="esp-line-dialogue">
          <span className="esp-line-speaker" style={{ '--speaker': sc[parsed.speaker] || 'var(--text-primary)' }}>{parsed.speaker}</span>
          <span className="esp-line-text">"{parsed.text}"</span>
          {!locked && <button type="button" className="esp-rewrite" onClick={e => { e.stopPropagation(); onRewrite(beatId, lineIndex, lineStr); }} disabled={rewriting}>{rewriting ? '⏳' : '✦ Rewrite'}</button>}
        </div>
      )}
      {parsed.type === 'moment' && <MomentCard moment={parsed} shown={resolveMoment(parsed, onScreen)} alongside={withOnScreen} phoneDown={phoneDown} beatNumber={beatNumber} postDrafts={onScreen.postDrafts} />}
      {parsed.type === 'action' && <div className="esp-line-action">{parsed.text}</div>}
      {parsed.type === 'narration' && <div className="esp-line-text">{parsed.text}</div>}
      {parsed.type === 'cue' && <div className="esp-line-cue">{parsed.text}</div>}
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
            ? <span className="esp-moment-drafted" data-testid="script-post-drafted">{draft.status === 'live' ? '✓ Live in Lala\u2019s Feed' : '✓ Draft in Lala\u2019s Feed, waiting for approval'}</span>
            : <span className="esp-moment-opens" data-testid="script-post-pending">Drafted in Lala&apos;s Feed when the script is saved</span>)}
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
        {phoneDown && <span className="esp-moment-missing" data-testid="script-moment-phone-down">Lala&apos;s phone isn&apos;t on screen here. Bring it up first: Phone / overlay, The phone itself.</span>}
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
    <div className="esp-picker" data-testid="script-moment-picker" onClick={(e) => e.stopPropagation()}>
      <div className="esp-picker-head">
        <span className="esp-picker-title">{preset?.title || 'Add to this beat'}</span>
        <button type="button" className="esp-picker-close" aria-label="Close" onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </div>
      <p className="esp-picker-group">Lala&apos;s Phone</p>
      <div className="esp-pick-grid">{phoneItems.map(tile)}</div>
      {iconGroups.map((g) => (
        <div key={g.title} className="esp-pick-icons" data-testid="script-pick-icon-group">
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
  const words = text.trim().replace(/\s+/g, ' ');
  const add = () => {
    if (!words) return;
    const at = after === 'end' ? null : Number(after);
    if (onAdd(LINE_KINDS.find((k) => k.key === kind).write(words), at) === false) return;
    setText('');
    setAdded((n) => n + 1);
    if (at !== null) setAfter(String(at + 1));
  };
  return (
    <div className="esp-picker esp-adder" data-testid="script-line-adder" onClick={(e) => e.stopPropagation()}>
      <div className="esp-picker-head">
        <span className="esp-picker-title">Add a line</span>
        <button type="button" className="esp-picker-close" aria-label="Close" onClick={onClose}><X size={16} aria-hidden="true" /></button>
      </div>
      <span className="esp-picker-verbs" role="group" aria-label="Who">
        {LINE_KINDS.map((k) => (
          <button key={k.key} type="button" className={`esp-verb${kind === k.key ? ' is-on' : ''}`} aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</button>
        ))}
      </span>
      <textarea className="esp-line-input esp-adder-text" data-testid="script-line-adder-text" aria-label="The line" rows={3} value={text}
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
  const add = () => {
    if (!line) return;
    const at = after === 'end' ? null : Number(after);
    if (onAdd(line, at) === false) return;
    setText('');
    setAdded((n) => n + 1);
    if (at !== null) setAfter(String(at + 1));
  };
  return (
    <div className="esp-picker esp-adder" data-testid={`script-message-adder-${kind}`} onClick={(e) => e.stopPropagation()}>
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
      <textarea className="esp-line-input esp-adder-text" data-testid="script-message-text" aria-label="The words" rows={3} value={text}
        placeholder={info.placeholder} onChange={(e) => setText(e.target.value)} />
      {kind === 'post' && <p className="esp-picker-empty">Saving the script drafts this post in Lala&apos;s Feed; it goes live when you approve it there (Requests).</p>}
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

function BeatSection({ beat, index, beatCount, scenePlan, expanded, onToggle, onApprove, proposal = null, onAcceptProposal, onDiscardProposal, onEdit, onDeleteLine, onRewrite, rewritingLine, locking, onOpenMap, onMoveBeat, onMoveLine, drag, onRegenerate, regenerating, writing = false, onScreen, onAddMoment, phoneUpAtStart = false, request = null, onRequestDone, people = [], lalaSlots = [], dressCode = '' }) {
  const scene = scenePlan?.find(p => p.beat_number === beat.number);
  const cardRef = useRef(null);
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [messaging, setMessaging] = useState(null);
  const [zoomed, setZoomed] = useState(false);
  // Each bottom-bar tap acts once: collapsing and reopening the beat no
  // longer opens the adder again (Script tab audit, 2026-10-15).
  const handledRequest = useRef(null);
  // Ask for a change (Script tab audit, 2026-10-15): words for Regenerate beat.
  const [ask, setAsk] = useState('');
  // One beat is written at a time, and none while a new script is: Regenerate
  // and Ask wait (Script tab re-audit, 2026-10-15: Ask cleared the words and
  // sent nothing).
  const cantWrite = regenerating || writing || locking;
  const askChange = () => { const words = ask.trim(); if (!words || cantWrite) return; onRegenerate(beat.id, words); setAsk(''); };
  useEffect(() => {
    if (!request || !expanded || beat.approved || handledRequest.current === request.n) return;
    handledRequest.current = request.n;
    setMessaging(null);
    setAdding(request.kind === 'line' ? 'Lala' : false);
    setPicking(request.kind === 'phone' ? {} : false);
    // Answered, so a remount (Raw editor and back) doesn't open it again.
    onRequestDone?.();
  }, [request, expanded, beat.approved, onRequestDone]);
  const picture = scene?.image || null;
  const expects = EXPECTED_ON_SCREEN[beat.number] || null;
  // The lines the beat shows, by their place in the beat (hidden tags left out).
  const shownLines = beat.lines.map((l, i) => { const p = parseLine(l); return p && !p.hidden ? i : -1; }).filter((i) => i >= 0);
  // What is on screen through the beat, line by line, and everything it uses (Task #2793).
  const { withByLine, used: usedHere, phoneDownAt } = beatOnScreen(beat.lines, onScreen, { phoneUp: phoneUpAtStart });
  // The phone carries in from an earlier beat (Task #2797): it builds this scene too.
  const used = phoneUpAtStart
    ? [{ name: PHONE_NAME, kind: 'device', url: onScreen.phoneFrame || null }, ...usedHere.filter((u) => u.kind !== 'device')] : usedHere;
  const [dropAt, setDropAt] = useState(null);
  const visibleLines = beat.lines.filter(l => { const p = parseLine(l); return p && !p.hidden && p.type !== 'cue'; }).length;
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
          {scene?.scene_set_name && <button type="button" className="esp-beat-scene" onClick={(e) => { e.stopPropagation(); onOpenMap(); }} title="Open DREAM Map">📍 {scene.scene_set_name}{scene?.angle_label ? ` · ${scene.angle_label}` : ''}</button>}
        </div>
        {picture && <span className="esp-beat-thumb" aria-hidden="true"><img src={picture} alt="" loading="lazy" /></span>}
        <span className="esp-beat-count">{visibleLines} line{visibleLines === 1 ? '' : 's'}<span className="esp-beat-runtime" data-testid={`script-beat-runtime-${beat.number}`} title="Rough length: words at 150 a minute, a few seconds per action or moment">{formatRuntime(beatSeconds(beat.lines))}</span></span>
        <span className="esp-beat-chev" aria-hidden="true">▼</span>
      </div>
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
            <p className="esp-beat-nopicture" data-testid={`script-nopicture-${beat.number}`}>No picture for this beat yet · <Link className="esp-link" to="?tab=scenes" onClick={(e) => e.stopPropagation()}>Open Scenes</Link></p>
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
              <Fragment key={`${i}:${line}`}>
                <ScriptLine line={line} beatId={beat.id} lineIndex={i} prevLine={at > 0 ? shownLines[at - 1] : null} nextLine={at >= 0 && at < shownLines.length - 1 ? shownLines[at + 1] : null} onEdit={onEdit} onDelete={onDeleteLine} onRewrite={onRewrite} rewriting={rewritingLine === `${beat.id}-${i}`} locked={beat.approved} onMoveLine={onMoveLine} drag={drag} onScreen={onScreen} withOnScreen={withByLine[i]} phoneDown={phoneDownAt.includes(i)} beatNumber={beat.number} />
                {slot && <LalaLineSlot piece={slot.piece} dressCode={dressCode} onInsert={(text) => onAddMoment(beat.id, text, i)} />}
              </Fragment>
            );
          })}</div>
          {adding && !beat.approved && (
            <LineAdder key={`adder-${adding}`} initialKind={typeof adding === 'string' ? adding : 'Lala'} lines={beat.lines} onScreen={onScreen} onClose={() => setAdding(false)}
              onAdd={(line, after) => onAddMoment(beat.id, line, after)} />
          )}
          {messaging && !beat.approved && (
            <MessageAdder key={`message-${messaging}`} kind={messaging} people={people} lines={beat.lines} onScreen={onScreen}
              onClose={() => setMessaging(null)} onAdd={(line, after) => onAddMoment(beat.id, line, after)} />
          )}
          {picking && !beat.approved && (
            <MomentPicker key={`picker-${picking?.verb || 'open'}`} preset={picking?.verb ? picking : null} screens={onScreen.screens} icons={onScreen.icons} overlays={onScreen.overlays} look={onScreen.look} production={onScreen.production} lines={beat.lines} onScreen={onScreen} phoneFrame={onScreen.phoneFrame}
              onClose={() => setPicking(false)}
              onAdd={(line, after) => onAddMoment(beat.id, line, after)} />
          )}
          <div className="esp-beat-foot">
            {beat.approved && <span className="esp-beat-locked-note">Locked: unlock to edit it, move it, or let Regenerate rewrite it.</span>}
            {!beat.approved && (
              <span className="esp-move">
                <button type="button" className="esp-move-btn" aria-label="Move beat up" data-testid={`script-beat-up-${beat.number}`} disabled={index === 0} onClick={e => { e.stopPropagation(); onMoveBeat(index, index - 1); }}><ArrowUp size={14} aria-hidden="true" /> Up</button>
                <button type="button" className="esp-move-btn" aria-label="Move beat down" data-testid={`script-beat-down-${beat.number}`} disabled={index >= beatCount - 1} onClick={e => { e.stopPropagation(); onMoveBeat(index, index + 1); }}><ArrowDown size={14} aria-hidden="true" /> Down</button>
              </span>
            )}
            {/* "Add:" (Task #2884): one tap to each kind the parser knows. */}
            {!beat.approved && (
              <span className="esp-add-chips" role="group" aria-label="Add" data-testid={`script-add-chips-${beat.number}`}>
                <span className="esp-add-label">Add:</span>
                <button type="button" className="esp-moment-btn" data-testid={`script-add-action-${beat.number}`} onClick={e => { e.stopPropagation(); setPicking(false); setMessaging(null); setAdding('action'); }}>Action</button>
                <button type="button" className="esp-moment-btn" data-testid={`script-add-line-${beat.number}`} onClick={e => { e.stopPropagation(); setPicking(false); setMessaging(null); setAdding('Lala'); }}>Dialogue</button>
                <button type="button" className="esp-moment-btn" data-testid={`script-add-moment-${beat.number}`} onClick={e => { e.stopPropagation(); setAdding(false); setMessaging(null); setPicking({}); }}>Open a screen</button>
                <button type="button" className="esp-moment-btn" data-testid={`script-add-scroll-${beat.number}`} onClick={e => { e.stopPropagation(); setAdding(false); setMessaging(null); setPicking({ verb: 'SCROLL', title: 'Scroll the feed', feed: true }); }}>Scroll the feed</button>
                {/* Task #2885: a notification, a DM or a post. */}
                {Object.keys(MESSAGE_KINDS).map((k) => (
                  <button key={k} type="button" className="esp-moment-btn" data-testid={`script-add-${k}-${beat.number}`}
                    onClick={e => { e.stopPropagation(); setAdding(false); setPicking(false); setMessaging(k); }}>
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
            <button type="button" className={`esp-lock-btn${beat.approved ? ' is-locked' : ''}`} data-testid={`script-lock-${beat.number}`} disabled={locking} onClick={e => { e.stopPropagation(); onApprove(beat.id); }}>{beat.approved ? 'Unlock' : '✓ Approve & lock'}</button>
          </div>
        </div>
      )}
      {zoomed && picture && (
        <div className="esp-zoom" role="dialog" aria-modal="true" aria-label="The scene" data-testid="script-picture-zoom" onClick={(e) => { e.stopPropagation(); setZoomed(false); }}>
          <img src={picture} alt={scene?.image_label || scene?.scene_set_name || 'The scene'} />
          <button type="button" className="esp-zoom-close" aria-label="Close" onClick={(e) => { e.stopPropagation(); setZoomed(false); }}><X size={20} aria-hidden="true" /></button>
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
  const [mapLocations, setMapLocations] = useState([]);
  const [mapImageUrl, setMapImageUrl] = useState(null);
  // What the script will use (Evoni's Episode mock): the brief and the
  // brief's source event, as the Overview reads them.
  const [brief, setBrief] = useState(null);
  const [source, setSource] = useState(null);
  const [deliverables, setDeliverables] = useState([]);
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
  const [barRequest, setBarRequest] = useState(null);
  const clearBarRequest = useCallback(() => setBarRequest(null), []);
  const [contextOpen, setContextOpen] = useState(false);
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
    if (at < 0 || beats[at].approved) return false;
    const base = withBeatHeaders(scriptText, lockedBeats);
    const next = moveLine(base, at, from, to);
    if (next !== base) { setScriptText(next); }
  };

  // A phone moment or an overlay, added at the end of the beat (Task #2789).
  // false when it was not added (the adders then keep what was typed).
  const handleAddMoment = (beatId, line, after = null) => {
    const at = beats.findIndex(b => b.id === beatId);
    if (busy) { flash('Wait for the new script before adding to it.', 'error'); return false; }
    if (at < 0 || beats[at].approved) return false;
    const base = withBeatHeaders(scriptText, lockedBeats);
    const next = after === null ? appendLine(base, at, line) : insertLine(base, at, after, line);
    if (next !== base) { setScriptText(next); }
    return true;
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
    if (busy) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/v1/episodes/${episodeId}`, { script_content: scriptText });
      const stored = typeof res?.data?.data?.script_content === 'string' ? res.data.data.script_content : scriptText;
      const kept = res?.data?.locked_beats_kept || [];
      // Edits made while the save ran stay on the page (still unsaved).
      if (stored !== scriptText && scriptRef.current === scriptText) { setScriptText(stored); }
      setSavedScript(stored);
      setUnsaved(null); setSaved(true); setTimeout(() => setSaved(false), 3000);
      if (kept.length) flash(`Saved. ${keptNote(kept)}.`, 'error', 5000);
      if (/\[UI:\s*POST\s/i.test(stored) && !(await syncPostDrafts())) flash("Saved, but Lala's post drafts could not be made. Save again to retry.", 'error', 6000);
    }
    catch (err) { console.error('[EpisodeScript] save failed:', err); flash('Save failed', 'error'); }
    finally { setSaving(false); }
  }, [busy, episodeId, scriptText, syncPostDrafts]);

  // The episode page holds the episode the tab started from. Each saved
  // script and lock goes back to it, so leaving the tab and coming back
  // shows what was saved, not what the page first read.
  const reportedRef = useRef(null);
  useEffect(() => {
    const now = JSON.stringify([savedScript, lockedBeats]);
    if (reportedRef.current === null) { reportedRef.current = now; return; }
    if (now === reportedRef.current) return;
    reportedRef.current = now;
    onSaved?.({ script_content: savedScript, script_locked_beats: lockedBeats });
  }, [savedScript, lockedBeats, onSaved]);

  // Unsaved edits: the episode page asks before another tab is opened, the
  // browser asks before the page is closed or reloaded, and Ctrl/Cmd+S saves.
  const dirty = scriptText !== savedScript;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
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
      if (dirty && !saving && !busy) handleSave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, saving, busy, handleSave]);

  const handleEditLine = (beatId, lineIndex, newText) => {
    if (busy) { flash('Wait for the new script before editing it.', 'error'); return false; }
    const next = scriptWithLine(scriptText, lockedBeats, beatId, lineIndex, newText);
    if (next !== null) setScriptText(next);
  };

  // Delete a line (Script tab audit, 2026-10-15): asked in the line's editor;
  // an approved beat keeps its lines. Save keeps it.
  const handleDeleteLine = (beatId, lineIndex) => {
    if (busy) { flash('Wait for the new script before editing it.', 'error'); return false; }
    const next = scriptWithoutLine(scriptText, lockedBeats, beatId, lineIndex);
    if (next !== null) setScriptText(next);
  };

  // Rewrite one line (Evoni, 2026-10-08: "when i click rewrite in script
  // nothing happens? ... is it reading what i already have?"). The rewrite
  // reads the whole beat around the line, and keeps the line's speaker: the
  // route returns the words only, and putting them in place of the whole
  // line dropped "Prime:", so the line turned into narration and lost its
  // Rewrite button. A failure says why.
  const handleRewriteLine = async (beatId, lineIndex, originalLine) => {
    const beat = beats.find(b => b.id === beatId);
    if (busy || beat?.approved) return;
    const key = `${beatId}-${lineIndex}`;
    setRewritingLine(key);
    try {
      const parsed = parseLine(originalLine);
      const res = await api.post(`/api/v1/episode-brief/${episodeId}/rewrite-line`, {
        line: originalLine, speaker: parsed?.speaker || 'Prime', beatName: beat?.name,
        beatContext: scenePlan.find(p => p.beat_number === beat?.number)?.emotional_intent,
        beatLines: (beat?.lines || []).filter((l) => typeof l === 'string' && l.trim() && !parseLine(l)?.hidden),
        showId,
      });
      if (!mountedRef.current) return;
      const next = rewrittenLine(originalLine, res.data?.rewrittenLine);
      if (!next) { flash('The rewrite came back the same; try again.', 'error'); return; }
      if (parseScriptIntoBeats(scriptRef.current, lockedRef.current).find(b => b.id === beatId)?.approved !== false) { flash('The line changed or was approved while it was being rewritten, so the rewrite was not put in.', 'error', 6000); return; }
      // Shown in its beat first; "Use it" puts it in (acceptProposal).
      setProposal({ kind: 'line', beatId, lineIndex, originalLine, text: next });
    } catch (err) {
      console.error('[EpisodeScript] rewrite failed:', err);
      flash(`Rewrite failed: ${err.response?.data?.error || err.message || 'no answer'}`, 'error', 6000);
    } finally { if (mountedRef.current) setRewritingLine((r) => (r === key ? null : r)); }
  };

  // Regenerate one beat (Evoni, 2026-10-09, Task #2785: "what if I only want
  // to regenerate a line or a beat?"). The beat is written again against the
  // script as the page has it and put in place; Save keeps it.
  // `instruction`: Evoni's words from Ask for a change, sent with the beat.
  const handleRegenerateBeat = async (beatId, instruction = '') => {
    const beat = beats.find(b => b.id === beatId);
    if (busy || !beat || beat.approved || regeneratingBeat) return;
    setRegeneratingBeat(beatId);
    try {
      const res = await api.post(`/api/v1/episode-brief/${episodeId}/regenerate-beat`, { showId, beatNumber: beat.number, script: withBeatHeaders(scriptText, lockedBeats), ...(instruction ? { instruction } : {}) });
      if (!mountedRef.current) return;
      const proposed = String(res.data?.beat || '');
      const nowBeat = parseScriptIntoBeats(withBeatHeaders(scriptRef.current, lockedRef.current), lockedRef.current).find(b => b.id === beatId);
      if (!nowBeat || nowBeat.approved) { flash(`Beat ${beat.number} was approved or removed while it was being written, so the new version was not put in.`, 'error', 6000); return; }
      if (!/^\s*##\s*BEAT:/i.test(proposed) || (nowBeat && nowBeat.raw.trimEnd() === proposed.trimEnd())) { flash('The beat came back the same; try again.', 'error'); return; }
      // Shown in the beat first; "Use it" puts it in (acceptProposal).
      setProposal({ kind: 'beat', beatId, number: beat.number, text: proposed });
    } catch (err) {
      console.error('[EpisodeScript] beat regenerate failed:', err);
      flash(`Regenerate failed: ${err.response?.data?.error || err.message || 'no answer'}`, 'error', 6000);
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
    setProposal(null);
    if (p.kind === 'line') {
      const current = scriptRef.current;
      const nowBeat = parseScriptIntoBeats(current, lockedRef.current).find(b => b.id === p.beatId);
      const at = nowBeat?.lines[p.lineIndex] === p.originalLine ? p.lineIndex : (nowBeat?.lines.indexOf(p.originalLine) ?? -1);
      const written = at < 0 ? null : scriptWithLine(current, lockedRef.current, p.beatId, at, p.text);
      if (written === null) { flash('The line changed or was approved while it was being rewritten, so the rewrite was not put in.', 'error', 6000); return; }
      setScriptText(written);
      flash('Line rewritten ✦ Save to keep it.', 'success');
      return;
    }
    const current = withBeatHeaders(scriptRef.current, lockedRef.current);
    const nowBeats = parseScriptIntoBeats(current, lockedRef.current);
    const at = nowBeats.findIndex(b => b.id === p.beatId);
    if (at < 0 || nowBeats[at].approved) { flash(`Beat ${p.number} was approved or removed while it was being written, so the new version was not put in.`, 'error', 6000); return; }
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
      setLockedBeats(Array.isArray(data.script_locked_beats) ? data.script_locked_beats : next);
      if (sendText) {
        const stored = typeof data.script_content === 'string' ? data.script_content : text;
        if (stored !== scriptText && scriptRef.current === scriptText) { setScriptText(stored); }
        setSavedScript(stored); setUnsaved(null);
        // A save with the lock drafts Lala's posts as Save does.
        if (/\[UI:\s*POST\s/i.test(stored) && !(await syncPostDrafts())) flash("Saved, but Lala's post drafts could not be made. Save again to retry.", 'error', 6000);
      }
      const kept = res?.data?.locked_beats_kept || [];
      if (kept.length) flash(`${keptNote(kept)}.`, 'error', 5000);
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
            setScriptText(script); setSavedScript(script); setUnsaved(null);
            if (Array.isArray(ep.script_locked_beats)) setLockedBeats(ep.script_locked_beats);
            flash('✦ Script generated and saved.', 'success', 5000);
            return;
          }
        } catch (err) { console.error('[EpisodeScript] waiting for the script:', err); }
      }
      if (mountedRef.current) setGenError('The new script has not arrived after 4 minutes. Refresh later to see whether it was saved.');
    } finally { if (mountedRef.current) setWaitingForScript(false); }
  };

  const handleGenerate = async (keepsLocked = false) => {
    setGenerating(true); setGenError(null); setGuardResult(null); setCoverage(null);
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
      if (res.data.saved !== false) { setSavedScript(script); if (/\[UI:\s*POST\s/i.test(script)) syncPostDrafts(); }
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
  beats.reduce((up, b, i) => { phoneUpAtStart[i] = up; return beatOnScreen(b.lines, onScreen, { phoneUp: up }).phoneUpAtEnd; }, false);

  // The beat list and pills (Task #2881): the script's own beats, each marked
  // when it has a phone moment; the open beat's context for the chips.
  const openId = expandedBeat === undefined ? beats[0]?.id : expandedBeat;
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
  const phoneBeats = new Set(beats.filter((b) => hasPhoneMoment(b.lines, onScreen)).map((b) => b.id));
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
  const plan = source?.event
    ? episodePlanning({ episode, event: source.event, sourceProfile: source.sourceProfile, sceneSet: source.sceneSet, venueLocation: source.venueLocation })
    : null;
  const inputs = scriptInputs({ brief, plan, outfit, event: source?.event || null, deliverables });
  // What the episode must cover, ticked from the script, and the open beat's
  // phone check (Task #2884).
  const cover = mustCover({ beats, deliverables, event: source?.event || null, brief });
  // The phone starts each beat where the beat before left it, not on the
  // home screen (Script tab audit, 2026-10-15).
  const phoneScreenAt = [];
  beats.reduce((at, b, i) => { phoneScreenAt[i] = at; return phoneCheck(b.lines, onScreen, { startAt: at }).endAt; }, null);
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
    closetNumber: closetBeat(scriptText), dirty: scriptText !== savedScript, unsaved,
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
          <button type="button" className="esp-btn-primary is-small" data-testid="script-unsaved-save" onClick={handleSave} disabled={saving || busy}>{saving ? '⏳ Saving…' : '💾 Save now'}</button>
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
        {hasScript ? (
          <div className="esp-actions">
            {/* Table read and Export (Script tab audit, 2026-10-15): the script as on the page. */}
            <ScriptHistory episodeId={episodeId} dirty={scriptText !== savedScript} onRestore={(text) => {
              if (busy) { flash('Wait for the new script before putting a version back.', 'error'); return; }
              setScriptText(text);
              flash('An earlier version is on the page ✦ Save to keep it.', 'success', 5000);
            }} />
            <ScriptReadActions scriptText={scriptText} title={episode?.title || (episode?.episode_number ? `Episode ${episode.episode_number}` : 'Script')} dirty={scriptText !== savedScript} onScreen={onScreenWithDrafts} scenePlan={scenePlan} startBeat={Math.max(0, beats.indexOf(openBeat))} />
            <button type="button" className={`esp-btn${developerMode ? ' is-on' : ''}`} onClick={() => setDeveloperMode(d => !d)}>{developerMode ? 'Beat view' : 'Raw editor'}</button>
            <button type="button" className="esp-btn" data-testid="script-regenerate" onClick={() => {
              const ask = approvedCount > 0
                ? `Regenerate the unlocked beats? The ${approvedCount} approved beat${approvedCount === 1 ? '' : 's'} stay${approvedCount === 1 ? 's' : ''} exactly as ${approvedCount === 1 ? 'it is' : 'they are'}; the rest of the script is replaced.`
                : 'Regenerate the entire script? Your current script will be replaced.';
              if (!window.confirm(ask)) return;
              // Already confirmed here, so the server's own "replace it?" is answered.
              handleGenerate(true);
            }} disabled={generating}>{waitingForScript ? 'Still writing…' : generating ? 'Generating…' : approvedCount > 0 ? 'Regenerate unlocked' : 'Regenerate'}</button>
            <button type="button" className={`esp-btn-primary${saved ? ' is-saved' : ''}`} onClick={handleSave} disabled={saving || busy}>{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}</button>
          </div>
        ) : (
          <button type="button" className="esp-btn-primary is-large" onClick={() => handleGenerate()} disabled={generating}>
            {waitingForScript ? 'Still writing the 14 beats…' : generating ? 'Generating the 14 beats…' : 'Generate Script'}
          </button>
        )}
      </section>
      {genError && <div className="esp-error" role="alert">{genError}</div>}
      {coverage && (coverage.missing?.length > 0 || coverage.fixed_beats?.length > 0) && (
        <div className={`esp-coverage${coverage.missing?.length ? ' is-gaps' : ''}`} role="status" data-testid="script-coverage">
          {coverage.fixed_beats?.length > 0 && <p className="esp-coverage-line">✦ The writer rewrote beat{coverage.fixed_beats.length === 1 ? '' : 's'} {coverage.fixed_beats.join(', ')} to cover what the episode needs.</p>}
          {coverage.missing?.length > 0 && (
            <>
              <p className="esp-coverage-line">Still not in the script:</p>
              <ul className="esp-coverage-list">
                {coverage.missing.slice(0, 8).map((m, i) => <li key={`${m.kind}-${i}`}>{COVERAGE_KINDS[m.kind] || m.kind}: {m.label}{m.target ? ` (beat ${m.target})` : ''}</li>)}
              </ul>
            </>
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
          <button type="button" className="esp-btn-primary is-small" data-testid="script-draft-restore" onClick={() => { setScriptText(draft.offer.text); draft.discard(); flash('Your unsaved changes are back ✦ Save to keep them.', 'success', 5000); }}>Put them back</button>
          <button type="button" className="esp-btn is-small" data-testid="script-draft-discard" onClick={draft.discard}>Discard</button>
        </div>
      )}
      {showBeatList && <ScriptHealthPanel rows={healthRows} beatNumbers={Object.fromEntries(beats.map((b) => [b.id, b.number]))} onOpenBeat={chooseBeat} />}
      {/* At phone width (Task #2881): the beats as pills, and the open beat's
          context from the episode's own data. */}
      {showBeatList && (
        <>
          <div className="esp-pills" role="list" aria-label="Beats" data-testid="script-pills">
            {beats.map((b) => (
              <button key={b.id} type="button" role="listitem" className={`esp-pill${b.id === openId ? ' is-open' : ''}`} aria-current={b.id === openId ? 'true' : undefined}
                data-testid={`script-pill-${b.number}`} onClick={() => chooseBeat(b.id)}>
                {b.number} · {b.name}
                {phoneBeats.has(b.id) && <Smartphone size={13} aria-label="Has a phone moment" />}
              </button>
            ))}
          </div>
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
      {developerMode && <textarea className="esp-raw" aria-label="Raw script" value={scriptText} readOnly={busy} onChange={e => setScriptText(e.target.value)} rows={30} />}

      {!developerMode && (hasScript ? (
        <div className={busy ? 'esp-beats is-busy' : 'esp-beats'} aria-busy={busy || undefined} data-testid="script-beats">
          {beats.length > 1 && <p className="esp-order-hint">Drag a beat by its handle, or a line within its beat, to change the order. A beat keeps its number and name wherever it goes. Approved beats stay where they are.</p>}
          {beats.map((beat, index) => {
            const open = (expandedBeat === undefined ? beats[0]?.id : expandedBeat) === beat.id;
            const phoneUp = phoneUpAtStart[index] || false;
            return <BeatSection key={beat.id} request={open && barRequest?.beatId === beat.id ? barRequest : null} beat={beat} index={index} beatCount={beats.length} scenePlan={scenePlan} expanded={open} onToggle={() => setExpandedBeat(open && !isPhoneWidth() ? null : beat.id)} onApprove={handleApprove} proposal={proposal?.beatId === beat.id ? proposal : null} onAcceptProposal={acceptProposal} onDiscardProposal={() => setProposal(null)} onEdit={handleEditLine} onDeleteLine={handleDeleteLine} onRewrite={handleRewriteLine} rewritingLine={rewritingLine} locking={locking || busy} onOpenMap={() => setShowMap(true)} onMoveBeat={handleMoveBeat} onMoveLine={handleMoveLine} drag={drag} onRegenerate={handleRegenerateBeat} regenerating={regeneratingBeat === beat.id} writing={!!regeneratingBeat || busy} onRequestDone={clearBarRequest} onScreen={onScreenWithDrafts} onAddMoment={handleAddMoment} phoneUpAtStart={phoneUp} people={people} lalaSlots={lineSlots.filter((s) => s.beatIndex === index)} dressCode={source?.event?.dress_code || ''} />;
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
              <button type="button" className="esp-btn-primary" onClick={handleSave} disabled={saving || busy}>💾 Save Final Script</button>
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
      {hasScript && scriptText !== savedScript && (
        <div className="esp-savebar" data-testid="script-savebar" role="region" aria-label="Unsaved changes">
          <span className="esp-savebar-text">Unsaved changes</span>
          <button type="button" className="esp-btn-primary is-small" data-testid="script-savebar-save" onClick={handleSave} disabled={saving || busy}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      )}

      {/* At phone width (Task #2881): add to the open beat, or see its context. */}
      {showBeatList && (
        <div className="esp-mobilebar" data-testid="script-mobilebar" role="region" aria-label="Add to the open beat">
          <button type="button" className="esp-mobilebar-btn" disabled={!openBeat || openBeat.approved} data-testid="script-bar-line"
            onClick={() => setBarRequest({ kind: 'line', n: Date.now(), beatId: openId })}><Plus size={16} aria-hidden="true" /> Line</button>
          <button type="button" className="esp-mobilebar-btn" disabled={!openBeat || openBeat.approved} data-testid="script-bar-phone"
            onClick={() => setBarRequest({ kind: 'phone', n: Date.now(), beatId: openId })}><Smartphone size={16} aria-hidden="true" /> Phone</button>
          <button type="button" className={`esp-mobilebar-btn${contextOpen ? ' is-on' : ''}`} aria-expanded={contextOpen} data-testid="script-bar-context"
            onClick={() => setContextOpen((o) => !o)}><ListChecks size={16} aria-hidden="true" /> Context</button>
        </div>
      )}
    </div>

    {/* What generation reads, and where the voices come from (Evoni's Episode mock). */}
    <aside className="esp-side" data-testid="script-side">
      {contextOpen && (
        <button type="button" className="esp-side-close" onClick={() => setContextOpen(false)} data-testid="script-context-close"><X size={16} aria-hidden="true" /> Close</button>
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
            <p className="esp-cover-empty" data-testid="script-cover-empty">Nothing to cover: the event has no deliverables or goals, and the brief has no forward hook.</p>
          )}
          <p className="esp-uses-note">From the event package and the brief. Ticked when the script mentions it.</p>
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
          <div className="esp-map" role="dialog" aria-label="DREAM Map" onClick={e => e.stopPropagation()}>
            <div className="esp-map-bar">
              <span className="esp-map-title">DREAM MAP</span>
              <button type="button" className="esp-map-close" aria-label="Close map" onClick={() => setShowMap(false)}>×</button>
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
