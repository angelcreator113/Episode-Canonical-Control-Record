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

  test('nothing made: every piece not made, with the costs of making them', () => {
    const pieces = overlayPieces({
      title: { approved: false, card: null, offer: { offered: false }, overlay: null, overlay_offer: { offered: false } },
      invitation: null,
      event: { id: 'ev', show_id: 'sh', name: 'Velour Launch' },
      estimates: { invitation: est(0.08) },
    });
    // The AI task-list overlay is retired (Evoni, 2026-10-07); the shopping list took its place.
    expect(pieces.map((p) => [p.key, p.status])).toEqual([
      ['title_overlay', 'not_made'], ['framed_card', 'not_made'], ['invitation', 'not_made'],
      ['shopping_list_doc', 'not_made'], ['career_plan_doc', 'not_made'],
    ]);
    const [overlay, card, invitation] = pieces;
    expect(overlay.needs_title_approval).toBe(true);
    expect(overlay.cost.paid).toBeNull(); // the flourish is offered once the title is approved
    expect(overlay.cost.free).toMatch(/cost nothing/);
    expect(card.cost.paid).toBeNull();
    expect(invitation.cost.paid).toEqual({ action: 'Generate the invitation', estimate: est(0.08) });
    expect(invitation.expected_beat).toEqual({ number: 5, name: 'Reveal' });
    expect(invitation.event).toEqual({ id: 'ev', show_id: 'sh', name: 'Velour Launch' });
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
      invitation: { id: 'inv', url: 'https://x/inv.png' },
      event: { id: 'ev', show_id: 'sh', name: 'Gala' },
      placements: { inv: { label: 'Invitation — Beat 5: Reveal', properties: { beat_number: 5, beat_name: 'Reveal', anchor: 'beat' } } },
      estimates: { invitation: est(0.08) },
    });
    const [overlay, card, invitation] = pieces;
    expect(overlay).toMatchObject({ status: 'approved', image_url: 'https://x/ov.png', beat: null, needs_title_approval: false });
    expect(overlay.cost.paid).toEqual({ action: 'Decorative flourish', estimate: est(0.04) });
    expect(card).toMatchObject({ status: 'outdated', made_for: 'Old title' });
    expect(card.cost.paid).toEqual({ action: 'Redesign the card', estimate: est(0.04) });
    expect(invitation).toMatchObject({ status: 'approved', beat: { number: 5, name: 'Reveal', anchor: 'beat' } });
    expect(invitation.cost.paid.action).toBe('Regenerate the invitation');
  });

  test('no source event: the invitation has no paid action', () => {
    const [, , invitation] = overlayPieces({ title: {}, invitation: null, event: null });
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

// Evoni, 2026-10-07: "add the document overlays to the episode's list".
describe('documentPieces: the event\'s shopping list and career plan as pieces', () => {
  const { documentPieces } = require('../../../src/services/episodeOverlaysService');
  const event = (documents) => ({ id: 'ev', show_id: 'sh', name: 'Velour Launch', canon_consequences: { documents } });
  const overlay = { asset_id: 'a1', url: 'https://img/shop.png', version: 2 };

  test('none without an event; not made until drafted and approved', () => {
    expect(documentPieces(null)).toEqual([]);
    const [shop, plan] = documentPieces(event({}));
    expect([shop.key, shop.label, shop.status, shop.image_url]).toEqual(['shopping_list_doc', 'Shopping list', 'not_made', null]);
    expect([plan.key, plan.label, plan.status]).toEqual(['career_plan_doc', 'Career plan', 'not_made']);
    expect(shop.cost).toEqual({ free: 'Drawn when the document is approved; costs nothing.' });
    expect(shop.beat).toBeNull();
    expect(shop.event).toEqual({ id: 'ev', show_id: 'sh', name: 'Velour Launch' });
  });

  test('approved with its overlay drawn from that version; outdated once edited; canon_consequences may be a string', () => {
    const [shop] = documentPieces(event({ shopping_list: { status: 'approved', version: 2, overlay } }));
    expect(shop).toMatchObject({ status: 'approved', image_url: overlay.url, asset_id: 'a1', document: { type: 'shopping_list', status: 'approved', version: 2 } });
    const edited = { ...event({ shopping_list: { status: 'draft', version: 3, overlay } }) };
    edited.canon_consequences = JSON.stringify(edited.canon_consequences);
    const [again] = documentPieces(edited);
    expect(again).toMatchObject({ status: 'outdated', image_url: overlay.url });
  });
});
