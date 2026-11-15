/**
 * The dialog shown after an episode is made from the Event Library (Evoni,
 * 2026-11-15, Producer Mode PR A): its two ways on stay in the app. They set
 * window.location and reloaded the page.
 */
import fs from 'fs';
import path from 'path';
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import EpisodeBlueprintModal from './EpisodeBlueprintModal';

const Where = () => { const l = useLocation(); return <p data-testid="where">{l.pathname + l.search}</p>; };
const draw = (blueprint) => {
  const setEpisodeBlueprint = vi.fn();
  render(
    <MemoryRouter initialEntries={['/shows/show-1/season?tab=events']}>
      <Where />
      <Routes>
        <Route path="*" element={<EpisodeBlueprintModal lib={{ episodeBlueprint: blueprint, setEpisodeBlueprint, showId: 'show-1' }} />} />
      </Routes>
    </MemoryRouter>,
  );
  return setEpisodeBlueprint;
};

describe('EpisodeBlueprintModal: where it goes next', () => {
  test('Open Episode: the new episode\'s Overview, in the app, and the dialog closes', () => {
    const close = draw({ episode: { id: 'ep-9', title: 'Gala Night' } });
    fireEvent.click(screen.getByRole('button', { name: /Open Episode/ }));
    expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-9?tab=overview');
    expect(close).toHaveBeenCalledWith(null);
  });

  test('Write Script: the new episode\'s Script tab, in the app (not the older writer page)', () => {
    const close = draw({ episode: { id: 'ep-9', title: 'Gala Night' } });
    fireEvent.click(screen.getByRole('button', { name: 'Write Script' }));
    expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-9?tab=scripts');
    expect(close).toHaveBeenCalledWith(null);
  });

  test('with no episode id: the Season page\'s Episodes tab, or just closed', () => {
    const close = draw({ episode: null });
    fireEvent.click(screen.getByRole('button', { name: 'Write Script' }));
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season?tab=events');
    expect(close).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: /Open Episode/ }));
    expect(screen.getByTestId('where').textContent).toBe('/shows/show-1/season?tab=episodes');
  });

  test('it never reloads the page', () => {
    expect(fs.readFileSync(path.resolve(__dirname, 'EpisodeBlueprintModal.jsx'), 'utf8')).not.toMatch(/window\.location/);
  });
});
