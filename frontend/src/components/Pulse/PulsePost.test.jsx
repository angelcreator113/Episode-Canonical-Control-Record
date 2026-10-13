/**
 * A post on The Pulse (Task 2927): #tags styled; one to four photos in a
 * grid; likes, comments and shares, the comment count being the real live
 * comments; the first comment with its author's photo, and "View N more"
 * only when N more exist.
 */
import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PulsePost, { TaggedText, photosOf, photoItemsOf, cityName } from './PulsePost';

const base = { id: 'p1', poster_handle: 'lala', poster_display_name: 'Lala', likes: 5, shares: 2, posted_at: null, socialProfile: { city: 'echo_park' } };
const comment = (id, name, text) => ({ id, handle: name.toLowerCase(), display_name: name, text, portrait_url: id === 'c1' ? 'https://cdn/m.jpg' : null });

describe('PulsePost', () => {
  test('#tags are styled; the rest is plain text', () => {
    const { container } = render(<p><TaggedText text="Gala night #VelvetSeason with #Dazzle_District friends" /></p>);
    expect([...container.querySelectorAll('.pl-tag')].map((t) => t.textContent)).toEqual(['#VelvetSeason', '#Dazzle_District']);
    expect(container.textContent).toBe('Gala night #VelvetSeason with #Dazzle_District friends');
  });

  test('photos: image_urls when several (at most four), else image_url, else none', () => {
    expect(photosOf({ image_url: 'a' })).toEqual(['a']);
    expect(photosOf({ image_urls: ['a', null, 'b', 'c', 'd', 'e'] })).toEqual(['a', 'b', 'c', 'd']);
    expect(photosOf({})).toEqual([]);
    const { container, rerender } = render(<PulsePost post={{ ...base, image_url: '1' }} />);
    expect(container.querySelector('[data-testid="pl-photos"]').className).toBe('pl-photos pl-photos-1');
    rerender(<PulsePost post={{ ...base, content_text: 'words only' }} />);
    expect(container.querySelector('[data-testid="pl-photos"]')).toBeNull();
  });

  test('photos with alt text: the photos list (up to four), else the old fields; a first look has no alt (Task 3089)', () => {
    const photos = [{ url: 'u1', alt: 'the gown' }, { url: 'u2', alt: 'the shoes' }, { url: null, alt: 'x' }, { url: 'u3', alt: '' }, { url: 'u4', alt: '' }, { url: 'u5', alt: '' }];
    expect(photoItemsOf({ photos })).toEqual([{ src: 'u1', alt: 'the gown' }, { src: 'u2', alt: 'the shoes' }, { src: 'u3', alt: '' }, { src: 'u4', alt: '' }]);
    expect(photoItemsOf({ image_url: 'a', image_description: 'a fit' })).toEqual([{ src: 'a', alt: 'a fit' }]);
    expect(photoItemsOf({ photos, photo_teaser: true })[0]).toEqual({ src: 'u1', alt: '' });
  });

  test('several photos are a swipeable carousel, one at a time, with "1 / 3" and each alt text (Task 3089)', () => {
    const { container } = render(<PulsePost post={{ ...base, photos: [{ url: 'u1', alt: 'the gown' }, { url: 'u2', alt: 'the shoes' }, { url: 'u3', alt: 'the bag' }] }} />);
    const carousel = screen.getByRole('group', { name: '3 photos' });
    expect(carousel.getAttribute('aria-roledescription')).toBe('carousel');
    expect([...container.querySelectorAll('.pl-carousel-track img')].map((i) => i.getAttribute('alt'))).toEqual(['the gown', 'the shoes', 'the bag']);
    expect(screen.getByTestId('pl-carousel-count').textContent).toBe('1 / 3');
    const track = container.querySelector('.pl-carousel-track');
    Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true });
    track.scrollLeft = 600;
    fireEvent.scroll(track);
    expect(screen.getByTestId('pl-carousel-count').textContent).toBe('3 / 3');
  });

  test('counts and the city; the comment count is the real live comments; "View N more" only when they exist', () => {
    const post = { ...base, comments_count: 40, comments: [comment('c1', 'Marcus', 'the gold'), comment('c2', 'Nia', 'obsessed'), comment('c3', 'Zed', 'iconic')] };
    const { container } = render(<PulsePost post={post} />);
    expect(container.textContent).toContain('Echo Park');
    expect(container.textContent).toMatch(/Likes5/);
    expect(container.textContent).toMatch(/Comments3/);
    expect(container.textContent).toMatch(/Shares2/);
    expect(screen.getAllByTestId('pl-comment')).toHaveLength(1);
    expect(screen.getByTestId('pl-comment').querySelector('img').getAttribute('src')).toBe('https://cdn/m.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'View 2 more comments' }));
    expect(screen.getAllByTestId('pl-comment').map((c) => c.textContent)).toEqual(['Marcus the gold', 'NNia obsessed', 'ZZed iconic']);
    expect(screen.queryByRole('button', { name: /View/ })).toBeNull();
  });

  test('one comment: no "View more"; no comments: nothing', () => {
    const { rerender } = render(<PulsePost post={{ ...base, comments: [comment('c2', 'Nia', 'obsessed')] }} />);
    expect(screen.queryByRole('button', { name: /View/ })).toBeNull();
    rerender(<PulsePost post={{ ...base, comments: [] }} />);
    expect(screen.queryAllByTestId('pl-comment')).toHaveLength(0);
  });

  test('cityName reads a Dream City key', () => {
    expect(cityName('maverick_harbor')).toBe('Maverick Harbor');
    expect(cityName(undefined)).toBeNull();
  });
});
