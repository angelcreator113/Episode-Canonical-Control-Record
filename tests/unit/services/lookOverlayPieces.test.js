// ============================================================================
// The look's approved wardrobe pieces as overlays (Evoni, 2026-10-09: "The
// wardrobe pieces that's approved for the episode should also become
// overlays"; Task #2791). No database, no network.
// ============================================================================

const { lookOverlayPieces } = require('../../../src/services/episodeOverlaysService');

describe('lookOverlayPieces', () => {
  test('one overlay per piece: a script key from its name, its background-removed picture first', () => {
    expect(lookOverlayPieces([
      { id: 'w1', name: 'Sculpted Dress', clothing_category: 'dress', s3_url_processed: 'nobg.png', s3_url: 'orig.png', thumbnail_url: 't.png' },
      { id: 'w2', name: 'Gold Drops!', clothing_category: 'jewelry', s3_url: 'drops.png' },
      { id: 'w3', name: 'Gold Drops', clothing_category: 'jewelry', thumbnail_url: 'drops2.png' },
      { id: 'w4', name: null, clothing_category: null },
    ])).toEqual([
      { key: 'look_sculpted_dress', label: 'Sculpted Dress', category: 'dress', wardrobe_id: 'w1', image_url: 'nobg.png' },
      { key: 'look_gold_drops', label: 'Gold Drops!', category: 'jewelry', wardrobe_id: 'w2', image_url: 'drops.png' },
      { key: 'look_gold_drops_2', label: 'Gold Drops', category: 'jewelry', wardrobe_id: 'w3', image_url: 'drops2.png' },
      { key: 'look_piece', label: 'Wardrobe piece', category: null, wardrobe_id: 'w4', image_url: null },
    ]);
  });

  test('no pieces, no overlays', () => {
    expect(lookOverlayPieces()).toEqual([]);
  });
});
