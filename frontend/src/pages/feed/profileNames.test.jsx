/**
 * Names on a Feed profile (Task #2761): the registry character owns the
 * person's name; the profile's display_name is its "Profile name", which
 * defaults to the linked character's name; the handle shows as @handle.
 */
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import { profileName, atHandle } from './feedConstants';
import { DetailPanel } from './ProfileDetailPanel';
import ProfileCard from './ProfileCard';

const panel = (profile, onEdit = vi.fn()) => render(
  <DetailPanel
    profile={{ status: 'finalized', followers: [], ...profile }} fp={{}} detailTab="profile" setDetailTab={vi.fn()}
    sceneContext={null} setSceneContext={vi.fn()} onLoadSceneContext={vi.fn()} onCopySceneContext={vi.fn()}
    crossingPreview={null} setCrossingPreview={vi.fn()} onLoadCrossingPreview={vi.fn()}
    onClose={vi.fn()} onFinalize={vi.fn()} onCross={vi.fn()} onEdit={onEdit} onDelete={vi.fn()}
    onRefresh={vi.fn()} onRegenerate={vi.fn()} regenerating={false}
    onApprove={vi.fn()} onRejectCrossing={vi.fn()} onSaveAsTemplate={vi.fn()} onReactions={vi.fn()}
  />,
);

describe('profile names', () => {
  test('profileName: the profile name, else the linked character\'s name; atHandle adds one @', () => {
    expect(profileName({ display_name: 'STUDIO BY SABLE', registry_character_name: 'Sable Okoye' })).toBe('STUDIO BY SABLE');
    expect(profileName({ display_name: null, registry_character_name: 'Sable Okoye' })).toBe('Sable Okoye');
    expect(profileName({ full_profile: { display_name: 'From the profile' } })).toBe('From the profile');
    expect(profileName({})).toBe('');
    expect(atHandle('sable')).toBe('@sable');
    expect(atHandle('@@sable')).toBe('@sable');
    expect(atHandle('')).toBe('');
  });

  test('the panel shows @handle, the profile name and the character it belongs to', () => {
    panel({ id: 1, handle: 'sable.studio', display_name: 'STUDIO BY SABLE', registry_character_name: 'Sable Okoye' });
    expect(screen.getByTestId('spg-detail-handle').textContent).toBe('@sable.studio');
    expect(screen.getByTestId('spg-detail-profile-name').textContent).toBe('STUDIO BY SABLE');
    expect(screen.getByTestId('spg-detail-character').textContent).toBe('Character: Sable Okoye');
  });

  test('editing: "Profile name" defaults to the linked character\'s name when the profile has none', () => {
    const onEdit = vi.fn();
    panel({ id: 2, handle: 'marcus', display_name: null, registry_character_name: 'Marcus Kane' }, onEdit);
    expect(screen.queryByTestId('spg-detail-character')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    expect(screen.getByText('Profile name')).toBeTruthy();
    expect(screen.queryByText('Display Name')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(onEdit).toHaveBeenCalledWith(2, expect.objectContaining({ display_name: 'Marcus Kane', handle: 'marcus' }));
  });

  test('the card shows @handle and the profile name', () => {
    render(<ProfileCard profile={{ id: 3, handle: 'nia', display_name: 'Nia Reads', status: 'draft', platform: 'instagram' }} selected={null} feedLayer="lalaverse" onSelect={vi.fn()} onToggle={vi.fn()} />);
    expect(screen.getByTestId('spg-card-handle').textContent).toBe('@nia · Nia Reads');
  });
});
