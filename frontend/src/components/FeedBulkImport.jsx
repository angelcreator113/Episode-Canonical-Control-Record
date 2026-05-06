// FeedBulkImport.jsx — Bulk import panel for SocialProfileGenerator (The Feed)
// Improvements: CSV mode (#3), SSE live progress (#1,#10), retry failed (#6),
// inline vibe editing (#7), drag-to-reorder (#9), import history (#11),
// keyboard shortcuts (#12), job cancellation UI (#5), error categories (#8)

import { useState, useRef, useCallback, useEffect } from 'react';
import apiClient from '../services/api';

const API = '/api/v1/social-profiles';

// Track 6 CP15 partial-migration extension (4th instance) — file already
// imports apiClient + uses fetchWithRetry. Add helpers for the 2 remaining
// raw fetch sites (job history GET + CSV parse POST).
export const listFeedBulkJobsApi = () =>
  apiClient.get(`${API}/bulk/jobs`).then((r) => r.data);
export const parseFeedBulkCsvApi = (text) =>
  apiClient.post(`${API}/bulk/parse-csv`, { text }).then((r) => r.data);

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
  orange: '#c48a3e', orangeSoft: '#c48a3e14',
};

const PLATFORMS = ['tiktok','instagram','youtube','twitter','onlyfans','twitch','substack','multi'];
const ACCEPTED  = '.pdf,.docx,.doc,.txt,.md,.csv,.tsv';

const PASTE_PLACEHOLDER = `@mollymeannn | tiktok | does makeup but something is breaking down
@thesoftlifequeen | instagram | luxury everything, never explains how
@overnight.era | tiktok | 400k in 6 months, nothing she did was different
@theexplicitmess | onlyfans | went fully transparent, audience grew 3x
@justlikeher_ | instagram | same niche same size, now pulling ahead`;

const CSV_PLACEHOLDER = `handle,platform,vibe
mollymeannn,tiktok,does makeup but something is breaking down
thesoftlifequeen,instagram,luxury everything never explains how
overnight.era,tiktok,400k in 6 months nothing she did was different`;

const STORAGE_KEY = 'feed_bulk_import_draft';

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.summary || data.progress) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}

// Track 4 helper-internal migration: fetchWithRetry delegates to apiClient.
// Retry semantics preserved (429 / 5xx / network exhaust). Returns a fetch-
// Response-like object (ok / status / json()) so existing call sites that
// check `res.ok` and `await res.json()` keep working unchanged.
async function fetchWithRetry(url, opts = {}, { retries = 2, baseDelay = 3000 } = {}) {
  const method = (opts.method || 'GET').toLowerCase();
  let data;
  if (opts.body !== undefined) {
    if (opts.body instanceof FormData) data = opts.body;
    else { try { data = JSON.parse(opts.body); } catch { data = opts.body; } }
  }
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await apiClient.request({ url, method, data });
      return { ok: true, status: res.status, json: () => Promise.resolve(res.data) };
    } catch (err) {
      const status = err.response?.status;
      const isRetryable = status === 429 || (status >= 500 && status < 600);
      if (isRetryable && attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[bulk-import] ${status} on attempt ${attempt + 1}, retrying in ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      if (!err.response && attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[bulk-import] Network error on attempt ${attempt + 1}, retrying in ${delay}ms…`, err.message);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      if (err.response) {
        return {
          ok: false,
          status: err.response.status,
          json: () => Promise.resolve(err.response.data),
        };
      }
      throw err;
    }
  }
}

export default function FeedBulkImport({ onDone, seriesId, characterContext, characterKey, feedLayer, onJobStarted }) {
  const draft = useRef(loadDraft());

  const [mode, setMode]           = useState(draft.current?.mode || 'paste');
  const [pasteText, setPasteText] = useState(draft.current?.pasteText || '');
  const [csvText, setCsvText]     = useState(draft.current?.csvText || '');
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

  // Import history sidebar (#11)
  const [showHistory, setShowHistory] = useState(false);
  const [jobHistory, setJobHistory]   = useState([]);

  // Drag-to-reorder state (#9)
  const [dragIdx, setDragIdx] = useState(null);

  // Editing vibe inline (#7)
  const [editingVibe, setEditingVibe] = useState(null);

  // ── Persist draft to localStorage ──────────────────────────────────────────
  useEffect(() => {
    const data = { mode, pasteText, csvText, candidates, parseErrors, extractNotes, progress, summary };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [mode, pasteText, csvText, candidates, parseErrors, extractNotes, progress, summary]);

  // ── Clear localStorage on unmount if generation completed ──────────────────
  const summaryRef = useRef(summary);
  useEffect(() => { summaryRef.current = summary; }, [summary]);
  useEffect(() => {
    return () => {
      if (summaryRef.current) localStorage.removeItem(STORAGE_KEY);
    };
  }, []);

  // ── Keyboard shortcuts (#12) ──────────────────────────────────────────────
  useEffect(() => {
    function handleKey(e) {
      const mod = e.metaKey || e.ctrlKey;
      // Ctrl/Cmd+Enter — Parse (from input) or Generate (from candidates)
      if (mod && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (candidates?.length && !generating && !summary) {
          generateAll();
        } else if (!candidates && !generating) {
          if (mode === 'paste' && pasteText.trim()) parsePaste();
          else if (mode === 'csv' && csvText.trim()) parseCsv();
          else if (mode === 'file' && files.length) parseFiles();
        }
      }
      // Ctrl/Cmd+Shift+Enter — Submit as background job
      if (mod && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        if (candidates?.length && !generating && !summary && onJobStarted) {
          submitBackgroundJob();
        }
      }
      // Escape — back to input from candidates
      if (e.key === 'Escape' && candidates?.length && !generating && !summary) {
        setCandidates(null); setParseErrors([]); setExtractNotes('');
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  // ── Load job history (#11) ────────────────────────────────────────────────
  useEffect(() => {
    if (showHistory) {
      listFeedBulkJobsApi().then(d => setJobHistory(d.jobs || [])).catch(() => {});
    }
  }, [showHistory]);

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
      const res  = await fetchWithRetry(`${API}/bulk/parse-paste`, {
        method: 'POST',
        body: JSON.stringify({ text: pasteText }),
      });
      const data = await res.json();
      setCandidates(data.creators || []);
      setParseErrors(data.errors || []);
    } catch (e) { setErr(e.message); }
    finally { setParsing(false); }
  }

  // ── Parse CSV (#3) ────────────────────────────────────────────────────────
  async function parseCsv() {
    if (!csvText.trim()) return;
    setParsing(true); setErr(null); setCandidates(null);
    try {
      let data;
      try {
        data = await parseFeedBulkCsvApi(csvText);
      } catch (httpErr) {
        throw new Error(httpErr.response?.data?.error || 'Parse failed');
      }
      setCandidates(data.creators || []);
      setParseErrors(data.errors || []);
      if (data.detected_columns) {
        setExtractNotes(`Mapped: handle → ${data.detected_columns.handle || '?'}, platform → ${data.detected_columns.platform || 'auto'}, vibe → ${data.detected_columns.vibe || 'auto'}`);
      }
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
        const res = await fetchWithRetry(`${API}/bulk/parse-file`, {
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

  // ── Drag-to-reorder handlers (#9) ─────────────────────────────────────────
  function onDragStart(i) { setDragIdx(i); }
  function onDragOver(e, i) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    setCandidates(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(i, 0, moved);
      return next;
    });
    setDragIdx(i);
  }
  function onDragEnd() { setDragIdx(null); }

  // ── Generate all candidates ────────────────────────────────────────────────
  async function generateAll() {
    if (!candidates?.length) return;
    setGenerating(true); setErr(null);

    const BATCH_SIZE = 1;
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
          const res = await fetchWithRetry(`${API}/bulk/generate`, {
            method: 'POST',
            body: JSON.stringify({ creators: batch, series_id: seriesId, character_context: characterContext, character_key: characterKey, feed_layer: feedLayer || 'real_world' }),
          }, { retries: 2, baseDelay: 4000 });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
          allResults.push(...data.results);
        } catch (batchErr) {
          for (const c of batch) {
            allResults.push({ handle: c.handle, platform: c.platform, status: 'failed', error: batchErr.message });
          }
        }
        setProgress({ done: allResults.length, total, results: [...allResults] });

        if (i + BATCH_SIZE < total) await new Promise(r => setTimeout(r, 1000));
      }

      const succeeded = allResults.filter(r => r.status === 'success').length;
      const failed    = allResults.filter(r => r.status === 'failed').length;
      setSummary({ total, succeeded, failed });
    } catch (e) { setErr(e.message); }
    finally { setGenerating(false); }
  }

  const hasCandidates = candidates !== null && candidates.length > 0;
  const isDone        = summary !== null;
  const [submittingJob, setSubmittingJob] = useState(false);

  // ── Retry failed (#6) ─────────────────────────────────────────────────────
  function retryFailed() {
    if (!progress?.results) return;
    const failedCreators = progress.results
      .filter(r => r.status === 'failed')
      .map(r => ({ handle: r.handle, platform: r.platform, vibe_sentence: candidates?.find(c => c.handle === r.handle)?.vibe_sentence || '' }));
    if (failedCreators.length === 0) return;
    setCandidates(failedCreators);
    setSummary(null);
    setProgress(null);
    setGenerating(false);
  }

  // ── Submit background job (large batches — safe to leave page) ──────────
  async function submitBackgroundJob() {
    if (!candidates?.length) return;
    setSubmittingJob(true); setErr(null);
    try {
      const res = await fetchWithRetry(`${API}/bulk/generate-job`, {
        method: 'POST',
        body: JSON.stringify({
          creators: candidates,
          series_id: seriesId,
          character_context: characterContext,
          character_key: characterKey,
          feed_layer: feedLayer || 'real_world',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create job');
      localStorage.removeItem(STORAGE_KEY);
      if (onJobStarted) onJobStarted(data.job_id);
    } catch (e) { setErr(e.message); }
    finally { setSubmittingJob(false); }
  }

  // ── Error category badge (#8) ─────────────────────────────────────────────
  function ErrorBadge({ result }) {
    if (result.status !== 'failed') return null;
    const cat = result.error_category || 'unknown';
    const label = result.error_label || 'Error';
    const colors = {
      timeout: C.orange,
      rate_limit: C.gold,
      ai_parse: C.lavender,
      network: C.blue,
      db_error: C.red,
      cancelled: C.textFaint,
      unknown: C.red,
    };
    return (
      <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: (colors[cat] || C.red) + '18', color: colors[cat] || C.red, fontWeight: '600', whiteSpace: 'nowrap' }}>
        {label}{result.retryable ? ' ↻' : ''}
      </span>
    );
  }

  return (
    <div style={{ padding: 'clamp(16px, 4vw, 32px)', maxWidth: '720px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: '700', color: C.text, marginBottom: '6px' }}>
            Bulk Import
          </div>
          {/* Import history toggle (#11) */}
          <button onClick={() => setShowHistory(h => !h)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '6px 12px', fontSize: '11px', color: C.textDim, cursor: 'pointer' }}>
            {showHistory ? '← Hide History' : '⧗ Import History'}
          </button>
        </div>
        <div style={{ fontSize: '13px', color: C.textDim, lineHeight: '1.7' }}>
          Paste a list, upload files, or import CSV. The system extracts creator signals and generates full profiles automatically.
        </div>
        <div style={{ fontSize: '10px', color: C.textFaint, marginTop: '4px' }}>
          <kbd style={{ padding: '1px 5px', background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: '3px', fontSize: '9px' }}>Ctrl+Enter</kbd> Parse / Generate &nbsp;
          <kbd style={{ padding: '1px 5px', background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: '3px', fontSize: '9px' }}>Ctrl+Shift+Enter</kbd> Background job &nbsp;
          <kbd style={{ padding: '1px 5px', background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: '3px', fontSize: '9px' }}>Esc</kbd> Back
        </div>
      </div>

      {/* ── Import History Sidebar (#11) ── */}
      {showHistory && (
        <div style={{ marginBottom: '20px', padding: '14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: C.pink, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Recent Imports</div>
          {jobHistory.length === 0 && <div style={{ fontSize: '12px', color: C.textFaint }}>No imports yet</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
            {jobHistory.map(j => (
              <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: C.text, fontWeight: '600' }}>Job #{j.id}</span>
                  <span style={{ fontSize: '10px', color: C.textFaint, marginLeft: '8px' }}>
                    {j.character_key || 'no key'} · {new Date(j.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: j.status === 'completed' ? C.green : j.status === 'failed' ? C.red : j.status === 'cancelled' ? C.orange : C.blue }}>
                    {j.completed || 0}/{j.total} · {j.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <div style={{ fontSize: '12px', color: C.red, marginBottom: '6px' }}>{summary.failed} failed</div>
            )}
          </div>

          {/* Results list with animated appearance (#10) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
            {progress?.results?.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.surface, border: `1px solid ${r.status === 'success' ? C.green + '44' : C.red + '44'}`, borderRadius: '8px', animation: 'fadeSlideIn 0.3s ease', animationDelay: `${i * 0.05}s`, animationFillMode: 'both' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '13px', color: r.status === 'success' ? C.green : C.red }}>{r.handle}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {r.status === 'success' && r.lala_score > 0 && (
                    <span style={{ fontSize: '10px', color: C.gold }}>⬡ Lala {r.lala_score}/10</span>
                  )}
                  {r.status === 'success' && r.archetype && (
                    <span style={{ fontSize: '9px', color: C.lavender, background: C.lavSoft, padding: '2px 6px', borderRadius: '4px' }}>{r.archetype}</span>
                  )}
                  <ErrorBadge result={r} />
                  <span style={{ fontSize: '11px', color: r.status === 'success' ? C.green : C.red }}>
                    {r.status === 'success' ? '✓ Generated' : '✕ Failed'}
                  </span>
                </div>
                {r.status === 'failed' && r.error && (
                  <div style={{ fontSize: '11px', color: C.textFaint, marginTop: '4px', lineHeight: '1.4', wordBreak: 'break-word' }}>
                    {r.error}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Retry failed button (#6) */}
            {summary.failed > 0 && (
              <button onClick={retryFailed} style={{ flex: 1, padding: '12px', background: C.orange, border: 'none', borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
                ↻ Retry {summary.failed} Failed
              </button>
            )}
            <button onClick={() => { localStorage.removeItem(STORAGE_KEY); onDone(); }} style={{ flex: 1, padding: '12px', background: C.text, border: 'none', borderRadius: '10px', color: C.bg, fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
              Back to The Feed →
            </button>
          </div>
        </div>
      )}

      {/* ── GENERATING STATE with live profile feed (#10) ── */}
      {generating && !isDone && (
        <div style={{ padding: '32px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px' }}>
          <div style={{ textAlign: 'center' }}>
            <Spin size={24} />
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: C.text, marginTop: '16px', marginBottom: '6px' }}>
              Generating {candidates.length} profile{candidates.length !== 1 ? 's' : ''}…
            </div>
            <div style={{ fontSize: '12px', color: C.textFaint }}>
              This takes about 15–20 seconds per profile. Don't close this page.
            </div>
          </div>
          {progress && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ height: '4px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(progress.done / progress.total) * 100}%`, background: C.pink, borderRadius: '2px', transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ fontSize: '12px', color: C.textDim, marginTop: '10px', textAlign: 'center' }}>
                {progress.done} of {progress.total} done
                {progress.batchNum && progress.totalBatches > 1 && (
                  <span> — batch {progress.batchNum} of {progress.totalBatches}</span>
                )}
              </div>
              {/* Live profile results as they appear (#10) */}
              {progress.results?.length > 0 && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                  {progress.results.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: C.bg, border: `1px solid ${r.status === 'success' ? C.green + '33' : C.red + '33'}`, borderRadius: '6px', animation: 'fadeSlideIn 0.3s ease' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: r.status === 'success' ? C.green : C.red }}>@{r.handle}</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <ErrorBadge result={r} />
                        <span style={{ fontSize: '10px', color: r.status === 'success' ? C.green : C.red }}>
                          {r.status === 'success' ? '✓' : '✕'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── CANDIDATES REVIEW with drag-reorder (#9) + inline vibe edit (#7) ── */}
      {hasCandidates && !generating && !isDone && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: C.pink, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {candidates.length} creator{candidates.length !== 1 ? 's' : ''} ready to generate
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '9px', color: C.textFaint }}>drag to reorder</span>
              <button onClick={() => { setCandidates(null); setSummary(null); setPasteText(''); setCsvText(''); setFiles([]); setParseErrors([]); setExtractNotes(''); setProgress(null); localStorage.removeItem(STORAGE_KEY); }} style={{ background: 'none', border: 'none', color: C.textFaint, fontSize: '12px', cursor: 'pointer' }}>
                Start over
              </button>
            </div>
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
              <div
                key={i}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={e => onDragOver(e, i)}
                onDragEnd={onDragEnd}
                style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: '8px', alignItems: 'center', padding: '10px 12px', background: dragIdx === i ? C.pinkSoft : C.surface, border: `1px solid ${dragIdx === i ? C.pink + '44' : C.border}`, borderRadius: '8px', cursor: 'grab', transition: 'background 0.15s, border-color 0.15s' }}
              >
                {/* Drag handle (#9) */}
                <span style={{ fontSize: '12px', color: C.textFaint, cursor: 'grab', userSelect: 'none' }}>⠿</span>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', color: C.pink, marginBottom: '3px' }}>{c.handle}</div>
                  {/* Inline vibe editing (#7) */}
                  {editingVibe === i ? (
                    <input
                      autoFocus
                      value={c.vibe_sentence}
                      onChange={e => updateCandidate(i, 'vibe_sentence', e.target.value)}
                      onBlur={() => setEditingVibe(null)}
                      onKeyDown={e => { if (e.key === 'Enter') setEditingVibe(null); }}
                      style={{ width: '100%', padding: '4px 6px', background: C.bg, border: `1px solid ${C.pink}44`, borderRadius: '4px', color: C.text, fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  ) : (
                    <div
                      onClick={() => setEditingVibe(i)}
                      title="Click to edit vibe"
                      style={{ fontSize: '11px', color: C.textDim, lineHeight: '1.5', cursor: 'text', minHeight: '16px' }}
                    >
                      {c.vibe_sentence || <span style={{ color: C.textFaint, fontStyle: 'italic' }}>click to add vibe…</span>}
                    </div>
                  )}
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

          {/* Background job option for larger batches */}
          {onJobStarted && (
            <button onClick={submitBackgroundJob} disabled={submittingJob} style={{ width: '100%', marginTop: '8px', padding: '14px', minHeight: '48px', background: 'transparent', border: `1px solid ${C.lavender}44`, borderRadius: '10px', color: C.lavender, fontSize: '13px', fontWeight: '600', cursor: submittingJob ? 'default' : 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', WebkitAppearance: 'none' }}>
              {submittingJob ? <><Spin /> Submitting…</> : `⟳ Generate in Background (safe to leave page)`}
            </button>
          )}
        </div>
      )}

      {/* ── INPUT STATE with 3 modes (#3) ── */}
      {!hasCandidates && !generating && !isDone && (
        <div>
          {/* Mode toggle — now includes CSV (#3) */}
          <div style={{ display: 'flex', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '4px', marginBottom: '20px' }}>
            {[
              { key: 'paste', label: '✎ Paste' },
              { key: 'csv',   label: '⊟ CSV' },
              { key: 'file',  label: '⊞ Files' },
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
                placeholder={PASTE_PLACEHOLDER}
                rows={8}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                style={{ width: '100%', padding: '14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', color: C.text, fontSize: '16px', fontFamily: 'monospace', lineHeight: '1.6', outline: 'none', resize: 'vertical', boxSizing: 'border-box', WebkitAppearance: 'none', WebkitTextSizeAdjust: '100%' }}
              />

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

          {/* CSV MODE (#3) */}
          {mode === 'csv' && (
            <div>
              <div style={{ fontSize: '11px', color: C.textFaint, marginBottom: '8px', lineHeight: '1.6' }}>
                Paste spreadsheet data (CSV or tab-separated). First row = headers. Auto-detects <span style={{ color: C.pink, fontFamily: 'monospace' }}>handle</span>, <span style={{ color: C.pink, fontFamily: 'monospace' }}>platform</span>, and <span style={{ color: C.pink, fontFamily: 'monospace' }}>vibe/description</span> columns.
              </div>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={CSV_PLACEHOLDER}
                rows={8}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                style={{ width: '100%', padding: '14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', color: C.text, fontSize: '16px', fontFamily: 'monospace', lineHeight: '1.6', outline: 'none', resize: 'vertical', boxSizing: 'border-box', WebkitAppearance: 'none', WebkitTextSizeAdjust: '100%' }}
              />

              <button
                onClick={parseCsv}
                disabled={parsing || !csvText.trim()}
                style={{ marginTop: '12px', width: '100%', padding: '14px', minHeight: '48px', background: parsing ? C.surface : C.text, border: `1px solid ${parsing ? C.border : C.text}`, borderRadius: '10px', color: parsing ? C.textDim : C.bg, fontSize: '15px', fontWeight: '700', cursor: parsing ? 'default' : 'pointer', fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', WebkitAppearance: 'none' }}>
                {parsing && <Spin />}
                {parsing ? 'Parsing CSV…' : 'Parse Spreadsheet →'}
              </button>

              <div style={{ marginTop: '12px', padding: '10px 14px', background: C.blueSoft, border: `1px solid ${C.blue}33`, borderRadius: '8px', fontSize: '11px', color: C.blue, lineHeight: '1.6' }}>
                ✦ Copy-paste directly from Google Sheets, Excel, or any spreadsheet. Tab-separated works too. The system maps columns automatically.
              </div>
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
                <div style={{ fontSize: '12px', color: C.textFaint }}>PDF, Word (.docx), TXT, Markdown, CSV, TSV</div>
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function Spin({ size = 14 }) {
  return (
    <div style={{ width: `${size}px`, height: `${size}px`, border: `2px solid #c4588a33`, borderTop: '2px solid #c4588a', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
  );
}
