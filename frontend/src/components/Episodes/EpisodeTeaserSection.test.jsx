/**
 * Viewer teaser card (Task #2386; P12): rule 14 labels, the editable
 * textarea, and the live counter at the 150-character hook boundary.
 */
import React from 'react';
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EpisodeTeaserSection from './EpisodeTeaserSection';
import { teaserStateOf, teaserStateLabel, teaserCounter, splitTeaserHook } from '../../utils/episodeTeaser';

const DRAFT = 'Everyone got the same invitation. Only one of them knows why Lala is really there.';

describe('episodeTeaser utils', () => {
  test('state and label per rule 14', () => {
    expect(teaserStateOf({ teaser: DRAFT, teaser_drafted: DRAFT })).toBe('auto_drafted');
    expect(teaserStateOf({ teaser: 'Mine now', teaser_drafted: DRAFT })).toBe('edited');
    expect(teaserStateOf({ teaser: 'Written by hand' })).toBe('set');
    expect(teaserStateOf({ teaser: '' })).toBe('missing');
    expect(teaserStateLabel('auto_drafted')).toBe('Auto-drafted · from event');
    expect(teaserStateLabel('edited')).toBe('Edited');
    expect(teaserStateLabel('missing')).toBe('Missing');
    expect(teaserStateLabel('set')).toBeNull();
  });

  test('counter and hook split at 150 characters', () => {
    expect(teaserCounter('')).toBe('0 characters · hook 0/150');
    expect(teaserCounter('a')).toBe('1 character · hook 1/150');
    expect(teaserCounter('a'.repeat(212))).toBe('212 characters · hook 150/150');
    const { hook, rest } = splitTeaserHook('a'.repeat(150) + 'tail');
    expect(hook).toHaveLength(150);
    expect(rest).toBe('tail');
  });
});

describe('EpisodeTeaserSection', () => {
  test('an unedited draft reads Auto-drafted · from event', () => {
    render(<EpisodeTeaserSection episode={{ id: 'ep-1', teaser: DRAFT, teaser_drafted: DRAFT }} onUpdate={vi.fn()} />);
    expect(screen.getByTestId('episode-teaser-state').textContent.trim()).toBe('Auto-drafted · from event');
    expect(screen.getByTestId('episode-teaser-text').textContent).toBe(DRAFT);
  });

  test('an edited teaser reads Edited', () => {
    render(<EpisodeTeaserSection episode={{ id: 'ep-1', teaser: 'Who invited her?', teaser_drafted: DRAFT }} onUpdate={vi.fn()} />);
    expect(screen.getByTestId('episode-teaser-state').textContent.trim()).toBe('Edited');
  });

  test('no teaser reads Missing and offers Write teaser', () => {
    render(<EpisodeTeaserSection episode={{ id: 'ep-1', teaser: null, teaser_drafted: null }} onUpdate={vi.fn()} />);
    expect(screen.getByTestId('episode-teaser-state').textContent.trim()).toBe('Missing');
    expect(screen.getByTestId('episode-teaser-empty')).toBeTruthy();
    expect(screen.getByTestId('episode-teaser-edit').textContent).toContain('Write teaser');
  });

  test('editing shows a live counter with the hook boundary and saves through onUpdate({ teaser })', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<EpisodeTeaserSection episode={{ id: 'ep-1', teaser: DRAFT, teaser_drafted: DRAFT }} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByTestId('episode-teaser-edit'));
    const input = screen.getByTestId('episode-teaser-input');
    expect(input.value).toBe(DRAFT);

    const long = 'x'.repeat(150) + ' and the rest';
    fireEvent.change(input, { target: { value: long } });
    expect(screen.getByTestId('episode-teaser-counter').textContent).toBe(`${long.length} characters · hook 150/150`);
    const preview = screen.getByTestId('episode-teaser-preview');
    expect(preview.querySelector('.ets-hook').textContent).toBe('x'.repeat(150));
    expect(preview.querySelector('.ets-rest').textContent).toBe(' and the rest');

    fireEvent.click(screen.getByTestId('episode-teaser-save'));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ teaser: long }));
    await waitFor(() => expect(screen.queryByTestId('episode-teaser-input')).toBeNull());
  });

  test('a failed save stays in the editor and shows the error', async () => {
    const err = Object.assign(new Error('Request failed'), { response: { data: { error: 'Nope' } } });
    const onUpdate = vi.fn().mockRejectedValue(err);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<EpisodeTeaserSection episode={{ id: 'ep-1', teaser: DRAFT, teaser_drafted: DRAFT }} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByTestId('episode-teaser-edit'));
    fireEvent.click(screen.getByTestId('episode-teaser-save'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Nope'));
    expect(screen.getByTestId('episode-teaser-input')).toBeTruthy();
  });
});
