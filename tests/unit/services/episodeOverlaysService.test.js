/**
 * P15 (Evoni, 2026-09-30): the Overlays tab's pieces, statuses, placed
 * beats and costs, and the banner's title chip (pure parts).
 */
const {
  pieceStatus, placedBeat, overlayPieces, titleChip, estimateInvitation, STATUSES,
} = require('../../../src/services/episodeOverlaysService');

const est = (usd) => ({ usd, priced: true, unit: 'image', units: 1, model: 'm' });

describe('episodeOverlaysService (P15)', () => {
  test('statuses are approved, outdated, not made', () => {
    expect(STATUSES).toEqual(['approved', 'outdated', 'not_made']);
    expect(pieceStatus(false, false)).toBe('not_made');
    expect(pieceStatus(false, true)).toBe('not_made');
    expect(pieceStatus(true, true)).toBe('outdated');
    expect(pieceStatus(true, false)).toBe('approved');
  });

  test('placedBeat reads the placement properties; null when not placed', () => {
    expect(placedBeat(null)).toBeNull();
    expect(placedBeat({ label: 'Invitation — Beat 5: Reveal', properties: { beat_number: '5', beat_name: 'Reveal', anchor: 'beat' } }))
      .toEqual({ number: 5, name: 'Reveal', anchor: 'beat', label: 'Invitation — Beat 5: Reveal' });
    expect(placedBeat({ scene_id: 's1', properties: {} })).toEqual({ number: null, name: null, anchor: 'scene', label: null });
  });

  test('nothing made: four pieces, all not made, with the costs of making them', () => {
    const pieces = overlayPieces({
      title: { approved: false, card: null, offer: { offered: false }, overlay: null, overlay_offer: { offered: false } },
      taskList: { task_count: 3, approved: false, overlay: null, offer: { offered: false } },
      invitation: null,
      event: { id: 'ev', show_id: 'sh', name: 'Velour Launch' },
      estimates: { invitation: est(0.08), taskList: est(0.08) },
    });
    expect(pieces.map((p) => [p.key, p.status])).toEqual([
      ['title_overlay', 'not_made'], ['framed_card', 'not_made'], ['invitation', 'not_made'], ['task_list', 'not_made'],
    ]);
    const [overlay, card, invitation, taskList] = pieces;
    expect(overlay.needs_title_approval).toBe(true);
    expect(overlay.cost.paid).toBeNull(); // the flourish is offered once the title is approved
    expect(overlay.cost.free).toMatch(/cost nothing/);
    expect(card.cost.paid).toBeNull();
    expect(invitation.cost.paid).toEqual({ action: 'Generate the invitation', estimate: est(0.08) });
    expect(invitation.expected_beat).toEqual({ number: 5, name: 'Reveal' });
    expect(invitation.event).toEqual({ id: 'ev', show_id: 'sh', name: 'Velour Launch' });
    expect(taskList.cost.paid).toEqual({ action: 'Design the overlay', estimate: est(0.08) });
    expect(taskList.expected_beat.number).toBe(9);
    expect(overlay.expected_beat).toEqual({ number: 1, name: 'Opening Ritual' });
    expect(card.expected_beat).toBeUndefined();
    expect(pieces.every((p) => p.beat === null)).toBe(true);
  });

  test('made pieces: preview, status, placed beat and the paid action', () => {
    const pieces = overlayPieces({
      title: {
        approved: true,
        card: { asset_id: 'card', designed_for: 'Old title', outdated: true, image_url: 'https://x/card.png' },
        offer: { offered: true, kind: 'redesign', requires_approval: false, estimate: est(0.04) },
        overlay: { asset_id: 'ov', designed_for: 'New title', outdated: false, image_url: 'https://x/ov.png' },
        overlay_offer: { offered: true, variants: [], flourish_estimate: est(0.04) },
      },
      taskList: {
        task_count: 2, approved: true,
        overlay: { asset_id: 'tl', outdated: false, image_url: 'https://x/tl.png', beat: { number: 9, name: 'Reminder/Deadline' } },
        offer: { offered: false },
      },
      invitation: { id: 'inv', url: 'https://x/inv.png' },
      event: { id: 'ev', show_id: 'sh', name: 'Gala' },
      placements: { inv: { label: 'Invitation — Beat 5: Reveal', properties: { beat_number: 5, beat_name: 'Reveal', anchor: 'beat' } } },
      estimates: { invitation: est(0.08), taskList: est(0.08) },
    });
    const [overlay, card, invitation, taskList] = pieces;
    expect(overlay).toMatchObject({ status: 'approved', image_url: 'https://x/ov.png', beat: null, needs_title_approval: false });
    expect(overlay.cost.paid).toEqual({ action: 'Decorative flourish', estimate: est(0.04) });
    expect(card).toMatchObject({ status: 'outdated', made_for: 'Old title' });
    expect(card.cost.paid).toEqual({ action: 'Redesign the card', estimate: est(0.04) });
    expect(invitation).toMatchObject({ status: 'approved', beat: { number: 5, name: 'Reveal', anchor: 'beat' } });
    expect(invitation.cost.paid.action).toBe('Regenerate the invitation');
    // The task list's beat falls back to its asset metadata when no placement row is read.
    expect(taskList).toMatchObject({ status: 'approved', beat: { number: 9, name: 'Reminder/Deadline' } });
    expect(taskList.cost.paid).toEqual({ action: 'Design the overlay', estimate: est(0.08) });
  });

  test('no source event: the invitation has no paid action', () => {
    const [, , invitation] = overlayPieces({ title: {}, taskList: null, invitation: null, event: null });
    expect(invitation.cost.paid).toBeNull();
    expect(invitation.event).toBeNull();
  });

  test('title chip: the overlay first, else the framed card, else not made', () => {
    const p = (overlay, card) => [{ key: 'title_overlay', status: overlay }, { key: 'framed_card', status: card }];
    expect(titleChip(p('approved', 'outdated'))).toEqual({ status: 'approved', piece: 'title_overlay' });
    expect(titleChip(p('outdated', 'approved'))).toEqual({ status: 'outdated', piece: 'title_overlay' });
    expect(titleChip(p('not_made', 'outdated'))).toEqual({ status: 'outdated', piece: 'framed_card' });
    expect(titleChip(p('not_made', 'not_made'))).toEqual({ status: 'not_made', piece: 'title_overlay' });
  });

  test('the invitation estimate is priced from the invitation image options', () => {
    const e = estimateInvitation();
    expect(e).toHaveProperty('usd');
    expect(e).toHaveProperty('priced');
  });
});
