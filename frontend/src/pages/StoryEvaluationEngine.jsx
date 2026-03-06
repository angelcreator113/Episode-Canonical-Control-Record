/**
 * StoryEvaluationEngine.jsx
 *
 * Multi-model story generation + editorial evaluation engine.
 * Light theme. Routes all AI calls through the backend (no direct Anthropic calls from browser).
 *
 * INTEGRATION WITH STORY ENGINE:
 *   Can be used standalone at /story-evaluation OR embedded inside StoryEngine
 *   as an evaluation tab. When props.storyText is provided, it skips generation
 *   and goes straight to evaluation mode on that single draft.
 *
 * Props (all optional — standalone mode if none provided):
 *   storyText     — existing draft from StoryEngine to evaluate
 *   taskBrief     — the task/brief that produced the story
 *   characterKey  — active character key from StoryEngine
 *   onApproveVersion — callback(text) when user approves a synthesized version
 *   onClose       — callback to exit back to StoryEngine
 */

import { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const API_BASE = '/api/v1';

const MODELS = [
  { id: 'claude',  label: 'Claude',  tag: 'Depth · Interiority', accent: '#6B4C82', bg: '#faf8fc', border: '#e8e0f0', emoji: '◆' },
  { id: 'gpt4o',   label: 'GPT-4o',  tag: 'Tension · Momentum',  accent: '#3D7A9B', bg: '#f6fafc', border: '#d8e8f0', emoji: '◈' },
  { id: 'gemini',  label: 'Gemini',  tag: 'Sensory · Desire',     accent: '#4A8A3D', bg: '#f6faf4', border: '#d8f0d0', emoji: '◉' },
];

const CRITERIA = {
  interiority:    'Interiority',
  desire_tension: 'Desire & Tension',
  specificity:    'Specificity',
  stakes:         'Stakes',
  voice:          'Voice',
  body_presence:  'Body Presence',
};

// ── API helper — routes through our backend, never direct to Anthropic ────

async function apiGenerate(endpoint, body) {
  const res = await fetch(`${API_BASE}/memories/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── UI Components ─────────────────────────────────────────────────────────

function Spinner({ color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 14 }}>
      <div style={{ width: 28, height: 28, border: '2px solid #e0e0e0', borderTop: `2px solid ${color}`, borderRadius: '50%', animation: 'see-spin 0.9s linear infinite' }} />
      <span style={{ color: '#999', fontSize: 10, fontFamily: 'monospace', letterSpacing: 1 }}>writing...</span>
    </div>
  );
}

function StoryText({ text, accent }) {
  const paras = (text || '').split('\n').filter(p => p.trim());
  return (
    <div style={{ overflowY: 'auto', maxHeight: 520 }}>
      {paras.map((p, i) => (
        <p key={i} style={{ color: i === 0 ? '#1a1a1a' : '#555', fontSize: 13.5, lineHeight: 1.95, marginBottom: 16, fontFamily: "'Palatino Linotype',Palatino,Georgia,serif" }}>
          {i === 0 ? <><span style={{ color: accent, fontSize: 22, fontWeight: 700, float: 'left', lineHeight: 1, marginRight: 4, marginTop: 3 }}>{p[0]}</span>{p.slice(1)}</> : p}
        </p>
      ))}
    </div>
  );
}

function ProofText({ issues, accent }) {
  if (!issues?.length) return <p style={{ color: '#999', fontSize: 12, fontFamily: 'Georgia,serif', fontStyle: 'italic' }}>No significant issues found.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {issues.map((iss, i) => (
        <div key={i} style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 12, paddingTop: 6, paddingBottom: 6 }}>
          <span style={{ color: '#555', fontSize: 12, fontFamily: 'Georgia,serif', lineHeight: 1.7 }}>{iss}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreArc({ value, max = 10, accent, size = 50 }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const d = c * (value / max);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eee" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accent} strokeWidth="3"
        strokeDasharray={`${d} ${c - d}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        fill={accent} fontSize="12" fontWeight="700" fontFamily="monospace"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>{value}</text>
    </svg>
  );
}

function ModelCol({ model, story, gen, winner, onRegen }) {
  const [view, setView] = useState('story');
  return (
    <div style={{ background: model.bg, border: `1px solid ${winner ? model.accent : model.border}`, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: winner ? `0 0 24px ${model.accent}20` : '0 1px 4px rgba(0,0,0,0.06)', transition: 'box-shadow 0.5s' }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${model.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: model.accent, fontSize: 12, fontWeight: 700, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
              {model.emoji} {model.label}
              {winner && <span style={{ background: model.accent, color: '#fff', fontSize: 9, padding: '2px 7px', borderRadius: 10, letterSpacing: 0.5, fontWeight: 800 }}>BEST</span>}
            </div>
            <div style={{ color: '#999', fontSize: 10, marginTop: 2 }}>{model.tag}</div>
          </div>
          {story && <button onClick={onRegen} style={{ background: 'none', border: `1px solid ${model.border}`, color: '#888', fontSize: 10, padding: '3px 9px', borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace' }}>↺</button>}
        </div>
        {story && (
          <div style={{ display: 'flex', marginTop: 12, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
            {['story', 'proof'].map(t => (
              <button key={t} onClick={() => setView(t)} style={{ flex: 1, padding: '5px 0', border: 'none', cursor: 'pointer', background: view === t ? model.accent : 'transparent', color: view === t ? '#fff' : '#888', fontSize: 10, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 0.5 }}>
                {t === 'story' ? 'STORY' : 'PROOFREAD'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, padding: '16px', minHeight: 380 }}>
        {gen ? <Spinner color={model.accent} /> :
         !story ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: '#ddd', fontSize: 36 }}>—</div> :
         view === 'story' ? <StoryText text={story.prose} accent={model.accent} /> :
         <ProofText issues={story.proof} accent={model.accent} />}
      </div>
      {story && !gen && (
        <div style={{ padding: '8px 16px', borderTop: `1px solid ${model.border}`, color: '#aaa', fontSize: 10, fontFamily: 'monospace' }}>
          {story.prose?.split(/\s+/).filter(Boolean).length || 0} words
        </div>
      )}
    </div>
  );
}

function Scores({ ev }) {
  const { scores, winner, winner_reason, what_each_brings } = ev;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
        {MODELS.map(m => {
          const s = scores?.[m.id]; if (!s) return null;
          return (
            <div key={m.id} style={{ background: m.bg, border: `1px solid ${winner === m.id ? m.accent : m.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ color: m.accent, fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{m.emoji} {m.label}</span>
                <ScoreArc value={s.total || 0} max={60} accent={m.accent} />
              </div>
              {Object.entries(CRITERIA).map(([k, label]) => (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: '#888', fontSize: 10, fontFamily: 'monospace' }}>{label}</span>
                    <span style={{ color: m.accent, fontSize: 10, fontFamily: 'monospace' }}>{s[k] || 0}</span>
                  </div>
                  <div style={{ height: 2, background: '#eee', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${((s[k] || 0) / 10) * 100}%`, background: m.accent, borderRadius: 2, transition: 'width 1.2s cubic-bezier(.4,0,.2,1)' }} />
                  </div>
                </div>
              ))}
              <p style={{ color: '#666', fontSize: 11, fontFamily: 'Georgia,serif', fontStyle: 'italic', marginTop: 10, lineHeight: 1.65 }}>{s.summary}</p>
              {s.best_moment && (
                <div style={{ marginTop: 10, borderLeft: `2px solid ${m.accent}`, paddingLeft: 10 }}>
                  <div style={{ color: '#aaa', fontSize: 9, fontFamily: 'monospace', letterSpacing: 1, marginBottom: 4 }}>BEST MOMENT</div>
                  <p style={{ color: '#444', fontSize: 11, fontFamily: 'Georgia,serif', fontStyle: 'italic', lineHeight: 1.65 }}>{s.best_moment}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {winner && (
        <div style={{ background: '#fff', border: `1px solid ${MODELS.find(m => m.id === winner)?.accent || '#ddd'}`, borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ color: MODELS.find(m => m.id === winner)?.accent, fontSize: 9, fontFamily: 'monospace', letterSpacing: 1.5, marginBottom: 10 }}>
            {MODELS.find(m => m.id === winner)?.emoji} {MODELS.find(m => m.id === winner)?.label?.toUpperCase()} WINS
          </div>
          <p style={{ color: '#444', fontSize: 13, fontFamily: 'Georgia,serif', lineHeight: 1.8, marginBottom: what_each_brings ? 18 : 0 }}>{winner_reason}</p>
          {what_each_brings && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {MODELS.map(m => what_each_brings[m.id] && (
                <div key={m.id} style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ color: m.accent, fontSize: 9, fontFamily: 'monospace', letterSpacing: 1, marginBottom: 6 }}>TAKEN FROM {m.label.toUpperCase()}</div>
                  <p style={{ color: '#666', fontSize: 11, fontFamily: 'Georgia,serif', lineHeight: 1.6 }}>{what_each_brings[m.id]}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PromptDx({ dx }) {
  if (!dx) return null;
  const col = dx.score >= 7 ? '#4A8A3D' : dx.score >= 4 ? '#B08A30' : '#B03030';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#888', fontSize: 9, fontFamily: 'monospace', letterSpacing: 2 }}>PROMPT STRENGTH</span>
        <span style={{ background: col, color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 14px', borderRadius: 20, fontFamily: 'monospace' }}>{dx.score}/10</span>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16 }}>
        <div style={{ color: '#aaa', fontSize: 9, fontFamily: 'monospace', letterSpacing: 1, marginBottom: 8 }}>WHAT WAS MISSING</div>
        <p style={{ color: '#444', fontSize: 13, fontFamily: 'Georgia,serif', lineHeight: 1.85 }}>{dx.what_was_missing}</p>
      </div>
      <div style={{ background: '#f6faf4', border: '1px solid #d0e8c8', borderRadius: 8, padding: 16 }}>
        <div style={{ color: '#4A8A3D', fontSize: 9, fontFamily: 'monospace', letterSpacing: 1, marginBottom: 8 }}>STRONGER PROMPT</div>
        <p style={{ color: '#2a5a22', fontSize: 13, fontFamily: "'Courier New',monospace", lineHeight: 1.85 }}>{dx.improved_prompt}</p>
        <button onClick={() => navigator.clipboard.writeText(dx.improved_prompt)} style={{ marginTop: 12, background: 'none', border: '1px solid #c0d8b8', color: '#4A8A3D', fontSize: 10, padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace' }}>Copy</button>
      </div>
    </div>
  );
}

function Approved({ text, onApproveVersion }) {
  if (!text) return null;
  const paras = text.split('\n').filter(p => p.trim());
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ color: '#6B4C82', fontSize: 9, fontFamily: 'monospace', letterSpacing: 2, marginBottom: 4 }}>APPROVED VERSION</div>
          <div style={{ color: '#888', fontSize: 11, fontFamily: 'Georgia,serif' }}>Best elements synthesized — ready for manuscript</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => navigator.clipboard.writeText(text)} style={{ background: 'none', border: '1px solid #ddd', color: '#888', fontSize: 10, padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace' }}>Copy</button>
          {onApproveVersion && (
            <button onClick={() => onApproveVersion(text)} style={{ background: '#6B4C82', border: 'none', color: '#fff', fontSize: 10, padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700 }}>Use in Story Engine</button>
          )}
        </div>
      </div>
      <div style={{ background: '#fdfcf8', border: '1px solid #e8e4d8', borderRadius: 10, padding: '36px 40px', maxHeight: 680, overflowY: 'auto' }}>
        {paras.map((p, i) => (
          <p key={i} style={{ color: i === 0 ? '#1a1a1a' : '#444', fontSize: 15, lineHeight: 2.05, marginBottom: 24, fontFamily: "'Palatino Linotype',Palatino,Georgia,serif" }}>
            {i === 0 ? <><span style={{ color: '#6B4C82', fontSize: 26, fontWeight: 700, float: 'left', lineHeight: 1, marginRight: 5, marginTop: 4 }}>{p[0]}</span>{p.slice(1)}</> : p}
          </p>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function StoryEvaluationEngine({ storyText: propStoryText, taskBrief: propTaskBrief, characterKey: propCharKey, onApproveVersion, onClose: propOnClose }) {
  const location = useLocation();
  const nav = useNavigate();

  // Support both direct props (embedded) and router state (navigated from StoryEngine)
  const storyText    = propStoryText || location.state?.storyText;
  const taskBrief    = propTaskBrief || location.state?.taskBrief;
  const characterKey = propCharKey   || location.state?.characterKey;
  const onClose      = propOnClose   || (() => nav(-1));

  const [prompt, setPrompt]     = useState(taskBrief?.task || '');
  const [stories, setStories]   = useState({ claude: null, gpt4o: null, gemini: null });
  const [gen, setGen]           = useState({ claude: false, gpt4o: false, gemini: false });
  const [ev, setEv]             = useState(null);
  const [evLoading, setEvLoad]  = useState(false);
  const [tab, setTab]           = useState('scores');
  const [started, setStarted]   = useState(false);

  // If storyText is provided (from StoryEngine), pre-populate Claude column
  const isEmbedded = !!storyText;

  const runOne = useCallback(async (modelId) => {
    if (!prompt.trim()) return;
    setGen(g => ({ ...g, [modelId]: true }));
    setStories(s => ({ ...s, [modelId]: null }));
    setEv(null);
    try {
      const data = await apiGenerate('evaluate-generate-story', {
        modelVoice: modelId,
        prompt: prompt.trim(),
        characterKey: characterKey || 'justawoman',
      });
      setStories(s => ({ ...s, [modelId]: { prose: data.text, proof: [] } }));
    } catch (e) {
      setStories(s => ({ ...s, [modelId]: { prose: `Error: ${e.message}`, proof: [] } }));
    } finally {
      setGen(g => ({ ...g, [modelId]: false }));
    }
  }, [prompt, characterKey]);

  const runAll = useCallback(async () => {
    if (!prompt.trim()) return;
    setStarted(true); setEv(null);
    await Promise.all(MODELS.map(m => runOne(m.id)));
  }, [prompt, runOne]);

  const evaluate = useCallback(async () => {
    if (!MODELS.every(m => stories[m.id]?.prose)) return;
    setEvLoad(true); setEv(null);
    try {
      const data = await apiGenerate('evaluate-stories', {
        stories: {
          claude: stories.claude?.prose,
          gpt4o: stories.gpt4o?.prose,
          gemini: stories.gemini?.prose,
        },
        prompt: prompt.trim(),
      });
      setStories(s => ({
        claude: { ...s.claude, proof: data.proofreading?.claude || [] },
        gpt4o:  { ...s.gpt4o,  proof: data.proofreading?.gpt4o || [] },
        gemini: { ...s.gemini, proof: data.proofreading?.gemini || [] },
      }));
      setEv(data);
      setTab('scores');
    } catch (e) { console.error(e); }
    finally { setEvLoad(false); }
  }, [stories, prompt]);

  const allDone = MODELS.every(m => stories[m.id]?.prose && !gen[m.id]);
  const anyGen  = Object.values(gen).some(Boolean);
  const winner  = ev?.winner;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', color: '#1a1a1a' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Space+Mono:wght@400;700&display=swap');
        @keyframes see-spin { to { transform: rotate(360deg); } }
        @keyframes see-up   { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{ padding: '16px 26px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 50, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div>
          <div style={{ color: '#6B4C82', fontSize: 9, fontFamily: "'Space Mono',monospace", letterSpacing: 3, marginBottom: 3 }}>PRIME STUDIOS · BOOK 1 · BEFORE LALA</div>
          <div style={{ color: '#1a1a1a', fontSize: 16, fontFamily: "'EB Garamond',serif", fontWeight: 400, letterSpacing: 0.3 }}>Story Evaluation Engine</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {MODELS.map(m => (
              <div key={m.id} style={{ width: 6, height: 6, borderRadius: '50%', background: stories[m.id] ? m.accent : '#ddd', transition: 'background 0.4s' }} />
            ))}
            <span style={{ color: '#aaa', fontSize: 10, fontFamily: 'monospace', marginLeft: 8 }}>
              {MODELS.filter(m => stories[m.id]).length}/3
            </span>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: '1px solid #ddd', color: '#888', fontSize: 11, padding: '5px 14px', borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace' }}>← Back</button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1560, margin: '0 auto', padding: '26px 26px 60px' }}>

        {/* Prompt bar */}
        <div style={{ marginBottom: 26, animation: 'see-up 0.4s ease forwards' }}>
          <div style={{ color: '#aaa', fontSize: 9, fontFamily: "'Space Mono',monospace", letterSpacing: 2, marginBottom: 9 }}>SCENE BRIEF</div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the scene. What is happening. What does she want. What can't she say or have."
            style={{ width: '100%', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, color: '#444', fontSize: 14, fontFamily: "'EB Garamond',serif", lineHeight: 1.8, padding: '14px 16px', resize: 'none', height: 84, boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#6B4C82'}
            onBlur={e => e.target.style.borderColor = '#e0e0e0'}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 11, alignItems: 'center' }}>
            <button onClick={runAll} disabled={!prompt.trim() || anyGen} style={{
              background: prompt.trim() && !anyGen ? '#6B4C82' : '#e0e0e0',
              color: prompt.trim() && !anyGen ? '#fff' : '#aaa',
              border: 'none', borderRadius: 6, padding: '10px 22px',
              fontSize: 10, fontWeight: 700, cursor: prompt.trim() && !anyGen ? 'pointer' : 'not-allowed',
              fontFamily: "'Space Mono',monospace", letterSpacing: 1, transition: 'all 0.2s',
            }}>
              {anyGen ? 'WRITING...' : '▶  GENERATE ALL THREE'}
            </button>

            {allDone && !evLoading && (
              <button onClick={evaluate} style={{ background: 'transparent', color: '#4A8A3D', border: '1px solid #c0d8b8', borderRadius: 6, padding: '10px 22px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Mono',monospace", letterSpacing: 1, animation: 'see-up 0.3s ease forwards' }}>
                ◆  EVALUATE + SYNTHESIZE
              </button>
            )}

            {evLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#999', fontSize: 10, fontFamily: 'monospace' }}>
                <div style={{ width: 14, height: 14, border: '1.5px solid #e0e0e0', borderTop: '1.5px solid #4A8A3D', borderRadius: '50%', animation: 'see-spin 0.8s linear infinite' }} />
                evaluating...
              </div>
            )}
          </div>
        </div>

        {/* Three columns */}
        {started && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 34, animation: 'see-up 0.4s ease forwards' }}>
            {MODELS.map(m => (
              <ModelCol key={m.id} model={m} story={stories[m.id]} gen={gen[m.id]} winner={winner === m.id} onRegen={() => runOne(m.id)} />
            ))}
          </div>
        )}

        {/* Evaluation panel */}
        {ev && (
          <div style={{ animation: 'see-up 0.5s ease forwards' }}>
            <div style={{ display: 'flex', gap: 0, marginBottom: 18, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
              {[
                { id: 'scores',   label: '◆ SCORES' },
                { id: 'prompt',   label: '⟳ PROMPT' },
                { id: 'approved', label: '✦ APPROVED' },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: '9px 20px', border: 'none', cursor: 'pointer',
                  background: tab === t.id ? '#6B4C82' : 'transparent',
                  color: tab === t.id ? '#fff' : '#888',
                  fontSize: 10, fontWeight: 700, fontFamily: "'Space Mono',monospace", letterSpacing: 1,
                }}>{t.label}</button>
              ))}
            </div>

            {tab === 'scores'   && <Scores ev={ev} />}
            {tab === 'prompt'   && <PromptDx dx={ev.prompt_diagnosis} />}
            {tab === 'approved' && <Approved text={ev.approved_version} onApproveVersion={onApproveVersion} />}
          </div>
        )}
      </div>
    </div>
  );
}
