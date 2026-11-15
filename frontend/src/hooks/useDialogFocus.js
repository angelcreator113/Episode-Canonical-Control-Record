/**
 * useDialogFocus — a dialog's keyboard behaviour, from the primitives the
 * app already has: the Relationship Engine's useFocusTrap (focus moves in
 * on open, to `[data-autofocus]` or the first control; Tab and Shift+Tab
 * stay inside; Escape closes; focus goes back where it was on close) and
 * useDialogLayer (only the dialog on top answers Escape).
 *
 * `onClose` may be a new function on every render: it is read through a
 * ref, so the trap is set once while the dialog is open and typing in it
 * never moves the focus. Returns the ref for the dialog's element.
 */
import { useCallback, useRef } from 'react';
import { useFocusTrap } from '../components/RelationshipEngine/primitives';
import useDialogLayer from './useDialogLayer';

export default function useDialogFocus(open, onClose) {
  const close = useRef(onClose);
  close.current = onClose;
  const isTop = useDialogLayer(open);
  const top = useRef(isTop);
  top.current = isTop;
  const onEscape = useCallback(() => { if (top.current()) close.current?.(); }, []);
  return useFocusTrap(open, onEscape);
}
