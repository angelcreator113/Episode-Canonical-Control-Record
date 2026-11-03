/** The turned editor's pointer positions (Evoni, 2026-11-03: landscape on a portrait-locked phone). */
import { describe, test, expect, afterEach } from 'vitest';
import { setEditorRotated, pointerXY, pointerIn } from './editorRotation';

const el = { getBoundingClientRect: () => ({ left: 10, top: 100, right: 300, bottom: 900 }) };

describe('editorRotation', () => {
  afterEach(() => setEditorRotated(false));

  test('not turned: the screen position as it is', () => {
    expect(pointerXY({ clientX: 40, clientY: 70 })).toEqual({ x: 40, y: 70 });
    expect(pointerIn({ clientX: 40, clientY: 170 }, el)).toEqual({ x: 30, y: 70 });
  });

  test("turned a quarter turn clockwise: the editor's x runs down the screen, its y right to left", () => {
    setEditorRotated(true);
    const a = pointerXY({ clientX: 200, clientY: 300 });
    const down = pointerXY({ clientX: 200, clientY: 350 }); // a finger moving down the screen…
    const left = pointerXY({ clientX: 150, clientY: 300 }); // …or to its left
    expect(down.x - a.x).toBe(50); // …moves right along the editor
    expect(down.y - a.y).toBe(0);
    expect(left.y - a.y).toBe(50); // …moves down the editor
    expect(left.x - a.x).toBe(0);
    expect(pointerIn({ clientX: 260, clientY: 180 }, el)).toEqual({ x: 80, y: 40 });
  });
});
