/**
 * RelationshipEngine/AddModal and GenModal — every field is named by its
 * label (2026-10-24: primitives' Label was a plain div, so screen readers
 * read the selects as unnamed).
 */
import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../../services/api';
import AddModal from './AddModal';
import GenModal, { generateBody } from './GenModal';

const chars = [
  { id: 'lala', display_name: 'Lala', role_type: 'special' },
  { id: 'm', display_name: 'Truthville', selected_name: 'Marcus Hale', role_type: 'pressure' },
];

describe('labelled fields', () => {
  test('Add relationship: each select and box by its label', () => {
    render(<AddModal chars={chars} rels={[]} onAdd={vi.fn()} onClose={vi.fn()} />);
    for (const name of ['Character A', 'Character B', 'Mode', 'Status', 'Tension State']) {
      expect(screen.getByLabelText(name).tagName).toBe('SELECT');
    }
    expect(screen.getByLabelText('Relationship Type').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Situation').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Character A').querySelectorAll('option')).toHaveLength(3);
  });

  test('Generate seeds: the focus select by its label', () => {
    render(<GenModal chars={chars} genning={false} onGenerate={vi.fn()} onClose={vi.fn()} />);
    const sel = screen.getByLabelText('Focus Character (optional)');
    expect(sel.tagName).toBe('SELECT');
    expect([...sel.options].map((o) => o.textContent)).toEqual(['Any character', 'Lala', 'Marcus Hale']);
  });
});

/*
 * The Generate dialog's aims (2026-10-24 seeds): kind, focus, an episode's
 * guests, a twist to pay off, and how many; the body sends kind and count
 * always and the rest only when chosen (POST /relationships/generate).
 */
describe('Generate seeds: aims', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    try { window.localStorage.clear(); } catch (err) { console.error(err); }
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { data: [{ id: 'show-1', name: 'Styling Adventures' }] } };
      if (url.startsWith('/api/v1/episodes?show_id=show-1')) return { data: { data: [{ id: 'ep-3', episode_number: 3, title: 'The Balcony' }] } };
      if (url === '/api/v1/world/show-1/season/twists') return { data: { twists: [
        { id: 'tw-1', title: 'Jade knows', status: 'planted' },
        { id: 'tw-2', title: 'The contract', status: 'planned' },
        { id: 'tw-3', title: 'Done already', status: 'paid_off' },
      ] } };
      return { data: {} };
    });
  });

  const open = async () => {
    const onGenerate = vi.fn();
    render(<GenModal chars={chars} genning={false} onGenerate={onGenerate} onClose={vi.fn()} />);
    await screen.findByLabelText("Among an episode's guests (optional)");
    return onGenerate;
  };
  const go = () => fireEvent.click(screen.getByRole('button', { name: /◈ Generate/ }));

  test('as it opens: any kind, 5 seeds, nothing else', async () => {
    const onGenerate = await open();
    expect(screen.getByRole('radio', { name: 'Any' }).getAttribute('aria-checked')).toBe('true');
    go();
    expect(onGenerate).toHaveBeenCalledWith({ kind: 'any', count: 5 });
  });

  test.each([
    ['Romance', 'romance'], ['Rivals', 'rivals'], ['Friends', 'friends'], ['Mentors', 'mentors'], ['Family', 'family'],
  ])('kind %s', async (label, kind) => {
    const onGenerate = await open();
    fireEvent.click(screen.getByRole('radio', { name: label }));
    expect(screen.getByText(new RegExp(`5 ${label.toLowerCase()} seeds`))).toBeTruthy();
    go();
    expect(onGenerate).toHaveBeenCalledWith({ kind, count: 5 });
  });

  test('a focus person', async () => {
    const onGenerate = await open();
    fireEvent.change(screen.getByLabelText('Focus Character (optional)'), { target: { value: 'm' } });
    go();
    expect(onGenerate).toHaveBeenCalledWith({ kind: 'any', count: 5, focus_character_id: 'm' });
  });

  test("an episode's guests", async () => {
    const onGenerate = await open();
    const sel = screen.getByLabelText("Among an episode's guests (optional)");
    expect([...sel.options].map((o) => o.textContent)).toEqual(['Any episode', 'Episode 3 · The Balcony']);
    fireEvent.change(sel, { target: { value: 'ep-3' } });
    go();
    expect(onGenerate).toHaveBeenCalledWith({ kind: 'any', count: 5, episode_id: 'ep-3' });
  });

  test('a twist to pay off (planned or planted only)', async () => {
    const onGenerate = await open();
    const sel = screen.getByLabelText('Pay off a twist (optional)');
    expect([...sel.options].map((o) => o.textContent)).toEqual(['No twist', 'Jade knows', 'The contract']);
    fireEvent.change(sel, { target: { value: 'tw-1' } });
    go();
    expect(onGenerate).toHaveBeenCalledWith({ kind: 'any', count: 5, twist_id: 'tw-1' });
  });

  test('how many, and everything at once', async () => {
    const onGenerate = await open();
    expect([...screen.getByLabelText('How many').options].map((o) => o.value)).toEqual(['3', '4', '5', '6', '7', '8']);
    fireEvent.click(screen.getByRole('radio', { name: 'Rivals' }));
    fireEvent.change(screen.getByLabelText('Focus Character (optional)'), { target: { value: 'lala' } });
    fireEvent.change(screen.getByLabelText("Among an episode's guests (optional)"), { target: { value: 'ep-3' } });
    fireEvent.change(screen.getByLabelText('Pay off a twist (optional)'), { target: { value: 'tw-2' } });
    fireEvent.change(screen.getByLabelText('How many'), { target: { value: '8' } });
    go();
    expect(onGenerate).toHaveBeenCalledWith({ kind: 'rivals', count: 8, focus_character_id: 'lala', episode_id: 'ep-3', twist_id: 'tw-2' });
  });

  test('no show to go on: no episode or twist, and a note says why', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => (url === '/api/v1/shows'
      ? { data: { data: [{ id: 'a' }, { id: 'b' }] } } : { data: {} }));
    const onGenerate = vi.fn();
    render(<GenModal chars={chars} genning={false} onGenerate={onGenerate} onClose={vi.fn()} />);
    expect(await screen.findByText(/Open a show first/)).toBeTruthy();
    expect(screen.queryByLabelText("Among an episode's guests (optional)")).toBeNull();
    go();
    expect(onGenerate).toHaveBeenCalledWith({ kind: 'any', count: 5 });
  });

  test('generateBody leaves out what was not chosen', () => {
    expect(generateBody()).toEqual({ kind: 'any', count: 5 });
    expect(generateBody({ kind: 'family', count: '3', focus: '', episode: 'e', twist: '' })).toEqual({ kind: 'family', count: 3, episode_id: 'e' });
  });
});
