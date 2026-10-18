import { describe, test, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Pager, { usePaged } from './Pager';

function List({ n, size = 5 }) {
  const items = Array.from({ length: n }, (_, i) => `Item ${i + 1}`);
  const { pageItems, pager } = usePaged(items, size);
  return (<><ul>{pageItems.map((x) => <li key={x}>{x}</li>)}</ul><Pager {...pager} label="Posts" /></>);
}

function Shrinking() {
  const [n, setN] = useState(12);
  return (<><button type="button" onClick={() => setN(3)}>Shrink</button><List n={n} /></>);
}

describe('Pager', () => {
  test('one page: no controls', () => {
    render(<List n={4} />);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  test('pages through a long list', () => {
    render(<List n={12} />);
    expect(screen.getByRole('navigation', { name: 'Posts pages' })).toBeTruthy();
    expect(screen.getByText('1–5 of 12')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous page' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('6–10 of 12')).toBeTruthy();
    expect(screen.getByText('Item 6')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Item 11', 'Item 12']);
    expect(screen.getByRole('button', { name: 'Page 3' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Next page' }).disabled).toBe(true);
  });

  test('a list that shrinks goes back to a page that exists', () => {
    render(<Shrinking />);
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Shrink' }));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Item 1', 'Item 2', 'Item 3']);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
