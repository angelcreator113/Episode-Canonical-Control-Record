/**
 * Line identity, the reading half (architecture A1a; Evoni, 2026-10-26).
 * src/utils/lineKeys.js is the authoritative copy and the only one that mints
 * or reconciles keys; this copy reads a script's lines and checks stored keys
 * against them, the same way: the same line rule (beat headers read by
 * lib/beatLabelNumber, unchanged), the same normalisation and the same hash
 * (32-bit FNV-1a over UTF-8, 8 hex characters). A parity test holds the two
 * copies together. Nothing imports this yet (A1c).
 */

import { headerNumber, normalizeBeatHeaders } from './beatLabelNumber';

export const VERSION = 1;
const HEADER_LINE_RE = /^\s*##\s*BEAT:\s*(.*)$/i;
export const KEY_RE = /^ln_[a-z2-7]{10}$/;

function utf8Bytes(text) {
  const bytes = [];
  for (const ch of String(text)) {
    let c = ch.codePointAt(0);
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return bytes;
}

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (const b of utf8Bytes(text)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** A line as compared: quotes, dashes and spacing written one way; words and case kept. */
export function normaliseLine(text) {
  return String(text ?? '')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export const lineHash = (text) => fnv1a(normaliseLine(text));

/** The whole script's hash, over its exact text. */
export const scriptTextHash = (text) => fnv1a(String(text ?? ''));

/** The script's lines, in order: { b, at, index, text, norm, h }. */
export function scriptLines(text) {
  const rows = normalizeBeatHeaders(text).split('\n');
  const hasHeader = rows.some((row) => HEADER_LINE_RE.test(row));
  const lines = [];
  let beat = hasHeader ? 0 : null;
  let headers = 0;
  let at = 0;
  for (const row of rows) {
    const header = row.match(HEADER_LINE_RE);
    if (header) {
      headers += 1;
      beat = headerNumber(header[1]) || headers;
      at = 0;
      continue;
    }
    if (!row.trim()) continue;
    const norm = normaliseLine(row);
    lines.push({ b: beat, at, index: lines.length, text: row, norm, h: fnv1a(norm) });
    at += 1;
  }
  return lines;
}

/** Whether stored keys describe this text; never repairs. { status: 'ok' | 'unkeyed' | 'mismatch', reason? } */
export function checkLineKeys(text, stored) {
  if (!stored || !Array.isArray(stored.lines)) return { status: 'unkeyed' };
  if (stored.v !== VERSION) return { status: 'mismatch', reason: 'version' };
  if (stored.text_hash !== scriptTextHash(text)) return { status: 'mismatch', reason: 'text_hash' };
  const lines = scriptLines(text);
  if (lines.length !== stored.lines.length) return { status: 'mismatch', reason: 'line_count' };
  for (let i = 0; i < lines.length; i += 1) {
    const s = stored.lines[i];
    if (!s || s.h !== lines[i].h || s.b !== lines[i].b || !KEY_RE.test(String(s.k))) return { status: 'mismatch', reason: 'line', index: i };
  }
  return { status: 'ok' };
}
