/**
 * The Pulse › Dream Cities (Task 2987): the cities to pick from; a city's
 * feed and local trends at the page's story moment; Back; and the city
 * links on the stories row, the phone strip and the Explore card.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import api from '../../services/api';
import PulseCity from './PulseCity';
import PulseStories from './PulseStories';
import { CitiesCard, CityStrip } from './PulseSides';

const CITIES = [
  { key: 'dazzle_district', name: 'Dazzle District', subtitle: 'Fashion capital', palette: ['#f3d6e4', '#c9a27e'] },
  { key: 'echo_park', name: 'Echo Park', subtitle: 'Nightlife', palette: ['#7a5cc7', '#3c6ee0'] },
];
const SHOW = { id: 'show-1' };
const POSTS = [{ id: 'p1', poster_handle: 'marcus.k', poster_display_name: 'Marcus', content_text: 'that runway though #GalaNight', likes: 10, comments_count: 0, shares: 0, posted_at: '2026-10-12T10:00:00Z' }];

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/feed-posts?')) return { data: { data: POSTS, total: 1 } };
    if (url.includes('/trending')) return { data: { data: [{ topic: '#GalaNight', post_count: 1 }] } };
    return { data: {} };
  });
});

describe('the city page', () => {
  test('with no city chosen: the cities to pick from', () => {
    const onCity = vi.fn();
    render(<PulseCity show={SHOW} cities={CITIES} cityKey={null} viewAt="present" onCity={onCity} />);
    expect(screen.getByTestId('pl-cityfeed-pick')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Echo Park/ }));
    expect(onCity).toHaveBeenCalledWith('echo_park');
    expect(api.get).not.toHaveBeenCalled();
  });

  test("a city: its name, its local trends and its feed, read at the page's moment; Back", async () => {
    const onCity = vi.fn();
    render(<PulseCity show={SHOW} cities={CITIES} cityKey="dazzle_district" viewAt="17" onCity={onCity} />);
    expect(screen.getByRole('heading', { name: 'Dazzle District' })).toBeTruthy();
    expect(screen.getByText('Fashion capital')).toBeTruthy();
    await screen.findByText('that runway though');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts?show_id=show-1&city=dazzle_district&status=live&with=comments&limit=30&at=17');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-enhanced/show-1/trending?city=dazzle_district&at=17');
    expect(screen.getByTestId('pl-trend').textContent).toContain('#GalaNight');
    expect(screen.getByRole('heading', { name: 'Trending in Dazzle District' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Dream Cities/ }));
    expect(onCity).toHaveBeenCalledWith(null);
  });

  test('Director view (no moment) reads everything live; nothing posted, and an error, say so', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url.startsWith('/api/v1/feed-posts?') ? { data: { data: [] } } : { data: { data: [] } }));
    const { unmount } = render(<PulseCity show={SHOW} cities={CITIES} cityKey="echo_park" viewAt={null} onCity={vi.fn()} />);
    expect((await screen.findByTestId('pl-cityfeed-empty')).textContent).toBe('Nothing posted in Echo Park yet.');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-posts?show_id=show-1&city=echo_park&status=live&with=comments&limit=30');
    unmount();
    vi.mocked(api.get).mockRejectedValue({ response: { status: 500 } });
    render(<PulseCity show={SHOW} cities={CITIES} cityKey="echo_park" viewAt="present" onCity={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Echo Park could not be loaded.');
  });
});

describe('city links', () => {
  test('the stories row, the phone strip and the Explore card open a city when the page offers it', () => {
    const onCity = vi.fn();
    render(<>
      <PulseStories lala={{ handle: 'lala', name: 'Lala' }} people={[]} cities={CITIES} onPerson={vi.fn()} onCity={onCity} />
      <CityStrip cities={CITIES} onCity={onCity} />
      <CitiesCard cities={CITIES} onCity={onCity} />
    </>);
    fireEvent.click(screen.getAllByTestId('pl-story-city')[1]);
    expect(onCity).toHaveBeenLastCalledWith('echo_park');
    const strip = screen.getByTestId('pl-city-strip');
    fireEvent.click(strip.querySelectorAll('button')[0]);
    expect(onCity).toHaveBeenLastCalledWith('dazzle_district');
    fireEvent.click(screen.getByTestId('pl-cities').querySelectorAll('button')[1]);
    expect(onCity).toHaveBeenLastCalledWith('echo_park');
  });

  test('without onCity they stay as they were (the Story clock preview)', async () => {
    render(<PulseStories lala={{ handle: 'lala', name: 'Lala' }} people={[]} cities={CITIES} onPerson={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByTestId('pl-story-city')[0].getAttribute('aria-disabled')).toBe('true'));
  });
});
