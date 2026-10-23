/**
 * useUndo + UndoNotice — the Event Package's "Removed ‘…’ · Undo" (Evoni,
 * 2026-10-23): an offer shows in a live region with a real Undo button,
 * ends after UNDO_MS (pausing while the pointer is on it), survives the
 * page's remount of its section, and ends when no caller is left.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import UndoNotice, { showFloatingUndos, hideFloatingUndos } from './UndoNotice';
import { useUndo, resetUndoStore, offerUndo, UNDO_MS } from './useUndo';

function Box({ name = 'k', onReady }) {
  const undo = useUndo(name, { who: 'box' });
  onReady?.(undo);
  return <UndoNotice undo={undo} testId="n" />;
}

beforeEach(() => { resetUndoStore(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); resetUndoStore(); hideFloatingUndos(); });

describe('useUndo + UndoNotice', () => {
  test('an offer shows in a role=status region with a real Undo button; Undo runs it with the newest context and ends it', async () => {
    let handle;
    render(<Box onReady={(u) => { handle = u; }} />);
    expect(screen.getByTestId('n-region').getAttribute('role')).toBe('status');
    expect(screen.queryByTestId('n')).toBeNull();
    const undo = vi.fn(async () => {});
    const onFinal = vi.fn();
    act(() => { handle.offer({ message: "Removed 'Story mentions'", undo, onFinal }); });
    expect(screen.getByTestId('n').textContent).toContain("Removed 'Story mentions'");
    const button = screen.getByRole('button', { name: /Undo/ });
    expect(button.tagName).toBe('BUTTON');
    await act(async () => { fireEvent.click(button); });
    expect(undo).toHaveBeenCalledWith({ who: 'box' });
    expect(onFinal).toHaveBeenCalledWith({ undone: true });
    expect(screen.queryByTestId('n')).toBeNull();
  });

  test('it ends by itself after UNDO_MS, and pauses while the pointer is on it', () => {
    let handle;
    render(<Box onReady={(u) => { handle = u; }} />);
    const onFinal = vi.fn();
    act(() => { handle.offer({ message: 'Gone', undo: async () => {}, onFinal }); });
    fireEvent.mouseEnter(screen.getByTestId('n'));
    act(() => { vi.advanceTimersByTime(UNDO_MS * 2); });
    expect(screen.getByTestId('n')).toBeTruthy();
    fireEvent.mouseLeave(screen.getByTestId('n'));
    act(() => { vi.advanceTimersByTime(UNDO_MS); });
    expect(screen.queryByTestId('n')).toBeNull();
    expect(onFinal).toHaveBeenCalledWith({ undone: false });
  });

  test('× dismisses it at once', () => {
    let handle;
    render(<Box onReady={(u) => { handle = u; }} />);
    act(() => { handle.offer({ message: 'Gone', undo: async () => {} }); });
    fireEvent.click(screen.getByTestId('n-dismiss'));
    expect(screen.queryByTestId('n')).toBeNull();
  });

  test('a remount (the page\'s reloadTick key) shows the same offer; with no caller left it ends', () => {
    let handle;
    const { rerender, unmount } = render(<Box key="a" onReady={(u) => { handle = u; }} />);
    const onFinal = vi.fn();
    act(() => { handle.offer({ message: 'Still here', undo: async () => {}, onFinal }); });
    rerender(<Box key="b" />);
    act(() => { vi.advanceTimersByTime(10); });
    expect(screen.getByTestId('n').textContent).toContain('Still here');
    expect(onFinal).not.toHaveBeenCalled();
    unmount();
    act(() => { vi.advanceTimersByTime(10); });
    expect(onFinal).toHaveBeenCalledWith({ undone: false });
  });

  test('a floating offer is drawn by the floating host even with no caller mounted', () => {
    act(() => { showFloatingUndos(); });
    act(() => { offerUndo('floaty', { message: "'Look A' chosen", undo: async () => {}, floating: true }); });
    expect(screen.getByTestId('undo-floating-notice').textContent).toContain("'Look A' chosen");
    act(() => { vi.advanceTimersByTime(UNDO_MS + 10); });
    expect(screen.queryByTestId('undo-floating-notice')).toBeNull();
  });
});
