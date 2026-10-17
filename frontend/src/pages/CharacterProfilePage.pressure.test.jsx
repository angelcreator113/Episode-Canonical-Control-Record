/**
 * Pressure test on the character page (the spec's #6; Evoni, 2026-10-17):
 * the hard questions, each answered from their own file, hardest first,
 * with what holds, what is a gap and what contradicts, and how to fix it.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));
vi.mock('../components/CharacterDepthPanel', () => ({ default: () => null }));

import api from '../services/api';
import { PressureTest } from './CharacterProfilePage';

const RESULT = {
  success: true,
  verdict: 'fails',
  summary: { answers: 1, gaps: 1, contradictions: 1 },
  questions: [
    { question: 'Why does a Type 3 want to quit?', about: 'type', verdict: 'contradiction', answer: 'Her forbidden want reads as a Type 9.', cites: ['TYPOLOGY SEED', 'INNER LIFE want architecture'], fix: 'Tie quitting to the fear of failing.' },
    { question: 'What car does she drive?', about: 'possessions', verdict: 'gap', answer: 'Nothing says.', cites: [], fix: 'Add what she owns to her facts.' },
    { question: 'How does she afford the studio?', about: 'money', verdict: 'answers', answer: 'It is rented.', cites: ['BEHIND THE MASK'], fix: null },
  ],
};

describe('PressureTest', () => {
  beforeEach(() => { api.post.mockReset(); });

  test('runs on request and lists each question with its verdict, where it came from and how to fix it', async () => {
    api.post.mockResolvedValue({ data: RESULT });
    render(<PressureTest characterId="c1" />);
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Pressure test: ask them the hard questions'));
    expect((await screen.findByTestId('ch-pressure-summary')).textContent)
      .toBe('They don’t hold up yet: parts of their file disagree. 1 hold, 1 gap, 1 contradiction.');
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/pressure-test');
    const items = screen.getAllByTestId('ch-pressure-item');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText('Contradiction')).toBeTruthy();
    expect(within(items[0]).getByText('From: TYPOLOGY SEED · INNER LIFE want architecture')).toBeTruthy();
    expect(within(items[0]).getByText('To fix: Tie quitting to the fear of failing.')).toBeTruthy();
    expect(within(items[1]).getByText('Gap')).toBeTruthy();
    expect(within(items[2]).getByText('Holds')).toBeTruthy();
    expect(within(items[2]).queryByText(/To fix/)).toBeNull();
    expect(screen.getByText('Test again')).toBeTruthy();
  });

  test('a character that holds says so', async () => {
    api.post.mockResolvedValue({ data: { ...RESULT, verdict: 'holds', summary: { answers: 1, gaps: 0, contradictions: 0 }, questions: [RESULT.questions[2]] } });
    render(<PressureTest characterId="c1" />);
    fireEvent.click(screen.getByText('Pressure test: ask them the hard questions'));
    expect((await screen.findByTestId('ch-pressure-summary')).textContent).toMatch(/^They hold up: the file answers every question\. 1 hold, 0 gaps, 0 contradictions\./);
  });

  test('an error says why', async () => {
    api.post.mockRejectedValue({ response: { status: 409, data: { error: 'There is too little written about them to test yet.' } } });
    render(<PressureTest characterId="c1" />);
    fireEvent.click(screen.getByText('Pressure test: ask them the hard questions'));
    expect((await screen.findByRole('alert')).textContent).toBe('There is too little written about them to test yet.');
  });
});
