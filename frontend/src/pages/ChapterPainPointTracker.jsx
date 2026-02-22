/**
 * ChapterPainPointTracker.jsx
 * frontend/src/pages/ChapterPainPointTracker.jsx
 *
 * Small tracker that sits at the bottom of ChapterBrief.
 * Shows pain points documented in this chapter by category.
 * Passive — never interrupts writing.
 * Updates automatically when memories are confirmed.
 *
 * Usage inside ChapterBrief.jsx, at the very bottom of the read view:
 *
 *   import ChapterPainPointTracker from './ChapterPainPointTracker';
 *
 *   <ChapterPainPointTracker
 *     chapterId={chapter.id}
 *     bookId={book.id}
 *   />
 */

import { useState, useEffect } from 'react';

const MEMORIES_API = '/api/v1/memories';

const CATEGORY_CONFIG = {
  comparison_spiral:    { label: 'Comparison',   color: '#7B5EA7', icon: '↻' },
  visibility_gap:       { label: 'Visibility',   color: '#4A6B8B', icon: '◎' },
  identity_drift:       { label: 'Identity',     color: '#8B6914', icon: '~' },
  financial_risk:       { label: 'Financial',    color: '#B85C38', icon: '$' },
  consistency_collapse: { label: 'Consistency',  color: '#4A7C59', icon: '⏸' },
  clarity_deficit:      { label: 'Clarity',      color: '#6B4A8B', icon: '?' },
  external_validation:  { label: 'Validation',   color: '#8B4A6B', icon: '✓' },
  restart_cycle:        { label: 'Restart',      color: '#4A6B4A', icon: '↺' },
};

export default function ChapterPainPointTracker({ chapterId, bookId }) {
  const [points, setPoints]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!chapterId || !bookId) return;
    fetchPoints();
  }, [chapterId, bookId]);

  async function fetchPoints() {
    try {
      const params = new URLSearchParams({
        book_id:    bookId,
        chapter_id: chapterId,
        type:       'pain_point',
        confirmed:  'true',
      });
      const res = await fetch(`${MEMORIES_API}?${params}`);
      const data = await res.json();
      setPoints(data.memories || []);
    } catch (err) {
      // Fail silently
    } finally {
      setLoading(false);
    }
  }

  if (loading || points.length === 0) return null;

  // Group by category
  const grouped = points.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  const categories = Object.keys(grouped);

  return (
    <div style={s.shell}>
      <div style={s.header} onClick={() => setExpanded(!expanded)}>
        <div style={s.headerLeft}>
          <span style={s.headerIcon}>◆</span>
          <span style={s.headerLabel}>
            {points.length} pain point{points.length > 1 ? 's' : ''} documented
          </span>
          {/* Category dots */}
          <div style={s.dotRow}>
            {categories.map(cat => {
              const config = CATEGORY_CONFIG[cat];
              if (!config) return null;
              return (
                <div
                  key={cat}
                  title={config.label}
                  style={{
                    ...s.dot,
                    background: config.color,
                  }}
                />
              );
            })}
          </div>
        </div>
        <span style={s.expandIcon}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={s.body}>
          {categories.map(cat => {
            const config = CATEGORY_CONFIG[cat];
            const catPoints = grouped[cat];
            if (!config) return null;
            return (
              <div key={cat} style={s.catRow}>
                <div style={s.catLeft}>
                  <span style={{ ...s.catIcon, color: config.color }}>
                    {config.icon}
                  </span>
                  <span style={{ ...s.catLabel, color: config.color }}>
                    {config.label}
                  </span>
                </div>
                <div style={s.catPoints}>
                  {catPoints.map(p => (
                    <div key={p.id} style={s.pointStatement}>
                      {p.statement}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div style={s.note}>
            She doesn't know she's building a coaching curriculum. That's the point.
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  shell: {
    borderTop: '1px solid rgba(201,168,76,0.1)',
    marginTop: 8,
    paddingTop: 8,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    color: '#C9A84C',
    fontSize: 9,
  },
  headerLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.1em',
    color: 'rgba(30,25,20,0.4)',
  },
  dotRow: {
    display: 'flex',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
  expandIcon: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 7,
    color: 'rgba(30,25,20,0.2)',
  },
  body: {
    marginTop: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  catRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  catLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  catIcon: {
    fontSize: 10,
    fontWeight: 700,
    width: 14,
    textAlign: 'center',
  },
  catLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.12em',
    fontWeight: 600,
  },
  catPoints: {
    paddingLeft: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  pointStatement: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 12,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.6)',
    lineHeight: 1.5,
  },
  note: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(30,25,20,0.2)',
    letterSpacing: '0.06em',
    fontStyle: 'italic',
    paddingTop: 6,
    borderTop: '1px solid rgba(30,25,20,0.04)',
  },
};
