/**
 * The style sheet template (spec Part 2; Task #2814) with Episode 1's
 * reference values: real text for every value, the seven wardrobe columns,
 * Body "Needed", empty values left empty (never invented), five swatches.
 */
import { describe, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import StyleSheetTemplate, { SHEET_WIDTH, SHEET_HEIGHT } from './StyleSheetTemplate';
import { EPISODE_ONE } from './StyleSheetTemplate.fixture';

describe('style sheet template', () => {
  test('is 1024 x 1536 and prints Episode 1 as real text', () => {
    render(<StyleSheetTemplate sheet={EPISODE_ONE} />);
    const sheet = screen.getByTestId('style-sheet');
    expect([sheet.style.width, sheet.style.height]).toEqual([`${SHEET_WIDTH}px`, `${SHEET_HEIGHT}px`]);
    expect([SHEET_WIDTH, SHEET_HEIGHT]).toEqual([1024, 1536]);
    for (const t of ['EPISODE 01', 'Wearable Experiments Studio Session', 'Echo Park', "THE VENUE · STUDIO BY SABLE's Studio",
      'STUDIO BY SABLE', 'Studio session', 'elevated contemporary, smart-casual', 'Thu, Nov 12, 6:30 PM',
      'statement, modern, elevated, sophisticated, creative', 'LALAVERSE · FASHION · ATTENTION · MONEY']) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    }
    expect(screen.getByLabelText('Styling Adventures with Lala')).toBeTruthy();
  });

  test("the show's logo, when Show Settings has one, replaces the lettered title", () => {
    const logo = 'data:image/png;base64,AAAA';
    const { container } = render(<StyleSheetTemplate sheet={{ ...EPISODE_ONE, logo }} />);
    const img = screen.getByTestId('ss-logo-image');
    expect(img.style.backgroundImage).toContain(logo);
    expect(img.getAttribute('aria-label')).toBe('Styling Adventures with Lala');
    expect(container.querySelector('.ss-logo-styling')).toBeNull();
  });

  test('without a logo the title is lettered', () => {
    const { container } = render(<StyleSheetTemplate sheet={{ ...EPISODE_ONE, logo: null }} />);
    expect(screen.queryByTestId('ss-logo-image')).toBeNull();
    expect(container.querySelector('.ss-logo-styling').textContent).toBe('Styling');
  });

  test('the seven wardrobe columns; Body Needed; empty columns left blank', () => {
    render(<StyleSheetTemplate sheet={EPISODE_ONE} />);
    expect(within(screen.getByTestId('ss-col-body')).getAllByText('Needed').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('ss-col-shoes')).getByText('Crimson Satin Ballerina Pump')).toBeTruthy();
    expect(within(screen.getByTestId('ss-col-shoes')).getByRole('img', { name: 'Crimson Satin Ballerina Pump' })).toBeTruthy();
    expect(within(screen.getByTestId('ss-col-jewelry')).getByText('Crimson Bloom Enamel Stud Earrings')).toBeTruthy();
    for (const k of ['bag', 'hair', 'perfume', 'nails']) expect(within(screen.getByTestId(`ss-col-${k}`)).queryByText('Needed')).toBeNull();
  });

  test('five swatches: the palette given, the rest empty; mood words print; no tagline invented', () => {
    const { container } = render(<StyleSheetTemplate sheet={EPISODE_ONE} palette={[{ hex: '#A01428' }, { hex: '#B8962E' }]} />);
    const sw = screen.getAllByTestId('ss-swatch');
    expect(sw).toHaveLength(5);
    expect(sw.filter((s) => s.className.includes('is-empty'))).toHaveLength(3);
    expect(screen.getByText('statement · modern · elevated · sophisticated · creative')).toBeTruthy();
    expect(container.querySelector('.ss-tagline')).toBeNull();
  });

  test('with no event, the event name says it is to come and the details are dashes', () => {
    render(<StyleSheetTemplate sheet={{ ...EPISODE_ONE, event: null, venue: { name: null, chip: null, image: null } }} />);
    expect(screen.getByText('Event to come')).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(5);
    expect(screen.getByText('THE VENUE')).toBeTruthy();
  });
});
