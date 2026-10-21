/**
 * ExportPanel — the book side check, B1 (2026-10-20): chapters whose words are
 * not yet approved are named before export, never silently left out.
 */
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../services/api';
import ExportPanel from './ExportPanel';

const meta = (extra) => ({
  data: {
    title: 'Before Lala', character: 'JustAWoman', word_count: 3, chapter_count: 1, line_count: 1,
    reading_minutes: 1, chapters: [{ title: 'Approved', word_count: 3, line_count: 1 }],
    skipped_chapters: [], not_approved_count: 0, ...extra,
  },
});

describe('ExportPanel not-approved note', () => {
  beforeEach(() => { cleanup(); api.get.mockReset(); });

  test('names how many chapters are left out and which', async () => {
    api.get.mockResolvedValue(meta({
      not_approved_count: 2,
      skipped_chapters: [
        { title: 'Drafted only', reason: 'not_approved' },
        { title: 'Pending line', reason: 'not_approved' },
        { title: 'Empty', reason: 'empty' },
      ],
    }));
    render(<ExportPanel bookId="b1" bookTitle="Before Lala" />);
    const note = await screen.findByTestId('export-not-approved');
    expect(note.textContent).toContain('2 chapters are not in the export yet: approve their lines in Review.');
    expect(note.textContent).toContain('Drafted only · Pending line');
    expect(note.textContent).not.toContain('Empty');
  });

  test('one chapter reads in the singular', async () => {
    api.get.mockResolvedValue(meta({ not_approved_count: 1, skipped_chapters: [{ title: 'Drafted only', reason: 'not_approved' }] }));
    render(<ExportPanel bookId="b1" bookTitle="Before Lala" />);
    const note = await screen.findByTestId('export-not-approved');
    expect(note.textContent).toContain('1 chapter is not in the export yet: approve its lines in Review.');
  });

  test('no note when every chapter is in', async () => {
    api.get.mockResolvedValue(meta());
    render(<ExportPanel bookId="b1" bookTitle="Before Lala" />);
    await screen.findByText('Approved');
    expect(screen.queryByTestId('export-not-approved')).toBeNull();
  });
});
