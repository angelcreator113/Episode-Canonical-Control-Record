/**
 * PieceImage (Task #3151): a wardrobe piece on its Producer Mode backdrop,
 * the one picture every screen showing a piece uses.
 */
import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PieceImage from './PieceImage';

describe('PieceImage', () => {
  test("a wardrobe row sits on its slot's backdrop, the cut-out first", () => {
    render(<PieceImage item={{ id: 'w1', name: 'Gold Slip', clothing_category: 'dress', thumbnail_url: 'thumb.jpg', s3_url_processed: 'nobg.png' }} testId="box" imgTestId="pic" />);
    const box = screen.getByTestId('box');
    expect(box.className).toContain('wa-wd-backdrop');
    expect(box.className).toContain('bd-body');
    expect(box.dataset.backdrop).toBe('body');
    expect(screen.getByTestId('pic').getAttribute('src')).toBe('nobg.png');
    expect(screen.getByTestId('pic').getAttribute('alt')).toBe('Gold Slip');
  });

  test("a look piece's category picks the backdrop too (the event's snapshot, episodeLook, the Overlays look)", () => {
    render(<PieceImage item={{ id: 'p1', name: 'Pumps', category: 'shoes' }} src="pumps.png" testId="box" />);
    expect(screen.getByTestId('box').dataset.backdrop).toBe('shoes');
  });

  test("no picture: the slot's own icon on the same backdrop; an unknown category is Other", () => {
    const { rerender } = render(<PieceImage item={{ name: 'Drops', clothing_category: 'jewelry' }} testId="box" />);
    expect(screen.getByTestId('box').dataset.backdrop).toBe('jewelry');
    expect(screen.getByTestId('box').textContent).toBe('💍');
    rerender(<PieceImage item={{ name: 'Mystery', clothing_category: 'umbrella' }} testId="box" />);
    expect(screen.getByTestId('box').dataset.backdrop).toBe('other');
    expect(screen.getByTestId('box').textContent).toBe('📦');
  });

  test('a picture that fails to load falls back on the same backdrop; a given fallback is used', () => {
    render(<PieceImage item={{ name: 'Bag', clothing_category: 'bag' }} src="broken.png" imgTestId="pic" fallback={<span>no photo</span>} />);
    fireEvent.error(screen.getByTestId('pic'));
    const box = screen.getByTestId('garment-fallback');
    expect(box.dataset.backdrop).toBe('accessories');
    expect(box.textContent).toBe('no photo');
  });
});
