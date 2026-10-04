// ============================================================================
// UNIT TEST — the ingest-document contract, pinned from the route's side
// ============================================================================
// POST /franchise-brain/ingest-document reads document_text and source_name
// and answers { entries_created, entries, message }. The Show Bible's
// Documents tab sends exactly those names (frontend
// ShowBiblePage.documents.test.jsx pins the page's side). Until 2026-10-04 the
// page sent { text, source } and every extract was refused with 400.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'franchiseBrainRoutes.js'), 'utf8');
const handler = SRC.slice(SRC.indexOf("router.post('/franchise-brain/ingest-document'"), SRC.indexOf("router.get('/franchise-brain/documents'"));

describe('franchise-brain ingest-document contract', () => {
  test('the route reads document_text and source_name from the body', () => {
    expect(handler).toMatch(/const\s*\{\s*document_text,\s*source_name\s*\}\s*=\s*req\.body/);
    expect(handler).toMatch(/if \(!document_text\?\.trim\(\)\)/);
    expect(handler).toMatch(/'document_text is required'/);
  });

  test('the route never reads the old names the page used to send', () => {
    expect(handler).not.toMatch(/req\.body\.text\b/);
    expect(handler).not.toMatch(/\{\s*text\s*,/);
  });

  test('the route answers entries_created, entries and message, all pending review', () => {
    expect(handler).toMatch(/entries_created:\s*created\.length/);
    expect(handler).toMatch(/entries:\s*created/);
    expect(handler).toMatch(/status:\s*'pending_review'/);
    expect(handler).toMatch(/source_document:\s*source_name\s*\|\|/);
  });
});
