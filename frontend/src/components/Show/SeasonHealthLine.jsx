/**
 * The Season page's health in one line, under the hero's chips (Evoni,
 * 2026-10-26, Season page round 3): a tone chip (On track, Needs attention,
 * Behind, or Complete for a finished season) and the plain counts after it,
 * "Part 1 is 6 of 8 ready · 2 goals behind · next release Sun, Nov 1". The
 * words and the tone rule are lib/seasonHealth's; nothing is loaded here.
 *
 * Props: health (seasonHealth's { tone, label, pieces }), nextStepSlot (the
 * AI mount point "What should I do next?": an empty spot after the line
 * until a later step fills it).
 */
import './SeasonHealthLine.css';

export default function SeasonHealthLine({ health, nextStepSlot = null }) {
  if (!health) return null;
  return (
    <div className="shl" data-testid="szn-health">
      <p className="shl-line">
        <span className={`shl-tone is-${health.tone}`} data-testid="szn-health-tone">{health.label}</span>
        {health.pieces.map((p) => (
          <span key={p.key} className="shl-piece" data-testid={`szn-health-${p.key}`}>
            <span className="shl-dot" aria-hidden="true">·</span>{p.text}
          </span>
        ))}
      </p>
      {/* AI mount point: "What should I do next?". Empty until a later step fills it. */}
      <div className="shl-ai-slot" data-slot="health-next-step" data-testid="szn-slot-next-step">{nextStepSlot}</div>
    </div>
  );
}
