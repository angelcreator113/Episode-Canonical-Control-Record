/**
 * PackageToc as the phone's section jump bar (Evoni, 2026-10-25): a short
 * name per section, the full one kept for a screen reader, the section in
 * view lit.
 */
import { describe, test, expect, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { pageNav } from '../../lib/eventPackageHero';
import PackageToc from './PackageToc';

describe('PackageToc at phone width', () => {
  beforeAll(() => { window.innerWidth = 375; window.dispatchEvent(new Event('resize')); });

  test('short names, the section in view lit, every link a section anchor', () => {
    const nav = pageNav({ sections: [{ key: 'place', complete: false, kind: 'blocking' }] });
    render(<PackageToc nav={nav} activeAnchor="deal" tocListRef={{ current: null }} openSection={() => {}} />);
    const toc = screen.getByTestId('package-toc');
    const links = within(toc).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['#epp-sec-identity', '#epp-sec-people', '#epp-sec-place', '#epp-sec-look', '#epp-sec-deal', '#epp-sec-stakes', '#epp-sec-documents']);
    expect(links.map((a) => (a.querySelector('.epp-toc-short') || a.querySelector('.epp-toc-long')).textContent))
      .toEqual(['Basics', 'People', 'Place', 'Look', 'Deal', 'Stakes', 'Papers']);
    const deal = within(toc).getByTestId('toc-deal');
    expect(deal.getAttribute('aria-current')).toBe('location');
    expect(deal.className).toContain('is-active');
    expect(within(toc).getByTestId('toc-place').className).toContain('state-blocking');
  });
});
