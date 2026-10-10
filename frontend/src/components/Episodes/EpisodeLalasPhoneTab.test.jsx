/**
 * EpisodeLalasPhoneTab — Production → Phone is Lala's Phone (issue #1908).
 *
 * Covers: the tab leads with Preview Phone and the phone's current content;
 * the deferred requirements notice renders (no beat-derived requirements
 * are invented); missions are a section and their is_active toggle still
 * PUTs to the unchanged missions API; the MissionEditor jump still opens.
 */

import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The tab's header links to Phone Studio (Task #1994), so it renders inside a router.
const render = (ui) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

// MissionEditor is the existing full-CRUD modal; stub it so the test sees
// whether the tab opens it, without pulling its own fetches in.
vi.mock('../phone-editor/MissionEditor', () => ({
  default: ({ open, showId, episodeId }) => (open
    ? <div data-testid="mission-editor">editor {showId} {episodeId}</div>
    : null),
}));

import api from '../../services/api';
import EpisodeLalasPhoneTab, {
  listEpisodePhoneOverlaysApi,
  listEpisodeFeedMomentsApi,
  splitPhoneOverlays,
  screenForMoment,
} from './EpisodeLalasPhoneTab';

const EPISODE = { id: 'ep-1', show_id: 's-1', title: 'Ep 1' };

const OVERLAYS = [
  { id: 'home', name: 'Home', category: 'phone', is_home: true, generated: true, url: 'https://x/home.png', asset_id: 'a-home', screen_links: [{ id: 'z1' }, { id: 'z2' }], content_zones: [] },
  { id: 'dms', name: 'DMs', category: 'phone', generated: true, url: 'https://x/dms.png', asset_id: 'a-dms', screen_links: null, content_zones: [{ id: 'c1' }] },
  { id: 'camera', name: 'Camera', category: 'phone', generated: false, url: null },
  { id: 'dm_icon', name: 'DM Icon', category: 'phone_icon', generated: true, url: 'https://x/i.png', asset_id: 'a-i' },
  { id: 'hud', name: 'HUD Bar', category: 'production', generated: true, url: 'https://x/hud.png', asset_id: 'a-hud' },
];

const MOMENTS = [
  { id: 'm1', phone_screen_type: 'dm', trigger_handle: '@bestie', screen_content: 'Are you going tonight?' },
  { id: 'm2', phone_screen_type: 'notification', screen_content: 'New follower' },
];

const MISSIONS = [
  {
    id: 'mis-1', name: 'Find the invite', description: null, icon_url: null,
    start_condition: null, objectives: [{ key: 'saw_invite', op: 'eq', value: true }],
    reward_actions: [], display_order: 0, episode_id: 'ep-1', is_active: true,
  },
  {
    id: 'mis-2', name: 'Follow Lala', description: 'Show-wide onboarding', icon_url: null,
    start_condition: null, objectives: [], reward_actions: [], display_order: 1,
    episode_id: null, is_active: false,
  },
];

function mockGets({ overlays = OVERLAYS, moments = MOMENTS, missions = MISSIONS } = {}) {
  vi.mocked(api.get).mockImplementation((url) => {
    if (url.startsWith('/api/v1/ui-overlays/s-1/missions')) {
      return Promise.resolve({ data: { success: true, missions } });
    }
    if (url.startsWith('/api/v1/ui-overlays/s-1')) {
      return Promise.resolve({ data: { success: true, data: overlays } });
    }
    if (url.startsWith('/api/v1/feed-enhanced/s-1/moments/ep-1')) {
      return Promise.resolve({ data: { success: true, data: moments } });
    }
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

describe('EpisodeLalasPhoneTab — module-scope helpers', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  test('listEpisodePhoneOverlaysApi GETs the episode-scoped overlay list', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'x' }] } });
    const out = await listEpisodePhoneOverlaysApi('s-1', 'ep-1');
    expect(api.get).toHaveBeenCalledWith('/api/v1/ui-overlays/s-1?episode_id=ep-1');
    expect(out).toEqual([{ id: 'x' }]);
  });

  test('listEpisodeFeedMomentsApi GETs the episode feed moments', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    await listEpisodeFeedMomentsApi('s-1', 'ep-1');
    expect(api.get).toHaveBeenCalledWith('/api/v1/feed-enhanced/s-1/moments/ep-1');
  });

  test('splitPhoneOverlays keeps phone screens and icons, drops non-phone overlays', () => {
    const out = splitPhoneOverlays(OVERLAYS);
    expect(out.screens.map(s => s.id)).toEqual(['home', 'dms']);
    expect(out.missingScreens.map(s => s.id)).toEqual(['camera']);
    expect(out.icons.map(s => s.id)).toEqual(['dm_icon']);
    expect(out.missingIcons).toEqual([]);
  });

  // One rule with Producer Mode (lib/overlayUtils, Evoni 2026-10-07): a
  // screen there is a screen here, whatever its category says.
  test('splitPhoneOverlays counts a screen the way Producer Mode does', () => {
    const out = splitPhoneOverlays([{ id: 'app', category: 'phone_app', generated: true }, { id: 'legacy', category: 'icon', generated: true }]);
    expect(out.screens.map(s => s.id)).toEqual(['app']);
    expect(out.icons.map(s => s.id)).toEqual(['legacy']);
  });
});

describe('EpisodeLalasPhoneTab — render', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  test('marks a screen that is this episode\'s own override (Task #1920)', async () => {
    mockGets({
      overlays: [
        { id: 'home', name: 'Home', category: 'phone', is_home: true, generated: true, url: 'https://x/home.png', asset_id: 'a-home', is_episode_override: false },
        { id: 'camera', name: 'Camera', category: 'phone', generated: true, url: 'https://x/cam-ep.png', asset_id: 'a-cam-ep', is_episode_override: true },
      ],
    });
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    const camera = (await screen.findByText('Camera')).closest('li');
    expect(within(camera).getByText('THIS EPISODE')).toBeTruthy();
    const home = screen.getByText('Home', { selector: '.lalas-phone-screen-name' }).closest('li');
    expect(within(home).queryByText('THIS EPISODE')).toBeNull();
    const list = camera.closest('ul');
    expect(within(list).getAllByText('THIS EPISODE')).toHaveLength(1);
  });

  // Evoni's Episode mock (2026-10-06): "Lala's Phone in this episode", and
  // Play through under the list.
  test('Play through, under the list, calls onPreview', async () => {
    mockGets();
    const onPreview = vi.fn();
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={onPreview} />);
    expect(screen.getByRole('heading', { level: 2, name: "Lala's Phone in this episode" })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Play through/ }));
    expect(onPreview).toHaveBeenCalledTimes(1);
    await screen.findByText('Find the invite');
  });

  test('shows what is on the phone: screens, icons, home, not-generated count, feed moments', async () => {
    mockGets();
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    expect(await screen.findByText('2 screens')).toBeTruthy();
    expect(screen.getByText('1 icons')).toBeTruthy();
    expect(screen.getByText('Home: Home')).toBeTruthy();
    expect(screen.getByText('1 not generated yet')).toBeTruthy();
    expect(screen.getByText('2 tap zones · 0 content zones')).toBeTruthy();
    expect(screen.queryByText('HUD Bar')).toBeNull();
    expect(await screen.findByText('Are you going tonight?')).toBeTruthy();
    expect(screen.getByText('@bestie')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/ui-overlays/s-1?episode_id=ep-1');
    // Never touches the playthrough route, whose GET creates a row.
    expect(vi.mocked(api.get).mock.calls.some(([u]) => u.includes('/phone-state'))).toBe(false);
  });

  test('renders the deferred requirements notice and no invented requirements', async () => {
    mockGets();
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    const notice = screen.getByTestId('lalas-phone-deferred');
    expect(notice.textContent).toMatch(/Requirements appear once beats exist/);
    expect(within(notice).queryAllByRole('listitem')).toHaveLength(0);
    await screen.findByText('Find the invite');
  });

  test('empty states render when nothing is on the phone yet', async () => {
    mockGets({ overlays: [], moments: [], missions: [] });
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    expect(await screen.findByText(/No phone screens are generated/)).toBeTruthy();
    expect(await screen.findByText(/No feed moments are saved/)).toBeTruthy();
    expect(await screen.findByText('No missions yet.')).toBeTruthy();
    expect(screen.getByTestId('lalas-phone-deferred')).toBeTruthy();
  });

  test('a failed overlay load shows an error but the rest of the tab still renders', async () => {
    vi.mocked(api.get).mockImplementation((url) => {
      if (url.startsWith('/api/v1/ui-overlays/s-1/missions')) return Promise.resolve({ data: { missions: MISSIONS } });
      if (url.startsWith('/api/v1/ui-overlays/s-1')) return Promise.reject(new Error('boom'));
      return Promise.resolve({ data: { data: [] } });
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    expect(await screen.findByText('Error: boom')).toBeTruthy();
    expect(await screen.findByText('Find the invite')).toBeTruthy();
    expect(screen.getByTestId('lalas-phone-deferred')).toBeTruthy();
    spy.mockRestore();
  });
});

describe('EpisodeLalasPhoneTab — missions section still works', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  test('missions list from the unchanged missions API, as a section', async () => {
    mockGets();
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    const section = screen.getByRole('region', { name: 'Missions' });
    expect(await within(section).findByText('Find the invite')).toBeTruthy();
    expect(within(section).getByText('Follow Lala')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/ui-overlays/s-1/missions?episode_id=ep-1');
  });

  test('the is_active toggle PUTs the flipped flag and updates the row', async () => {
    mockGets();
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    await screen.findByText('Find the invite');
    fireEvent.click(screen.getByTitle('Deactivate this mission'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe('/api/v1/ui-overlays/s-1/missions/mis-1');
    expect(body).toMatchObject({
      name: 'Find the invite',
      objectives: MISSIONS[0].objectives,
      episode_id: 'ep-1',
      is_active: false,
    });
    expect(await screen.findAllByTitle('Activate this mission')).toHaveLength(2);
  });

  test('activating an inactive show-wide mission sends is_active true', async () => {
    mockGets();
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    await screen.findByText('Follow Lala');
    fireEvent.click(screen.getByTitle('Activate this mission'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe('/api/v1/ui-overlays/s-1/missions/mis-2');
    expect(body).toMatchObject({ episode_id: null, is_active: true });
  });

  // No show-level missions (Evoni, 2026-10-07, Lala's Phone step 2): an
  // older show-wide one says so and can be moved to this episode.
  test('an older show-wide mission is marked, and Move to this episode gives it this episode', async () => {
    mockGets();
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    await screen.findByText('Follow Lala');
    expect(screen.getByText('ALL EPISODES (OLDER)')).toBeTruthy();
    expect(screen.getByTestId('missions-older').textContent).toBe('1 older, on all episodes');
    fireEvent.click(screen.getByTestId('mission-move-mis-2'));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe('/api/v1/ui-overlays/s-1/missions/mis-2');
    expect(body).toMatchObject({ name: 'Follow Lala', episode_id: 'ep-1' });
    await waitFor(() => expect(screen.queryByText('ALL EPISODES (OLDER)')).toBeNull());
  });

  test('Manage missions opens MissionEditor scoped to this episode', async () => {
    mockGets();
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    await screen.findByText('Find the invite');
    expect(screen.queryByTestId('mission-editor')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Manage missions/ }));
    expect(screen.getByTestId('mission-editor').textContent).toBe('editor s-1 ep-1');
  });

  // Evoni's Episode mock (2026-10-06): one row per screen; a row shows its
  // screen on the phone ("Showing: …"), and a screen not built yet is listed.
  test('a row per screen with its state; picking one shows it on the phone', async () => {
    mockGets();
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    const home = (await screen.findByText('Home', { selector: '.lalas-phone-screen-name' })).closest('li');
    expect(within(home).getByText('Ready')).toBeTruthy();
    expect(within(home).getByText('Screen · show default')).toBeTruthy();
    expect(home.className).toContain('is-shown');
    expect(screen.getByTestId('lalas-phone-showing').textContent).toBe('Showing: Home');
    const camera = screen.getByText('Camera', { selector: '.lalas-phone-screen-name' }).closest('li');
    expect(camera.className).toContain('is-missing');
    expect(within(camera).getByText('To build')).toBeTruthy();
    const dms = screen.getByText('DMs', { selector: '.lalas-phone-screen-name' }).closest('li');
    fireEvent.click(within(dms).getByRole('button'));
    expect(screen.getByTestId('lalas-phone-showing').textContent).toBe('Showing: DMs');
    expect(dms.className).toContain('is-shown');
    expect(within(dms).getByRole('button').getAttribute('aria-pressed')).toBe('true');
    await screen.findByText('Find the invite');
  });
});

// #2855: a feed-moment row opens the screen whose content zone draws it
// (ScreenContentRenderer: dm_thread draws 'dm', notifications draws
// 'notification'); a moment no screen draws says so and links to the studio.
describe('EpisodeLalasPhoneTab — feed-moment rows open their screen (#2855)', () => {
  const ZONED = [
    { id: 'home', name: 'Home', category: 'phone', is_home: true, generated: true, url: 'https://x/home.png', asset_id: 'a-home', content_zones: [{ id: 'n1', content_type: 'notifications' }] },
    { id: 'dms', name: 'DMs', category: 'phone', generated: true, url: 'https://x/dms.png', asset_id: 'a-dms', content_zones: [{ id: 'c1', content_type: 'dm_thread' }] },
    { id: 'feed', name: 'Feed', category: 'phone', generated: true, url: 'https://x/feed.png', asset_id: 'a-feed', content_zones: [{ id: 'f1', content_type: 'feed_posts' }] },
  ];
  const ZONED_MOMENTS = [
    { id: 'm1', phone_screen_type: 'dm', trigger_handle: '@bestie', screen_content: 'Are you going tonight?' },
    { id: 'm2', phone_screen_type: 'notification', screen_content: 'New follower' },
    { id: 'm3', phone_screen_type: 'story', screen_content: 'Lala posted a story' },
  ];

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  test('screenForMoment picks the screen whose content zone draws the type, home first', () => {
    expect(screenForMoment({ phone_screen_type: 'dm' }, ZONED).id).toBe('dms');
    expect(screenForMoment({ phone_screen_type: 'notification' }, ZONED).id).toBe('home');
    const twoNotif = [{ ...ZONED[2], content_zones: [{ content_type: 'notifications' }] }, ZONED[0]];
    expect(screenForMoment({ phone_screen_type: 'notification' }, twoNotif).id).toBe('home');
    expect(screenForMoment({ phone_screen_type: 'story' }, ZONED)).toBeNull();
    expect(screenForMoment({ phone_screen_type: 'post' }, ZONED)).toBeNull();
    expect(screenForMoment({}, ZONED)).toBeNull();
    expect(screenForMoment({ phone_screen_type: 'dm' }, [])).toBeNull();
  });

  test('clicking a moment row shows its screen on the phone', async () => {
    mockGets({ overlays: ZONED, moments: ZONED_MOMENTS });
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    const dmRow = (await screen.findByText('Are you going tonight?')).closest('button');
    expect(dmRow).toBeTruthy();
    expect(within(dmRow).getByText('on DMs')).toBeTruthy();
    expect(dmRow.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('lalas-phone-showing').textContent).toBe('Showing: Home');
    fireEvent.click(dmRow);
    expect(screen.getByTestId('lalas-phone-showing').textContent).toBe('Showing: DMs');
    expect(dmRow.getAttribute('aria-pressed')).toBe('true');
    expect(dmRow.closest('li').className).toContain('is-shown');
    // The notification row points at Home, which is no longer shown.
    const notifRow = screen.getByText('New follower').closest('button');
    expect(notifRow.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(notifRow);
    expect(screen.getByTestId('lalas-phone-showing').textContent).toBe('Showing: Home');
  });

  test('a moment no screen draws says so and links to the studio, with no button', async () => {
    mockGets({ overlays: ZONED, moments: ZONED_MOMENTS });
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    const storyRow = (await screen.findByText('Lala posted a story')).closest('li');
    expect(storyRow.className).toContain('is-unplaced');
    expect(within(storyRow).queryByRole('button')).toBeNull();
    expect(within(storyRow).getByText(/No screen on this phone shows story moments yet/)).toBeTruthy();
    const link = within(storyRow).getByRole('link', { name: /Build one in Producer Mode/ });
    expect(link.getAttribute('href')).toBe('/shows/s-1/world?tab=overlays-tab');
  });
});

// #2867: a screen to build links to the Phone Hub at that screen.
describe('EpisodeLalasPhoneTab — To build rows open the Phone Hub at their screen (#2867)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  test('the To build row is a link carrying the screen id', async () => {
    mockGets();
    render(<EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />);
    const camera = (await screen.findByText('Camera', { selector: '.lalas-phone-screen-name' })).closest('li');
    expect(within(camera).getByText('To build')).toBeTruthy();
    const link = within(camera).getByRole('link');
    expect(link.getAttribute('href')).toBe('/shows/s-1/world?tab=overlays-tab&screen=camera');
    expect(within(link).getByText('Generate in Phone Hub →')).toBeTruthy();
  });
});
