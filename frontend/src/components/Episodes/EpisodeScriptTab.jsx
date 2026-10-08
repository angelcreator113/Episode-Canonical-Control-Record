// frontend/src/components/Episodes/EpisodeScriptTab.jsx
// Beat-by-beat script reviewer with Show Brain AI rewrite

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { PenLine, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import api from '../../services/api';
import { episodePlanning } from '../../utils/episodePlanning';
import { scriptInputs } from '../../lib/episodeScript';
import { moveBeat, moveLine, dropIndex } from '../../lib/scriptBeatOrder';
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
  if (!/##\s*BEAT:/i.test(scriptText || '')) return '';
  const first = scriptText.split(/(?=##\s*BEAT:)/i)[0];
  return BEAT_HEADER_START.test(first) ? '' : first.trimEnd();
}

export function parseScriptIntoBeats(scriptText, lockedBeats = []) {
  if (!scriptText?.trim()) return [];
  const locked = new Set(lockedBeats);
  if (/##\s*BEAT:/i.test(scriptText)) {
    const sections = scriptText.split(/(?=##\s*BEAT:)/i).filter(s => BEAT_HEADER_START.test(s));
    const seen = new Map();
    return sections.map((section, i) => {
      const lines = section.split('\n').filter(l => l.trim());
      const header = lines[0] || '';
      const beatMatch = header.match(/##\s*BEAT:\s*(.+)/i);
      const beatLabel = beatMatch?.[1]?.trim() || `Beat ${i + 1}`;
      const numbered = Number((beatLabel.match(/^(\d{1,2})\b/) || [])[1]);
      const canon = numbered >= 1 && numbered <= BEAT_NAMES.length ? BEAT_NAMES[numbered - 1] : null;
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

function parseLine(line) {
  const t = (typeof line === 'string' ? line : '').trim();
  if (!t) return null;
  if (/^\[UI:|^\[STAT:|^\[MAIL:/i.test(t)) return { type: 'ui', text: t, hidden: true };
  if (/^\(.*\)$/.test(t)) return { type: 'action', text: t };
  const m = t.match(/^(Me|Prime|Lala|Kelli|Guest|[A-Z][a-z]+):\s*(.+)/);
  if (m) return { type: 'dialogue', speaker: m[1] === 'Me' ? 'Prime' : m[1], text: m[2].replace(/^[""]|[""]$/g, '') };
  return { type: 'narration', text: t };
}

function ScriptLine({ line, beatId, lineIndex, onEdit, onRewrite, rewriting, locked, lineCount, onMoveLine, drag }) {
  const [editing, setEditing] = useState(false);
  const [dropAt, setDropAt] = useState(null);
  const [editText, setEditText] = useState('');
  const lineStr = typeof line === 'string' ? line : '';
  const parsed = parseLine(lineStr);
  if (!parsed || parsed.hidden) return null;
  const sc = { Prime: 'var(--primary-text)', Lala: 'var(--accent-dark)', Kelli: 'var(--info-text)', Guest: 'var(--success-text)' };

  if (editing) return (
    <div className="esp-line-edit">
      <textarea className="esp-line-input" value={editText} onChange={e => setEditText(e.target.value)} autoFocus rows={3} aria-label="Edit line" />
      <div className="esp-line-edit-actions">
        <button type="button" className="esp-btn-primary is-small" onClick={() => { onEdit(beatId, lineIndex, editText); setEditing(false); }}>Save</button>
        <button type="button" className="esp-btn is-small" onClick={() => setEditing(false)}>Cancel</button>
        {/* Moving without dragging (touch screens, keyboards). */}
        <span className="esp-move esp-move--end">
          <button type="button" className="esp-move-btn" aria-label="Move line up" disabled={lineIndex === 0} onClick={() => { onMoveLine(beatId, lineIndex, lineIndex - 1); setEditing(false); }}><ArrowUp size={14} aria-hidden="true" /></button>
          <button type="button" className="esp-move-btn" aria-label="Move line down" disabled={lineIndex >= lineCount - 1} onClick={() => { onMoveLine(beatId, lineIndex, lineIndex + 1); setEditing(false); }}><ArrowDown size={14} aria-hidden="true" /></button>
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
    >
      {parsed.type === 'dialogue' && (
        <div className="esp-line-dialogue">
          <span className="esp-line-speaker" style={{ '--speaker': sc[parsed.speaker] || 'var(--text-primary)' }}>{parsed.speaker}</span>
          <span className="esp-line-text">"{parsed.text}"</span>
          {!locked && <button type="button" className="esp-rewrite" onClick={e => { e.stopPropagation(); onRewrite(beatId, lineIndex, lineStr); }} disabled={rewriting}>{rewriting ? '⏳' : '✦ Rewrite'}</button>}
        </div>
      )}
      {parsed.type === 'action' && <div className="esp-line-action">{parsed.text}</div>}
      {parsed.type === 'narration' && <div className="esp-line-text">{parsed.text}</div>}
    </div>
  );
}

function BeatSection({ beat, index, beatCount, scenePlan, expanded, onToggle, onApprove, onEdit, onRewrite, rewritingLine, locking, onOpenMap, onMoveBeat, onMoveLine, drag }) {
  const scene = scenePlan?.find(p => p.beat_number === beat.number);
  const cardRef = useRef(null);
  const [dropAt, setDropAt] = useState(null);
  const visibleLines = beat.lines.filter(l => { const p = parseLine(l); return p && !p.hidden; }).length;
  return (
    <div
      ref={cardRef}
      data-testid={`script-beat-${beat.number}`}
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
        <span className="esp-beat-num">{beat.number}</span>
        <div className="esp-beat-title">
          <div className="esp-beat-name-row">
            <span className="esp-beat-icon" aria-hidden="true">{beat.icon}</span>
            <span className="esp-beat-name">{beat.name}</span>
            {beat.approved && <span className="esp-chip-approved" title="Approved beats are locked: they can't be edited, and Regenerate keeps them as they are.">🔒 APPROVED</span>}
          </div>
          {scene?.scene_set_name && <button type="button" className="esp-beat-scene" onClick={(e) => { e.stopPropagation(); onOpenMap(); }} title="Open DREAM Map">📍 {scene.scene_set_name}{scene?.angle_label ? ` · ${scene.angle_label}` : ''}</button>}
        </div>
        <span className="esp-beat-count">{visibleLines} line{visibleLines === 1 ? '' : 's'}</span>
        <span className="esp-beat-chev" aria-hidden="true">▼</span>
      </div>
      {expanded && (
        <div className="esp-beat-body">
          {scene?.scene_context && <div className="esp-beat-context">🎬 {scene.scene_context.slice(0, 200)}{scene.scene_context.length > 200 ? '...' : ''}</div>}
          {scene?.emotional_intent && <div className="esp-beat-intent">✦ {scene.emotional_intent}</div>}
          <div className="esp-lines">{beat.lines.map((line, i) => <ScriptLine key={`${i}:${line}`} line={line} beatId={beat.id} lineIndex={i} lineCount={beat.lines.length} onEdit={onEdit} onRewrite={onRewrite} rewriting={rewritingLine === `${beat.id}-${i}`} locked={beat.approved} onMoveLine={onMoveLine} drag={drag} />)}</div>
          <div className="esp-beat-foot">
            {beat.approved && <span className="esp-beat-locked-note">Locked: unlock to edit it, move it, or let Regenerate rewrite it.</span>}
            {!beat.approved && (
              <span className="esp-move">
                <button type="button" className="esp-move-btn" aria-label="Move beat up" data-testid={`script-beat-up-${beat.number}`} disabled={index === 0} onClick={e => { e.stopPropagation(); onMoveBeat(index, index - 1); }}><ArrowUp size={14} aria-hidden="true" /> Up</button>
                <button type="button" className="esp-move-btn" aria-label="Move beat down" data-testid={`script-beat-down-${beat.number}`} disabled={index >= beatCount - 1} onClick={e => { e.stopPropagation(); onMoveBeat(index, index + 1); }}><ArrowDown size={14} aria-hidden="true" /> Down</button>
              </span>
            )}
            <button type="button" className={`esp-lock-btn${beat.approved ? ' is-locked' : ''}`} data-testid={`script-lock-${beat.number}`} disabled={locking} onClick={e => { e.stopPropagation(); onApprove(beat.id); }}>{beat.approved ? 'Unlock' : '✓ Approve & lock'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EpisodeScriptTab({ episode, show }) {
  const episodeId = episode?.id;
  const showId = show?.id || episode?.show_id;
  const [scriptText, setScriptText] = useState(episode?.script_content || '');
  // The script as last saved, so locking knows whether the page has edits
  // to save with the lock.
  const [savedScript, setSavedScript] = useState(episode?.script_content || '');
  const [lockedBeats, setLockedBeats] = useState(() => (Array.isArray(episode?.script_locked_beats) ? episode.script_locked_beats : []));
  const [locking, setLocking] = useState(false);
  const [beats, setBeats] = useState([]);
  // undefined: nothing chosen yet, so the first beat is open.
  const [expandedBeat, setExpandedBeat] = useState(undefined);
  const [scenePlan, setScenePlan] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rewritingLine, setRewritingLine] = useState(null);
  const [developerMode, setDeveloperMode] = useState(false);
  const [devScript, setDevScript] = useState('');
  const [toast, setToast] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
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
  // The outfit locked on the Wardrobe tab, which the script writer reads (null: could not be read).
  const [outfit, setOutfit] = useState([]);

  // Load map data when map is opened
  useEffect(() => {
    if (!showMap) return;
    listLocationsApi().then(d => setMapLocations(d.locations || [])).catch(() => {});
    getWorldMapApi().then(d => { if (d.url) setMapImageUrl(d.url); }).catch(() => {});
  }, [showMap]);

  useEffect(() => {
    if (!episodeId) return;
    const script = episode?.script_content || '';
    const locks = Array.isArray(episode?.script_locked_beats) ? episode.script_locked_beats : [];
    setScriptText(script); setDevScript(script); setSavedScript(script); setLockedBeats(locks);
    if (script) setBeats(parseScriptIntoBeats(script, locks));
    api.get(`/api/v1/episode-brief/${episodeId}`).then(({ data }) => {
      const b = data?.data || null;
      setBrief(b);
      if (b?.event_id && showId) {
        api.get(`/api/v1/world/${showId}/events/${b.event_id}`)
          .then((res) => setSource(res.data || null))
          .catch((err) => console.error('[EpisodeScript] source event load failed:', err));
      }
    }).catch((err) => console.error('[EpisodeScript] brief load failed:', err));
    api.get(`/api/v1/wardrobe/outfit/${episodeId}`)
      .then((res) => setOutfit(res.data?.items || []))
      .catch((err) => { console.error('[EpisodeScript] locked outfit load failed:', err); setOutfit(null); });
    api.get(`/api/v1/episode-brief/${episodeId}/plan`).then(res => {
      setScenePlan((res.data?.data || []).map(p => ({ ...p, scene_set_name: p.sceneSet?.name || null, scene_context: p.scene_context || p.sceneSet?.script_context || null })));
    }).catch(() => {});
  }, [episodeId]);

  useEffect(() => { if (scriptText) setBeats(parseScriptIntoBeats(scriptText, lockedBeats)); }, [scriptText, lockedBeats]);

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
    if (beats[from]?.approved) return;
    const next = moveBeat(scriptText, from, to);
    if (next === scriptText) return;
    // The open beat stays open where it lands (the default open beat is
    // whichever is first, so it is pinned before the order changes).
    if (expandedBeat === undefined) setExpandedBeat(beats[0]?.id ?? null);
    setScriptText(next); setDevScript(next);
  };
  const handleMoveLine = (beatId, from, to) => {
    const at = beats.findIndex(b => b.id === beatId);
    if (at < 0 || beats[at].approved) return;
    const next = moveLine(scriptText, at, from, to);
    if (next !== scriptText) { setScriptText(next); setDevScript(next); }
  };

  const flash = (msg, type, ms = 3000) => { setToast({ msg, type }); setTimeout(() => setToast(null), ms); };

  // The server puts a locked beat back as it was (src/utils/scriptBeatLocks.js)
  // and names it; the page then shows the script as saved.
  const keptNote = (kept) => `Beat${kept.length === 1 ? '' : 's'} ${kept.join(', ')} ${kept.length === 1 ? 'is' : 'are'} locked, so ${kept.length === 1 ? 'it was' : 'they were'} kept as approved`;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await api.put(`/api/v1/episodes/${episodeId}`, { script_content: scriptText });
      const stored = typeof res?.data?.data?.script_content === 'string' ? res.data.data.script_content : scriptText;
      const kept = res?.data?.locked_beats_kept || [];
      if (stored !== scriptText) { setScriptText(stored); setDevScript(stored); }
      setSavedScript(stored);
      setUnsaved(null); setSaved(true); setTimeout(() => setSaved(false), 3000);
      if (kept.length) flash(`Saved. ${keptNote(kept)}.`, 'error', 5000);
    }
    catch (err) { console.error('[EpisodeScript] save failed:', err); flash('Save failed', 'error'); }
    finally { setSaving(false); }
  }, [episodeId, scriptText]);

  const handleEditLine = (beatId, lineIndex, newText) => {
    if (beats.find(b => b.id === beatId)?.approved) return;
    const nb = beats.map(b => { if (b.id !== beatId) return b; const nl = [...b.lines]; nl[lineIndex] = newText; return { ...b, lines: nl, edited: true }; });
    setBeats(nb);
    // Only the edited beat is rewritten; the text before the first beat and
    // every other beat stay exactly as they are (a locked beat included).
    const body = nb.map(b => (b.edited || !b.raw?.trim() || !BEAT_HEADER_START.test(b.raw) ? `## BEAT: ${b.rawLabel}\n${b.lines.join('\n')}` : b.raw.trimEnd())).join('\n\n');
    const preamble = scriptPreamble(scriptText);
    setScriptText(preamble ? `${preamble}\n\n${body}` : body);
  };

  const handleRewriteLine = async (beatId, lineIndex, originalLine) => {
    const beat = beats.find(b => b.id === beatId);
    if (beat?.approved) return;
    setRewritingLine(`${beatId}-${lineIndex}`);
    try {
      const parsed = parseLine(originalLine);
      const res = await api.post(`/api/v1/episode-brief/${episodeId}/rewrite-line`, { line: originalLine, speaker: parsed?.speaker || 'Prime', beatName: beat?.name, beatContext: scenePlan.find(p => p.beat_number === beat?.number)?.emotional_intent, showId });
      handleEditLine(beatId, lineIndex, res.data.rewrittenLine);
      flash('Line rewritten ✦', 'success');
    } catch (err) { console.error('[EpisodeScript] rewrite failed:', err); flash('Rewrite failed', 'error'); }
    finally { setRewritingLine(null); }
  };

  // Approve = lock (Evoni, 2026-10-08). The lock is kept on the episode, so
  // it survives a reload, and Regenerate leaves the beat as it is. Edits the
  // page hasn't saved go with the lock, so the beat is locked as shown.
  const handleApprove = async (beatId) => {
    const beat = beats.find(b => b.id === beatId);
    if (!beat || locking) return;
    const next = beat.approved ? lockedBeats.filter(n => n !== beat.number) : [...lockedBeats, beat.number].sort((a, b) => a - b);
    const dirty = scriptText !== savedScript;
    setLocking(true);
    try {
      const res = await api.put(`/api/v1/episodes/${episodeId}/script-locks`, { locked_beats: next, ...(dirty ? { script_content: scriptText } : {}) });
      const data = res?.data?.data || {};
      setLockedBeats(Array.isArray(data.script_locked_beats) ? data.script_locked_beats : next);
      if (dirty) {
        const stored = typeof data.script_content === 'string' ? data.script_content : scriptText;
        if (stored !== scriptText) { setScriptText(stored); setDevScript(stored); }
        setSavedScript(stored); setUnsaved(null);
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
  const handleGenerate = async (keepsLocked = false) => {
    setGenerating(true); setGenError(null); setGuardResult(null);
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
      setScriptText(script); setDevScript(script);
      if (res.data.saved !== false) setSavedScript(script);
      // The server saves as part of success (audit GATE-03). Generated but
      // not saved: keep the draft here and say so; Save keeps it without
      // another generation.
      const notSaved = res.data.saved === false ? (res.data.error || 'The script was generated but could not be saved.') : null;
      setUnsaved(notSaved);

      // §8(j): every canonical beat should come back under its own header.
      const check = res.data.beat_check;
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
      setTimeout(() => setToast(null), 5000);
    } catch (err) { setGenError(err.response?.data?.error || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const approvedCount = beats.filter(b => b.approved).length;
  const allApproved = beats.length > 0 && approvedCount === beats.length;
  const hasScript = !!scriptText?.trim();
  const plan = source?.event
    ? episodePlanning({ episode, event: source.event, sourceProfile: source.sourceProfile, sceneSet: source.sceneSet, venueLocation: source.venueLocation })
    : null;
  const inputs = scriptInputs({ brief, plan, outfit });

  return (
    <div className="esp">
    <div className="esp-main">
      {toast && <div className={`esp-toast is-${toast.type === 'error' ? 'error' : 'success'}`} role="status">{toast.msg}</div>}

      {unsaved && (
        <div className="esp-unsaved-banner" data-testid="script-unsaved" role="alert">
          <span className="esp-unsaved-banner-text"><strong>Not saved.</strong> {unsaved} The draft is only on this page until it is saved.</span>
          <button type="button" className="esp-btn-primary is-small" data-testid="script-unsaved-save" onClick={handleSave} disabled={saving}>{saving ? '⏳ Saving…' : '💾 Save now'}</button>
        </div>
      )}
      {/* The script's card (Evoni's Episode mock): its state, and its actions. */}
      <section className="esp-head" data-testid="script-head">
        <div className="esp-head-text">
          <h2 className="esp-title">Script</h2>
          <p className="esp-sub">
            {hasScript ? <>{beats.length} beats · {approvedCount} approved{allApproved && <span className="esp-complete"> · Complete</span>}{scriptText !== savedScript && <span className="esp-unsaved" data-testid="script-dirty"> · Unsaved changes</span>}</> : 'Not generated yet'}
          </p>
        </div>
        {hasScript ? (
          <div className="esp-actions">
            <button type="button" className={`esp-btn${developerMode ? ' is-on' : ''}`} onClick={() => setDeveloperMode(d => !d)}>{developerMode ? 'Beat view' : 'Raw editor'}</button>
            <button type="button" className="esp-btn" data-testid="script-regenerate" onClick={() => {
              const ask = approvedCount > 0
                ? `Regenerate the unlocked beats? The ${approvedCount} approved beat${approvedCount === 1 ? '' : 's'} stay${approvedCount === 1 ? 's' : ''} exactly as ${approvedCount === 1 ? 'it is' : 'they are'}; the rest of the script is replaced.`
                : 'Regenerate the entire script? Your current script will be replaced.';
              if (!window.confirm(ask)) return;
              handleGenerate(approvedCount > 0);
            }} disabled={generating}>{generating ? 'Generating…' : approvedCount > 0 ? 'Regenerate unlocked' : 'Regenerate'}</button>
            <button type="button" className={`esp-btn-primary${saved ? ' is-saved' : ''}`} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}</button>
          </div>
        ) : (
          <button type="button" className="esp-btn-primary is-large" onClick={() => handleGenerate()} disabled={generating}>
            {generating ? 'Generating the 14 beats…' : 'Generate Script'}
          </button>
        )}
      </section>
      {genError && <div className="esp-error" role="alert">{genError}</div>}

      {hasScript && developerMode && approvedCount > 0 && <p className="esp-raw-note" data-testid="script-raw-locked-note">🔒 Approved beats are locked. Changes to them here are put back when the script is saved.</p>}
      {hasScript && developerMode && <textarea className="esp-raw" aria-label="Raw script" value={devScript} onChange={e => { setDevScript(e.target.value); setScriptText(e.target.value); }} rows={30} />}

      {!developerMode && (hasScript ? (
        <div>
          {beats.length > 1 && <p className="esp-order-hint">Drag a beat by its handle, or a line within its beat, to change the order. A beat keeps its number and name wherever it goes. Approved beats stay where they are.</p>}
          {beats.map((beat, index) => {
            const open = (expandedBeat === undefined ? beats[0]?.id : expandedBeat) === beat.id;
            return <BeatSection key={beat.id} beat={beat} index={index} beatCount={beats.length} scenePlan={scenePlan} expanded={open} onToggle={() => setExpandedBeat(open ? null : beat.id)} onApprove={handleApprove} onEdit={handleEditLine} onRewrite={handleRewriteLine} rewritingLine={rewritingLine} locking={locking} onOpenMap={() => setShowMap(true)} onMoveBeat={handleMoveBeat} onMoveLine={handleMoveLine} drag={drag} />;
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
              <button type="button" className="esp-btn-primary" onClick={handleSave}>💾 Save Final Script</button>
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
    </div>

    {/* What generation reads, and where the voices come from (Evoni's Episode mock). */}
    <aside className="esp-side">
      <section className="esp-uses" data-testid="script-uses">
        <h3 className="esp-side-title">What the script will use</h3>
        <ul className="esp-uses-list">
          {inputs.map((i) => (
            <li key={i.key} className={i.ok ? 'is-ok' : 'is-gap'} data-testid={`script-uses-${i.key}`} data-ok={i.ok ? 'true' : 'false'}>
              <span className="esp-dot" aria-hidden="true" />
              <span><strong>{i.label}</strong> {i.detail}
                {i.fix === 'wardrobe' && !i.ok && <> · <Link className="esp-link" to="?tab=wardrobe">Open Wardrobe</Link></>}
              </span>
            </li>
          ))}
        </ul>
        <p className="esp-uses-note">Amber items won't block generating; the script fills the gap and flags it.</p>
      </section>
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
