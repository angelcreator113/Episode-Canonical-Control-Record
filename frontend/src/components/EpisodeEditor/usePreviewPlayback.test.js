/**
 * The working preview's player (Timeline Editor redesign P2): one clock;
 * every sound follows it. The clock, the frame scheduler and the audio
 * elements are injected, so the test drives time exactly.
 */
import { describe, test, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import usePreviewPlayback from './usePreviewPlayback';

function fakeAudio() {
  const el = {
    paused: true, currentTime: 0, volume: 1, playbackRate: 1, src: '', dataset: {}, preload: '',
    play: vi.fn(() => { el.paused = false; return Promise.resolve(); }),
    pause: vi.fn(() => { el.paused = true; }),
    addEventListener: vi.fn(), removeAttribute: vi.fn(),
  };
  return el;
}

function setup({ duration = 10000, sounds = () => [] } = {}) {
  let wall = 0;
  const frames = [];
  const made = [];
  const hook = renderHook(() => {
    const [playhead, setPlayhead] = useState(0);
    const player = usePreviewPlayback({
      duration, playhead, setPlayhead, soundsAt: sounds, masterVolume: 0.5,
      now: () => wall,
      raf: (fn) => { frames.push(fn); return frames.length; },
      cancelRaf: () => { frames.length = 0; },
      makeAudio: () => { const a = fakeAudio(); made.push(a); return a; },
    });
    return { playhead, player };
  });
  const advance = (ms) => act(() => {
    wall += ms;
    const run = frames.splice(0);
    for (const fn of run) fn();
  });
  return { hook, advance, made };
}

const voice = (t) => [{
  key: 'dialogue:d1', label: 'Beat 1 · line 1', url: 'https://cdn/ap1.webm',
  active: t >= 1000 && t < 3000, muted: false, volume: 0.8, source_time_ms: t >= 1000 && t < 3000 ? 200 + (t - 1000) : null,
}];

describe('usePreviewPlayback', () => {
  test('Play runs the edit clock in whole frames; Pause holds it', () => {
    const { hook, advance } = setup();
    act(() => hook.result.current.player.play());
    expect(hook.result.current.player.playing).toBe(true);
    advance(500);
    expect(hook.result.current.playhead).toBe(500);
    advance(510);
    expect(hook.result.current.playhead).toBe(1000); // 1010 ms snaps to frame 30
    act(() => hook.result.current.player.pause());
    const held = hook.result.current.playhead;
    advance(1000);
    expect(hook.result.current.player.playing).toBe(false);
    expect(hook.result.current.playhead).toBe(held);
  });

  test('it stops at the end of the edit', () => {
    const { hook, advance } = setup({ duration: 1000 });
    act(() => hook.result.current.player.play());
    advance(1500);
    expect(hook.result.current.player.playing).toBe(false);
    expect(hook.result.current.playhead).toBe(1000);
  });

  test('a sound starts at its place in its file when the clock reaches it, at its level times the preview volume, and stops after', () => {
    const { hook, advance, made } = setup({ sounds: voice });
    act(() => hook.result.current.player.play());
    advance(1500);
    expect(made).toHaveLength(1);
    const el = made[0];
    expect(el.src).toBe('https://cdn/ap1.webm');
    expect(el.play).toHaveBeenCalledTimes(1);
    expect(el.currentTime).toBeCloseTo(0.7, 2);
    expect(el.volume).toBeCloseTo(0.4, 5);
    advance(2000);
    expect(el.pause).toHaveBeenCalled();
    expect(el.paused).toBe(true);
  });

  test('a sound that drifts from the clock is moved back to it', () => {
    const { hook, advance, made } = setup({ sounds: voice });
    act(() => hook.result.current.player.play());
    advance(1200);
    const el = made[0];
    el.currentTime = 5; // the element wandered
    advance(100);
    expect(el.currentTime).toBeCloseTo(0.5, 2);
  });

  test('a muted lane does not play; L doubles the rate', () => {
    const { hook, advance, made } = setup({ sounds: (t) => voice(t).map((s) => ({ ...s, muted: true })) });
    act(() => hook.result.current.player.play());
    advance(1500);
    expect(made[0].play).not.toHaveBeenCalled();
    act(() => hook.result.current.player.faster());
    expect(hook.result.current.player.rate).toBe(2);
    const from = hook.result.current.playhead;
    advance(500);
    expect(hook.result.current.playhead).toBe(from + 1000);
  });
});
