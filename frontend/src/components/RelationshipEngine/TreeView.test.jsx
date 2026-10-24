/**
 * TreeView on narrow and wide screens: drawn at the screen's width, a band
 * with more people than fit wraps onto rows, every name reads at 12px or
 * more and fits its space (a long one shortens to the first name). Its
 * footer says how to move it; the counts are in the page's sub-header.
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
  test('on a 375px screen every name renders at 12px or more', () => {
    withWidth(343, 440);
    const { container } = render(<TreeView chars={chars} rels={rels} lalaId="lala" selChar={null} onRelClick={() => {}} onCharClick={() => {}} />);
    const svg = container.querySelector('svg.re-tree-svg');
    const texts = [...svg.querySelectorAll('text')];
    expect(texts.length).toBeGreaterThan(0);
    texts.forEach((t) => expect(rendered(svg, t)).toBeGreaterThanOrEqual(11.99));
    const names = texts.map((t) => t.textContent);
    expect(names).toContain('Jade Monroe');
    // Too long for its space: the first name.
    expect(names).toContain('Anastasia');
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

// Evoni's phone, 2026-10-24: twelve people in one band were squeezed into
// 375px and their names ran together. A full band now wraps onto rows.
describe('TreeView rows', () => {
  const many = [
    C('lala', 'Lala', 'special'),
    ...['Nadia Osei-Mensah', 'Dominique Ferreira', 'Margot Ashby', 'Orinthia Achebe', 'Renata Vale', 'Margaux Leclerc',
      'Maren Ellis', 'Sable Okoro', 'The Critic', 'Declan Ford', 'Velour Atelier', 'Marisol Vega']
      .map((n, i) => C(`p${i}`, n, 'pressure')),
  ];
  const nodes = (container) => [...container.querySelectorAll('g.ni[transform]')]
    .map((g) => { const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(g.getAttribute('transform')); return { x: +m[1], y: +m[2], name: g.querySelectorAll('text')[1]?.textContent || '' }; });

  test('twelve people in one band on a phone wrap onto rows; names fit their space and never run together', () => {
    withWidth(343, 440);
    const { container } = render(<TreeView chars={many} rels={[]} lalaId="lala" selChar={null} onRelClick={() => {}} onCharClick={() => {}} />);
    const svg = container.querySelector('svg.re-tree-svg');
    // Drawn at the screen's width, not shrunk to fit.
    expect(svg.getAttribute('viewBox').split(' ').map(Number)[2]).toBe(343);
    const ns = nodes(container).filter((n) => n.name !== 'Lala');
    const rows = [...new Set(ns.map((n) => Math.round(n.y)))];
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const y of rows) {
      const row = ns.filter((n) => Math.round(n.y) === y).sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i += 1) {
        const gap = row[i].x - row[i - 1].x;
        // About 7px a letter at 12px: half of each name either side of its centre.
        const need = (row[i].name.length + row[i - 1].name.length) * 7.5 / 2;
        expect(gap).toBeGreaterThanOrEqual(need);
      }
    }
    [...svg.querySelectorAll('text')].forEach((t) => expect(rendered(svg, t)).toBeGreaterThanOrEqual(11.99));
  });

  test('on a wide screen the same band fits on one or two rows', () => {
    withWidth(1200, 680);
    const { container } = render(<TreeView chars={many} rels={[]} lalaId="lala" selChar={null} onRelClick={() => {}} onCharClick={() => {}} />);
    const ns = nodes(container).filter((n) => n.name !== 'Lala');
    expect(new Set(ns.map((n) => Math.round(n.y))).size).toBeLessThanOrEqual(2);
  });
});
