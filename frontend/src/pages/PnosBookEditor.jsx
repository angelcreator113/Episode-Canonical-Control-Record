/**
 * PNOS Book Editor — Advanced three-panel layout
 *
 * Left:   Chapter navigation + book progress
 * Center: Line-by-line book content with approve/edit/reject
 * Right:  Intelligence panel (TOC, Memory Bank, Scene Setter, Arc Gaps)
 *
 * Location: frontend/src/pages/PnosBookEditor.jsx
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import './PnosBookEditor.css';

// ── Demo data ────────────────────────────────────
// This is the prototype dataset. In production, replace with API calls.

const INITIAL_CHAPTERS = [
  {
    id: 'ch1',
    num: '01',
    title: 'The Parisian Tea Party',
    meta: 'Week 6 · Arc: Self-Doubt',
    badge: 'AUTO-COMPILED · FEB 20',
    groups: [
      {
        label: 'Arc Summary',
        lines: [
          { id: 'l1', status: 'approved', text: 'Frankie entered Week 6 with a restless elegance, caught between the world she was born into and the one she was quietly building for herself.', sources: ['voice · feb 14', 'goal entry'] },
          { id: 'l2', status: 'edited', text: "She isn't chasing prestige anymore — she's chasing something harder to name. A feeling. An atmosphere only she can create.", sources: ['edited by you · feb 18', '🔒 protected'] },
        ],
      },
      {
        label: 'Character Shift Detected',
        lines: [
          { id: 'l3', status: 'pending', text: "For the first time, Frankie felt a flicker of intimidation in Chloe's presence — not envy, but something more honest: recognition.", sources: ['relationship · feb 16', 'confidence: 0.82'] },
          { id: 'l4', status: 'pending', text: "She has begun to understand that her most powerful tool is not style, but restraint — knowing what not to say, not to wear, not to want.", sources: ['voice · feb 17', 'confidence: 0.74'] },
        ],
      },
      {
        label: '🧠 Memory Extracted — Awaiting Confirmation',
        lines: [
          {
            id: 'mem1', status: 'memory',
            text: "Frankie feels intimidated by Chloe's effortless elegance — not from envy but from recognition of something she wants to become.",
            sources: ['extracted · feb 16', 'relationship shift'],
            memory: {
              type: 'Relationship Shift',
              character: 'Frankie → Chloe',
              confidence: '0.82 · user-confirmed',
              tags: 'identity, comparison, style',
              statement: 'Frankie feels intimidated by Chloe. The feeling is aspirational, not hostile. This marks a shift from admiration to self-comparison.',
              source: 'Voice session · Feb 16 · 2:34pm → will update Character Registry automatically on confirm',
            },
          },
        ],
      },
      {
        label: 'Relationship Thread',
        lines: [
          { id: 'l5', status: 'approved', text: "Frankie & Chloe: tension unresolved. The dynamic has shifted from admiration to something more complicated.", sources: ['relationship · feb 15–18'] },
          { id: 'l6', status: 'pending', text: "Whether this becomes rivalry or mentorship may depend on what Frankie decides she actually wants from this world.", sources: ['open thread', 'confidence: 0.69'] },
        ],
      },
      {
        label: '🎬 Scene Suggestion — Auto-Generated',
        scene: {
          label: 'Suggested Next Scene · Chapter 01',
          text: '"The first time Frankie notices Chloe\'s account has more followers than she imagined — and the way she closes the app without saving the thought."',
          chars: ['Frankie', 'The Algorithm (invisible)'],
        },
      },
      {
        label: 'Closing Beat',
        lines: [
          { id: 'l7', status: 'pending', text: "Week 6 ends without resolution, which may be exactly the point. Some chapters close. Others simply pause, breathing.", sources: ['arc synthesis · auto', 'confidence: 0.88'] },
        ],
      },
    ],
  },
  {
    id: 'ch2',
    num: '02',
    title: 'The Mirror Cracks',
    meta: 'Week 7 · Arc: Recognition',
    badge: 'AUTO-COMPILED · FEB 21',
    groups: [
      {
        label: 'Arc Opening',
        lines: [
          { id: 'l8', status: 'pending', text: "By Week 7 the question was no longer what she wanted to build — it was whether she was the person who could build it.", sources: ['arc synthesis · auto', 'confidence: 0.79'] },
        ],
      },
      {
        label: '🧠 Memory Extracted — Awaiting Confirmation',
        lines: [
          {
            id: 'mem2', status: 'memory',
            text: "Frankie's core goal shifts: no longer about the product — about proving something to herself.",
            sources: ['extracted · feb 19', 'goal shift'],
            memory: {
              type: 'Goal Shift',
              character: 'Frankie (self)',
              confidence: '0.77 · inferred',
              tags: 'goal, identity, proof',
              statement: "Frankie's motivation has moved from external success to internal proof. This is a core arc inflection point.",
            },
          },
        ],
      },
      {
        label: 'The Witness Scene',
        lines: [
          { id: 'l9', status: 'pending', text: 'Simone said it gently: "You\'ve said this before." And Frankie heard it differently this time — not as a warning, but as a map.', sources: ['character: Simone', 'mirror beat'] },
        ],
      },
    ],
  },
  {
    id: 'ch3',
    num: '03',
    title: "Something She Can't Name",
    meta: 'Week 8 · Arc: Emergence',
    badge: 'DRAFT · IN PROGRESS',
    groups: [
      {
        label: 'Opening',
        lines: [
          { id: 'l10', status: 'pending', text: "There is a version of herself she can almost see — not ahead, exactly, but sideways, in peripheral vision, always just out of reach.", sources: ['arc synthesis · draft', 'confidence: 0.71'] },
          { id: 'l11', status: 'pending', text: "She hasn't named her yet. But she's closer. And the proximity is starting to feel less like hope and more like pressure.", sources: ['arc synthesis · draft', 'confidence: 0.68'] },
        ],
      },
      {
        label: '🎬 Scene Suggestion',
        scene: {
          label: 'Suggested Scene · Chapter 03',
          text: '"Frankie sketches something — not a product, not a plan. Just a word. She crosses it out. Writes it again. The word is Lala."',
          chars: ['Frankie', 'Alone'],
        },
      },
    ],
  },
];

const MEMORIES = [
  { type: 'Relationship Shift', statement: "Frankie feels intimidated by Chloe — aspiration, not hostility. This is new.", meta: '✓ User-confirmed · feb 16 · Frankie → Chloe', confirmed: true },
  { type: 'Goal · Business', statement: 'Frankie wants to grow revenue to a point where Daniel stops asking the question.', meta: '✓ User-confirmed · feb 14 · Frankie', confirmed: true },
  { type: 'Constraint', statement: 'Frankie avoids posting anything that feels "too obvious." The algorithm rewards it; she can\'t make herself do it.', meta: '◌ Inferred · feb 17 · needs confirmation', confirmed: false },
  { type: 'Character Belief', statement: "Simone (The Witness) believes in Frankie more than Frankie does — but won't say it directly.", meta: '✓ User-confirmed · feb 15 · Simone', confirmed: true },
];

const SCENE_SUGGESTIONS = [
  { chapter: 'Chapter 01', title: 'The Tab She Never Closes', why: "Chloe's profile has been open in her browser for 3 days. Frankie doesn't follow her. She doesn't unfollow either.", chars: ['Frankie', 'Algorithm'] },
  { chapter: 'Chapter 01–02 Bridge', title: 'Daniel at the Kitchen Table', why: "He doesn't ask. She notices him not asking. That silence is its own kind of pressure — chapter-bridge beat.", chars: ['Frankie', 'Daniel'] },
  { chapter: 'Chapter 02', title: 'Simone Says "I Know"', why: 'Frankie tries to explain her new direction. Simone stops her: "I know." That\'s all. The witness has been watching.', chars: ['Frankie', 'Simone'] },
  { chapter: 'Chapter 03', title: 'The Name She Writes and Crosses Out', why: 'Based on arc trajectory: Lala is emerging. This is the first time the name exists on paper — even erased, it leaves a mark.', chars: ['Frankie · Alone'] },
];

const ARC_GAPS = [
  { severity: 'high', title: 'Daniel has no scene in Chapter 01 or 02', note: "He's named in memories but never appears on the page. His absence as a character weakens the \"Stability vs Risk\" pressure thread. Needs at least one grounding scene." },
  { severity: 'high', title: 'Chloe thread opened but no payoff logged', note: 'The Frankie/Chloe dynamic is introduced in Chapter 01 but has no resolution or escalation logged past that. The reader will feel this hanging.' },
  { severity: 'mid', title: 'No bridge beat between Chapter 02 and 03', note: 'The arc jumps from "recognition" to "emergence" with no connective tissue. A short transition beat or scene would make the shift feel earned, not sudden.' },
  { severity: 'mid', title: 'Constraint memory still inferred, not locked', note: "Frankie's posting avoidance is inferred from two entries but not user-confirmed. If it drives a scene decision, it should be confirmed first." },
];

// ══════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════

export default function PnosBookEditor() {
  const [chapters, setChapters] = useState(INITIAL_CHAPTERS);
  const [activeChapter, setActiveChapter] = useState('ch1');
  const [rightTab, setRightTab] = useState('toc');
  const [tocOpen, setTocOpen] = useState(false);
  const [toast, setToast] = useState({ msg: '', visible: false });
  const [editingLine, setEditingLine] = useState(null);
  const [editText, setEditText] = useState('');
  const toastTimer = useRef(null);
  const centerRef = useRef(null);

  // Build a flat map of all line states
  const lineStates = {};
  chapters.forEach(ch => {
    ch.groups.forEach(g => {
      (g.lines || []).forEach(l => { lineStates[l.id] = l.status; });
    });
  });

  const countByStatus = (status) => Object.values(lineStates).filter(s => s === status).length;
  const pendingCount = countByStatus('pending');
  const approvedCount = countByStatus('approved');
  const editedCount = countByStatus('edited');
  const memoryCount = countByStatus('memory');

  const chapterPendingCount = (chId) => {
    const ch = chapters.find(c => c.id === chId);
    if (!ch) return 0;
    let count = 0;
    ch.groups.forEach(g => (g.lines || []).forEach(l => {
      if (l.status === 'pending' || l.status === 'memory') count++;
    }));
    return count;
  };

  // ── Toast ──────────────────────────────────
  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, visible: true });
    toastTimer.current = setTimeout(() => setToast({ msg: '', visible: false }), 2600);
  }, []);

  // ── Chapter navigation ─────────────────────
  const showChapter = useCallback((id) => {
    setActiveChapter(id);
    if (centerRef.current) centerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ── Line operations ────────────────────────
  const updateLineStatus = useCallback((lineId, newStatus) => {
    setChapters(prev => prev.map(ch => ({
      ...ch,
      groups: ch.groups.map(g => ({
        ...g,
        lines: (g.lines || []).map(l => l.id === lineId ? { ...l, status: newStatus } : l),
      })),
    })));
  }, []);

  const removeLine = useCallback((lineId) => {
    setChapters(prev => prev.map(ch => ({
      ...ch,
      groups: ch.groups.map(g => ({
        ...g,
        lines: (g.lines || []).filter(l => l.id !== lineId),
      })),
    })));
  }, []);

  const approveLine = useCallback((id) => {
    updateLineStatus(id, 'approved');
    showToast('Line approved · locked as canon');
  }, [updateLineStatus, showToast]);

  const confirmMemory = useCallback((id) => {
    updateLineStatus(id, 'approved');
    showToast('Memory confirmed · saved to Character Registry');
  }, [updateLineStatus, showToast]);

  const rejectLine = useCallback((id) => {
    removeLine(id);
    showToast('Line removed');
  }, [removeLine, showToast]);

  const startEdit = useCallback((line) => {
    setEditingLine(line.id);
    setEditText(line.text);
  }, []);

  const saveEdit = useCallback((lineId) => {
    setChapters(prev => prev.map(ch => ({
      ...ch,
      groups: ch.groups.map(g => ({
        ...g,
        lines: (g.lines || []).map(l =>
          l.id === lineId ? { ...l, text: editText, status: 'edited', sources: ['edited by you · today', '🔒 protected'] } : l
        ),
      })),
    })));
    setEditingLine(null);
    setEditText('');
    showToast('Edit saved · line protected');
  }, [editText, showToast]);

  const cancelEdit = useCallback(() => {
    setEditingLine(null);
    setEditText('');
  }, []);

  const approveChapter = useCallback((chId) => {
    setChapters(prev => prev.map(ch => {
      if (ch.id !== chId) return ch;
      return {
        ...ch,
        groups: ch.groups.map(g => ({
          ...g,
          lines: (g.lines || []).map(l => l.status === 'pending' ? { ...l, status: 'approved' } : l),
        })),
      };
    }));
    showToast('Chapter approved · all lines locked as canon');
  }, [showToast]);

  const approveAllVisible = useCallback(() => {
    setChapters(prev => prev.map(ch => {
      if (ch.id !== activeChapter) return ch;
      return {
        ...ch,
        groups: ch.groups.map(g => ({
          ...g,
          lines: (g.lines || []).map(l => l.status === 'pending' ? { ...l, status: 'approved' } : l),
        })),
      };
    }));
    showToast('All pending lines approved');
  }, [activeChapter, showToast]);

  // ── Key shortcuts ──────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (tocOpen) setTocOpen(false);
        if (editingLine) cancelEdit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tocOpen, editingLine, cancelEdit]);

  // ── Render ─────────────────────────────────
  return (
    <div className="pnos-editor">
      {/* ═══ LEFT SIDEBAR ═══ */}
      <aside className="pnos-sidebar-left">
        <div className="pnos-sidebar-brand">
          <div className="pnos-label">PNOS</div>
          <h2>Frankie Moreau</h2>
          <div className="book-sub">Book 1 · Before Lala</div>
        </div>

        <div className="pnos-sidebar-section">
          <div className="pnos-sidebar-section-label">Chapters</div>
          {chapters.map(ch => {
            const pc = chapterPendingCount(ch.id);
            const dots = [];
            ch.groups.forEach(g => (g.lines || []).forEach(l => {
              if (l.status === 'approved') dots.push('a');
              else if (l.status === 'pending') dots.push('p');
              else if (l.status === 'edited') dots.push('e');
            }));
            return (
              <button
                key={ch.id}
                className={`pnos-chapter-nav-item ${activeChapter === ch.id ? 'active' : ''}`}
                onClick={() => showChapter(ch.id)}
              >
                <span className="cnav-num">{ch.num}</span>
                <div className="cnav-info">
                  <div className="cnav-title">{ch.title}</div>
                  <div className="cnav-meta">{ch.meta}</div>
                  <div className="cnav-dots">
                    {dots.slice(0, 8).map((d, i) => (
                      <div key={i} className={`cnav-dot ${d}`} />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button className="pnos-toc-btn" onClick={() => setTocOpen(true)}>
          📖 Table of Contents
        </button>

        <div className="pnos-sidebar-footer-stats">
          <div className="pnos-sidebar-section-label">Book Progress</div>
          <div className="stat-row"><span className="stat-label">Pending</span><span className="stat-val p">{pendingCount}</span></div>
          <div className="stat-row"><span className="stat-label">Approved</span><span className="stat-val a">{approvedCount}</span></div>
          <div className="stat-row"><span className="stat-label">Edited</span><span className="stat-val e">{editedCount}</span></div>
          <div className="stat-row"><span className="stat-label">Memories</span><span className="stat-val" style={{ color: 'var(--memory)' }}>{memoryCount}</span></div>
        </div>
      </aside>

      {/* ═══ CENTER — BOOK ═══ */}
      <main className="pnos-book-center" ref={centerRef}>
        <div className="pnos-topbar">
          <div className="pnos-topbar-left">
            <h1>Book Editor</h1>
            <div className="sub">PNOS · Before Lala · Season 1</div>
          </div>
          <div className="pnos-topbar-actions">
            <button className="btn-tbar" onClick={() => setTocOpen(true)}>Table of Contents</button>
            <button className="btn-tbar" onClick={approveAllVisible}>Approve All Pending</button>
            <button className="btn-tbar primary" onClick={() => showToast('Compiling book to PDF…')}>Compile Book ↗</button>
          </div>
        </div>

        {chapters.map(ch => (
          <div key={ch.id} className={`pnos-chapter-block ${activeChapter === ch.id ? 'visible' : ''}`}>
            <div className="pnos-chapter-header-bar">
              <span className="ch-num">Chapter {ch.num}</span>
              <span className="ch-title">{ch.title}</span>
              <span className="ch-badge">{ch.badge}</span>
              <span className={`ch-status ${chapterPendingCount(ch.id) === 0 ? 'all-approved' : 'has-pending'}`}>
                {chapterPendingCount(ch.id) === 0 ? 'Complete' : `${chapterPendingCount(ch.id)} pending`}
              </span>
            </div>
            <div className="pnos-book-page">
              {ch.groups.map((group, gi) => (
                <div key={gi} className="pnos-line-group">
                  <div className="pnos-group-label">{group.label}</div>

                  {/* Scene suggestion block */}
                  {group.scene && (
                    <SceneSuggestion scene={group.scene} showToast={showToast} />
                  )}

                  {/* Line items */}
                  {(group.lines || []).map(line => (
                    <LineItem
                      key={line.id}
                      line={line}
                      editing={editingLine === line.id}
                      editText={editText}
                      onEditTextChange={setEditText}
                      onApprove={approveLine}
                      onReject={rejectLine}
                      onStartEdit={startEdit}
                      onSaveEdit={saveEdit}
                      onCancelEdit={cancelEdit}
                      onConfirmMemory={confirmMemory}
                      showToast={showToast}
                    />
                  ))}
                </div>
              ))}

              <div className="pnos-action-bar">
                <span className="action-bar-hint">
                  {chapterPendingCount(ch.id) === 0
                    ? 'Chapter complete ✓'
                    : `${chapterPendingCount(ch.id)} item${chapterPendingCount(ch.id) > 1 ? 's' : ''} awaiting review`
                  }
                </span>
                <button className="btn-primary" onClick={() => approveChapter(ch.id)}>
                  Approve Chapter →
                </button>
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* ═══ RIGHT SIDEBAR ═══ */}
      <aside className="pnos-sidebar-right">
        <div className="pnos-right-tab-bar">
          {['toc', 'memory', 'scenes', 'gaps'].map(tab => (
            <button
              key={tab}
              className={`pnos-right-tab ${rightTab === tab ? 'active' : ''}`}
              onClick={() => setRightTab(tab)}
            >
              {tab === 'toc' ? 'TOC' : tab === 'memory' ? 'Memory' : tab === 'scenes' ? 'Scenes' : 'Gaps'}
            </button>
          ))}
        </div>

        <div className="pnos-right-panel-body">
          {rightTab === 'toc' && <TocPanel chapters={chapters} onShowChapter={showChapter} onOpenToc={() => setTocOpen(true)} />}
          {rightTab === 'memory' && <MemoryPanel />}
          {rightTab === 'scenes' && <ScenesPanel showToast={showToast} />}
          {rightTab === 'gaps' && <GapsPanel />}
        </div>
      </aside>

      {/* ═══ TOC MODAL ═══ */}
      <TocModal
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        chapters={chapters}
        onShowChapter={(id) => { setTocOpen(false); showChapter(id); }}
      />

      {/* ═══ TOAST ═══ */}
      <div className={`pnos-toast ${toast.visible ? 'show' : ''}`}>{toast.msg}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// Line Item
// ══════════════════════════════════════════════════

function LineItem({ line, editing, editText, onEditTextChange, onApprove, onReject, onStartEdit, onSaveEdit, onCancelEdit, onConfirmMemory, showToast }) {
  const textRef = useRef(null);

  // Focus editing field
  useEffect(() => {
    if (editing && textRef.current) {
      textRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(textRef.current);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }
  }, [editing]);

  return (
    <>
      <div className={`pnos-line-item status-${line.status}`}>
        <div className="pnos-line-dot" />
        <div>
          {editing ? (
            <div
              ref={textRef}
              className="pnos-line-text editing"
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => onEditTextChange(e.currentTarget.textContent)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSaveEdit(line.id); }
                if (e.key === 'Escape') onCancelEdit();
              }}
            >
              {editText}
            </div>
          ) : (
            <div className="pnos-line-text">
              {line.status === 'memory' && <span className="memory-badge">MEMORY</span>}
              {line.text}
            </div>
          )}
          <div className="pnos-line-source">
            {(line.sources || []).map((s, i) => <span key={i} className="source-tag">{s}</span>)}
          </div>
        </div>
        <div className="pnos-line-actions">
          {editing ? (
            <>
              <button className="btn-action btn-save" onClick={() => onSaveEdit(line.id)}>Save</button>
              <button className="btn-action btn-cancel" onClick={onCancelEdit}>Cancel</button>
            </>
          ) : line.status === 'memory' ? (
            <>
              <button className="btn-action btn-confirm-mem" onClick={() => onConfirmMemory(line.id)}>Confirm</button>
              <button className="btn-action btn-skip-mem" onClick={() => onReject(line.id)}>Skip</button>
            </>
          ) : line.status === 'pending' ? (
            <>
              <button className="btn-action btn-approve" onClick={() => onApprove(line.id)}>✓ Approve</button>
              <button className="btn-action btn-edit" onClick={() => onStartEdit(line)}>Edit</button>
              <button className="btn-action btn-reject" onClick={() => onReject(line.id)}>✕</button>
            </>
          ) : (
            <button className="btn-action btn-edit" onClick={() => onStartEdit(line)}>Edit</button>
          )}
        </div>
      </div>

      {/* Memory detail card */}
      {line.memory && line.status === 'memory' && (
        <div className="pnos-memory-card">
          <div className="mem-card-title">📎 Memory Details — Review Before Confirming</div>
          <div className="mem-fields">
            <div className="mem-field"><div className="mem-field-label">Type</div><div className="mem-field-val">{line.memory.type}</div></div>
            <div className="mem-field"><div className="mem-field-label">Character</div><div className="mem-field-val">{line.memory.character}</div></div>
            <div className="mem-field"><div className="mem-field-label">Confidence</div><div className="mem-field-val">{line.memory.confidence}</div></div>
            <div className="mem-field"><div className="mem-field-label">Tags</div><div className="mem-field-val">{line.memory.tags}</div></div>
            <div className="mem-field" style={{ gridColumn: '1 / -1' }}>
              <div className="mem-field-label">Statement</div>
              <div className="mem-field-val">{line.memory.statement}</div>
            </div>
            {line.memory.source && (
              <div className="mem-field" style={{ gridColumn: '1 / -1' }}>
                <div className="mem-field-label">Source</div>
                <div className="mem-field-val">{line.memory.source}</div>
              </div>
            )}
          </div>
          <div className="mem-actions">
            <button className="btn-mem btn-mem-confirm" onClick={() => onConfirmMemory(line.id)}>✓ Confirm & Save to Registry</button>
            <button className="btn-mem btn-mem-edit" onClick={() => showToast('Edit memory fields…')}>Edit Fields</button>
            <button className="btn-mem btn-mem-skip" onClick={() => onReject(line.id)}>Skip — Don't Save</button>
          </div>
        </div>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════
// Scene Suggestion inline
// ══════════════════════════════════════════════════

function SceneSuggestion({ scene, showToast }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="pnos-scene-suggestion">
      <div className="scene-title-row">
        <span className="scene-icon">🎬</span>
        <span className="scene-label">{scene.label}</span>
      </div>
      <div className="scene-text">{scene.text}</div>
      <div className="scene-chars">
        {scene.chars.map((c, i) => <span key={i} className="scene-char">{c}</span>)}
      </div>
      <div className="scene-actions">
        <button className="btn-scene use" onClick={() => showToast('Scene added to beat log')}>Use This Scene</button>
        <button className="btn-scene" onClick={() => showToast('Generating alternative…')}>New Suggestion</button>
        <button className="btn-scene" onClick={() => setDismissed(true)}>Dismiss</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// Right Panel — TOC
// ══════════════════════════════════════════════════

function TocPanel({ chapters, onShowChapter, onOpenToc }) {
  const progressMap = { ch1: 57, ch2: 20, ch3: 5 };
  const arcMap = { ch1: 'Arc: Self-Doubt → Recognition', ch2: 'Arc: Recognition → Identity', ch3: 'Arc: Identity → Emergence' };

  return (
    <>
      <div className="toc-header">
        <div className="toc-title">Before Lala</div>
        <div className="toc-sub">Book 1 · Table of Contents</div>
      </div>
      {chapters.map(ch => (
        <div key={ch.id} className="toc-row" onClick={() => onShowChapter(ch.id)}>
          <span className="toc-ch-num">{ch.num}</span>
          <div className="toc-row-info">
            <div className="toc-row-title">{ch.title}</div>
            <div className="toc-row-arc">{arcMap[ch.id] || ''}</div>
            <div className="toc-progress">
              <div className="toc-progress-fill" style={{ width: `${progressMap[ch.id] || 0}%` }} />
            </div>
          </div>
        </div>
      ))}
      <div className="toc-row" style={{ opacity: 0.35, cursor: 'default' }}>
        <span className="toc-ch-num">04</span>
        <div className="toc-row-info">
          <div className="toc-row-title" style={{ color: 'var(--ink-muted)' }}>[ Not yet compiled ]</div>
          <div className="toc-row-arc">Arc: Pending</div>
          <div className="toc-progress"><div className="toc-progress-fill" style={{ width: '0%' }} /></div>
        </div>
      </div>
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
        <button className="pnos-toc-btn" onClick={onOpenToc} style={{ margin: 0, width: '100%' }}>View Full TOC →</button>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════
// Right Panel — Memory Bank
// ══════════════════════════════════════════════════

function MemoryPanel() {
  return (
    <>
      <div className="panel-header">
        <div className="panel-header-title">Memory Bank</div>
        <div className="panel-header-sub">Confirmed character memories · {MEMORIES.length} saved</div>
      </div>
      {MEMORIES.map((m, i) => (
        <div key={i} className="memory-item">
          <div className="mi-type">{m.type}</div>
          <div className="mi-statement">{m.statement}</div>
          <div className={`mi-meta ${m.confirmed ? 'mi-confirmed' : 'mi-inferred'}`}>{m.meta}</div>
        </div>
      ))}
      <div className="panel-divider">
        <div className="panel-divider-label">Awaiting Confirmation</div>
        <div className="panel-divider-text">2 memories in current chapters need your review ↑</div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════
// Right Panel — Scene Suggestions
// ══════════════════════════════════════════════════

function ScenesPanel({ showToast }) {
  return (
    <>
      <div className="panel-header">
        <div className="panel-header-title">Scene Setter</div>
        <div className="panel-header-sub">Auto-suggested · based on approved content</div>
      </div>
      {SCENE_SUGGESTIONS.map((s, i) => (
        <div key={i} className="scene-sug-item">
          <div className="ssi-chapter">{s.chapter}</div>
          <div className="ssi-title">{s.title}</div>
          <div className="ssi-why">{s.why}</div>
          <div className="ssi-chars">
            {s.chars.map((c, ci) => <span key={ci} className="ssi-char">{c}</span>)}
          </div>
          <button className="btn-use-scene" onClick={() => showToast(`Scene added to ${s.chapter}`)}>
            Add to {s.chapter} →
          </button>
        </div>
      ))}
    </>
  );
}

// ══════════════════════════════════════════════════
// Right Panel — Arc Gaps
// ══════════════════════════════════════════════════

function GapsPanel() {
  return (
    <>
      <div className="panel-header">
        <div className="panel-header-title">Arc Gaps</div>
        <div className="panel-header-sub">Missing beats · unresolved threads</div>
      </div>
      {ARC_GAPS.map((g, i) => (
        <div key={i} className="gap-item">
          <div className={`gap-severity ${g.severity}`}>
            {g.severity === 'high' ? '⚠ High — Missing Beat' : '◌ Medium — Transition Missing'}
          </div>
          <div className="gap-title">{g.title}</div>
          <div className="gap-note">{g.note}</div>
        </div>
      ))}
    </>
  );
}

// ══════════════════════════════════════════════════
// TOC Modal
// ══════════════════════════════════════════════════

function TocModal({ open, onClose, chapters, onShowChapter }) {
  const progressMap = { ch1: 57, ch2: 20, ch3: 5 };
  const arcMap = { ch1: 'Self-Doubt', ch2: 'Recognition', ch3: 'Emergence' };

  return (
    <div className={`pnos-modal-overlay ${open ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pnos-modal">
        <div className="pnos-modal-header">
          <div className="pnos-modal-title">Table of Contents · Before Lala</div>
          <button className="pnos-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="pnos-modal-body">
          <div className="pnos-modal-section">
            <div className="pnos-modal-section-title">Book 1 · Season 1</div>
            {chapters.map(ch => (
              <div key={ch.id} className="toc-full-row" onClick={() => onShowChapter(ch.id)}>
                <span className="tfc-num">{ch.num}</span>
                <span className="tfc-title">{ch.title}</span>
                <div className="tfc-bar"><div className="tfc-bar-fill" style={{ width: `${progressMap[ch.id] || 0}%` }} /></div>
                <span className="tfc-arc">{arcMap[ch.id] || '—'}</span>
              </div>
            ))}
            <div className="toc-full-row" style={{ opacity: 0.3, pointerEvents: 'none' }}>
              <span className="tfc-num">04</span>
              <span className="tfc-title" style={{ fontStyle: 'italic', color: 'var(--ink-muted)' }}>[ Not yet compiled ]</span>
              <div className="tfc-bar"><div className="tfc-bar-fill" style={{ width: '0%' }} /></div>
              <span className="tfc-arc">—</span>
            </div>
          </div>
          <div className="pnos-modal-section" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
            <div className="pnos-modal-section-title">Legend</div>
            <div className="legend-row">
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--pending)' }} />Pending lines</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--approved)' }} />Approved</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--edited)' }} />Edited by you</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--memory)' }} />Memory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
