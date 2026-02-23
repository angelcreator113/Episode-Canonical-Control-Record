/**
 * ChapterDraftGenerator.jsx
 * frontend/src/pages/ChapterDraftGenerator.jsx
 *
 * The co-writing feature.
 * Generates 70-85% of a chapter as pending lines.
 * Author reviews, edits, approves each one.
 *
 * Usage — place above the manuscript lines in StorytellerPage.jsx,
 * below ChapterBrief, only when chapter has a brief set:
 *
 *   import ChapterDraftGenerator from './ChapterDraftGenerator';
 *
 *   <ChapterDraftGenerator
 *     chapter={chapter}
 *     book={book}
 *     onDraftGenerated={(lines, notes) => {
 *       setChapters(prev => prev.map(c =>
 *         c.id === chapter.id
 *           ? { ...c, lines: [...(c.lines || []), ...lines] }
 *           : c
 *       ));
 *     }}
 *   />
 *
 * Only shows when:
 * - Chapter has a scene_goal or theme set (brief exists)
 * - Chapter has no pending ai_draft lines already
 */

import { useState } from 'react';

const MEMORIES_API = '/api/v1/memories';

export default function ChapterDraftGenerator({
  chapter,
  book,
  onDraftGenerated,
}) {
  const [step, setStep]           = useState('idle'); // idle | confirm | generating | done | error
  const [targetLines, setTargetLines] = useState(20);
  const [draftNotes, setDraftNotes]   = useState(null);
  const [count, setCount]             = useState(0);
  const [error, setError]             = useState(null);

  // Don't show if no brief
  const hasBrief = chapter?.scene_goal || chapter?.theme || chapter?.emotional_state_start;
  if (!hasBrief) return null;

  // Don't show if already has pending ai_draft lines
  const hasExistingDraft = (chapter?.lines || []).some(
    l => l.source_tags?.source_type === 'ai_draft' && l.status === 'pending'
  );
  if (hasExistingDraft) return null;

  const existingApproved = (chapter?.lines || []).filter(
    l => ['approved', 'edited'].includes(l.status)
  ).length;

  async function generate() {
    setStep('generating');
    setError(null);
    try {
      const res = await fetch(`${MEMORIES_API}/generate-chapter-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id:      book.id,
          chapter_id:   chapter.id,
          target_lines: targetLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDraftNotes(data.draft_notes);
      setCount(data.count);
      setStep('done');
      onDraftGenerated?.(data.lines, data.draft_notes);
    } catch (err) {
      setError(err.message);
      setStep('error');
    }
  }

  // IDLE STATE — the generate button
  if (step === 'idle') {
    return (
      <div style={s.shell}>
        <div style={s.briefSummary}>
          <div style={s.briefLeft}>
            <div style={s.briefIcon}>◆</div>
            <div>
              <div style={s.briefLabel}>CHAPTER BRIEF SET</div>
              <div style={s.briefDetail}>
                {chapter.scene_goal || chapter.theme || 'Scene context ready'}
              </div>
            </div>
          </div>
          <button
            style={s.generateBtn}
            onClick={() => setStep('confirm')}
            type='button'
          >
            ✦ Generate Draft
          </button>
        </div>
      </div>
    );
  }

  // CONFIRM STATE — review before generating
  if (step === 'confirm') {
    return (
      <div style={s.confirmShell}>
        <div style={s.confirmHeader}>
          <div style={s.confirmTitle}>Generate Chapter Draft</div>
          <div style={s.confirmSub}>
            Claude will read everything the system knows about this chapter and generate a draft.
            Every line lands as pending — you approve, edit, or reject each one.
          </div>
        </div>

        {/* What Claude will read */}
        <div style={s.contextList}>
          <div style={s.contextLabel}>CLAUDE WILL READ:</div>
          <ContextItem label='Universe context' detail='LalaVerse, era, series, north star' />
          <ContextItem label='Chapter brief' detail={`${chapter.theme || ''} ${chapter.scene_goal || ''}`.trim() || 'Set above'} />
          <ContextItem label='Character profiles' detail='Psychological depth from voice interviews' />
          <ContextItem label='Confirmed memories' detail='Beliefs and dynamics from approved lines' />
          <ContextItem label='Pain points' detail='Content creator struggles (invisible in text)' />
          {existingApproved > 0 && (
            <ContextItem label={`${existingApproved} existing lines`} detail='Will continue from where you left off' />
          )}
        </div>

        {/* Line count selector */}
        <div style={s.lineSelector}>
          <div style={s.lineSelectorLabel}>HOW MANY LINES:</div>
          <div style={s.lineOptions}>
            {[10, 15, 20, 25, 30].map(n => (
              <button
                key={n}
                style={{
                  ...s.lineOption,
                  background: targetLines === n ? 'rgba(201,168,76,0.15)' : 'transparent',
                  borderColor: targetLines === n ? 'rgba(201,168,76,0.5)' : 'rgba(30,25,20,0.1)',
                  color: targetLines === n ? '#8B6914' : 'rgba(30,25,20,0.4)',
                }}
                onClick={() => setTargetLines(n)}
                type='button'
              >
                {n}
              </button>
            ))}
          </div>
          <div style={s.lineHint}>
            {targetLines} lines = roughly {Math.round(targetLines * 35)} words
          </div>
        </div>

        <div style={s.confirmActions}>
          <button
            style={s.cancelBtn}
            onClick={() => setStep('idle')}
            type='button'
          >
            Cancel
          </button>
          <button
            style={s.confirmBtn}
            onClick={generate}
            type='button'
          >
            Generate {targetLines} lines →
          </button>
        </div>
      </div>
    );
  }

  // GENERATING STATE
  if (step === 'generating') {
    return (
      <div style={s.generatingShell}>
        <div style={s.generatingDots}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              ...s.dot,
              animationDelay: `${i * 0.25}s`,
            }} />
          ))}
        </div>
        <div style={s.generatingTitle}>
          Writing your chapter…
        </div>
        <div style={s.generatingSteps}>
          <div style={s.gStep}>Reading character profiles</div>
          <div style={s.gStep}>Finding confirmed memories</div>
          <div style={s.gStep}>Feeling the scene brief</div>
          <div style={s.gStep}>Writing in JustAWoman's voice</div>
        </div>
      </div>
    );
  }

  // DONE STATE
  if (step === 'done') {
    return (
      <div style={s.doneShell}>
        <div style={s.doneHeader}>
          <div style={s.doneIcon}>✓</div>
          <div>
            <div style={s.doneTitle}>{count} lines added as pending</div>
            <div style={s.doneSub}>Review each one. Approve what's true. Edit what's close. Reject what isn't you.</div>
          </div>
        </div>
        {draftNotes && (
          <div style={s.draftNotes}>
            <div style={s.draftNotesLabel}>CLAUDE'S DRAFT NOTES</div>
            <div style={s.draftNotesText}>{draftNotes}</div>
          </div>
        )}
      </div>
    );
  }

  // ERROR STATE
  if (step === 'error') {
    return (
      <div style={s.errorShell}>
        <div style={s.errorText}>{error || 'Draft generation failed. Try again.'}</div>
        <button
          style={s.retryBtn}
          onClick={() => setStep('idle')}
          type='button'
        >
          Try again
        </button>
      </div>
    );
  }

  return null;
}

function ContextItem({ label, detail }) {
  return (
    <div style={s.contextItem}>
      <span style={s.contextCheck}>✓</span>
      <div>
        <span style={s.contextItemLabel}>{label}</span>
        {detail && <span style={s.contextItemDetail}> — {detail}</span>}
      </div>
    </div>
  );
}

const s = {
  // Idle
  shell: {
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  briefSummary: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'rgba(201,168,76,0.04)',
    border: '1px solid rgba(201,168,76,0.15)',
    borderRadius: 3,
  },
  briefLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  briefIcon: {
    color: '#C9A84C',
    fontSize: 11,
    flexShrink: 0,
  },
  briefLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.14em',
    color: '#C9A84C',
    marginBottom: 2,
  },
  briefDetail: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(30,25,20,0.4)',
    letterSpacing: '0.04em',
    maxWidth: 340,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  generateBtn: {
    background: '#C9A84C',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.12em',
    color: '#14100c',
    fontWeight: 600,
    padding: '8px 16px',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity 0.12s',
  },
  // Confirm
  confirmShell: {
    background: '#faf9f7',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 3,
    padding: '20px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginBottom: 8,
  },
  confirmHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingBottom: 12,
    borderBottom: '1px solid rgba(201,168,76,0.1)',
  },
  confirmTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 18,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.88)',
  },
  confirmSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(30,25,20,0.4)',
    letterSpacing: '0.05em',
    lineHeight: 1.6,
  },
  contextList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  contextLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 7,
    letterSpacing: '0.18em',
    color: 'rgba(30,25,20,0.3)',
    marginBottom: 4,
  },
  contextItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  contextCheck: {
    color: '#4A7C59',
    fontSize: 10,
    flexShrink: 0,
    marginTop: 1,
  },
  contextItemLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(30,25,20,0.65)',
    letterSpacing: '0.04em',
  },
  contextItemDetail: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.04em',
  },
  lineSelector: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  lineSelectorLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 7,
    letterSpacing: '0.18em',
    color: 'rgba(30,25,20,0.3)',
  },
  lineOptions: {
    display: 'flex',
    gap: 6,
  },
  lineOption: {
    border: '1px solid',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.06em',
    padding: '5px 14px',
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  lineHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(30,25,20,0.25)',
    letterSpacing: '0.06em',
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 4,
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid rgba(30,25,20,0.12)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.08em',
    color: 'rgba(30,25,20,0.4)',
    padding: '8px 16px',
    cursor: 'pointer',
  },
  confirmBtn: {
    background: '#C9A84C',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.12em',
    color: '#14100c',
    fontWeight: 600,
    padding: '8px 20px',
    cursor: 'pointer',
  },
  // Generating
  generatingShell: {
    background: '#faf9f7',
    border: '1px solid rgba(201,168,76,0.15)',
    borderRadius: 3,
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  generatingDots: {
    display: 'flex',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#C9A84C',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
  generatingTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 18,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.75)',
  },
  generatingSteps: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  gStep: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(30,25,20,0.25)',
    letterSpacing: '0.08em',
  },
  // Done
  doneShell: {
    background: 'rgba(74,124,89,0.04)',
    border: '1px solid rgba(74,124,89,0.2)',
    borderRadius: 3,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 8,
  },
  doneHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  doneIcon: {
    color: '#4A7C59',
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
    marginTop: 2,
  },
  doneTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 16,
    fontStyle: 'italic',
    color: '#4A7C59',
    marginBottom: 4,
  },
  doneSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(30,25,20,0.4)',
    letterSpacing: '0.05em',
    lineHeight: 1.6,
  },
  draftNotes: {
    background: 'rgba(201,168,76,0.04)',
    border: '1px solid rgba(201,168,76,0.12)',
    borderRadius: 2,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  draftNotesLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 7,
    letterSpacing: '0.18em',
    color: '#C9A84C',
  },
  draftNotesText: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.65)',
    lineHeight: 1.65,
  },
  // Error
  errorShell: {
    background: 'rgba(184,92,56,0.04)',
    border: '1px solid rgba(184,92,56,0.2)',
    borderRadius: 3,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: '#B85C38',
    letterSpacing: '0.04em',
  },
  retryBtn: {
    background: 'none',
    border: '1px solid rgba(184,92,56,0.3)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.08em',
    color: '#B85C38',
    padding: '5px 12px',
    cursor: 'pointer',
    flexShrink: 0,
  },
};
