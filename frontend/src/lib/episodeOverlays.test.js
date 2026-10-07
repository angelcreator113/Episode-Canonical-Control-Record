import { describe, test, expect } from 'vitest';
import { overlayRows, previewPiece, pieceNeeded } from './episodeOverlays';

const PIECES = [
  { key: 'title_overlay', label: 'Title overlay', status: 'approved', image_url: 'https://x/t.png', beat: null, expected_beat: null },
  { key: 'framed_card', label: 'Full-screen framed card', status: 'outdated', image_url: 'https://x/c.png', beat: { number: 1, name: 'Opening' } },
  { key: 'invitation', label: 'Invitation', status: 'approved', image_url: 'https://x/i.png', beat: { number: 5, name: 'Reveal' } },
  { key: 'task_list', label: 'Task-list overlay', status: 'not_made', image_url: null, beat: null, expected_beat: { number: 9, name: 'Reminder/Deadline' } },
];

describe('episodeOverlays (Evoni\'s Episode mock, 2026-10-06)', () => {
  test('a row per piece, in order, with its kind, text and action; no beat (2026-10-07)', () => {
    const rows = overlayRows(PIECES);
    expect(rows.map((r) => [r.key, r.kind, r.action, r.needed])).toEqual([
      ['title_overlay', 'Title', 'Edit', false],
      ['framed_card', 'Title card', 'Update', true],
      ['invitation', 'Document', 'Edit', false],
      ['task_list', 'Document', 'Add', true],
    ]);
    expect(rows.every((r) => !('beat' in r))).toBe(true);
    expect(rows.find((r) => r.key === 'task_list').text).toBe('Task list (not made yet)');
    expect(rows.find((r) => r.key === 'framed_card').text).toBe('Full-screen framed title card (outdated)');
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
