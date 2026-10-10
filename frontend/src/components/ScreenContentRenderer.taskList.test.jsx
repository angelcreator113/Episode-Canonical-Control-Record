/**
 * The phone's Task List zone (T2 follow-up, §8(bb); Task #2295) draws the
 * episode's one task list: the saved episode_todo_lists.social_tasks the Run
 * Sheet and Career Checklist read, each task with its source. Read-only.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('./phone/PhoneMapView', () => ({ default: () => null }));

import api from '../services/api';
import ScreenContentRenderer, { CONTENT_TYPES, TASK_SOURCE_LABELS } from './ScreenContentRenderer';

const TASKS = [
  { slot: 't1', label: 'Post the arrival reel', required: true, completed: false, task_source: 'host_requirement' },
  { slot: 't2', label: 'Tag the brand in a story', required: true, completed: true, task_source: 'brand_deliverable' },
  { slot: 't3', label: 'Get a photo with the host', required: false, completed: false, task_source: 'goal' },
  { slot: 't4', label: 'Try the dessert bar', required: false, completed: false, task_source: 'optional' },
  { slot: 't5', label: 'Old deliverable', required: false, completed: false, task_source: 'deliverable' },
];
const zone = (config = {}) => ({ id: 'z1', content_type: 'task_list', content_config: config, x: 0, y: 0, width: 100, height: 100 });

beforeEach(() => { vi.mocked(api.get).mockReset(); });

describe('Task List zone (#2295)', () => {
  test('is a registered content type', () => {
    expect(CONTENT_TYPES.find((t) => t.key === 'task_list')).toMatchObject({ label: 'Task List', group: 'messages' });
  });

  test('in an episode it reads the saved list and draws each task with its source and the count done', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, social_tasks: TASKS, completion: { total: 5, completed: 1, score: 2 } } });
    render(<ScreenContentRenderer zones={[zone()]} showId="s-1" episodeId="ep-1" />);
    const z = await screen.findByTestId('task-list-zone');
    expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/todo/social');
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(z.textContent).toContain('To do · 1/5');
    const items = screen.getAllByTestId('task-list-item');
    expect(items).toHaveLength(5);
    expect(items[0].textContent).toContain('Post the arrival reel');
    expect(items[0].textContent).toContain('host requirement');
    expect(items[1].textContent).toContain('brand deliverable');
    expect(items[1].textContent).toContain('✓');
    expect(items[2].textContent).toContain('goal');
    expect(items[3].textContent).toContain('optional idea');
    // A T1-era 'deliverable' reads as a host requirement, as on the Run Sheet.
    expect(items[4].textContent).toContain('host requirement');
  });

  test('max items limits the rows; the count still covers the whole list', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, social_tasks: TASKS, completion: { total: 5, completed: 1 } } });
    render(<ScreenContentRenderer zones={[zone({ max_items: 2 })]} showId="s-1" episodeId="ep-1" />);
    const z = await screen.findByTestId('task-list-zone');
    expect(screen.getAllByTestId('task-list-item')).toHaveLength(2);
    expect(z.textContent).toContain('To do · 1/5');
  });

  test('no tasks reads "No tasks yet"; a show screen with no episode fetches nothing', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, social_tasks: [], financial_summary: null } });
    render(<ScreenContentRenderer zones={[zone()]} showId="s-1" episodeId="ep-1" />);
    await screen.findByText('No tasks yet');
    vi.mocked(api.get).mockClear();
    render(<ScreenContentRenderer zones={[zone()]} showId="s-1" />);
    expect(screen.getByText('Task list · shown in an episode')).toBeTruthy();
    expect(api.get).not.toHaveBeenCalled();
  });

  test('source labels match the Run Sheet\'s (todoListService SOURCE_BADGE)', () => {
    const service = readFileSync(resolve(__dirname, '../../../src/services/todoListService.js'), 'utf8');
    const badge = service.match(/const SOURCE_BADGE = \{([^}]*)\}/)[1];
    for (const [key, label] of Object.entries(TASK_SOURCE_LABELS)) {
      expect(badge).toContain(`${key}: '${label}'`);
    }
    expect(TASK_SOURCE_LABELS).toEqual({
      host_requirement: 'host requirement',
      brand_deliverable: 'brand deliverable',
      deliverable: 'host requirement',
      goal: 'goal',
      optional: 'optional idea',
    });
  });
});
