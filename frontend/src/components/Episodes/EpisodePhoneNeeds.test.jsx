/**
 * "What this episode needs from the phone" (phone round step 2; Evoni,
 * 2026-10-25): the list read from the script, Make it, and Build all (its
 * confirm count, its order, the review list with Undo, and a failure part
 * way that keeps what was made and says what was not).
 */
import React, { useState, useCallback } from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import EpisodePhoneNeeds from './EpisodePhoneNeeds';
import { PHONE, SCRIPT } from '../../lib/episodePhoneNeeds.testutil';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const EPISODE = { id: 'ep-1', show_id: 's-1', episode_number: 3 };
const clone = (v) => JSON.parse(JSON.stringify(v));

// A small Phone Hub: the routes the card calls, over one list of screens.
function fakeHub({ script = SCRIPT, failZoneFor = null } = {}) {
  const state = { phone: clone(PHONE), calls: [] };
  const asset = (id) => state.phone.find((s) => s.asset_id === id);
  vi.mocked(api.get).mockImplementation(async (url) => {
    state.calls.push(`GET ${url}`);
    if (url === '/api/v1/episodes/ep-1') return { data: { data: { script_content: script } } };
    let m = url.match(/screen-links\/(.+)$/);
    if (m) return { data: { screen_links: clone(asset(m[1])?.screen_links || []) } };
    m = url.match(/content-zones\/(.+)$/);
    if (m) return { data: { content_zones: clone(asset(m[1])?.content_zones || []) } };
    throw new Error(`unexpected GET ${url}`);
  });
  vi.mocked(api.post).mockImplementation(async (url, body) => {
    state.calls.push(`POST ${url}`);
    if (url.endsWith('/types')) {
      const key = body.name.toLowerCase();
      state.phone.push({ id: key, name: body.name, category: 'phone', generated: false, url: null, asset_id: null, custom_id: `t-${key}` });
      return { data: { data: { id: `t-${key}`, type_key: key } } };
    }
    let m = url.match(/generate\/(.+)$/);
    if (m) {
      const s = state.phone.find((x) => x.id === m[1]);
      Object.assign(s, { generated: true, url: `https://x/${s.id}.png`, asset_id: `a-${s.id}` });
      return { data: { data: { asset_id: s.asset_id } } };
    }
    if (url.endsWith('/ai/add-zones')) {
      const target = body.prompt_hint.match(/\(id ([^)]+)\)/)[1];
      if (target === failZoneFor) throw Object.assign(new Error('x'), { response: { status: 500, data: { error: 'AI is down' } } });
      return { data: { proposal: { zones: [{ id: `ai-${target}`, label: target, target, x: 1, y: 1, w: 10, h: 10 }] } } };
    }
    if (url.endsWith('/ai/fill-content-zone')) return { data: { proposal: { content_config: { event_id: 'e1' } } } };
    throw new Error(`unexpected POST ${url}`);
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    state.calls.push(`PUT ${url}`);
    let m = url.match(/screen-links\/(.+)$/);
    if (m) { asset(m[1]).screen_links = body.screen_links; return { data: { success: true } }; }
    m = url.match(/content-zones\/(.+)$/);
    if (m) { asset(m[1]).content_zones = body.content_zones; return { data: { success: true } }; }
    throw new Error(`unexpected PUT ${url}`);
  });
  vi.mocked(api.delete).mockImplementation(async (url) => {
    state.calls.push(`DELETE ${url}`);
    const m = url.match(/types\/(.+)$/);
    if (m) state.phone = state.phone.filter((s) => s.custom_id !== m[1]);
    return { data: { success: true } };
  });
  return state;
}

function Harness({ hub, episode = EPISODE }) {
  const [overlays, setOverlays] = useState(clone(hub.phone));
  const reloadOverlays = useCallback(async () => { hub.calls.push('RELOAD'); const list = clone(hub.phone); setOverlays(list); return list; }, [hub]);
  return (
    <MemoryRouter>
      <EpisodePhoneNeeds episode={episode} showId="s-1" episodeId="ep-1" overlays={overlays} reloadOverlays={reloadOverlays} studioPath="/shows/s-1/world?tab=overlays-tab" />
    </MemoryRouter>
  );
}

const row = (name) => screen.getByTestId(`need-${name}`);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('EpisodePhoneNeeds — the list', () => {
  test('each screen the saved script needs, with its beats and status', async () => {
    const hub = fakeHub();
    render(<Harness hub={hub} episode={{ ...EPISODE, script_content: '' }} />);
    await screen.findByTestId('need-Invitation');
    expect(row('Invitation').textContent).toMatch(/Invitation · beat 5/);
    expect(row('Mail').textContent).toMatch(/Mail · beats 4 and 5/);
    expect(within(row('Mail')).getByText('Exists')).toBeTruthy();
    expect(row('Invitation').textContent).toMatch(/Exists but no tap zone to reach it \+content zone empty/);
    expect(row('Closet').textContent).toMatch(/Missing: no picture yet/);
    expect(within(row('Bank')).getByText('Missing')).toBeTruthy();
    expect(within(row('Bank')).getByRole('button', { name: 'Make it' })).toBeTruthy();
    expect(within(row('Invitation')).getByRole('button', { name: 'Add tap zone on Mail' })).toBeTruthy();
    // A screen that exists opens in the Hub at itself.
    expect(within(row('Mail')).getByRole('link', { name: 'Mail' }).getAttribute('href')).toBe('/shows/s-1/world?tab=overlays-tab&screen=mail');
    expect(screen.getByTestId('phone-needs-problems').textContent).toMatch(/Beat 5: Mail is on Homepage, but the phone shows Invitation/);
    expect(screen.getByText('From the script: 4 screens, 3 to fix.')).toBeTruthy();
  });

  test('no script is a short honest note, with no Build all', async () => {
    fakeHub({ script: '' });
    render(<Harness hub={{ phone: PHONE, calls: [] }} />);
    expect((await screen.findByTestId('phone-needs-none')).textContent).toMatch(/no script yet/);
    expect(screen.queryByRole('button', { name: /Build all/ })).toBeNull();
  });

  test('a script with no phone screen says so', async () => {
    fakeHub({ script: '## BEAT: 1\nLALA: Hello.' });
    render(<Harness hub={{ phone: PHONE, calls: [] }} />);
    expect((await screen.findByTestId('phone-needs-none')).textContent).toMatch(/opens no phone screen yet/);
  });
});

describe('EpisodePhoneNeeds — Make it', () => {
  test('makes the missing screen through the Hub routes, lists it for review, and Undo takes it out', async () => {
    const hub = fakeHub();
    render(<Harness hub={hub} />);
    fireEvent.click(within(await screen.findByTestId('need-Bank')).getByRole('button', { name: 'Make it' }));
    const review = await screen.findByTestId('phone-needs-review');
    expect(within(review).getByText('Bank: new screen with its picture')).toBeTruthy();
    expect(hub.calls.filter((c) => c !== 'GET /api/v1/episodes/ep-1')).toEqual(['POST /api/v1/ui-overlays/s-1/types', 'POST /api/v1/ui-overlays/s-1/generate/bank', 'RELOAD']);
    // Read again, Bank exists now and only needs a way to reach it.
    await waitFor(() => expect(row('Bank').textContent).toMatch(/Exists but no tap zone/));
    fireEvent.click(within(review).getByRole('button', { name: /Undo Bank/ }));
    expect(await within(review).findByText('Undone')).toBeTruthy();
    expect(hub.calls).toContain('DELETE /api/v1/ui-overlays/s-1/types/t-bank');
    await waitFor(() => expect(within(row('Bank')).getByText('Missing')).toBeTruthy());
  });
});

describe('EpisodePhoneNeeds — Build all', () => {
  test('says what it will spend first, and Cancel spends nothing', async () => {
    const hub = fakeHub();
    render(<Harness hub={hub} />);
    await screen.findByTestId('need-Bank');
    fireEvent.click(screen.getByRole('button', { name: /Build all/ }));
    const confirm = screen.getByTestId('phone-needs-confirm');
    expect(confirm.textContent).toMatch(/make 2 screens, add 3 tap zones, fill 1 content zone: up to 6 AI calls \(2 pictures, 3 tap-zone proposals, 1 content fill\)/);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('phone-needs-confirm')).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });

  test('makes, then reaches, then fills, in that order, and lists everything for review', async () => {
    const hub = fakeHub();
    render(<Harness hub={hub} />);
    await screen.findByTestId('need-Bank');
    fireEvent.click(screen.getByRole('button', { name: /Build all/ }));
    fireEvent.click(within(screen.getByTestId('phone-needs-confirm')).getByRole('button', { name: 'Start' }));
    const review = await screen.findByTestId('phone-needs-review');
    await waitFor(() => expect(screen.queryByTestId('phone-needs-progress')).toBeNull());
    const steps = hub.calls.filter((c) => c.startsWith('POST') || c === 'RELOAD');
    expect(steps).toEqual([
      'POST /api/v1/ui-overlays/s-1/generate/closet',
      'POST /api/v1/ui-overlays/s-1/types',
      'POST /api/v1/ui-overlays/s-1/generate/bank',
      'RELOAD',
      'POST /api/v1/ui-overlays/s-1/ai/add-zones',
      'POST /api/v1/ui-overlays/s-1/ai/add-zones',
      'POST /api/v1/ui-overlays/s-1/ai/add-zones',
      'RELOAD',
      'POST /api/v1/ui-overlays/s-1/ai/fill-content-zone',
      'RELOAD',
    ]);
    expect(within(review).getAllByRole('listitem').map((li) => li.firstChild.textContent)).toEqual([
      'Closet: picture',
      'Bank: new screen with its picture',
      'Tap zone "invitation" on Mail → Invitation',
      'Tap zone "closet" on Mail → Closet',
      'Tap zone "bank" on Closet → Bank',
      'Invitation: event_invite zone filled',
    ]);
    // Everything the script needs is ready now.
    await waitFor(() => expect(screen.getByText('From the script: 4 screens, all ready.')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Build all/ })).toBeNull();
    // Undo one item: only that zone goes.
    fireEvent.click(within(review).getByRole('button', { name: /Undo Tap zone "closet"/ }));
    await within(review).findByText('Undone');
    expect(hub.phone.find((s) => s.id === 'mail').screen_links.map((z) => z.id)).toEqual(['ai-invitation']);
    await waitFor(() => expect(row('Closet').textContent).toMatch(/no tap zone/));
  });

  test('a step failing part way keeps what was made, goes on, and says what failed', async () => {
    const hub = fakeHub({ failZoneFor: 'closet' });
    render(<Harness hub={hub} />);
    await screen.findByTestId('need-Bank');
    fireEvent.click(screen.getByRole('button', { name: /Build all/ }));
    fireEvent.click(within(screen.getByTestId('phone-needs-confirm')).getByRole('button', { name: 'Start' }));
    const failures = await screen.findByTestId('phone-needs-failures');
    await waitFor(() => expect(screen.queryByTestId('phone-needs-progress')).toBeNull());
    expect(failures.textContent).toMatch(/Closet: no tap zone was added \(AI is down\)/);
    const kept = within(screen.getByTestId('phone-needs-review')).getAllByRole('listitem').map((li) => li.firstChild.textContent);
    expect(kept).toContain('Bank: new screen with its picture');
    expect(kept).toContain('Tap zone "bank" on Closet → Bank');
    expect(kept).toContain('Invitation: event_invite zone filled');
    expect(kept.some((t) => /→ Closet/.test(t))).toBe(false);
    expect(row('Closet').textContent).toMatch(/Exists but no tap zone/);
  });
});

describe('EpisodePhoneNeeds — theme', () => {
  test('colors are tokens only, and its text pairs hold 4.5:1', () => {
    const css = readFileSync(resolve(__dirname, 'EpisodePhoneNeeds.css'), 'utf8');
    const jsx = readFileSync(resolve(__dirname, 'EpisodePhoneNeeds.jsx'), 'utf8');
    expect(stripTaskRefs(css)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    const tokens = [readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8')];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'], ['--text-inverse', '--primary-dark'], ['--lala-lavender-text', '--surface-card'],
      ['--lala-lavender-text', '--lala-lavender-soft'], ['--accent-dark', '--accent-subtle'], ['--lala-ink-muted', '--lala-gold-soft'],
      ['--lala-ink', '--surface-card'], ['--lala-ink', '--lala-surface'], ['--lala-ink-muted', '--surface-card'],
      ['--danger-text', '--danger-bg'], ['--lala-danger', '--surface-card'],
    ]) {
      expect({ fg, bg, ratio: contrast(readToken(tokens, fg), readToken(tokens, bg)) >= 4.5 }).toEqual({ fg, bg, ratio: true });
    }
  });
});
