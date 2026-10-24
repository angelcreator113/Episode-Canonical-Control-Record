import { describe, test, expect } from 'vitest';
import { overlayRows, previewPiece, pieceNeeded, DOCUMENT_KEYS } from './episodeOverlays';

const PIECES = [
  { key: 'title_overlay', label: 'Title overlay', status: 'approved', image_url: 'https://x/t.png', beat: null, expected_beat: null },
  { key: 'framed_card', label: 'Full-screen framed card', status: 'outdated', image_url: 'https://x/c.png', beat: { number: 1, name: 'Opening' } },
  { key: 'invitation', label: 'Invitation', status: 'approved', image_url: 'https://x/i.png', beat: { number: 5, name: 'Reveal' } },
  { key: 'offer_letter_doc', label: 'Offer letter', status: 'not_made', image_url: null, beat: null },
];

describe('episodeOverlays (Evoni\'s Episode mock, 2026-10-06)', () => {
  test('a row per piece, in order, with its kind, text and action; no beat (2026-10-07)', () => {
    const rows = overlayRows(PIECES);
    expect(rows.map((r) => [r.key, r.kind, r.action, r.needed])).toEqual([
      ['title_overlay', 'Title', 'Edit', false],
      ['framed_card', 'Title card', 'Update', true],
      ['invitation', 'Document', 'Edit', false],
      ['offer_letter_doc', 'Document', 'Add', true],
    ]);
    expect(rows.every((r) => !('beat' in r))).toBe(true);
    expect(rows.find((r) => r.key === 'offer_letter_doc').text).toBe('Offer letter (not made yet)');
    expect(rows.find((r) => r.key === 'framed_card').text).toBe('Full-screen framed title card (outdated)');
    expect(pieceNeeded(PIECES[0])).toBe(false);
    expect(pieceNeeded(PIECES[1])).toBe(true);
  });

  test('the event\'s documents are rows too, as Document (2026-10-07)', () => {
    const rows = overlayRows([
      { key: 'shopping_list_doc', label: 'Shopping list', status: 'approved', image_url: 'https://x/s.png' },
      { key: 'offer_letter_doc', label: 'Offer letter', status: 'outdated', image_url: 'https://x/c.png' },
    ]);
    expect(rows.map((r) => [r.key, r.kind, r.text, r.action, r.needed])).toEqual([
      ['shopping_list_doc', 'Document', 'Shopping list', 'Edit', false],
      ['offer_letter_doc', 'Document', 'Offer letter (outdated)', 'Update', true],
    ]);
    expect(DOCUMENT_KEYS).toEqual(['invitation', 'shopping_list_doc', 'offer_letter_doc']);
  });

  test('the preview: the chosen piece with an image, else the first with one', () => {
    expect(previewPiece(PIECES, 'invitation').key).toBe('invitation');
    expect(previewPiece(PIECES, 'offer_letter_doc').key).toBe('title_overlay');
    expect(previewPiece(PIECES).key).toBe('title_overlay');
    expect(previewPiece([{ key: 'offer_letter_doc', image_url: null }])).toBeNull();
  });
});
