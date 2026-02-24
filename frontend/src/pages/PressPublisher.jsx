import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '';

/* ── colour tokens ────────────────────── */
const PINK   = '#e8b4b8';
const BLUSH  = '#f5e6e0';
const CREAM  = '#faf3ef';
const WINE   = '#722f37';
const MAUVE  = '#b56576';
const WHITE  = '#fff';
const SOFT_SHADOW = '0 2px 12px rgba(114,47,55,.10)';

/* ── shared styles ────────────────────── */
const tabBtn = (active) => ({
  padding: '10px 22px',
  background: active ? WINE : 'transparent',
  color: active ? WHITE : WINE,
  border: `1.5px solid ${WINE}`,
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: "'DM Mono', monospace",
  fontSize: 13,
  fontWeight: active ? 700 : 500,
  letterSpacing: '.4px',
  transition: 'all .2s',
});

const cardStyle = {
  background: WHITE,
  borderRadius: 14,
  border: `1.5px solid ${PINK}`,
  padding: 26,
  boxShadow: SOFT_SHADOW,
  marginBottom: 18,
};

const labelStyle = {
  fontFamily: "'DM Mono', monospace",
  fontSize: 12,
  color: MAUVE,
  textTransform: 'uppercase',
  letterSpacing: '.8px',
  marginBottom: 6,
  fontWeight: 600,
};

const valueStyle = {
  fontFamily: "'Lora', serif",
  fontSize: 16,
  color: '#3a2a2a',
  lineHeight: 1.55,
};

const btnPrimary = {
  padding: '12px 28px',
  background: WINE,
  color: WHITE,
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  fontFamily: "'DM Mono', monospace",
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '.4px',
  transition: 'all .2s',
};

const btnSecondary = {
  ...btnPrimary,
  background: 'transparent',
  color: WINE,
  border: `1.5px solid ${WINE}`,
};

/* ── component ──────────────────────────── */
export default function PressPublisher() {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);
  const [error, setError] = useState(null);

  /* ── fetch characters ── */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/press/characters`);
      if (!r.ok) throw new Error('Failed to load press characters');
      const d = await r.json();
      const list = d.characters || d.data || [];
      setCharacters(list);
      if (list.length && !selected) setSelected(list[0]);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── seed ── */
  const seed = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/press/seed-characters`, { method: 'POST' });
      await load();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  /* ── generate content ── */
  const generate = async (type) => {
    if (!selected) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const url = type === 'post'
        ? `${API}/press/generate-post`
        : `${API}/press/generate-scene`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: selected.character_slug }),
      });
      if (!r.ok) throw new Error('Generation failed');
      const d = await r.json();
      setGenResult(d);
    } catch (e) { setError(e.message); }
    finally { setGenerating(false); }
  };

  /* ── advance career ── */
  const advance = async () => {
    if (!selected) return;
    setGenerating(true);
    try {
      const r = await fetch(`${API}/press/advance-career`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: selected.character_slug }),
      });
      if (!r.ok) throw new Error('Advance failed');
      await load();
    } catch (e) { setError(e.message); }
    finally { setGenerating(false); }
  };

  /* ── stage label helper ── */
  const stageLabel = (stage) => {
    const labels = {
      1: 'Stage 1 — Aspiring',
      2: 'Stage 2 — Rising',
      3: 'Stage 3 — Established',
      4: 'Stage 4 — Legacy',
    };
    return labels[stage] || `Stage ${stage}`;
  };

  /* ── render ── */
  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${CREAM} 0%, ${BLUSH} 50%, ${PINK}33 100%)`,
      padding: '30px 24px',
      fontFamily: "'Lora', serif",
    }}>
      {/* header */}
      <div style={{ maxWidth: 1100, margin: '0 auto 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 style={{
              fontFamily: "'Lora', serif",
              fontSize: 34,
              color: WINE,
              margin: 0,
              fontWeight: 700,
              letterSpacing: '.3px',
            }}>
              The LalaVerse Press
            </h1>
            <p style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 13,
              color: MAUVE,
              margin: '6px 0 0',
              letterSpacing: '.4px',
            }}>
              Publisher Dashboard — Career Tracking & Content Generation
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            style={btnSecondary}
          >
            ← Back
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* error banner */}
        {error && (
          <div style={{
            background: '#fdecea',
            border: '1px solid #e57373',
            borderRadius: 10,
            padding: '14px 20px',
            marginBottom: 18,
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            color: '#c62828',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>×</button>
          </div>
        )}

        {/* loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 15,
              color: MAUVE,
              letterSpacing: '.5px',
            }}>Loading press characters…</div>
          </div>
        )}

        {/* empty state — seed */}
        {!loading && characters.length === 0 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: 50 }}>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: 26, color: WINE, marginBottom: 12 }}>
              No Press Characters Yet
            </h2>
            <p style={{ ...valueStyle, marginBottom: 24, fontSize: 16 }}>
              Seed the four LalaVerse Press journalists to get started.
            </p>
            <button onClick={seed} style={btnPrimary}>
              Seed Press Characters
            </button>
          </div>
        )}

        {/* main layout */}
        {!loading && characters.length > 0 && (
          <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* sidebar — character list */}
            <div style={{ width: 260, flexShrink: 0 }}>
              <div style={{ ...labelStyle, marginBottom: 12, fontSize: 12 }}>PRESS ROSTER</div>
              {characters.map((c) => {
                const isActive = selected?.character_slug === c.character_slug;
                return (
                  <button
                    key={c.character_slug}
                    onClick={() => { setSelected(c); setTab('profile'); setGenResult(null); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      marginBottom: 8,
                      background: isActive ? WHITE : 'transparent',
                      border: `1.5px solid ${isActive ? WINE : PINK}`,
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'all .2s',
                      boxShadow: isActive ? SOFT_SHADOW : 'none',
                    }}
                  >
                    <div style={{
                      fontFamily: "'Lora', serif",
                      fontSize: 17,
                      fontWeight: 700,
                      color: isActive ? WINE : '#5a3a3a',
                      marginBottom: 3,
                    }}>
                      {c.character_slug?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      color: MAUVE,
                      letterSpacing: '.3px',
                    }}>
                      {stageLabel(c.current_stage)} · {c.sessions_completed || 0} sessions
                    </div>
                  </button>
                );
              })}
            </div>

            {/* main panel */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* tab bar */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                {['profile', 'generate', 'lala-scene', 'career'].map(t => (
                  <button key={t} onClick={() => { setTab(t); setGenResult(null); }} style={tabBtn(tab === t)}>
                    {t === 'profile' && '👤 Profile'}
                    {t === 'generate' && '✍️ Generate Post'}
                    {t === 'lala-scene' && '🎬 Lala Scene'}
                    {t === 'career' && '📈 Career'}
                  </button>
                ))}
              </div>

              {/* ── PROFILE TAB ── */}
              {tab === 'profile' && selected && (
                <div style={cardStyle}>
                  <h2 style={{
                    fontFamily: "'Lora', serif",
                    fontSize: 28,
                    color: WINE,
                    margin: '0 0 6px',
                    fontWeight: 700,
                  }}>
                    {selected.character_slug?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h2>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 13,
                    color: MAUVE,
                    marginBottom: 22,
                    letterSpacing: '.4px',
                  }}>
                    {stageLabel(selected.current_stage)}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div>
                      <div style={labelStyle}>Sessions Completed</div>
                      <div style={{ ...valueStyle, fontSize: 26, fontWeight: 700, color: WINE }}>
                        {selected.sessions_completed || 0}
                      </div>
                    </div>
                    <div>
                      <div style={labelStyle}>Content Generated</div>
                      <div style={{ ...valueStyle, fontSize: 26, fontWeight: 700, color: WINE }}>
                        {selected.content_generated || 0}
                      </div>
                    </div>
                  </div>

                  {/* career stages */}
                  {selected.career_stages && (
                    <div style={{ marginTop: 24 }}>
                      <div style={labelStyle}>Career Path</div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                        {selected.career_stages.map((s, i) => (
                          <div key={i} style={{
                            padding: '10px 16px',
                            background: (selected.current_stage || 1) > i ? `${WINE}18` : `${PINK}44`,
                            border: `1px solid ${(selected.current_stage || 1) > i ? WINE : PINK}`,
                            borderRadius: 8,
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 12,
                            color: (selected.current_stage || 1) > i ? WINE : MAUVE,
                            fontWeight: (selected.current_stage || 1) === i + 1 ? 700 : 400,
                          }}>
                            {i + 1}. {s}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* character nature + wound */}
                  {(selected.nature || selected.wound) && (
                    <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      {selected.nature && (
                        <div>
                          <div style={labelStyle}>Nature</div>
                          <div style={valueStyle}>{selected.nature}</div>
                        </div>
                      )}
                      {selected.wound && (
                        <div>
                          <div style={labelStyle}>Wound</div>
                          <div style={valueStyle}>{selected.wound}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* stage history */}
                  {selected.stage_history && selected.stage_history.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <div style={labelStyle}>Stage History</div>
                      <div style={{ marginTop: 8 }}>
                        {selected.stage_history.map((h, i) => (
                          <div key={i} style={{
                            padding: '10px 14px',
                            background: i % 2 === 0 ? `${BLUSH}` : WHITE,
                            borderRadius: 6,
                            marginBottom: 4,
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 12,
                            color: '#5a3a3a',
                          }}>
                            Stage {h.from_stage} → {h.to_stage} · {new Date(h.timestamp).toLocaleDateString()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── GENERATE POST TAB ── */}
              {tab === 'generate' && selected && (
                <div style={cardStyle}>
                  <h3 style={{
                    fontFamily: "'Lora', serif",
                    fontSize: 22,
                    color: WINE,
                    margin: '0 0 10px',
                    fontWeight: 700,
                  }}>
                    Generate Press Post
                  </h3>
                  <p style={{ ...valueStyle, marginBottom: 22, fontSize: 15 }}>
                    Generate an in-character social media post or column excerpt for{' '}
                    <strong>{selected.character_slug?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong>.
                    The AI will write in their unique voice at their current career stage.
                  </p>

                  <button
                    onClick={() => generate('post')}
                    disabled={generating}
                    style={{
                      ...btnPrimary,
                      opacity: generating ? 0.6 : 1,
                      cursor: generating ? 'wait' : 'pointer',
                    }}
                  >
                    {generating ? 'Generating…' : '✍️ Generate Post'}
                  </button>

                  {genResult && genResult.content && (
                    <div style={{
                      marginTop: 24,
                      padding: 22,
                      background: BLUSH,
                      borderRadius: 12,
                      border: `1px solid ${PINK}`,
                    }}>
                      <div style={labelStyle}>Generated Post</div>
                      <div style={{
                        fontFamily: "'Lora', serif",
                        fontSize: 16,
                        color: '#3a2a2a',
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                        marginTop: 10,
                      }}>
                        {genResult.content}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── LALA SCENE TAB ── */}
              {tab === 'lala-scene' && selected && (
                <div style={cardStyle}>
                  <h3 style={{
                    fontFamily: "'Lora', serif",
                    fontSize: 22,
                    color: WINE,
                    margin: '0 0 10px',
                    fontWeight: 700,
                  }}>
                    Generate Lala Scene
                  </h3>
                  <p style={{ ...valueStyle, marginBottom: 22, fontSize: 15 }}>
                    Generate a narrative lala-coverage scene where{' '}
                    <strong>{selected.character_slug?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong>{' '}
                    engages with an episode event. The AI constructs the scene using their lala-coverage triggers.
                  </p>

                  <button
                    onClick={() => generate('scene')}
                    disabled={generating}
                    style={{
                      ...btnPrimary,
                      opacity: generating ? 0.6 : 1,
                      cursor: generating ? 'wait' : 'pointer',
                    }}
                  >
                    {generating ? 'Generating…' : '🎬 Generate Lala Scene'}
                  </button>

                  {genResult && genResult.scene && (
                    <div style={{
                      marginTop: 24,
                      padding: 22,
                      background: BLUSH,
                      borderRadius: 12,
                      border: `1px solid ${PINK}`,
                    }}>
                      <div style={labelStyle}>Generated Scene</div>
                      <div style={{
                        fontFamily: "'Lora', serif",
                        fontSize: 16,
                        color: '#3a2a2a',
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                        marginTop: 10,
                      }}>
                        {genResult.scene}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── CAREER TAB ── */}
              {tab === 'career' && selected && (
                <div style={cardStyle}>
                  <h3 style={{
                    fontFamily: "'Lora', serif",
                    fontSize: 22,
                    color: WINE,
                    margin: '0 0 10px',
                    fontWeight: 700,
                  }}>
                    Career Progression
                  </h3>
                  <p style={{ ...valueStyle, marginBottom: 10, fontSize: 15 }}>
                    Current: <strong>{stageLabel(selected.current_stage)}</strong>
                  </p>
                  <p style={{ ...valueStyle, marginBottom: 22, fontSize: 15 }}>
                    {selected.sessions_completed || 0} sessions completed · {selected.content_generated || 0} pieces generated
                  </p>

                  {/* progress bar */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={labelStyle}>Career Progress</div>
                    <div style={{
                      height: 14,
                      background: `${PINK}55`,
                      borderRadius: 8,
                      overflow: 'hidden',
                      marginTop: 8,
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(((selected.current_stage || 1) / 4) * 100, 100)}%`,
                        background: `linear-gradient(90deg, ${MAUVE}, ${WINE})`,
                        borderRadius: 8,
                        transition: 'width .4s ease',
                      }} />
                    </div>
                    <div style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 12,
                      color: MAUVE,
                      marginTop: 6,
                      letterSpacing: '.3px',
                    }}>
                      Stage {selected.current_stage || 1} of 4
                    </div>
                  </div>

                  <button
                    onClick={advance}
                    disabled={generating || (selected.current_stage || 1) >= 4}
                    style={{
                      ...btnPrimary,
                      opacity: generating || (selected.current_stage || 1) >= 4 ? 0.5 : 1,
                      cursor: generating || (selected.current_stage || 1) >= 4 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {generating ? 'Advancing…' : (selected.current_stage || 1) >= 4 ? 'Max Stage Reached' : '📈 Advance to Next Stage'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
