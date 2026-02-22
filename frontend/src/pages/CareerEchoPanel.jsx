/**
 * CareerEchoPanel.jsx
 * frontend/src/pages/CareerEchoPanel.jsx
 *
 * The Connection Map.
 *
 * Shows how JustAWoman's confirmed pain points (Series 1) connect to
 * Lala's career moments (Series 2). The author sees the full architecture.
 * The characters never do.
 *
 * Two views:
 * 1. CONNECTION MAP — pain point → content → Lala encounter (the full arc)
 * 2. CONTENT LIBRARY — all content JustAWoman has created from her pain
 *
 * Usage:
 *   import CareerEchoPanel from './CareerEchoPanel';
 *
 *   <CareerEchoPanel bookId={book.id} />
 */

import { useState, useEffect } from 'react';

const MEMORIES_API = '/api/v1/memories';

const CONTENT_TYPE_CONFIG = {
  post:           { label: 'Post',            icon: '✦', color: '#4A6B8B' },
  framework:      { label: 'Framework',       icon: '◈', color: '#7B5EA7' },
  coaching_offer: { label: 'Coaching Offer',  icon: '◆', color: '#4A7C59' },
  video:          { label: 'Video',           icon: '▶', color: '#B85C38' },
  podcast:        { label: 'Podcast',         icon: '◉', color: '#8B6914' },
  book_chapter:   { label: 'Book Chapter',    icon: '📖', color: '#C9A84C' },
  course:         { label: 'Course',          icon: '◑', color: '#6B4A8B' },
};

const CATEGORY_COLOR = {
  comparison_spiral:    '#7B5EA7',
  visibility_gap:       '#4A6B8B',
  identity_drift:       '#8B6914',
  financial_risk:       '#B85C38',
  consistency_collapse: '#4A7C59',
  clarity_deficit:      '#6B4A8B',
  external_validation:  '#8B4A6B',
  restart_cycle:        '#4A6B4A',
};

export default function CareerEchoPanel({ bookId }) {
  const [memories, setMemories]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [view, setView]               = useState('connection_map');
  const [generating, setGenerating]   = useState(null); // memory_id being generated
  const [previews, setPreviews]       = useState({});   // memory_id → generated echo
  const [confirming, setConfirming]   = useState(null);
  const [error, setError]             = useState(null);

  useEffect(() => {
    fetchPainPoints();
  }, [bookId]);

  async function fetchPainPoints() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        book_id:   bookId,
        type:      'pain_point',
        confirmed: 'true',
      });
      const res = await fetch(`${MEMORIES_API}?${params}`);
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (err) {
      console.error('CareerEchoPanel fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function generateEcho(memory) {
    setGenerating(memory.id);
    setError(null);
    try {
      const res = await fetch(`${MEMORIES_API}/generate-career-echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memory_id: memory.id, book_id: bookId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviews(prev => ({ ...prev, [memory.id]: data.echo }));
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(null);
    }
  }

  async function confirmEcho(memory, echo) {
    setConfirming(memory.id);
    try {
      const res = await fetch(`${MEMORIES_API}/add-career-echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memory_id:    memory.id,
          content_type: echo.content_type,
          title:        echo.title,
          description:  echo.description,
          lala_impact:  echo.lala_impact,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Update local state
      setMemories(prev => prev.map(m =>
        m.id === memory.id ? { ...m, ...data.memory } : m
      ));
      setPreviews(prev => { const p = { ...prev }; delete p[memory.id]; return p; });
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(null);
    }
  }

  const withEchoes    = memories.filter(m => m.career_echo_confirmed);
  const withoutEchoes = memories.filter(m => !m.career_echo_confirmed);

  if (loading) {
    return (
      <div style={s.loading}>
        <div style={s.loadingText}>Loading connection map…</div>
      </div>
    );
  }

  return (
    <div style={s.shell}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTitle}>Career Echo — Connection Map</div>
        <div style={s.headerSub}>
          JustAWoman's pain becomes content. Content builds Lala's career.
          Lala never knows. The reader always does.
        </div>
        <div style={s.stats}>
          <StatPill label='Pain points' value={memories.length} color='#C9A84C' />
          <StatPill label='Echoes confirmed' value={withEchoes.length} color='#4A7C59' />
          <StatPill label='Awaiting echo' value={withoutEchoes.length} color='#B85C38' />
        </div>
      </div>

      {/* View toggle */}
      <div style={s.viewToggle}>
        {[
          { id: 'connection_map',  label: 'Connection Map' },
          { id: 'content_library', label: 'Content Library' },
        ].map(v => (
          <button
            key={v.id}
            style={{
              ...s.toggleBtn,
              borderColor: view === v.id ? 'rgba(201,168,76,0.5)' : 'rgba(30,25,20,0.1)',
              color: view === v.id ? '#8B6914' : 'rgba(30,25,20,0.35)',
              background: view === v.id ? 'rgba(201,168,76,0.06)' : 'transparent',
            }}
            onClick={() => setView(v.id)}
            type='button'
          >
            {v.label}
          </button>
        ))}
      </div>

      {error && <div style={s.error}>{error}</div>}

      {memories.length === 0 && (
        <div style={s.empty}>
          No confirmed pain points yet. Approve lines, extract memories, and confirm pain points — the connection map builds from there.
        </div>
      )}

      {/* CONNECTION MAP VIEW */}
      {view === 'connection_map' && (
        <div style={s.mapView}>

          {/* Confirmed echoes */}
          {withEchoes.map(memory => (
            <EchoCard
              key={memory.id}
              memory={memory}
              confirmed={true}
            />
          ))}

          {/* Pain points awaiting echo generation */}
          {withoutEchoes.length > 0 && (
            <>
              {withoutEchoes.length > 0 && withEchoes.length > 0 && (
                <div style={s.sectionDivider}>
                  AWAITING ECHO GENERATION
                </div>
              )}
              {withoutEchoes.map(memory => {
                const preview = previews[memory.id];
                const isGenerating = generating === memory.id;
                const isConfirming = confirming === memory.id;

                return (
                  <div key={memory.id} style={s.pendingCard}>
                    {/* Pain point */}
                    <div style={s.pendingTop}>
                      <div style={{
                        ...s.categoryDot,
                        background: CATEGORY_COLOR[memory.category] || '#C9A84C',
                      }} />
                      <div style={s.pendingContent}>
                        <div style={s.pendingStatement}>"{memory.statement}"</div>
                        <div style={{
                          ...s.pendingCategory,
                          color: CATEGORY_COLOR[memory.category] || '#C9A84C',
                        }}>
                          {memory.category?.replace(/_/g, ' ')}
                        </div>
                      </div>
                      {!preview && (
                        <button
                          style={{
                            ...s.generateBtn,
                            opacity: isGenerating ? 0.6 : 1,
                          }}
                          onClick={() => generateEcho(memory)}
                          disabled={isGenerating}
                          type='button'
                        >
                          {isGenerating ? 'Generating…' : '✦ Generate Echo'}
                        </button>
                      )}
                    </div>

                    {/* Preview */}
                    {preview && (
                      <div style={s.previewBlock}>
                        <EchoPreview echo={preview} />
                        <div style={s.previewActions}>
                          <button
                            style={s.rejectBtn}
                            onClick={() => setPreviews(prev => {
                              const p = { ...prev }; delete p[memory.id]; return p;
                            })}
                            type='button'
                          >
                            Regenerate
                          </button>
                          <button
                            style={{
                              ...s.confirmBtn,
                              opacity: isConfirming ? 0.6 : 1,
                            }}
                            onClick={() => confirmEcho(memory, preview)}
                            disabled={isConfirming}
                            type='button'
                          >
                            {isConfirming ? 'Confirming…' : 'Confirm — This is canon'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* CONTENT LIBRARY VIEW */}
      {view === 'content_library' && (
        <div style={s.libraryView}>
          <div style={s.libraryIntro}>
            Everything JustAWoman has created from her pain.
            This is her body of work. She built it without knowing.
          </div>
          {withEchoes.length === 0 && (
            <div style={s.empty}>No confirmed echoes yet.</div>
          )}
          {Object.entries(
            withEchoes.reduce((acc, m) => {
              const type = m.career_echo_content_type || 'post';
              if (!acc[type]) acc[type] = [];
              acc[type].push(m);
              return acc;
            }, {})
          ).map(([type, items]) => {
            const config = CONTENT_TYPE_CONFIG[type] || CONTENT_TYPE_CONFIG.post;
            return (
              <div key={type} style={s.librarySection}>
                <div style={s.librarySectionHeader}>
                  <span style={{ ...s.libraryIcon, color: config.color }}>{config.icon}</span>
                  <span style={{ ...s.librarySectionLabel, color: config.color }}>{config.label}s</span>
                  <span style={s.libraryCount}>{items.length}</span>
                </div>
                {items.map(m => (
                  <div key={m.id} style={s.libraryItem}>
                    <div style={s.libraryItemTitle}>{m.career_echo_title}</div>
                    <div style={s.libraryItemDesc}>{m.career_echo_description}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function EchoCard({ memory }) {
  const [expanded, setExpanded] = useState(false);
  const config = CONTENT_TYPE_CONFIG[memory.career_echo_content_type] || CONTENT_TYPE_CONFIG.post;
  const catColor = CATEGORY_COLOR[memory.category] || '#C9A84C';

  return (
    <div style={s.echoCard}>
      {/* Series 1 → Series 2 header */}
      <div style={s.echoFlow}>
        <div style={s.echoSeries}>SERIES 1 — JUSTAWOMAN</div>
        <div style={s.echoArrow}>→</div>
        <div style={s.echoSeries}>SERIES 2 — LALA</div>
      </div>

      {/* Pain point */}
      <div style={s.echoPainPoint}>
        <div style={{ ...s.echoCategoryDot, background: catColor }} />
        <div style={s.echoPainStatement}>"{memory.statement}"</div>
      </div>

      {/* Arrow */}
      <div style={s.echoConnector}>↓</div>

      {/* Content created */}
      <div style={s.echoContent}>
        <div style={s.echoContentHeader}>
          <span style={{ color: config.color }}>{config.icon}</span>
          <span style={{ ...s.echoContentType, color: config.color }}>{config.label}</span>
          <span style={s.echoContentTitle}>{memory.career_echo_title}</span>
        </div>
        <div style={s.echoContentDesc}>{memory.career_echo_description}</div>
      </div>

      {/* Arrow */}
      <div style={s.echoConnector}>↓</div>

      {/* Lala's encounter */}
      <div
        style={s.echoLala}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={s.echoLalaHeader}>
          <span style={s.echoLalaLabel}>LALA'S ENCOUNTER</span>
          <span style={s.echoLalaExpand}>{expanded ? '▲' : '▼'}</span>
        </div>
        {expanded && (
          <div style={s.echoLalaText}>{memory.career_echo_lala_impact}</div>
        )}
        {!expanded && (
          <div style={s.echoLalaHint}>
            The reader knows. Lala doesn't. Click to see the irony.
          </div>
        )}
      </div>
    </div>
  );
}

function EchoPreview({ echo }) {
  const config = CONTENT_TYPE_CONFIG[echo.content_type] || CONTENT_TYPE_CONFIG.post;
  return (
    <div style={s.preview}>
      <div style={s.previewLabel}>GENERATED ECHO — REVIEW BEFORE CONFIRMING</div>
      <div style={s.previewContentType}>
        <span style={{ color: config.color }}>{config.icon}</span>
        <span style={{ ...s.previewType, color: config.color }}>{config.label}</span>
        <span style={s.previewTitle}>{echo.title}</span>
      </div>
      <div style={s.previewDesc}>{echo.description}</div>
      <div style={s.previewDivider} />
      <div style={s.previewLalaLabel}>LALA'S ENCOUNTER IN SERIES 2</div>
      <div style={s.previewLalaText}>{echo.lala_impact}</div>
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={s.statPill}>
      <span style={{ ...s.statValue, color }}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  shell: { display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 0' },
  loading: { padding: 24, display: 'flex', justifyContent: 'center' },
  loadingText: { fontFamily: 'DM Mono, monospace', fontSize: 9, color: 'rgba(30,25,20,0.3)', letterSpacing: '0.1em' },
  header: { display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 14, borderBottom: '1px solid rgba(201,168,76,0.1)' },
  headerTitle: { fontFamily: "'Playfair Display', serif", fontSize: 18, fontStyle: 'italic', color: 'rgba(30,25,20,0.88)' },
  headerSub: { fontFamily: 'DM Mono, monospace', fontSize: 8, color: 'rgba(30,25,20,0.4)', letterSpacing: '0.05em', lineHeight: 1.6 },
  stats: { display: 'flex', gap: 12, marginTop: 4 },
  statPill: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'rgba(30,25,20,0.03)', border: '1px solid rgba(30,25,20,0.08)', borderRadius: 3, padding: '6px 12px' },
  statValue: { fontFamily: "'Playfair Display', serif", fontSize: 20, lineHeight: 1 },
  statLabel: { fontFamily: 'DM Mono, monospace', fontSize: 7, color: 'rgba(30,25,20,0.3)', letterSpacing: '0.1em' },
  viewToggle: { display: 'flex', gap: 6 },
  toggleBtn: { background: 'transparent', border: '1px solid', borderRadius: 2, fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.1em', padding: '5px 12px', cursor: 'pointer', transition: 'all 0.12s' },
  error: { fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#B85C38', background: 'rgba(184,92,56,0.06)', border: '1px solid rgba(184,92,56,0.15)', borderRadius: 2, padding: '8px 12px' },
  empty: { fontFamily: 'DM Mono, monospace', fontSize: 9, color: 'rgba(30,25,20,0.3)', letterSpacing: '0.05em', lineHeight: 1.6, fontStyle: 'italic', padding: '16px 0', textAlign: 'center' },
  // Map view
  mapView: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionDivider: { fontFamily: 'DM Mono, monospace', fontSize: 7, letterSpacing: '0.2em', color: 'rgba(30,25,20,0.2)', textAlign: 'center', padding: '8px 0' },
  // Echo card
  echoCard: { border: '1px solid rgba(201,168,76,0.2)', borderRadius: 3, background: '#faf9f7', overflow: 'hidden' },
  echoFlow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(201,168,76,0.05)', borderBottom: '1px solid rgba(201,168,76,0.1)' },
  echoSeries: { fontFamily: 'DM Mono, monospace', fontSize: 7, letterSpacing: '0.14em', color: '#C9A84C', flex: 1 },
  echoArrow: { fontFamily: 'DM Mono, monospace', fontSize: 10, color: 'rgba(201,168,76,0.4)' },
  echoPainPoint: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px' },
  echoCategoryDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4 },
  echoPainStatement: { fontFamily: "'Playfair Display', serif", fontSize: 13, fontStyle: 'italic', color: 'rgba(30,25,20,0.75)', lineHeight: 1.5 },
  echoConnector: { fontFamily: 'DM Mono, monospace', fontSize: 14, color: 'rgba(201,168,76,0.3)', textAlign: 'center', padding: '2px 0' },
  echoContent: { padding: '10px 14px', background: 'rgba(255,255,255,0.6)', borderTop: '1px solid rgba(30,25,20,0.05)', borderBottom: '1px solid rgba(30,25,20,0.05)' },
  echoContentHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  echoContentType: { fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.1em', fontWeight: 600 },
  echoContentTitle: { fontFamily: "'Playfair Display', serif", fontSize: 14, fontStyle: 'italic', color: 'rgba(30,25,20,0.85)' },
  echoContentDesc: { fontFamily: 'DM Mono, monospace', fontSize: 8, color: 'rgba(30,25,20,0.5)', letterSpacing: '0.04em', lineHeight: 1.6 },
  echoLala: { padding: '10px 14px', cursor: 'pointer', background: 'rgba(201,168,76,0.03)' },
  echoLalaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  echoLalaLabel: { fontFamily: 'DM Mono, monospace', fontSize: 7, letterSpacing: '0.16em', color: '#C9A84C' },
  echoLalaExpand: { fontFamily: 'DM Mono, monospace', fontSize: 7, color: 'rgba(30,25,20,0.2)' },
  echoLalaText: { fontFamily: "'Playfair Display', serif", fontSize: 13, fontStyle: 'italic', color: 'rgba(30,25,20,0.7)', lineHeight: 1.65, marginTop: 8 },
  echoLalaHint: { fontFamily: 'DM Mono, monospace', fontSize: 8, color: 'rgba(30,25,20,0.25)', letterSpacing: '0.05em', marginTop: 4, fontStyle: 'italic' },
  // Pending card
  pendingCard: { border: '1px solid rgba(30,25,20,0.08)', borderRadius: 3, background: '#faf9f7', overflow: 'hidden' },
  pendingTop: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px' },
  categoryDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4 },
  pendingContent: { flex: 1 },
  pendingStatement: { fontFamily: "'Playfair Display', serif", fontSize: 13, fontStyle: 'italic', color: 'rgba(30,25,20,0.7)', lineHeight: 1.5, marginBottom: 4 },
  pendingCategory: { fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.08em' },
  generateBtn: { background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 2, fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.1em', color: '#8B6914', padding: '5px 12px', cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.12s', whiteSpace: 'nowrap' },
  // Preview
  previewBlock: { borderTop: '1px solid rgba(201,168,76,0.1)', padding: '14px' },
  preview: { background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 2, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
  previewLabel: { fontFamily: 'DM Mono, monospace', fontSize: 7, letterSpacing: '0.18em', color: '#C9A84C' },
  previewContentType: { display: 'flex', alignItems: 'center', gap: 6 },
  previewType: { fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.1em', fontWeight: 600 },
  previewTitle: { fontFamily: "'Playfair Display', serif", fontSize: 14, fontStyle: 'italic', color: 'rgba(30,25,20,0.85)' },
  previewDesc: { fontFamily: 'DM Mono, monospace', fontSize: 9, color: 'rgba(30,25,20,0.55)', letterSpacing: '0.04em', lineHeight: 1.6 },
  previewDivider: { height: 1, background: 'rgba(201,168,76,0.1)' },
  previewLalaLabel: { fontFamily: 'DM Mono, monospace', fontSize: 7, letterSpacing: '0.16em', color: 'rgba(30,25,20,0.3)' },
  previewLalaText: { fontFamily: "'Playfair Display', serif", fontSize: 13, fontStyle: 'italic', color: 'rgba(30,25,20,0.7)', lineHeight: 1.65 },
  previewActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 },
  rejectBtn: { background: 'none', border: '1px solid rgba(30,25,20,0.12)', borderRadius: 2, fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.08em', color: 'rgba(30,25,20,0.4)', padding: '5px 12px', cursor: 'pointer' },
  confirmBtn: { background: '#4A7C59', border: 'none', borderRadius: 2, fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '0.1em', color: 'white', fontWeight: 600, padding: '5px 14px', cursor: 'pointer', transition: 'opacity 0.12s' },
  // Library view
  libraryView: { display: 'flex', flexDirection: 'column', gap: 16 },
  libraryIntro: { fontFamily: 'DM Mono, monospace', fontSize: 9, color: 'rgba(30,25,20,0.4)', letterSpacing: '0.05em', lineHeight: 1.7, fontStyle: 'italic', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 2, padding: '10px 14px' },
  librarySection: { display: 'flex', flexDirection: 'column', gap: 8 },
  librarySectionHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  libraryIcon: { fontSize: 12 },
  librarySectionLabel: { fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '0.12em', fontWeight: 600 },
  libraryCount: { fontFamily: 'DM Mono, monospace', fontSize: 8, color: 'rgba(30,25,20,0.3)', letterSpacing: '0.06em', marginLeft: 'auto' },
  libraryItem: { background: '#f5f0e8', border: '1px solid rgba(30,25,20,0.06)', borderRadius: 2, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 },
  libraryItemTitle: { fontFamily: "'Playfair Display', serif", fontSize: 14, fontStyle: 'italic', color: 'rgba(30,25,20,0.85)' },
  libraryItemDesc: { fontFamily: 'DM Mono, monospace', fontSize: 8, color: 'rgba(30,25,20,0.5)', letterSpacing: '0.04em', lineHeight: 1.6 },
};
