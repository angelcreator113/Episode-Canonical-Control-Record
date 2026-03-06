/**
 * EpisodeOrchestrationTab.jsx
 * 
 * Replaces or extends the current script tab in the episode editor.
 * Shows two panels side by side:
 *   Left  — 9-beat structured orchestration with UI action grammar
 *   Right — Prose script (JLAW + Lala, readable format)
 * 
 * Beat 6 wardrobe panel shows actual inventory items pulled from browse-pool.
 */

import React, { useState, useCallback } from 'react';

const API = '/api/v1';

const ARCHETYPES = [
  'Invite Episode',
  'Upgrade Episode', 
  'Guest Episode',
  'Failure Episode',
  'Brand Deal Episode',
  'Deliverable Episode',
];

const TONES = ['luxury', 'comedic', 'intense', 'soft-life'];
const MONEY_PRESSURES = ['low', 'medium', 'high'];
const ARC_STAGES = ['early', 'mid', 'finale'];

const BEAT_COLORS = {
  1: '#7B5C92',  // purple — opening
  2: '#3D7A9B',  // teal — welcome
  3: '#D09A3A',  // amber — interruption
  4: '#9B3D3D',  // red — reveal
  5: '#3D6A3D',  // green — stakes
  6: '#9B5523',  // brown — transformation
  7: '#5A7090',  // steel — interruption 2
  8: '#2A5A6A',  // deep teal — payoff
  9: '#5A4070',  // deep purple — cta
};

// ── Sub-components ─────────────────────────────────────────────────────────

function GeneratorForm({ showId, events, onGenerate, loading }) {
  const [form, setForm] = useState({
    archetype: 'Invite Episode',
    arc_stage: 'early',
    reputation_level: 3,
    money_pressure: 'medium',
    tone: 'luxury',
    event_id: '',
    episode_number: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 8, padding: '20px', marginBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        
        <label style={labelStyle}>
          Archetype
          <select style={selectStyle} value={form.archetype} onChange={e => set('archetype', e.target.value)}>
            {ARCHETYPES.map(a => <option key={a}>{a}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          Arc Stage
          <select style={selectStyle} value={form.arc_stage} onChange={e => set('arc_stage', e.target.value)}>
            {ARC_STAGES.map(a => <option key={a}>{a}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          Tone
          <select style={selectStyle} value={form.tone} onChange={e => set('tone', e.target.value)}>
            {TONES.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          Reputation Level (1–10)
          <input
            type="number" min={1} max={10}
            style={inputStyle}
            value={form.reputation_level}
            onChange={e => set('reputation_level', parseInt(e.target.value))}
          />
        </label>

        <label style={labelStyle}>
          Money Pressure
          <select style={selectStyle} value={form.money_pressure} onChange={e => set('money_pressure', e.target.value)}>
            {MONEY_PRESSURES.map(m => <option key={m}>{m}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          Event (optional)
          <select style={selectStyle} value={form.event_id} onChange={e => set('event_id', e.target.value)}>
            <option value="">— no specific event —</option>
            {(events || []).map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Episode Number
          <input
            type="number" min={1}
            style={inputStyle}
            placeholder="e.g. 3"
            value={form.episode_number}
            onChange={e => set('episode_number', e.target.value)}
          />
        </label>
      </div>

      <button
        onClick={() => onGenerate(form)}
        disabled={loading}
        style={{
          marginTop: 20, padding: '12px 28px',
          background: loading ? '#ccc' : '#6B4C82',
          color: '#fff', border: 'none', borderRadius: 6,
          fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          width: '100%',
        }}
      >
        {loading ? '⏳ Generating orchestration…' : '🎬 Generate 9-Beat Orchestration'}
      </button>
    </div>
  );
}

function BeatCard({ beat }) {
  const [open, setOpen] = useState(beat.beat_number <= 4);
  const color = BEAT_COLORS[beat.beat_number] || '#888';

  return (
    <div style={{ borderLeft: `3px solid ${color}`, marginBottom: 12, background: '#fff', borderRadius: '0 6px 6px 0', border: '1px solid #e0e0e0', borderLeftWidth: 3, borderLeftColor: color }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span style={{ color: '#1a1a1a', fontWeight: 700, fontSize: 13 }}>
          <span style={{ color, marginRight: 8 }}>●</span>
          BEAT {beat.beat_number} — {beat.beat_name}
          <span style={{ color: '#999', fontWeight: 400, marginLeft: 8, fontSize: 11 }}>{beat.duration_target}</span>
        </span>
        <span style={{ color: '#999' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid #eee' }}>

          {/* UI Actions */}
          {beat.ui_actions?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>UI ACTIONS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {beat.ui_actions.map((a, i) => (
                  <span key={i} style={tagStyle}>{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Dialogue */}
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {beat.jlaw_narration && (
              <div>
                <div style={{ color: '#888', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>JLAW</div>
                <div style={{ color: '#444', fontSize: 13, fontStyle: 'italic', lineHeight: 1.5 }}>
                  "{beat.jlaw_narration}"
                </div>
              </div>
            )}
            {beat.lala_dialogue && (
              <div>
                <div style={{ color, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>LALA</div>
                <div style={{ color: '#1a1a1a', fontSize: 13, lineHeight: 1.5 }}>
                  "{beat.lala_dialogue}"
                </div>
              </div>
            )}
          </div>

          {/* Motion + Music */}
          <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {beat.lala_motion && (
              <span style={{ color: '#777', fontSize: 11 }}>🎭 {beat.lala_motion}</span>
            )}
            {beat.music && (
              <span style={{ color: '#777', fontSize: 11 }}>🎵 {beat.music}</span>
            )}
            {beat.cursor_state && (
              <span style={{ color: '#777', fontSize: 11 }}>🖱 cursor: {beat.cursor_state}</span>
            )}
          </div>

          {/* Economy Hook */}
          {beat.economy_hook && (
            <div style={{ marginTop: 10, background: '#f0f9f0', border: '1px solid #c0e0c0', borderRadius: 6, padding: '8px 12px' }}>
              <span style={{ color: '#2a7a2a', fontSize: 12 }}>💰 {beat.economy_hook}</span>
            </div>
          )}

          {/* Beat 6 wardrobe pool */}
          {beat.beat_number === 6 && beat.wardrobe_pool && (
            <WardrobePoolPanel pool={beat.wardrobe_pool} color={color} />
          )}

          {/* Director notes */}
          {beat.notes && (
            <div style={{ marginTop: 10, color: '#999', fontSize: 11, fontStyle: 'italic' }}>
              Director: {beat.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WardrobePoolPanel({ pool, color }) {
  const categoryOrder = ['dress', 'top', 'bottom', 'accessories', 'shoes', 'jewelry', 'perfume'];
  const categories = categoryOrder.filter(c => pool[c]?.length > 0);

  const tierColor = { basic: '#888', mid: '#4A7EA0', luxury: '#7B5EA8', elite: '#A8883B' };
  const riskBadge = {
    safe: { bg: '#e8f5e8', color: '#2a7a2a', label: 'OWNED ✓' },
    stretch: { bg: '#e0f0fa', color: '#2a7aaf', label: 'UNLOCK' },
    risky: { bg: '#faf0e0', color: '#af8a2a', label: 'RISKY' },
    locked_tease: { bg: '#fae8e8', color: '#af3a3a', label: 'LOCKED' },
  };

  return (
    <div style={{ marginTop: 14, border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: '#f0f0fa', padding: '8px 14px', borderBottom: '1px solid #ddd' }}>
        <span style={{ color, fontWeight: 700, fontSize: 12 }}>🎽 BEAT 6 WARDROBE POOL — {Object.values(pool).flat().length} items scored</span>
      </div>
      <div style={{ padding: 12 }}>
        {categories.map(cat => (
          <div key={cat} style={{ marginBottom: 12 }}>
            <div style={{ color: '#888', fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
              {cat.toUpperCase()}
            </div>
            {pool[cat].map(item => {
              const risk = riskBadge[item.risk_level] || riskBadge.risky;
              return (
                <div key={item.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  background: '#fafafa', borderRadius: 6, padding: '8px 10px', marginBottom: 6,
                  border: '1px solid #e8e8e8',
                }}>
                  <div>
                    <div style={{ color: '#1a1a1a', fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                    {item.lala_reaction_own && (
                      <div style={{ color: '#777', fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>
                        "{item.lala_reaction_own}"
                      </div>
                    )}
                    {item.aesthetic_tags?.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {item.aesthetic_tags.slice(0, 3).map(t => (
                          <span key={t} style={{ fontSize: 10, color: '#888', background: '#f0f0f0', padding: '2px 6px', borderRadius: 4 }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ color: tierColor[item.tier] || '#888', fontSize: 10, fontWeight: 700 }}>{item.tier?.toUpperCase()}</span>
                    <span style={{ background: risk.bg, color: risk.color, fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                      {risk.label}
                    </span>
                    <span style={{ color: '#999', fontSize: 10 }}>score {item.score}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProseScriptPanel({ prose }) {
  if (!prose) return null;
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{
        background: '#fdfcf8', borderRadius: 8, padding: '28px 32px',
        minHeight: 400, fontFamily: 'Georgia, serif',
        border: '1px solid #e8e4d8',
      }}>
        <div style={{ fontSize: 11, color: '#999', letterSpacing: 2, fontFamily: 'monospace', marginBottom: 20 }}>
          STYLING ADVENTURES WITH LALA — PROSE SCRIPT
        </div>
        <div style={{
          whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 14, color: '#222',
        }}>
          {prose.full_script}
        </div>
        {prose.word_count_estimate && (
          <div style={{ marginTop: 24, fontSize: 11, color: '#999', textAlign: 'right' }}>
            ~{prose.word_count_estimate} words
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function EpisodeOrchestrationTab({ showId, episodeId, events = [] }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('split'); // split | orchestration | prose

  const generate = useCallback(async (form) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/memories/generate-episode-orchestration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          show_id: showId,
          episode_id: episodeId || null,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [showId, episodeId]);

  const copyScript = () => {
    const text = result?.prose_script?.full_script || '';
    navigator.clipboard.writeText(text);
  };

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: 24, color: '#1a1a1a' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ color: '#1a1a1a', fontSize: 20, fontWeight: 700, margin: 0 }}>🎬 Episode Orchestration</h2>
            <p style={{ color: '#888', fontSize: 13, margin: '4px 0 0' }}>
              9-beat director plan + prose script — wardrobe wired to inventory
            </p>
          </div>
          {result && (
            <div style={{ display: 'flex', gap: 8 }}>
              {['split', 'orchestration', 'prose'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: '6px 14px', border: 'none', borderRadius: 6,
                    background: view === v ? '#6B4C82' : '#e0e0e0',
                    color: view === v ? '#fff' : '#444', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  {v === 'split' ? '⬜ Split' : v === 'orchestration' ? '🎬 Beats' : '📄 Script'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Generator form */}
        <GeneratorForm showId={showId} events={events} onGenerate={generate} loading={loading} />

        {error && (
          <div style={{ background: '#fef0f0', border: '1px solid #e8a0a0', borderRadius: 8, padding: 16, marginBottom: 24, color: '#b33' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Episode title options */}
            {result.episode_title_options?.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>EPISODE TITLE OPTIONS</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {result.episode_title_options.map((t, i) => (
                    <span key={i} style={{
                      background: '#f0ecf6', border: '1px solid #c0b0d8',
                      color: '#5a3a7a', padding: '6px 14px', borderRadius: 20, fontSize: 13,
                    }}>{t}</span>
                  ))}
                </div>
                {result.episode_description && (
                  <p style={{ color: '#666', fontSize: 13, margin: '12px 0 0', lineHeight: 1.6 }}>
                    {result.episode_description}
                  </p>
                )}
              </div>
            )}

            {/* Economy hooks summary */}
            {result.orchestration?.economy_hooks_summary?.length > 0 && (
              <div style={{ background: '#f0f9f0', border: '1px solid #c0e0c0', borderRadius: 8, padding: '10px 16px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: '#2a7a2a', fontSize: 11, fontWeight: 700 }}>💰 ECONOMY HOOKS</span>
                {result.orchestration.economy_hooks_summary.map((h, i) => (
                  <span key={i} style={{ color: '#555', fontSize: 12 }}>· {h}</span>
                ))}
              </div>
            )}

            {/* Dual panel output */}
            <div style={{
              display: view === 'split' ? 'grid' : 'block',
              gridTemplateColumns: '1fr 1fr',
              gap: 24,
            }}>

              {/* Orchestration panel */}
              {(view === 'split' || view === 'orchestration') && (
                <div style={view !== 'orchestration' ? {} : { maxWidth: 800 }}>
                  <div style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>
                    ORCHESTRATION — {result.orchestration?.total_duration_estimate || ''}
                  </div>
                  {result.orchestration?.beats?.map(beat => (
                    <BeatCard key={beat.beat_number} beat={beat} />
                  ))}
                </div>
              )}

              {/* Prose script panel */}
              {(view === 'split' || view === 'prose') && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>PROSE SCRIPT</div>
                    <button
                      onClick={copyScript}
                      style={{ fontSize: 11, color: '#888', background: 'none', border: '1px solid #ddd', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}
                    >
                      Copy
                    </button>
                  </div>
                  <ProseScriptPanel prose={result.prose_script} />
                </div>
              )}
            </div>

            {/* Meta */}
            <div style={{ marginTop: 24, color: '#aaa', fontSize: 11, textAlign: 'right' }}>
              {result.meta?.wardrobe_items_in_pool > 0 && (
                <span>{result.meta.wardrobe_items_in_pool} wardrobe items scored · </span>
              )}
              {result.meta?.event?.name && (
                <span>Event: {result.meta.event.name} · </span>
              )}
              {result.meta?.archetype}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────

const labelStyle = {
  display: 'flex', flexDirection: 'column', gap: 6,
  color: '#555', fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
};

const selectStyle = {
  background: '#fff', border: '1px solid #d0d0d0', borderRadius: 6,
  color: '#1a1a1a', padding: '8px 12px', fontSize: 13,
};

const inputStyle = {
  background: '#fff', border: '1px solid #d0d0d0', borderRadius: 6,
  color: '#1a1a1a', padding: '8px 12px', fontSize: 13,
};

const tagStyle = {
  background: '#f0f0fa', border: '1px solid #d0d0e0',
  color: '#5a5a8a', fontSize: 11, padding: '3px 8px',
  borderRadius: 4, fontFamily: 'monospace',
};
