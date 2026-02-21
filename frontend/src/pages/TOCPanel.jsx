/**
 * TOCPanel.jsx
 *
 * Right-panel TOC tab for the Book Editor.
 * Reads chapters + lines already in state — no API calls.
 *
 * Usage in StorytellerPage.jsx BookEditor:
 *
 *   import TOCPanel from './TOCPanel';
 *
 *   // In the right panel, alongside MemoryBankPanel:
 *   {activeRightTab === 'toc' && (
 *     <TOCPanel
 *       book={book}
 *       chapters={chapters}
 *       onChapterClick={(chapterId) => { ... }} // scroll/highlight chapter
 *     />
 *   )}
 *
 * Also add the tab button:
 *   <button onClick={() => setActiveRightTab('toc')} ...>TOC</button>
 */

export default function TOCPanel({ book, chapters = [], onChapterClick }) {
  const totalLines    = chapters.flatMap(c => c.lines || []).length;
  const approvedLines = chapters.flatMap(c => c.lines || []).filter(l =>
    l.status === 'approved' || l.status === 'edited'
  ).length;
  const overallPct = totalLines > 0 ? Math.round((approvedLines / totalLines) * 100) : 0;

  return (
    <div style={s.shell}>

      {/* Book title block */}
      <div style={s.bookBlock}>
        <div style={s.bookTitle}>{book.title || book.character_name || 'Book'}</div>
        <div style={s.bookSub}>
          {[book.season_label, book.week_label].filter(Boolean).join(' · ') || 'Table of Contents'}
        </div>

        {/* Overall progress */}
        <div style={s.overallRow}>
          <div style={s.overallBar}>
            <div style={{ ...s.overallFill, width: `${overallPct}%` }} />
          </div>
          <span style={s.overallPct}>{overallPct}%</span>
        </div>
        <div style={s.overallLabel}>
          {approvedLines} of {totalLines} lines approved
        </div>
      </div>

      <div style={s.divider} />

      {/* Chapter rows */}
      {chapters.length === 0 ? (
        <p style={s.empty}>No chapters yet.</p>
      ) : (
        <div style={s.chapterList}>
          {chapters.map((chapter, idx) => {
            const lines    = chapter.lines || [];
            const approved = lines.filter(l => l.status === 'approved' || l.status === 'edited').length;
            const pending  = lines.filter(l => l.status === 'pending').length;
            const pct      = lines.length > 0 ? Math.round((approved / lines.length) * 100) : 0;
            const complete = lines.length > 0 && pending === 0;

            return (
              <div
                key={chapter.id}
                style={s.chapterRow}
                onClick={() => onChapterClick?.(chapter.id)}
              >
                <div style={s.chNum}>
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <div style={s.chInfo}>
                  <div style={{
                    ...s.chTitle,
                    color: complete ? '#2c2418' : 'rgba(26,21,16,0.6)',
                  }}>
                    {chapter.title}
                  </div>

                  {/* Arc label if present */}
                  {chapter.badge && (
                    <div style={s.chArc}>{chapter.badge}</div>
                  )}

                  {/* Progress bar */}
                  <div style={s.barTrack}>
                    <div style={{
                      ...s.barFill,
                      width: `${pct}%`,
                      background: complete ? '#4A7C59' : '#C9A84C',
                    }} />
                  </div>

                  {/* Line counts */}
                  <div style={s.chCounts}>
                    {complete ? (
                      <span style={{ color: '#4A7C59' }}>✓ Complete</span>
                    ) : (
                      <>
                        <span style={{ color: '#4A7C59' }}>{approved} approved</span>
                        {pending > 0 && (
                          <span style={{ color: '#C9A84C' }}>{pending} pending</span>
                        )}
                      </>
                    )}
                    <span style={{ color: 'rgba(26,21,16,0.2)', marginLeft: 'auto' }}>
                      {lines.length} lines
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Placeholder for next unwritten chapter */}
          <div style={{ ...s.chapterRow, opacity: 0.3, cursor: 'default', pointerEvents: 'none' }}>
            <div style={s.chNum}>
              {String(chapters.length + 1).padStart(2, '0')}
            </div>
            <div style={s.chInfo}>
              <div style={{ ...s.chTitle, fontStyle: 'italic', color: 'rgba(26,21,16,0.25)' }}>
                [ Not yet compiled ]
              </div>
              <div style={s.chArc}>Arc: Pending</div>
              <div style={s.barTrack}>
                <div style={{ ...s.barFill, width: '0%' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  shell: {
    padding: '18px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  bookBlock: {
    marginBottom: 14,
  },
  bookTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 17,
    fontStyle: 'italic',
    color: '#2c2418',
    marginBottom: 3,
    lineHeight: 1.3,
  },
  bookSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(26,21,16,0.4)',
    letterSpacing: '0.1em',
    marginBottom: 10,
  },
  overallRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  overallBar: {
    flex: 1,
    height: 3,
    background: 'rgba(0,0,0,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  overallFill: {
    height: '100%',
    background: '#C9A84C',
    borderRadius: 2,
    transition: 'width 0.4s ease',
  },
  overallPct: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    color: '#C9A84C',
    minWidth: 30,
    textAlign: 'right',
  },
  overallLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(26,21,16,0.35)',
    letterSpacing: '0.08em',
  },
  divider: {
    height: 1,
    background: 'rgba(0,0,0,0.06)',
    margin: '0 0 10px',
  },
  chapterList: {
    display: 'flex',
    flexDirection: 'column',
  },
  chapterRow: {
    display: 'flex',
    gap: 10,
    padding: '10px 0',
    borderBottom: '1px solid rgba(0,0,0,0.04)',
    cursor: 'pointer',
    transition: 'background 0.12s',
  },
  chNum: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(201,168,76,0.7)',
    letterSpacing: '0.1em',
    paddingTop: 2,
    flexShrink: 0,
    width: 22,
  },
  chInfo: {
    flex: 1,
    minWidth: 0,
  },
  chTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 1.3,
    marginBottom: 3,
    transition: 'color 0.12s',
  },
  chArc: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(26,21,16,0.3)',
    letterSpacing: '0.06em',
    marginBottom: 5,
  },
  barTrack: {
    height: 2,
    background: 'rgba(0,0,0,0.06)',
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: 5,
  },
  barFill: {
    height: '100%',
    borderRadius: 1,
    transition: 'width 0.3s ease',
  },
  chCounts: {
    display: 'flex',
    gap: 8,
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.06em',
  },
  empty: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    color: 'rgba(26,21,16,0.35)',
    letterSpacing: '0.06em',
  },
};
