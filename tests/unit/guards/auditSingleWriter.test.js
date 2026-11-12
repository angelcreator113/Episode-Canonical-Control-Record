/**
 * One audit trail, one writer, one entry per operation (issue #1948; Evoni,
 * 2026-11-11: "Identify one authoritative audit call per existing operation.
 * Do not blindly repoint multiple loggers and create duplicate entries.").
 *
 * Read from the source, so a second logger, a second writer or a page-view
 * entry cannot come back unnoticed.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
function files(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return files(rel);
    return rel.endsWith('.js') ? [rel] : [];
  });
}
/** Source with comments removed, so a mention in prose is not a use. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const SRC = files('src').filter((f) => !f.startsWith('src/migrations/'));
const using = (pattern) => SRC.filter((f) => pattern.test(code(read(f)))).sort();

describe('one writer into activity_logs', () => {
  test('only the model inserts: ActivityLog.create appears nowhere else', () => {
    expect(using(/ActivityLog\.create\(|ActivityLog\.bulkCreate\(|INSERT INTO\s+activity_logs/i)).toEqual(['src/models/ActivityLog.js']);
  });

  test('ActivityLog.logActivity is called from one place: logger.logAction', () => {
    // A future caller that must write inside its own transaction (Move/Swap)
    // is added here by name, with the change that approves it.
    expect(using(/ActivityLog\.logActivity\(/)).toEqual(['src/middleware/auditLog.js']);
  });

  test('the second and third loggers are gone', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/services/AuditLogger.js'))).toBe(false);
    expect(using(/AuditLogger/)).toEqual([]);
    // ActivityService keeps entries in memory only; no audited operation may call it.
    expect(using(/ActivityService\.logActivity\(|ActivityServiceModule\.logActivity\(/)).toEqual([]);
    expect(code(read('src/middleware/auditLog.js'))).not.toMatch(/res\.send\s*=|req\.ip|user-agent/);
  });
});

describe('one entry per operation', () => {
  /** How many audit calls each handler of a controller makes. */
  function callsPerHandler(rel, call) {
    const text = code(read(rel));
    const marks = [...text.matchAll(/^ {2}async (\w+)\(req, res(?:, _?next)?\) \{$/gm)].map((m) => ({ name: m[1], at: m.index }));
    return Object.fromEntries(marks.map((m, i) => {
      const body = text.slice(m.at, i + 1 < marks.length ? marks[i + 1].at : text.length);
      return [m.name, (body.match(call) || []).length];
    }).filter(([, n]) => n > 0));
  }

  test('episodeController: create, update, delete and enqueue write one entry each', () => {
    expect(callsPerHandler('src/controllers/episodeController.js', /logger\s*\.logAction\(/g))
      .toEqual({ createEpisode: 1, updateEpisode: 1, deleteEpisode: 1, enqueueEpisode: 1 });
  });

  test('metadataController and processingController: one entry per write, none for a read', () => {
    const metadata = callsPerHandler('src/controllers/metadataController.js', /logger\.logAction\(/g);
    const processing = callsPerHandler('src/controllers/processingController.js', /logger\.logAction\(/g);
    for (const counts of [metadata, processing]) {
      expect(Object.values(counts).every((n) => n === 1)).toBe(true);
      expect(Object.keys(counts).some((name) => /^(list|get)/.test(name))).toBe(false);
    }
    expect(Object.keys(metadata).length).toBeGreaterThanOrEqual(4);
    expect(Object.keys(processing).length).toBeGreaterThanOrEqual(3);
  });

  test('fileController and jobController: three operations each, one entry each', () => {
    expect((code(read('src/controllers/fileController.js')).match(/audit\.logAction\(/g) || []).length).toBe(3);
    expect((code(read('src/controllers/jobController.js')).match(/audit\.logAction\(/g) || []).length).toBe(3);
  });

  test('no page-view entry, IP address or user agent at any audit call', () => {
    for (const f of SRC) {
      const text = code(read(f));
      for (const m of text.matchAll(/(?:logger|audit)\s*\.logAction\(([\s\S]*?)\);/g)) {
        expect(`${f}: ${m[1]}`).not.toMatch(/'view'/);
        expect(`${f}: ${m[1]}`).not.toMatch(/ipAddress|userAgent|req\.ip\b/);
        expect(`${f}: ${m[1]}`).not.toMatch(/'anonymous'|'unknown'/);
      }
    }
  });
});
