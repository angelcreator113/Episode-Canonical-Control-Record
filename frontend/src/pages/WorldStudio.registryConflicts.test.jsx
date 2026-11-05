/**
 * After a World Studio save, the registry fields that were not copied to the
 * Character Registry because they were edited there (the Registry owns a
 * character's identity) are named, with a link to the registry character.
 */
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
vi.mock('./RelationshipEngine', () => ({ default: () => null }));
vi.mock('./SocialProfileGenerator', () => ({ default: () => null }));

import { RegistryConflictNotice } from './WorldStudio';

const conflicts = [
  { field: 'display_name', registry_value: 'Maren', world_value: 'Mare' },
  { field: 'core_desire', registry_value: 'to be loved', world_value: 'to win' },
];
const show = (props) => render(<MemoryRouter><RegistryConflictNotice {...props} /></MemoryRouter>);

describe('WorldStudio — registry conflict notice', () => {
  test('names each field the registry kept, and links to the registry character', () => {
    show({ conflicts, registryCharacterId: 'rc-1' });
    expect(screen.getByRole('status').textContent).toContain(
      'These fields were not copied to the Character Registry because they were edited there: display_name, core_desire.');
    expect(screen.getByRole('link', { name: 'Open the registry character' }).getAttribute('href'))
      .toBe('/character-registry?highlight=rc-1');
  });

  test('nothing when there are no conflicts', () => {
    const { container } = show({ conflicts: [], registryCharacterId: 'rc-1' });
    expect(container.textContent).toBe('');
    const none = show({ conflicts: undefined });
    expect(none.container.textContent).toBe('');
  });

  test('can be dismissed', () => {
    const onDismiss = vi.fn();
    show({ conflicts, registryCharacterId: 'rc-1', onDismiss });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
