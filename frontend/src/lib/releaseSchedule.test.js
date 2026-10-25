import { describe, test, expect } from 'vitest';
import {
  formatDay, formatTime, formatRelease, scheduleSentence, whenText, deadlineWarning, datetimeLocal, moveText, slotWhen, firstDue, onSchedule,
} from './releaseSchedule';

const ready = [
  { key: 'cut', label: 'Final cut', state: 'ready' },
  { key: 'thumbnail', label: 'Thumbnail', state: 'todo' },
  { key: 'copy', label: 'Title & copy', state: 'progress' },
  { key: 'schedule', label: 'Schedule', state: 'ready' },
];

describe('release schedule words', () => {
  test('days, times and the sentence', () => {
    expect(formatDay('2026-11-01')).toBe('Sun, Nov 1');
    expect(formatTime('10:00')).toBe('10:00 AM');
    expect(formatTime('00:05')).toBe('12:05 AM');
    expect(formatTime('13:30')).toBe('1:30 PM');
    expect(formatRelease({ date: '2026-11-01', time: '10:00' })).toBe('Sun, Nov 1 · 10:00 AM');
    expect(formatRelease({ date: '2026-11-01' })).toBe('Sun, Nov 1');
    expect(scheduleSentence({ day: 'sun', time: '10:00' })).toBe('Releases on YouTube every Sunday at 10:00 AM');
    expect(scheduleSentence({ day: 'sun', time: '10:00', platforms: ['youtube', 'tiktok'] })).toBe('Releases on YouTube and TikTok every Sunday at 10:00 AM');
    expect(onSchedule({ platforms: ['youtube'] }, 'youtube')).toBe(true);
    expect(onSchedule({ platforms: ['youtube'] }, 'tiktok')).toBe(false);
    expect(onSchedule(null, 'youtube')).toBe(false);
  });

  test('where a date came from', () => {
    expect(whenText({ date: '2026-11-01', time: '10:00', source: 'schedule' })).toBe('Sun, Nov 1 · 10:00 AM (from the weekly schedule)');
    expect(whenText({ date: '2026-11-01', time: '10:00', source: 'hand' })).toBe('Sun, Nov 1 · 10:00 AM (set by hand)');
    expect(whenText({ date: '2026-11-01', time: '10:00', source: 'preview' })).toBe('Would be Sun, Nov 1 · 10:00 AM');
  });

  test('the deadline warning lists what is not ready', () => {
    expect(deadlineWarning({ episode_number: 3, date: '2026-11-01', time: '10:00', due: 'soon', days_until: 2 }, ready))
      .toEqual({ tone: 'soon', text: 'Episode 3 releases in 2 days and still needs: thumbnail, title & copy.' });
    expect(deadlineWarning({ episode_number: 3, due: 'soon', days_until: 0 }, [{ key: 'cut', label: 'Final cut', state: 'ready' }]).text)
      .toBe('Episode 3 releases today and has everything it needs.');
    expect(deadlineWarning({ episode_number: 3, due: 'soon', days_until: 1 }, null).text).toBe('Episode 3 releases tomorrow.');
    expect(deadlineWarning({ episode_number: 3, date: '2026-11-01', time: '10:00', due: 'overdue' }, ready).text)
      .toBe('Episode 3 was due Sun, Nov 1 · 10:00 AM and is not released yet. It still needs: thumbnail, title & copy.');
    expect(deadlineWarning({ episode_number: 3, due: 'later', days_until: 9 }, ready)).toBeNull();
    expect(deadlineWarning({ episode_number: 3, due: null }, ready)).toBeNull();
  });

  test('a platform time from the row, and moves in words', () => {
    expect(datetimeLocal({ date: '2026-11-01', time: '10:00' })).toBe('2026-11-01T10:00');
    expect(datetimeLocal({ date: '2026-11-01', time: null })).toBeNull();
    expect(moveText({ episode_number: 3, from: { date: '2026-11-15', time: '10:00' }, to: { date: '2026-11-14', time: '10:00' } }))
      .toBe('E3 moves from Sun, Nov 15 · 10:00 AM to Sat, Nov 14 · 10:00 AM');
    expect(moveText({ episode_number: 1, from: { date: '2026-11-01', time: '10:00' }, to: null })).toBe('E1 loses its schedule date (Sun, Nov 1 · 10:00 AM)');
  });

  test("a roadmap slot's day: its episode's row, else its number's", () => {
    const view = {
      episodes: [{ episode_id: 'ep-1', date: '2026-11-01', source: 'schedule', due: 'soon' }],
      slots: { 2: { date: '2026-11-08', source: 'schedule' }, 3: { date: '2026-11-15', source: 'preview' } },
    };
    expect(slotWhen(view, { slot_number: 1, episode: { id: 'ep-1' } })).toEqual({ text: 'Sun, Nov 1', source: 'schedule' });
    expect(slotWhen(view, { slot_number: 2, episode: null })).toEqual({ text: 'Sun, Nov 8', source: 'schedule' });
    expect(slotWhen(view, { slot_number: 3, episode: null }).text).toBe('Would be Sun, Nov 15');
    expect(slotWhen(view, { slot_number: 9, episode: null })).toBeNull();
    expect(slotWhen(null, { slot_number: 1 })).toBeNull();
    expect(firstDue(view).episode_id).toBe('ep-1');
  });
});
