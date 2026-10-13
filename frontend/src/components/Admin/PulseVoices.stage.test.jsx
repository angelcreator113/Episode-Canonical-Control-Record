/**
 * Admin › The Pulse › Voices › stage (Task 3030; Evoni, 2026-10-12): each
 * card says the character's stage and what it lets them do. Active posts;
 * Alive also talks in DMs, moves relationships and reacts to events.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import PulseVoices, { stageText } from './PulseVoices';

const row = (over) => ({ registry_character_id: 'c1', display_name: 'Marcus', depth_level: 'alive', handle: 'marcus.k', social_profile_id: 3, voice: null, needs_rebuild: false, ...over });

beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

describe('stage', () => {
  test('stageText: Active posts only; Alive also talks, relates and reacts', () => {
    expect(stageText('active')).toBe('Active: posts only. Alive also talks, relates and reacts to events');
    expect(stageText('alive')).toBe('Alive: posts, and also talks, relates and reacts to events');
    expect(stageText(undefined)).toBe('');
  });

  test('each card shows its stage', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, banned_phrases: [], characters: [row({}), row({ registry_character_id: 'c2', display_name: 'Nia', handle: 'nia', depth_level: 'active' })] } });
    render(<PulseVoices showId="show-1" />);
    const [marcus, nia] = await screen.findAllByTestId('pulse-voices-card');
    expect(within(marcus).getByTestId('pulse-voices-stage').textContent).toMatch(/^Alive: /);
    expect(within(nia).getByTestId('pulse-voices-stage').textContent).toMatch(/^Active: posts only/);
  });
});
