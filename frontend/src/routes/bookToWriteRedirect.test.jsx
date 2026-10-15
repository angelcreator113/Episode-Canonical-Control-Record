/**
 * /book/:id opens the book's first chapter in Write Mode (2026-10-15).
 * GET /storyteller/books/:id answers { success, book } with the chapters
 * inside the book; the redirect read data.chapters, found none, and sent
 * every book to /storyteller (the show's Stories).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// A plain function, not vi.fn: vitest 0.34's spy keeps its own copy of a
// rejected promise, which nothing handles, and fails the test.
let mockAnswer;
const mockCalls = [];
vi.mock('../services/api', () => ({
  default: { get: (url) => { mockCalls.push(url); return mockAnswer(); } },
}));

import { BookToWriteRedirect } from './redirects';

function Where() {
  const { pathname } = useLocation();
  return <div data-testid="where">{pathname}</div>;
}

const renderAt = () => render(
  <MemoryRouter initialEntries={['/book/b1']}>
    <Routes>
      <Route path="/book/:id" element={<BookToWriteRedirect />} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => { mockCalls.length = 0; });

describe('BookToWriteRedirect', () => {
  test('opens the first chapter by order', async () => {
    mockAnswer = async () => ({ data: { success: true, book: { id: 'b1', chapters: [
      { id: 'c2', sort_order: 2 }, { id: 'c1', sort_order: 1 },
    ] } } });
    renderAt();
    expect((await screen.findByTestId('where')).textContent).toBe('/chapter/b1/c1');
    expect(mockCalls).toEqual(['/api/v1/storyteller/books/b1']);
  });

  test('a book with no chapter goes to the Universe', async () => {
    mockAnswer = async () => ({ data: { success: true, book: { id: 'b1', chapters: [] } } });
    renderAt();
    expect((await screen.findByTestId('where')).textContent).toBe('/universe');
  });

  test('a book that does not load goes to the Universe', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAnswer = async () => { throw new Error('404'); };
    renderAt();
    expect((await screen.findByTestId('where')).textContent).toBe('/universe');
  });
});
