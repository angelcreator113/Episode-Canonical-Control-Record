/**
 * TOCPanel.jsx
 * Right-panel TOC tab for the Book Editor.
 */
import './TOCPanel.css';

export default function TOCPanel({ book, chapters = [], onChapterClick }) {
  if (!book) return null;

  const allLines = chapters.flatMap(c => c.lines || []);
  const totalLines = allLines.length;
  const approvedLines = allLines.filter(l => l.status === 'approved' || l.status === 'edited').length;
  const overallPct = totalLines > 0 ? Math.round((approvedLines / totalLines) * 100) : 0;

  return (
    <div className="tocp-shell">
      {/* Book title block */}
      <div className="tocp-book">
        <div className="tocp-bookTitle">{book.title || book.character_name || 'Book'}</div>
        <div className="tocp-bookSub">
          {[book.season_label, book.week_label].filter(Boolean).join(' · ') || 'Table of Contents'}
        </div>

        {/* Overall progress */}
        <div className="tocp-overallRow">
          <div className="tocp-overallBar">
            <div className="tocp-overallFill" style={{ width: `${overallPct}%` }} />
          </div>
          <span className="tocp-overallPct">{overallPct}%</span>
        </div>

        <div className="tocp-overallLabel">
          {approvedLines} of {totalLines} lines approved
        </div>
      </div>

      <div className="tocp-divider" />

      {/* Chapter rows */}
      {chapters.length === 0 ? (
        <p className="tocp-empty">No chapters yet.</p>
      ) : (
        <div className="tocp-list">
          {chapters.map((chapter, idx) => {
            const lines = chapter.lines || [];
            const approved = lines.filter(l => l.status === 'approved' || l.status === 'edited').length;
            const pending = lines.filter(l => l.status === 'pending').length;
            const pct = lines.length > 0 ? Math.round((approved / lines.length) * 100) : 0;
            const complete = lines.length > 0 && pending === 0;

            return (
              <button
                key={chapter.id}
                type="button"
                className={`tocp-row${complete ? ' is-complete' : ''}`}
                onClick={() => onChapterClick?.(chapter.id)}
              >
                <div className="tocp-num">{String(idx + 1).padStart(2, '0')}</div>

                <div className="tocp-info">
                  <div className="tocp-title">{chapter.title}</div>

                  {chapter.badge && <div className="tocp-arc">{chapter.badge}</div>}

                  <div className="tocp-barTrack">
                    <div
                      className="tocp-barFill"
                      style={{ width: `${pct}%` }}
                      data-complete={complete ? 'true' : 'false'}
                    />
                  </div>

                  <div className="tocp-counts">
                    {complete ? (
                      <span className="tocp-ok">✓ Complete</span>
                    ) : (
                      <>
                        <span className="tocp-ok">{approved} approved</span>
                        {pending > 0 && <span className="tocp-warn">{pending} pending</span>}
                      </>
                    )}
                    <span className="tocp-total">{lines.length} lines</span>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Placeholder */}
          <div className="tocp-row tocp-row--placeholder" aria-hidden="true">
            <div className="tocp-num">{String(chapters.length + 1).padStart(2, '0')}</div>
            <div className="tocp-info">
              <div className="tocp-title tocp-title--placeholder">[ Not yet compiled ]</div>
              <div className="tocp-arc">Arc: Pending</div>
              <div className="tocp-barTrack">
                <div className="tocp-barFill" style={{ width: '0%' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}