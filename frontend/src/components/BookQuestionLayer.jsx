/**
 * BookQuestionLayer.jsx
 * frontend/src/components/BookQuestionLayer.jsx
 *
 * THE BOOK QUESTION — anchors every chapter to the whole.
 * Displays the question persistently, asks per-chapter direction,
 * and sends the question to every AI route.
 */

import { useState } from 'react';

// ── PER-BOOK QUESTION REGISTRY ────────────────────────────────────────────

export const BOOK_QUESTIONS = {
  'before_lala': {
    question:     'Am I delusional for wanting more than what I\'ve already built?',
    answer_shape: 'No. The wanting is the proof. The building is the answer.',
    opens_with:   'A woman who already has something real, reaching for something that doesn\'t exist yet.',
    closes_with:  'The same woman, who has built that thing — and understands the reaching was never delusional. It was the method.',
    what_it_asks_of_the_reader: 'Hold both things at once: everything she already has, and everything she still wants. Don\'t collapse either one.',
  },
};

export function getBookQuestion(book) {
  if (!book) return BOOK_QUESTIONS.before_lala;
  const key = book.character?.toLowerCase().replace(/\s+/g, '_') || 'before_lala';
  return BOOK_QUESTIONS[key] || BOOK_QUESTIONS.before_lala;
}

/** Returns the question context string for AI prompt payloads */
export function getBookQuestionContext(book, chapterDirection = null) {
  const bq = getBookQuestion(book);
  const directionNote = chapterDirection === 'toward'
    ? 'This chapter moves TOWARD the answer — the reader should feel something clarifying, even if painful.'
    : chapterDirection === 'away'
    ? 'This chapter moves AWAY from the answer — the reader should feel the distance between who she is and what the book will prove. This is necessary friction, not failure.'
    : chapterDirection === 'holding'
    ? 'This chapter HOLDS the tension — neither advancing nor retreating. The reader sits with the question.'
    : 'Direction not set — let the chapter find its own relationship to the question.';

  return `THE BOOK'S CENTRAL QUESTION:
"${bq.question}"

What the book opens with: ${bq.opens_with}
What the book closes with: ${bq.closes_with}

THIS CHAPTER'S RELATIONSHIP TO THE QUESTION:
${directionNote}

Every line of this chapter exists in relation to that question.
It doesn't need to mention it. It needs to earn it.`;
}

// ── COMPONENT ─────────────────────────────────────────────────────────────

const DIRECTIONS = [
  { id: 'toward',  label: 'Toward',  color: '#4A7C59', note: 'Something clarifies. Even if painfully.' },
  { id: 'holding', label: 'Holding', color: '#C9A84C', note: 'The tension sits. Neither advancing nor retreating.' },
  { id: 'away',    label: 'Away',    color: '#B85C38', note: 'The distance widens. Necessary friction.' },
];

export default function BookQuestionLayer({ book, chapter, onDirectionChange }) {
  const [expanded, setExpanded] = useState(false);
  const bq = getBookQuestion(book);
  const currentDir = chapter?.question_direction || null;
  const activeDir = DIRECTIONS.find(d => d.id === currentDir);

  return (
    <div style={st.panel}>
      <div style={st.header} onClick={() => setExpanded(!expanded)}>
        <div style={st.headerLeft}>
          <div style={st.eyebrow}>THE BOOK'S QUESTION</div>
          <div style={st.question}>"{bq.question}"</div>
        </div>
        <div style={st.right}>
          {activeDir && (
            <div style={{ ...st.dirPill, color: activeDir.color, borderColor: `${activeDir.color}40`, background: `${activeDir.color}0f` }}>
              {activeDir.label}
            </div>
          )}
          <div style={st.caret}>{expanded ? '▲' : '▼'}</div>
        </div>
      </div>

      {expanded && (
        <div style={st.body}>
          <div style={st.subRow}>
            <div style={st.sub}>
              <span style={st.subLabel}>OPENS: </span>{bq.opens_with}
            </div>
            <div style={st.sub}>
              <span style={st.subLabel}>CLOSES: </span>{bq.closes_with}
            </div>
          </div>

          <div style={st.dirSection}>
            <div style={st.dirLabel}>THIS CHAPTER MOVES —</div>
            <div style={st.dirRow}>
              {DIRECTIONS.map(d => (
                <button
                  key={d.id}
                  style={{
                    ...st.dirBtn,
                    borderColor:  currentDir === d.id ? d.color : 'rgba(30,25,20,0.1)',
                    color:        currentDir === d.id ? d.color : 'rgba(30,25,20,0.35)',
                    background:   currentDir === d.id ? `${d.color}0f` : 'white',
                  }}
                  onClick={() => onDirectionChange?.(currentDir === d.id ? null : d.id)}
                >
                  <div style={st.dirBtnName}>{d.label}</div>
                  <div style={st.dirBtnNote}>{d.note}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const st = {
  panel: {
    border: '1px solid rgba(201,168,76,0.25)',
    borderRadius: 3, background: 'rgba(255,253,245,0.7)',
    overflow: 'hidden', marginBottom: 10,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '10px 14px', cursor: 'pointer', gap: 12,
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  eyebrow: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    letterSpacing: '0.2em', color: '#C9A84C',
  },
  question: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 13.5, fontStyle: 'italic',
    color: 'rgba(30,25,20,0.8)', lineHeight: 1.5,
  },
  right: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  dirPill: {
    border: '1px solid', borderRadius: 20,
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.08em', padding: '2px 8px',
  },
  caret: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    color: 'rgba(30,25,20,0.2)',
  },
  body: {
    borderTop: '1px solid rgba(201,168,76,0.12)',
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12,
    background: 'rgba(255,253,245,0.4)',
  },
  subRow: { display: 'flex', flexDirection: 'column', gap: 5 },
  sub: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(30,25,20,0.45)', letterSpacing: '0.03em', lineHeight: 1.6,
  },
  subLabel: {
    color: 'rgba(30,25,20,0.22)', letterSpacing: '0.12em', fontSize: 7,
  },
  dirSection: { display: 'flex', flexDirection: 'column', gap: 7 },
  dirLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.15em', color: 'rgba(30,25,20,0.3)',
  },
  dirRow: { display: 'flex', gap: 6 },
  dirBtn: {
    flex: 1, border: '1px solid', borderRadius: 2,
    padding: '8px 10px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 3,
    transition: 'all 0.12s', textAlign: 'left',
  },
  dirBtnName: {
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    fontWeight: 600, letterSpacing: '0.08em',
  },
  dirBtnNote: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 10.5, fontStyle: 'italic',
    color: 'rgba(30,25,20,0.4)', lineHeight: 1.4,
  },
};
