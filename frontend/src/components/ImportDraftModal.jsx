/**
 * ImportDraftModal.jsx
 * frontend/src/pages/ImportDraftModal.jsx
 *
 * Paste a LINE-marked draft → imports all lines into a chapter.
 */

import { useState } from 'react';

const STORYTELLER_API = '/api/v1/storyteller';

export default function ImportDraftModal({
  chapterId,
  chapterTitle,
  open,
  onClose,
  onImported,
}) {
  const [rawText, setRawText] = useState('');
  const [mode, setMode]       = useState('replace'); // replace | append
  const [preview, setPreview] = useState(null);      // parsed lines preview
  const [importing, setImporting] = useState(false);
  const [error, setError]     = useState(null);
  const [result, setResult]   = useState(null);

  function handleClose() {
    setRawText('');
    setPreview(null);
    setError(null);
    setResult(null);
    onClose();
  }

  // Client-side preview parse — mirrors the server parser
  function parsePreview(text) {
    const lines = text.split('\n');
    const results = [];
    const lineMarker = /^LINE\s+(\d+)(?:\s+\[([^\]]*)\])?\s*$/i;
    const skipPatterns = [
      /^---+$/, /^CHAPTER\s+/i, /^END\s+CHAPTER/i,
      /^Theme:/i, /^POV:/i, /^Era:/i, /^Status:/i,
      /^Word count/i, /^Lines:/i, /^Memory candidates/i,
      /^POV breakdown/i, /^\s*$/,
    ];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (skipPatterns.some(p => p.test(line))) { i++; continue; }
      const match = line.match(lineMarker);
      if (match) {
        const num = match[1];
        i++;
        while (i < lines.length && lines[i].trim() === '') i++;
        if (i < lines.length) {
          const content = lines[i].trim();
          if (content && !skipPatterns.some(p => p.test(content))) {
            results.push({ num, content });
          }
        }
        i++;
        continue;
      }
      i++;
    }
    return results;
  }

  function handlePreview() {
    setError(null);
    const parsed = parsePreview(rawText);
    if (parsed.length === 0) {
      setError('No LINE markers found. Check your draft format.');
      setPreview(null);
    } else {
      setPreview(parsed);
    }
  }

  async function handleImport() {
    if (!rawText.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch(
        `${STORYTELLER_API}/chapters/${chapterId}/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_text: rawText, mode }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
      onImported?.(data.lines);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  return (
    <div style={ms.overlay} onClick={e => e.target === e.currentTarget && handleClose()}>
      <div style={ms.modal}>

        {/* Header */}
        <div style={ms.header}>
          <div>
            <div style={ms.headerLabel}>IMPORT DRAFT</div>
            <div style={ms.headerTitle}>
              {chapterTitle || 'Chapter'}
            </div>
          </div>
          <button style={ms.closeBtn} onClick={handleClose}>✕</button>
        </div>

        {result ? (
          // ── Success state ──────────────────────────────────────────────
          <div style={ms.body}>
            <div style={ms.successBlock}>
              <div style={ms.successIcon}>✓</div>
              <div style={ms.successTitle}>{result.imported} lines imported</div>
              {result.skipped > 0 && (
                <div style={ms.successSub}>{result.skipped} lines skipped (metadata/blanks)</div>
              )}
              <div style={ms.successSub}>
                All lines are set to <span style={{ color: '#C9A84C' }}>pending</span> — ready for review in the Book Editor.
              </div>
            </div>
          </div>
        ) : (
          <div style={ms.body}>

            {/* Mode selector */}
            <div style={ms.modeRow}>
              <div style={ms.modeLabel}>IMPORT MODE</div>
              <div style={ms.modeBtns}>
                {[
                  { value: 'replace', label: 'Replace', note: 'Clear existing lines first' },
                  { value: 'append',  label: 'Append',  note: 'Add after existing lines' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    style={{
                      ...ms.modeBtn,
                      borderColor: mode === opt.value
                        ? '#C9A84C'
                        : 'rgba(30,25,20,0.15)',
                      background: mode === opt.value
                        ? 'rgba(201,168,76,0.08)'
                        : 'white',
                      color: mode === opt.value
                        ? '#8B6914'
                        : 'rgba(30,25,20,0.4)',
                    }}
                    onClick={() => setMode(opt.value)}
                    type='button'
                  >
                    <div style={{ fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ fontSize: 9, marginTop: 2, opacity: 0.7 }}>{opt.note}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Paste area */}
            <div style={ms.field}>
              <label style={ms.fieldLabel}>
                PASTE DRAFT
                <span style={ms.fieldHint}> — must contain LINE NNN markers</span>
              </label>
              <textarea
                style={ms.textarea}
                placeholder={`LINE 001\nI don't remember when I started comparing myself to Chloe.\n\nLINE 002\nIt might have been the first time she posted a launch announcement…`}
                value={rawText}
                onChange={e => { setRawText(e.target.value); setPreview(null); setError(null); }}
                rows={12}
              />
            </div>

            {/* Error */}
            {error && <div style={ms.error}>{error}</div>}

            {/* Preview */}
            {preview && (
              <div style={ms.previewBlock}>
                <div style={ms.previewHeader}>
                  <span style={ms.previewTitle}>Preview — {preview.length} lines detected</span>
                  <span style={ms.previewClear} onClick={() => setPreview(null)}>clear</span>
                </div>
                <div style={ms.previewList}>
                  {preview.slice(0, 8).map((line, i) => (
                    <div key={i} style={ms.previewLine}>
                      <span style={ms.previewNum}>{line.num}</span>
                      <span style={ms.previewContent}>{line.content}</span>
                    </div>
                  ))}
                  {preview.length > 8 && (
                    <div style={ms.previewMore}>
                      + {preview.length - 8} more lines
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Footer */}
        <div style={ms.footer}>
          {result ? (
            <button style={ms.primaryBtn} onClick={handleClose}>
              Done
            </button>
          ) : (
            <>
              <button style={ms.secondaryBtn} onClick={handleClose} type='button'>
                Cancel
              </button>
              {!preview ? (
                <button
                  style={{ ...ms.secondaryBtn, borderColor: 'rgba(30,25,20,0.2)', color: 'rgba(30,25,20,0.6)' }}
                  onClick={handlePreview}
                  disabled={!rawText.trim()}
                  type='button'
                >
                  Preview Lines
                </button>
              ) : null}
              <button
                style={{
                  ...ms.primaryBtn,
                  opacity: importing || !rawText.trim() ? 0.6 : 1,
                  cursor: importing || !rawText.trim() ? 'not-allowed' : 'pointer',
                }}
                onClick={handleImport}
                disabled={importing || !rawText.trim()}
                type='button'
              >
                {importing ? 'Importing…' : `Import ${preview ? preview.length + ' ' : ''}Lines`}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Styles (light parchment theme) ────────────────────────────────────────

const ms = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20,16,12,0.55)',
    backdropFilter: 'blur(3px)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: '#faf9f7',
    border: '1px solid rgba(201,168,76,0.25)',
    borderRadius: 4,
    width: 640,
    maxWidth: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 26px 16px',
    borderBottom: '1px solid rgba(201,168,76,0.15)',
    flexShrink: 0,
  },
  headerLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.2em',
    color: '#C9A84C',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 20,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.85)',
    fontWeight: 400,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(30,25,20,0.3)',
    fontSize: 15,
    cursor: 'pointer',
    padding: 4,
  },
  body: {
    padding: '20px 26px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  modeRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  modeLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.16em',
    color: 'rgba(30,25,20,0.35)',
  },
  modeBtns: {
    display: 'flex',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    border: '1px solid',
    borderRadius: 2,
    padding: '8px 12px',
    cursor: 'pointer',
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.08em',
    textAlign: 'left',
    transition: 'all 0.12s',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.14em',
    color: 'rgba(30,25,20,0.4)',
    textTransform: 'uppercase',
  },
  fieldHint: {
    fontWeight: 400,
    letterSpacing: '0.04em',
    color: 'rgba(30,25,20,0.25)',
    textTransform: 'none',
    fontSize: 8,
  },
  textarea: {
    background: '#f5f0e8',
    border: '1px solid rgba(30,25,20,0.1)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(30,25,20,0.75)',
    padding: '10px 12px',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.65,
    width: '100%',
    boxSizing: 'border-box',
  },
  error: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: '#B85C38',
    background: 'rgba(184,92,56,0.06)',
    border: '1px solid rgba(184,92,56,0.2)',
    borderRadius: 2,
    padding: '8px 12px',
    letterSpacing: '0.04em',
  },
  previewBlock: {
    background: '#f5f0e8',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(201,168,76,0.12)',
  },
  previewTitle: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: '#8B6914',
    letterSpacing: '0.1em',
  },
  previewClear: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(30,25,20,0.3)',
    cursor: 'pointer',
    letterSpacing: '0.06em',
  },
  previewList: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 200,
    overflowY: 'auto',
  },
  previewLine: {
    display: 'flex',
    gap: 12,
    padding: '6px 12px',
    borderBottom: '1px solid rgba(30,25,20,0.05)',
    alignItems: 'flex-start',
  },
  previewNum: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: '#C9A84C',
    flexShrink: 0,
    minWidth: 24,
    paddingTop: 2,
    letterSpacing: '0.06em',
  },
  previewContent: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 12,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.7)',
    lineHeight: 1.4,
  },
  previewMore: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(30,25,20,0.3)',
    padding: '6px 12px',
    letterSpacing: '0.06em',
  },
  successBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: '32px 20px',
    textAlign: 'center',
  },
  successIcon: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'rgba(74,124,89,0.1)',
    border: '1px solid rgba(74,124,89,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    color: '#4A7C59',
    marginBottom: 4,
  },
  successTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 20,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.85)',
  },
  successSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(30,25,20,0.4)',
    letterSpacing: '0.06em',
    lineHeight: 1.6,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '14px 26px',
    borderTop: '1px solid rgba(201,168,76,0.1)',
    flexShrink: 0,
  },
  primaryBtn: {
    background: '#C9A84C',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.12em',
    color: '#14100c',
    fontWeight: 600,
    padding: '9px 20px',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  secondaryBtn: {
    background: 'none',
    border: '1px solid rgba(30,25,20,0.15)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.1em',
    color: 'rgba(30,25,20,0.45)',
    padding: '8px 16px',
    cursor: 'pointer',
  },
};
