/**
 * One completion operation in the frontend (Evoni, 2026-11-12): every screen
 * that completes an episode goes through lib/episodeCompletion. This scans
 * the source so a second, independent "complete" cannot come back unnoticed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, test, expect } from 'vitest';

const SRC = path.join(__dirname, '..');
function files(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) files(p, out);
    else if (/\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(SRC, p).split(path.sep).join('/');
const sources = files(SRC).map((p) => ({ file: rel(p), text: fs.readFileSync(p, 'utf8') }));
const using = (re) => sources.filter((s) => re.test(s.text)).map((s) => s.file).sort();

describe('completing an episode has one caller', () => {
  test('only lib/episodeCompletion posts to the completion endpoint', () => {
    expect(using(/api\.post\(`[^`]*\/episodes\/\$\{[^}]+\}\/complete`/)).toEqual(['lib/episodeCompletion.js']);
  });

  test('nothing posts to the legacy accept route', () => {
    expect(using(/\/api\/v1\/episodes\/\$\{[^}]+\}\/accept/)).toEqual([]);
  });

  test('the screens that complete use the shared operation', () => {
    expect(using(/from ['"][./]+\/lib\/episodeCompletion['"]/)).toEqual(['components/Episodes/EpisodeResultsSummary.jsx', 'pages/EvaluateEpisode.jsx']);
  });

  test('the event modal completes nothing itself: it links to the episode\'s Results, and keeps its other actions', () => {
    const modal = sources.find((s) => s.file === 'components/Show/EventDetailsModal.jsx').text;
    expect(modal).not.toMatch(/\/complete`/);
    expect(modal).not.toMatch(/completeMoneyWarning/);
    expect(modal).toMatch(/to=\{`\/episodes\/\$\{md\.used_in_episode_id\}\?tab=results`\}/);
    expect(modal).toContain('Complete in the episode&apos;s Results');
    // Still there: editing, Mark Ready, Decline, the financials finalize.
    for (const kept of ['Mark Ready', 'finalize-financials', 'Edit details']) expect(modal).toContain(kept);
  });

  test('no screen offers an override, an unlock or an unlocked re-evaluate', () => {
    expect(using(/Admin Unlock|Re-evaluate \(Unlocked\)|Apply Override/)).toEqual([]);
    expect(using(/\/api\/v1\/episodes\/\$\{[^}]+\}\/override/)).toEqual([]);
  });
});
