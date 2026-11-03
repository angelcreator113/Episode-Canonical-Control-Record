/**
 * The editor drawn in landscape on a phone held in portrait (Evoni,
 * 2026-11-03: "I want to enter the page and I want the page to be in
 * landscape" — her phone keeps rotation locked to portrait).
 *
 * The page turns itself a quarter turn clockwise (CSS: translateX(screen
 * width) rotate(90deg), origin top left), so the phone is held with its
 * right edge up. A pointer's clientX/clientY are still the screen's, so
 * everything that drags reads its position through here, in the editor's
 * own axes:
 *
 *   editor x = screen y          editor y = screen width − screen x
 *
 * `rotated` is set by the editor page; it is false everywhere else, where
 * these are clientX/clientY unchanged.
 */
let rotated = false;

export const setEditorRotated = (value) => { rotated = Boolean(value); };
export const isEditorRotated = () => rotated;

/** The pointer's position in the editor's axes (absolute only up to a constant: use it for deltas). */
export function pointerXY(e) {
  return rotated ? { x: e.clientY, y: -e.clientX } : { x: e.clientX, y: e.clientY };
}

/** The pointer's position inside `el`, from its top-left corner, in the editor's axes. */
export function pointerIn(e, el) {
  const r = el.getBoundingClientRect();
  return rotated ? { x: e.clientY - r.top, y: r.right - e.clientX } : { x: e.clientX - r.left, y: e.clientY - r.top };
}
