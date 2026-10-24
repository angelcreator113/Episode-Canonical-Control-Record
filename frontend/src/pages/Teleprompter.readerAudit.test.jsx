// Teleprompter reader audit (Evoni, 2026-10-24: "fix all of them"): the
// line on the reading line when a beat opens, a reflow keeping her place,
// Space after a tap, the 3-2-1 and pacing, header labels, her name, the
// silence cue's live region, Escape and panels, Play at the end, and pasted
// text's on-screen moments.
// jsdom has no layout: a fake one below gives each beat heading 60px and
// each line 2.5 × the text size, in document order, in a 600px scroll box.
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import Teleprompter from './Teleprompter';
import TeleprompterReader, { SETTINGS_KEY, cueSays } from '../components/Teleprompter/TeleprompterReader';
import { teleprompterScript, pastedScript, speakersOf } from '../lib/teleprompterLines';
import { speakerLine, NOT_SPEAKERS } from '../lib/scriptSpeaker';

const SCRIPT = [
  'Episode 1: The Studio',
  'Logline: Lala gets an invite to the Studio.',
  'Host: Lala',
  'Forward Hook: the gala.',
  'Me: "Okay besties, grab your coffee."',
  '## BEAT: 1 · Opening Ritual',
  'Me: "Good morning besties."',
  'Lala: "Wait, what?"',
  '(She laughs.)',
  'Me: "Stay quiet now."',
  '## BEAT: 2 · Login Sequence',
  'Me: "Let us log in."',
  '[UI:SHOW phone]',
  'Lala: "Logging in. Hi everyone!"',
  'Me: "And we are in."',
  '## BEAT: 3 · Closet',
  'Me: "The closet."',
  'Lala: "So many."',
].join('\n');
const source = { kind: 'script', scriptText: SCRIPT, episodeId: null, title: 'Ep 1' };

const box = () => screen.getByTestId('stp-scroll');
const activeLine = () => document.querySelector('[data-at="true"]');
const rect = (top) => ({ top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top });

// The fake layout: a top in the scroll box's content for every heading and line.
function contentTop(el) {
  const page = document.querySelector('[data-testid="stp-page"]');
  if (!page || !page.contains(el)) return null;
  const size = parseFloat(page.style.getPropertyValue('--stp-size')) || 40;
  let t = 200; // the top spacer
  for (const item of page.querySelectorAll('.stp-beat, [data-line]')) {
    if (item === el) return t;
    t += item.classList.contains('stp-beat') ? 60 : size * 2.5;
  }
  return null;
}
let restore = [];
function fakeLayout() {
  const proto = window.HTMLElement.prototype;
  const own = (name) => Object.getOwnPropertyDescriptor(proto, name) || Object.getOwnPropertyDescriptor(window.Element.prototype, name);
  const was = { rect: window.Element.prototype.getBoundingClientRect, ch: own('clientHeight'), sh: own('scrollHeight') };
  window.Element.prototype.getBoundingClientRect = function fake() {
    if (this.dataset?.testid === 'stp-scroll') return rect(0);
    const t = contentTop(this);
    const sc = document.querySelector('[data-testid="stp-scroll"]');
    return rect(t == null ? 0 : t - (sc?.scrollTop || 0));
  };
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get() { return this.dataset?.testid === 'stp-scroll' ? 600 : 0; } });
  Object.defineProperty(proto, 'scrollHeight', {
    configurable: true,
    get() {
      if (this.dataset?.testid !== 'stp-scroll') return 0;
      const items = [...document.querySelectorAll('[data-testid="stp-page"] [data-line]')];
      const last = items[items.length - 1];
      return (last ? contentTop(last) : 0) + 600;
    },
  });
  restore.push(() => {
    window.Element.prototype.getBoundingClientRect = was.rect;
    if (was.ch) Object.defineProperty(proto, 'clientHeight', was.ch); else delete proto.clientHeight;
    if (was.sh) Object.defineProperty(proto, 'scrollHeight', was.sh); else delete proto.scrollHeight;
  });
}
// Where a line sits on screen: 0 is the reading line (a third of 600px down).
const offMarker = (el) => contentTop(el) - box().scrollTop - 200;
const lineWith = (text) => [...document.querySelectorAll('[data-line]')].find((el) => el.textContent.includes(text));

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false }));
  fakeLayout();
});
afterEach(() => {
  restore.forEach((f) => f());
  delete window.webkitSpeechRecognition;
  restore = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('1 · a beat opens on its first line', () => {
  test('opening on beat 2: its first line is on the reading line and active, also after the scroll event', () => {
    render(<TeleprompterReader source={source} startBeat={2} onClose={() => {}} />);
    const first = lineWith('Let us log in.');
    expect(offMarker(first)).toBe(0);
    expect(activeLine()).toBe(first);
    fireEvent.scroll(box());
    expect(activeLine()).toBe(first);
    expect(screen.queryByTestId('stp-quiet')).toBeNull(); // not "Stay quiet · Lala" from beat 1
  });

  test("a beat's heading on the reading line counts as its first line", () => {
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    const head = document.querySelectorAll('.stp-beat')[2];
    box().scrollTop = contentTop(head) - 200; // the heading on the reading line, its first line below
    fireEvent.scroll(box());
    expect(activeLine().textContent).toContain('The closet.');
    expect(screen.getByTestId('stp-jump').value).toBe('2');
  });

  test('jump then Pace by line times: Play starts on the beat\'s first line, then its next', () => {
    vi.useFakeTimers();
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    fireEvent.change(screen.getByTestId('stp-jump'), { target: { value: '1' } });
    fireEvent.scroll(box());
    expect(activeLine().textContent).toContain('Let us log in.');
    fireEvent.click(screen.getByTestId('stp-pace-lines'));
    fireEvent.click(screen.getByTestId('stp-play'));
    fireEvent.scroll(box());
    expect(activeLine().textContent).toContain('Let us log in.');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(activeLine().getAttribute('data-testid')).toBe('stp-screen');
  });
});

describe('2 · a reflow keeps her place', () => {
  test('A+ six times keeps the same line on the reading line', () => {
    render(<TeleprompterReader source={source} startBeat={2} onClose={() => {}} />);
    const target = lineWith('Logging in.');
    box().scrollTop = contentTop(target) - 200;
    fireEvent.scroll(box());
    expect(activeLine()).toBe(target);
    for (let i = 0; i < 6; i += 1) fireEvent.click(screen.getByTestId('stp-larger'));
    expect(screen.getByTestId('stp-size').textContent).toContain('64');
    expect(activeLine().textContent).toContain('Logging in.');
    expect(offMarker(activeLine())).toBe(0);
    fireEvent.scroll(box());
    expect(activeLine().textContent).toContain('Logging in.');
    expect(screen.getByTestId('stp-jump').value).toBe('1');
  });

  test('line mode and Read as keep the line', () => {
    render(<TeleprompterReader source={source} startBeat={3} onClose={() => {}} />);
    const target = lineWith('So many.');
    box().scrollTop = contentTop(target) - 200;
    fireEvent.scroll(box());
    fireEvent.click(screen.getByTestId('stp-mode-same'));
    expect(activeLine().textContent).toContain('So many.');
    fireEvent.change(screen.getByTestId('stp-read-as'), { target: { value: 'Lala' } });
    expect(activeLine().textContent).toContain('So many.');
    expect(offMarker(activeLine())).toBe(0);
  });

  test('on-screen moments off: the line stays; on a moment, the next line takes its place', () => {
    render(<TeleprompterReader source={source} startBeat={2} onClose={() => {}} />);
    const after = lineWith('And we are in.');
    box().scrollTop = contentTop(after) - 200;
    fireEvent.scroll(box());
    fireEvent.click(screen.getByTestId('stp-more'));
    fireEvent.click(screen.getByTestId('stp-screen-toggle'));
    expect(screen.queryByTestId('stp-screen')).toBeNull();
    expect(activeLine().textContent).toContain('And we are in.');
    expect(offMarker(activeLine())).toBe(0);
    fireEvent.click(screen.getByTestId('stp-screen-toggle'));
    const moment = screen.getByTestId('stp-screen');
    box().scrollTop = contentTop(moment) - 200;
    fireEvent.scroll(box());
    expect(activeLine()).toBe(moment);
    fireEvent.click(screen.getByTestId('stp-screen-toggle'));
    expect(activeLine().textContent).toContain('Logging in.');
  });
});

describe('3 · Space and Up/Down after a tap', () => {
  test('Space on a reader button plays (not the button again) and focus goes back to the reader', () => {
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    const larger = screen.getByTestId('stp-larger');
    fireEvent.click(larger);
    larger.focus();
    fireEvent.keyDown(larger, { key: ' ' });
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('stp-size').textContent).toContain('44');
    expect(document.activeElement).toBe(screen.getByTestId('teleprompter'));
    fireEvent.keyDown(document.activeElement, { key: ' ' });
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('false');
  });

  test('Space on the speed slider plays; a choice in Read as or the beat list hands the keys back', () => {
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    const speed = screen.getByTestId('stp-speed');
    speed.focus();
    fireEvent.keyDown(speed, { key: ' ' });
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(document.activeElement, { key: ' ' });
    const readAs = screen.getByTestId('stp-read-as');
    readAs.focus();
    fireEvent.change(readAs, { target: { value: 'Lala' } });
    expect(document.activeElement).toBe(screen.getByTestId('teleprompter'));
    fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' });
    expect(screen.getByTestId('stp-speed').value).toBe('6');
    expect(readAs.value).toBe('Lala');
    const jump = screen.getByTestId('stp-jump');
    jump.focus();
    fireEvent.change(jump, { target: { value: '2' } });
    expect(document.activeElement).toBe(screen.getByTestId('teleprompter'));
  });

  test('a button in a panel keeps Space for itself', () => {
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-rehearsal-toggle'));
    const inPanel = document.querySelector('.stp-rehearsal button');
    expect(inPanel).toBeTruthy();
    inPanel.focus();
    fireEvent.keyDown(inPanel, { key: ' ' });
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement).toBe(inPanel);
  });
});

describe('4 · pacing and on-screen moments stop the 3-2-1', () => {
  test.each(['stp-pace-lines', 'stp-pace-steady', 'stp-pace-voice'])('%s during the 3-2-1 cancels it', (id) => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: true }));
    window.webkitSpeechRecognition = function FakeRecognition() {};
    vi.useFakeTimers();
    render(<TeleprompterReader source={source} countdownMs={1000} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(screen.getByTestId('stp-countdown').textContent).toBe('3');
    fireEvent.click(screen.getByTestId(id));
    expect(screen.queryByTestId('stp-countdown')).toBeNull();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('false');
  });

  test('Show on-screen moments cannot change during the 3-2-1 (it is held until the count ends or stops)', () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: true }));
    vi.useFakeTimers();
    render(<TeleprompterReader source={source} countdownMs={1000} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(screen.getByTestId('stp-screen-toggle').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(screen.queryByTestId('stp-countdown')).toBeNull();
    expect(screen.getByTestId('stp-screen-toggle').disabled).toBe(false);
  });
});

describe('5 · header labels are not speakers', () => {
  test('Logline, Host, Forward Hook and the rest are labels', () => {
    for (const l of ['Logline: x', 'Host: Lala', 'Forward Hook: the gala', 'Episode: 1', 'Goal: win', 'Wardrobe: p1', 'Venue: Studio', 'Cast: Lala']) {
      expect(speakerLine(l)).toBeNull();
    }
    expect(NOT_SPEAKERS.has('synopsis')).toBe(true);
    expect(speakerLine('Lala: "Hi."')).toMatchObject({ speaker: 'Lala' });
  });

  test("Read as lists the script's people only; a header name that never speaks in a beat reads as a direction", () => {
    const s = teleprompterScript('Producer Note: keep it short\nGuest: "Hi from the top."\nMe: "Okay."\n## BEAT: 1 · Opening Ritual\nLala: "Hi."');
    expect(s.intro.map((l) => l.kind)).toEqual(['direction', 'direction', 'mine']);
    expect(speakersOf([...s.intro, ...s.beats[0].lines])).toEqual(['JustAWoman', 'Lala']);
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    expect([...screen.getByTestId('stp-read-as').options].map((o) => o.value)).toEqual(['JustAWoman', 'Lala']);
  });
});

describe('6-8 · mirror, camera and phone layout classes', () => {
  test('mirror and the camera put the cue on the left (CSS keys off these classes)', () => {
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-mirror'));
    expect(screen.getByTestId('teleprompter').className).toContain('is-mirrored');
  });
});

describe('9 · her lines say JustAWoman', () => {
  test('Me:, Prime: and JAWIHP: are labelled JustAWoman', () => {
    render(<TeleprompterReader source={{ kind: 'text', text: 'Me: "One."\nPrime: "Two."\nJAWIHP: "Three."\nLala: "Four."' }} onClose={() => {}} />);
    expect([...document.querySelectorAll('.stp-line.is-mine .stp-speaker')].map((e) => e.textContent)).toEqual(['JustAWoman', 'JustAWoman', 'JustAWoman']);
  });
});

describe('10 · a11y', () => {
  test('the silence cue is not a live region; one status line says what it is, once', () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, readAs: 'JustAWoman' }));
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    const lala = lineWith('Wait, what?');
    box().scrollTop = contentTop(lala) - 200;
    fireEvent.scroll(box());
    const cue = screen.getByTestId('stp-quiet');
    expect(cue.getAttribute('role')).toBeNull();
    expect(cue.querySelector('[role],[aria-live]')).toBeNull();
    expect(screen.getByTestId('stp-quiet-live').getAttribute('role')).toBe('status');
    expect(screen.getByTestId('stp-quiet-live').textContent).toBe('Stay quiet · react · Lala');
    expect(cueSays({ kind: 'direction' })).toBe('Action');
  });

  test('Escape closes the open panel first, then the reader', () => {
    const onClose = vi.fn();
    render(<TeleprompterReader source={{ ...source, episodeId: 'ep-1' }} onClose={onClose} />);
    const root = screen.getByTestId('teleprompter');
    fireEvent.click(screen.getByTestId('stp-rehearsal-toggle'));
    expect(screen.getByTestId('stp-rehearsal-toggle').getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(root, { key: 'Escape' });
    expect(screen.getByTestId('stp-rehearsal-toggle').getAttribute('aria-pressed')).toBe('false');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('stp-more'));
    expect(screen.getByTestId('stp-more').getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(root, { key: 'Escape' });
    expect(screen.getByTestId('stp-more').getAttribute('aria-expanded')).toBe('false');
    fireEvent.keyDown(root, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('the source tabs: ids, the panel they control, arrow keys', () => {
    render(<MemoryRouter initialEntries={['/teleprompter']}><Routes><Route path="/teleprompter" element={<Teleprompter />} /></Routes></MemoryRouter>);
    const paste = screen.getByTestId('stp-source-paste');
    const pick = screen.getByTestId('stp-source-script');
    expect(paste.getAttribute('aria-controls')).toBe('stp-panel-paste');
    expect(document.getElementById('stp-panel-paste').getAttribute('aria-labelledby')).toBe('stp-tab-paste');
    expect(pick.tabIndex).toBe(-1);
    paste.focus();
    fireEvent.keyDown(paste, { key: 'ArrowRight' });
    expect(pick.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(pick);
    expect(document.getElementById('stp-panel-script')).toBeTruthy();
    fireEvent.keyDown(pick, { key: 'Home' });
    expect(paste.getAttribute('aria-selected')).toBe('true');
  });
});

describe('11 · Play at the end, and pasted on-screen moments', () => {
  test('Pace by line times at the end: Play goes back to the top and plays', () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ countdown: false, pacing: 'lines', pace: 2 }));
    vi.useFakeTimers();
    render(<TeleprompterReader source={{ kind: 'text', text: 'Me: "One."\nLala: "Two."' }} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('stp-play'));
    for (let i = 0; i < 5; i += 1) act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('false');
    expect(activeLine().textContent).toContain('Two.');
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(activeLine().textContent).toContain('One.');
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('stp-status').textContent).toContain('Back to the top');
  });

  test('steady, scrolled to the bottom: Play goes back to the top', () => {
    render(<TeleprompterReader source={source} onClose={() => {}} />);
    box().scrollTop = box().scrollHeight - 600;
    fireEvent.scroll(box());
    fireEvent.click(screen.getByTestId('stp-play'));
    expect(box().scrollTop).toBe(0);
    expect(screen.getByTestId('stp-status').textContent).toContain('Back to the top');
    expect(screen.getByTestId('stp-play').getAttribute('aria-pressed')).toBe('true');
  });

  test('pasted text keeps its [UI:] moments, and the toggle hides them', () => {
    expect(pastedScript('Lala: "Hi."\n[UI:SHOW phone]\nMe: "Yes."')[0].map((l) => l.kind)).toEqual(['cue', 'screen', 'mine']);
    render(<TeleprompterReader source={{ kind: 'text', text: 'Lala: "Hi."\n[UI:SHOW phone]\nMe: "Yes."' }} onClose={() => {}} />);
    expect(screen.getByTestId('stp-screen').textContent).toContain('Phone comes up');
    fireEvent.click(screen.getByTestId('stp-screen-toggle'));
    expect(screen.queryByTestId('stp-screen')).toBeNull();
    expect(screen.getAllByTestId('stp-mine')).toHaveLength(1);
  });
});
