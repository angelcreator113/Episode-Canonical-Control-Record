/**
 * useEventFlow (Evoni, 2026-10-25): the setup list keeps what it showed and
 * ticks it off as it is filled in, the way back reads "Done" once nothing is
 * left, and each jump goes where the entry is set (what Continue opens, or
 * the section), focusing it once it has scrolled.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import { computeEventPackageReadiness } from '../../utils/eventReadinessSections';
import useEventFlow from './useEventFlow';

const BASE = {
  id: 'ev-1', name: 'Fabric and Form', category: 'arts_entertainment', format: 'gala', event_date: '2026-11-12',
  host_brand: 'Studio by Sable', canon_consequences: { automation: {} },
};

function setup(entry = '/shows/show-1/events/ev-1?from=roadmap:5') {
  const continueTo = vi.fn();
  const jumpToSection = vi.fn();
  const openOrganizerPicker = vi.fn();
  const props = (event) => ({
    showId: 'show-1', eventId: 'ev-1', event, seasonContext: null, readiness: computeEventPackageReadiness(event),
    used: false, usedInEpisode: null, hasOrganizer: true, hasInvitation: !!event.invitation_asset_id, moneyPending: false,
    continueTo, jumpToSection, openOrganizerPicker,
  });
  const wrapper = ({ children }) => <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>;
  const hook = renderHook((p) => useEventFlow(p), { initialProps: props(BASE), wrapper });
  return { ...hook, props, continueTo, jumpToSection, openOrganizerPicker };
}

describe('useEventFlow', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockResolvedValue({ data: {} });
  });
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  test('entries tick off as they are filled in, and the way back then reads Done', () => {
    const { result, rerender, props } = setup();
    expect(result.current.sections.map((s) => [s.key, s.done])).toEqual([['place', false], ['invitation', false]]);
    expect(result.current.back.label).toBe('Back to E5 on the Roadmap');

    rerender(props({ ...BASE, venue_location_id: 'loc-1' }));
    expect(result.current.sections.map((s) => [s.key, s.done])).toEqual([['place', true], ['invitation', false]]);
    expect(result.current.leftToSetUp).toBe(1);

    rerender(props({ ...BASE, venue_location_id: 'loc-1', invitation_asset_id: 'a-1' }));
    expect(result.current.sections.every((s) => s.done)).toBe(true);
    expect(result.current.back).toMatchObject({ label: 'Done · back to E5 on the Roadmap', href: '/shows/show-1/season?tab=roadmap&slot=5', done: true });
    expect(result.current.stage.current).toBe('ready');
  });

  test('a jump opens what Continue opens for it, then focuses its section unless something took focus', () => {
    vi.useFakeTimers();
    const section = document.createElement('section');
    section.id = 'epp-sec-place';
    document.body.appendChild(section);
    const { result, continueTo } = setup();
    act(() => result.current.jump(result.current.sections[0]));
    expect(continueTo).toHaveBeenCalledWith(expect.objectContaining({ section: 'place', key: 'venue' }));
    act(() => { vi.advanceTimersByTime(100); });
    expect(document.activeElement).toBe(section);
    expect(section.getAttribute('tabindex')).toBe('-1');
  });

  test('the invitation and deal prices jump to their sections; a reason\'s action runs its step', () => {
    const { result, jumpToSection, openOrganizerPicker, continueTo } = setup();
    act(() => result.current.jump(result.current.sections[1]));
    expect(jumpToSection).toHaveBeenCalledWith('invitation');
    act(() => result.current.runAction({ target: { section: 'stakes', key: 'prices', label: 'Deal prices' } }));
    expect(jumpToSection).toHaveBeenCalledWith('deal');
    act(() => result.current.runAction({ target: 'organizer' }));
    expect(openOrganizerPicker).toHaveBeenCalled();
    act(() => result.current.runAction(result.current.reasons.start.action));
    expect(continueTo).toHaveBeenCalledWith(expect.objectContaining({ section: 'place', key: 'venue' }));
  });

  test('a ticked entry still goes to its section', () => {
    const { result, rerender, props, jumpToSection } = setup();
    rerender(props({ ...BASE, venue_location_id: 'loc-1' }));
    act(() => result.current.jump(result.current.sections[0]));
    expect(jumpToSection).toHaveBeenCalledWith('place');
  });

  test('not in a slot: no roadmap or schedule is read', () => {
    setup();
    const urls = vi.mocked(api.get).mock.calls.map(([u]) => u);
    expect(urls).toEqual(['/api/v1/world/show-1/season/goal-coverage?event_id=ev-1']);
  });
});
