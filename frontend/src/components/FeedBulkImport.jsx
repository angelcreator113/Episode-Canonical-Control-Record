// FeedBulkImport.jsx — Bulk import panel for SocialProfileGenerator (The Feed)

import { useState, useRef, useCallback, useEffect } from 'react';

const API = '/api/v1/social-profiles';

const C = {
  bg: '#ffffff', surface: '#f7f6f9', surfaceHigh: '#eeedf2',
  border: '#ddd9e3', borderLight: '#ccc7d4',
  text: '#1a1424', textDim: '#5a5068', textFaint: '#8a8498',
  pink: '#c4588a', pinkSoft: '#c4588a14', pinkMid: '#c4588a28',
  blue: '#4a8cb8', blueSoft: '#4a8cb812',
  lavender: '#8a6aac', lavSoft: '#8a6aac12',
  gold: '#a8873e', goldSoft: '#a8873e14',
  red: '#c45858', redSoft: '#c4585812',
  green: '#4a9870', greenSoft: '#4a987012',
};

const PLATFORMS = ['tiktok','instagram','youtube','twitter','onlyfans','twitch','substack','multi'];
const ACCEPTED  = '.pdf,.docx,.doc,.txt,.md';

const PASTE_PLACEHOLDER = `@mollymeannn | tiktok | does makeup but something is breaking down
@thesoftlifequeen | instagram | luxury everything, never explains how
@overnight.era | tiktok | 400k in 6 months, nothing she did was different
@theexplicitmess | onlyfans | went fully transparent, audience grew 3x
@justlikeher_ | instagram | same niche same size, now pulling ahead`;

const STORAGE_KEY = 'feed_bulk_import_draft';

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function FeedBulkImport({ onDone, seriesId }) {
  const draft = useRef(loadDraft());

  const [mode, setMode]           = useState(draft.current?.mode || 'paste');
  const [pasteText, setPasteText] = useState(draft.current?.pasteText || '');
  const [files, setFiles]         = useState([]);
  const [dragging, setDragging]   = useState(false);

  // Parsed candidates before generation
  const [candidates, setCandidates] = useState(draft.current?.candidates ?? null);
  const [parseErrors, setParseErrors] = useState(draft.current?.parseErrors || []);
  const [extractNotes, setExtractNotes] = useState(draft.current?.extractNotes || '');

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress]     = useState(draft.current?.progress ?? null);
  const [summary, setSummary]       = useState(draft.current?.summary ?? null);

  const [parsing, setParsing]   = useState(false);
  const [err, setErr]           = useState(null);
  const fileRef = useRef();

  // ── Persist draft to localStorage ──────────────────────────────────────────
  useEffect(() => {
    const data = { mode, pasteText, candidates, parseErrors, extractNotes, progress, summary };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [mode, pasteText, candidates, parseErrors, extractNotes, progress, summary]);

  // ── Mobile paste fallback (some mobile browsers don't fire onChange for paste) ──
  const handlePaste = useCallback(e => {
    const pasted = e.clipboardData?.getData('text');
    if (pasted) {
      e.preventDefault();
      setPasteText(prev => {
        const el = e.target;
        const start = el.selectionStart ?? prev.length;
        const end   = el.selectionEnd   ?? prev.length;
        return prev.slice(0, start) + pasted + prev.slice(end);
      });
    }
  }, []);

  // ── Drag and drop ──────────────────────────────────────────────────────────
  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(f => [...f, ...dropped]);
    setMode('file');
  }, []);

  // ── Parse paste list ───────────────────────────────────────────────────────
  async function parsePaste() {
    if (!pasteText.trim()) return;
    setParsing(true); setErr(null); setCandidates(null);
    try {
      const res  = await fetch(`${API}/bulk/parse-paste`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = await res.json();
      setCandidates(data.creators || []);
      setParseErrors(data.errors || []);
    } catch (e) { setErr(e.message); }
    finally { setParsing(false); }
  }

  // ── Parse files ────────────────────────────────────────────────────────────
  async function parseFiles() {
    if (!files.length) return;
    setParsing(true); setErr(null); setCandidates(null);
    try {
      const allCreators = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res  = await fetch(`${API}/bulk/parse-file`, {
          method: 'POST', body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(`${file.name}: ${data.error}`);
        allCreators.push(...(data.creators || []));
        setExtractNotes(data.extraction_notes || '');
      }
      setCandidates(allCreators);
    } catch (e) { setErr(e.message); }
    finally { setParsing(false); }
  }

  // ── Remove a candidate before generating ──────────────────────────────────
  function removeCandidate(i) {
    setCandidates(c => c.filter((_, idx) => idx !== i));
  }

  function updateCandidate(i, field, val) {
    setCandidates(c => c.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  // ── Generate all candidates (batched in small chunks) ───────────────────────
  async function generateAll() {
    if (!candidates?.length) return;
    setGenerating(true); setErr(null);

    const BATCH_SIZE = 3;
    const total = candidates.length;
    const allResults = [];
    setProgress({ done: 0, total, results: [] });

    try {
      const totalBatches = Math.ceil(total / BATCH_SIZE);
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = candidates.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        setProgress({ done: allResults.length, total, batchNum, totalBatches, results: [...allResults] });
        try {
          const res = await fetch(`${API}/bulk/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creators: batch, series_id: seriesId }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          allResults.push(...data.results);
        } catch (batchErr) {
          // Mark every creator in this batch as failed, but keep going
          for (const c of batch) {
            allResults.push({ handle: c.handle, platform: c.platform, status: 'failed', error: batchErr.message });
          }
        }
        setProgress({ done: allResults.length, total, results: [...allResults] });
      }

      const succeeded = allResults.filter(r => r.status === 'success').length;
      const failed    = allResults.filter(r => r.status === 'failed').length;
      setSummary({ total, succeeded, failed });
    } catch (e) { setErr(e.message); }
    finally { setGenerating(false); }
  }

  const hasCandidates = candidates !== null && candidates.length > 0;
  const isDone        = summary !== null;

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 32px)', maxWidth: '720px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: '700', color: C.text, marginBottom: '6px' }}>
          Bulk Import
        </div>
        <div style={{ fontSize: '13px', color: C.textDim, lineHeight: '1.7' }}>
          Paste a list or upload files. The system extracts creator signals and generates full profiles automatically.
        </div>
      </div>

      {err && (
        <div style={{ padding: '10px 14px', background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: '8px', fontSize: '13px', color: C.red, marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
          {err} <button onClick={() => setErr(null)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── DONE STATE ── */}
      {isDone && (
        <div>
          <div style={{ padding: '24px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>
              {summary.failed === 0 ? '✓' : '⚠'}
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', color: C.text, marginBottom: '6px' }}>
              {summary.succeeded} of {summary.total} profiles generated
            </div>
            {summary.failed > 0 && (
              <div style={{ fontSize: '12px', color: C.red, marginBottom: '6px' }}>{summary.failed} failed — retry individually from The Feed</div>
            )}
          </div>

          {/* Results list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
            {progress?.results?.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.surface, border: `1px solid ${r.status === 'success' ? C.green + '44' : C.red + '44'}`, borderRadius: '8px' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '13px', color: r.status === 'success' ? C.green : C.red }}>{r.handle}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {r.status === 'success' && r.lala_score > 0 && (
                    <span style={{ fontSize: '10px', color: C.gold }}>⬡ Lala {r.lala_score}/10</span>
                  )}
                  <span style={{ fontSize: '11px', color: r.status === 'success' ? C.green : C.red }}>
                    {r.status === 'success' ? '✓ Generated' : '✕ Failed'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => { localStorage.removeItem(STORAGE_KEY); onDone(); }} style={{ width: '100%', padding: '12px', background: C.text, border: 'none', borderRadius: '10px', color: C.bg, fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
            Back to The Feed →
          </button>
        </div>
      )}

      {/* ── GENERATING STATE ── */}
      {generating && !isDone && (
        <div style={{ padding: '32px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', textAlign: 'center' }}>
          <Spin size={24} />
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: C.text, marginTop: '16px', marginBottom: '6px' }}>
            Generating {candidates.length} profile{candidates.length !== 1 ? 's' : ''}…
          </div>
          <div style={{ fontSize: '12px', color: C.textFaint }}>
            This takes about 15–20 seconds per profile. Don't close this page.
          </div>
          {progress && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ height: '4px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(progress.done / progress.total) * 100}%`, background: C.pink, borderRadius: '2px', transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ fontSize: '12px', color: C.textDim, marginTop: '10px' }}>
                {progress.done} of {progress.total} done
                {progress.batchNum && progress.totalBatches > 1 && (
                  <span> — batch {progress.batchNum} of {progress.totalBatches}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CANDIDATES REVIEW ── */}
      {hasCandidates && !generating && !isDone && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: C.pink, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {candidates.length} creator{candidates.length !== 1 ? 's' : ''} ready to generate
            </div>
            <button onClick={() => { setCandidates(null); setSummary(null); setPasteText(''); setParseErrors([]); setExtractNotes(''); setProgress(null); localStorage.removeItem(STORAGE_KEY); }} style={{ background: 'none', border: 'none', color: C.textFaint, fontSize: '12px', cursor: 'pointer' }}>
              Start over
            </button>
          </div>

          {extractNotes && (
            <div style={{ padding: '8px 12px', background: C.goldSoft, border: `1px solid ${C.gold}33`, borderRadius: '6px', fontSize: '11px', color: C.gold, marginBottom: '12px' }}>
              {extractNotes}
            </div>
          )}

          {parseErrors.length > 0 && (
            <div style={{ padding: '10px 14px', background: C.redSoft, border: `1px solid ${C.red}33`, borderRadius: '8px', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: C.red, fontWeight: '700', marginBottom: '6px' }}>{parseErrors.length} line{parseErrors.length !== 1 ? 's' : ''} could not be parsed:</div>
              {parseErrors.map((e, i) => (
                <div key={i} style={{ fontSize: '11px', color: C.textDim, marginBottom: '2px' }}>
                  <span style={{ color: C.red }}>✕</span> &ldquo;{e.line}&rdquo; — {e.reason}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', maxHeight: '360px', overflowY: 'auto' }}>
            {candidates.map((c, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '8px', alignItems: 'center', padding: '10px 12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px' }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', color: C.pink, marginBottom: '3px' }}>{c.handle}</div>
                  <div style={{ fontSize: '11px', color: C.textDim, lineHeight: '1.5' }}>{c.vibe_sentence}</div>
                </div>
                {/* Platform selector */}
                <select
                  value={c.platform}
                  onChange={e => updateCandidate(i, 'platform', e.target.value)}
                  style={{ padding: '4px 6px', background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, fontSize: '11px', outline: 'none' }}
                >
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {c.source_text && (
                  <span title={c.source_text} style={{ fontSize: '10px', color: C.textFaint, cursor: 'help' }}>✦ extracted</span>
                )}
                <button onClick={() => removeCandidate(i)} style={{ background: 'none', border: 'none', color: C.textFaint, cursor: 'pointer', fontSize: '14px', padding: '2px 4px' }}>✕</button>
              </div>
            ))}
          </div>

          <button onClick={generateAll} style={{ width: '100%', padding: '14px', minHeight: '48px', background: C.pink, border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', WebkitAppearance: 'none' }}>
            Generate {candidates.length} Profile{candidates.length !== 1 ? 's' : ''} →
          </button>
        </div>
      )}

      {/* ── INPUT STATE ── */}
      {!hasCandidates && !generating && !isDone && (
        <div>
          {/* Mode toggle */}
          <div style={{ display: 'flex', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '4px', marginBottom: '20px' }}>
            {[
              { key: 'paste', label: '✎ Paste List' },
              { key: 'file',  label: '⊞ Upload Files' },
            ].map(m => (
              <button key={m.key} onClick={() => setMode(m.key)} style={{ flex: 1, padding: '12px 9px', minHeight: '44px', background: mode === m.key ? C.surfaceHigh : 'transparent', border: `1px solid ${mode === m.key ? C.border : 'transparent'}`, borderRadius: '8px', color: mode === m.key ? C.text : C.textFaint, fontSize: '14px', fontWeight: mode === m.key ? '600' : '400', cursor: 'pointer', transition: 'all 0.15s', WebkitAppearance: 'none' }}>
                {m.label}
              </button>
            ))}
          </div>

          {/* PASTE MODE */}
          {mode === 'paste' && (
            <div>
              <div style={{ fontSize: '11px', color: C.textFaint, marginBottom: '8px', lineHeight: '1.6' }}>
                Paste anything — creator lists, notes, freeform text. Use <span style={{ color: C.pink, fontFamily: 'monospace' }}>@handle | platform | vibe</span> for instant parsing, or paste freeform text and AI will extract creators.
              </div>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                onPaste={handlePaste}
                placeholder={PASTE_PLACEHOLDER}
                rows={8}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                style={{ width: '100%', padding: '14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', color: C.text, fontSize: '16px', fontFamily: 'monospace', lineHeight: '1.6', outline: 'none', resize: 'vertical', boxSizing: 'border-box', WebkitAppearance: 'none', WebkitTextSizeAdjust: '100%' }}
              />

              {/* Show parse errors inline when no candidates found */}
              {parseErrors.length > 0 && candidates !== null && candidates.length === 0 && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: C.redSoft, border: `1px solid ${C.red}33`, borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: C.red, fontWeight: '700', marginBottom: '6px' }}>
                    {parseErrors.length} line{parseErrors.length !== 1 ? 's' : ''} could not be parsed:
                  </div>
                  {parseErrors.slice(0, 5).map((e, i) => (
                    <div key={i} style={{ fontSize: '11px', color: C.textDim, marginBottom: '2px' }}>
                      <span style={{ color: C.red }}>✕</span> &ldquo;{e.line}&rdquo; — {e.reason}
                    </div>
                  ))}
                  {parseErrors.length > 5 && (
                    <div style={{ fontSize: '11px', color: C.textFaint, marginTop: '4px' }}>…and {parseErrors.length - 5} more</div>
                  )}
                </div>
              )}

              <button
                onClick={parsePaste}
                disabled={parsing || !pasteText.trim()}
                style={{ marginTop: '12px', width: '100%', padding: '14px', minHeight: '48px', background: parsing ? C.surface : C.text, border: `1px solid ${parsing ? C.border : C.text}`, borderRadius: '10px', color: parsing ? C.textDim : C.bg, fontSize: '15px', fontWeight: '700', cursor: parsing ? 'default' : 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', WebkitAppearance: 'none' }}>
                {parsing && <Spin />}
                {parsing ? 'Parsing…' : 'Parse List →'}
              </button>
            </div>
          )}

          {/* FILE MODE */}
          {mode === 'file' && (
            <div>
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${dragging ? C.pink : C.border}`, borderRadius: '12px', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: dragging ? C.pinkSoft : C.surface, transition: 'all 0.15s', marginBottom: '16px' }}
              >
                <div style={{ fontSize: '28px', marginBottom: '10px', color: C.textFaint }}>⊞</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: C.text, marginBottom: '6px' }}>
                  Drop files here
                </div>
                <div style={{ fontSize: '12px', color: C.textFaint }}>PDF, Word (.docx), TXT, Markdown</div>
                <input ref={fileRef} type="file" accept={ACCEPTED} multiple onChange={e => setFiles(f => [...f, ...Array.from(e.target.files)])} style={{ display: 'none' }} />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px' }}>
                      <span style={{ fontSize: '12px', color: C.text }}>{f.name}</span>
                      <button onClick={() => setFiles(fs => fs.filter((_, fi) => fi !== i))} style={{ background: 'none', border: 'none', color: C.textFaint, cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={parseFiles}
                disabled={parsing || !files.length}
                style={{ width: '100%', padding: '14px', minHeight: '48px', background: parsing ? C.surface : C.text, border: `1px solid ${parsing ? C.border : C.text}`, borderRadius: '10px', color: parsing ? C.textDim : C.bg, fontSize: '15px', fontWeight: '700', cursor: parsing ? 'default' : 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', WebkitAppearance: 'none' }}>
                {parsing && <Spin />}
                {parsing ? 'Extracting creators…' : `Extract from ${files.length} file${files.length !== 1 ? 's' : ''} →`}
              </button>

              <div style={{ marginTop: '12px', padding: '10px 14px', background: C.goldSoft, border: `1px solid ${C.gold}33`, borderRadius: '8px', fontSize: '11px', color: C.gold, lineHeight: '1.6' }}>
                ✦ Claude will read the document and surface every creator signal it finds — handles, personality descriptions, content notes. You review before anything generates.
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function Spin({ size = 14 }) {
  return (
    <div style={{ width: `${size}px`, height: `${size}px`, border: `2px solid #c4588a33`, borderTop: '2px solid #c4588a', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
  );
}
