/**
 * useStageClipboard - Copy/Paste for scene elements
 * 
 * Ctrl+C: copy selected character or UI element
 * Ctrl+V: paste with slight position offset
 */

import { useState, useCallback } from 'react';

export default function useStageClipboard() {
  const [clipboard, setClipboard] = useState(null); // { type, data }

  const copyElement = useCallback((type, element) => {
    if (!element || type === 'background') return false;
    setClipboard({
      type,
      data: JSON.parse(JSON.stringify(element)),
      copiedAt: Date.now(),
    });
    return true;
  }, []);

  /**
   * Create a pasted copy of the clipboard element with offset position and new ID.
   * @returns {{ type, element }} or null
   */
  const pasteElement = useCallback(() => {
    if (!clipboard) return null;

    const { type, data } = clipboard;
    const pasted = { ...data };

    // New unique ID
    pasted.id = `${type === 'character' ? 'char' : 'ui'}-${Date.now()}`;

    // Offset position by ~5% so it doesn't overlap exactly
    const origX = parseFloat(pasted.position?.x) || 50;
    const origY = parseFloat(pasted.position?.y) || 50;
    pasted.position = {
      x: `${Math.min(95, origX + 5)}%`,
      y: `${Math.min(95, origY + 5)}%`,
    };

    // Append "(copy)" to name/label
    if (type === 'character' && pasted.name) {
      pasted.name = pasted.name.replace(/ \(copy\)$/, '') + ' (copy)';
    } else if (type === 'ui' && pasted.label) {
      pasted.label = pasted.label.replace(/ \(copy\)$/, '') + ' (copy)';
    }

    return { type, element: pasted };
  }, [clipboard]);

  const hasClipboard = !!clipboard;

  return { clipboard, copyElement, pasteElement, hasClipboard };
}
