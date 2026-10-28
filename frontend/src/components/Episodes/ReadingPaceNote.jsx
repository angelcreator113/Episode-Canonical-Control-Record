// Her learned reading pace, and the switch back to the standard estimate
// (Evoni, 2026-10-28; hooks/useReadingPace). "Your pace: 172 words/min
// (from 2 takes) — timings use it", then "Use my pace" / "Use the standard
// 150". With too few takes, the plain line saying how to teach it.
// Styles: ReadingPaceNote.css (tone 'studio' on the Script tab, 'prompter'
// on the teleprompter's dark screen).
import { Gauge } from 'lucide-react';
import { WORDS_PER_MINUTE } from '../../lib/scriptRuntime';
import { NOT_ENOUGH } from '../../lib/learnedPace';
import './ReadingPaceNote.css';

export default function ReadingPaceNote({ reading, tone = 'studio', testid = 'reading-pace' }) {
  if (!reading) return null;
  const { pace, use, setUse, text } = reading;
  if (!pace?.confident) {
    return <p className={`rpn is-${tone}`} data-testid={testid}><Gauge size={14} aria-hidden="true" /> <span>{NOT_ENOUGH}</span></p>;
  }
  const mine = use !== 'standard';
  return (
    <div className={`rpn is-${tone}`} data-testid={testid}>
      <p className="rpn-text"><Gauge size={14} aria-hidden="true" /> <span data-testid={`${testid}-text`}>{text} — {mine ? 'timings use it' : `timings use the standard ${WORDS_PER_MINUTE}`}</span></p>
      <div className="rpn-switch" role="group" aria-label="Which reading pace the timings use">
        <button type="button" className={`rpn-opt${mine ? ' is-on' : ''}`} aria-pressed={mine} data-testid={`${testid}-mine`} onClick={() => setUse('mine')}>Use my pace</button>
        <button type="button" className={`rpn-opt${mine ? '' : ' is-on'}`} aria-pressed={!mine} data-testid={`${testid}-standard`} onClick={() => setUse('standard')}>Use the standard {WORDS_PER_MINUTE}</button>
      </div>
    </div>
  );
}
