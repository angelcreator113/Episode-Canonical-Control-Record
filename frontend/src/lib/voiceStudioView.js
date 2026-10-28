/**
 * Voice Studio (B2): how the page arranges what the server sent
 * (GET /api/v1/voice-studio/:episodeId/studio). Pure: no requests. Nothing
 * here judges a line or an approval; every state comes from the server
 * (voiceStudioService.summary, the one rule). This only decides where each
 * thing is shown and what it may offer.
 */

/** The words for each approval state, and what it offers. Only `current` plays. */
export const STATE_INFO = Object.freeze({
  current: { label: 'Approved', tone: 'ok', help: 'This take plays for the line.' },
  needs_review: { label: 'Needs review', tone: 'warn', help: 'The script was saved since this was approved. Check the take still fits, then re-confirm it.' },
  outdated_take: { label: 'Outdated', tone: 'warn', help: 'The take was re-trimmed or re-levelled after it was approved. Approve the new version.' },
  moved: { label: 'Moved', tone: 'warn', help: 'The line moved within the beat. Confirm the take is still for it.' },
  ambiguous: { label: 'Ambiguous', tone: 'warn', help: 'The beat has identical lines and the take could be either. Pick the line.' },
  unbound: { label: 'Unbound', tone: 'bad', help: 'The line this take was approved for is gone or changed. Approve a take for the line as it is now.' },
  invalid: { label: 'Invalid', tone: 'bad', help: 'This approval can never play again. Approve a take for the line.' },
  revoked: { label: 'Withdrawn', tone: 'muted', help: 'The approval was withdrawn. Approve a take to use one.' },
});

// States that still hold the line in the database (B1's "in force"): one of
// them at a line is the approval a new approval there replaces, so the page
// sends it as expected_approval_id.
const IN_FORCE = new Set(['current', 'needs_review', 'outdated_take', 'moved', 'ambiguous', 'unbound']);
// States shown on the line itself (bound to it now).
const ON_LINE = new Set(['current', 'needs_review', 'outdated_take']);
// States that wait for a person in the beat's "Needs attention" list.
const ATTENTION = new Set(['moved', 'ambiguous', 'unbound', 'invalid']);

export const lineKey = (beat, index) => `${beat}:${index}`;

/** Where the approval sits now: the line it is bound to, else the line it was approved at. */
const placeOf = (a) => (a.resolution && a.resolution.status === 'bound' && Number.isInteger(a.resolution.line_index)
  ? a.resolution.line_index : a.line_index);

/**
 * The page's arrangement of a view:
 * { beats: [{ ...beat, lines: [line + { key, approval, inForce, lastClosed,
 *   takes, status }], attention: [approval], review: [approval],
 *   driftedTakes: [take], counts }],
 *   unassigned: [take], totals, speakers }.
 * line.status: 'approved' | 'review' | 'outdated' | 'takes' | 'none' | 'prime' | 'action'.
 */
export function arrange(view) {
  const approvals = view?.summary?.approvals || [];
  const takes = view?.takes || [];
  const byLine = new Map();
  // A take is shown at the line its tie is bound to now (the server's resolve); a take whose line
  // moved, is ambiguous or is gone waits in its beat's "Takes whose line changed" until a person re-ties it.
  const drifted = new Map();
  for (const t of takes) {
    if (t.association_id == null) continue;
    if (!t.binding || t.binding.status !== 'bound') {
      if (!drifted.has(t.beat_number)) drifted.set(t.beat_number, []);
      drifted.get(t.beat_number).push(t);
      continue;
    }
    const k = lineKey(t.beat_number, t.binding.line_index);
    if (!byLine.has(k)) byLine.set(k, []);
    byLine.get(k).push(t);
  }
  const unassigned = takes.filter((t) => t.association_id == null);
  const speakers = new Map();
  const totals = { spoken: 0, approved: 0, review: 0, attention: 0, outdated: 0 };

  const beats = (view?.beats || []).map((beat) => {
    const mine = approvals.filter((a) => a.beat_number === beat.beat_number);
    const lines = beat.lines.map((line) => {
      const key = lineKey(line.beat_number, line.line_index);
      const here = mine.filter((a) => placeOf(a) === line.line_index);
      const approval = here.find((a) => ON_LINE.has(a.state)) || null;
      const inForce = mine.find((a) => a.line_index === line.line_index && IN_FORCE.has(a.state)) || null;
      const lastClosed = approval ? null : (here.filter((a) => a.state === 'revoked').pop() || null);
      const lineTakes = byLine.get(key) || [];
      let status;
      if (line.prime) status = 'prime';
      else if (!line.spoken) status = 'action';
      else if (approval?.state === 'current') status = 'approved';
      else if (approval?.state === 'needs_review') status = 'review';
      else if (approval?.state === 'outdated_take') status = 'outdated';
      else status = lineTakes.length ? 'takes' : 'none';
      if (line.spoken) {
        totals.spoken += 1;
        if (status === 'approved') totals.approved += 1;
        if (status === 'review') totals.review += 1;
        if (status === 'outdated') totals.outdated += 1;
        const who = line.speaker_written || line.speaker_key;
        if (who) speakers.set(line.speaker_key, who);
      }
      return { ...line, key, approval, inForce, lastClosed, takes: lineTakes, status };
    });
    const attention = mine.filter((a) => ATTENTION.has(a.state));
    const review = mine.filter((a) => a.state === 'needs_review');
    const driftedTakes = drifted.get(beat.beat_number) || [];
    totals.attention += attention.length + driftedTakes.length;
    const counts = {
      spoken: lines.filter((l) => l.spoken).length,
      approved: lines.filter((l) => l.status === 'approved').length,
      review: review.length,
      attention: attention.length + driftedTakes.length + lines.filter((l) => l.status === 'outdated').length,
    };
    return { ...beat, lines, attention, review, driftedTakes, counts };
  });
  return { beats, unassigned, totals, speakers: [...speakers.entries()].map(([key, name]) => ({ key, name })) };
}

/** A take's playable range in seconds, and its length. */
export const takeRange = (t) => ({ from: (t.in_ms || 0) / 1000, to: (t.out_ms || 0) / 1000, ms: Math.max(0, (t.out_ms || 0) - (t.in_ms || 0)) });

/** "2.4 s", "1:05.2". */
export function formatMs(ms) {
  const s = Math.max(0, Number(ms) || 0) / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}
