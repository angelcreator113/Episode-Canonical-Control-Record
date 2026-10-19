// Table read (Script tab audit, 2026-10-15): beats, words, no tags; a dialog
// that takes focus, gives it back, closes on Escape and moves beat by beat.
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ScriptTableRead, { speakerColor } from './ScriptTableRead';

const SCRIPT = [
  '[EVENT: velour-gala]',
  '## BEAT: 1 · Opening Ritual',
  'Lala: "Okay besties."',
  'Me: “Ready?”',
  '(She smiles.)',
  '[UI:OPEN closet]',
  '[STAT: coins -50]',
  '[WEAR: p1]',
  '[TRANSITION: cut to]',
  '## BEAT: 5 · Reveal',
  'Kelli: "Look."',
  '## BEAT: 11 · Event Outcome',
  'Lala: "We did it."',
].join('\n');

function Opener({ script = SCRIPT }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open read</button>
      {open && <ScriptTableRead scriptText={script} title="The Gala" onClose={() => setOpen(false)} />}
    </>
  );
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
});

describe('ScriptTableRead', () => {
  test('beat headings, speakers, actions and moments in words; tags hidden', () => {
    render(<ScriptTableRead scriptText={SCRIPT} title="The Gala" onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect([...dialog.querySelectorAll('.str-beat-head')].map((h) => h.textContent)).toEqual(['1 · Opening Ritual', '5 · Reveal', '11 · The Event']);
    // The saved header says "Event Outcome"; Table read uses today's name (Script page audit 3, 2026-10-19).
    const text = dialog.textContent;
    expect(text).toContain('Okay besties.');
    expect(text).not.toContain('"Okay');
    expect(text).toContain('Prime');
    expect(text).toContain('She smiles.');
    expect(within(dialog).getByTestId('table-read-moment').textContent).toContain('Lala opens the Closet');
    expect(text).not.toMatch(/STAT|WEAR|EVENT:|velour|TRANSITION|cut to|CUT TO|\[UI:/);
  });

  test('a speaker keeps the tab colour; others get the same colour every time', () => {
    expect(speakerColor('Lala')).toBe('var(--accent-dark)');
    expect(speakerColor('Prime')).toBe('var(--primary-text)');
    expect(speakerColor('Marcus')).toBe(speakerColor('Marcus'));
    render(<ScriptTableRead scriptText={SCRIPT} onClose={() => {}} />);
    const lala = screen.getAllByText('Lala')[0];
    expect(lala.style.getPropertyValue('--str-speaker')).toBe('var(--accent-dark)');
  });

  test('focus moves in on open, Escape closes, and focus goes back to the opener', () => {
    render(<Opener />);
    const opener = screen.getByText('Open read');
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  test('the close button closes', () => {
    render(<Opener />);
    fireEvent.click(screen.getByText('Open read'));
    fireEvent.click(screen.getByTestId('table-read-close'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('next, previous and jump move beat by beat', () => {
    render(<ScriptTableRead scriptText={SCRIPT} onClose={() => {}} />);
    const jump = screen.getByTestId('table-read-jump');
    const prev = screen.getByTestId('table-read-prev');
    expect(jump.value).toBe('0');
    expect(prev.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('table-read-next'));
    expect(jump.value).toBe('1');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('table-read-next'));
    expect(jump.value).toBe('2');
    expect(screen.getByTestId('table-read-next').disabled).toBe(true);
    fireEvent.click(prev);
    expect(jump.value).toBe('1');
    fireEvent.change(jump, { target: { value: '0' } });
    expect(jump.value).toBe('0');
    const beats = screen.getAllByTestId('table-read-beat');
    expect(beats[0].getAttribute('aria-current')).toBe('true');
  });

  test('text size is remembered', () => {
    const { unmount } = render(<ScriptTableRead scriptText={SCRIPT} onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('Larger text'));
    expect(window.localStorage.getItem('scriptTableRead.fontSize')).toBe('22');
    unmount();
    render(<ScriptTableRead scriptText={SCRIPT} onClose={() => {}} />);
    expect(document.querySelector('.str-page').style.getPropertyValue('--str-size')).toBe('22px');
  });

  test('a script without beat headers reads as one piece, with no beat controls', () => {
    render(<ScriptTableRead scriptText={'Lala: hi\n(waves)'} onClose={() => {}} />);
    expect(screen.queryByTestId('table-read-jump')).toBeNull();
    expect(screen.getByRole('dialog').textContent).toContain('hi');
  });

  test('print mode prints and closes after', () => {
    const print = vi.fn(() => window.dispatchEvent(new Event('afterprint')));
    window.print = print;
    const onClose = vi.fn();
    render(<ScriptTableRead scriptText={SCRIPT} printMode onClose={onClose} />);
    expect(print).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole('dialog').className).toContain('is-print');
  });
});

describe('ScriptTableRead at the end (Script page re-audit, 2026-10-19)', () => {
  test('scrolled to the bottom, the last beat is the one being read', () => {
    render(<Opener />);
    fireEvent.click(screen.getByText('Open read'));
    const box = document.querySelector('.str-scroll');
    Object.defineProperty(box, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(box, 'clientHeight', { configurable: true, value: 800 });
    // jsdom has no layout: every beat's offsetTop is 0, so the first rule alone picks the last
    // beat too; set the beats' tops so only the bottom rule can pick it.
    [...document.querySelectorAll('.str-beat')].forEach((el, i) => Object.defineProperty(el, 'offsetTop', { configurable: true, value: [0, 900, 1900][i] }));
    box.scrollTop = 1200;
    fireEvent.scroll(box);
    expect(screen.getByTestId('table-read-jump').value).toBe('2');
    box.scrollTop = 500;
    fireEvent.scroll(box);
    expect(screen.getByTestId('table-read-jump').value).toBe('0');
  });
});
