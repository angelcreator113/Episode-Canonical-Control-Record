/**
 * stripTaskRefs drops task references and keeps color literals, so the
 * theme guards' literal scan reads #888 as the color it is
 * (docs/VISUAL_SYSTEM.md §5).
 */
import { describe, test, expect } from 'vitest';
import { stripTaskRefs } from './contrast';

const HEX = /#[0-9a-f]{3,8}\b/i;

describe('stripTaskRefs', () => {
  test('drops task, issue and PR references', () => {
    for (const s of ['Task #2292', '(issue #1601)', 'PRs #1590/#1593/#1595', 'T1 (§8(bb); Task #2292)', '// Money Phase A #2278): keyed', 'since #534 resolveEpisodeTab', '(Episode Money Phase A, #2278).', 'issue #1601 moved it here, #1605 relabelled']) {
      expect(stripTaskRefs(s)).not.toMatch(HEX);
    }
  });

  test('keeps an all-digit grey that is a color', () => {
    for (const s of ["color: '#888'", 'color: #666;', 'border: 1px solid #333', 'background: "#999"', "{ bg: '#555', color: '#777' }"]) {
      expect(stripTaskRefs(s)).toMatch(HEX);
    }
  });

  test('keeps every lettered literal untouched', () => {
    const s = "color: '#B8962E'; background: #fff; border: 1px solid #e2e8f0; /* Task #2292 */";
    expect(stripTaskRefs(s)).toBe("color: '#B8962E'; background: #fff; border: 1px solid #e2e8f0; /* Task  */");
  });
});
