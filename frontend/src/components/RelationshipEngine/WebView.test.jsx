/**
 * RelationshipEngine/WebView — the Web draws the page's own people and
 * relationships (character_relationships), so every tab shows the same
 * pairs (2026-10-23; it used to read /memories/relationship-map).
 */
import { vi, describe, test, expect } from 'vitest';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../../services/api';
import { buildWeb, edgeKind } from './WebView';

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
