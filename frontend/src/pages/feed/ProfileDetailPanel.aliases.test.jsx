/**
 * "Also known as" on a profile (Evoni, 2026-10-23): the panel shows a
 * profile's other names, and Edit lets her change them, commas between;
 * Save sends them with the rest (the server saves the list).
 */
import { vi, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import { DetailPanel } from './ProfileDetailPanel';
import { aliasList } from './feedConstants';

const renderPanel = (profile, onEdit = vi.fn()) => {
  render(
    <DetailPanel
      profile={{ id: 9, handle: 'truthville', display_name: 'Truthville', status: 'finalized', followers: [], ...profile }} fp={{}} detailTab="profile" setDetailTab={vi.fn()}
      sceneContext={null} setSceneContext={vi.fn()} onLoadSceneContext={vi.fn()} onCopySceneContext={vi.fn()}
      crossingPreview={null} setCrossingPreview={vi.fn()} onLoadCrossingPreview={vi.fn()}
      onClose={vi.fn()} onFinalize={vi.fn()} onCross={vi.fn()} onEdit={onEdit} onDelete={vi.fn()}
      onRefresh={vi.fn()} onRegenerate={vi.fn()} regenerating={false}
      onApprove={vi.fn()} onRejectCrossing={vi.fn()} onSaveAsTemplate={vi.fn()} onReactions={vi.fn()}
    />,
  );
  return onEdit;
};

test('the header says who else they are; none, nothing', () => {
  renderPanel({ aliases: ['Truth', 'T-Ville'] });
  expect(screen.getByTestId('spg-detail-aliases').textContent).toBe('Also known as Truth, T-Ville');
});

test('no aliases, no line', () => {
  renderPanel({ aliases: [] });
  expect(screen.queryByTestId('spg-detail-aliases')).toBeNull();
});

test('Edit holds them with commas between; Save sends what she typed', () => {
  const onEdit = renderPanel({ aliases: ['Truth'] });
  fireEvent.click(screen.getByText('Edit'));
  const box = screen.getByLabelText('Also known as');
  expect(box.value).toBe('Truth');
  fireEvent.change(box, { target: { value: 'Truth, T-Ville' } });
  fireEvent.click(screen.getByText('✓ Save'));
  expect(onEdit).toHaveBeenCalledWith(9, expect.objectContaining({ aliases: 'Truth, T-Ville', handle: 'truthville' }));
});

test('aliasList reads a list or its JSON, and nothing else', () => {
  expect(aliasList({ aliases: ['Truth', ' ', 3] })).toEqual(['Truth']);
  expect(aliasList({ aliases: '["Truth"]' })).toEqual(['Truth']);
  expect(aliasList({})).toEqual([]);
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(aliasList({ aliases: 'not json' })).toEqual([]);
  err.mockRestore();
});
