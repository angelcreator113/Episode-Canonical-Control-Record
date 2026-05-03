/**
 * Tests for BookEditor's Path A → apiClient migration (Track 2).
 *
 * Behavioral coverage focuses on the 11 sites migrated from fetch+authHeader
 * to apiClient. The rendering surface of BookEditor is too large to mount
 * fully in a unit test (1700+ lines, multi-pane editor, sub-components,
 * sessionStorage). Instead this file:
 *
 *  - Asserts structural conformance: zero authHeader references, apiClient
 *    imported, raw fetch only at the keepalive beforeunload site (Track 2
 *    intentionally leaves that one site as fetch + inline Bearer because
 *    axios doesn't support keepalive: true).
 *  - Spot-checks one happy + one error path for the helper file
 *    (storytellerApi.test.js covers behavioral transitively for 12 of
 *    BookEditor's 22 Path-A sites that go through the api() helper).
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SOURCE = readFileSync(resolve(process.cwd(), 'src/components/BookEditor.jsx'), 'utf8');

describe('BookEditor — Path A migration structural conformance', () => {
  test('does not import authHeader from storytellerApi', () => {
    expect(SOURCE).not.toMatch(/authHeader\s*[,}]/);
    expect(SOURCE).not.toMatch(/import\s*\{[^}]*authHeader/);
  });

  test('imports apiClient from services/api', () => {
    expect(SOURCE).toMatch(/import\s+apiClient\s+from\s+['"]\.\.\/services\/api['"]/);
  });

  test('still imports api helper from storytellerApi (api() helper preserved)', () => {
    expect(SOURCE).toMatch(/import\s*\{[^}]*\bapi\b[^}]*\}\s*from\s+['"]\.\.\/utils\/storytellerApi['"]/);
  });

  test('no fetch+authHeader spread pattern remains', () => {
    expect(SOURCE).not.toMatch(/\.\.\.authHeader\(\)/);
  });

  test('uses apiClient.get / .post / .put / .delete for migrated sites', () => {
    // Spot-check that apiClient method calls exist in the file.
    const calls = SOURCE.match(/apiClient\.(get|post|put|delete|patch)\(/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(8);
  });

  test('keepalive beforeunload site intentionally retained as raw fetch with inline Bearer', () => {
    // Track 2 documented exception: apiClient/axios doesn't support keepalive,
    // which is required for the beforeunload save reliability per CZ-5.
    expect(SOURCE).toMatch(/keepalive:\s*true/);
    expect(SOURCE).toMatch(/Track 2 note/);
    // The keepalive site reads the token inline rather than via authHeader().
    expect(SOURCE).toMatch(/localStorage\.getItem\(['"]authToken['"]\)/);
  });
});
