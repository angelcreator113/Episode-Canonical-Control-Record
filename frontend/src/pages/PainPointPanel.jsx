/**
 * PainPointPanel.jsx
 * frontend/src/pages/PainPointPanel.jsx
 *
 * Memory Bank tab — Pain Points view.
 * Shows confirmed pain point memories organized by category.
 * Visually shows the coaching curriculum building itself invisibly.
 *
 * Usage inside MemoryBankTab or as a sub-tab:
 *
 *   import PainPointPanel from './PainPointPanel';
 *
 *   <PainPointPanel
 *     bookId={book.id}
 *     chapterId={chapter.id}  // optional — filter by chapter
 *   />
 */

import { useState, useEffect } from 'react';

const MEMORIES_API = '/api/v1/memories';

const PAIN_CATEGORIES = [
  {
    id: 'comparison_spiral',
    label: 'Comparison Spiral',
    icon: '↻',
    color: '#7B5EA7',
    description: 'Measuring against others compulsively',
    coaching: 'Comparison is data, not destiny.',
  },
  {
    id: 'visibility_gap',
    label: 'Visibility Gap',
    icon: '◎',
    color: '#4A6B8B',
    description: 'Doing everything right and not being seen',
    coaching: 'Consistency without strategy is invisible effort.',
  },
  {
    id: 'identity_drift',
    label: 'Identity Drift',
    icon: '~',
    color: '#8B6914',
    description: 'Aesthetic shifting depending on who\'s watching',
    coaching: 'Your audience can\'t find you if you keep moving.',
  },
  {
    id: 'financial_risk',
    label: 'Financial Risk',
    icon: '$',
    color: '#B85C38',
    description: 'Spending before earning',
    coaching: 'Investment without a strategy is just spending.',
  },
  {
    id: 'consistency_collapse',
    label: 'Consistency Collapse',
    icon: '⏸',
    color: '#4A7C59',
    description: 'Showing up until burnout hits',
    coaching: 'Consistency isn\'t the problem. Sustainability is.',
  },
  {
    id: 'clarity_deficit',
    label: 'Clarity Deficit',
    icon: '?',
    color: '#6B4A8B',
    description: 'Knowing what you want, not knowing how',
    coaching: 'Clarity isn\'t found. It\'s built through action.',
  },
  {
    id: 'external_validation',
    label: 'External Validation',
    icon: '✓?',
    color: '#8B4A6B',
    description: 'Needing confirmation before believing',
    coaching: 'Permission is a tax you don\'t owe anyone.',
  },
  {
    id: 'restart_cycle',
    label: 'Restart Cycle',
    icon: '↺',
    color: '#4A6B4A',
    description: 'Deleting and starting over instead of building through',
    coaching: 'Momentum doesn\'t restart. It compounds.',
  },
];

export default function PainPointPanel({ bookId, chapterId }) {
  const [memories, setMemories]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState({});
  const [view, setView]             = useState('by_category'); // by_category | timeline | coaching

  useEffect(() => {
    fetchPainPoints();
  }, [bookId, chapterId]);

  async function fetchPainPoints() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ book_id: bookId, type: 'pain_point' });
      if (chapterId) params.append('chapter_id', chapterId);
      const res = await fetch(`${MEMORIES_API}?${params}`);
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (err) {
      console.error('PainPointPanel fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  // Group by category
  const byCategory = PAIN_CATEGORIES.map(cat => ({
    ...cat,
    memories: memories.filter(m => m.category === cat.id),
  }));

  const total = memories.length;
  const categoriesHit = byCategory.filter(c => c.memories.length > 0).length;

  if (loading) {
    return (
      <div style={s.loading}>
        <div style={s.loadingText}>Reading pain points…</div>
      </div>
    );
  }

  return (
    <div style={s.shell}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerTitle}>Pain Point Registry</div>
          <div style={s.headerSub}>
            JustAWoman documents her experience. The coaching curriculum builds itself.
          </div>
        </div>
        <div style={s.stats}>
          <div style={s.stat}>
            <div style={s.statNum}>{total}</div>
            <div style={s.statLabel}>documented</div>
          </div>
          <div style={s.stat}>
            <div style={s.statNum}>{categoriesHit}</div>
            <div style={s.statLabel}>categories</div>
          </div>
          <div style={s.stat}>
            <div style={s.statNum}>{8 - categoriesHit}</div>
            <div style={s.statLabel}>undiscovered</div>
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div style={s.viewToggle}>
        {[
          { id: 'by_category', label: 'By Category' },
          { id: 'coaching',    label: 'Coaching View' },
          { id: 'timeline',    label: 'Timeline' },
        ].map(v => (
          <button
            key={v.id}
            style={{
              ...s.toggleBtn,
              borderColor: view === v.id
                ? 'rgba(201,168,76,0.5)'
                : 'rgba(30,25,20,0.1)',
              color: view === v.id
                ? '#8B6914'
                : 'rgba(30,25,20,0.35)',
              background: view === v.id
                ? 'rgba(201,168,76,0.06)'
                : 'transparent',
            }}
            onClick={() => setView(v.id)}
            type='button'
          >
            {v.label}
          </button>
        ))}
      </div>

      {total === 0 && (
        <div style={s.empty}>
          No pain points documented yet. Approve lines from Chapter 1 and extract memories — the system will find them.
        </div>
      )}

      {/* BY CATEGORY VIEW */}
      {view === 'by_category' && (
        <div style={s.categoryGrid}>
          {byCategory.map(cat => (
            <CategoryCard
              key={cat.id}
              category={cat}
              expanded={!!expanded[cat.id]}
              onToggle={() => setExpanded(prev => ({
                ...prev,
                [cat.id]: !prev[cat.id],
              }))}
            />
          ))}
        </div>
      )}

      {/* COACHING VIEW */}
      {view === 'coaching' && (
        <div style={s.coachingView}>
          <div style={s.coachingIntro}>
            These are the pain points JustAWoman has documented without knowing it.
            Each one is a future coaching session. She doesn't know that yet.
          </div>
          {byCategory
            .filter(c => c.memories.length > 0)
            .map(cat => (
              <div key={cat.id} style={s.coachingSection}>
                <div style={s.coachingSectionHeader}>
                  <span style={{ ...s.coachingIcon, color: cat.color }}>{cat.icon}</span>
                  <span style={{ ...s.coachingSectionLabel, color: cat.color }}>{cat.label}</span>
                  <span style={s.coachingCount}>{cat.memories.length} instance{cat.memories.length > 1 ? 's' : ''}</span>
                </div>
                <div style={s.coachingAngle}>{cat.coaching}</div>
                {cat.memories.map(m => (
                  <div key={m.id} style={s.coachingMemory}>
                    <div style={s.coachingStatement}>"{m.statement}"</div>
                    {m.coaching_angle && (
                      <div style={s.coachingAngleSpecific}>{m.coaching_angle}</div>
                    )}
                    <div style={s.coachingSource}>{m.source_ref}</div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}

      {/* TIMELINE VIEW */}
      {view === 'timeline' && (
        <div style={s.timeline}>
          {memories
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            .map((m, i) => {
              const cat = PAIN_CATEGORIES.find(c => c.id === m.category);
              return (
                <div key={m.id} style={s.timelineItem}>
                  <div style={{
                    ...s.timelineDot,
                    background: cat?.color || '#C9A84C',
                  }} />
                  <div style={s.timelineContent}>
                    <div style={s.timelineSource}>{m.source_ref}</div>
                    <div style={s.timelineStatement}>{m.statement}</div>
                    {cat && (
                      <div style={{ ...s.timelineCategory, color: cat.color }}>
                        {cat.label}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

    </div>
  );
}

// ── CategoryCard ──────────────────────────────────────────────────────────

function CategoryCard({ category, expanded, onToggle }) {
  const hasMemories = category.memories.length > 0;

  return (
    <div style={{
      ...s.catCard,
      borderColor: hasMemories
        ? `${category.color}30`
        : 'rgba(30,25,20,0.08)',
      opacity: hasMemories ? 1 : 0.5,
    }}>
      <div style={s.catHeader} onClick={hasMemories ? onToggle : undefined}>
        <div style={s.catLeft}>
          <span style={{ ...s.catIcon, color: category.color }}>
            {category.icon}
          </span>
          <div>
            <div style={{ ...s.catLabel, color: hasMemories ? category.color : 'rgba(30,25,20,0.4)' }}>
              {category.label}
            </div>
            <div style={s.catDesc}>{category.description}</div>
          </div>
        </div>
        <div style={s.catRight}>
          {hasMemories ? (
            <>
              <div style={{
                ...s.catCount,
                background: `${category.color}15`,
                color: category.color,
              }}>
                {category.memories.length}
              </div>
              <span style={s.catExpand}>{expanded ? '▲' : '▼'}</span>
            </>
          ) : (
            <span style={s.catEmpty}>UNDISCOVERED</span>
          )}
        </div>
      </div>

      {expanded && hasMemories && (
        <div style={s.catMemories}>
          {category.memories.map(m => (
            <div key={m.id} style={s.catMemory}>
              <div style={s.catMemoryStatement}>{m.statement}</div>
              {m.coaching_angle && (
                <div style={s.catMemoryCoaching}>{m.coaching_angle}</div>
              )}
              <div style={s.catMemorySource}>{m.source_ref}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '16px 0',
  },
  loading: {
    padding: 24,
    display: 'flex',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.1em',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottom: '1px solid rgba(201,168,76,0.1)',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  headerTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 16,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.85)',
  },
  headerSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(30,25,20,0.35)',
    letterSpacing: '0.06em',
    lineHeight: 1.5,
    maxWidth: 300,
  },
  stats: {
    display: 'flex',
    gap: 16,
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  statNum: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 22,
    color: '#C9A84C',
    lineHeight: 1,
  },
  statLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 7,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.1em',
  },
  viewToggle: {
    display: 'flex',
    gap: 6,
  },
  toggleBtn: {
    background: 'transparent',
    border: '1px solid',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.1em',
    padding: '5px 12px',
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  empty: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.05em',
    lineHeight: 1.6,
    fontStyle: 'italic',
    padding: '16px 0',
    textAlign: 'center',
  },
  // Category grid
  categoryGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  catCard: {
    border: '1px solid',
    borderRadius: 3,
    overflow: 'hidden',
    background: '#faf9f7',
  },
  catHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  catLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  catIcon: {
    fontSize: 14,
    fontWeight: 700,
    width: 20,
    textAlign: 'center',
    flexShrink: 0,
  },
  catLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.1em',
    fontWeight: 600,
    marginBottom: 2,
  },
  catDesc: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.04em',
  },
  catRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  catCount: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    fontWeight: 700,
    borderRadius: 10,
    padding: '2px 8px',
    letterSpacing: '0.04em',
  },
  catExpand: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(30,25,20,0.2)',
  },
  catEmpty: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 7,
    letterSpacing: '0.14em',
    color: 'rgba(30,25,20,0.2)',
  },
  catMemories: {
    borderTop: '1px solid rgba(30,25,20,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  catMemory: {
    padding: '10px 14px 10px 44px',
    borderBottom: '1px solid rgba(30,25,20,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    background: 'rgba(255,255,255,0.5)',
  },
  catMemoryStatement: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.78)',
    lineHeight: 1.5,
  },
  catMemoryCoaching: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: '#4A7C59',
    letterSpacing: '0.06em',
    lineHeight: 1.5,
    borderLeft: '2px solid rgba(74,124,89,0.25)',
    paddingLeft: 8,
  },
  catMemorySource: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 7,
    color: 'rgba(30,25,20,0.2)',
    letterSpacing: '0.08em',
  },
  // Coaching view
  coachingView: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  coachingIntro: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(30,25,20,0.4)',
    letterSpacing: '0.05em',
    lineHeight: 1.7,
    fontStyle: 'italic',
    background: 'rgba(201,168,76,0.04)',
    border: '1px solid rgba(201,168,76,0.12)',
    borderRadius: 2,
    padding: '10px 14px',
  },
  coachingSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 14,
    borderBottom: '1px solid rgba(30,25,20,0.06)',
  },
  coachingSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  coachingIcon: {
    fontSize: 13,
    fontWeight: 700,
  },
  coachingSectionLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.12em',
    fontWeight: 600,
  },
  coachingCount: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.06em',
    marginLeft: 'auto',
  },
  coachingAngle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 14,
    fontStyle: 'italic',
    color: '#4A7C59',
    lineHeight: 1.5,
  },
  coachingMemory: {
    background: '#f5f0e8',
    borderRadius: 2,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  coachingStatement: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.75)',
    lineHeight: 1.5,
  },
  coachingAngleSpecific: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: '#4A7C59',
    letterSpacing: '0.05em',
    lineHeight: 1.5,
  },
  coachingSource: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 7,
    color: 'rgba(30,25,20,0.2)',
    letterSpacing: '0.08em',
  },
  // Timeline view
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    paddingLeft: 14,
    borderLeft: '1px solid rgba(201,168,76,0.15)',
  },
  timelineItem: {
    display: 'flex',
    gap: 12,
    paddingBottom: 14,
    position: 'relative',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: 3,
    marginLeft: -18,
  },
  timelineContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  timelineSource: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 7,
    color: 'rgba(30,25,20,0.25)',
    letterSpacing: '0.1em',
  },
  timelineStatement: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.75)',
    lineHeight: 1.5,
  },
  timelineCategory: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.08em',
  },
};
