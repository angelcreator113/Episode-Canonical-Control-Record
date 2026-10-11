/**
 * The stories row (Task 2927): Lala first, then who posted live in the last
 * few days (newest first, once each), then the five Dream Cities in their
 * colours and story bubbles. People filter the feed; cities are quiet.
 */
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PulseStories, { recentPosters } from './PulseStories';
import { DREAM_CITIES } from '../../data/dreamCities';

const NOW = new Date('2026-10-11T12:00:00Z').getTime();
const at = (hoursAgo) => new Date(NOW - hoursAgo * 3600000).toISOString();

describe('recentPosters', () => {
  test('live posts from the last few days, newest first, once each, Lala left out', () => {
    const posts = [
      { poster_handle: 'nia', poster_display_name: 'Nia', posted_at: at(30), socialProfile: { city: 'echo_park' } },
      { poster_handle: 'lala', posted_at: at(1) },
      { poster_handle: 'marcus', poster_display_name: 'Marcus', posted_at: at(2), author_portrait_url: 'https://cdn/m.jpg' },
      { poster_handle: 'nia', posted_at: at(50) },
      { poster_handle: 'old', posted_at: at(24 * 5) },
    ];
    expect(recentPosters(posts, { now: NOW })).toEqual([
      { handle: 'marcus', name: 'Marcus', photo: 'https://cdn/m.jpg', city: null },
      { handle: 'nia', name: 'Nia', photo: null, city: 'Echo Park' },
    ]);
  });
});

describe('PulseStories', () => {
  test('Lala, the people, then the five cities; a person filters, a city is quiet', () => {
    const onPerson = vi.fn();
    const cities = DREAM_CITIES.map((c) => (c.key === 'echo_park' ? { ...c, bubble_image_url: 'https://cdn/echo.jpg', palette: ['#7B4FC9', '#2F7BFF'] } : c));
    render(<PulseStories lala={{ handle: 'lala', name: 'Lala', photo: null, city: 'Dazzle District' }}
      people={[{ handle: 'marcus', name: 'Marcus', photo: 'https://cdn/m.jpg', city: null }]} cities={cities} active={null} onPerson={onPerson} />);
    expect(screen.getAllByTestId('pl-story-person').map((b) => b.textContent)).toEqual(['LLalaDazzle District', 'Marcus']);
    const cityItems = screen.getAllByTestId('pl-story-city');
    expect(cityItems.map((c) => c.querySelector('b').textContent)).toEqual(DREAM_CITIES.map((c) => c.name));
    const echo = cityItems.find((c) => c.textContent.includes('Echo Park'));
    expect(echo.querySelector('img').getAttribute('src')).toBe('https://cdn/echo.jpg');
    expect(echo.querySelector('.pl-story-ring').style.getPropertyValue('--ring-a')).toBe('#7B4FC9');
    expect(echo.querySelector('.pl-story-ring').style.getPropertyValue('--ring-b')).toBe('#2F7BFF');
    expect(echo.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getAllByTestId('pl-story-person')[1]);
    expect(onPerson).toHaveBeenCalledWith('marcus', 'Marcus');
  });
});
