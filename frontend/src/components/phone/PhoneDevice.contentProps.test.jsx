/**
 * Lala's Phone audit (Evoni, 2026-10-07): the screen list carried no show,
 * so the feed, DM and notification content areas drew nothing in Play
 * through and Build. The caller's show now fills in.
 */
import React from 'react';
import { vi, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../ScreenContentRenderer', () => ({
  default: (props) => <div data-testid="content-renderer" data-props={JSON.stringify({ showId: props.showId, episodeId: props.episodeId, screenMeta: props.screenMeta })} />,
}));

import PhoneDevice from './PhoneDevice';

const SCREEN = { id: 'feed', name: 'Feed', category: 'phone', url: 'https://x/f.png', content_zones: [{ id: 'c1', content_type: 'feed_posts' }], metadata: { wardrobe_price: 12 } };

test("content areas get the caller's show and episode when the screen carries no show", () => {
  render(<PhoneDevice phoneScreen={SCREEN} activeScreen={SCREEN} firstScreen={SCREEN} showId="show-1" episodeId="ep-1" />);
  expect(JSON.parse(screen.getByTestId('content-renderer').dataset.props)).toEqual({ showId: 'show-1', episodeId: 'ep-1', screenMeta: { wardrobe_price: 12 } });
});

test("the screen's own show wins", () => {
  render(<PhoneDevice phoneScreen={{ ...SCREEN, show_id: 'show-9' }} activeScreen={{ ...SCREEN, show_id: 'show-9' }} firstScreen={SCREEN} showId="show-1" />);
  expect(JSON.parse(screen.getByTestId('content-renderer').dataset.props).showId).toBe('show-9');
});
