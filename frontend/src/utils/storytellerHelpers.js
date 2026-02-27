/**
 * storytellerHelpers.js — Pure utility functions for the Storyteller feature.
 */

/** Human-readable relative time (e.g. "3m ago", "2h ago", "1d ago") */
export function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Derive archive health badge from book data */
export function archiveState(book) {
  const chapters = book.chapters || [];
  const lines = chapters.flatMap(ch => ch.lines || []);
  const pending = lines.filter(l => l.status === 'pending').length;
  const edited = lines.filter(l => l.status === 'edited').length;
  if (lines.length === 0) return { label: 'Empty', tone: 'clean' };
  if (pending === 0 && edited === 0) return { label: 'Clean', tone: 'clean' };
  if (pending > 0) return { label: 'In Progress', tone: 'active' };
  return { label: 'Refined', tone: 'warm' };
}

const NUM_WORDS = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen', 'Twenty', 'Twenty-One', 'Twenty-Two', 'Twenty-Three',
  'Twenty-Four', 'Twenty-Five', 'Twenty-Six', 'Twenty-Seven', 'Twenty-Eight',
  'Twenty-Nine', 'Thirty',
];

/** Convert chapter index to English word (1→"One", 15→"Fifteen") */
export const numberWord = n => NUM_WORDS[n] || String(n);
