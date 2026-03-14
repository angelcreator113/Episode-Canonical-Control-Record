/**
 * ContinuityGuard.jsx + RewriteOptions.jsx
 * frontend/src/pages/ContinuityGuard.jsx
 *
 * TWO FEATURES IN ONE FILE:
 *
 * 1. ContinuityGuard
 *    - Runs after every line approve/edit
 *    - Checks for: factual contradictions, emotional jumps, narrative disconnects
 *    - Shows a small flag panel with issues
 *    - Never interrupts writing — passive, reviewable when ready
 *
 * 2. RewriteOptions
 *    - Shows on any line via "Rewrite" button
 *    - Returns 3 alternatives: tighter, deeper emotion, sharper voice
 *    - Author picks, modifies, or ignores
 */

import { useState, useEffect, useRef } from 'react';

const MEMORIES_API    = '/api/v1/memories';
const STORYTELLER_API = '/api/v1/storyteller';

// ══════════════════════════════════════════════════════════════════════════
//  CONTINUITY GUARD
// ══════════════════════════════════════════════════════════════════════════

export function ContinuityGuard({ chapter, lines, book, triggerLine }) {
  const [issues, setIssues]     = useState([]);
  const [checking, setChecking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());
  const lastCheckedLine = useRef(null);

  // Run when a new line is approved/edited
  useEffect(() => {
    if (!triggerLine) return;
    if (triggerLine.id === lastCheckedLine.current) return;
    if (lines.length < 5) return; // need enough context
    lastCheckedLine.current = triggerLine.id;
    runCheck();
  }, [triggerLine]);

  async function runCheck() {
    setChecking(true);
    try {
      const allContent = lines
        .filter(l => ['approved','edited'].includes(l.status))
        .map((l, i) => `LINE ${i + 1}: ${l.text}`)
        .join('\n\n');

      const res = await fetch(`${MEMORIES_API}/continuity-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id:    book.id,
          chapter_id: chapter.id,
          chapter_brief: {
            title:     chapter.title,
            theme:     chapter.theme,
            scene_goal: chapter.scene_goal,
            emotional_state_start: chapter.emotional_state_start,
            emotional_state_end:   chapter.emotional_state_end,
          },
          all_lines: allContent,
          trigger_line: triggerLine.text,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.issues?.length > 0) {
        setIssues(prev => {
          // Merge, avoid duplicates
          const existing = new Set(prev.map(i => i.id));
          const newIssues = data.issues.filter(i => !existing.has(i.id));
          return [...prev, ...newIssues];
        });
        setExpanded(true); // auto-expand when new issues found
      }
    } catch (err) {
      console.error('ContinuityGuard check error:', err);
    } finally {
      setChecking(false);
    }
  }

  const visibleIssues = issues.filter(i => !dismissed.has(i.id));

  if (visibleIssues.length === 0 && !checking) return null;

  return (
    <div style={cg.shell}>
      <div style={cg.header} onClick={() => setExpanded(!expanded)}>
        <div style={cg.headerLeft}>
          {checking ? (
            <>
              <span style={cg.checkingDot} />
              <span style={cg.headerLabel}>Checking continuity…</span>
            </>
          ) : (
            <>
              <span style={{
                ...cg.countBadge,
                background: visibleIssues.length > 0 ? '#B85C38' : '#4A7C59',
              }}>
                {visibleIssues.length}
              </span>
              <span style={cg.headerLabel}>
                {visibleIssues.length === 0
                  ? 'No continuity issues'
                  : `${visibleIssues.length} continuity issue${visibleIssues.length > 1 ? 's' : ''} detected`}
              </span>
            </>
          )}
        </div>
        <span style={cg.expandIcon}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && visibleIssues.length > 0 && (
        <div style={cg.issueList}>
          {visibleIssues.map(issue => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onDismiss={() => setDismissed(prev => new Set([...prev, issue.id]))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueCard({ issue, onDismiss }) {
  const typeConfig = {
    factual:     { label: 'FACTUAL CONTRADICTION', color: '#B85C38', icon: '⚠' },
    emotional:   { label: 'EMOTIONAL JUMP',        color: '#7B5EA7', icon: '↕' },
    narrative:   { label: 'NARRATIVE DISCONNECT',  color: '#4A6B8B', icon: '⟿' },
  };
  const config = typeConfig[issue.type] || typeConfig.narrative;

  return (
    <div style={cg.issueCard}>
      <div style={cg.issueHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...cg.issueIcon, color: config.color }}>{config.icon}</span>
          <span style={{ ...cg.issueType, color: config.color }}>{config.label}</span>
        </div>
        <button style={cg.dismissBtn} onClick={onDismiss} title='Dismiss'>✕</button>
      </div>
      <div style={cg.issueText}>{issue.description}</div>
      {issue.lines_involved && (
        <div style={cg.linesInvolved}>
          Lines involved: {issue.lines_involved.join(', ')}
        </div>
      )}
      {issue.suggestion && (
        <div style={cg.issueSuggestion}>
          Fix: {issue.suggestion}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  REWRITE OPTIONS
// ══════════════════════════════════════════════════════════════════════════

export function RewriteOptions({ line, chapter, book, onAccept }) {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [options, setOptions]   = useState(null);
  const [selected, setSelected] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError]       = useState(null);

  async function fetchRewrites() {
    setOpen(true);
    if (options) return; // already loaded
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${MEMORIES_API}/rewrite-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id:    book.id,
          chapter_id: chapter.id,
          line_id:    line.id,
          content:    line.text,
          chapter_brief: {
            title:     chapter.title,
            theme:     chapter.theme,
            pov:       chapter.pov || 'first_person',
            emotional_state_start: chapter.emotional_state_start,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOptions(data.options);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(option) {
    setSelected(option.type);
    setAccepting(true);
    try {
      const res = await fetch(`${STORYTELLER_API}/lines/${line.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: option.text,
          status: 'edited',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAccept?.(option.text);
      setOpen(false);
      setOptions(null);
      setSelected(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  }

  const OPTION_CONFIG = {
    tighter: {
      label: 'TIGHTER',
      hint:  'Same meaning, fewer words, sharper delivery',
      color: '#4A6B8B',
    },
    emotional: {
      label: 'DEEPER EMOTION',
      hint:  'More feeling, more vulnerability, more honest',
      color: '#7B5EA7',
    },
    voice: {
      label: 'SHARPER VOICE',
      hint:  'More JustAWoman — direct, specific, real',
      color: '#4A7C59',
    },
  };

  return (
    <div style={rw.shell}>
      <button
        style={rw.triggerBtn}
        onClick={fetchRewrites}
        type='button'
      >
        ✎ Rewrite
      </button>

      {open && (
        <div style={rw.panel}>
          <div style={rw.panelHeader}>
            <div style={rw.panelTitle}>Rewrite Options</div>
            <button
              style={rw.closeBtn}
              onClick={() => setOpen(false)}
              type='button'
            >✕</button>
          </div>

          {/* Original */}
          <div style={rw.original}>
            <div style={rw.originalLabel}>ORIGINAL</div>
            <div style={rw.originalText}>{line.text}</div>
          </div>

          {loading && (
            <div style={rw.loadingRow}>
              <span style={rw.loadingText}>Reading your line…</span>
              <div style={rw.loadingDots}>
                {[0,1,2].map(i => (
                  <span key={i} style={{
                    ...rw.dot,
                    animationDelay: `${i * 0.2}s`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {error && <div style={rw.error}>{error}</div>}

          {options && (
            <div style={rw.optionList}>
              {options.map(opt => {
                const config = OPTION_CONFIG[opt.type] || OPTION_CONFIG.voice;
                return (
                  <div key={opt.type} style={rw.optionCard}>
                    <div style={rw.optionHeader}>
                      <div>
                        <span style={{ ...rw.optionLabel, color: config.color }}>
                          {config.label}
                        </span>
                        <span style={rw.optionHint}>{config.hint}</span>
                      </div>
                    </div>
                    <div style={rw.optionText}>{opt.text}</div>
                    <div style={rw.optionActions}>
                      <button
                        style={rw.copyBtn}
                        onClick={() => navigator.clipboard.writeText(opt.text)}
                        type='button'
                      >
                        Copy
                      </button>
                      <button
                        style={{
                          ...rw.acceptBtn,
                          background: config.color,
                          opacity: accepting && selected === opt.type ? 0.6 : 1,
                        }}
                        onClick={() => handleAccept(opt)}
                        disabled={accepting}
                        type='button'
                      >
                        {accepting && selected === opt.type ? 'Applying…' : 'Use this'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ContinuityGuard styles ──────────────────────────────────────────────────

const cg = {
  shell: {
    border: '1px solid rgba(184,92,56,0.2)',
    borderRadius: 3,
    background: 'rgba(184,92,56,0.03)',
    marginTop: 16,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.1em',
    color: 'rgba(30,25,20,0.5)',
  },
  countBadge: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    fontWeight: 700,
    color: 'white',
    borderRadius: 10,
    padding: '2px 7px',
    letterSpacing: '0.04em',
  },
  checkingDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#C9A84C',
    display: 'inline-block',
    animation: 'pulse 1s ease-in-out infinite',
  },
  expandIcon: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(30,25,20,0.25)',
  },
  issueList: {
    borderTop: '1px solid rgba(184,92,56,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  issueCard: {
    padding: '12px 14px',
    borderBottom: '1px solid rgba(30,25,20,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: 'rgba(255,255,255,0.5)',
  },
  issueHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  issueIcon: {
    fontSize: 14,
  },
  issueType: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.14em',
    fontWeight: 600,
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(30,25,20,0.25)',
    fontSize: 12,
    cursor: 'pointer',
    padding: '2px 4px',
  },
  issueText: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: 'rgba(30,25,20,0.6)',
    lineHeight: 1.6,
    letterSpacing: '0.03em',
  },
  linesInvolved: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.06em',
  },
  issueSuggestion: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: '#4A7C59',
    letterSpacing: '0.04em',
    lineHeight: 1.5,
    borderLeft: '2px solid rgba(74,124,89,0.3)',
    paddingLeft: 8,
  },
};

// ── RewriteOptions styles ──────────────────────────────────────────────────

const rw = {
  shell: {
    position: 'relative',
    display: 'inline-block',
  },
  triggerBtn: {
    background: 'none',
    border: '1px solid rgba(30,25,20,0.1)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.08em',
    color: 'rgba(30,25,20,0.35)',
    padding: '3px 8px',
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: '100%',
    marginTop: 6,
    width: 420,
    background: '#faf9f7',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 4,
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    zIndex: 200,
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(201,168,76,0.12)',
  },
  panelTitle: {
    fontFamily: "'Lora', serif",
    fontSize: 15,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.85)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(30,25,20,0.3)',
    fontSize: 12,
    cursor: 'pointer',
    padding: 4,
  },
  original: {
    padding: '10px 16px',
    background: '#f5f0e8',
    borderBottom: '1px solid rgba(30,25,20,0.06)',
  },
  originalLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.16em',
    color: 'rgba(30,25,20,0.3)',
    marginBottom: 4,
  },
  originalText: {
    fontFamily: "'Lora', serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.6)',
    lineHeight: 1.5,
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 16px',
  },
  loadingText: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.06em',
  },
  loadingDots: {
    display: 'flex',
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: '#C9A84C',
    display: 'inline-block',
    animation: 'pulse 1.2s ease-in-out infinite',
  },
  error: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: '#B85C38',
    padding: '8px 16px',
    letterSpacing: '0.04em',
  },
  optionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  optionCard: {
    padding: '12px 16px',
    borderBottom: '1px solid rgba(30,25,20,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  optionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  optionLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.14em',
    fontWeight: 600,
    display: 'block',
    marginBottom: 2,
  },
  optionHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.04em',
    display: 'block',
  },
  optionText: {
    fontFamily: "'Lora', serif",
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.8)',
    lineHeight: 1.6,
  },
  optionActions: {
    display: 'flex',
    gap: 6,
  },
  copyBtn: {
    background: 'none',
    border: '1px solid rgba(30,25,20,0.12)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.08em',
    color: 'rgba(30,25,20,0.4)',
    padding: '4px 10px',
    cursor: 'pointer',
  },
  acceptBtn: {
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.08em',
    color: 'white',
    padding: '4px 12px',
    cursor: 'pointer',
    transition: 'opacity 0.12s',
  },
};
