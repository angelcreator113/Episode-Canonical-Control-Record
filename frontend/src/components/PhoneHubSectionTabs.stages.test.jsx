/**
 * PhoneHubSectionTabs — the stage row (Task #2010, doctrine rule 18).
 *
 * Build · Connect · Content · Preview · Advanced ▾, each mapped onto an
 * existing activeTab key: Build → screens (Screens | Icons toggle under it,
 * with today's counts), Connect → zones, Content → content, Preview →
 * preview, Advanced ▾ → a menu holding Missions.
 */

import React from 'react';
import { vi, describe, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import PhoneHubSectionTabs from './PhoneHubSectionTabs';

afterEach(() => cleanup());

function renderRow(props = {}) {
  const onChangeTab = vi.fn();
  const utils = render(
    <PhoneHubSectionTabs activeTab="screens" onChangeTab={onChangeTab} screenCount={4} iconCount={2} showPreview {...props} />,
  );
  return { ...utils, onChangeTab };
}

const stageRow = () => within(document.querySelector('.phone-hub-stage-row'));

describe('PhoneHubSectionTabs — stages (Task #2010)', () => {
  test('the row reads Build · Connect · Content · Preview · Advanced, not the old tab names', () => {
    renderRow();
    const labels = stageRow().getAllByRole('button').map(b => b.textContent.trim());
    expect(labels).toEqual(['Build', 'Connect', 'Content', 'Preview', 'Advanced']);
    expect(stageRow().queryByText('Zones')).toBeNull();
    expect(stageRow().queryByText('Missions')).toBeNull();
  });

  test.each([
    ['Connect', 'zones'],
    ['Content', 'content'],
    ['Preview', 'preview'],
  ])('%s opens the %s key', (label, key) => {
    const { onChangeTab } = renderRow();
    fireEvent.click(stageRow().getByRole('button', { name: label }));
    expect(onChangeTab).toHaveBeenCalledWith(key);
  });

  test('Build opens screens, and keeps Icons open when it is already the Build view', () => {
    const fromZones = renderRow({ activeTab: 'zones' });
    fireEvent.click(stageRow().getByRole('button', { name: 'Build' }));
    expect(fromZones.onChangeTab).toHaveBeenCalledWith('screens');
    cleanup();
    const onIcons = renderRow({ activeTab: 'icons' });
    fireEvent.click(stageRow().getByRole('button', { name: 'Build' }));
    expect(onIcons.onChangeTab).not.toHaveBeenCalled();
  });

  test('Build is the active stage for screens and icons, with the Screens | Icons toggle and counts', () => {
    renderRow({ activeTab: 'icons' });
    expect(stageRow().getByRole('button', { name: 'Build' }).className).toContain('active');
    const toggle = within(screen.getByRole('group', { name: 'Build' }));
    expect(toggle.getByRole('button', { name: 'Screens · 4' }).getAttribute('aria-pressed')).toBe('false');
    expect(toggle.getByRole('button', { name: 'Icons · 2' }).getAttribute('aria-pressed')).toBe('true');
  });

  test('the toggle switches between the screens and icons keys', () => {
    const { onChangeTab } = renderRow();
    const toggle = within(screen.getByRole('group', { name: 'Build' }));
    fireEvent.click(toggle.getByRole('button', { name: /^Icons/ }));
    expect(onChangeTab).toHaveBeenCalledWith('icons');
    fireEvent.click(toggle.getByRole('button', { name: /^Screens/ }));
    expect(onChangeTab).toHaveBeenCalledWith('screens');
  });

  test('the toggle hides Icons when there are none, and is absent outside Build', () => {
    renderRow({ iconCount: 0 });
    expect(within(screen.getByRole('group', { name: 'Build' })).queryByRole('button', { name: /^Icons/ })).toBeNull();
    cleanup();
    renderRow({ activeTab: 'zones' });
    expect(screen.queryByRole('group', { name: 'Build' })).toBeNull();
  });

  test('Advanced opens a menu whose Missions opens the missions key and closes the menu', () => {
    const { onChangeTab } = renderRow();
    const advanced = stageRow().getByRole('button', { name: 'Advanced' });
    expect(advanced.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(advanced);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Missions' }));
    expect(onChangeTab).toHaveBeenCalledWith('missions');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('the Advanced menu closes on Escape and on an outside press', () => {
    renderRow();
    fireEvent.click(stageRow().getByRole('button', { name: 'Advanced' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(stageRow().getByRole('button', { name: 'Advanced' }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('Advanced is the active stage while missions is open', () => {
    renderRow({ activeTab: 'missions' });
    expect(stageRow().getByRole('button', { name: 'Advanced' }).className).toContain('active');
    expect(stageRow().getByRole('button', { name: 'Build' }).className).not.toContain('active');
  });

  test('stages the parent can\'t show are left out', () => {
    renderRow({ showPreview: false, showZones: false, showContent: false, showMissions: false });
    expect(stageRow().getAllByRole('button').map(b => b.textContent.trim())).toEqual(['Build']);
  });
});
