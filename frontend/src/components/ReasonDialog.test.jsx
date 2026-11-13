/**
 * ReasonDialog + useReasonDialog — asks why, for a step recorded with its
 * reason (A1, 2026-11-13). ask() resolves to the reason, or to null when
 * cancelled; confirming without one sends nothing, says so, and keeps what
 * was typed.
 */
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import useReasonDialog from './ReasonDialog';

function Harness({ onDone }) {
  const { ask, dialog } = useReasonDialog();
  return (
    <>
      <button type="button" onClick={() => ask({ title: 'Decline Velour Cover?', question: 'Why is it declined?', confirm: 'Decline' }).then(onDone)}>Ask</button>
      {dialog}
    </>
  );
}
const open = async (onDone = vi.fn()) => {
  render(<Harness onDone={onDone} />);
  await act(async () => { fireEvent.click(screen.getByText('Ask')); });
  return onDone;
};
const field = () => screen.getByTestId('reason-dialog-field');

describe('ReasonDialog', () => {
  test('nothing is shown until asked; then the title, the question and a focused, labelled field', async () => {
    render(<Harness onDone={vi.fn()} />);
    expect(screen.queryByTestId('reason-dialog')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByText('Ask')); });
    const dialog = screen.getByTestId('reason-dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Decline Velour Cover?')).toBeTruthy();
    expect(screen.getByLabelText('Why is it declined?')).toBe(field());
    expect(document.activeElement).toBe(field());
    expect(screen.getByTestId('reason-dialog-confirm').textContent).toBe('Decline');
    expect(field().getAttribute('maxlength')).toBe('500');
  });

  test('confirming without a reason sends nothing, says a reason is needed, and keeps focus on the field', async () => {
    const onDone = await open();
    await act(async () => { fireEvent.click(screen.getByTestId('reason-dialog-confirm')); });
    expect(onDone).not.toHaveBeenCalled();
    const missing = screen.getByTestId('reason-dialog-missing');
    expect(missing.getAttribute('role')).toBe('alert');
    expect(missing.textContent).toBe('A reason is needed. Nothing was changed.');
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(field().getAttribute('aria-describedby')).toBe('rsn-missing');
    expect(document.activeElement).toBe(field());
  });

  test('only spaces is no reason, and what was typed is kept', async () => {
    const onDone = await open();
    fireEvent.change(field(), { target: { value: '   ' } });
    await act(async () => { fireEvent.click(screen.getByTestId('reason-dialog-confirm')); });
    expect(onDone).not.toHaveBeenCalled();
    expect(field().value).toBe('   ');
    // Typing clears the message; the dialog is still open with the text in it.
    fireEvent.change(field(), { target: { value: '   The fee' } });
    expect(screen.queryByTestId('reason-dialog-missing')).toBeNull();
    expect(field().value).toBe('   The fee');
  });

  test('with a reason it resolves to it, trimmed, and closes', async () => {
    const onDone = await open();
    fireEvent.change(field(), { target: { value: '  The fee is too low  ' } });
    await act(async () => { fireEvent.click(screen.getByTestId('reason-dialog-confirm')); });
    expect(onDone).toHaveBeenCalledWith('The fee is too low');
    expect(screen.queryByTestId('reason-dialog')).toBeNull();
  });

  test('Ctrl+Enter in the field confirms; plain Enter is a new line and sends nothing', async () => {
    const onDone = await open();
    fireEvent.change(field(), { target: { value: 'Not a fit' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => { fireEvent.keyDown(field(), { key: 'Enter', ctrlKey: true }); });
    expect(onDone).toHaveBeenCalledWith('Not a fit');
  });

  test.each([
    ['Cancel', () => fireEvent.click(screen.getByTestId('reason-dialog-cancel'))],
    ['Escape', () => fireEvent.keyDown(field(), { key: 'Escape' })],
    ['the close button', () => fireEvent.click(screen.getByLabelText('Close'))],
  ])('%s resolves to null: the step is not taken', async (_name, cancel) => {
    const onDone = await open();
    fireEvent.change(field(), { target: { value: 'Half a thought' } });
    await act(async () => { cancel(); });
    expect(onDone).toHaveBeenCalledWith(null);
    expect(screen.queryByTestId('reason-dialog')).toBeNull();
  });

  test('asked again, it opens empty', async () => {
    const onDone = await open();
    fireEvent.change(field(), { target: { value: 'First' } });
    await act(async () => { fireEvent.click(screen.getByTestId('reason-dialog-confirm')); });
    await act(async () => { fireEvent.click(screen.getByText('Ask')); });
    expect(field().value).toBe('');
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
