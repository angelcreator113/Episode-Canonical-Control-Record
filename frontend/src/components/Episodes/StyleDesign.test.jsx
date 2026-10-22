/**
 * One of Evoni's five designs laid out in HTML (StyleDesign; 2026-10-22):
 * frames, photos, the empty frame's ADD PHOTO, the text fields with the
 * deck's placeholder while empty, the palette circles, and the frames as
 * buttons only while editing.
 */
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import StyleDesign, { atPath, designValues } from './StyleDesign';

const design = {
  key: 'color_story', name: 'The Color Story', number: '04', background: '#F6F1FC',
  elements: [
    { kind: 'text', x: 58, y: 175, w: 845, h: 62, text: 'THE COLOR STORY', size: 37.3, color: '#38283B', font: 'serif', bold: true, align: 'center' },
    { kind: 'text', x: 77, y: 1323, w: 806, h: 24, field: 'mood', placeholder: 'EPISODE MOOD:  [ ADD YOUR DESCRIPTION ]', size: 13, color: '#5A3769', font: 'sans', align: 'center' },
    { kind: 'photo', spot: 'hero', label: 'MAIN LOOK', x: 62, y: 281, w: 398, h: 518, fill: '#FFFFFF', radius: 11 },
    { kind: 'photo', spot: 'shoes', label: 'BAG', x: 746, y: 1048, w: 152, h: 245, fill: '#FFF9F5', radius: 11 },
    { kind: 'swatch', index: 0, x: 86, y: 876, w: 91, h: 91, fill: '#E8B9CA' },
    { kind: 'swatch', index: 1, x: 223, y: 876, w: 91, h: 91, fill: '#DCC9F1' },
    { kind: 'rule', x: 53, y: 1397, w: 854, h: 0, color: '#BE955B', width: 2 },
  ],
};
const page = () => within(screen.getByTestId('style-design-color_story'));

describe('StyleDesign', () => {
  test("lays out the deck: a filled frame shows its photo, an empty one ADD PHOTO and its label; her palette, else the deck's", () => {
    const { container } = render(<StyleDesign design={design} values={{ photos: { hero: 'data:hero' }, fields: {}, palette: ['#123456'] }} />);
    expect(page().getByText('THE COLOR STORY')).toBeTruthy();
    expect(container.querySelector('.sd-photo').getAttribute('src')).toBe('data:hero');
    expect(page().getByText('ADD PHOTO')).toBeTruthy();
    expect(page().getByText('BAG')).toBeTruthy();
    const swatches = container.querySelectorAll('.sd-swatch');
    expect([swatches[0].style.background, swatches[1].style.background]).toEqual(['rgb(18, 52, 86)', 'rgb(220, 201, 241)']);
    expect(page().queryAllByRole('button')).toHaveLength(0);
  });

  test("a text field shows the episode's words, else the deck's placeholder, faintly", () => {
    const { rerender } = render(<StyleDesign design={design} values={{ photos: {}, fields: { mood: 'EPISODE MOOD:  bold' }, palette: [] }} />);
    expect(page().getByText(/EPISODE MOOD:\s+bold/).parentElement.classList.contains('is-placeholder')).toBe(false);
    rerender(<StyleDesign design={design} values={{ photos: {}, fields: {}, palette: [] }} />);
    expect(page().getByText(/ADD YOUR DESCRIPTION/).parentElement.classList.contains('is-placeholder')).toBe(true);
  });

  test('editing: every frame is a button that opens its spot; the selected one is pressed', () => {
    const onSelect = vi.fn();
    render(<StyleDesign design={design} values={{ photos: { hero: 'data:hero' }, fields: {}, palette: [] }} edit={{ isSelected: (s) => s === 'shoes', onSelect }} />);
    fireEvent.click(page().getByRole('button', { name: 'Edit main look' }));
    expect(onSelect).toHaveBeenCalledWith('hero');
    expect(page().getByRole('button', { name: 'Add bag' }).getAttribute('aria-pressed')).toBe('true');
  });

  test('designValues reads each photo from the sheet by its path', () => {
    const sheet = { look: { front: 'data:f' }, wardrobe: { columns: [{ key: 'body' }, { key: 'shoes', image: 'data:s' }] },
      design_values: { photo_paths: { hero: 'look.front', shoes: 'wardrobe.columns.1.image', bag: null }, fields: { tagline: 'Hi' }, palette: ['#000000'] } };
    expect(designValues(sheet)).toEqual({ photos: { hero: 'data:f', shoes: 'data:s', bag: null }, fields: { tagline: 'Hi' }, palette: ['#000000'] });
    expect(atPath(sheet, 'look.side')).toBeNull();
    expect(designValues({})).toEqual({ photos: {}, fields: {}, palette: [] });
  });
});
