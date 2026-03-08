/**
 * StoryEvaluationEngine.jsx — v2
 *
 * Multi-agent blind story generation → editorial evaluation →
 * memory proposals → registry update proposals → manuscript write-back.
 *
 * Light theme. All AI calls routed through backend.
 *
 * Flow:
 *   1. BRIEF     — Write scene brief, set tone dial, pick characters
 *   2. GENERATE  — Backend spawns 3 blind voices in parallel
 *   3. READ      — Read all 3 versions side-by-side
 *   4. EVALUATE  — Claude Opus scores + synthesises approved version
 *   5. MEMORY    — Propose plot memories + character revelations
 *   6. REGISTRY  — Propose registry profile updates
 *   7. WRITE-BACK — Commit to manuscript chapter + confirm memories
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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

const TONE_OPTIONS = [
  { value: 'literary',  label: '📖 Literary',  desc: 'Psychological depth, subtext' },
  { value: 'thriller',  label: '⚡ Thriller',   desc: 'Pacing, stakes, hooks' },
  { value: 'lyrical',   label: '🌊 Lyrical',   desc: 'Sensory language, metaphor' },
  { value: 'intimate',  label: '🌙 Intimate',  desc: 'Closeness, body, silence' },
  { value: 'dark',      label: '🖤 Dark',      desc: 'Tension, moral ambiguity' },
  { value: 'warm',      label: '☀️ Warm',      desc: 'Connection, earned tenderness' },
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

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function StoryEvaluationEngine() {
  const navigate = useNavigate();

  // ── State ────────────────────────────────────────────────────────────
  const [step, setStep] = useState('brief');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Brief
  const [sceneBrief, setSceneBrief] = useState('');
  const [toneDial, setToneDial] = useState('literary');
  const [characters, setCharacters] = useState('');
  const [registryId, setRegistryId] = useState('');

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

  // ── Read brief from URL query param on mount ─────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const briefParam = params.get('brief');
    if (briefParam) {
      try { setSceneBrief(decodeURIComponent(briefParam)); }
      catch { setSceneBrief(briefParam); }
    }
  }, []);

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!sceneBrief.trim()) { setError('Scene brief is required'); return; }
    setError(null); setLoading(true);
    try {
      const chars = characters.split(',').map(c => c.trim()).filter(Boolean);
      const data = await apiPost('generate-story-multi', {
        scene_brief: sceneBrief,
        tone_dial: toneDial,
        characters_in_scene: chars,
        registry_id: registryId || undefined,
      });
      setStoryId(data.story_id);
      setStories(data.stories);
      setStep('read');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [sceneBrief, toneDial, characters, registryId]);

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
    <div style={{
      minHeight: '100vh', background: T.bg, color: T.text,
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      {/* Header */}
      <div style={{
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
            <div style={{ fontSize: 10, color: T.textDim }}>
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
      <div style={{ display: 'flex', padding: '12px 24px', gap: 4, background: T.surface, borderBottom: `1px solid ${T.border}` }}>
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
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

        {/* ══════ STEP: BRIEF ══════ */}
        {step === 'brief' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SectionCard title="Scene Brief">
              <textarea
                value={sceneBrief}
                onChange={e => setSceneBrief(e.target.value)}
                placeholder="Describe the scene — what's at stake, who's involved, what must change by the end..."
                rows={6}
                style={{
                  width: '100%', padding: '12px 14px', background: T.surfaceAlt,
                  border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
                  fontSize: 13.5, lineHeight: 1.7, fontFamily: 'Georgia,serif',
                  resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </SectionCard>

            <SectionCard title="Tone Dial">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {TONE_OPTIONS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setToneDial(t.value)}
                    style={{
                      padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                      border: `1px solid ${toneDial === t.value ? T.accent : T.border}`,
                      background: toneDial === t.value ? `${T.accent}12` : T.surface,
                      textAlign: 'left', transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: toneDial === t.value ? T.accent : T.text }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </SectionCard>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <SectionCard title="Characters in Scene">
                <input
                  value={characters}
                  onChange={e => setCharacters(e.target.value)}
                  placeholder="character_key_1, character_key_2"
                  style={{
                    width: '100%', padding: '10px 12px', background: T.surfaceAlt,
                    border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>Comma-separated character keys</div>
              </SectionCard>

              <SectionCard title="Registry ID (optional)">
                <input
                  value={registryId}
                  onChange={e => setRegistryId(e.target.value)}
                  placeholder="UUID of character registry"
                  style={{
                    width: '100%', padding: '10px 12px', background: T.surfaceAlt,
                    border: `1px solid ${T.border}`, borderRadius: 6, color: T.text,
                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4 }}>Loads character dossiers for context</div>
              </SectionCard>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={handleGenerate}
                disabled={loading || !sceneBrief.trim()}
                style={{
                  padding: '12px 28px', background: T.accent, color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', letterSpacing: 0.3, transition: 'background 0.2s',
                  opacity: loading || !sceneBrief.trim() ? 0.5 : 1,
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
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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
            <div style={{
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
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
            <div style={{
              background: `${T.green}12`, border: `1px solid ${T.green}`,
              borderRadius: 10, padding: 16, marginBottom: 20,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: 'uppercase', letterSpacing: 1 }}>
                Winner: {evaluation.winner?.replace('_', ' ')}
              </div>
              <div style={{ fontSize: 13, color: T.text, marginTop: 4 }}>{evaluation.winner_reason}</div>
            </div>

            {/* Score cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
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
                      <div key={c} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 10, color: T.textDim }}>{CRITERIA_LABELS[c]}</span>
                        </div>
                        <ScoreBar value={sc[c] || 0} max={10} color={v.accent} />
                      </div>
                    ))}
                    <div style={{ marginTop: 10, fontSize: 12, color: T.textDim, fontStyle: 'italic' }}>{sc.summary}</div>
                    {sc.best_moment && (
                      <div style={{ marginTop: 8, padding: 8, background: T.bg, borderRadius: 4, fontSize: 11, color: T.text, borderLeft: `3px solid ${v.accent}` }}>
                        "{sc.best_moment}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* What each brings */}
            {evaluation.what_each_brings && (
              <SectionCard title="What Each Voice Brings">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {VOICES.map(v => (
                    <div key={v.id} style={{ fontSize: 12, color: T.textDim }}>
                      <span style={{ fontWeight: 600, color: v.accent }}>{v.label}:</span> {evaluation.what_each_brings[v.id]}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Brief diagnosis */}
            {evaluation.brief_diagnosis && (
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
            )}

            {/* Approved synthesised version */}
            {evaluation.approved_version && (
              <SectionCard title="Synthesised Approved Version">
                <StoryReader text={evaluation.approved_version} accent={T.green} maxHeight={400} />
              </SectionCard>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
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
              <button onClick={() => { setStep('brief'); setSceneBrief(''); setStories(null); setEvaluation(null); setStoryId(null); setWriteResult(null); }} style={ghostBtn}>
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
