/**
 * Season Plan › Season twists › the season line (Evoni, 2026-10-23): the
 * season's slots across, each twist drawn from its plant slot to its payoff
 * slot, with what is wrong beside it (services/seasonTwists checkTwists: a
 * payoff before its plant, a payoff with no plant, an episode already
 * written that has not planted or paid off its twist). A twist with no
 * payoff yet runs open to the season's end. At phone width each twist is a
 * line of text instead ("E2 → E6"). Read-only.
 *
 * Props: slots, twists, warnings (GET /world/:showId/season/twists).
 */
import { AlertTriangle } from 'lucide-react';
import './SeasonTwistLine.css';

/** Where a twist sits on the line: { from, to, kind } by slot index, or null when neither end is in the season. */
export function twistSpan(twist, indexOf, last) {
  const p = twist.plant ? indexOf.get(twist.plant.id) : undefined;
  const q = twist.payoff ? indexOf.get(twist.payoff.id) : undefined;
  if (p !== undefined && q !== undefined) {
    return q > p ? { from: p, to: q, kind: 'span' } : { from: q, to: p, kind: 'backwards' };
  }
  if (p !== undefined) return { from: p, to: last, kind: 'open' };
  if (q !== undefined) return { from: q, to: q, kind: 'orphan' };
  return null;
}

const ends = (t) => `${t.plant ? `E${t.plant.slot_number}` : 'no plant'} → ${t.payoff ? `E${t.payoff.slot_number}` : 'not chosen'}`;

export default function SeasonTwistLine({ slots = [], twists = [], warnings = [] }) {
  if (!slots.length || !twists.length) return null;
  const indexOf = new Map(slots.map((s, i) => [s.id, i]));
  const last = slots.length - 1;
  const cols = { '--stl-cols': slots.length };
  const live = twists.filter((t) => t.status !== 'dropped');
  const shown = new Set(live.map((t) => t.id));
  const notes = warnings.filter((w) => shown.has(w.twist_id));

  return (
    <div className="stl" data-testid="stw-line">
      <div className="stl-chart">
        <div className="stl-row stl-axis" aria-hidden="true">
          <span className="stl-name" />
          <span className="stl-track" style={cols}>
            {slots.map((s) => (
              <span key={s.id} className={`stl-tick${s.written ? ' is-written' : ''}`} title={s.label}>{s.slot_number}</span>
            ))}
          </span>
        </div>
        <ul className="stl-rows" aria-label="Season line">
          {live.map((t) => {
            const span = twistSpan(t, indexOf, last);
            const warned = notes.some((w) => w.twist_id === t.id);
            return (
              <li key={t.id} className={`stl-row${warned ? ' is-warned' : ''}`} data-testid={`stw-line-${t.id}`}>
                <span className="stl-name">{t.title}</span>
                <span className="stl-ends" data-testid={`stw-line-${t.id}-ends`}>{ends(t)}</span>
                <span className="stl-track" style={cols} aria-hidden="true">
                  {span && (
                    <span
                      className={`stl-bar is-${span.kind}`}
                      data-kind={span.kind}
                      style={{ gridColumn: `${span.from + 1} / ${span.to + 2}`, '--stl-n': span.to - span.from + 1 }}
                    >
                      {span.kind !== 'orphan' && <span className={`stl-dot is-plant${span.kind === 'backwards' ? ' is-end' : ''}`} />}
                      {(span.kind === 'span' || span.kind === 'backwards' || span.kind === 'orphan') && <span className={`stl-dot is-payoff${span.kind === 'backwards' ? ' is-start' : ''}`} />}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="stl-key"><span className="stl-dot is-plant" /> planted · <span className="stl-dot is-payoff" /> paid off · <span className="stl-tick-key">N</span> episode already written</p>
      </div>
      <div className="stl-side" aria-label="What to fix">
        {notes.length ? (
          <ul className="stl-warns">
            {notes.map((w) => (
              <li key={`${w.twist_id}-${w.text}`} className="stl-warn" data-testid="stw-line-warning">
                <AlertTriangle size={13} aria-hidden="true" />
                <span>{w.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="stl-ok" data-testid="stw-line-ok">Every twist is planted before it pays off.</p>
        )}
      </div>
    </div>
  );
}
