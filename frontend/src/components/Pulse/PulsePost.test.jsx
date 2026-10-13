/**
 * A post on The Pulse (Task 2927): #tags styled; one to four photos in a
 * grid; likes, comments and shares, the comment count being the real live
 * comments; the first comment with its author's photo, and "View N more"
 * only when N more exist.
 */
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PulsePost, { TaggedText, photosOf, cityName } from './PulsePost';

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
    const { container, rerender } = render(<PulsePost post={{ ...base, image_urls: ['1', '2', '3'] }} />);
    expect(container.querySelector('[data-testid="pl-photos"]').className).toBe('pl-photos pl-photos-3');
    rerender(<PulsePost post={{ ...base, content_text: 'words only' }} />);
    expect(container.querySelector('[data-testid="pl-photos"]')).toBeNull();
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

  test("a tagged place (Task 3090) replaces the poster's city and opens that city's feed", () => {
    const onCity = vi.fn();
    const post = { ...base, place: { city: 'dazzle_district', city_name: 'Dazzle District', location_id: 'v1', name: 'Velvet Room' } };
    const { rerender } = render(<PulsePost post={post} onCity={onCity} />);
    const link = screen.getByTestId('pl-post-place');
    expect(link.textContent).toBe('Velvet Room · Dazzle District');
    expect(link.tagName).toBe('BUTTON');
    fireEvent.click(link);
    expect(onCity).toHaveBeenCalledWith('dazzle_district');
    expect(screen.queryByText(/Echo Park/)).toBeNull();
    // Untagged: the poster's city, still a link; with no onCity, plain text.
    rerender(<PulsePost post={base} onCity={onCity} />);
    fireEvent.click(screen.getByTestId('pl-post-place'));
    expect(onCity).toHaveBeenLastCalledWith('echo_park');
    rerender(<PulsePost post={base} />);
    expect(screen.getByTestId('pl-post-place').tagName).toBe('SPAN');
    expect(screen.getByTestId('pl-post-place').textContent).toBe('Echo Park');
  });
});
