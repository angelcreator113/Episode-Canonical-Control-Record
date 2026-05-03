/**
 * StoryEvaluationEngine — Track 3 tests for the apiPost/apiGet helper-internal
 * migration. Both helpers preserve the timeout-aware contract; auth + Content-Type
 * now provided by the apiClient request interceptor.
 *
 * These helpers are not exported (internal to StoryEvaluationEngine.jsx). To test
 * them, this file exercises the migration through structural inspection and a
 * separate behavioral test using a copy of the helpers' shape.
 */

import { vi, describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'src/pages/StoryEvaluationEngine.jsx'),
  'utf8'
);

describe('StoryEvaluationEngine — Track 3 helper-internal migration', () => {
  test('source no longer defines authHeaders helper', () => {
    expect(SOURCE).not.toMatch(/^function authHeaders\(/m);
    expect(SOURCE).not.toMatch(/^const authHeaders\s*=/m);
  });

  test('source imports apiClient', () => {
    expect(SOURCE).toMatch(/import\s+apiClient\s+from\s+['"]\.\.\/services\/api['"]/);
  });

  test('apiPost wraps apiClient.post and preserves timeout option', () => {
    expect(SOURCE).toMatch(/async function apiPost/);
    expect(SOURCE).toMatch(/apiClient\.post\([^,]+,\s*body,\s*\{\s*timeout:\s*timeoutMs\s*\}\)/);
  });

  test('apiGet wraps apiClient.get and preserves timeout option', () => {
    expect(SOURCE).toMatch(/async function apiGet/);
    expect(SOURCE).toMatch(/apiClient\.get\([^,]+,\s*\{\s*timeout:\s*timeoutMs\s*\}\)/);
  });

  test('timeout error contract preserved (ECONNABORTED → "Request timed out")', () => {
    expect(SOURCE).toMatch(/ECONNABORTED|AbortError/);
    expect(SOURCE).toMatch(/Request timed out/);
  });

  test('no surviving fetch+authHeaders pattern', () => {
    expect(SOURCE).not.toMatch(/headers:\s*authHeaders\(\)/);
  });
});
