/**
 * TreeView on a narrow screen (2026-10-24 layout audit): the drawing
 * shrinks to fit, so its text grows by the same factor and still reads at
 * 12px or more; a squeezed drawing shows first names. Its footer says how
 * to move it; the counts are in the page's sub-header.
 */
import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import TreeView from './TreeView';

const C = (id, name, role_type) => ({ id, display_name: name, role_type });
const chars = [
  C('lala', 'Lala', 'special'),
  ...['Jade Monroe', 'Dre Coleman', 'Ruth Coleman', 'Theo Marsh', 'Anastasia Valentina'].map((n, i) => C(`s${i}`, n, 'support')),
];
const rels = [{ id: 'r1', character_id_a: 'lala', character_id_b: 's0', relationship_type: 'best_friend' }];

const realRO = globalThis.ResizeObserver;
const withWidth = (width, height) => {
  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; }
    observe() { this.cb([{ contentRect: { width, height } }]); }
    unobserve() {}
    disconnect() {}
  };
};
afterEach(() => { globalThis.ResizeObserver = realRO; });

// Rendered size of a text: its font size times the drawing's scale.
const rendered = (svg, text) => {
  const vb = svg.getAttribute('viewBox').split(' ').map(Number);
  const scale = Math.min(Number(svg.getAttribute('width')) / vb[2], Number(svg.getAttribute('height')) / vb[3]);
  return parseFloat(text.style.fontSize) * scale;
};

describe('TreeView text', () => {
  test('on a 375px screen every name renders at 12px or more, as a first name', () => {
    withWidth(343, 440);
    const { container } = render(<TreeView chars={chars} rels={rels} lalaId="lala" selChar={null} onRelClick={() => {}} onCharClick={() => {}} />);
    const svg = container.querySelector('svg.re-tree-svg');
    const texts = [...svg.querySelectorAll('text')];
    expect(texts.length).toBeGreaterThan(0);
    texts.forEach((t) => expect(rendered(svg, t)).toBeGreaterThanOrEqual(11.99));
    const names = texts.map((t) => t.textContent);
    expect(names).toContain('Jade');
    expect(names).toContain('Anastasia');
    expect(names).not.toContain('Jade Monroe');
  });

  test('on a wide screen names stay whole at 12px; the footer has no counts', () => {
    withWidth(1200, 680);
    const { container } = render(<TreeView chars={chars} rels={rels} lalaId="lala" selChar={null} onRelClick={() => {}} onCharClick={() => {}} />);
    const svg = container.querySelector('svg.re-tree-svg');
    const names = [...svg.querySelectorAll('text')].map((t) => t.textContent);
    expect(names).toContain('Jade Monroe');
    expect(container.querySelector('.re-tree-status').textContent).toBe('Zoom with the buttons · drag to pan');
  });
});
