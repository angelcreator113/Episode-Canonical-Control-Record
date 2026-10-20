// Table read → Teleprompter (Evoni, 2026-10-20): opens the Teleprompter page
// on the beat Table read is showing.
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ScriptTableRead from './ScriptTableRead';

const SCRIPT = ['## BEAT: 1 · Opening Ritual', 'Lala: "Hi."', '## BEAT: 5 · Reveal', 'Me: "Look."'].join('\n');
function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.search}</p>; }

beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });

test('the Teleprompter button follows the beat being read', () => {
  render(
    <MemoryRouter initialEntries={['/episodes/ep-1']}>
      <Routes>
        <Route path="/episodes/:id" element={<ScriptTableRead scriptText={SCRIPT} episodeId="ep-1" onClose={() => {}} />} />
        <Route path="/teleprompter" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  const link = screen.getByTestId('table-read-teleprompter');
  expect(link.getAttribute('href')).toBe('/teleprompter?episode=ep-1&beat=1');
  fireEvent.click(screen.getByTestId('table-read-next'));
  expect(link.getAttribute('href')).toBe('/teleprompter?episode=ep-1&beat=5');
  fireEvent.click(link);
  expect(screen.getByTestId('where').textContent).toBe('/teleprompter?episode=ep-1&beat=5');
});

test('without an episode (or printing) there is no Teleprompter button', () => {
  render(<ScriptTableRead scriptText={SCRIPT} onClose={() => {}} />);
  expect(screen.queryByTestId('table-read-teleprompter')).toBeNull();
});
