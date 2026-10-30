/**
 * Voice Studio's beat list (S1; Evoni's mockup, 2026-10-30): each beat
 * with its spoken-line count and what needs a person there, in words (not
 * colour alone). A list on a wide screen; a dropdown on a phone (the CSS
 * shows one or the other). Choosing a beat closes the open line.
 */
import { CheckCircle2, AlertTriangle, Circle } from 'lucide-react';

/** What a beat needs, in words: { tone, text }. */
export function beatNeeds(beat) {
  const { spoken, approved, review, attention } = beat.counts;
  const issues = review + attention;
  if (beat.duplicate) return { tone: 'bad', text: 'Beat number used twice' };
  if (issues > 0) return { tone: 'warn', text: `${issues} to check` };
  if (spoken > 0 && approved === spoken) return { tone: 'ok', text: 'All approved' };
  if (spoken === 0) return { tone: 'muted', text: 'No spoken lines' };
  return { tone: 'muted', text: `${approved}/${spoken} approved` };
}

const ICON = { ok: CheckCircle2, warn: AlertTriangle, bad: AlertTriangle, muted: Circle };

export default function BeatList({ beats, beat, onChoose }) {
  return (
    <nav className="vs-beatlist" aria-label="Beats">
      <label className="vs-beat-select">
        <span>Beat</span>
        <select value={beat ? String(beat.beat_number) : ''} onChange={(e) => onChoose(e.target.value)} data-testid="vs-beat-select">
          {beats.map((b) => {
            const needs = beatNeeds(b);
            return <option key={String(b.beat_number)} value={String(b.beat_number)}>{`Beat ${b.beat_number ?? '—'} · ${b.counts.spoken} lines · ${needs.text}`}</option>;
          })}
        </select>
      </label>
      <ul className="vs-beat-items">
        {beats.map((b) => {
          const needs = beatNeeds(b);
          const Icon = ICON[needs.tone];
          const on = b === beat;
          return (
            <li key={String(b.beat_number)}>
              <button type="button" aria-pressed={on} className={`vs-beatitem${on ? ' vs-beatitem--on' : ''}`}
                onClick={() => onChoose(String(b.beat_number))} data-testid={`vs-beat-${b.beat_number}`}>
                <span className="vs-beatitem-name">Beat {b.beat_number ?? '—'}</span>
                <span className="vs-beatitem-count">{b.counts.spoken} {b.counts.spoken === 1 ? 'line' : 'lines'}</span>
                <span className={`vs-beatitem-needs vs-beatitem-needs--${needs.tone}`}><Icon size={13} aria-hidden="true" /> {needs.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
