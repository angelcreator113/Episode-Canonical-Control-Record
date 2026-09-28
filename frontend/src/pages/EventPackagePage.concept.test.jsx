/**
 * Event Package — Event concept section (Task #2132, step 4b).
 *
 * The creation draft's concept, activity, keywords and styling brief shown
 * read-only, for planning. Labels follow doctrine rule 14: concept, activity
 * and the brief read Auto-drafted; keywords read Auto-drafted or Edited
 * against their saved copy. No draft, no section.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT_URL = '/api/v1/world/show-1/events/ev-1';

const BRIEF = {
  activity: 'A sculpt class on mats, then mingling',
  formality: 'casual',
  function_requirements: ['full range of movement', 'breathable fabric'],
  avoid: ['heels'],
  style_direction: 'Polished athleisure that goes straight from class to drinks.',
  environment: 'Open-air rooftop at sunset',
  footwear_requirements: 'clean training shoes',
};
const KEYWORDS = ['practical', 'modern', 'comfortable'];

// A from-profile event with a full creation draft (steps 1-4).
const draftedEvent = () => ({
  id: 'ev-1', show_id: 'show-1', name: 'Event with Maya Moves', event_type: 'invite', prestige: 6,
  event_date: '2026-11-12', event_time: '18:30',
  description: 'A golden-hour sculpt session to close out summer.',
  dress_code: 'Sleek performance activewear',
  dress_code_keywords: [...KEYWORDS],
  category: 'fitness', format: 'workout_class',
  updated_at: '2026-09-28T10:00:00.000Z',
  canon_consequences: { automation: {
    started_from_profile_id: 42, event_date_auto: '2026-11-12',
    concept: 'A sunset sculpt workout that ends in a recovery social.',
    activity: 'Guests take a guided rooftop sculpt class, then stretch and share mocktails.',
    styling_brief: { ...BRIEF },
    auto_drafted: {
      description: 'ai_draft', concept: 'ai_draft', activity: 'ai_draft',
      dress_code: 'ai_draft', dress_code_keywords: 'ai_draft', styling_brief: 'ai_draft',
      category: 'ai_draft', format: 'ai_draft', event_time: 'ai_draft',
    },
    drafted_values: {
      description: 'A golden-hour sculpt session to close out summer.',
      dress_code: 'Sleek performance activewear',
      dress_code_keywords: [...KEYWORDS],
      category: 'fitness', format: 'workout_class', event_time: '18:30',
    },
  } },
});

let stored;

function payload() {
  return {
    success: true, event: stored, sourceProfile: null, startedFromProfile: null,
    sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
      <Routes>
        <Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('EventPackagePage — Event concept (Task #2132)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    stored = draftedEvent();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === EVENT_URL) return { data: payload() };
      return { data: { success: true, deliverables: [], locked: false } };
    });
  });

  test('a full draft shows every item, labelled, under a not-for-guests subtitle', async () => {
    renderPage();
    const section = await screen.findByTestId('event-concept');
    expect(within(section).getByText('Event concept')).toBeTruthy();
    expect(within(section).getByText('For planning; not shown to guests')).toBeTruthy();

    expect(within(section).getByText('A sunset sculpt workout that ends in a recovery social.')).toBeTruthy();
    expect(within(section).getByText(/Guests take a guided rooftop sculpt class/)).toBeTruthy();
    for (const k of KEYWORDS) expect(within(section).getByText(k)).toBeTruthy();
    expect(within(section).getByText('casual')).toBeTruthy();
    expect(within(section).getByText(BRIEF.style_direction)).toBeTruthy();
    expect(within(section).getByText('full range of movement · breathable fabric')).toBeTruthy();
    expect(within(section).getByText('heels')).toBeTruthy();
    expect(within(section).getByText(BRIEF.environment)).toBeTruthy();
    expect(within(section).getByText(BRIEF.footwear_requirements)).toBeTruthy();

    for (const id of ['concept-concept', 'concept-activity', 'concept-keywords', 'concept-brief']) {
      expect(screen.getByTestId(id).getAttribute('class')).toContain('is-auto_drafted');
      expect(screen.getByTestId(`${id}-state`).textContent).toContain('Auto-drafted · AI draft');
    }
    expect(screen.queryByTestId('concept-brief-stale')).toBeNull();
  });

  test('a partial draft (concept only, no styling) shows only what exists', async () => {
    const ev = draftedEvent();
    delete ev.canon_consequences.automation.activity;
    delete ev.canon_consequences.automation.styling_brief;
    ev.dress_code_keywords = [];
    delete ev.canon_consequences.automation.drafted_values.dress_code_keywords;
    stored = ev;
    renderPage();
    await screen.findByTestId('event-concept');
    expect(screen.getByTestId('concept-concept')).toBeTruthy();
    for (const id of ['concept-activity', 'concept-keywords', 'concept-brief']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  test('a brief without environment or footwear omits those lines', async () => {
    const ev = draftedEvent();
    delete ev.canon_consequences.automation.styling_brief.environment;
    delete ev.canon_consequences.automation.styling_brief.footwear_requirements;
    stored = ev;
    renderPage();
    await screen.findByTestId('concept-brief');
    expect(screen.queryByTestId('concept-brief-environment')).toBeNull();
    expect(screen.queryByTestId('concept-brief-footwear')).toBeNull();
  });

  test('no draft: no section at all', async () => {
    stored = {
      id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', event_type: 'invite', prestige: 6,
      event_date: '2026-11-09', updated_at: '2026-09-25T10:00:00.000Z',
      canon_consequences: { automation: { source: 'opportunity_pipeline' } },
    };
    renderPage();
    await screen.findByTestId('basics-category');
    expect(screen.queryByTestId('event-concept')).toBeNull();
    expect(screen.queryByText('Event concept')).toBeNull();
  });

  test('keywords: Edited once they differ from the saved copy; unlabelled when never drafted', async () => {
    const edited = draftedEvent();
    edited.dress_code_keywords = ['practical', 'bold'];
    stored = edited;
    const { unmount } = renderPage();
    await screen.findByTestId('concept-keywords');
    expect(screen.getByTestId('concept-keywords').getAttribute('class')).toContain('is-edited');
    expect(screen.getByTestId('concept-keywords-state').textContent).toContain('Edited');
    unmount();

    const never = draftedEvent();
    delete never.canon_consequences.automation.auto_drafted.dress_code_keywords;
    delete never.canon_consequences.automation.drafted_values.dress_code_keywords;
    stored = never;
    renderPage();
    await screen.findByTestId('concept-keywords');
    expect(screen.queryByTestId('concept-keywords-state')).toBeNull();
  });

  test('the stale-brief line appears only when the dress code reads Edited', async () => {
    const ev = draftedEvent();
    ev.dress_code = 'All white athleisure';
    stored = ev;
    renderPage();
    await screen.findByTestId('concept-brief');
    expect(screen.getByTestId('basics-dressCode').getAttribute('data-state')).toBe('edited');
    expect(screen.getByTestId('concept-brief-stale').textContent).toBe('Drafted with the original dress code.');
  });

  test('nothing in the section is editable', async () => {
    renderPage();
    const section = await screen.findByTestId('event-concept');
    expect(section.querySelectorAll('input, textarea, select, button, [contenteditable="true"]').length).toBe(0);
  });
});
