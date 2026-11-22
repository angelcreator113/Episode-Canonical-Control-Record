/**
 * suggestStatusAdvance on a draft: a script suggests moving to Scripted.
 * The script is known from its text (an admin's episode) or from the
 * server's has_script (anyone else's; Evoni, 2026-11-22).
 */
import { describe, test, expect } from 'vitest';
import { suggestStatusAdvance, EPISODE_STATUSES } from './workflowRouter';

describe('suggestStatusAdvance: a draft with a script', () => {
  const scripted = { shouldSuggest: true, reason: 'Script uploaded', confidence: 'high', nextStatus: EPISODE_STATUSES.SCRIPTED };

  test('the script text, as before', () => {
    expect(suggestStatusAdvance({ status: 'draft', script_content: 'INT. LOFT' })).toMatchObject(scripted);
    expect(suggestStatusAdvance({ status: 'draft', script_url: 'https://files.example/s.pdf' })).toMatchObject(scripted);
  });

  test('no text sent, but the server says there is a script', () => {
    expect(suggestStatusAdvance({ status: 'draft', has_script: true })).toMatchObject(scripted);
  });

  test('no script: nothing is suggested', () => {
    expect(suggestStatusAdvance({ status: 'draft' })).toBeNull();
    expect(suggestStatusAdvance({ status: 'draft', has_script: false })).toBeNull();
    expect(suggestStatusAdvance({ status: 'draft', script_content: '' })).toBeNull();
    expect(suggestStatusAdvance(null)).toBeNull();
  });
});
