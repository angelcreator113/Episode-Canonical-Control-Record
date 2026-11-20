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
 *
 * `show` says which part is drawn (Evoni, 2026-11-20: the counts moved to the
 * Overview, the tone stays on the hero): 'tone' is the chip alone, on the
 * hero's shade; 'details' is the counts and the AI mount point, on the
 * Overview's light ground, without the release line (the Next release card
 * beside it says that); 'all' is the whole line, as before.
 */
import './SeasonHealthLine.css';

export default function SeasonHealthLine({ health, nextStepSlot = null, show = 'all' }) {
  if (!health) return null;
  if (show === 'details') {
    const pieces = health.pieces.filter((p) => p.key !== 'release');
    if (!pieces.length && !nextStepSlot) return null;
    return (
      <section className="shl is-details" data-testid="szn-health-details" aria-label="Season health">
        {pieces.length > 0 && (
          <p className="shl-line">
            <span className="shl-heading">Season health</span>
            {pieces.map((p) => (
              <span key={p.key} className="shl-piece" data-testid={`szn-health-${p.key}`}>
                {p.text}
              </span>
            ))}
          </p>
        )}
        <div className="shl-ai-slot" data-slot="health-next-step" data-testid="szn-slot-next-step">{nextStepSlot}</div>
      </section>
    );
  }
  return (
    <div className="shl" data-testid="szn-health">
      <p className="shl-line">
        <span className={`shl-tone is-${health.tone}`} data-testid="szn-health-tone">{health.label}</span>
        {show === 'all' && health.pieces.map((p) => (
          <span key={p.key} className="shl-piece" data-testid={`szn-health-${p.key}`}>
            {p.text}
          </span>
        ))}
      </p>
      {/* AI mount point: "What should I do next?". Empty until a later step fills it. */}
      {show === 'all' && <div className="shl-ai-slot" data-slot="health-next-step" data-testid="szn-slot-next-step">{nextStepSlot}</div>}
    </div>
  );
}
