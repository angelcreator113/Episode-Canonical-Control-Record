/**
 * StoryEvaluationEngine.jsx — v2
 *
 * Multi-agent blind story generation → editorial evaluation →
 * memory proposals → registry update proposals → manuscript write-back.
 *
 * Light theme. All AI calls routed through backend.
 *
 * Flow:
 *   1. BRIEF     — Write scene brief, pick characters
 *   2. GENERATE  — Backend spawns 3 blind voices in parallel
 *   3. READ      — Read all 3 versions side-by-side
 *   4. EVALUATE  — Claude Opus scores + synthesises approved version
 *   5. MEMORY    — Propose plot memories + character revelations
 *   6. REGISTRY  — Propose registry profile updates
 *   7. WRITE-BACK — Commit to manuscript chapter + confirm memories
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../services/api';
import './StoryEvaluationEngine.css';

const API = '/api/v1/memories';

// ─── Track 6 CP10 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 6 helpers covering 5 fetch sites. listRegistriesApi + listBooksApi +
// getBookApi duplicated locally per v2.12 §9.11 (cross-CP from CP3+CP6+
// CP7+CP8 / CP5 / CP3 respectively — listRegistriesApi reaches 6-fold
// existence as the most-duplicated helper in F-AUTH-1).
//
// VARIABLE-URL split (line 1243): pre-migration `fetchChapters(bookId)`
// fetched `/storyteller/books/:id` when bookId provided OR
// `/storyteller/chapters` when no bookId. Split into 2 helpers per v2.13
// §9.11 method-branching split pattern, applied to URL-branching: caller
// does the conditional ternary at the call site.
export const getWorldContextSummaryApi = () =>
  apiClient.get('/api/v1/world/context-summary');
export const listRegistriesApi = () =>
  apiClient.get('/api/v1/character-registry/registries');
export const getCharacterSceneContextApi = (charKey, registryId) =>
  apiClient.get(`/api/v1/character-registry/characters/scene-context/${encodeURIComponent(charKey)}?registry_id=${encodeURIComponent(registryId)}`);
export const listBooksApi = () =>
  apiClient.get('/api/v1/storyteller/books');
export const getBookApi = (bookId) =>
  apiClient.get(`/api/v1/storyteller/books/${encodeURIComponent(bookId)}`);
export const listAllChaptersApi = () =>
  apiClient.get('/api/v1/storyteller/chapters');

// ── Light theme ───────────────────────────────────────────────────────────
const T_LIGHT = {
  bg:          '#f5f5f5',
  surface:     '#ffffff',
  surfaceAlt:  '#f8f8f8',
  border:      '#e0e0e0',
  borderLight: '#d0d0d0',
  text:        '#1a1a1a',
  textDim:     '#666666',
  textFaint:   '#999999',
  accent:      '#c9a96e',
  accentHover: '#b8944e',
  red:         '#c96e6e',
  green:       '#6ec9a0',
  blue:        '#6e9ec9',
  purple:      '#9e6ec9',
  orange:      '#c9886e',
};

const T_DARK = {
  bg:          '#1a1a1e',
  surface:     '#25252b',
  surfaceAlt:  '#2a2a30',
  border:      '#3a3a42',
  borderLight: '#44444e',
  text:        '#e8e8ec',
  textDim:     '#a0a0aa',
  textFaint:   '#707078',
  accent:      '#d4b47a',
  accentHover: '#c9a96e',
  red:         '#d48888',
  green:       '#88d4b0',
  blue:        '#88b0d4',
  purple:      '#b088d4',
  orange:      '#d4a088',
};

// T starts as light; component updates it synchronously during render
let T = { ...T_LIGHT };

const VOICES = [
  { id: 'voice_a', label: 'Voice A', tag: 'Depth · Interiority',   accent: '#6B4C82', bg: '#faf8fc', border: '#e8e0f0', emoji: '◆' },
  { id: 'voice_b', label: 'Voice B', tag: 'Tension · Momentum',    accent: '#3D7A9B', bg: '#f6fafc', border: '#d8e8f0', emoji: '◈' },
  { id: 'voice_c', label: 'Voice C', tag: 'Sensory · Desire',      accent: '#4A8A3D', bg: '#f6faf4', border: '#d8f0d0', emoji: '◉' },
];

const CRITERIA = ['interiority', 'desire_tension', 'specificity', 'stakes', 'voice', 'body_presence', 'originality', 'prose_efficiency', 'scene_fulfillment'];
const CRITERIA_LABELS = {
  interiority:       'Interiority',
  desire_tension:    'Desire & Tension',
  specificity:       'Specificity',
  stakes:            'Stakes',
  voice:             'Voice',
  body_presence:     'Body Presence',
  originality:       'Originality',
  prose_efficiency:  'Prose Efficiency',
  scene_fulfillment: 'Scene Fulfillment',
};

const STEPS = ['brief', 'generate', 'read', 'evaluate', 'memory', 'registry', 'writeback'];
const STEP_LABELS = ['Brief', 'Generate', 'Read', 'Evaluate', 'Memory', 'Registry', 'Write-Back'];

const CONTENT_TYPES = [
  'Novel', 'Short Story', 'Screenplay', 'TV Pilot', 'TV Episode',
  'Stage Play', 'Memoir', 'Personal Essay', 'Newsletter', 'Song Lyrics',
  'Poetry Collection', 'Graphic Novel', 'Game Narrative', 'Podcast Script', 'Other',
];

const TONES = [
  { id: 'literary',      label: 'Literary',      desc: 'Psychological depth, subtext, thematic resonance', emoji: '📖' },
  { id: 'thriller',      label: 'Thriller',      desc: 'Pacing, stakes escalation, chapter-end hooks', emoji: '⚡' },
  { id: 'lyrical',       label: 'Lyrical',       desc: 'Sensory language, metaphor, emotional texture', emoji: '🌊' },
  { id: 'intimate',      label: 'Intimate',      desc: 'Closeness, body language, breath, desire', emoji: '🤫' },
  { id: 'dark',          label: 'Dark',          desc: 'Tension, moral ambiguity, unflinching honesty', emoji: '🖤' },
  { id: 'warm',          label: 'Warm',          desc: 'Connection, humour, earned tenderness', emoji: '☀️' },
  { id: 'confessional',  label: 'Confessional',  desc: 'Raw honesty, direct address, breaking the fourth wall', emoji: '🪞' },
  { id: 'ambient',       label: 'Ambient',       desc: 'Atmospheric, slow-burn, texture over plot', emoji: '🌫️' },
  { id: 'charged',       label: 'Charged',       desc: 'Electric tension, desire, everything about to happen', emoji: '🔥' },
];

const EMPTY_BRIEF = {
  scene_title: '', situation: '', content_name: '', content_type: '', content_type_other: '',
  content_history: '', why_it_matters: '', life_constraints: '', support_system: '',
  emotional_stakes: '', what_failure_means: '', deadline_context: '', deadline_pressure: '',
  characters: [], registry_id: '', internal_conflict: '', world_context: '',
  must_include: '', never_include: '',
};

const BRIEF_REQUIRED = ['situation', 'content_name', 'content_type', 'emotional_stakes', 'characters'];

const SESSION_KEY = 'see-session';

// ── Brief richness scoring ────────────────────────────────────────────
function briefRichness(b) {
  const fields = ['situation', 'content_history', 'why_it_matters', 'life_constraints',
    'support_system', 'emotional_stakes', 'what_failure_means', 'internal_conflict', 'world_context'];
  let totalChars = 0;
  let filledCount = 0;
  fields.forEach(k => {
    const v = (b[k] || '').trim();
    if (v) { filledCount++; totalChars += v.length; }
  });
  if (filledCount === 0) return { score: 0, label: 'Empty', color: T.red };
  const avgLen = totalChars / filledCount;
  const depthScore = Math.min(100, Math.round((filledCount / fields.length) * 50 + Math.min(avgLen / 3, 50)));
  if (depthScore >= 75) return { score: depthScore, label: 'Rich', color: T.green };
  if (depthScore >= 45) return { score: depthScore, label: 'Moderate', color: T.accent };
  return { score: depthScore, label: 'Thin', color: T.red };
}

// ── Extract content info from a task/situation string ─────────────────
const CONTENT_TYPE_PATTERNS = [
  { pattern: /\b(newsletter|email\s*blast|dispatch|substack)\b/i, type: 'Newsletter', nameHint: 'newsletter' },
  { pattern: /\b(novel|book|manuscript)\b/i, type: 'Novel', nameHint: 'novel' },
  { pattern: /\b(short\s*story|flash\s*fiction)\b/i, type: 'Short Story', nameHint: 'short story' },
  { pattern: /\b(screen\s*play|script|film)\b/i, type: 'Screenplay', nameHint: 'screenplay' },
  { pattern: /\b(pilot|tv\s*episode|episode)\b/i, type: 'TV Episode', nameHint: 'episode' },
  { pattern: /\b(play|monologue|stage)\b/i, type: 'Stage Play', nameHint: 'play' },
  { pattern: /\b(memoir|autobiography)\b/i, type: 'Memoir', nameHint: 'memoir' },
  { pattern: /\b(essay|op[\s-]?ed|column|article|blog\s*post|post)\b/i, type: 'Personal Essay', nameHint: 'essay' },
  { pattern: /\b(song|lyrics|track|single|album)\b/i, type: 'Song Lyrics', nameHint: 'song' },
  { pattern: /\b(poem|poetry|chapbook|verse)\b/i, type: 'Poetry Collection', nameHint: 'poem' },
  { pattern: /\b(graphic\s*novel|comic|manga)\b/i, type: 'Graphic Novel', nameHint: 'graphic novel' },
  { pattern: /\b(game|interactive|visual\s*novel)\b/i, type: 'Game Narrative', nameHint: 'game narrative' },
  { pattern: /\b(podcast|audio)\b/i, type: 'Podcast Script', nameHint: 'podcast' },
  { pattern: /\b(reel|video|vlog|youtube|tiktok|content|thumbnail)\b/i, type: 'Other', nameHint: 'content' },
  { pattern: /\b(course|workshop|class|lesson)\b/i, type: 'Other', nameHint: 'course' },
  { pattern: /\b(pitch|proposal|presentation)\b/i, type: 'Other', nameHint: 'pitch' },
  { pattern: /\b(chapter|section|draft)\b/i, type: 'Novel', nameHint: 'chapter' },
];

function extractContentFromTask(taskText) {
  if (!taskText) return {};
  const result = {};

  // Try to find the creative output being described
  // Look for patterns like "her weekly newsletter", "a new reel", "the final chapter"
  const possessiveMatch = taskText.match(/\b(?:her|his|their|the|a|an)\s+([\w\s]+?)(?:\s+(?:by|before|while|for|in|on|at|about|during|after|from|to|into|that)\b|[,.]|$)/i);
  if (possessiveMatch) {
    // Clean up the extracted name
    let name = possessiveMatch[0].replace(/\s+(by|before|while|for|in|on|at|about|during|after|from|to|into|that)\b.*$/i, '').trim();
    // Remove trailing punctuation
    name = name.replace(/[,.]$/, '').trim();
    if (name.length > 3 && name.length < 80) {
      result.content_name = name;
    }
  }

  // Try to match a content type
  for (const { pattern, type } of CONTENT_TYPE_PATTERNS) {
    if (pattern.test(taskText)) {
      result.content_type = type;
      break;
    }
  }

  return result;
}

function briefCompleteness(b) {
  const chars = Array.isArray(b.characters) ? b.characters : [];
  const filled = BRIEF_REQUIRED.filter(k => k === 'characters' ? chars.length > 0 : (b[k] || '').trim());
  return Math.round((filled.length / BRIEF_REQUIRED.length) * 100);
}

function composeBrief(b) {
  const cType = b.content_type === 'Other' ? b.content_type_other : b.content_type;
  return [
    b.situation,
    b.content_name ? `The piece, "${b.content_name}"${cType ? ` (${cType})` : ''},` : '',
    b.content_history,
    b.why_it_matters,
    b.life_constraints ? `Life context: ${b.life_constraints}.` : '',
    b.support_system,
    b.deadline_context,
    b.emotional_stakes ? `The emotional stakes: ${b.emotional_stakes}.` : '',
    b.what_failure_means,
    b.internal_conflict,
    b.world_context,
    b.must_include ? `Must include: ${b.must_include}.` : '',
    b.never_include ? `Must avoid: ${b.never_include}.` : '',
  ].filter(Boolean).join(' ');
}

// briefInputStyle and briefTextareaStyle are computed inside the component
// so they pick up the current theme value after darkMode toggles.

// ── API helpers — Track 3 migration: delegates to apiClient (auth via interceptor) ──
// Public contract preserved: returns parsed body; throws Error with backend
// message on non-2xx; throws "Request timed out" on AbortError/ECONNABORTED.
async function apiPost(endpoint, body, { timeoutMs = 30000 } = {}) {
  try {
    const res = await apiClient.post(`${API}/${endpoint}`, body, { timeout: timeoutMs });
    return res.data;
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.name === 'AbortError') {
      throw new Error('Request timed out — please try again');
    }
    const msg = err.response?.data?.error || err.message || 'Request failed';
    throw new Error(msg);
  }
}

async function apiGet(endpoint, { timeoutMs = 30000 } = {}) {
  try {
    const res = await apiClient.get(`${API}/${endpoint}`, { timeout: timeoutMs });
    return res.data;
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.name === 'AbortError') {
      throw new Error('Request timed out — please try again');
    }
    const msg = err.response?.data?.error || err.message || 'Request failed';
    throw new Error(msg);
  }
}

// ── Spinner ───────────────────────────────────────────────────────────────
function Spinner({ color, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 14 }}>
      <div style={{
        width: 28, height: 28, border: '2px solid #e0e0e0',
        borderTop: `2px solid ${color || T.accent}`, borderRadius: '50%',
        animation: 'see2-spin 0.9s linear infinite',
      }} />
      <span style={{ color: T.textFaint, fontSize: 10, fontFamily: 'monospace', letterSpacing: 1 }}>{label || 'working...'}</span>
    </div>
  );
}

// ── Story Reader Panel ────────────────────────────────────────────────────
function StoryReader({ text, accent, maxHeight }) {
  const paras = (text || '').split('\n').filter(p => p.trim());
  return (
    <div style={{ overflowY: 'auto', maxHeight: maxHeight || 420, paddingRight: 8 }}>
      {paras.map((p, i) => (
        <p key={i} style={{
          color: i === 0 ? T.text : '#555',
          fontSize: 13.5, lineHeight: 1.95, marginBottom: 16,
          fontFamily: "'Palatino Linotype',Palatino,Georgia,serif",
        }}>
          {i === 0
            ? <><span style={{ color: accent, fontSize: 22, fontWeight: 700, float: 'left', lineHeight: 1, marginRight: 4, marginTop: 3 }}>{p[0]}</span>{p.slice(1)}</>
            : p}
        </p>
      ))}
    </div>
  );
}

// ── Score Bar ─────────────────────────────────────────────────────────────
function ScoreBar({ value, max, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color || T.accent, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: T.text, minWidth: 20, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ── Memory Proposal Card ──────────────────────────────────────────────────
function MemoryCard({ item, selected, onToggle, accentColor }) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: 12, borderRadius: 8, cursor: 'pointer',
        background: selected ? `${accentColor}10` : T.surface,
        border: `1px solid ${selected ? accentColor : T.border}`,
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
            color: accentColor, display: 'inline-block', padding: '2px 6px',
            background: `${accentColor}15`, borderRadius: 3, marginBottom: 6,
          }}>{item.type}</span>
          <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{item.content}</div>
          {item.reason && <div style={{ fontSize: 11, color: T.textDim, marginTop: 4, fontStyle: 'italic' }}>{item.reason}</div>}
        </div>
        <div style={{
          width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginLeft: 10,
          border: `2px solid ${selected ? accentColor : T.border}`,
          background: selected ? accentColor : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}>
          {selected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
        </div>
      </div>
    </div>
  );
}

// ── Brief form helpers ────────────────────────────────────────────────────
function BriefField({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 4, letterSpacing: 0.3 }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 10, color: T.textFaint, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function CharTag({ name, onRemove }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', background: `${T.accent}18`, border: `1px solid ${T.accent}40`,
      borderRadius: 20, fontSize: 12, color: T.accent, fontWeight: 500,
    }}>
      {name}
      <button
        onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, fontSize: 14, padding: 0, lineHeight: 1 }}
      >×</button>
    </span>
  );
}

// ── Browser notification helper ─────────────────────────────────────────
function notify(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(title, { body, icon: '/favicon.ico' });
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function StoryEvaluationEngine() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── State ────────────────────────────────────────────────────────────
  const [step, setStep] = useState('brief');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Brief (structured)
  const [brief, setBrief] = useState(EMPTY_BRIEF);
  const [charInput, setCharInput] = useState('');
  const [charContext, setCharContext] = useState({}); // { character_key: { living_context, relationships, display_name } }
  const [charFetchStatus, setCharFetchStatus] = useState({}); // { character_key: 'loading'|'loaded'|'failed' }
  const updateBrief = (key, val) => setBrief(prev => ({
    ...prev,
    [key]: key === 'characters' ? (Array.isArray(val) ? val : []) : val,
  }));

  // Tone dial — multi-select (array of tone IDs)
  const [toneDial, setToneDial] = useState(['literary']);

  // Generation result
  const [storyId, setStoryId] = useState(null);
  const [stories, setStories] = useState(null); // { voice_a, voice_b, voice_c }
  const [activeVoice, setActiveVoice] = useState('voice_a');
  const [tokenUsage, setTokenUsage] = useState(null); // { input, output }
  const [enrichmentLoaded, setEnrichmentLoaded] = useState(null); // which context layers were found

  // Evaluation result
  const [evaluation, setEvaluation] = useState(null);
  const [scoreOverrides, setScoreOverrides] = useState(null);
  const [editingScores, setEditingScores] = useState(false);
  const [sceneRevelations, setSceneRevelations] = useState(null); // { [char_key]: { dimension: { field: val } } }
  const [revLoading, setRevLoading] = useState(false);

  // Memory proposals
  const [plotMemories, setPlotMemories] = useState([]);
  const [revelations, setRevelations] = useState([]);
  const [selectedPlot, setSelectedPlot] = useState(new Set());
  const [selectedRev, setSelectedRev] = useState(new Set());

  // Registry proposals
  const [regUpdates, setRegUpdates] = useState([]);
  const [selectedReg, setSelectedReg] = useState(new Set());

  // Write-back
  const [chapterId, setChapterId] = useState('');
  const [writeResult, setWriteResult] = useState(null);
  const [chapters, setChapters] = useState([]); // [{ id, title, book_id }]
  const [chapterSearch, setChapterSearch] = useState('');
  const [books, setBooks] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState('');

  // Timer
  const [elapsed, setElapsed] = useState(0);

  // Post-synthesis editing
  const [editingApproved, setEditingApproved] = useState(false);
  const [approvedText, setApprovedText] = useState('');

  // Session reset flag — triggers auto-fill re-fetch after clearing stale data
  const [sessionCleared, setSessionCleared] = useState(0);

  // Side-by-side voice comparison
  const [viewMode, setViewMode] = useState('tab'); // 'tab' | 'sideBySide'

  // ── Dark Mode ────────────────────────────────────────────────────────
  const DARK_KEY = 'see-dark-mode';
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem(DARK_KEY) === '1'; } catch { return false; }
  });
  // Update module-level T synchronously during render (not in useEffect)
  // so sub-components and style objects always see current theme
  Object.assign(T, darkMode ? T_DARK : T_LIGHT);

  const briefInputStyle = {
    width: '100%', padding: '10px 12px', background: T.surfaceAlt,
    border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const briefTextareaStyle = {
    ...briefInputStyle, padding: '12px 14px', fontSize: 13.5,
    lineHeight: 1.7, fontFamily: 'Georgia,serif', resize: 'vertical',
  };

  useEffect(() => {
    try { localStorage.setItem(DARK_KEY, darkMode ? '1' : '0'); } catch { /* quota */ }
  }, [darkMode]);

  // ── History ──────────────────────────────────────────────────────────
  const HISTORY_KEY = 'see-history';
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const [diffSelected, setDiffSelected] = useState([]); // [id, id] for comparison
  const [diffOpen, setDiffOpen] = useState(false);

  const saveToHistory = useCallback((sessionData) => {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: new Date().toISOString(),
      scene_title: sessionData.brief?.scene_title || 'Untitled Scene',
      characters: sessionData.brief?.characters || [],
      tone: Array.isArray(sessionData.toneDial) ? sessionData.toneDial.join(', ') : sessionData.toneDial || 'literary',
      winner: sessionData.evaluation?.winner || null,
      winner_reason: sessionData.evaluation?.winner_reason || '',
      scores: sessionData.evaluation?.scores || null,
      approved_version: sessionData.evaluation?.approved_version || '',
      approved_preview: (sessionData.evaluation?.approved_version || '').slice(0, 200),
      story_id: sessionData.storyId,
      brief_summary: (sessionData.brief?.situation || '').slice(0, 150),
      brief: sessionData.brief || null,
      toneDial: sessionData.toneDial || ['literary'],
    };
    setHistoryEntries(prev => {
      const next = [entry, ...prev].slice(0, 50); // keep last 50
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  const loadFromHistory = useCallback((entry) => {
    if (!window.confirm('Load this evaluation? Current progress will be replaced.')) return;
    setHistoryOpen(false);
    if (entry.brief) {
      setBrief(prev => ({ ...EMPTY_BRIEF, ...entry.brief }));
    } else if (entry.scene_title || entry.characters?.length) {
      setBrief(prev => ({ ...EMPTY_BRIEF, scene_title: entry.scene_title || '', characters: entry.characters || [] }));
    }
    if (entry.toneDial) {
      setToneDial(Array.isArray(entry.toneDial) ? entry.toneDial : [entry.toneDial]);
    } else if (entry.tone) {
      setToneDial(entry.tone.split(/,\s*/).filter(Boolean));
    }
    if (entry.scores) setEvaluation({ scores: entry.scores, winner: entry.winner, winner_reason: entry.winner_reason, approved_version: entry.approved_version || '' });
    if (entry.story_id) setStoryId(entry.story_id);
    if (entry.scores) setStep('evaluate');
  }, []);

  const clearHistory = useCallback(() => {
    if (!window.confirm('Clear all evaluation history?')) return;
    setHistoryEntries([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  // ── Batch export all history entries as PDF ──────────────────────────
  const batchExportHistory = useCallback(() => {
    if (!historyEntries.length) return;
    const parts = [];
    parts.push(`<h1 style="font-family:Georgia,serif;margin-bottom:4px">Evaluation History Export</h1>`);
    parts.push(`<p style="color:#666;font-size:12px">${historyEntries.length} evaluations · Exported ${new Date().toLocaleDateString()}</p><hr/>`);
    historyEntries.forEach((entry, idx) => {
      parts.push(`<div style="page-break-before:${idx > 0 ? 'always' : 'auto'};margin-top:${idx > 0 ? '20px' : '0'}">`);
      parts.push(`<h2 style="font-family:Georgia,serif;color:#1a1a1a;margin-bottom:6px">${idx + 1}. ${(entry.scene_title || 'Untitled').replace(/</g, '&lt;')}</h2>`);
      parts.push(`<p style="font-size:12px;color:#666">${new Date(entry.date).toLocaleDateString()} ${new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Tone: ${entry.tone || 'literary'}</p>`);
      if (entry.characters?.length) parts.push(`<p style="font-size:12px;color:#444">Characters: ${entry.characters.join(', ')}</p>`);
      if (entry.winner) parts.push(`<p style="font-size:13px;color:#2a8a5e;font-weight:600">Winner: ${entry.winner} — ${(entry.winner_reason || '').replace(/</g, '&lt;')}</p>`);
      if (entry.scores) {
        parts.push(`<div style="margin:8px 0">`);
        Object.entries(entry.scores).forEach(([voice, sc]) => {
          const isWinner = voice === entry.winner;
          parts.push(`<span style="display:inline-block;margin-right:12px;font-size:12px;padding:2px 8px;border-radius:10px;background:${isWinner ? '#e8f5e9' : '#f5f5f5'};color:${isWinner ? '#2a8a5e' : '#666'};font-weight:600">${voice.replace('voice_', 'V').toUpperCase()}: ${sc.total}</span>`);
        });
        parts.push(`</div>`);
      }
      if (entry.brief_summary) parts.push(`<p style="font-size:12px;color:#888;font-style:italic">${entry.brief_summary.replace(/</g, '&lt;')}</p>`);
      parts.push(`</div>`);
    });
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`<!DOCTYPE html><html><head><title>Evaluation History Export</title><style>body{font-family:'DM Sans',Helvetica,sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#1a1a1a}@media print{body{padding:20px}div{page-break-inside:avoid}}</style></head><body>${parts.join('')}</body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 300);
  }, [historyEntries]);

  // ── Session persistence — save/restore from localStorage ──────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.brief) {
          // Ensure characters is always an array (guards against corrupt localStorage)
          if (!Array.isArray(s.brief.characters)) {
            s.brief.characters = typeof s.brief.characters === 'string'
              ? s.brief.characters.split(',').map(c => c.trim()).filter(Boolean)
              : [];
          }
          setBrief({ ...EMPTY_BRIEF, ...s.brief });
        }
        if (s.toneDial) setToneDial(Array.isArray(s.toneDial) ? s.toneDial : [s.toneDial]);
        if (s.step) setStep(s.step);
        if (s.storyId) setStoryId(s.storyId);
        if (s.stories) setStories(s.stories);
        if (s.evaluation) setEvaluation(s.evaluation);
        if (s.chapterId) setChapterId(s.chapterId);
      }
    } catch { /* ignore corrupt localStorage */ }
  }, []);

  useEffect(() => {
    try {
      const payload = { brief, toneDial, step, storyId, stories, evaluation, chapterId };
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch { /* quota exceeded — silent */ }
  }, [brief, toneDial, step, storyId, stories, evaluation, chapterId]);

  // ── World context auto-enrich ──────────────────────────────────────
  const [worldCtx, setWorldCtx] = useState(null);
  const [worldCtxOpen, setWorldCtxOpen] = useState(false);
  useEffect(() => {
    getWorldContextSummaryApi()
      .then(res => setWorldCtx(res.data))
      .catch(() => {});
  }, []);

  const applyWorldCtx = useCallback(() => {
    if (!worldCtx) return;
    const parts = [];
    if (worldCtx.locations?.length) parts.push(`Locations: ${worldCtx.locations.join(', ')}`);
    if (worldCtx.facts?.length) parts.push(`Facts: ${worldCtx.facts.join('; ')}`);
    if (worldCtx.threads?.length) parts.push(`Active threads: ${worldCtx.threads.join('; ')}`);
    if (worldCtx.tensionCount) parts.push(`${worldCtx.tensionCount} active tension pairs`);
    const existing = (brief.world_context || '').trim();
    const newCtx = existing ? existing + '\n' + parts.join('. ') : parts.join('. ');
    updateBrief('world_context', newCtx);
    setWorldCtxOpen(false);
  }, [worldCtx, brief.world_context, updateBrief]);

  // ── Auto-fill from URL params + router state on mount ──────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const st = location.state || {};
    const task = st.taskBrief;
    const patch = {};

    // URL params
    const briefParam = params.get('brief');
    if (briefParam) {
      try { patch.situation = decodeURIComponent(briefParam); }
      catch { patch.situation = briefParam; }
    }
    const charParam = params.get('chars') || params.get('char');
    if (charParam) patch.characters = charParam.split(',').map(c => c.trim()).filter(Boolean);
    const regParam = params.get('registry_id');
    if (regParam) patch.registry_id = regParam;

    const ALL_VALID_TONES = ['literary', 'thriller', 'lyrical', 'intimate', 'dark', 'warm', 'confessional', 'ambient', 'charged'];

    // Router state — rich task data
    if (task) {
      if (task.title) patch.scene_title = task.title;

      // ── ① Situation — rich multi-situation description ──
      const sitParts = [];
      if (task.chapter_theme) sitParts.push(`Chapter theme: ${task.chapter_theme}`);
      if (task.task) sitParts.push(task.task);
      if (task.situations?.length) {
        // New arc format: situations are objects with situation_type, tone, what_happens, etc.
        const isObjectFormat = typeof task.situations[0] === 'object';
        if (isObjectFormat) {
          sitParts.push('');
          sitParts.push(`Chapter situations (${task.situations.length}):`);
          task.situations.forEach((s, i) => {
            const label = s.title || s.situation_type || `Situation ${i + 1}`;
            const tone = s.tone ? ` [${s.tone}]` : '';
            sitParts.push(`\n${i + 1}. ${label}${tone}`);
            if (s.what_happens) sitParts.push(`   ${s.what_happens}`);
            if (s.what_she_knows) sitParts.push(`   She knows: ${s.what_she_knows}`);
            if (s.what_she_doesnt_say) sitParts.push(`   She doesn't say: ${s.what_she_doesnt_say}`);
          });
          // Collect characters from all situations
          const sitChars = new Set();
          task.situations.forEach(s => {
            (s.characters_present || []).forEach(c => sitChars.add(c));
          });
          if (sitChars.size && (!patch.characters || !patch.characters.length)) {
            patch.characters = [...sitChars];
          }
          // Extract opening line from first situation
          const firstOpening = task.situations[0]?.opening_line;
          if (firstOpening && !task.opening_line) patch.must_include = `Opening line: "${firstOpening}"`;
        } else {
          // Old format: situations are strings like "domestic", "driver"
          const sitLabels = {
            domestic: 'DOMESTIC — the real life before the phone comes out',
            driver: 'DRIVER — what pulls her into the digital world',
            collision: 'COLLISION — two worlds pressing against each other',
            escalation: 'ESCALATION — the moment something shifts past where it was',
            intimate_close: 'INTIMATE CLOSE — alone with what just happened',
          };
          sitParts.push('');
          sitParts.push(`Chapter situations (${task.situations.length}):`);
          task.situations.forEach(s => {
            sitParts.push(`• ${sitLabels[s] || s}`);
          });
        }
      }
      if (task.chapter_arc) sitParts.push(`\nChapter must leave her with: ${task.chapter_arc}`);
      if (task.obstacle) sitParts.push(`\nObstacle: ${task.obstacle}`);
      if (task.emotional_start && task.emotional_end) {
        sitParts.push(`Emotional arc: ${task.emotional_start} → ${task.emotional_end}`);
      }
      if (task.algorithm_pressure) sitParts.push(`Algorithm pressure: ${task.algorithm_pressure}`);
      if (task.escalation_loop_active) sitParts.push('Escalation loop ACTIVE (Algorithm + Nia + Marcus)');
      if (!patch.situation && sitParts.length) patch.situation = sitParts.join('\n');
      else if (sitParts.length > 1) patch.situation = sitParts.join('\n');

      // ── ② Content — extract what the character is creating ──
      const extracted = extractContentFromTask(task.task || '');
      if (extracted.content_name) patch.content_name = extracted.content_name;
      if (extracted.content_type) patch.content_type = extracted.content_type;
      // If extractContentFromTask didn't get a name, build one from title + story_number
      if (!patch.content_name && task.title) {
        patch.content_name = `Chapter ${task.story_number || ''}: ${task.title}`.trim();
      }
      // Default content_type for novel chapters
      if (!patch.content_type) patch.content_type = 'Novel';
      // Content history — what phase are we in, what's happened before
      const histParts = [];
      if (task.phase) {
        const phaseDesc = { establishment: 'Early chapters — world and characters being established', pressure: 'Pressure building — complications tightening', crisis: 'Crisis phase — everything converging', integration: 'Integration — processing what has happened' };
        histParts.push(phaseDesc[task.phase] || `Phase: ${task.phase}`);
      }
      if (task.story_number) histParts.push(`Chapter ${task.story_number} of the arc`);
      // Support both old (wound_clock_position) and new (wound_clock) field names
      const woundClock = task.wound_clock_position || task.wound_clock;
      if (woundClock) histParts.push(`Wound clock at ${woundClock} — ${woundClock <= 80 ? 'early exposure' : woundClock <= 95 ? 'deepening pressure' : woundClock <= 110 ? 'approaching crisis' : 'near breaking point'}`);
      if (histParts.length) patch.content_history = histParts.join('. ') + '.';
      // Why it matters — derive from emotional stakes + strength + domains
      const whyParts = [];
      if (task.strength_weaponized) whyParts.push(`Her strength is being weaponized: ${task.strength_weaponized}`);
      if (task.therapy_seeds?.length) whyParts.push(`Therapy seeds emerging: ${task.therapy_seeds.join('; ')}`);
      if (task.domains_active?.length) whyParts.push(`Active life domains: ${task.domains_active.join(', ')}`);
      if (task.emotional_end) whyParts.push(`This chapter must land her at: ${task.emotional_end}`);
      if (whyParts.length) patch.why_it_matters = whyParts.join('. ') + '.';

      // ── ③ Life Context ──
      // Life constraints — setting + domains + algorithm pressure
      const constraintParts = [];
      if (task.primary_location) constraintParts.push(task.primary_location);
      if (task.time_of_day) constraintParts.push(task.time_of_day.replace(/_/g, ' '));
      if (task.season_weather) constraintParts.push(task.season_weather);
      if (task.domains_active?.length) {
        const domainPressures = { career: 'career demands', romantic: 'romantic tension', family: 'family obligations', friends: 'friendship dynamics' };
        const pressures = task.domains_active.map(d => domainPressures[d] || d).join(', ');
        constraintParts.push(`Active pressures: ${pressures}`);
      }
      if (task.algorithm_pressure) constraintParts.push(`Algorithm: ${task.algorithm_pressure}`);
      if (constraintParts.length) patch.life_constraints = constraintParts.join(' — ');

      // Support system — who's in the scene and their roles
      if (task.ecosystem_characters?.length) {
        const charNames = st.charNames || {};
        const supportParts = task.ecosystem_characters.map(k => {
          const name = charNames[k] || k.replace(/_/g, ' ');
          return name;
        });
        patch.support_system = `Characters present: ${supportParts.join(', ')}`;
        if (task.escalation_loop_active) patch.support_system += '. Escalation loop active — Algorithm + Nia + Marcus creating compound pressure.';
        if (task.new_character_name) patch.support_system += `. New character entering: ${task.new_character_name} (${task.new_character_role || 'role TBD'}).`;
      } else if (task.situations?.length && typeof task.situations[0] === 'object') {
        // New format: collect characters from situation objects
        const sitCharSet = new Set();
        task.situations.forEach(s => (s.characters_present || []).forEach(c => sitCharSet.add(c)));
        if (sitCharSet.size) {
          patch.support_system = `Characters present: ${[...sitCharSet].join(', ')}`;
        }
      }

      // Deadline context — phase + wound clock + stakes + character presence
      const deadlineParts = [];
      if (task.phase) deadlineParts.push(`Phase: ${task.phase}`);
      const wc = task.wound_clock_position || task.wound_clock;
      if (wc) deadlineParts.push(`Wound clock: ${wc}`);
      if (task.stakes_level) deadlineParts.push(`Stakes: ${task.stakes_level}/10`);
      if (task.david_presence) deadlineParts.push(`David: ${task.david_presence}`);
      if (task.marcus_phase && task.marcus_phase !== 'none') deadlineParts.push(`Marcus: ${task.marcus_phase.replace('_', ' ')}`);
      if (task.elias_notices) deadlineParts.push('Elias notices something');
      if (task.phone_appears) deadlineParts.push('Phone appears');
      if (deadlineParts.length) patch.deadline_context = deadlineParts.join('. ');

      if (task.phase) {
        const phaseMap = { establishment: 'low', pressure: 'medium', crisis: 'high', integration: 'medium' };
        patch.deadline_pressure = phaseMap[task.phase] || '';
      }

      // ── ④ Emotional Architecture ──
      // Internal conflict — obstacle + algorithm pressure + domain tensions + what she knows
      const conflictParts = [];
      if (task.obstacle) conflictParts.push(task.obstacle);
      if (task.algorithm_pressure && task.obstacle !== task.algorithm_pressure) conflictParts.push(`Algorithm compounding: ${task.algorithm_pressure}`);
      if (task.bleed_active) conflictParts.push('Fourth wall permeable — the character senses something beyond the story');
      // New format: extract what_she_knows from situations for internal conflict
      if (task.situations?.length && typeof task.situations[0] === 'object') {
        const knows = task.situations.map(s => s.what_she_knows).filter(Boolean);
        if (knows.length) conflictParts.push(`She knows: ${knows.join('; ')}`);
      }
      if (conflictParts.length) patch.internal_conflict = conflictParts.join('. ');

      // What failure means — strength weaponized + stakes context
      const failParts = [];
      if (task.strength_weaponized) failParts.push(`Strength weaponized: ${task.strength_weaponized}`);
      if (task.stakes_level >= 7) failParts.push(`Stakes at ${task.stakes_level}/10 — failure here is not recoverable in the same way`);
      if (task.escalation_loop_active) failParts.push('Escalation loop means every small failure compounds into the next scene');
      if (failParts.length) patch.what_failure_means = failParts.join('. ') + '.';

      // Emotional stakes — therapy seeds + emotional arc + wound clock + what she doesn't say
      const emotionalParts = [];
      if (task.therapy_seeds?.length) emotionalParts.push(task.therapy_seeds.join('. '));
      if (task.emotional_start && task.emotional_end) emotionalParts.push(`Emotional arc: ${task.emotional_start} → ${task.emotional_end}`);
      else if (task.emotional_start) emotionalParts.push(`Starting emotion: ${task.emotional_start}`);
      const wcEmotional = task.wound_clock_position || task.wound_clock;
      if (wcEmotional >= 100) emotionalParts.push(`Wound clock at ${wcEmotional} — core wound fully exposed`);
      if (task.bleed_active) emotionalParts.push('Bleed active — emotional boundaries dissolving');
      // New format: extract what_she_doesnt_say from situations
      if (task.situations?.length && typeof task.situations[0] === 'object') {
        const unsaid = task.situations.map(s => s.what_she_doesnt_say).filter(Boolean);
        if (unsaid.length) emotionalParts.push(`What she doesn't say: ${unsaid.join('; ')}`);
      }
      if (emotionalParts.length) patch.emotional_stakes = emotionalParts.join('. ');

      // World context — world, story_type, new characters, bleed, texture layers
      const ctxParts = [];
      if (st.activeWorld) ctxParts.push(`World: ${st.activeWorld}`);
      if (task.story_type) ctxParts.push(`Story type: ${task.story_type}`);
      if (task.new_character_name) ctxParts.push(`New character: ${task.new_character_name} (${task.new_character_role || 'role TBD'})`);
      if (task.bleed_active) ctxParts.push('BLEED ACTIVE — fourth wall permeable');
      // Collect texture layers from new-format situations
      if (task.situations?.length && typeof task.situations[0] === 'object') {
        const textures = new Set();
        task.situations.forEach(s => (s.texture_layers || []).forEach(t => textures.add(t)));
        if (textures.size) ctxParts.push(`Texture layers: ${[...textures].join(', ')}`);
      }
      if (ctxParts.length) patch.world_context = ctxParts.join('. ') + '.';

      // Must include — opening line
      if (task.opening_line) patch.must_include = `Opening line: "${task.opening_line}"`;

      // ── ⑥ Tone — map primary_tone + tone_shifts to multi-select ──
      const toneSet = [];
      if (task.primary_tone && ALL_VALID_TONES.includes(task.primary_tone)) toneSet.push(task.primary_tone);
      if (task.tone_shifts?.length) {
        // tone_shifts are strings like "literary → dark" or just tone names
        task.tone_shifts.forEach(ts => {
          const parts = ts.split(/\s*→\s*|\s*->\s*|\s*to\s*/i);
          parts.forEach(p => {
            const t = p.trim().toLowerCase();
            if (ALL_VALID_TONES.includes(t) && !toneSet.includes(t)) toneSet.push(t);
          });
        });
      }
      // Map situations to their natural tones if we don't have enough
      if (toneSet.length < 2 && task.situations?.length) {
        const isObjSits = typeof task.situations[0] === 'object';
        if (isObjSits) {
          // New format: situation objects have a tone field (DOMESTIC, INTIMATE, etc.)
          const arcToneMap = { DOMESTIC: 'warm', AMBITIOUS: 'charged', INTIMATE: 'intimate', DIGITAL: 'ambient', FRICTION: 'thriller', WATCHING: 'dark', LALA: 'lyrical', MOM: 'warm', RECKONING: 'confessional' };
          task.situations.forEach(s => {
            const t = arcToneMap[s.tone] || arcToneMap[s.tone?.toUpperCase()];
            if (t && !toneSet.includes(t)) toneSet.push(t);
          });
        } else {
          // Old format: situation strings
          const sitToneMap = { domestic: 'warm', driver: 'charged', collision: 'thriller', escalation: 'dark', intimate_close: 'intimate' };
          task.situations.forEach(s => {
            const t = sitToneMap[s];
            if (t && !toneSet.includes(t)) toneSet.push(t);
          });
        }
      }
      if (toneSet.length) setToneDial(toneSet);
    }

    // Scene Proposer → Evaluation handoff
    const sp = st.sceneProposal;
    if (sp) {
      if (sp.scene_title) patch.scene_title = sp.scene_title;
      if (sp.situation) patch.situation = sp.situation;
      if (sp.emotional_stakes) patch.emotional_stakes = sp.emotional_stakes;
      if (sp.internal_conflict) patch.internal_conflict = sp.internal_conflict;
      if (sp.characters?.length) patch.characters = sp.characters;
      if (sp.tone) {
        const toneMap = { longing: 'lyrical', tension: 'thriller', sensual: 'intimate', explicit: 'dark', aftermath: 'warm' };
        const mapped = toneMap[sp.tone] || sp.tone || 'literary';
        if (ALL_VALID_TONES.includes(mapped)) setToneDial([mapped]);
      }
    }

    if (Object.keys(patch).length) {
      if (patch.characters && !Array.isArray(patch.characters)) {
        patch.characters = typeof patch.characters === 'string'
          ? patch.characters.split(',').map(c => c.trim()).filter(Boolean) : [];
      }
      setBrief(prev => ({ ...prev, ...patch }));
    }
  }, []);

  // ── Auto-fill registry + characters when brief is empty on mount or after session reset ───
  useEffect(() => {
    // Only auto-fill if we have no characters and no registry from URL params/router state
    if (brief.characters.length > 0 || brief.registry_id) return;
    // Don't overwrite if session was restored with data (skip this check after explicit reset)
    if (sessionCleared === 0) {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        try { const s = JSON.parse(saved); if (s.brief?.characters?.length > 0) return; } catch {}
      }
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await listRegistriesApi();
        if (cancelled) return;
        const data = res.data;
        if (!data?.success || !data?.registries?.length || cancelled) return;

        // Use the first (most recent) registry
        const reg = data.registries[0];
        const chars = (reg.characters || [])
          .filter(c => c.status === 'active' || !c.status)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map(c => c.character_key);

        if (cancelled || !chars.length) return;
        setBrief(prev => {
          // Don't overwrite if user already started filling in
          if (prev.characters.length > 0 || prev.registry_id) return prev;
          return { ...prev, registry_id: reg.id, characters: chars };
        });
      } catch { /* network error — silent */ }
    })();
    return () => { cancelled = true; };
  }, [sessionCleared]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  // ── Fetch living context + relationship edges for a character ─────
  const fetchCharacterContext = useCallback(async (charKey, registryId) => {
    if (!registryId || !charKey) return;
    setCharFetchStatus(prev => ({ ...prev, [charKey]: 'loading' }));
    try {
      const res = await getCharacterSceneContextApi(charKey, registryId);
      const data = res.data;
      if (!data?.success) { setCharFetchStatus(prev => ({ ...prev, [charKey]: 'failed' })); return; }
      setCharContext(prev => ({ ...prev, [charKey]: data }));
      setCharFetchStatus(prev => ({ ...prev, [charKey]: 'loaded' }));
    } catch {
      setCharFetchStatus(prev => ({ ...prev, [charKey]: 'failed' }));
    }
  }, []);

  // When characters or registry_id change, fetch context for any new characters
  useEffect(() => {
    if (!brief.registry_id) return;
    brief.characters.forEach(key => {
      if (!charContext[key]) fetchCharacterContext(key, brief.registry_id);
    });
  }, [brief.characters, brief.registry_id, charContext, fetchCharacterContext]);

  // Auto-populate life_constraints + support_system from fetched context
  useEffect(() => {
    if (brief.characters.length === 0) return;
    const allCtx = brief.characters.map(k => charContext[k]).filter(Boolean);
    if (allCtx.length === 0) return;

    const patches = {};

    // Life Constraints: merge active pressures + home environment + financial + season
    const constraintParts = [];
    allCtx.forEach(ctx => {
      const lc = ctx.living_context || {};
      const name = ctx.display_name || ctx.character_key;
      const parts = [];
      if (lc.active_pressures) parts.push(lc.active_pressures);
      if (lc.home_environment) parts.push(lc.home_environment);
      if (lc.financial_reality || ctx.financial_status) parts.push(lc.financial_reality || ctx.financial_status);
      if (lc.current_season) parts.push(`Current season: ${lc.current_season}`);
      if (parts.length) constraintParts.push(`${name}: ${parts.join('. ')}`);
    });
    if (constraintParts.length && !brief.life_constraints) {
      patches.life_constraints = constraintParts.join('\n\n');
    }

    // Support System: build from relationship edges
    const supportParts = [];
    allCtx.forEach(ctx => {
      const name = ctx.display_name || ctx.character_key;
      const rels = (ctx.relationships || []).filter(r =>
        r.role_tag && ['ally', 'detractor', 'mentor', 'dependency', 'rival', 'partner', 'family'].includes(r.role_tag)
      );
      if (rels.length) {
        const lines = rels.map(r => {
          const parts = [r.person];
          if (r.role_tag) parts[0] += ` (${r.role_tag}`;
          if (r.family_role) parts[0] += `, ${r.family_role}`;
          parts[0] += ')';
          if (r.situation) parts.push(r.situation);
          else if (r.tension) parts.push(r.tension);
          return parts.join(' — ');
        });
        supportParts.push(`${name}'s network:\n${lines.join('\n')}`);
      }
    });
    if (supportParts.length && !brief.support_system) {
      patches.support_system = supportParts.join('\n\n');
    }

    // Deadline behavior from living context
    const deadlineParts = [];
    allCtx.forEach(ctx => {
      if (ctx.living_context?.relationship_to_deadlines) {
        deadlineParts.push(ctx.living_context.relationship_to_deadlines);
      }
    });
    if (deadlineParts.length && !brief.deadline_context) {
      patches.deadline_context = deadlineParts.join('. ');
    }

    // Why It Matters: build from core desire + hidden want
    const mattersParts = [];
    allCtx.forEach(ctx => {
      const name = ctx.display_name || ctx.character_key;
      const parts = [];
      if (ctx.core_desire) parts.push(ctx.core_desire);
      if (ctx.hidden_want) parts.push(ctx.hidden_want);
      if (parts.length) mattersParts.push(`${name}: ${parts.join('. ')}`);
    });
    if (mattersParts.length && !brief.why_it_matters) {
      patches.why_it_matters = mattersParts.join('\n');
    }

    // Content History: build from living context career/creative info
    const historyParts = [];
    allCtx.forEach(ctx => {
      const lc = ctx.living_context || {};
      const name = ctx.display_name || ctx.character_key;
      const parts = [];
      if (lc.creative_history) parts.push(lc.creative_history);
      if (lc.career_trajectory) parts.push(lc.career_trajectory);
      if (lc.past_projects) parts.push(lc.past_projects);
      if (parts.length) historyParts.push(`${name}: ${parts.join('. ')}`);
    });
    if (historyParts.length && !brief.content_history) {
      patches.content_history = historyParts.join('\n');
    }

    if (Object.keys(patches).length) setBrief(prev => ({ ...prev, ...patches }));
  }, [charContext, brief.characters]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    const composed = composeBrief(brief);
    if (!composed.trim()) { setError('Scene brief is too sparse \u2014 fill in the situation at minimum'); return; }
    if (brief.characters.length === 0) { setError('Add at least one character'); return; }
    setError(null); setLoading(true);
    try {
      const data = await apiPost('generate-story-multi', {
        scene_brief: composed,
        characters_in_scene: brief.characters,
        registry_id: brief.registry_id || undefined,
        tone_dial: toneDial, // array of selected tones
        must_include: brief.must_include || undefined,
        never_include: brief.never_include || undefined,
        chapter_id: chapterId || undefined,
      }, { timeoutMs: 180000 });
      setStoryId(data.story_id);
      setStories(data.stories);
      setTokenUsage(data.token_usage || null);
      setEnrichmentLoaded(data.enrichment_loaded || null);
      setStep('read');
      if (document.hidden) notify('Stories Generated', `3 voices ready for "${brief.scene_title || 'your scene'}"`);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [brief, toneDial]);

  const handleEvaluate = useCallback(async () => {
    if (!storyId) return;
    setError(null); setLoading(true);
    try {
      const data = await apiPost('evaluate-stories', { story_id: storyId }, { timeoutMs: 180000 });
      setEvaluation(data.evaluation);
      setScoreOverrides(null);
      setEditingScores(false);
      setSceneRevelations(null);
      if (data.token_usage) setTokenUsage(prev => prev ? { input: prev.input + data.token_usage.input, output: prev.output + data.token_usage.output } : data.token_usage);
      setStep('evaluate');
      // Save to history
      saveToHistory({ brief, toneDial, storyId, evaluation: data.evaluation });
      if (document.hidden) notify('Evaluation Complete', `Winner: ${data.evaluation?.winner || 'Unknown'}`);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [storyId, brief, toneDial, saveToHistory]);

  const handleProposeMemory = useCallback(async () => {
    if (!storyId) return;
    setError(null); setLoading(true);
    try {
      const data = await apiPost('propose-memory', { story_id: storyId }, { timeoutMs: 120000 });
      setPlotMemories(data.proposals?.plot_memories || []);
      setRevelations(data.proposals?.character_revelations || []);
      setSelectedPlot(new Set(Array.from({ length: (data.proposals?.plot_memories || []).length }, (_, i) => i)));
      setSelectedRev(new Set(Array.from({ length: (data.proposals?.character_revelations || []).length }, (_, i) => i)));
      setStep('memory');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [storyId]);

  const handleProposeRegistry = useCallback(async () => {
    if (!storyId) return;
    setError(null); setLoading(true);
    try {
      const data = await apiPost('propose-registry-update', { story_id: storyId }, { timeoutMs: 120000 });
      setRegUpdates(data.proposals || []);
      setSelectedReg(new Set(Array.from({ length: (data.proposals || []).length }, (_, i) => i)));
      setStep('registry');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [storyId]);

  const handleWriteBack = useCallback(async () => {
    if (!storyId || !chapterId.trim()) {
      setError('Chapter ID is required for write-back');
      return;
    }
    setError(null); setLoading(true);
    try {
      const confirmedMems = [
        ...plotMemories.filter((_, i) => selectedPlot.has(i)),
        ...revelations.filter((_, i) => selectedRev.has(i)),
      ];
      const confirmedReg = regUpdates.filter((_, i) => selectedReg.has(i));

      const data = await apiPost('write-back', {
        story_id: storyId,
        chapter_id: chapterId.trim(),
        confirmed_memories: confirmedMems,
        confirmed_registry_updates: confirmedReg,
      }, { timeoutMs: 120000 });
      setWriteResult(data);
      setStep('writeback');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [storyId, chapterId, plotMemories, revelations, regUpdates, selectedPlot, selectedRev, selectedReg]);

  const toggleSet = (set, setter, idx) => {
    const next = new Set(set);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setter(next);
  };

  // ── Regenerate (re-run 3 voices with same brief) ─────────────────────
  const handleRegenerate = useCallback(async () => {
    if (!window.confirm('Regenerate all 3 voices? This will make new AI calls.')) return;
    setError(null); setLoading(true);
    try {
      const composed = composeBrief(brief);
      const data = await apiPost('generate-story-multi', {
        scene_brief: composed,
        characters_in_scene: brief.characters,
        registry_id: brief.registry_id || undefined,
        tone_dial: toneDial,
      }, { timeoutMs: 180000 });
      setStoryId(data.story_id);
      setStories(data.stories);
      setTokenUsage(data.token_usage || null);
      setEvaluation(null);
      setScoreOverrides(null);
      setEditingScores(false);
      setSceneRevelations(null);
      setStep('read');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [brief, toneDial]);

  // ── Export all voices as markdown ─────────────────────────────────────
  const exportAsMarkdown = useCallback(() => {
    if (!stories) return;
    const parts = [`# Story Evaluation Export\n\n## Brief\n${composeBrief(brief)}\n\n## Tones: ${toneDial.join(', ')}\n`];
    VOICES.forEach(v => {
      const s = stories[v.id];
      parts.push(`\n## ${v.label} (${v.tag})\n**${s?.word_count || 0} words**\n\n${s?.text || '(empty)'}\n`);
    });
    if (evaluation) {
      parts.push(`\n## Evaluation\n**Winner: ${evaluation.winner}** — ${evaluation.winner_reason}\n`);
      VOICES.forEach(v => {
        const sc = evaluation.scores?.[v.id];
        if (sc) parts.push(`\n### ${v.label}: ${sc.total}/90\n${sc.summary}\n`);
      });
      if (evaluation.approved_version) parts.push(`\n## Approved Version\n\n${evaluation.approved_version}\n`);
    }
    const blob = new Blob([parts.join('')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `scene-eval-${storyId || 'draft'}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [stories, evaluation, brief, toneDial, storyId]);

  // ── Export as PDF (browser print) ────────────────────────────────────
  const exportAsPdf = useCallback(() => {
    if (!stories && !evaluation) return;
    const parts = [];
    parts.push(`<h1 style="font-family:Georgia,serif;margin-bottom:4px">Scene Evaluation</h1>`);
    parts.push(`<p style="color:#666;font-size:13px">Scene: ${brief.scene_title || 'Untitled'} · Tones: ${toneDial.join(', ')}</p>`);
    parts.push(`<p style="font-size:13px;color:#444">${composeBrief(brief)}</p><hr/>`);
    if (stories) {
      VOICES.forEach(v => {
        const s = stories[v.id];
        parts.push(`<h2 style="color:${v.accent};font-family:Georgia,serif">${v.label} — ${v.tag}</h2>`);
        parts.push(`<p style="font-size:12px;color:#888">${s?.word_count || 0} words</p>`);
        parts.push(`<div style="white-space:pre-wrap;font-size:13px;line-height:1.7;margin-bottom:20px">${(s?.text || '(empty)').replace(/</g, '&lt;')}</div>`);
      });
    }
    if (evaluation) {
      parts.push(`<hr/><h2 style="font-family:Georgia,serif">Evaluation</h2>`);
      parts.push(`<p><strong>Winner: ${evaluation.winner}</strong> — ${evaluation.winner_reason || ''}</p>`);
      VOICES.forEach(v => {
        const sc = evaluation.scores?.[v.id];
        if (sc) parts.push(`<p style="font-size:12px"><strong>${v.label}:</strong> ${sc.total}/90 — ${sc.summary || ''}</p>`);
      });
      if (evaluation.approved_version) {
        parts.push(`<hr/><h2 style="font-family:Georgia,serif">Approved Version</h2>`);
        parts.push(`<div style="white-space:pre-wrap;font-size:13px;line-height:1.7">${evaluation.approved_version.replace(/</g, '&lt;')}</div>`);
      }
    }
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`<!DOCTYPE html><html><head><title>Scene Eval — ${brief.scene_title || 'Draft'}</title><style>body{font-family:'DM Sans',Helvetica,sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#1a1a1a}@media print{body{padding:20px}}</style></head><body>${parts.join('')}</body></html>`);
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 300);
  }, [stories, evaluation, brief, toneDial]);

  // ── Scene revelation analysis ────────────────────────────────────────
  const handleSceneRevelation = useCallback(async () => {
    if (!evaluation?.approved_version || !brief.characters.length || !brief.registry_id) return;
    setRevLoading(true);
    try {
      const data = await apiPost('scene-revelation', {
        scene_text: evaluation.approved_version,
        characters_in_scene: brief.characters,
        registry_id: brief.registry_id,
      });
      setSceneRevelations(data.revelations || null);
    } catch (err) { setError(err.message); }
    finally { setRevLoading(false); }
  }, [evaluation, brief]);

  // ── Fetch books + chapters for picker ──────────────────────────────
  const fetchBooks = useCallback(async () => {
    try {
      const res = await listBooksApi();
      const data = res.data;
      setBooks(data?.books || data || []);
    } catch { /* ignore */ }
  }, []);

  const fetchChapters = useCallback(async (bookId) => {
    try {
      // VARIABLE-URL split per v2.13 §9.11 method-branching pattern
      // (applied to URL-branching): bookId branch uses getBookApi,
      // no-bookId branch uses listAllChaptersApi.
      const res = bookId ? await getBookApi(bookId) : await listAllChaptersApi();
      const data = res.data;
      const ch = bookId ? (data?.book?.chapters || data?.chapters || []) : (data?.chapters || data || []);
      setChapters(ch);
    } catch { /* chapters endpoint may not exist */ }
  }, []);

  useEffect(() => { fetchBooks(); fetchChapters(); }, [fetchBooks, fetchChapters]);

  const handleBookSelect = useCallback((bookId) => {
    setSelectedBookId(bookId);
    setChapterId('');
    setChapterSearch('');
    fetchChapters(bookId || null);
  }, [fetchChapters]);

  // Request notification permission early
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      // Skip if user is typing in an input/textarea
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

      const idx = STEPS.indexOf(step);

      // ← → navigate between steps (only to completed steps or current)
      if (e.key === 'ArrowRight' && idx < STEPS.length - 1) {
        e.preventDefault();
        // Only allow going forward if we have data for next step
        const next = STEPS[idx + 1];
        if (next === 'read' && stories) setStep('read');
        else if (next === 'evaluate' && evaluation) setStep('evaluate');
        else if (next === 'memory' && plotMemories.length) setStep('memory');
        else if (next === 'registry' && regUpdates.length) setStep('registry');
        else if (next === 'writeback' && writeResult) setStep('writeback');
      }
      if (e.key === 'ArrowLeft' && idx > 0) {
        e.preventDefault();
        setStep(STEPS[idx - 1]);
      }

      // Ctrl+E → evaluate (when on 'read' step)
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        if (step === 'read' && storyId && !loading) handleEvaluate();
      }

      // Ctrl+G → generate (when on 'brief' step)
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        if (step === 'brief' && !loading) handleGenerate();
      }

      // Escape → close history drawer
      if (e.key === 'Escape' && historyOpen) {
        e.preventDefault();
        setHistoryOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, stories, evaluation, plotMemories, regUpdates, writeResult, storyId, loading, historyOpen, handleEvaluate, handleGenerate]);

  // ── Current step index ───────────────────────────────────────────────
  const stepIdx = STEPS.indexOf(step);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="see-page" style={{
      minHeight: '100%', background: T.bg, color: T.text,
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      {/* Header */}
      <div className="see-header" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', paddingRight: 72, borderBottom: `1px solid ${T.border}`, background: T.surface,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: T.textDim, padding: '4px 8px' }}
            title="Back"
          >←</button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>
              ◇ Story Evaluation Engine
            </div>
            <div className="see-header-subtitle" style={{ fontSize: 10, color: T.textDim }}>
              Blind generation → Editorial evaluation → Memory → Registry → Write-back
              <span style={{ marginLeft: 12, fontSize: 9, color: T.textFaint }}>
                ← → steps · Ctrl+G generate · Ctrl+E evaluate · Esc close
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {loading && (
            <span style={{ fontSize: 11, color: T.accent, fontFamily: 'monospace' }}>
              {elapsed}s elapsed
            </span>
          )}
          {!loading && (
            <button
              onClick={() => {
                if (!window.confirm('Start a new session? Current progress will be cleared.')) return;
                setBrief(EMPTY_BRIEF);
                setToneDial(['literary']);
                setStep('brief');
                setStories(null);
                setStoryId(null);
                setEvaluation(null);
                setChapterId('');
                setChapterSearch('');
                setChapters([]);
                setPlotMemories([]);
                setRevelations([]);
                setRegUpdates([]);
                setSelectedPlot(new Set());
                setSelectedRev(new Set());
                setSelectedReg(new Set());
                setWriteResult(null);
                setCharContext({});
                setCharFetchStatus({});
                setEditingApproved(false);
                setApprovedText('');
                setError(null);
                localStorage.removeItem(SESSION_KEY);
                setSessionCleared(c => c + 1);
              }}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: 'none', border: `1px solid ${T.border}`, color: T.textDim,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              ✦ New Session
            </button>
          )}
          <button
            onClick={() => setDarkMode(d => !d)}
            style={{
              padding: '6px 10px', borderRadius: 6, fontSize: 12,
              background: 'none', border: `1px solid ${T.border}`, color: T.textDim,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? '☀' : '🌙'}
          </button>
          <button
            onClick={() => setHistoryOpen(h => !h)}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: historyOpen ? `${T.accent}15` : 'none',
              border: `1px solid ${historyOpen ? T.accent : T.border}`,
              color: historyOpen ? T.accent : T.textDim,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
            title={`${historyEntries.length} past sessions`}
          >
            ◷ History{historyEntries.length > 0 ? ` (${historyEntries.length})` : ''}
          </button>
        </div>
      </div>

      {/* History drawer */}
      {historyOpen && (
        <div style={{
          background: T.surface, borderBottom: `1px solid ${T.border}`,
          padding: '12px 24px', maxHeight: 280, overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Evaluation History</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {historyEntries.length > 0 && (
                <>
                  <button onClick={batchExportHistory} style={{ fontSize: 10, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>📄 Export all as PDF</button>
                  <button onClick={clearHistory} style={{ fontSize: 10, color: T.textFaint, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear all</button>
                </>
              )}
            </div>
          </div>
          {historyEntries.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textFaint, padding: '16px 0', textAlign: 'center' }}>
              No evaluations yet. Complete an evaluation to see it here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {historyEntries.map(entry => {
                const isChecked = diffSelected.includes(entry.id);
                return (
                <div key={entry.id} style={{
                  padding: '10px 14px', borderRadius: 8,
                  border: `1px solid ${isChecked ? T.accent : T.border}`, background: isChecked ? `${T.accent}08` : T.bg,
                  cursor: 'default',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={isChecked}
                        onChange={() => setDiffSelected(prev => {
                          if (prev.includes(entry.id)) return prev.filter(id => id !== entry.id);
                          if (prev.length >= 2) return [prev[1], entry.id];
                          return [...prev, entry.id];
                        })}
                        style={{ accentColor: T.accent, cursor: 'pointer' }}
                        title="Select for comparison"
                      />
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                        {entry.scene_title || 'Untitled'}
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: T.textFaint }}>
                      {new Date(entry.date).toLocaleDateString()} {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4 }}>
                    {(entry.characters || []).slice(0, 4).join(', ')}{(entry.characters || []).length > 4 ? ` +${entry.characters.length - 4}` : ''} · {entry.tone}
                  </div>
                  {entry.winner && (
                    <div style={{ fontSize: 10, color: T.green, fontWeight: 600 }}>
                      Winner: {entry.winner} — {entry.winner_reason?.slice(0, 80)}{(entry.winner_reason?.length || 0) > 80 ? '…' : ''}
                    </div>
                  )}
                  {entry.scores && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      {Object.entries(entry.scores).map(([voice, sc]) => (
                        <span key={voice} style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 8,
                          background: voice === entry.winner ? `${T.green}20` : `${T.border}`,
                          color: voice === entry.winner ? T.green : T.textDim,
                          fontWeight: 600,
                        }}>{voice.replace('voice_', 'V').toUpperCase()}: {sc.total}</span>
                      ))}
                    </div>
                  )}
                  {entry.brief_summary && (
                    <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4, fontStyle: 'italic' }}>
                      {entry.brief_summary.slice(0, 100)}{entry.brief_summary.length > 100 ? '…' : ''}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
          {/* Diff compare button + panel */}
          {diffSelected.length === 2 && (() => {
            const a = historyEntries.find(e => e.id === diffSelected[0]);
            const b = historyEntries.find(e => e.id === diffSelected[1]);
            if (!a || !b) return null;
            const allVoices = [...new Set([...Object.keys(a.scores || {}), ...Object.keys(b.scores || {})])];
            return (
              <div style={{ marginTop: 10 }}>
                <button onClick={() => setDiffOpen(prev => !prev)}
                  style={{ padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: `${T.accent}15`, border: `1px solid ${T.accent}`, color: T.accent, cursor: 'pointer' }}>
                  {diffOpen ? '▾ Hide Comparison' : '◈ Compare Selected'}
                </button>
                {diffOpen && (
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[a, b].map((entry, idx) => (
                      <div key={idx} style={{ padding: 12, borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceAlt }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 6 }}>{entry.scene_title || 'Untitled'}</div>
                        <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4 }}>{new Date(entry.date).toLocaleDateString()} · {entry.tone}</div>
                        <div style={{ fontSize: 10, color: T.textDim, marginBottom: 8 }}>{(entry.characters || []).join(', ')}</div>
                        {entry.winner && <div style={{ fontSize: 11, color: T.green, fontWeight: 600, marginBottom: 6 }}>Winner: {entry.winner}</div>}
                        {allVoices.map(voice => {
                          const sc = entry.scores?.[voice];
                          if (!sc) return null;
                          return (
                            <div key={voice} style={{ marginBottom: 6 }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: T.text, marginBottom: 2 }}>{voice.replace('voice_', 'V').toUpperCase()}: {sc.total}/90</div>
                              <div style={{ height: 8, borderRadius: 4, background: T.border, overflow: 'hidden' }}>
                                <div style={{ width: `${(sc.total / 90) * 100}%`, height: '100%', background: voice === entry.winner ? T.green : T.accent, borderRadius: 4, transition: 'width 0.4s' }} />
                              </div>
                            </div>
                          );
                        })}
                        {entry.brief_summary && <div style={{ fontSize: 10, color: T.textFaint, marginTop: 6, fontStyle: 'italic' }}>{entry.brief_summary}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Step Progress */}
      <div className="see-step-bar" style={{ display: 'flex', padding: '12px 24px', gap: 4, background: T.surface, borderBottom: `1px solid ${T.border}` }}>
        {STEP_LABELS.map((label, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <div key={label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 3, borderRadius: 2, marginBottom: 4,
                background: done ? T.green : active ? T.accent : T.border,
                transition: 'background 0.3s',
              }} />
              <span style={{
                fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase',
                color: done ? T.green : active ? T.accent : T.textFaint,
                fontWeight: active ? 700 : 400,
              }}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          margin: '12px 24px 0', padding: '10px 14px',
          background: '#fdf2f2', border: `1px solid ${T.red}`,
          borderRadius: 6, fontSize: 12, color: T.red,
        }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: T.red, fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Content area */}
      <div className="see-content" style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

        {/* ══════ STEP: BRIEF ══════ */}
        {step === 'brief' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Completeness header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Build your scene brief</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {(() => { const r = briefRichness(brief); return (
                  <span style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                    background: `${r.color}20`, color: r.color,
                  }}>
                    {r.label} ({r.score}%)
                  </span>
                ); })()}
                <span style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                  background: briefCompleteness(brief) >= 60 ? `${T.green}20` : `${T.accent}20`,
                  color: briefCompleteness(brief) >= 60 ? T.green : T.accent,
                }}>
                  {briefCompleteness(brief)}% complete
                </span>
              </div>
            </div>

            {/* ① The Scene */}
            <SectionCard title="① The Scene">
              <BriefField label="Scene Title" hint="Working title for this scene">
                <input value={brief.scene_title} onChange={e => updateBrief('scene_title', e.target.value)}
                  placeholder="e.g. The Confession at Dawn" style={briefInputStyle} />
              </BriefField>
              <BriefField label="Situation *" hint="What's happening? What must change by the end?">
                <textarea value={brief.situation} onChange={e => updateBrief('situation', e.target.value)}
                  rows={3} placeholder="Describe the core situation — stakes, conflict, pivot point..."
                  style={briefTextareaStyle} />
              </BriefField>
            </SectionCard>

            {/* ② The Content */}
            <SectionCard title="② The Content">
              <div className="see-brief-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <BriefField label="Content Name *" hint="What is the character creating?">
                  <input value={brief.content_name} onChange={e => updateBrief('content_name', e.target.value)}
                    placeholder="e.g. her debut album" style={briefInputStyle} />
                </BriefField>
                <BriefField label="Content Type *">
                  <select value={brief.content_type} onChange={e => updateBrief('content_type', e.target.value)}
                    style={{ ...briefInputStyle, cursor: 'pointer' }}>
                    <option value="">Select type...</option>
                    {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {brief.content_type === 'Other' && (
                    <input value={brief.content_type_other} onChange={e => updateBrief('content_type_other', e.target.value)}
                      placeholder="Describe the content type..." style={{ ...briefInputStyle, marginTop: 6 }} />
                  )}
                </BriefField>
              </div>
              <BriefField label="Content History" hint="What has the character already tried or created?">
                <textarea value={brief.content_history} onChange={e => updateBrief('content_history', e.target.value)}
                  rows={2} placeholder="Previous attempts, false starts, scrapped drafts..."
                  style={briefTextareaStyle} />
              </BriefField>
              <BriefField label="Why It Matters" hint="Why does this piece matter to the character?">
                <textarea value={brief.why_it_matters} onChange={e => updateBrief('why_it_matters', e.target.value)}
                  rows={2} placeholder="The personal significance — what it proves or changes..."
                  style={briefTextareaStyle} />
              </BriefField>
            </SectionCard>

            {/* ③ The Life Context */}
            <SectionCard title="③ The Life Context">
              <div className="see-brief-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <BriefField label="Life Constraints" hint="Real-world pressures?">
                  <textarea value={brief.life_constraints} onChange={e => updateBrief('life_constraints', e.target.value)}
                    rows={2} placeholder="Financial pressure, family obligations, health..."
                    style={briefTextareaStyle} />
                </BriefField>
                <BriefField label="Support System" hint="Who supports or undermines them?">
                  <textarea value={brief.support_system} onChange={e => updateBrief('support_system', e.target.value)}
                    rows={2} placeholder="Allies, mentors, rivals, detractors..."
                    style={briefTextareaStyle} />
                </BriefField>
              </div>
              <div className="see-brief-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <BriefField label="Deadline Context">
                  <input value={brief.deadline_context} onChange={e => updateBrief('deadline_context', e.target.value)}
                    placeholder="e.g. Album due to label in 3 weeks" style={briefInputStyle} />
                </BriefField>
                <BriefField label="Deadline Pressure">
                  <select value={brief.deadline_pressure} onChange={e => updateBrief('deadline_pressure', e.target.value)}
                    style={{ ...briefInputStyle, cursor: 'pointer' }}>
                    <option value="">Select pressure level...</option>
                    <option value="low">Low — plenty of time</option>
                    <option value="medium">Medium — some time pressure</option>
                    <option value="high">High — deadline looming</option>
                    <option value="critical">Critical — now or never</option>
                  </select>
                </BriefField>
              </div>
            </SectionCard>

            {/* ④ Emotional Architecture */}
            <SectionCard title="④ Emotional Architecture">
              <BriefField label="Emotional Stakes *" hint="What does the character stand to gain or lose emotionally?">
                <textarea value={brief.emotional_stakes} onChange={e => updateBrief('emotional_stakes', e.target.value)}
                  rows={2} placeholder="Identity, self-worth, a relationship, creative integrity..."
                  style={briefTextareaStyle} />
              </BriefField>
              <div className="see-brief-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <BriefField label="What Failure Means">
                  <textarea value={brief.what_failure_means} onChange={e => updateBrief('what_failure_means', e.target.value)}
                    rows={2} placeholder="The concrete cost if this doesn't work..."
                    style={briefTextareaStyle} />
                </BriefField>
                <BriefField label="Internal Conflict">
                  <textarea value={brief.internal_conflict} onChange={e => updateBrief('internal_conflict', e.target.value)}
                    rows={2} placeholder="The war inside the character..."
                    style={briefTextareaStyle} />
                </BriefField>
              </div>
              <BriefField label="World Context" hint="Relevant world-building or setting details">
                <div style={{ position: 'relative' }}>
                  <textarea value={brief.world_context} onChange={e => updateBrief('world_context', e.target.value)}
                    rows={2} placeholder="Time period, location, cultural norms, industry rules..."
                    style={briefTextareaStyle} />
                  {worldCtx && (
                    <div style={{ marginTop: 6 }}>
                      <button onClick={() => setWorldCtxOpen(!worldCtxOpen)}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #e0dcd4', background: worldCtxOpen ? '#f0eee8' : '#fff', color: '#666', cursor: 'pointer' }}>
                        🌍 {worldCtxOpen ? 'Hide' : 'Import from World'}{worldCtx.locations?.length ? ` (${worldCtx.locations.length} locations)` : ''}
                      </button>
                      {worldCtxOpen && (
                        <div style={{ marginTop: 8, padding: 10, background: '#f8f7f4', borderRadius: 8, border: '1px solid #e8e5de', fontSize: 12 }}>
                          {worldCtx.locations?.length > 0 && (
                            <div style={{ marginBottom: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 11, color: '#888' }}>Locations: </span>
                              {worldCtx.locations.map((l, i) => <span key={i} style={{ background: '#e8edf5', borderRadius: 4, padding: '1px 6px', marginRight: 4, fontSize: 11 }}>{l}</span>)}
                            </div>
                          )}
                          {worldCtx.facts?.length > 0 && (
                            <div style={{ marginBottom: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 11, color: '#888' }}>Facts: </span>
                              {worldCtx.facts.map((f, i) => <span key={i} style={{ background: '#f0eee8', borderRadius: 4, padding: '1px 6px', marginRight: 4, fontSize: 11 }}>{f}</span>)}
                            </div>
                          )}
                          {worldCtx.threads?.length > 0 && (
                            <div style={{ marginBottom: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 11, color: '#888' }}>Threads: </span>
                              {worldCtx.threads.map((t, i) => <span key={i} style={{ background: '#e8f5e9', borderRadius: 4, padding: '1px 6px', marginRight: 4, fontSize: 11 }}>{t}</span>)}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>
                            {worldCtx.activeThreadCount || 0} active threads · {worldCtx.tensionCount || 0} tension pairs
                          </div>
                          <button onClick={applyWorldCtx}
                            style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', background: '#c9a96e', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                            ✦ Apply to World Context
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </BriefField>
            </SectionCard>

            {/* ⑤ Characters In Scene */}
            <SectionCard title="⑤ Characters In Scene">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: brief.characters.length ? 10 : 0 }}>
                {brief.characters.map((c, i) => (
                  <CharTag key={i} name={c} onRemove={() => {
                    updateBrief('characters', brief.characters.filter((_, j) => j !== i));
                    setCharContext(prev => { const n = { ...prev }; delete n[c]; return n; });
                  }} />
                ))}
              </div>
              {/* Living-context indicators */}
              {brief.characters.length > 0 && (
                <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8, lineHeight: 1.5 }}>
                  {brief.characters.map(c => {
                    const ctx = charContext[c];
                    const status = charFetchStatus[c];
                    const relCount = (ctx?.relationships || []).length;
                    const hasLC = ctx?.living_context && Object.values(ctx.living_context).some(Boolean);
                    const icon = status === 'loaded' ? '✓' : status === 'failed' ? '⚠' : status === 'loading' ? '⏳' : '·';
                    const iconColor = status === 'loaded' ? T.green : status === 'failed' ? '#e74c3c' : T.textFaint;
                    return (
                      <div key={c} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                        <span style={{ color: iconColor, fontSize: 13 }}>{icon}</span>
                        <span><strong>{ctx?.display_name || c}</strong>
                          {status === 'failed' ? <span style={{ color: '#e74c3c' }}> — fetch failed</span> : ''}
                          {hasLC ? ' — context loaded' : ''}
                          {relCount > 0 ? ` · ${relCount} relationship${relCount > 1 ? 's' : ''}` : ''}
                        </span>
                        {status === 'failed' && brief.registry_id && (
                          <button onClick={() => fetchCharacterContext(c, brief.registry_id)}
                            style={{ fontSize: 10, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                            retry
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={charInput}
                  onChange={e => setCharInput(e.target.value)}
                  placeholder="character_key"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && charInput.trim()) {
                      e.preventDefault();
                      if (!brief.characters.includes(charInput.trim())) {
                        updateBrief('characters', [...brief.characters, charInput.trim()]);
                      }
                      setCharInput('');
                    }
                  }}
                  style={{ ...briefInputStyle, flex: 1 }}
                />
                <button
                  onClick={() => {
                    if (charInput.trim() && !brief.characters.includes(charInput.trim())) {
                      updateBrief('characters', [...brief.characters, charInput.trim()]);
                    }
                    setCharInput('');
                  }}
                  style={{
                    padding: '10px 16px', background: T.accent, color: '#fff',
                    border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >Add</button>
              </div>
              <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>Press Enter or click Add. At least one character required.</div>
              <div style={{ marginTop: 14 }}>
                <BriefField label="Registry ID (optional)" hint="Loads character dossiers for richer context">
                  <input value={brief.registry_id} onChange={e => updateBrief('registry_id', e.target.value)}
                    placeholder="UUID of character registry" style={briefInputStyle} />
                </BriefField>
              </div>
            </SectionCard>

            {/* ⑤½ Chapter (optional — enriches generation with arc metadata) */}
            <SectionCard title="Chapter Target (optional)">
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8, lineHeight: 1.5 }}>
                Selecting a chapter lets the AI use arc metadata and continuity from that chapter during generation.
                You can also set this later in the Write-Back step.
              </div>
              {chapters.length > 0 ? (
                <div>
                  <input
                    value={chapterSearch}
                    onChange={e => setChapterSearch(e.target.value)}
                    placeholder="Search chapters by title..."
                    style={{
                      width: '100%', padding: '8px 12px', background: T.surfaceAlt,
                      border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
                      fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 6,
                    }}
                  />
                  <div style={{ maxHeight: 120, overflowY: 'auto', borderRadius: 6, border: `1px solid ${T.border}` }}>
                    {chapters
                      .filter(ch => !chapterSearch || (ch.title || ch.id || '').toLowerCase().includes(chapterSearch.toLowerCase()))
                      .slice(0, 15)
                      .map(ch => (
                        <div key={ch.id}
                          onClick={() => { setChapterId(ch.id); setChapterSearch(ch.title || ch.id); }}
                          style={{
                            padding: '6px 12px', cursor: 'pointer', fontSize: 11,
                            background: chapterId === ch.id ? `${T.accent}15` : 'transparent',
                            borderBottom: `1px solid ${T.border}`, color: T.text,
                          }}
                        >
                          <strong>{ch.title || 'Untitled'}</strong>
                          <span style={{ fontSize: 9, color: T.textFaint, marginLeft: 6 }}>{ch.id?.slice(0, 8)}…</span>
                        </div>
                      ))}
                  </div>
                  {chapterId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: T.green }}>✓ {chapterId.slice(0, 8)}…</span>
                      <button onClick={() => { setChapterId(''); setChapterSearch(''); }}
                        style={{ fontSize: 10, color: T.textFaint, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                        clear
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <input
                  value={chapterId}
                  onChange={e => setChapterId(e.target.value)}
                  placeholder="Chapter UUID (optional)"
                  style={{ ...briefInputStyle, fontSize: 12 }}
                />
              )}
            </SectionCard>

            {/* ⑥ Tone Dial — Multi-Select */}
            <SectionCard title="⑥ Tone Dial">
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8 }}>Select one or more tones for this chapter. Chapters often shift between tones across situations.</div>
              <div className="see-tone-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {TONES.map(t => {
                  const active = toneDial.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setToneDial(prev => {
                        if (prev.includes(t.id)) {
                          const next = prev.filter(x => x !== t.id);
                          return next.length ? next : prev; // keep at least one
                        }
                        return [...prev, t.id];
                      })}
                      style={{
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        border: `2px solid ${active ? T.accent : T.border}`,
                        background: active ? `${T.accent}15` : T.surface,
                        textAlign: 'left', transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ fontSize: 16, marginBottom: 4 }}>{t.emoji}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: active ? T.accent : T.text }}>{t.label}</div>
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 2, lineHeight: 1.4 }}>{t.desc}</div>
                    </button>
                  );
                })}
              </div>
              {toneDial.length > 1 && (
                <div style={{ fontSize: 11, color: T.accent, marginTop: 8 }}>
                  ✦ {toneDial.length} tones selected: {toneDial.join(' → ')}
                </div>
              )}
            </SectionCard>

            {/* ⑦ Scene Constraints */}
            <SectionCard title="⑦ Scene Constraints">
              <div className="see-brief-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <BriefField label="Must Include" hint="Specific moments, lines, images, or beats that MUST appear">
                  <textarea value={brief.must_include} onChange={e => updateBrief('must_include', e.target.value)}
                    rows={2} placeholder="A phone call that interrupts dinner, the word 'amber', a moment where she laughs despite herself..."
                    style={briefTextareaStyle} />
                </BriefField>
                <BriefField label="Never Include" hint="Things to actively AVOID in this scene">
                  <textarea value={brief.never_include} onChange={e => updateBrief('never_include', e.target.value)}
                    rows={2} placeholder="No dream sequences, no flashbacks to childhood, avoid the word 'journey'..."
                    style={briefTextareaStyle} />
                </BriefField>
              </div>
            </SectionCard>

            {/* Brief Preview */}
            {composeBrief(brief).trim() && (
              <SectionCard title="Brief Preview">
                <div style={{ fontSize: 13, lineHeight: 1.7, color: T.textDim, fontFamily: 'Georgia,serif' }}>
                  {composeBrief(brief)}
                </div>
              </SectionCard>
            )}

            {/* Generate */}
            <div className="see-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                className="see-generate-btn"
                onClick={handleGenerate}
                disabled={loading || briefCompleteness(brief) < 60 || brief.characters.length === 0}
                style={{
                  padding: '12px 28px', background: T.accent, color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', letterSpacing: 0.3, transition: 'background 0.2s',
                  opacity: (loading || briefCompleteness(brief) < 60 || brief.characters.length === 0) ? 0.5 : 1,
                }}
              >
                {loading ? `Generating 3 voices... (${elapsed}s)` : '◇ Generate 3 Blind Voices →'}
              </button>
            </div>
            {/* Missing-fields hint */}
            {!loading && (briefCompleteness(brief) < 60 || brief.characters.length === 0) && (
              <div style={{ textAlign: 'right', fontSize: 11, color: '#e74c3c', marginTop: 6 }}>
                {brief.characters.length === 0 ? 'Add at least one character. ' : ''}
                {briefCompleteness(brief) < 60
                  ? `Brief ${briefCompleteness(brief)}% complete — fill in: ${
                      [
                        !brief.situation ? 'situation' : '',
                        !brief.content_name ? 'content name' : '',
                        !brief.content_type ? 'content type' : '',
                        !brief.emotional_stakes ? 'emotional stakes' : '',
                      ].filter(Boolean).join(', ') || 'more fields'
                    }`
                  : ''}
              </div>
            )}

            {loading && <Spinner color={T.accent} label="3 voices writing in parallel..." />}
          </div>
        )}

        {/* ══════ STEP: READ ══════ */}
        {(step === 'read' || step === 'generate') && stories && (
          <div>
            {/* View mode toggle */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button
                onClick={() => setViewMode(viewMode === 'tab' ? 'sideBySide' : 'tab')}
                style={{ ...ghostBtn(), fontSize: 11, padding: '5px 14px' }}
              >
                {viewMode === 'tab' ? '⫘ Side-by-Side' : '⫗ Tab View'}
              </button>
            </div>

            {viewMode === 'tab' ? (
              <>
                {/* Voice tabs */}
                <div className="see-voice-tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {VOICES.map(v => {
                    const s = stories[v.id];
                    const active = activeVoice === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setActiveVoice(v.id)}
                        style={{
                          flex: 1, padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                          border: `1px solid ${active ? v.accent : T.border}`,
                          background: active ? v.bg : T.surface,
                          textAlign: 'left', transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: active ? v.accent : T.text }}>{v.emoji} {v.label}</span>
                            <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{v.tag}</div>
                          </div>
                          <span style={{ fontSize: 11, color: T.textFaint }}>{s?.word_count || 0} words</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Story reader — single voice */}
                <div className="see-story-reader" style={{
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 10, padding: 24, marginBottom: 16,
                }}>
                  <StoryReader
                    text={stories[activeVoice]?.text}
                    accent={VOICES.find(v => v.id === activeVoice)?.accent || T.accent}
                    maxHeight={500}
                  />
                </div>
              </>
            ) : (
              /* Side-by-side 3-column view */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                {VOICES.map(v => (
                  <div key={v.id} style={{
                    background: v.bg, border: `1px solid ${v.border}`,
                    borderRadius: 10, padding: 16, overflow: 'hidden',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${v.border}` }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: v.accent }}>{v.emoji} {v.label}</span>
                      <span style={{ fontSize: 10, color: T.textFaint }}>{stories[v.id]?.word_count || 0}w</span>
                    </div>
                    <StoryReader text={stories[v.id]?.text} accent={v.accent} maxHeight={600} />
                  </div>
                ))}
              </div>
            )}

            {/* Token usage display */}
            {tokenUsage && (
              <div style={{ fontSize: 11, color: T.textFaint, textAlign: 'right', marginBottom: 8 }}>
                Tokens used: {(tokenUsage.input || 0).toLocaleString()} in / {(tokenUsage.output || 0).toLocaleString()} out
              </div>
            )}

            {/* Enrichment layers loaded */}
            {enrichmentLoaded && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {[
                  ['therapy_profiles', 'Therapy Profiles'],
                  ['franchise_rules', 'Franchise Rules'],
                  ['author_notes', 'Author Notes'],
                  ['world_locations', 'World Locations'],
                  ['voice_rules', 'Voice Rules'],
                  ['scene_arc', 'Scene Arc'],
                  ['social_feed', 'Social Feed'],
                  ['story_memories', 'Story Memories'],
                  ['continuity_engine', 'Continuity Engine'],
                  ['character_growth', 'Character Growth'],
                  ['world_state', 'World State'],
                  ['character_crossings', 'Crossings'],
                ].map(([key, label]) => (
                  <span key={key} style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 10,
                    background: enrichmentLoaded[key] ? `${T.green}18` : `${T.textFaint}10`,
                    color: enrichmentLoaded[key] ? T.green : T.textFaint,
                    border: `1px solid ${enrichmentLoaded[key] ? T.green : T.textFaint}30`,
                  }}>
                    {enrichmentLoaded[key] ? '✓' : '–'} {label}
                  </span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="see-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setStep('brief')} style={ghostBtn()}>← Back to Brief</button>
              <button onClick={handleRegenerate} disabled={loading} style={{ ...ghostBtn(), borderColor: T.orange, color: T.orange }}>
                ↻ Regenerate
              </button>
              <button onClick={exportAsMarkdown} style={{ ...ghostBtn(), borderColor: T.blue, color: T.blue }}>
                📋 Export Markdown
              </button>
              <button onClick={exportAsPdf} style={{ ...ghostBtn(), borderColor: T.purple, color: T.purple }}>
                📄 Export PDF
              </button>
              <button
                onClick={handleEvaluate}
                disabled={loading}
                style={primaryBtn(loading)}
              >
                {loading ? `Evaluating... (${elapsed}s)` : '◇ Evaluate All Three →'}
              </button>
            </div>

            {loading && <Spinner color={T.purple} label="Claude Opus evaluating..." />}
          </div>
        )}

        {/* ══════ STEP: EVALUATE ══════ */}
        {step === 'evaluate' && evaluation && (
          <div>
            {/* Winner banner */}
            <div className="see-winner" style={{
              background: `${T.green}12`, border: `1px solid ${T.green}`,
              borderRadius: 10, padding: 16, marginBottom: 20,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: 'uppercase', letterSpacing: 1 }}>
                Winner: {evaluation.winner?.replace('_', ' ')}
              </div>
              <div style={{ fontSize: 13, color: T.text, marginTop: 4 }}>{evaluation.winner_reason}</div>
            </div>

            {/* Adjust Scores toggle */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={() => {
                  if (editingScores) {
                    setEditingScores(false);
                  } else {
                    // Seed overrides from current evaluation scores
                    const seed = {};
                    VOICES.forEach(v => {
                      const sc = evaluation.scores?.[v.id];
                      if (sc) {
                        seed[v.id] = {};
                        CRITERIA.forEach(c => { seed[v.id][c] = sc[c] || 0; });
                      }
                    });
                    setScoreOverrides(seed);
                    setEditingScores(true);
                  }
                }}
                style={{ ...ghostBtn(), fontSize: 11, padding: '5px 12px' }}
              >
                {editingScores ? '✓ Done Adjusting' : '✏ Adjust Scores'}
              </button>
            </div>

            {/* Score cards */}
            <div className="see-score-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {VOICES.map(v => {
                const sc = evaluation.scores?.[v.id];
                if (!sc) return null;
                const isWinner = evaluation.winner === v.id;
                const overrides = scoreOverrides?.[v.id];
                const getVal = (c) => (editingScores && overrides) ? (overrides[c] ?? sc[c] ?? 0) : (sc[c] || 0);
                const totalVal = CRITERIA.reduce((sum, c) => sum + getVal(c), 0);
                return (
                  <div key={v.id} style={{
                    padding: 16, borderRadius: 10,
                    border: `1px solid ${isWinner ? v.accent : T.border}`,
                    background: isWinner ? v.bg : T.surface,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: v.accent }}>{v.emoji} {v.label}</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: v.accent }}>{totalVal}/90</span>
                    </div>
                    {CRITERIA.map(c => (
                      <div key={c} className="see-criteria-row" style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontSize: 10, color: T.textDim }}>{CRITERIA_LABELS[c]}</span>
                          {editingScores && overrides && (
                            <input
                              type="number" min={0} max={10}
                              value={overrides[c] ?? sc[c] ?? 0}
                              onChange={e => {
                                const val = Math.max(0, Math.min(10, parseInt(e.target.value) || 0));
                                setScoreOverrides(prev => ({
                                  ...prev,
                                  [v.id]: { ...prev[v.id], [c]: val },
                                }));
                              }}
                              style={{
                                width: 38, padding: '2px 4px', fontSize: 11, textAlign: 'center',
                                border: `1px solid ${T.border}`, borderRadius: 4,
                                background: T.surfaceAlt, color: T.text, outline: 'none',
                              }}
                            />
                          )}
                        </div>
                        <ScoreBar value={getVal(c)} max={10} color={v.accent} />
                      </div>
                    ))}
                    <div className="see-card-summary" style={{ marginTop: 10, fontSize: 12, color: T.textDim, fontStyle: 'italic' }}>{sc.summary}</div>
                    {sc.best_moment && (
                      <div className="see-card-quote" style={{ marginTop: 8, padding: 8, background: T.bg, borderRadius: 4, fontSize: 11, color: T.text, borderLeft: `3px solid ${v.accent}` }}>
                        "{sc.best_moment}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* What each brings */}
            {evaluation.what_each_brings && (
              <div className="see-secondary-section">
              <SectionCard title="What Each Voice Brings">
                <div className="see-each-brings" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {VOICES.map(v => (
                    <div key={v.id} style={{ fontSize: 12, color: T.textDim }}>
                      <span style={{ fontWeight: 600, color: v.accent }}>{v.label}:</span> {evaluation.what_each_brings[v.id]}
                    </div>
                  ))}
                </div>
              </SectionCard>
              </div>
            )}

            {/* Franchise violations */}
            {evaluation.franchise_violations?.length > 0 && (
              <div className="see-secondary-section">
              <SectionCard title="Franchise Violations">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {evaluation.franchise_violations.map((v, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#e74c3c' }}>
                      <span style={{ flexShrink: 0 }}>⚠</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
              </div>
            )}

            {/* Brief diagnosis */}
            {evaluation.brief_diagnosis && (
              <div className="see-secondary-section">
              <SectionCard title="Brief Diagnosis">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, color: T.textFaint }}>Score: </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>{evaluation.brief_diagnosis.score}/10</span>
                  </div>
                  {evaluation.brief_diagnosis.what_was_missing && (
                    <div style={{ fontSize: 12, color: T.textDim }}>
                      <strong>Missing:</strong> {evaluation.brief_diagnosis.what_was_missing}
                    </div>
                  )}
                  {evaluation.brief_diagnosis.improved_brief && (
                    <div style={{ padding: 10, background: T.surfaceAlt, borderRadius: 6, fontSize: 12, color: T.text, border: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 10, color: T.textFaint, marginBottom: 4 }}>IMPROVED BRIEF:</div>
                      {evaluation.brief_diagnosis.improved_brief}
                    </div>
                  )}
                </div>
              </SectionCard>
              </div>
            )}

            {/* Synthesis notes — how voices were combined */}
            {evaluation.synthesis_notes && (
              <SectionCard title="How Voices Were Combined">
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {evaluation.synthesis_notes}
                </div>
              </SectionCard>
            )}

            {/* Approved synthesised version */}
            {evaluation.approved_version && (
              <SectionCard title="Synthesised Approved Version">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, gap: 8 }}>
                  <button
                    onClick={() => {
                      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({
                          type: 'CACHE_STORY',
                          payload: {
                            id: storyId || `draft-${Date.now()}`,
                            title: brief.scene_title || 'Untitled Scene',
                            text: evaluation.approved_version,
                            metadata: { tone: toneDial, characters: brief.characters, date: new Date().toISOString(), winner: evaluation.winner },
                          },
                        });
                        alert('Saved for offline reading');
                      } else {
                        alert('Offline mode not available — service worker not active');
                      }
                    }}
                    style={{ ...ghostBtn(), fontSize: 11, padding: '5px 12px', borderColor: T.green, color: T.green }}
                  >
                    ↓ Save Offline
                  </button>
                  <button
                    onClick={() => {
                      if (editingApproved) {
                        // Save edits back into evaluation
                        setEvaluation(prev => ({ ...prev, approved_version: approvedText }));
                        setEditingApproved(false);
                      } else {
                        setApprovedText(evaluation.approved_version);
                        setEditingApproved(true);
                      }
                    }}
                    style={{ ...ghostBtn(), fontSize: 11, padding: '5px 12px' }}
                  >
                    {editingApproved ? '✓ Done Editing' : '✏ Edit'}
                  </button>
                </div>
                {editingApproved ? (
                  <textarea
                    value={approvedText}
                    onChange={e => setApprovedText(e.target.value)}
                    style={{
                      width: '100%', minHeight: 400, padding: 16, fontSize: 13.5,
                      lineHeight: 1.95, fontFamily: "'Palatino Linotype',Palatino,Georgia,serif",
                      color: T.text, background: T.surfaceAlt, border: `1px solid ${T.border}`,
                      borderRadius: 8, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <StoryReader text={evaluation.approved_version} accent={T.green} maxHeight={400} />
                )}
              </SectionCard>
            )}

            {/* Scene Revelation Analysis */}
            {evaluation.approved_version && brief.characters.length > 0 && brief.registry_id && (
              <div style={{ marginBottom: 16 }}>
                {!sceneRevelations && (
                  <button onClick={handleSceneRevelation} disabled={revLoading}
                    style={{ ...ghostBtn(), borderColor: T.purple, color: T.purple, width: '100%', padding: '10px 16px' }}>
                    {revLoading ? '⏳ Analysing character revelations...' : '✦ Analyse Scene Revelations'}
                  </button>
                )}
                {sceneRevelations && (
                  <SectionCard title="Scene Revelations">
                    {Object.entries(sceneRevelations).map(([charKey, dims]) => (
                      <div key={charKey} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.accent, marginBottom: 6 }}>{charKey}</div>
                        {Object.entries(dims).map(([dim, fields]) => (
                          <div key={dim} style={{ marginLeft: 12, marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: T.text, textTransform: 'capitalize' }}>{dim.replace(/_/g, ' ')}</div>
                            {typeof fields === 'object' && fields !== null
                              ? Object.entries(fields).map(([k, v]) => (
                                  <div key={k} style={{ fontSize: 11, color: T.textDim, marginLeft: 8 }}>
                                    <span style={{ color: T.textFaint }}>{k}:</span> {String(v)}
                                  </div>
                                ))
                              : <div style={{ fontSize: 11, color: T.textDim, marginLeft: 8 }}>{String(fields)}</div>
                            }
                          </div>
                        ))}
                      </div>
                    ))}
                    {/* Auto-suggest relationships from revelations */}
                    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 10 }}>
                      <button
                        onClick={() => {
                          // Build relationship suggestions from revelations
                          const chars = Object.keys(sceneRevelations);
                          const suggestions = [];
                          for (let i = 0; i < chars.length; i++) {
                            for (let j = i + 1; j < chars.length; j++) {
                              const dims_a = sceneRevelations[chars[i]];
                              const dims_b = sceneRevelations[chars[j]];
                              const sharedDims = Object.keys(dims_a).filter(d => dims_b[d]);
                              if (sharedDims.length > 0) {
                                suggestions.push({
                                  pair: [chars[i], chars[j]],
                                  sharedDimensions: sharedDims,
                                  signal: sharedDims.length >= 3 ? 'strong' : sharedDims.length >= 2 ? 'moderate' : 'weak',
                                });
                              }
                            }
                          }
                          // Navigate to RelationshipEngine with suggestion context
                          navigate('/relationship-engine', {
                            state: {
                              autoSuggestions: suggestions,
                              fromScene: brief.scene_title || 'Untitled',
                              registryId: brief.registry_id,
                            },
                          });
                        }}
                        style={{
                          width: '100%', padding: '8px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: `${T.purple}12`, border: `1px solid ${T.purple}40`,
                          color: T.purple, cursor: 'pointer',
                        }}
                      >
                        ◈ Suggest Relationships from Revelations →
                      </button>
                      <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>
                        Opens the Relationship Engine with auto-suggestions based on how characters changed in this scene
                      </div>
                    </div>
                  </SectionCard>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="see-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep('read')} style={ghostBtn()}>← Back to Read</button>
              <button onClick={exportAsMarkdown} style={{ ...ghostBtn(), borderColor: T.blue, color: T.blue }}>📋 Markdown</button>
              <button onClick={exportAsPdf} style={{ ...ghostBtn(), borderColor: T.purple, color: T.purple }}>📄 PDF</button>
              <button
                onClick={handleProposeMemory}
                disabled={loading}
                style={primaryBtn(loading)}
              >
                {loading ? `Proposing memories... (${elapsed}s)` : '◇ Propose Memories →'}
              </button>
            </div>

            {loading && <Spinner color={T.blue} label="Extracting narrative memories..." />}
          </div>
        )}

        {/* ══════ STEP: MEMORY ══════ */}
        {step === 'memory' && (
          <div>
            {plotMemories.length > 0 && (
              <SectionCard title={`Plot Memories (${selectedPlot.size}/${plotMemories.length} selected)`}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <button onClick={() => setSelectedPlot(new Set(plotMemories.map((_, i) => i)))} style={{ ...ghostBtn(), fontSize: 10, padding: '3px 10px' }}>Select All</button>
                  <button onClick={() => setSelectedPlot(new Set())} style={{ ...ghostBtn(), fontSize: 10, padding: '3px 10px' }}>Deselect All</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plotMemories.map((m, i) => (
                    <MemoryCard
                      key={i} item={m}
                      selected={selectedPlot.has(i)}
                      onToggle={() => toggleSet(selectedPlot, setSelectedPlot, i)}
                      accentColor={T.blue}
                    />
                  ))}
                </div>
              </SectionCard>
            )}

            {revelations.length > 0 && (
              <SectionCard title={`Character Revelations (${selectedRev.size}/${revelations.length} selected)`}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <button onClick={() => setSelectedRev(new Set(revelations.map((_, i) => i)))} style={{ ...ghostBtn(), fontSize: 10, padding: '3px 10px' }}>Select All</button>
                  <button onClick={() => setSelectedRev(new Set())} style={{ ...ghostBtn(), fontSize: 10, padding: '3px 10px' }}>Deselect All</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {revelations.map((m, i) => (
                    <MemoryCard
                      key={i} item={m}
                      selected={selectedRev.has(i)}
                      onToggle={() => toggleSet(selectedRev, setSelectedRev, i)}
                      accentColor={T.purple}
                    />
                  ))}
                </div>
              </SectionCard>
            )}

            {plotMemories.length === 0 && revelations.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: T.textDim }}>
                No memory proposals generated.
              </div>
            )}

            <div className="see-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep('evaluate')} style={ghostBtn()}>← Back to Eval</button>
              <button
                onClick={handleProposeRegistry}
                disabled={loading}
                style={primaryBtn(loading)}
              >
                {loading ? `Proposing updates... (${elapsed}s)` : '◇ Propose Registry Updates →'}
              </button>
            </div>

            {loading && <Spinner color={T.purple} label="Analyzing registry impacts..." />}
          </div>
        )}

        {/* ══════ STEP: REGISTRY ══════ */}
        {step === 'registry' && (
          <div>
            {regUpdates.length > 0 ? (
              <SectionCard title={`Registry Updates (${selectedReg.size}/${regUpdates.length} selected)`}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <button onClick={() => setSelectedReg(new Set(regUpdates.map((_, i) => i)))} style={{ ...ghostBtn(), fontSize: 10, padding: '3px 10px' }}>Select All</button>
                  <button onClick={() => setSelectedReg(new Set())} style={{ ...ghostBtn(), fontSize: 10, padding: '3px 10px' }}>Deselect All</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {regUpdates.map((u, i) => (
                    <div
                      key={i}
                      onClick={() => toggleSet(selectedReg, setSelectedReg, i)}
                      style={{
                        padding: 12, borderRadius: 8, cursor: 'pointer',
                        background: selectedReg.has(i) ? `${T.accent}10` : T.surface,
                        border: `1px solid ${selectedReg.has(i) ? T.accent : T.border}`,
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{u.character_key} → <span style={{ color: T.accent }}>{u.field}</span></div>
                          <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>
                            <span style={{ color: T.red, textDecoration: 'line-through' }}>{u.current_value}</span>
                            <span style={{ margin: '0 6px', color: T.textFaint }}>→</span>
                            <span style={{ color: T.green }}>{u.proposed_value}</span>
                          </div>
                          {u.reason && <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4, fontStyle: 'italic' }}>{u.reason}</div>}
                        </div>
                        <div style={{
                          width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginLeft: 10,
                          border: `2px solid ${selectedReg.has(i) ? T.accent : T.border}`,
                          background: selectedReg.has(i) ? T.accent : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {selectedReg.has(i) && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: T.textDim }}>
                No registry updates proposed.
              </div>
            )}

            <SectionCard title="Write-Back Target">
              {/* Book selector */}
              {books.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 4, display: 'block' }}>Book</label>
                  <select
                    value={selectedBookId}
                    onChange={e => handleBookSelect(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', background: T.surfaceAlt,
                      border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
                      fontSize: 13, outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
                    }}
                  >
                    <option value="">All books (show all chapters)</option>
                    {books.map(b => (
                      <option key={b.id} value={b.id}>{b.title || 'Untitled Book'}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Chapter picker */}
              {chapters.length > 0 ? (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: T.text, marginBottom: 4, display: 'block' }}>Chapter</label>
                  <input
                    value={chapterSearch}
                    onChange={e => setChapterSearch(e.target.value)}
                    placeholder="Search chapters by title..."
                    style={{
                      width: '100%', padding: '10px 12px', background: T.surfaceAlt,
                      border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
                      fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8,
                    }}
                  />
                  <div style={{ maxHeight: 160, overflowY: 'auto', borderRadius: 6, border: `1px solid ${T.border}` }}>
                    {chapters
                      .filter(ch => !chapterSearch || (ch.title || ch.id || '').toLowerCase().includes(chapterSearch.toLowerCase()))
                      .slice(0, 20)
                      .map(ch => (
                        <div key={ch.id}
                          onClick={() => { setChapterId(ch.id); setChapterSearch(ch.title || ch.id); }}
                          style={{
                            padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                            background: chapterId === ch.id ? `${T.accent}15` : 'transparent',
                            borderBottom: `1px solid ${T.border}`, color: T.text,
                          }}
                        >
                          <strong>{ch.title || 'Untitled'}</strong>
                          <span style={{ fontSize: 10, color: T.textFaint, marginLeft: 8 }}>{ch.id?.slice(0, 8)}…</span>
                        </div>
                      ))}
                  </div>
                  {chapterId && (
                    <div style={{ fontSize: 10, color: T.green, marginTop: 4 }}>Selected: {chapterId}</div>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    value={chapterId}
                    onChange={e => setChapterId(e.target.value)}
                    placeholder="Chapter UUID — the manuscript chapter to write into"
                    style={{
                      width: '100%', padding: '10px 12px', background: T.surfaceAlt,
                      border: `1px solid ${chapterId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId) ? '#e74c3c' : T.border}`,
                      borderRadius: 6, color: T.text, fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  {chapterId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chapterId) && (
                    <div style={{ fontSize: 10, color: '#e74c3c', marginTop: 4 }}>Not a valid UUID format</div>
                  )}
                </div>
              )}
              <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>
                The approved story will be written as lines into this chapter
              </div>
            </SectionCard>

            <div className="see-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep('memory')} style={ghostBtn()}>← Back to Memory</button>
              <button
                onClick={handleWriteBack}
                disabled={loading || !chapterId.trim()}
                style={{
                  ...primaryBtn(loading || !chapterId.trim()),
                  background: (loading || !chapterId.trim()) ? T.border : T.green,
                }}
              >
                {loading ? `Writing back... (${elapsed}s)` : '✓ Write Back to Manuscript'}
              </button>
            </div>

            {loading && <Spinner color={T.green} label="Writing to manuscript..." />}
          </div>
        )}

        {/* ══════ STEP: WRITE-BACK COMPLETE ══════ */}
        {step === 'writeback' && writeResult && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.green, marginBottom: 8 }}>Write-Back Complete</div>
            <div style={{ fontSize: 13, color: T.textDim, maxWidth: 420, margin: '0 auto', lineHeight: 1.7 }}>
              <strong>{writeResult.lines_written}</strong> lines written to chapter<br />
              <strong>{writeResult.memories_committed}</strong> memories committed<br />
              <strong>{writeResult.registry_updates_applied}</strong> registry updates applied
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
              <button onClick={() => { setStep('brief'); setBrief(EMPTY_BRIEF); setCharInput(''); setStories(null); setEvaluation(null); setStoryId(null); setWriteResult(null); setScoreOverrides(null); setEditingScores(false); setTokenUsage(null); setCharFetchStatus({}); setCharContext({}); setSceneRevelations(null); localStorage.removeItem(SESSION_KEY); setSessionCleared(c => c + 1); }} style={ghostBtn()}>
                ◇ New Scene
              </button>
              <button onClick={() => navigate(-1)} style={{ ...ghostBtn(), borderColor: T.accent, color: T.accent }}>
                ← Back to Story Engine
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes see2-spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 10, padding: 18, marginBottom: 16,
    }}>
      {title && (
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.accent,
          textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
        }}>{title}</div>
      )}
      {children}
    </div>
  );
}

function ghostBtn() {
  return {
    padding: '10px 18px', background: 'transparent', color: T.textDim,
    border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13,
    cursor: 'pointer', transition: 'all 0.2s',
  };
}

function primaryBtn(disabled) {
  return {
    padding: '12px 24px', background: disabled ? T.border : T.accent,
    color: '#fff', border: 'none', borderRadius: 8, fontSize: 13,
    fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
    letterSpacing: 0.3, transition: 'background 0.2s',
    opacity: disabled ? 0.6 : 1,
  };
}
