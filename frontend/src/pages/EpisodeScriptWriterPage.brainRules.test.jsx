/**
 * The script writer page names the Brain rules a generation uses
 * (2026-10-04): the context chip reads "used of eligible", the panel lists
 * the used and the left-out rules for the next generation, and the script
 * on screen shows the rules it was generated with.
 */
import React from 'react';
import { vi, describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrainRulesPanel } from './EpisodeScriptWriterPage';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const RULES = {
  limit: 2, eligible: 3, used_count: 2, omitted_count: 1,
  used: [{ id: 1, title: 'Lala never knows', severity: 'critical' }, { id: 2, title: 'Fashion is strategy', severity: 'important' }],
  omitted: [{ id: 3, title: 'Gold is never text', severity: 'context' }],
};

describe('BrainRulesPanel', () => {
  test('names the used and the left-out rules with the limit', () => {
    render(<BrainRulesPanel rules={RULES} heading="This script used" />);
    expect(screen.getByText(/This script used: 2 of 3 rules/)).toBeTruthy();
    expect(screen.getByText(/1 left out \(limit 2\)/)).toBeTruthy();
    expect(screen.getByTestId('brain-rules-used').textContent).toContain('🔴 Lala never knows');
    expect(screen.getByTestId('brain-rules-used').textContent).toContain('Fashion is strategy');
    expect(screen.getByTestId('brain-rules-omitted').textContent).toContain('Gold is never text');
  });

  test('says nothing is left out when the limit is not reached, and renders nothing without a record', () => {
    render(<BrainRulesPanel rules={{ ...RULES, omitted: [], omitted_count: 0, eligible: 2 }} heading="Next generation" />);
    expect(screen.getByText(/Next generation: 2 of 2 rules/)).toBeTruthy();
    expect(screen.queryByText(/left out/)).toBeNull();
    expect(screen.queryByTestId('brain-rules-omitted')).toBeNull();
    const { container } = render(<BrainRulesPanel rules={null} heading="x" />);
    expect(container.textContent).toBe('');
  });
});
