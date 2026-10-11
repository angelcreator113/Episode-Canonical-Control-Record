/**
 * The Pulse's side cards (Task 2928): each from real data, its empty state,
 * Director view ("+ Add" to Uploads, the trending footer) against Lala's view
 * (empty spots left out), and no episode or show words on Lala's screen.
 */
import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  CitiesCard, CityStrip, TrendingCard, UpcomingCard, LatestFitCard, cityVars, tagOf, dateTile, UPLOADS,
} from './PulseSides';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const CITIES = [
  { key: 'dazzle_district', name: 'Dazzle District', subtitle: 'Fashion & Luxury', image_url: 'https://cdn/dazzle.jpg', image_alt: 'The runway at night' },
  { key: 'echo_park', name: 'Echo Park', subtitle: 'Entertainment & Nightlife', palette: ['#111111', '#222222'] },
];

describe('CitiesCard', () => {
  test('each city tinted with its colours: the saved palette, else the spec’s; its image when uploaded', () => {
    wrap(<CitiesCard cities={CITIES} director={false} />);
    const rows = screen.getAllByTestId('pl-city-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Dazzle District');
    expect(rows[0].textContent).toContain('Fashion & Luxury');
    expect(rows[0].style.getPropertyValue('--city-a').toLowerCase()).toBe('#d4789a');
    expect(rows[1].style.getPropertyValue('--city-a')).toBe('#111111');
    expect(rows[1].style.getPropertyValue('--city-b')).toBe('#222222');
    expect(screen.getByTestId('pl-city-image').getAttribute('alt')).toBe('The runway at night');
  });

  test('an empty city image: "+ Add" to Uploads in Director view, the name in its colours in Lala’s view', () => {
    const { unmount } = wrap(<CitiesCard cities={CITIES} director />);
    expect(screen.getByTestId('pl-city-add').getAttribute('href')).toBe(UPLOADS);
    expect(screen.getByLabelText('Add an image for Echo Park')).toBeTruthy();
    unmount();
    wrap(<CitiesCard cities={CITIES} director={false} />);
    expect(screen.queryByTestId('pl-city-add')).toBeNull();
    expect(screen.queryByText(/\+ Add/)).toBeNull();
    expect(screen.getAllByText('Echo Park')).toHaveLength(2); // the tile and the row
  });

  test('no cities, no card; the phone strip carries the same cities', () => {
    const { container } = wrap(<CitiesCard cities={[]} />);
    expect(container.textContent).toBe('');
    wrap(<CityStrip cities={CITIES} />);
    expect(screen.getByTestId('pl-city-strip').textContent).toBe('Dazzle DistrictEcho Park');
    expect(cityVars({ key: 'nowhere' })).toBeUndefined();
  });
});

describe('TrendingCard', () => {
  const topics = [
    { topic: '#VelvetSeason', post_count: 4 }, { topic: 'glow week', post_count: 1 }, { topic: '#a', post_count: 3 },
    { topic: '#b', post_count: 2 }, { topic: '#c', post_count: 2 }, { topic: '#d', post_count: 1 }, { topic: '#none', post_count: 0 },
  ];

  test('rank, tag and "N posts", top five', () => {
    wrap(<TrendingCard topics={topics} director={false} />);
    const rows = screen.getAllByTestId('pl-trend');
    expect(rows).toHaveLength(5);
    expect(rows[0].textContent).toBe('1#VelvetSeason4 posts');
    expect(rows[1].textContent).toBe('2#glowweek1 post');
    expect(screen.queryByTestId('pl-trending-foot')).toBeNull();
    expect(tagOf('#x')).toBe('#x');
  });

  test('the footer is for Director view only; nothing trending says so', () => {
    const { unmount } = wrap(<TrendingCard topics={topics} director />);
    expect(screen.getByTestId('pl-trending-foot').textContent).toBe('Counted from approved posts');
    unmount();
    wrap(<TrendingCard topics={[]} director={false} />);
    expect(screen.getByText('Nothing trending yet.')).toBeTruthy();
  });
});

describe('UpcomingCard', () => {
  const events = [
    { id: 'e1', name: 'Velvet Season Opening', date: '2026-11-12', time: '6:30 PM', venue: 'Atelier Nine', episode: { id: 'ep-3', number: 3, title: 'The Velvet Rope' } },
    { id: 'e2', name: 'Glow Week', date: 'next spring', time: null, venue: null, episode: { id: 'ep-4', number: 4, title: 'Glow' } },
  ];

  test('date tile, name, venue and time; the episode never shows', () => {
    wrap(<UpcomingCard events={events} />);
    const rows = screen.getAllByTestId('pl-event');
    expect(rows[0].textContent).toBe('Nov 12Velvet Season OpeningAtelier Nine · 6:30 PM');
    expect(rows[1].textContent).toBe('Glow Weeknext spring');
    const text = screen.getByTestId('pl-upcoming').textContent;
    for (const word of ['Episode', 'Ep ', 'The Velvet Rope', 'ep-3']) expect(text).not.toContain(word);
    expect(document.querySelector('a')).toBeNull();
    expect(dateTile('2026-02-03')).toEqual({ month: 'Feb', day: '3' });
    expect(dateTile('soon')).toBeNull();
  });

  test('nothing coming up says so', () => {
    wrap(<UpcomingCard events={[]} />);
    expect(screen.getByText('Nothing coming up.')).toBeTruthy();
  });
});

describe('LatestFitCard', () => {
  test('the photo, with the caption in script', () => {
    wrap(<LatestFitCard fit={{ source: 'fit', image_url: 'https://cdn/fit.jpg', image_alt: 'Denim on denim', caption: 'Sunday errands, but make it denim' }} director={false} />);
    expect(screen.getByTestId('pl-fit-photo').getAttribute('src')).toBe('https://cdn/fit.jpg');
    expect(screen.getByTestId('pl-fit-photo').getAttribute('alt')).toBe('Denim on denim');
    expect(screen.getByText('Sunday errands, but make it denim').className).toBe('pl-fit-caption');
  });

  test('a Style Page photo shows with no episode words', () => {
    wrap(<LatestFitCard fit={{ source: 'episode', image_url: 'https://cdn/front.jpg', image_alt: null, caption: null, episode_number: 7 }} director={false} />);
    const text = screen.getByTestId('pl-fit').textContent;
    expect(text).toBe('Check out the latest fit');
    expect(text).not.toMatch(/episode|7/i);
  });

  test('no fit: "+ Add Lala’s latest fit" in Director view, left out in Lala’s view', () => {
    const { unmount } = wrap(<LatestFitCard fit={null} director />);
    expect(screen.getByRole('link', { name: /\+ Add Lala's latest fit/ }).getAttribute('href')).toBe(UPLOADS);
    unmount();
    const { container } = wrap(<LatestFitCard fit={null} director={false} />);
    expect(container.textContent).toBe('');
  });
});
