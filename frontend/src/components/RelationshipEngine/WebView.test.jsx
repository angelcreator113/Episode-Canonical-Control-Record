/**
 * RelationshipEngine/WebView — the Web draws the page's own people and
 * relationships (character_relationships), so every tab shows the same
 * pairs (2026-10-23; it used to read /memories/relationship-map).
 */
import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../../services/api';
import WebView, { buildWeb, edgeKind, shortLabel } from './WebView';

const chars = [
  { id: 'lala', display_name: 'Lala', role_type: 'special' },
  { id: 'm', display_name: 'Truthville', selected_name: 'Marcus Hale', role_type: 'pressure' },
  { id: 'j', display_name: 'Jade', role_type: 'support' },
];

describe('WebView data', () => {
  test('one node per person (one name each), one edge per relationship between them', () => {
    const rels = [
      { id: 'r1', character_id_a: 'lala', character_id_b: 'm', relationship_type: 'love_interest', is_romantic: true, stage: 'flirting' },
      { id: 'r2', character_id_a: 'j', character_id_b: 'lala', relationship_type: 'best_friend', tension_state: 'calm' },
      { id: 'r3', character_id_a: 'j', character_id_b: 'someone-else', relationship_type: 'rival' },
    ];
    const { nodes, edges } = buildWeb(chars, rels, 'lala');
    expect(nodes.map((n) => n.label)).toEqual(['Lala', 'Marcus Hale', 'Jade']);
    expect(edges.map((e) => [e.id, e.from, e.to, e.type, e.label])).toEqual([
      ['r1', 'lala', 'm', 'romantic', 'Love interest'],
      ['r2', 'j', 'lala', 'support', 'Best friend'],
    ]);
    expect(edges[0].stage).toBe('flirting');
    expect(edges[0].toName).toBe('Marcus Hale');
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  test('edge kinds: romance, family, strain, work, else support', () => {
    expect(edgeKind({ relationship_type: 'love_interest' })).toBe('romantic');
    expect(edgeKind({ is_romantic: true, family_role: 'wife' })).toBe('romantic');
    expect(edgeKind({ family_role: 'brother' })).toBe('familial');
    expect(edgeKind({ tension_state: 'volatile' })).toBe('pressure');
    expect(edgeKind({ connection_mode: 'Professional' })).toBe('transactional');
    expect(edgeKind({})).toBe('support');
  });
});

describe('WebView graph (2026-10-24)', () => {
  const rels = [
    { id: 'r1', character_id_a: 'lala', character_id_b: 'm', relationship_type: 'love_interest', is_romantic: true },
    { id: 'r2', character_id_a: 'j', character_id_b: 'lala', relationship_type: 'best_friend' },
  ];
  const nodeOf = (container, id) => container.querySelector(`.rw-node-g[data-id="${id}"]`);
  beforeEach(() => { globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });

  test("the page's selected person starts picked: highlighted, their card open", async () => {
    const { container } = render(<WebView chars={chars} rels={rels} lalaId="lala" selectedId="m" navigate={vi.fn()} onRelClick={vi.fn()} />);
    await waitFor(() => expect(container.querySelectorAll('.rw-node-g')).toHaveLength(3));
    expect(screen.getByRole('dialog', { name: 'Character: Marcus Hale' })).toBeTruthy();
    expect(nodeOf(container, 'm').classList.contains('is-focus')).toBe(true);
    // Marcus's tie (Lala) stays lit; Jade, not tied to him, fades.
    expect(nodeOf(container, 'lala').style.opacity).toBe('1');
    expect(nodeOf(container, 'j').style.opacity).toBe('0.08');
  });

  test('picking another person restyles the same graph; it is not rebuilt', async () => {
    const { container, rerender } = render(<WebView chars={chars} rels={rels} lalaId="lala" navigate={vi.fn()} onRelClick={vi.fn()} />);
    await waitFor(() => expect(container.querySelectorAll('.rw-node-g')).toHaveLength(3));
    const lalaNode = nodeOf(container, 'lala');
    const jadeNode = nodeOf(container, 'j');
    fireEvent.click(lalaNode);
    await waitFor(() => expect(lalaNode.classList.contains('is-focus')).toBe(true));
    fireEvent.click(jadeNode);
    await waitFor(() => expect(jadeNode.classList.contains('is-focus')).toBe(true));
    expect(lalaNode.classList.contains('is-focus')).toBe(false);
    // A new handler from the page does not rebuild it either.
    rerender(<WebView chars={chars} rels={rels} lalaId="lala" navigate={vi.fn()} onRelClick={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(nodeOf(container, 'lala')).toBe(lalaNode);
    expect(nodeOf(container, 'j')).toBe(jadeNode);
    expect(container.querySelectorAll('.rw-node-g')).toHaveLength(3);
  });

  test("Lala's card says Protagonist, as the sidebar does", async () => {
    const { container } = render(<WebView chars={chars} rels={rels} lalaId="lala" navigate={vi.fn()} onRelClick={vi.fn()} />);
    await waitFor(() => expect(container.querySelectorAll('.rw-node-g')).toHaveLength(3));
    fireEvent.click(nodeOf(container, 'lala'));
    const card = await screen.findByRole('dialog', { name: 'Character: Lala' });
    expect(card.querySelector('.re-webview-info-role').textContent).toBe('Protagonist');
    expect(card.textContent).not.toContain('Special');
  });

  test('long names are clipped under the node; the full name is its title and shows when picked', async () => {
    expect(shortLabel('Anastasia Valentina Okonkwo-Beaumont')).toBe('Anastasia Valen…');
    expect(shortLabel('Jade')).toBe('Jade');
    const many = [...chars, { id: 'ana', display_name: 'Anastasia Valentina Okonkwo-Beaumont', role_type: 'mirror' }];
    const { container } = render(<WebView chars={many} rels={rels} lalaId="lala" navigate={vi.fn()} onRelClick={vi.fn()} />);
    await waitFor(() => expect(container.querySelectorAll('.rw-node-g')).toHaveLength(4));
    const ana = nodeOf(container, 'ana');
    expect(ana.querySelector('.rw-node-label').textContent).toBe('Anastasia Valen…');
    expect(ana.querySelector('title').textContent).toBe('Anastasia Valentina Okonkwo-Beaumont');
    fireEvent.click(ana);
    await waitFor(() => expect(ana.querySelector('.rw-node-label').textContent).toBe('Anastasia Valentina Okonkwo-Beaumont'));
  });
});
