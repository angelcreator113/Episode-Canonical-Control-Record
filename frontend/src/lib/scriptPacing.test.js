/** Pacing tips in "Ready to film?" (lib/scriptPacing; Evoni, 2026-10-25). */
import { describe, it, expect } from 'vitest';
import { scriptPacing, pacingRows, paceKind, HOOK_SECONDS, TALK_SECONDS } from './scriptPacing';
import { scriptHealth } from './scriptHealth';
import { beatStatus, beatChecklist } from './scriptBeatView';

// n spoken words: 150 a minute, so 25 words is 10 seconds.
const say = (n, who = 'Me') => `${who}: ${Array.from({ length: n }, () => 'word').join(' ')}`;
const beat = (number, lines) => ({ id: `beat-${number}`, number, name: `Beat ${number}`, lines });

describe('paceKind', () => {
  it.each([
    ['[UI:CLICK MailIcon]', 'screen'],
    ['[WEAR: w-1]', 'screen'],
    ['[TRANSITION: fade]', 'screen'],
    ['(She spins)', 'screen'],
    ['Lala (auto): Wow!', 'screen'],
    ['Me: hello there', 'talk'],
    ['Lala: hello', 'talk'],
    ['[STAT: coins -5]', 'none'],
    ['---', 'none'],
    ['', 'none'],
  ])('%s is %s', (line, kind) => {
    expect(paceKind(line)).toBe(kind);
  });
});

describe('scriptPacing', () => {
  it('times each beat and the whole script', () => {
    const p = scriptPacing([beat(1, [say(25), '[UI:CLICK MailIcon]']), beat(2, [say(50)])]);
    expect(p.beats.map((b) => [b.number, b.seconds, b.label])).toEqual([[1, 13, '~13s'], [2, 20, '~20s']]);
    expect(p.total).toBe(33);
    expect(p.warnings).toEqual([]);
  });

  it('warns when the hook talks too long before anything happens', () => {
    const p = scriptPacing([beat(1, [say(50), say(40), '[UI:SHOW phone]'])]);
    expect(p.warnings.map((w) => w.key)).toContain('pacing-hook');
    expect(p.warnings[0].text).toMatch(/Beat 1 \(the hook\) talks for about 36 seconds/);
  });

  it('is quiet when something happens early in the hook', () => {
    const p = scriptPacing([beat(1, [say(10), '[UI:SHOW phone]', say(100)]), beat(2, ['[UI:CLICK x]'])]);
    expect(p.warnings.find((w) => w.key === 'pacing-hook')).toBeUndefined();
    expect(HOOK_SECONDS).toBe(30);
  });

  it('warns about a beat more than twice the average', () => {
    const short = (n) => beat(n, [say(25), '[UI:CLICK x]']);
    const p = scriptPacing([short(1), short(2), short(3), short(4), beat(5, ['[UI:CLICK x]', say(100), '[UI:CLICK y]', say(100), '[UI:CLICK z]'])]);
    const long = p.warnings.find((w) => w.key === 'pacing-long-beat-5');
    expect(long.text).toMatch(/Beat 5 runs ~1m 29s, more than twice the average/);
  });

  it('warns about a long stretch of talk with nothing on screen, across beats', () => {
    const p = scriptPacing([beat(1, ['[UI:SHOW phone]', say(30)]), beat(2, [say(60), say(30), '[UI:CLICK x]'])]);
    const talk = p.warnings.find((w) => w.key.startsWith('pacing-talk'));
    expect(talk.text).toMatch(/^Beats 1 to 2: about 48 seconds of talk/);
    expect(TALK_SECONDS).toBe(45);
  });

  it('counts no talk stretch in the cutscene', () => {
    const p = scriptPacing([beat(10, ['[UI:CLICK x]']), beat(11, [say(100, 'Lala'), say(100, 'Marcus')]), beat(14, ['[UI:CLICK y]'])]);
    expect(p.warnings.filter((w) => w.key.startsWith('pacing-talk'))).toEqual([]);
  });

  it('an automatic reaction breaks up the talk', () => {
    const p = scriptPacing([beat(2, [say(60), 'Lala (auto): Ooh!', say(60)])]);
    expect(p.warnings.filter((w) => w.key.startsWith('pacing-talk'))).toEqual([]);
  });
});

describe('pacing in Ready to film?', () => {
  const beats = [beat(1, [say(50), say(40), '[UI:SHOW phone]']), beat(2, ['[UI:CLICK x]'])];

  it('is advice: the rows are tips with the per-beat list', () => {
    const rows = pacingRows(beats);
    expect(rows[0]).toMatchObject({ key: 'pacing', advice: true, ok: false });
    expect(rows[0].timings.map((t) => t.number)).toEqual([1, 2]);
    expect(rows.slice(1).every((r) => r.advice && !r.ok)).toBe(true);
    expect(pacingRows([])).toEqual([]);
  });

  it('never marks a beat for revision or fills its checklist', () => {
    const rows = scriptHealth({ beats }).filter((r) => r.advice);
    expect(rows.length).toBeGreaterThan(1);
    expect(beatStatus(beats[0], rows)).toBe('draft');
    expect(beatChecklist(beats[0], { healthRows: rows }).items.some((i) => i.key.startsWith('health-pacing'))).toBe(false);
  });
});

// Her learned reading pace (lib/learnedPace; Evoni, 2026-10-28).
describe('pacing at her learned pace', () => {
  it('with no pace, exactly as before', () => {
    const beats = [beat(1, [say(75), '[UI:OPEN closet]'])];
    expect(scriptPacing(beats, null)).toEqual(scriptPacing(beats));
    expect(pacingRows(beats)[0].text).toBe('Rough running time: ~33s (150 spoken words a minute, a few seconds per step on screen).');
  });
  it('her lines at her pace, others at 150, and the row says so', () => {
    const beats = [beat(1, [say(75), say(25, 'Lala'), '[UI:OPEN closet]'])];
    const p = scriptPacing(beats, { wpm: 225 });
    expect(p.beats[0].seconds).toBe(20 + 10 + 3);
    expect(pacingRows(beats, { wpm: 225 })[0].text).toBe('Rough running time: ~33s (your lines at your pace, 225 words a minute; others at 150, a few seconds per step on screen).');
    expect(scriptHealth({ beats, pace: { wpm: 225 } }).find((r) => r.key === 'pacing').timings[0].seconds).toBe(33);
  });
  it('a hook that talks too long at 150 may not at her faster pace', () => {
    const beats = [beat(1, [say(90), '[UI:OPEN closet]']), beat(2, [say(10)])];
    expect(scriptPacing(beats).warnings.some((w) => w.key === 'pacing-hook')).toBe(true);
    expect(scriptPacing(beats, { wpm: 200 }).warnings.some((w) => w.key === 'pacing-hook')).toBe(false);
  });
});
