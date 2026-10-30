/**
 * Voice from footage (Voice plan V2; Evoni, 2026-10-30) on the Files page:
 * an admin sees each Lala clip's voice line while it is switched on; other
 * lanes and other people see none; Prepare Voice queues an existing clip
 * (such as 4481.mp4) and its line follows the job.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../lib/rawClipsApi', async () => {
  const actual = await vi.importActual('../../lib/rawClipsApi');
  return {
    ...actual,
    rawClipsApi: { list: vi.fn(), upload: vi.fn(), update: vi.fn(), removeGreen: vi.fn(), remove: vi.fn(), beats: vi.fn() },
  };
});
vi.mock('../../lib/voiceFootageApi', async () => {
  const actual = await vi.importActual('../../lib/voiceFootageApi');
  return { ...actual, voiceFootageApi: { status: vi.fn(), prepare: vi.fn() } };
});

import { rawClipsApi } from '../../lib/rawClipsApi';
import { voiceFootageApi, voiceLine } from '../../lib/voiceFootageApi';
import AuthContext from '../../contexts/AuthContext';
import EpisodeRawFootageTab from './EpisodeRawFootageTab';

const CLIPS = [
  { id: 'old', performer: 'lala', label: '4481.mp4', url_raw: 'https://x/o.mp4', key_status: 'done' },
  { id: 'new', performer: 'lala', label: 'take 2', url_raw: 'https://x/n.mp4', key_status: 'done' },
  { id: 'jaw', performer: 'justawoman', label: 'Intro', url_raw: 'https://x/j.mp4', key_status: 'none' },
];
const ADMIN = { user: { groups: ['admin'] } };
const renderTab = (auth = ADMIN) => render(<AuthContext.Provider value={auth}><EpisodeRawFootageTab episode={{ id: 'ep-1' }} /></AuthContext.Provider>);
const cardOf = (label) => screen.getAllByTestId('erf-clip').find((c) => within(c).queryByText(label));

describe('voiceLine', () => {
  test('words for every state; Prepare Voice only when there is nothing running or ready', () => {
    expect(voiceLine(undefined)).toEqual({ tone: 'none', text: 'Voice not prepared yet', canPrepare: true });
    expect(voiceLine({ status: 'queued' })).toMatchObject({ text: "Lala's voice: waiting for the voice worker", canPrepare: false });
    expect(voiceLine({ status: 'queued', waiting_for_retry: true })).toMatchObject({ text: "Lala's voice: trying again shortly" });
    expect(voiceLine({ status: 'running' })).toMatchObject({ text: "Preparing Lala's voice…", canPrepare: false });
    expect(voiceLine({ status: 'succeeded' })).toMatchObject({ tone: 'ok', text: 'Voice ready for Voice Studio', canPrepare: false });
    expect(voiceLine({ status: 'failed', error: 'This clip has no sound, so there is no voice to prepare.' }))
      .toEqual({ tone: 'bad', text: 'Voice not prepared: This clip has no sound, so there is no voice to prepare.', canPrepare: true });
    expect(voiceLine({ status: 'cancelled' })).toMatchObject({ canPrepare: true });
  });
});

describe('the voice line on Lala clip cards', () => {
  beforeEach(() => {
    Object.values(rawClipsApi).forEach((fn) => fn.mockReset());
    Object.values(voiceFootageApi).forEach((fn) => fn.mockReset());
    rawClipsApi.list.mockResolvedValue(CLIPS);
    rawClipsApi.beats.mockResolvedValue([]);
    voiceFootageApi.status.mockResolvedValue({ new: { status: 'succeeded', attempt: 1 } });
  });

  test("an admin, switched on: Lala's cards show their voice; JustAWoman's card shows none", async () => {
    renderTab();
    await waitFor(() => expect(screen.getAllByTestId('erf-voice')).toHaveLength(2));
    expect(within(cardOf('take 2')).getByTestId('erf-voice').textContent).toContain('Voice ready for Voice Studio');
    expect(within(cardOf('4481.mp4')).getByTestId('erf-voice').textContent).toContain('Voice not prepared yet');
    expect(within(cardOf('Intro')).queryByTestId('erf-voice')).toBeNull();
    expect(voiceFootageApi.status).toHaveBeenCalledWith('ep-1');
  });

  test('Prepare Voice on footage from before (4481.mp4): queued, and the line says it waits for the worker', async () => {
    voiceFootageApi.prepare.mockResolvedValue({ id: 'j1', clip_id: 'old', status: 'queued', attempt: 1 });
    renderTab();
    const button = await waitFor(() => within(cardOf('4481.mp4')).getByTestId('erf-prepare-voice'));
    expect(within(cardOf('take 2')).queryByTestId('erf-prepare-voice')).toBeNull();
    fireEvent.click(button);
    await waitFor(() => expect(voiceFootageApi.prepare).toHaveBeenCalledWith('ep-1', 'old'));
    await waitFor(() => expect(within(cardOf('4481.mp4')).getByTestId('erf-voice').textContent).toContain("Lala's voice: waiting for the voice worker"));
    expect(within(cardOf('4481.mp4')).queryByTestId('erf-prepare-voice')).toBeNull();
  });

  test('a failure shows its reason and offers Prepare Voice again', async () => {
    voiceFootageApi.status.mockResolvedValue({ old: { status: 'failed', attempt: 3, error: 'The original video could not be found in storage.' } });
    renderTab();
    await waitFor(() => expect(within(cardOf('4481.mp4')).getByTestId('erf-voice').textContent).toContain('Voice not prepared: The original video could not be found in storage.'));
    expect(within(cardOf('4481.mp4')).getByTestId('erf-prepare-voice')).toBeTruthy();
  });

  test('switched off (the server answers 404): no voice line anywhere', async () => {
    voiceFootageApi.status.mockResolvedValue(null);
    renderTab();
    await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(3));
    await waitFor(() => expect(voiceFootageApi.status).toHaveBeenCalled());
    expect(screen.queryByTestId('erf-voice')).toBeNull();
  });

  test('not an admin: no voice line, and the status is not even asked', async () => {
    renderTab({ user: { groups: ['editor'] } });
    await waitFor(() => expect(screen.getAllByTestId('erf-clip')).toHaveLength(3));
    expect(screen.queryByTestId('erf-voice')).toBeNull();
    expect(voiceFootageApi.status).not.toHaveBeenCalled();
  });

  test('Prepare Voice refused by the server: its words are shown, nothing else changes', async () => {
    voiceFootageApi.prepare.mockRejectedValue({ response: { data: { error: "Voice is prepared only for Lala's footage for now." } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderTab();
    fireEvent.click(await waitFor(() => within(cardOf('4481.mp4')).getByTestId('erf-prepare-voice')));
    expect((await screen.findByRole('alert')).textContent).toContain("Voice is prepared only for Lala's footage for now.");
    expect(within(cardOf('4481.mp4')).getByTestId('erf-voice').textContent).toContain('Voice not prepared yet');
  });
});
