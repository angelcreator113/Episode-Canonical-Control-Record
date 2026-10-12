/**
 * Reveals on The Pulse's screens (Task 2939; Evoni, 2026-10-11: teasers are
 * blurred): FirstLook blurs and labels before an item's moment; RevealChip
 * tells Director view when it reveals; the post card, side cards and
 * stories row use them.
 */
import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FirstLook, RevealChip } from './PulseReveal';
import PulsePost from './PulsePost';
import PulseStories from './PulseStories';
import { CitiesCard, UpcomingCard, LatestFitCard } from './PulseSides';
import { revealKey } from '../../lib/pulseReveals';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('FirstLook and RevealChip', () => {
  test('a teaser is wrapped, hidden from screen readers and labelled "First look"; otherwise untouched', () => {
    const { container, rerender } = render(<FirstLook active><img src="x.jpg" alt="" /></FirstLook>);
    expect(screen.getByTestId('pl-first-look').textContent).toBe(' First look');
    expect(container.querySelector('.pl-first-look-media').getAttribute('aria-hidden')).toBe('true');
    rerender(<FirstLook active={false}><img src="x.jpg" alt="" /></FirstLook>);
    expect(screen.queryByTestId('pl-first-look')).toBeNull();
    expect(container.querySelector('img')).toBeTruthy();
  });
  test('the chip says when it reveals, and nothing without a label', () => {
    const { container, rerender } = render(<RevealChip label="During Ep 3" />);
    expect(screen.getByTestId('pl-reveal-chip').textContent).toBe(' Reveals: During Ep 3');
    rerender(<RevealChip label={null} />);
    expect(container.textContent).toBe('');
  });
});

describe('the post card', () => {
  const post = { id: 'p1', poster_handle: 'lala', poster_display_name: 'Lala', image_url: 'https://cdn/a.jpg', image_description: 'The gown', comments: [] };

  test('a teaser post reads "First look" in place of its words, its photos blurred', () => {
    render(<PulsePost post={{ ...post, teaser: true, photo_teaser: true, content_text: null }} />);
    expect(screen.getByTestId('pl-post-teaser').textContent).toBe('First look');
    expect(screen.getByTestId('pl-first-look')).toBeTruthy();
    expect(screen.getByTestId('pl-photos').querySelector('img').getAttribute('alt')).toBe('');
  });
  test('a photo teaser keeps the words; a revealed post has neither; Director view gets a chip', () => {
    const { rerender } = render(<PulsePost post={{ ...post, photo_teaser: true, content_text: 'Gold or silver?' }} />);
    expect(screen.getByText('Gold or silver?')).toBeTruthy();
    expect(screen.getByTestId('pl-first-look')).toBeTruthy();
    rerender(<PulsePost post={{ ...post, content_text: 'Gold or silver?' }} revealLabel="After Ep 2" />);
    expect(screen.queryByTestId('pl-first-look')).toBeNull();
    expect(screen.getByTestId('pl-photos').querySelector('img').getAttribute('alt')).toBe('The gown');
    expect(screen.getByTestId('pl-reveal-chip').textContent).toContain('After Ep 2');
  });
});

describe('the side cards and stories row', () => {
  const cities = [
    { key: 'dazzle_district', name: 'Dazzle District', image_url: 'https://cdn/d.jpg', image_alt: 'Runway', bubble_image_url: 'https://cdn/db.jpg' },
    { key: 'echo_park', name: 'Echo Park', image_url: 'https://cdn/e.jpg', bubble_image_url: 'https://cdn/eb.jpg' },
  ];

  test("a city image before its reveal: blurred when a teaser, its name tile when hidden (Lala's view)", () => {
    wrap(<CitiesCard cities={cities} director={false} states={{ 'city:dazzle_district': 'teaser', 'city:echo_park': 'hidden' }} />);
    const rows = screen.getAllByTestId('pl-city-row');
    expect(rows[0].querySelector('[data-testid="pl-first-look"]')).toBeTruthy();
    expect(rows[0].querySelector('img').getAttribute('alt')).toBe('');
    expect(rows[1].querySelector('img')).toBeNull();
    expect(rows[1].querySelector('.pl-city-name-tile').textContent).toBe('Echo Park');
  });
  test('Director view shows the city chip', () => {
    const labels = new Map([[revealKey('image', 'dazzle_district', 'city'), 'Announced Ep 2']]);
    wrap(<CitiesCard cities={cities} director labels={labels} />);
    expect(screen.getByTestId('pl-reveal-chip').textContent).toContain('Announced Ep 2');
  });
  test('a city bubble: blurred when a teaser, its initial when hidden', () => {
    const { container } = render(<PulseStories lala={{ handle: 'lala', name: 'Lala' }} people={[]} cities={cities} onPerson={() => {}}
      cityStates={{ 'city_bubble:dazzle_district': 'teaser', 'city_bubble:echo_park': 'hidden' }} />);
    const bubbles = container.querySelectorAll('[data-testid="pl-story-city"]');
    expect(bubbles[0].querySelector('img').className).toBe('pl-blurred');
    expect(bubbles[1].querySelector('img')).toBeNull();
    expect(bubbles[1].querySelector('.pl-story-initial').textContent).toBe('E');
  });
  test('a teaser event shows its name and "First look" only; Director view shows a chip', () => {
    const { unmount } = wrap(<UpcomingCard events={[{ id: 'e1', name: 'The Gala', teaser: true, venue: null, date: null }]} />);
    expect(screen.getByTestId('pl-event').textContent).toBe('The GalaFirst look');
    unmount();
    wrap(<UpcomingCard events={[{ id: 'e1', name: 'The Gala', date: '2026-11-12', venue: 'Atelier' }]} labels={new Map([[revealKey('event', 'e1'), 'Announced Ep 2']])} />);
    expect(screen.getByTestId('pl-reveal-chip').textContent).toContain('Announced Ep 2');
  });
  test('a teaser fit is blurred with no caption; Director view shows a chip', () => {
    const fit = { source: 'fit', id: 'f1', image_url: 'https://cdn/f.jpg', image_alt: 'Denim', caption: 'Sunday denim' };
    const { unmount } = wrap(<LatestFitCard fit={{ ...fit, teaser: true }} director={false} />);
    expect(screen.getByTestId('pl-first-look')).toBeTruthy();
    expect(screen.queryByText('Sunday denim')).toBeNull();
    expect(screen.getByTestId('pl-fit-photo').getAttribute('alt')).toBe('');
    unmount();
    wrap(<LatestFitCard fit={fit} director revealLabel="After Ep 3" />);
    expect(screen.getByText('Sunday denim')).toBeTruthy();
    expect(screen.getByTestId('pl-reveal-chip').textContent).toContain('After Ep 3');
  });
});
