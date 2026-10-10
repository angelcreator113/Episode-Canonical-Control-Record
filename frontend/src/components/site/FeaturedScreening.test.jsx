/**
 * Featured Production's fallback (spec Part 1 section 5, amended by #2818;
 * Task #2810): with no published video it says "First look coming soon",
 * "Watch Featured Video" is disabled and labelled soon, nothing is fetched
 * or loaded from YouTube, and a half-filled config never looks published.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FeaturedScreening, { isPublishedVideo } from './FeaturedScreening';
import { FEATURED } from './siteContent';

let fetchSpy;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new Error('no network in tests')));
});
afterEach(() => { fetchSpy.mockRestore(); });

const watchButton = () => screen.getByRole('button', { name: /Watch Featured Video/ });

describe('Featured Production', () => {
  test('ships with no video configured', () => {
    expect(FEATURED.video).toBeNull();
  });

  test('the fallback: heading, coming-soon frame, disabled Watch labelled soon, Explore outline', () => {
    render(<FeaturedScreening />);
    expect(screen.getByRole('heading', { level: 2, name: 'Step Inside the Story.' })).toBeTruthy();
    expect(screen.getByTestId('site-featured-fallback')).toBeTruthy();
    expect(screen.getByText('First look coming soon')).toBeTruthy();
    expect(screen.getByText(/30-second clip or a YouTube video appears here once it is published/)).toBeTruthy();
    expect(watchButton().disabled).toBe(true);
    expect(watchButton().textContent).toMatch(/Coming soon/);
    expect(screen.getByRole('link', { name: 'Explore the Production' }).getAttribute('href')).toBe('#flagship');
  });

  test('loads nothing: no fetch, no iframe, no video element, no YouTube URL', () => {
    const { container } = render(<FeaturedScreening />);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.querySelector('iframe, video')).toBeNull();
    expect(container.innerHTML).not.toMatch(/youtube(-nocookie)?\.com|youtu\.be|ytimg/i);
  });

  test('half-filled or unknown sources stay in the fallback', () => {
    for (const video of [{}, { kind: 'youtube' }, { kind: 'youtube', id: '' }, { kind: 'clip', src: '/c.mp4' }, { kind: 'vimeo', id: 'x' }, 'abc']) {
      expect(isPublishedVideo(video)).toBe(false);
      const { unmount } = render(<FeaturedScreening video={video} />);
      expect(screen.getByTestId('site-featured-fallback')).toBeTruthy();
      expect(watchButton().disabled).toBe(true);
      unmount();
    }
  });

  test('the config takes either a YouTube id or a clip with a poster', () => {
    expect(isPublishedVideo({ kind: 'youtube', id: 'dQw4w9WgXcQ' })).toBe(true);
    expect(isPublishedVideo({ kind: 'clip', src: '/clip.mp4', poster: '/poster.webp' })).toBe(true);
  });
});
