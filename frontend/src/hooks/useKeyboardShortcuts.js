import { useEffect } from 'react';

/**
 * Declarative keyboard shortcut hook.
 *
 * @param {Object<string, function>} shortcutMap
 *   Keys are shortcut descriptors:  "f", "Escape", "ctrl+s", "ctrl+Enter", "ArrowUp"
 *   Values are handler functions receiving the KeyboardEvent.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.ignoreInputs=true] - skip events originating from INPUT / TEXTAREA
 * @param {boolean} [opts.enabled=true]      - master switch (e.g. disable during modals)
 *
 * @example
 *   useKeyboardShortcuts({
 *     'f':           () => setReadingMode(v => !v),
 *     'Escape':      () => setReadingMode(false),
 *     'ArrowUp':     () => navigateStory(-1),
 *     'ArrowDown':   () => navigateStory(1),
 *     'ctrl+s':      () => handleSaveForLater(activeStory),
 *     'ctrl+Enter':  () => setApproveConfirm(activeStory),
 *   });
 */
export default function useKeyboardShortcuts(shortcutMap, opts = {}) {
  const { ignoreInputs = true, enabled = true } = opts;

  useEffect(() => {
    if (!enabled) return;

    function handler(e) {
      if (ignoreInputs) {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      }

      for (const [descriptor, fn] of Object.entries(shortcutMap)) {
        if (matchesShortcut(e, descriptor)) {
          e.preventDefault();
          fn(e);
          return;
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcutMap, ignoreInputs, enabled]);
}

/**
 * Parse "ctrl+s" style descriptors and match against a KeyboardEvent.
 * Modifier prefixes: ctrl, meta, alt, shift (case-insensitive).
 * The final token is compared to e.key (case-insensitive for single chars).
 */
function matchesShortcut(e, descriptor) {
  const parts = descriptor.split('+');
  const key = parts.pop();

  const modifiers = {
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
  };

  for (const mod of parts) {
    const m = mod.toLowerCase();
    if (m in modifiers) modifiers[m] = true;
    // "mod" means ctrl on Windows/Linux, meta on Mac
    if (m === 'mod') {
      modifiers.ctrl = true;
      modifiers.meta = true;
    }
  }

  // Check modifiers — for "ctrl" we accept either ctrlKey or metaKey (cross-platform)
  if (modifiers.ctrl || modifiers.meta) {
    if (!e.ctrlKey && !e.metaKey) return false;
  } else {
    if (e.ctrlKey || e.metaKey) return false;
  }
  if (modifiers.alt !== e.altKey) return false;
  if (modifiers.shift !== e.shiftKey) return false;

  // Match key
  if (key.length === 1) {
    return e.key.toLowerCase() === key.toLowerCase();
  }
  return e.key === key;
}
