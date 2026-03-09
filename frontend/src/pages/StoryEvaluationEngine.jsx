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
import './StoryEvaluationEngine.css';

const API = '/api/v1/memories';

// ── Light theme ───────────────────────────────────────────────────────────
const T = {
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
};

const VOICES = [
  { id: 'voice_a', label: 'Voice A', tag: 'Depth · Interiority',   accent: '#6B4C82', bg: '#faf8fc', border: '#e8e0f0', emoji: '◆' },
  { id: 'voice_b', label: 'Voice B', tag: 'Tension · Momentum',    accent: '#3D7A9B', bg: '#f6fafc', border: '#d8e8f0', emoji: '◈' },
  { id: 'voice_c', label: 'Voice C', tag: 'Sensory · Desire',      accent: '#4A8A3D', bg: '#f6faf4', border: '#d8f0d0', emoji: '◉' },
];

const CRITERIA = ['interiority', 'desire_tension', 'specificity', 'stakes', 'voice', 'body_presence'];
const CRITERIA_LABELS = {
  interiority:    'Interiority',
  desire_tension: 'Desire & Tension',
  specificity:    'Specificity',
  stakes:         'Stakes',
  voice:          'Voice',
  body_presence:  'Body Presence',
};

const STEPS = ['brief', 'generate', 'read', 'evaluate', 'memory', 'registry', 'writeback'];
const STEP_LABELS = ['Brief', 'Generate', 'Read', 'Evaluate', 'Memory', 'Registry', 'Write-Back'];

const CONTENT_TYPES = [
  'Novel', 'Short Story', 'Screenplay', 'TV Pilot', 'TV Episode',
  'Stage Play', 'Memoir', 'Personal Essay', 'Newsletter', 'Song Lyrics',
  'Poetry Collection', 'Graphic Novel', 'Game Narrative', 'Podcast Script', 'Other',
];

const EMPTY_BRIEF = {
  scene_title: '', situation: '', content_name: '', content_type: '', content_type_other: '',
  content_history: '', why_it_matters: '', life_constraints: '', support_system: '',
  emotional_stakes: '', what_failure_means: '', deadline_context: '', deadline_pressure: '',
  characters: [], registry_id: '', internal_conflict: '', world_context: '',
};

const BRIEF_REQUIRED = ['situation', 'content_name', 'content_type', 'emotional_stakes', 'characters'];

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
  const filled = BRIEF_REQUIRED.filter(k => k === 'characters' ? b.characters.length > 0 : (b[k] || '').trim());
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
  ].filter(Boolean).join(' ');
}

const briefInputStyle = {
  width: '100%', padding: '10px 12px', background: T.surfaceAlt,
  border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const briefTextareaStyle = {
  ...briefInputStyle, padding: '12px 14px', fontSize: 13.5,
  lineHeight: 1.7, fontFamily: 'Georgia,serif', resize: 'vertical',
};

// ── API helpers ───────────────────────────────────────────────────────────
async function apiPost(endpoint, body) {
  const res = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function apiGet(endpoint) {
  const res = await fetch(`${API}/${endpoint}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
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
  const updateBrief = (key, val) => setBrief(prev => ({ ...prev, [key]: val }));

  // Generation result
  const [storyId, setStoryId] = useState(null);
  const [stories, setStories] = useState(null); // { voice_a, voice_b, voice_c }
  const [activeVoice, setActiveVoice] = useState('voice_a');

  // Evaluation result
  const [evaluation, setEvaluation] = useState(null);

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

  // Timer
  const [elapsed, setElapsed] = useState(0);

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

    // Router state — rich task data
    if (task) {
      if (task.title) patch.scene_title = task.title;
      if (task.obstacle) patch.internal_conflict = task.obstacle;
      if (task.strength_weaponized) patch.what_failure_means = task.strength_weaponized;
      if (task.therapy_seeds?.length) patch.emotional_stakes = task.therapy_seeds.join('. ');
      if (task.phase) {
        const phaseMap = { establishment: 'low', pressure: 'medium', crisis: 'high', integration: 'medium' };
        patch.deadline_pressure = phaseMap[task.phase] || '';
      }
      // Build world context from available signals
      const ctxParts = [];
      if (st.activeWorld) ctxParts.push(`World: ${st.activeWorld}`);
      if (task.story_type) ctxParts.push(`Story type: ${task.story_type}`);
      if (task.domains_active?.length) ctxParts.push(`Active domains: ${task.domains_active.join(', ')}`);
      if (task.new_character_name) ctxParts.push(`New character: ${task.new_character_name} (${task.new_character_role || 'role TBD'})`);
      if (ctxParts.length) patch.world_context = ctxParts.join('. ') + '.';
    }

    // Auto-extract content info from the situation/task text
    const situationText = patch.situation || task?.task || '';
    if (situationText) {
      const extracted = extractContentFromTask(situationText);
      if (extracted.content_name && !patch.content_name) patch.content_name = extracted.content_name;
      if (extracted.content_type && !patch.content_type) patch.content_type = extracted.content_type;
    }

    if (Object.keys(patch).length) setBrief(prev => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  // ── Fetch living context + relationship edges for a character ─────
  const fetchCharacterContext = useCallback(async (charKey, registryId) => {
    if (!registryId || !charKey) return;
    try {
      const res = await fetch(`/api/v1/character-registry/characters/scene-context/${encodeURIComponent(charKey)}?registry_id=${encodeURIComponent(registryId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;
      setCharContext(prev => ({ ...prev, [charKey]: data }));
    } catch { /* silent — context is optional enrichment */ }
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
      });
      setStoryId(data.story_id);
      setStories(data.stories);
      setStep('read');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [brief]);

  const handleEvaluate = useCallback(async () => {
    if (!storyId) return;
    setError(null); setLoading(true);
    try {
      const data = await apiPost('evaluate-stories', { story_id: storyId });
      setEvaluation(data.evaluation);
      setStep('evaluate');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [storyId]);

  const handleProposeMemory = useCallback(async () => {
    if (!storyId) return;
    setError(null); setLoading(true);
    try {
      const data = await apiPost('propose-memory', { story_id: storyId });
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
      const data = await apiPost('propose-registry-update', { story_id: storyId });
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
      });
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

  // ── Current step index ───────────────────────────────────────────────
  const stepIdx = STEPS.indexOf(step);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="see-page" style={{
      height: '100vh', background: T.bg, color: T.text,
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {/* Header */}
      <div className="see-header" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderBottom: `1px solid ${T.border}`, background: T.surface,
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
            </div>
          </div>
        </div>
        {loading && (
          <span style={{ fontSize: 11, color: T.accent, fontFamily: 'monospace' }}>
            {elapsed}s elapsed
          </span>
        )}
      </div>

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
              <span style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                background: briefCompleteness(brief) >= 60 ? `${T.green}20` : `${T.accent}20`,
                color: briefCompleteness(brief) >= 60 ? T.green : T.accent,
              }}>
                {briefCompleteness(brief)}% complete
              </span>
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
                <textarea value={brief.world_context} onChange={e => updateBrief('world_context', e.target.value)}
                  rows={2} placeholder="Time period, location, cultural norms, industry rules..."
                  style={briefTextareaStyle} />
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
              {brief.characters.some(c => charContext[c]) && (
                <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8, lineHeight: 1.5 }}>
                  {brief.characters.map(c => {
                    const ctx = charContext[c];
                    if (!ctx) return null;
                    const relCount = (ctx.relationships || []).length;
                    const hasLC = ctx.living_context && Object.values(ctx.living_context).some(Boolean);
                    return (
                      <div key={c} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                        <span style={{ color: T.accent }}>✦</span>
                        <span><strong>{ctx.display_name || c}</strong>
                          {hasLC ? ' — context loaded' : ''}
                          {relCount > 0 ? ` · ${relCount} relationship${relCount > 1 ? 's' : ''}` : ''}
                        </span>
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

            {loading && <Spinner color={T.accent} label="3 voices writing in parallel..." />}
          </div>
        )}

        {/* ══════ STEP: READ ══════ */}
        {(step === 'read' || step === 'generate') && stories && (
          <div>
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

            {/* Story reader */}
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

            {/* Actions */}
            <div className="see-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setStep('brief')} style={ghostBtn}>← Back to Brief</button>
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

            {/* Score cards */}
            <div className="see-score-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {VOICES.map(v => {
                const sc = evaluation.scores?.[v.id];
                if (!sc) return null;
                const isWinner = evaluation.winner === v.id;
                return (
                  <div key={v.id} style={{
                    padding: 16, borderRadius: 10,
                    border: `1px solid ${isWinner ? v.accent : T.border}`,
                    background: isWinner ? v.bg : T.surface,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: v.accent }}>{v.emoji} {v.label}</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: v.accent }}>{sc.total}/60</span>
                    </div>
                    {CRITERIA.map(c => (
                      <div key={c} className="see-criteria-row" style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 10, color: T.textDim }}>{CRITERIA_LABELS[c]}</span>
                        </div>
                        <ScoreBar value={sc[c] || 0} max={10} color={v.accent} />
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
                <StoryReader text={evaluation.approved_version} accent={T.green} maxHeight={400} />
              </SectionCard>
            )}

            {/* Actions */}
            <div className="see-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep('read')} style={ghostBtn}>← Back to Read</button>
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
              <button onClick={() => setStep('evaluate')} style={ghostBtn}>← Back to Eval</button>
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
              <input
                value={chapterId}
                onChange={e => setChapterId(e.target.value)}
                placeholder="Chapter UUID — the manuscript chapter to write into"
                style={{
                  width: '100%', padding: '10px 12px', background: T.surfaceAlt,
                  border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
                  fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>
                The approved story will be written as lines into this chapter
              </div>
            </SectionCard>

            <div className="see-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep('memory')} style={ghostBtn}>← Back to Memory</button>
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
              <button onClick={() => { setStep('brief'); setBrief(EMPTY_BRIEF); setCharInput(''); setStories(null); setEvaluation(null); setStoryId(null); setWriteResult(null); }} style={ghostBtn}>
                ◇ New Scene
              </button>
              <button onClick={() => navigate(-1)} style={{ ...ghostBtn, borderColor: T.accent, color: T.accent }}>
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

const ghostBtn = {
  padding: '10px 18px', background: 'transparent', color: T.textDim,
  border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13,
  cursor: 'pointer', transition: 'all 0.2s',
};

function primaryBtn(disabled) {
  return {
    padding: '12px 24px', background: disabled ? T.border : T.accent,
    color: '#fff', border: 'none', borderRadius: 8, fontSize: 13,
    fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
    letterSpacing: 0.3, transition: 'background 0.2s',
    opacity: disabled ? 0.6 : 1,
  };
}
