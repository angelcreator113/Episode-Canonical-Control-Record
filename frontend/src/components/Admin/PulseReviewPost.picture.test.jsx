/**
 * Approving a draft makes its picture from the poster's camera roll
 * (services/postPictures; Evoni, 2026-10-19): Review says so before she
 * approves, with how many pictures and about what they cost.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import { PostCard, PicturePlan } from './PulseReviewPost';

const DRAFT = { id: 'p1', status: 'draft', content_text: 'Market day', poster_handle: 'slowsift', poster_display_name: 'Maren' };
const card = (post) => render(<MemoryRouter><PostCard post={post} onChange={() => {}} /></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});

describe('the picture a draft gets on approval', () => {
  test('one picture, about what it costs', () => {
    card({ ...DRAFT, picture_plan: { count: 1, estimate_usd: 0.2 } });
    expect(screen.getByTestId('prv-picture-plan').textContent)
      .toBe('Approving makes its picture from their camera roll (about $0.20), unless a photo of theirs already fits.');
  });

  test('a carousel: three', () => {
    render(<PicturePlan plan={{ count: 3, estimate_usd: 0.6 }} />);
    expect(screen.getByTestId('prv-picture-plan').textContent).toMatch(/its 3 pictures .*about \$0\.60/);
  });

  test('a words-only post, or one that has its picture: nothing said', () => {
    card(DRAFT);
    expect(screen.queryByTestId('prv-picture-plan')).toBeNull();
  });
});
