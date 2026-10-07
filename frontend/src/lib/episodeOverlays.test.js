import { describe, test, expect } from 'vitest';
import { overlayRows, pieceBeat, beatLabel, previewPiece, pieceNeeded } from './episodeOverlays';

const PIECES = [
  { key: 'title_overlay', label: 'Title overlay', status: 'approved', image_url: 'https://x/t.png', beat: null, expected_beat: null },
  { key: 'framed_card', label: 'Full-screen framed card', status: 'outdated', image_url: 'https://x/c.png', beat: { number: 1, name: 'Opening' } },
  { key: 'invitation', label: 'Invitation', status: 'approved', image_url: 'https://x/i.png', beat: { number: 5, name: 'Reveal' } },
  { key: 'task_list', label: 'Task-list overlay', status: 'not_made', image_url: null, beat: null, expected_beat: { number: 9, name: 'Reminder/Deadline' } },
];

describe('episodeOverlays (Evoni\'s Episode mock, 2026-10-06)', () => {
  test('rows run by beat, unplaced last, each with its kind, text and action', () => {
    const rows = overlayRows(PIECES, [
      { asset_id: 'a-n', name: 'Lower Third', beat: { number: 2, name: 'Arrival' } },
      { asset_id: 'a-x', name: 'Not placed', beat: null },
    ]);
    expect(rows.map((r) => [r.key, r.beat?.number ?? null, r.kind, r.action, r.needed])).toEqual([
      ['framed_card', 1, 'Title card', 'Update', true],
      ['lib-a-n', 2, 'Show overlay', 'Change', false],
      ['invitation', 5, 'Document', 'Edit', false],
      ['task_list', 9, 'Document', 'Add', true],
      ['title_overlay', null, 'Title', 'Edit', false],
    ]);
    expect(rows.find((r) => r.key === 'task_list').text).toBe('Shopping list (not made yet)');
    expect(rows.find((r) => r.key === 'framed_card').text).toBe('Full-screen framed title card (outdated)');
    expect(rows.filter((r) => r.needed)).toHaveLength(2);
  });

  test('a piece\'s beat: placed, else where it goes, else none', () => {
    expect(pieceBeat(PIECES[2])).toEqual({ number: 5, name: 'Reveal', placed: true });
    expect(pieceBeat(PIECES[3])).toEqual({ number: 9, name: 'Reminder/Deadline', placed: false });
    expect(pieceBeat(PIECES[0])).toBeNull();
    expect(beatLabel(pieceBeat(PIECES[2]))).toBe('Beat 5');
    expect(beatLabel(pieceBeat(PIECES[3]))).toBe('Beat 9 · not placed yet');
    expect(beatLabel(null)).toBe('Not on a beat');
    expect(pieceNeeded(PIECES[0])).toBe(false);
    expect(pieceNeeded(PIECES[1])).toBe(true);
  });

  test('the preview: the chosen piece with an image, else the first with one', () => {
    expect(previewPiece(PIECES, 'invitation').key).toBe('invitation');
    expect(previewPiece(PIECES, 'task_list').key).toBe('title_overlay');
    expect(previewPiece(PIECES).key).toBe('title_overlay');
    expect(previewPiece([{ key: 'task_list', image_url: null }])).toBeNull();
  });
});
