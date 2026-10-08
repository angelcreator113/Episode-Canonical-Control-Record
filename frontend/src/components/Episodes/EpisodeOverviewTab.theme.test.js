/**
 * The Episode Overview tab wears the studio theme (audit VISUAL-01/02,
 * batch 4, eighth screen): the tab, its stylesheet, the teaser section,
 * the money card and the scene-suggestion and timeline sections it
 * renders set colors only through tokens; the Save, Script Writer,
 * teaser and accept actions are the primary; gold is never under white
 * nor used as text; verdicts and reward states read text tokens on
 * their surfaces. The Overview redesign (2026-10-08) moved the tab's
 * cards, buttons and edit form into EpisodeOverviewSections.css classes;
 * the actions are lavender, as in the summary above them.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const read = (rel) => readFileSync(resolve(__dirname, rel), 'utf8');
const files = {
  'EpisodeOverviewTab.jsx': read('EpisodeOverviewTab.jsx'),
  'EpisodeOverviewTab.css': read('EpisodeOverviewTab.css'),
  'EpisodeOverviewSections.css': read('EpisodeOverviewSections.css'),
  'EpisodeTeaserSection.jsx': read('EpisodeTeaserSection.jsx'),
  'EpisodeTeaserSection.css': read('EpisodeTeaserSection.css'),
  'EpisodeMoneyCard.jsx': read('EpisodeMoneyCard.jsx'),
  'EpisodeOverviewSummary.jsx': read('EpisodeOverviewSummary.jsx'),
  'EpisodeOverviewSummary.css': read('EpisodeOverviewSummary.css'),
  'SceneSuggestionReview.jsx': read('../episode/SceneSuggestionReview.jsx'),
  'TimelinePlacementsSection.jsx': read('../episode/TimelinePlacementsSection.jsx'),
};
const tokens = read('../../styles/design-tokens.css');
const HEX = /#[0-9a-f]{3,8}\b/i;
// Task references ("Task #2386") are not colors.
const tab = files['EpisodeOverviewTab.jsx'];
const css = files['EpisodeOverviewTab.css'];
const sections = files['EpisodeOverviewSections.css'];

describe('Episode Overview theme', () => {
  test.each(Object.keys(files))('%s carries no color literal', (name) => {
    expect(stripTaskRefs(files[name])).not.toMatch(HEX);
  });

  test('the actions are the primary and gold is never under white nor text', () => {
    // Save (edit details) and Script Writer are the lavender primary.
    expect(sections).toMatch(/\.eov-btn-primary \{ border: none; background: var\(--lala-lavender\); color: var\(--text-inverse\);/);
    expect(tab).toMatch(/className="eov-btn-primary" onClick=\{handleSave\}>Save</);
    expect(tab).toMatch(/className="eov-btn-primary"[^\n]*> Script Writer<\/button>/);
    expect(sections).toMatch(/\.eov-btn \{ border: 1px solid var\(--lala-lavender-line\); background: var\(--surface-card\); color: var\(--lala-lavender-text\); \}/);
    expect(files['EpisodeTeaserSection.css']).toMatch(/border-color: var\(--primary\);\s*background: var\(--primary\);\s*color: var\(--text-inverse\);/);
    expect(files['SceneSuggestionReview.jsx']).toMatch(/background: acceptedCount === 0 \? 'var\(--lala-parchment-3\)' : 'var\(--primary\)'/);
    for (const text of Object.values(files)) {
      expect(text).not.toMatch(/background: ['"]?var\(--lala-gold\)['"]?[^}]*color: ['"]?var\(--(?:text-inverse|surface-card)\)/);
      expect(text).not.toMatch(/(?<![-\w])color: ['"]?var\(--lala-gold\)['"]?/);
      expect(text).not.toMatch(/(?<![-\w])color: ['"]?var\(--accent\)['"]?/);
    }
    // The source tag is ink on gold.
    expect(sections).toMatch(/\.eov-tag\.is-source \{ background: var\(--lala-gold\); color: var\(--text-primary\); \}/);
    expect(sections).not.toMatch(/(?<![-\w])color: var\(--lala-gold\)/);
  });

  test('verdicts, reward states and the money tone read text tokens on their surfaces', () => {
    expect(tab).toMatch(/slay: \{[^}]*color: 'var\(--lala-gold-text\)', bg: 'var\(--lala-gold-soft\)'/);
    expect(tab).toMatch(/pass: \{[^}]*color: 'var\(--success-text\)', bg: 'var\(--success-bg\)'/);
    expect(tab).toMatch(/safe: \{[^}]*color: 'var\(--warning-text\)', bg: 'var\(--warning-bg\)'/);
    expect(tab).toMatch(/fail: \{[^}]*color: 'var\(--danger-text\)', bg: 'var\(--danger-bg\)'/);
    expect(tab).toMatch(/earned: \{[^}]*bg: 'var\(--success-bg\)', color: 'var\(--success-text\)', border: 'var\(--success-border\)'/);
    expect(tab).toMatch(/missed: \{[^}]*bg: 'var\(--danger-bg\)', color: 'var\(--danger-text\)', border: 'var\(--danger-border\)'/);
    expect(files['EpisodeMoneyCard.jsx']).toMatch(/n > 0 \? 'var\(--success-text\)' : n < 0 \? 'var\(--danger-text\)' : 'var\(--text-primary\)'/);
  });

  test('the stylesheet hover, progress fill and intent section read the tokens', () => {
    expect(css).toMatch(/\.btn-edit:hover\s*\{\s*border-color: var\(--primary\);\s*color: var\(--primary-text\);/);
    expect(css).toMatch(/\.progress-fill\s*\{[^}]*background: var\(--primary\);/);
    expect(css).toMatch(/\.intent-section\s*\{\s*background: var\(--warning-bg\);[^}]*border: 2px solid var\(--warning\);/);
    expect(css).not.toMatch(/linear-gradient/);
  });

  test('every text pair the tab draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-primary', '--lala-gold'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--lala-gold-text', '--surface-card'],
      ['--success-text', '--success-bg'],
      ['--warning-text', '--warning-bg'],
      ['--danger-text', '--danger-bg'],
      ['--primary-text', '--primary-subtle'],
      ['--accent-dark', '--surface-card'],
      ['--text-secondary', '--surface-card'],
      ['--text-secondary', '--lala-gold-soft'],
      ['--text-primary', '--lala-gold-soft'],
      // The redesign's cards, links and chips.
      ['--text-inverse', '--lala-lavender'],
      ['--lala-lavender-text', '--surface-card'],
      ['--lala-lavender-text', '--lala-lavender-soft'],
      ['--lala-ink', '--surface-card'],
      ['--lala-ink-muted', '--surface-card'],
      ['--lala-ink', '--lala-gold-soft'],
      ['--lala-ink-muted', '--lala-gold-soft'],
      ['--lala-gold-text', '--surface-card'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // The old SLAY verdict, kept below 4.5 so it is never reused as text.
    expect(contrast('#FFD700', '#FFFBEB')).toBeLessThan(4.5);
  });

  test("the Overview's top (Evoni's Episode mock): the next step on lavender, tiles and cards on white, pairs at 4.5:1", () => {
    const top = files['EpisodeOverviewSummary.css'];
    expect(top).toMatch(/\.eos-next \{[^}]*background: linear-gradient\(90deg, var\(--lala-lavender\), var\(--lala-lavender-dark\)\);\s*color: var\(--text-inverse\);/);
    expect(top).toMatch(/\.eos-next-btn \{[^}]*background: var\(--surface-card\);\s*color: var\(--lala-lavender-text\);/);
    expect(top).toMatch(/\.eos-intent\.is-active \{[^}]*color: var\(--lala-lavender-text\);/);
    for (const [fg, bg] of [
      ['--text-inverse', '--lala-lavender'],
      ['--lala-lavender-soft', '--lala-lavender'],
      ['--lala-lavender-text', '--surface-card'],
      ['--lala-lavender-text', '--lala-lavender-soft'],
      ['--lala-ink-muted', '--surface-card'],
      ['--warning-text', '--warning-bg'],
      ['--accent-dark', '--surface-card'],
    ]) {
      expect({ fg, bg, ratio: contrast(readToken([tokens], fg), readToken([tokens], bg)) }).toMatchObject({ ratio: expect.any(Number) });
      expect(contrast(readToken([tokens], fg), readToken([tokens], bg))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
