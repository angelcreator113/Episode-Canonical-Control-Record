// Her learned reading pace on the teleprompter (Evoni, 2026-10-28;
// hooks/useReadingPace, lib/learnedPace): under each beat's heading, the
// estimate against what her takes of it really took. Styles in
// pages/Teleprompter.css.
import { beatClock } from '../../lib/learnedPace';

/** "estimated 1:20 · your takes 1:05", or nothing while no take has timed the beat. */
export function BeatPace({ number, estimate, takes = null }) {
  if (takes == null || !(estimate >= 0)) return null;
  return (
    <p className="stp-beat-pace" data-testid={`stp-beat-pace-${number}`}>
      estimated {beatClock(estimate)} · your takes {beatClock(takes)}
    </p>
  );
}

export default BeatPace;
