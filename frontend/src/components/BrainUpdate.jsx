/**
 * Brain Update (Evoni, 2026-10-03, Brain Update step 1;
 * docs/BRAIN_OWNERSHIP.md): a source page's status-aware Brain button and
 * its Review Brain Update drawer. Replaces Push to Brain where a page has a
 * Brain Manifest (Social Systems first).
 *
 * The button previews the sync whenever the page's data changes
 * (POST /franchise-brain/sync/:source/preview, no AI) and says where the
 * page stands: Connect to Brain, Brain Up to Date ✓, or N Brain Updates.
 * The drawer shows what is new, what changed (before and after), what
 * retires, and what is unchanged; Update Brain → applies exactly what was
 * reviewed (POST …/apply with the preview's fingerprint).
 *
 * Props: source (manifest name, e.g. 'social_systems'), data (the page's
 * usePageData data map), ready (usePageData's loaded: until the saved
 * content is read, data is only the defaults, so nothing is previewed or
 * applied), name (optional: which of the page's sources this is, when a
 * page has more than one, e.g. 'Calendar').
 *
 * BrainUpdateElsewhere: for a page that edits a source but is not where it
 * syncs (an older editor with its own defaults), a link to the page that is.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';

const API = import.meta.env.VITE_API_URL || '/api/v1';
const TEAL = '#2F7F76';
const PINK = '#C06E87';
const INK = '#2C2C2C';
const MUTED = '#7a6d62';

export const previewBrainSync = (source, pageData) =>
  apiClient.post(`${API}/franchise-brain/sync/${source}/preview`, { page_data: pageData });
export const applyBrainSync = (source, pageData, fingerprint) =>
  apiClient.post(`${API}/franchise-brain/sync/${source}/apply`, { page_data: pageData, fingerprint });

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function buttonFor(preview, failed, name) {
  const b = baseButton(preview, failed);
  return name ? { ...b, label: b.label.replace('🧠 ', `🧠 ${name}: `) } : b;
}

function baseButton(preview, failed) {
  if (failed) return { label: '🧠 Brain unavailable', color: MUTED, bg: '#f4f1ec' };
  if (!preview) return { label: '🧠 Checking Brain…', color: MUTED, bg: '#f4f1ec' };
  if (preview.state === 'not_connected') return { label: '🧠 Connect to Brain', color: TEAL, bg: '#EAF5F3' };
  if (preview.state === 'up_to_date') return { label: '🧠 Brain Up to Date ✓', color: TEAL, bg: '#EAF5F3' };
  return { label: `🧠 ${plural(preview.pending, 'Brain Update', 'Brain Updates')}`, color: PINK, bg: '#FBEFF3' };
}

const sectionTitle = { fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', margin: '14px 0 6px' };
const cardStyle = { border: '1px solid #F5D5DF', borderRadius: 8, padding: '8px 10px', marginBottom: 6, background: '#fff' };
const body = { whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.45, color: INK, margin: '4px 0 0' };

function Card({ title, children, testId }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={cardStyle} data-testid={testId}>
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', fontSize: 13, fontWeight: 600, color: INK }}
      >
        {open ? '▾' : '▸'} {title}
      </button>
      {open && children}
    </div>
  );
}

export default function BrainUpdate({ source, data, ready = true, name }) {
  const [preview, setPreview] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const serialized = JSON.stringify(data || {});
  const latest = useRef(serialized);
  latest.current = serialized;

  const refresh = useCallback(async () => {
    const sent = latest.current;
    try {
      const res = await previewBrainSync(source, JSON.parse(sent));
      if (latest.current === sent) { setPreview(res.data?.data || null); setFailed(false); }
    } catch (err) {
      console.error('[BrainUpdate] preview failed:', err);
      if (latest.current === sent) setFailed(true);
    }
  }, [source]);

  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(refresh, 400);
    return () => clearTimeout(t);
  }, [serialized, refresh, ready]);

  const apply = async () => {
    if (!ready || !preview || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await applyBrainSync(source, JSON.parse(latest.current), preview.fingerprint);
      const { applied, preview: after } = res.data?.data || {};
      setPreview(after || null);
      setMessage({ ok: true, text: `Brain updated: ${applied.new} new, ${applied.changed} changed, ${applied.retired} retired.` });
    } catch (err) {
      console.error('[BrainUpdate] apply failed:', err);
      setMessage({ ok: false, text: err.response?.data?.error || 'The Brain could not be updated.' });
      if (err.response?.status === 409) refresh();
    } finally {
      setBusy(false);
    }
  };

  const b = buttonFor(preview, failed, name);
  return (
    <>
      <button
        type="button" data-testid={name ? `brain-update-button-${name.toLowerCase()}` : 'brain-update-button'} data-state={failed ? 'failed' : (preview?.state || 'loading')}
        onClick={() => { setMessage(null); setOpen(true); if (failed) refresh(); }}
        style={{
          padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, whiteSpace: 'nowrap', cursor: 'pointer',
          border: `1px solid ${b.color}`, background: b.bg, color: b.color,
        }}
      >
        {b.label}
      </button>
      {open && (
        <div role="dialog" aria-label="Review Brain Update" data-testid="brain-update-drawer"
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end', background: 'rgba(44,44,44,0.25)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{ width: 'min(460px, 100vw)', height: '100%', overflowY: 'auto', background: '#FAF7F0', padding: '16px', boxSizing: 'border-box', color: INK }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{preview?.label || 'Page'} → Brain Update</div>
                {preview?.last_synced && (
                  <div style={{ fontSize: 11, color: MUTED }}>Last synced {new Date(preview.last_synced).toLocaleString()}</div>
                )}
              </div>
              <button type="button" aria-label="Close" data-testid="brain-update-close" onClick={() => setOpen(false)}
                style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: MUTED }}>×</button>
            </div>

            {failed && <p data-testid="brain-update-failed" style={{ color: PINK, fontSize: 13 }}>The Brain could not be reached. Try again in a moment.</p>}
            {!preview && !failed && <p style={{ fontSize: 13, color: MUTED }}>Comparing this page with the Brain…</p>}

            {preview && (
              <>
                <div data-testid="brain-update-summary" style={{ marginTop: 10, fontSize: 13 }}>
                  {preview.pending === 0
                    ? 'Brain already matches this page. No update required.'
                    : [
                      preview.new.length && `${preview.new.length} new`,
                      preview.changed.length && `${preview.changed.length} changed`,
                      preview.retired.length && `${preview.retired.length} retiring`,
                      `${preview.unchanged.length} unchanged`,
                    ].filter(Boolean).join(' · ')}
                </div>

                {preview.new.length > 0 && (
                  <section data-testid="brain-update-new">
                    <div style={{ ...sectionTitle, color: TEAL }}>New</div>
                    {preview.new.map((c) => (
                      <Card key={c.source_key} title={c.title}><p style={body}>{c.content}</p></Card>
                    ))}
                  </section>
                )}

                {preview.changed.length > 0 && (
                  <section data-testid="brain-update-changed">
                    <div style={{ ...sectionTitle, color: PINK }}>Changed</div>
                    {preview.changed.map((c) => (
                      <Card key={c.source_key} title={c.title} testId={`brain-changed-${c.source_key}`}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginTop: 6 }}>Current Brain</div>
                        <p style={{ ...body, color: MUTED }}>{c.before.content}</p>
                        <div style={{ fontSize: 11, fontWeight: 600, color: TEAL, marginTop: 6 }}>Page now says</div>
                        <p style={body}>{c.content}</p>
                      </Card>
                    ))}
                  </section>
                )}

                {preview.retired.length > 0 && (
                  <section data-testid="brain-update-retired">
                    <div style={{ ...sectionTitle, color: MUTED }}>Retiring (no longer on this page)</div>
                    {preview.retired.map((c) => (
                      <Card key={c.source_key} title={c.title}><p style={{ ...body, color: MUTED }}>{c.content}</p></Card>
                    ))}
                  </section>
                )}

                {preview.unchanged.length > 0 && (
                  <section>
                    <button type="button" data-testid="brain-update-unchanged-toggle" onClick={() => setShowUnchanged((s) => !s)}
                      style={{ ...sectionTitle, border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: MUTED }}>
                      {showUnchanged ? '▾' : '▸'} {preview.unchanged.length} unchanged · no action needed
                    </button>
                    {showUnchanged && (
                      <ul data-testid="brain-update-unchanged" style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: MUTED }}>
                        {preview.unchanged.map((u) => <li key={u.source_key}>{u.title}</li>)}
                      </ul>
                    )}
                  </section>
                )}

                {preview.skipped.length > 0 && (
                  <p data-testid="brain-update-skipped" style={{ fontSize: 12, color: PINK, marginTop: 12 }}>
                    {plural(preview.skipped.length, 'item has', 'items have')} no name, so the Brain can't track {preview.skipped.length === 1 ? 'it' : 'them'}: {preview.skipped.map((s) => `${s.domain} #${s.index + 1}`).join(', ')}.
                  </p>
                )}

                {preview.legacy > 0 && (
                  <p data-testid="brain-update-legacy" style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>
                    {plural(preview.legacy, 'older Brain entry', 'older Brain entries')} from this source predate this sync (seeded or from the old Push to Brain). This update leaves {preview.legacy === 1 ? 'it' : 'them'} as {preview.legacy === 1 ? 'it is' : 'they are'}.
                  </p>
                )}

                <p style={{ fontSize: 11, color: MUTED, marginTop: 12 }}>
                  What this page sends: {preview.domains.join(', ')}. Never sent: icons, colors, numbering, or how the page is laid out.
                </p>

                {message && (
                  <p data-testid="brain-update-message" style={{ fontSize: 13, color: message.ok ? TEAL : PINK }}>{message.text}</p>
                )}

                <button
                  type="button" data-testid="brain-update-apply" disabled={busy || preview.pending === 0} onClick={apply}
                  style={{
                    marginTop: 8, width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700,
                    background: preview.pending === 0 ? '#e8e2d8' : TEAL, color: preview.pending === 0 ? MUTED : '#fff',
                    cursor: busy ? 'wait' : (preview.pending === 0 ? 'default' : 'pointer'),
                  }}
                >
                  {busy ? 'Updating…' : (preview.pending === 0 ? 'Brain Up to Date ✓' : 'Update Brain →')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function BrainUpdateElsewhere({ to, label }) {
  return (
    <Link
      to={to} data-testid="brain-update-elsewhere" title={`This page's data reaches the Brain from ${label}`}
      style={{
        padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, whiteSpace: 'nowrap', textDecoration: 'none',
        border: `1px solid ${MUTED}`, background: '#f4f1ec', color: MUTED,
      }}
    >
      🧠 Brain updates on {label} →
    </Link>
  );
}
