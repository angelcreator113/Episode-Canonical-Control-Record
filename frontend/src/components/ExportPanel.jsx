/**
 * ExportPanel.jsx
 * frontend/src/components/ExportPanel.jsx
 *
 * Export panel for the Book Editor.
 * Two download buttons: Word (.docx) and PDF.
 * Shows metadata (word count, chapters, reading time) before export.
 *
 * Usage in StorytellerPage.jsx:
 *
 *   import ExportPanel from '../components/ExportPanel';
 *
 *   // Add 'export' to view tabs
 *   // Render:
 *   {activeView === 'export' && <ExportPanel bookId={book.id} bookTitle={book.title} />}
 */

import { useState, useEffect } from 'react';
import api from '../services/api';

const EXPORT_API = '/api/v1/export';

export default function ExportPanel({ bookId, bookTitle }) {
  const [meta,          setMeta]          = useState(null);
  const [loadingMeta,   setLoadingMeta]   = useState(true);
  const [downloadingDoc, setDownloadingDoc] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [toast,         setToast]         = useState(null);
  const [error,         setError]         = useState(null);

  useEffect(() => { if (bookId) loadMeta(); }, [bookId]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function loadMeta() {
    setLoadingMeta(true);
    setError(null);
    try {
      const res  = await api.get(`${EXPORT_API}/book/${bookId}/meta`);
      setMeta(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoadingMeta(false);
    }
  }

  async function downloadFile(format) {
    const setLoading = format === 'docx' ? setDownloadingDoc : setDownloadingPdf;
    setLoading(true);
    try {
      const res = await api.get(`${EXPORT_API}/book/${bookId}/${format}`, {
        responseType: 'blob',
      });

      const blob     = new Blob([res.data]);
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      const filename = `${(bookTitle || 'manuscript').toLowerCase().replace(/\s+/g, '-')}.${format}`;
      a.href         = url;
      a.download     = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`${format.toUpperCase()} downloaded`);
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.shell}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLabel}>EXPORT &amp; COMPILE</div>
        <div style={s.headerSub}>Approved + edited lines only</div>
      </div>

      {/* Meta */}
      {loadingMeta && (
        <div style={s.loadingRow}>
          <span style={s.loadingDot} /><span style={s.loadingDot} /><span style={s.loadingDot} />
        </div>
      )}

      {error && (
        <div style={s.errorBox}>
          <div style={s.errorText}>{error}</div>
          <button style={s.retryBtn} onClick={loadMeta} type='button'>Retry</button>
        </div>
      )}

      {meta && !loadingMeta && (
        <>
          {/* Stats */}
          <div style={s.statsGrid}>
            <StatBox icon='📖' value={meta.word_count.toLocaleString()} label='words' />
            <StatBox icon='📋' value={meta.chapter_count} label='chapters' />
            <StatBox icon='⏱' value={`${meta.reading_minutes}m`} label='read time' />
            <StatBox icon='✦'  value={meta.line_count}  label='lines' />
          </div>

          {/* Chapter breakdown */}
          {meta.chapters?.length > 0 && (
            <div style={s.chapterList}>
              <div style={s.chapterListLabel}>CHAPTERS</div>
              {meta.chapters.map((ch, i) => (
                <div key={i} style={s.chapterRow}>
                  <span style={s.chapterNum}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={s.chapterName}>{ch.title}</span>
                  <span style={s.chapterWords}>{ch.word_count.toLocaleString()}w</span>
                </div>
              ))}
            </div>
          )}

          {/* Download buttons */}
          <div style={s.downloadSection}>
            <div style={s.downloadLabel}>DOWNLOAD</div>

            <DownloadButton
              icon='📄'
              label='Word Document'
              sublabel='.docx — for editors'
              loading={downloadingDoc}
              onClick={() => downloadFile('docx')}
              tone={TONES.word}
            />

            <DownloadButton
              icon='📕'
              label='PDF'
              sublabel='.pdf — for readers'
              loading={downloadingPdf}
              onClick={() => downloadFile('pdf')}
              tone={TONES.pdf}
            />
          </div>

          {/* Note */}
          <div style={s.note}>
            Rejected and pending lines are not included.
            Lala lines appear in gold italic in both formats.
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          ...s.toast,
          background: toast.type === 'error' ? 'var(--danger)' : 'var(--success-text)',
        }}>
          {toast.msg}
        </div>
      )}

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatBox({ icon, value, label }) {
  return (
    <div style={sb.box}>
      <div style={sb.icon}>{icon}</div>
      <div style={sb.value}>{value}</div>
      <div style={sb.label}>{label}</div>
    </div>
  );
}

function DownloadButton({ icon, label, sublabel, loading, onClick, tone }) {
  return (
    <button
      style={{
        ...db.btn,
        borderColor: tone.line,
        opacity: loading ? 0.6 : 1,
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
      onClick={onClick}
      disabled={loading}
      type='button'
    >
      <span style={db.icon}>{loading ? '…' : icon}</span>
      <div style={db.text}>
        <div style={{ ...db.label, color: tone.text }}>{loading ? 'Generating…' : label}</div>
        <div style={db.sublabel}>{sublabel}</div>
      </div>
      {!loading && <span style={{ ...db.arrow, color: tone.text }}>↓</span>}
    </button>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

// The panel sits on WriteMode's parchment but was written for a dark
// surface: cream text at 0.15-0.85 alpha, about 1:1 on parchment (theme
// batch 6, 2026-10-05). Gold as text is --lala-gold-text; cream text is
// --text-secondary, or --text-primary at 0.6 and above.
const GOLD = 'var(--lala-gold-text)';
// The download buttons: Word in the info family, PDF in gold; a line for
// the border and a text twin for the label and arrow (4.5:1). The old
// border was the hex colour with a 30 alpha suffix.
const TONES = {
  word: { line: 'var(--info-border)',    text: 'var(--info-text)' },
  pdf:  { line: 'var(--lala-gold-line)', text: 'var(--lala-gold-text)' },
};

const s = {
  shell: {
    display:       'flex',
    flexDirection: 'column',
    gap:           0,
    padding:       '0 0 32px',
    position:      'relative',
  },
  header: {
    padding:      '16px 16px 12px',
    borderBottom: '1px solid var(--lala-gold-line)',
    marginBottom: 8,
  },
  headerLabel: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    letterSpacing: '0.22em',
    color:         GOLD,
    marginBottom:  3,
  },
  headerSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize:   9,
    color:      'var(--text-secondary)',
  },
  loadingRow: {
    display:        'flex',
    justifyContent: 'center',
    gap:            6,
    padding:        '32px 0',
  },
  loadingDot: {
    display:      'inline-block',
    width:        5,
    height:       5,
    borderRadius: '50%',
    background:   'var(--lala-gold)',
  },
  errorBox: {
    margin:     '12px 16px',
    padding:    '12px 14px',
    background: 'var(--danger-bg)',
    border:     '1px solid var(--danger-border)',
    borderRadius: 4,
    display:    'flex',
    flexDirection: 'column',
    gap:        8,
  },
  errorText: {
    fontFamily: 'DM Mono, monospace',
    fontSize:   9,
    color:      'var(--danger-text)',
  },
  retryBtn: {
    background:    'none',
    border:        '1px solid var(--danger-border)',
    borderRadius:  3,
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    letterSpacing: '0.1em',
    color:         'var(--danger-text)',
    padding:       '5px 12px',
    cursor:        'pointer',
    alignSelf:     'flex-start',
  },
  statsGrid: {
    display:             'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap:                 1,
    margin:              '4px 16px 16px',
    background:          'var(--lala-parchment-2)',
    border:              '1px solid var(--lala-parchment-3)',
    borderRadius:        4,
    overflow:            'hidden',
  },
  chapterList: {
    margin:       '0 16px 16px',
    border:       '1px solid var(--lala-parchment-3)',
    borderRadius: 4,
    overflow:     'hidden',
  },
  chapterListLabel: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      7,
    letterSpacing: '0.2em',
    color:         'var(--text-secondary)',
    padding:       '8px 12px 6px',
    borderBottom:  '1px solid var(--lala-parchment-3)',
  },
  chapterRow: {
    display:      'flex',
    alignItems:   'center',
    gap:          8,
    padding:      '7px 12px',
    borderBottom: '1px solid var(--lala-parchment-3)',
  },
  chapterNum: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    color:         GOLD,
    flexShrink:    0,
    width:         18,
  },
  chapterName: {
    fontFamily:    "'Playfair Display', serif",
    fontSize:      12,
    fontStyle:     'italic',
    color:         'var(--text-primary)',
    flex:          1,
  },
  chapterWords: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      7,
    color:         'var(--text-secondary)',
    letterSpacing: '0.04em',
  },
  downloadSection: {
    margin:        '4px 16px 12px',
    display:       'flex',
    flexDirection: 'column',
    gap:           8,
  },
  downloadLabel: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      7,
    letterSpacing: '0.2em',
    color:         'var(--text-secondary)',
    marginBottom:  2,
  },
  note: {
    margin:     '0 16px',
    fontFamily: 'DM Mono, monospace',
    fontSize:   8,
    color:      'var(--text-secondary)',
    lineHeight: 1.6,
    letterSpacing: '0.03em',
  },
  toast: {
    position:   'fixed',
    bottom:     24,
    right:      24,
    color:      'var(--text-inverse)',
    fontSize:   11,
    fontFamily: 'DM Mono, monospace',
    letterSpacing: '0.06em',
    fontWeight: 600,
    padding:    '9px 16px',
    borderRadius: 3,
    zIndex:     9999,
    pointerEvents: 'none',
  },
};

// StatBox styles
const sb = {
  box: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           3,
    padding:       '14px 8px',
    background:    'var(--lala-parchment-2)',
  },
  icon: {
    fontSize: 14,
  },
  value: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      13,
    fontWeight:    600,
    color:         'var(--text-primary)',
    letterSpacing: '0.02em',
  },
  label: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      7,
    color:         'var(--text-secondary)',
    letterSpacing: '0.1em',
  },
};

// DownloadButton styles
const db = {
  btn: {
    display:     'flex',
    alignItems:  'center',
    gap:         12,
    width:       '100%',
    background:  'var(--lala-parchment-2)',
    border:      '1px solid',
    borderRadius: 4,
    padding:     '12px 14px',
    textAlign:   'left',
    transition:  'opacity 0.12s',
  },
  icon: {
    fontSize:   20,
    flexShrink: 0,
  },
  text: {
    flex: 1,
  },
  label: {
    fontSize:   13,
    fontWeight: 600,
    fontFamily: "'Playfair Display', serif",
    marginBottom: 2,
  },
  sublabel: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    color:         'var(--text-secondary)',
    letterSpacing: '0.06em',
  },
  arrow: {
    fontSize:   16,
    flexShrink: 0,
  },
};
