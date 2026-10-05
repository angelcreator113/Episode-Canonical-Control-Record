import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../../services/api';
import { LalaStatsCard, DecisionLogCard, StoryThreadsStrip, CastRow } from './CastContinuity';

const episodes = [
  { id: 'e1', episode_number: 1, title: 'Studio', evaluation_json: { tier_final: 'slay' } },
  { id: 'e4', episode_number: 4, title: 'Gala' },
];
const history = [
  { id: 'h1', episode_id: 'e1', episode_number: 1, episode_title: 'Studio', source: 'computed', deltas_json: { coins: 300, reputation: 2 }, notes: 'She nailed the brief' },
];
const charState = { state: { coins: 1900, reputation: 8, brand_trust: 7, influence: 7, stress: 6 } };
const edit = (over = {}) => ({ editing: false, form: {}, setForm: vi.fn(), open: vi.fn(), cancel: vi.fn(), save: vi.fn(), saving: false, ...over });
const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Cast & Continuity cards', () => {
  beforeEach(() => vi.mocked(api.get).mockClear());

  test('Lala\'s stats show their value, last change and a bar; coins need a goal for a bar; stress at 5 is an alarm', () => {
    const open = vi.fn();
    wrap(<LalaStatsCard charState={charState} history={history} episodes={episodes} coinGoal={null} edit={edit({ open })} />);
    const card = screen.getByTestId('cc-lala');
    expect(within(card).getByText('Main character · After Episode 1')).toBeTruthy();
    const rep = screen.getByTestId('cc-stat-reputation');
    expect(within(rep).getByText('Reputation')).toBeTruthy();
    expect(within(rep).getByText('+2')).toBeTruthy();
    expect(within(rep).getByText('8')).toBeTruthy();
    expect(within(rep).getByText('Last change: Episode 1 result (SLAY)')).toBeTruthy();
    expect(rep.querySelector('.wa-cc-bar span').style.width).toBe('80%');
    const coins = screen.getByTestId('cc-stat-coins');
    expect(within(coins).getByText('Prime Coins')).toBeTruthy();
    expect(within(coins).getByText('1,900')).toBeTruthy();
    expect(coins.querySelector('.wa-cc-bar')).toBeNull();
    expect(screen.getByTestId('cc-stat-stress').className).toContain('alarm');
    expect(within(screen.getByTestId('cc-stat-influence')).getByText('No change yet')).toBeTruthy();
    fireEvent.click(within(card).getByText('Edit stats'));
    expect(open).toHaveBeenCalled();
  });

  test('editing turns each stat into an input and saves through WorldAdmin', () => {
    const save = vi.fn();
    const setForm = vi.fn();
    wrap(<LalaStatsCard charState={charState} history={[]} episodes={[]} coinGoal={2000} edit={edit({ editing: true, save, setForm })} />);
    fireEvent.change(screen.getByLabelText('Reputation'), { target: { value: '9' } });
    expect(setForm).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Save'));
    expect(save).toHaveBeenCalled();
    expect(screen.getByTestId('cc-stat-coins').querySelector('.wa-cc-bar span').style.width).toBe('95%');
  });

  test('the decision log lists episode results with what they did to Lala', () => {
    wrap(<DecisionLogCard history={history} episodes={episodes} />);
    const log = screen.getByTestId('cc-decision-log');
    expect(within(log).getByText('Episode 1 · Result: SLAY')).toBeTruthy();
    expect(within(log).getByText('Studio').getAttribute('href')).toBe('/episodes/e1');
    expect(within(log).getByText('She nailed the brief')).toBeTruthy();
    expect(within(log).getByText('+300 coins')).toBeTruthy();
    expect(within(log).getByText('+2 rep')).toBeTruthy();
    expect(within(log).getByText('See all').getAttribute('href')).toBe('#cc-ledger');
  });

  test('the story threads strip squares each thread and marks a quiet one', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { threads: [
      { id: 't1', title: 'Her mother', status: 'open', slot_numbers: [1, 3], last_advanced_episode_id: 'e1' },
      { id: 't2', title: 'The rival', status: 'open', slot_numbers: [4], last_advanced_episode_id: 'e4' },
    ] } });
    wrap(<StoryThreadsStrip showId="show-1" episodes={episodes} />);
    const quiet = await screen.findByTestId('cc-thread-t1');
    expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/season/threads');
    expect(quiet.className).toContain('quiet');
    expect(within(quiet).getByText('Quiet for 3 episodes')).toBeTruthy();
    expect(quiet.querySelectorAll('.wa-cc-squares li')).toHaveLength(8);
    expect(quiet.querySelectorAll('.wa-cc-squares li.on')).toHaveLength(2);
    expect(within(screen.getByTestId('cc-thread-t2')).getByText('Came up in Episode 4')).toBeTruthy();
  });

  test('no threads says where threads are made', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    wrap(<StoryThreadsStrip showId="show-1" episodes={[]} />);
    await waitFor(() => expect(screen.getByText(/No story threads yet. Create them in Episodes → Season Plan./)).toBeTruthy());
  });

  test('the cast lists Lala and the narrator with a link to the registry', () => {
    wrap(<CastRow />);
    const cast = screen.getByTestId('cc-cast');
    expect(within(cast).getByText('Lala')).toBeTruthy();
    expect(within(cast).getByText('JustAWomanInHerPrime')).toBeTruthy();
    expect(within(cast).getByText('Open Character Registry').getAttribute('href')).toBe('/character-registry');
  });
});
