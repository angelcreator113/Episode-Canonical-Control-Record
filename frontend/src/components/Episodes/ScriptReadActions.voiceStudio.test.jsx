// The Script tab's Voice Studio link (B2): shown only while the server has
// Voice Studio switched on (GET /api/v1/voice-studio/status answers 200);
// while it is off (404) or the server can't be reached, no link appears.
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '../../services/api';
import { resetVoiceStudioStatus } from '../../lib/voiceStudioApi';
import ScriptReadActions from './ScriptReadActions';

const EP = '33333333-3333-4333-8333-333333333333';
const renderBar = () => render(<MemoryRouter><ScriptReadActions scriptText={'## BEAT: 1\nLala: "Hi."'} episodeId={EP} beatNumber={2} /></MemoryRouter>);

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  resetVoiceStudioStatus();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

test('switched on: the link opens this episode\'s Voice Studio at the open beat', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: { on: true } } });
  renderBar();
  const link = await screen.findByTestId('script-voice-studio');
  expect(link.getAttribute('href')).toBe(`/episodes/${EP}/voice?beat=2`);
  expect(vi.mocked(api.get)).toHaveBeenCalledWith('/api/v1/voice-studio/status');
});

test('switched off or unreachable: no link', async () => {
  vi.mocked(api.get).mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404, data: { code: 'VOICE_STUDIO_OFF' } } }));
  renderBar();
  await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalled());
  await Promise.resolve();
  expect(screen.queryByTestId('script-voice-studio')).toBeNull();
  expect(screen.getByTestId('script-teleprompter')).toBeTruthy();
});
