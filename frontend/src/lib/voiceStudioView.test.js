// Voice Studio (B2): where the page shows each approval and take. The states
// themselves are the server's; this only places them.
import { describe, test, expect } from 'vitest';
import { arrange, STATE_INFO, formatMs } from './voiceStudioView';

const line = (beat, i, speaker, words, extra = {}) => ({
  beat_number: beat, line_index: i, occurrence: 1, speaker_key: speaker, speaker_written: speaker ? speaker[0].toUpperCase() + speaker.slice(1) : null,
  delivery_note: null, words, prime: false, context_hash: `ctx-${beat}-${i}`, spoken: Boolean(speaker), ...extra,
});
const approval = (id, beat, i, state, extra = {}) => ({
  approval_id: id, candidate_id: `c-${id}`, candidate_revision_id: `r-${id}`, beat_number: beat, line_index: i, state,
  playable: state === 'current', reason: null, reason_text: null, context_hash: `ctx-${beat}-${i}`,
  resolution: ['current', 'needs_review'].includes(state) ? { status: 'bound', line_index: i, candidates: [] } : null, ...extra,
});
const take = (id, beat, i, binding = { status: 'bound', line_index: i }) => ({
  id, association_id: beat == null ? null : `as-${id}`, beat_number: beat, line_index: i, revision_id: `rev-${id}`, in_ms: 0, out_ms: 2000, binding: beat == null ? null : binding,
});
const view = (approvals, takes, beats) => ({
  script_revision: 'sr1-x', script_seq: '4', can_edit: true,
  beats: beats || [{ beat_number: 1, duplicate: false, usable: true, lines: [
    line(1, 0, 'lala', 'Hi.'), line(1, 1, 'guest', 'Hello.'), line(1, 2, 'justawoman', 'Right.', { prime: true, spoken: false }), line(1, 3, null, 'She spins.'),
  ] }],
  takes, summary: { approvals },
});

describe('arrange', () => {
  test('each line shows the approval bound to it now, its takes and a status', () => {
    const a = arrange(view([approval('a1', 1, 0, 'current')], [take('t1', 1, 0), take('t2', 1, 1), take('t3', 1, 1)]));
    const [l0, l1, prime, action] = a.beats[0].lines;
    expect([l0.status, l1.status, prime.status, action.status]).toEqual(['approved', 'takes', 'prime', 'action']);
    expect(l0.approval.approval_id).toBe('a1');
    expect(l1.takes.map((t) => t.id)).toEqual(['t2', 't3']);
    expect(a.totals).toMatchObject({ spoken: 2, approved: 1 });
    expect(a.speakers).toEqual([{ key: 'lala', name: 'Lala' }, { key: 'guest', name: 'Guest' }]);
  });

  test('needs review and outdated sit on the line; moved, ambiguous, unbound and invalid wait in the beat\'s attention list', () => {
    const a = arrange(view([
      approval('r', 1, 0, 'needs_review'),
      approval('o', 1, 1, 'outdated_take'),
      approval('m', 1, 0, 'moved', { resolution: { status: 'moved', line_index: 1, candidates: [1] } }),
      approval('u', 1, 1, 'unbound', { reason: 'words_changed' }),
    ], []));
    const b = a.beats[0];
    expect(b.lines.map((l) => l.status)).toEqual(['review', 'outdated', 'prime', 'action']);
    expect(b.review.map((x) => x.approval_id)).toEqual(['r']);
    expect(b.attention.map((x) => x.approval_id)).toEqual(['m', 'u']);
    // A moved approval is never shown as the line's approval, at either place.
    expect(b.lines[1].approval.approval_id).toBe('o');
  });

  test('the approval a new approval replaces is the one in force at the line as stored (sent as expected_approval_id)', () => {
    const a = arrange(view([approval('m', 1, 1, 'moved', { resolution: { status: 'moved', line_index: 0, candidates: [0] } })], []));
    expect(a.beats[0].lines[1].inForce.approval_id).toBe('m');
    expect(a.beats[0].lines[1].approval).toBeNull();
    const none = arrange(view([approval('w', 1, 0, 'revoked')], []));
    expect(none.beats[0].lines[0].inForce).toBeNull();
    expect(none.beats[0].lines[0].lastClosed.approval_id).toBe('w');
    expect(none.beats[0].lines[0].status).toBe('none');
  });

  test('a take is shown at the line its tie is bound to now, never at whatever line sits at its old place', () => {
    const a = arrange(view([], [
      take('moved', 1, 0, { status: 'moved', line_index: 1, candidates: [1] }),
      take('shifted', 1, 0, { status: 'bound', line_index: 1 }),
      take('gone', 1, 1, { status: 'unbound', reason: 'line_removed' }),
      take('loose', null, null),
    ]));
    const b = a.beats[0];
    expect(b.lines[0].takes).toEqual([]);
    expect(b.lines[1].takes.map((t) => t.id)).toEqual(['shifted']);
    expect(b.driftedTakes.map((t) => t.id)).toEqual(['moved', 'gone']);
    expect(a.unassigned.map((t) => t.id)).toEqual(['loose']);
    expect(b.counts.attention).toBe(2);
  });

  test('every state has words, and only current is labelled as playing', () => {
    for (const s of ['current', 'needs_review', 'outdated_take', 'moved', 'ambiguous', 'unbound', 'invalid', 'revoked']) expect(STATE_INFO[s].label).toBeTruthy();
    expect(Object.entries(STATE_INFO).filter(([, v]) => /plays/.test(v.help)).map(([k]) => k)).toEqual(['current']);
    expect(formatMs(2400)).toBe('2.4 s');
    expect(formatMs(65200)).toBe('1:05.2');
  });
});
