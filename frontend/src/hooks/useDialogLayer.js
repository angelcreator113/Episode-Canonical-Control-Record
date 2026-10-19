// The dialogs open on a page, newest last (Script page re-audit, 2026-10-19:
// with History open, the DREAM Map or a scene picture opened over it, and one
// Escape closed both; History's Tab trap pulled focus back behind the map).
// Only the dialog on top answers Escape and Tab.
import { useEffect, useRef } from 'react';

const layers = [];

/**
 * While `open`, this dialog is a layer; returns isTop(), true when it is the
 * newest open layer.
 */
export default function useDialogLayer(open) {
  const token = useRef(null);
  if (!token.current) token.current = {};
  useEffect(() => {
    if (!open) return undefined;
    const t = token.current;
    layers.push(t);
    return () => {
      const i = layers.lastIndexOf(t);
      if (i >= 0) layers.splice(i, 1);
    };
  }, [open]);
  return () => layers[layers.length - 1] === token.current;
}
