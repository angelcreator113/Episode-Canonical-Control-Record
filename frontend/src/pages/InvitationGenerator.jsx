import { useState, useEffect, useRef } from 'react';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Pencil, Mail, AlertCircle, ZoomIn, ExternalLink, X, Type, Image as ImageIcon, Download, History } from 'lucide-react';
import api from '../services/api';
import { openAuthedEventStream } from '../utils/authedEventStream';

// ─── THEME OPTIONS ────────────────────────────────────────────────────────────

export const THEME_OPTIONS = [
  { value: 'honey luxe',      label: 'Honey Luxe',       desc: 'Warm gold, honey tones, amber glow' },
  { value: 'soft glam',       label: 'Soft Glam',        desc: 'Blush pink, rose gold, romantic' },
  { value: 'avant-garde',     label: 'Avant-Garde',      desc: 'Bold, minimal, editorial black' },
  { value: 'romantic garden', label: 'Romantic Garden',   desc: 'Sage green, florals, garden party' },
  { value: 'luxury intimate', label: 'Luxury Intimate',   desc: 'Champagne, velvet, candlelit' },
  { value: 'formal glamour',  label: 'Formal Glamour',   desc: 'Pearl white, classical gold, orchids' },
  { value: 'chic minimal',    label: 'Chic Minimal',     desc: 'Pure cream, clean lines, no florals' },
  { value: 'power fashion',   label: 'Power Fashion',    desc: 'Black marble, bold serif, statement' },
];

export const FLORAL_OPTIONS = [
  { value: 'roses',    label: 'Roses' },
  { value: 'peonies',  label: 'Peonies' },
  { value: 'tropical', label: 'Tropical' },
  { value: 'minimal',  label: 'Minimal botanical' },
  { value: 'none',     label: 'No florals' },
];

export const BORDER_OPTIONS = [
  { value: 'gold_foil', label: 'Gold Foil' },
  { value: 'ornate',    label: 'Ornate Filigree' },
  { value: 'minimal',   label: 'Minimal line' },
  { value: 'none',      label: 'No border' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const coinList = (ns) => ns.map((n) => `${Number(n).toLocaleString('en-US')} Prime Coins`).join(', ');

/** What a version's words get wrong about the terms, in a sentence, or null. */
export function moneyNote(check) {
  if (!check || check.ok) return null;
  const parts = [];
  if (check.missing?.length) parts.push(`leave out ${coinList(check.missing)}`);
  if (check.invented?.length) parts.push(`name ${coinList(check.invented)}, which the terms don't`);
  return parts.length ? `These words ${parts.join(' and ')}.` : null;
}

/** The note a freshly made version carries, or null. */
export function versionNote(v) {
  if (!v) return null;
  if (v.textSource === 'fallback' || v.text_source === 'fallback') {
    return "Claude's draft didn't state the terms exactly, so this card uses the plain wording. Edit or re-roll the words if you like.";
  }
  return moneyNote(v.moneyCheck || v.money_check);
}

const KIND_LABELS = {
  generated: 'Generated', edited: 'Edited text', text_reroll: 'New words', background_reroll: 'New background',
};
const STATUS_LABELS = {
  current: 'current', superseded: 'superseded', approved: 'approved', pending_review: 'pending', rejected: 'rejected',
};

const errText = (err, fallback) => err?.response?.data?.error || err?.message || fallback;

// ─── INVITATION BUTTON COMPONENT ──────────────────────────────────────────────

export function InvitationButton({ event, showId, onGenerated, mode = 'modal', autoGenerate = false, approvalInfo = null, regenerateSignal = 0 }) {
  const [generating, setGenerating]   = useState(false);
  const [approving, setApproving]     = useState(false);
  const [imageUrl, setImageUrl]       = useState(event.invitation_url || null);
  const [pendingAssetId, setPendingAssetId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError]             = useState(null);
  const [modalTab, setModalTab]       = useState('preview');
  const [editText, setEditText]       = useState({ opening: '', body: '', closing: '' });
  const [rerendering, setRerendering] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [unlinking, setUnlinking]     = useState(false);
  const [toast, setToast]             = useState(null);
  const [versions, setVersions]       = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [showZoom, setShowZoom]       = useState(false);
  // 2026-10-24: progress from the invitation job, the variants of the last
  // run to choose from, the note on the version shown (money / plain
  // wording), and the generate options (variants, house style, this run's
  // style).
  const [progress, setProgress]       = useState(null);
  const [choices, setChoices]         = useState([]);
  const [notice, setNotice]           = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [options, setOptions]         = useState({ variants: 1, useBrandStyle: true, style: {} });
  const [estimate, setEstimate]       = useState(null);
  const lastAction = useRef('generate');
  const streamRef = useRef(null);

  // Escape closes the zoom lightbox, matching its click-away dismiss below.
  useEffect(() => {
    if (!showZoom) return;
    const onKey = (e) => { if (e.key === 'Escape') setShowZoom(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showZoom]);

  // A job stream never outlives the component.
  useEffect(() => () => { streamRef.current?.close(); streamRef.current = null; }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (event.invitation_url && !pendingAssetId) {
      setImageUrl(event.invitation_url);
    }
  }, [event.invitation_url]);

  const hasInvitation = !!event.invitation_asset_id;
  const isPending = !!pendingAssetId;
  const currentAssetId = pendingAssetId || event.invitation_asset_id;
  const busy = generating || rerendering;

  // none | generating | generated (pending approval) | approved — the four
  // states the Event Package page's Invitation section shows (Task #1654).
  const status = busy ? 'generating'
    : (hasInvitation && !isPending) ? 'approved'
    : (imageUrl || isPending) ? 'generated'
    : 'none';
  const statusLabel = {
    none: 'No invitation', generating: progress || 'Generating…',
    generated: 'Generated — needs approval', approved: 'Approved',
  }[status];

  const base = `/api/v1/world/${showId}/events/${event.id}`;

  // The slow actions run as a job (2026-10-24): the POST answers at once
  // with a job id and the page follows its progress on the job's stream, so
  // a long generate is never cut off mid-request. Resolves with the job's
  // result ({ versions: [...] }).
  const runJob = (path, body) => new Promise((resolve, reject) => {
    api.post(path, { ...body, async: true }).then((res) => {
      const jobId = res.data?.jobId;
      if (!jobId) { resolve(res.data?.data); return; }
      let settled = false;
      let stream = null;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        stream?.close();
        streamRef.current = null;
        fn(value);
      };
      const read = (e) => {
        try { return JSON.parse(e.data); } catch (err) {
          console.error('[InvitationButton] job frame did not parse:', err);
          return {};
        }
      };
      stream = openAuthedEventStream(`/api/v1/world/${showId}/invitation-jobs/${jobId}/stream`, {
        maxRetries: 3,
        handlers: {
          status: (e) => { const j = read(e); const last = j.steps?.[j.steps.length - 1]; if (last) setProgress(last.message); },
          progress: (e) => setProgress(read(e).message || null),
          done: (e) => finish(resolve, read(e).result),
          failed: (e) => { const j = read(e); finish(reject, Object.assign(new Error(j.error || 'Failed'), { status: j.errorStatus })); },
        },
        onAuthError: () => finish(reject, new Error('Your session has expired — sign in again.')),
        onError: (_err, { willRetry }) => {
          if (!willRetry) finish(reject, new Error('Lost touch with the invitation job. Open History: every finished version is saved there.'));
        },
      });
      streamRef.current = stream;
    }).catch(reject);
  });

  // Show what a run made: the first version, and the rest to choose from.
  const showResult = (result) => {
    const made = result?.versions || [];
    const first = made[0];
    if (!first) return;
    setImageUrl(first.imageUrl);
    setPendingAssetId(first.assetId);
    setChoices(made.length > 1 ? made : []);
    setNotice(versionNote(first));
    setModalTab('preview');
    setShowOptions(false);
    if (mode !== 'inline') setShowPreview(true);
    if (showHistory || modalTab === 'history') fetchVersions();
  };

  const runAction = async (action, path, body, failMessage) => {
    lastAction.current = action;
    setGenerating(true);
    setError(null);
    setProgress('Starting…');
    try {
      showResult(await runJob(path, body));
    } catch (err) {
      console.error(`[InvitationButton] ${action} failed:`, err);
      setError(errText(err, failMessage));
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  const handleGenerate = (opts = options) => runAction('generate', `${base}/generate-invitation`,
    { variants: opts.variants, style: opts.style, useBrandStyle: opts.useBrandStyle }, 'Generation failed');

  // New words on this version's background (no image call).
  const handleRerollText = (assetId = currentAssetId) => {
    if (!assetId) return;
    runAction('reroll-text', `${base}/reroll-invitation-text`, { assetId }, 'New words failed');
  };

  // A new background under this version's words (no text call).
  const handleRerollBackground = (assetId = currentAssetId) => {
    if (!assetId) return;
    runAction('reroll-background', `${base}/reroll-invitation-background`,
      { assetId, variants: options.variants, useBrandStyle: options.useBrandStyle }, 'New background failed');
  };

  // Auto-generate once for a just-created host event (Task #1654). Guarded
  // by a ref rather than only the `autoGenerate` prop, so a StrictMode
  // double-effect can't fire a second generate. The parent (EventPackagePage)
  // passes autoGenerate=true only for a one-time URL flag it clears
  // immediately, so a reload never re-triggers this.
  const autoGenAttempted = useRef(false);
  useEffect(() => {
    if (autoGenerate && !autoGenAttempted.current && !hasInvitation && !imageUrl) {
      autoGenAttempted.current = true;
      handleGenerate({ variants: 1, useBrandStyle: true, style: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate]);

  // Regenerate on request from the page (Reopen terms offer, Task #2378):
  // each increase of regenerateSignal after mount regenerates once. The
  // value at mount is only remembered, so a remount never regenerates.
  const lastRegenSignal = useRef(regenerateSignal);
  useEffect(() => {
    if (regenerateSignal === lastRegenSignal.current) return;
    lastRegenSignal.current = regenerateSignal;
    if (!generating) handleGenerate({ variants: 1, useBrandStyle: true, style: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenerateSignal]);

  // The generate options' estimate: cost and look, before anything is spent.
  useEffect(() => {
    if (!showOptions && modalTab !== 'generate') return undefined;
    let cancelled = false;
    api.post(`${base}/invitation-estimate`, { variants: options.variants, useBrandStyle: options.useBrandStyle, style: options.style })
      .then((res) => { if (!cancelled) setEstimate(res.data?.data || null); })
      .catch((err) => { console.error('[InvitationButton] estimate failed:', err); if (!cancelled) setEstimate(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOptions, modalTab, options.variants, options.useBrandStyle, options.style.theme, options.style.floral_style, options.style.border_style]);

  const openOptions = () => {
    if (mode === 'inline') { setShowOptions((v) => !v); return; }
    setModalTab('generate');
    setShowPreview(true);
  };

  const handleApprove = async () => {
    if (!pendingAssetId) return;
    setApproving(true);
    try {
      const res = await api.post(`${base}/approve-invitation`, { assetId: pendingAssetId });
      setPendingAssetId(null);
      setChoices([]);
      setNotice(null);
      setShowPreview(false);
      // approve-invitation's own response already carries episodeId and
      // placement_id (worldEvents.js approve-invitation) — no new endpoint needed.
      // Passed up via onGenerated rather than kept in local state: the
      // parent's own onGenerated handler here typically reloads the page
      // data, which (in EventPackagePage) unmounts and remounts this
      // component while loading — any state set here would be lost before
      // the next render. The parent owns it instead.
      const approvalDetail = { episodeId: res.data?.episodeId || null, placementId: res.data?.placement_id || null };
      if (onGenerated) onGenerated(imageUrl, pendingAssetId, approvalDetail);
      showToast('Invitation approved');
    } catch (err) {
      setError(errText(err, 'Approval failed'));
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!pendingAssetId) return;
    try {
      await api.post(`${base}/reject-invitation`, { assetId: pendingAssetId });
    } catch (err) {
      console.error('[InvitationButton] Reject failed:', err);
      setError(errText(err, 'Reject failed'));
      return;
    }
    const rest = choices.filter((c) => c.assetId !== pendingAssetId);
    setChoices(rest.length > 1 ? rest : []);
    if (rest.length) {
      setPendingAssetId(rest[0].assetId);
      setImageUrl(rest[0].imageUrl);
      setNotice(versionNote(rest[0]));
      return;
    }
    setPendingAssetId(null);
    setNotice(null);
    setImageUrl(event.invitation_url || null);
    setShowPreview(false);
  };

  // Saves her words on this version's background as a NEW pending version
  // via edit-invitation-text (2026-10-24: it used to overwrite the version
  // in place, approved or not). No AI call. The money check comes back and
  // is shown when the words no longer state the terms.
  const handleEditText = async () => {
    if (!currentAssetId) { setError('Generate an invitation first.'); return; }
    lastAction.current = 'edit';
    setRerendering(true);
    setError(null);
    try {
      const res = await api.post(`${base}/edit-invitation-text`, {
        assetId: currentAssetId,
        opening: editText.opening,
        body: editText.body,
        closing: editText.closing,
      });
      setImageUrl(res.data.imageUrl);
      setPendingAssetId(res.data.assetId);
      setChoices([]);
      setNotice(moneyNote(res.data.moneyCheck));
      setModalTab('preview');
      showToast('Saved as a new version — approve it to use it');
    } catch (err) {
      console.error('[InvitationButton] Edit text failed:', err);
      setError(errText(err, 'Edit failed'));
    } finally {
      setRerendering(false);
    }
  };

  // Retries whichever action last failed (Task #1654).
  const handleRetry = () => {
    const a = lastAction.current;
    if (a === 'edit') handleEditText();
    else if (a === 'reroll-text') handleRerollText();
    else if (a === 'reroll-background') handleRerollBackground();
    else handleGenerate();
  };

  // The shown version's own words for the edit box.
  const loadInvitationText = async () => {
    try {
      const res = await api.get(`${base}/invitation-text`, { params: currentAssetId ? { assetId: currentAssetId } : {} });
      if (res.data.invitation_text) {
        const t = res.data.invitation_text;
        setEditText({ opening: t.opening || '', body: t.body || '', closing: t.closing || '' });
      }
    } catch (err) {
      console.error('[InvitationButton] Loading the words failed:', err);
    }
  };

  const handleUnlink = async () => {
    if (!currentAssetId) return;
    if (!window.confirm('Remove this invitation from the episode Assets tab? It stays in the show library.')) return;
    setUnlinking(true);
    try {
      await api.post(`${base}/unlink-invitation`, { assetId: currentAssetId });
      showToast('Invitation unlinked from episode');
      setShowPreview(false);
      if (onGenerated) onGenerated(null, null);
    } catch (err) {
      setError(errText(err, 'Unlink failed'));
    } finally {
      setUnlinking(false);
    }
  };

  const handleDelete = async () => {
    if (!currentAssetId) return;
    if (!window.confirm('Delete this invitation permanently? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.delete(`${base}/invitation/${currentAssetId}`);
      setImageUrl(null);
      setPendingAssetId(null);
      setChoices([]);
      setNotice(null);
      setShowPreview(false);
      showToast('Invitation deleted');
      if (onGenerated) onGenerated(null, null);
    } catch (err) {
      setError(errText(err, 'Delete failed'));
    } finally {
      setDeleting(false);
    }
  };

  // The approved card at full quality, with its own words (a PNG).
  const handleDownloadPrint = async () => {
    try {
      const res = await api.get(`${base}/invitation-print`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(event.name || 'invitation').replace(/[^\w-]+/g, '-')}-invitation.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('[InvitationButton] Print download failed:', err);
      showToast(errText(err, 'Download failed'), 'error');
    }
  };

  const fetchVersions = async () => {
    setLoadingVersions(true);
    try {
      const res = await api.get(`${base}/invitation-history`);
      setVersions(res.data?.data || []);
    } catch (err) {
      console.error('[InvitationButton] History failed:', err);
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  // Show a version from history (or a variant) as the one to approve.
  const pickVersion = (v) => {
    const id = v.assetId || v.id;
    const url = v.imageUrl || v.image_url;
    setImageUrl(url);
    setNotice(versionNote(v));
    setPendingAssetId(id === event.invitation_asset_id ? null : id);
    setModalTab('preview');
  };

  const deleteVersion = async (assetId) => {
    if (!window.confirm('Delete this version permanently?')) return;
    try {
      await api.delete(`${base}/invitation/${assetId}`);
      setVersions(prev => prev.filter(v => v.id !== assetId));
      // If we deleted the current one, clear the preview
      if (assetId === event.invitation_asset_id) {
        setImageUrl(null);
        if (onGenerated) onGenerated(null, null);
      }
      if (assetId === pendingAssetId) { setPendingAssetId(null); setImageUrl(event.invitation_url || null); }
      showToast('Version deleted');
    } catch (err) {
      showToast(errText(err, 'Delete failed'), 'error');
    }
  };

  const btn = (bg, color, border) => ({ borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: border || 'none', background: bg, color });
  // Gold is an outline with gold text; the filled action is the primary (gold under white was 2.82:1).
  const goldBtn  = btn('var(--surface-bg)', 'var(--lala-gold-text)', '1px solid var(--lala-gold)');
  const goldFill = btn('var(--primary)', 'var(--text-inverse)');
  const greenBtn = btn('var(--success-text)', 'var(--text-inverse)');
  const redBtn   = btn('var(--surface-card)', 'var(--danger-text)', '1px solid var(--danger-border)');
  const grayBtn  = btn('var(--lala-parchment-2)', 'var(--text-secondary)', '1px solid var(--lala-parchment-3)');
  const smallBtn = { fontSize: 11, padding: '6px 10px' };

  // ── Shared pieces (both modes) ──────────────────────────────────────────────

  const noticeBox = notice && (
    <div data-testid="invitation-notice" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', borderRadius: 8, padding: '8px 12px', fontSize: 12, lineHeight: 1.5, margin: '8px 0' }}>
      {notice}
    </div>
  );

  // The variants of the last run: tap one to preview it, approve the one you like.
  const choicesStrip = choices.length > 1 && (
    <div data-testid="invitation-choices" style={{ margin: '8px 0' }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Pick one to preview, then approve it. The others stay in History.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {choices.map((c, i) => (
          <button key={c.assetId} type="button" onClick={() => pickVersion(c)} aria-label={`Variant ${i + 1}`} aria-pressed={c.assetId === pendingAssetId}
            style={{ padding: 0, background: 'none', cursor: 'pointer', borderRadius: 6, border: c.assetId === pendingAssetId ? '2px solid var(--lala-gold)' : '1px solid var(--lala-parchment-3)' }}>
            <img src={c.imageUrl} alt={`Variant ${i + 1}`} style={{ width: 64, height: 96, objectFit: 'cover', borderRadius: 5, display: 'block' }} />
          </button>
        ))}
      </div>
    </div>
  );

  const progressLine = busy && progress && (
    <div data-testid="invitation-progress" style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
      <Loader2 size={12} className="epp-spin-icon" /> {progress}
    </div>
  );

  const setStyle = (key, value) => setOptions((o) => ({ ...o, style: { ...o.style, [key]: value || undefined } }));
  const cost = estimate?.imagesUsd != null
    ? `About $${estimate.imagesUsd.toFixed(2)} for ${estimate.variants} background${estimate.variants > 1 ? 's' : ''}, plus a small text call.`
    : 'The image price is not in the rate table; the call is still budget-gated.';

  // Generate options: how many backgrounds, the host's house style, and
  // this run's style, with the look and the cost shown before anything is spent.
  const optionsPanel = (
    <div data-testid="invitation-options" style={{ border: '1px solid var(--lala-parchment-3)', borderRadius: 10, padding: 14, margin: '8px 0', background: 'var(--surface-card)' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 4 }}>Backgrounds to choose from</span>
        {[1, 2, 3].map((n) => (
          <button key={n} type="button" onClick={() => setOptions((o) => ({ ...o, variants: n }))} aria-pressed={options.variants === n}
            style={{ ...(options.variants === n ? goldFill : grayBtn), ...smallBtn, minWidth: 36 }}>{n}</button>
        ))}
      </div>
      {estimate?.brandReferenceAvailable && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text-primary)', marginBottom: 10 }}>
          <input type="checkbox" checked={options.useBrandStyle} onChange={(e) => setOptions((o) => ({ ...o, useBrandStyle: e.target.checked }))} />
          Match {event.host_brand || 'the host'}&apos;s house style (from their last approved invitation)
        </label>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
          <label style={labelStyle}>Theme (this run)</label>
          <select value={options.style.theme || ''} onChange={(e) => setStyle('theme', e.target.value)} style={selectStyle}>
            <option value="">Event&apos;s own{estimate?.style?.theme ? ` (${estimate.style.theme})` : ' (auto)'}</option>
            {THEME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 110px', minWidth: 0 }}>
          <label style={labelStyle}>Florals</label>
          <select value={options.style.floral_style || ''} onChange={(e) => setStyle('floral_style', e.target.value)} style={selectStyle}>
            <option value="">Event&apos;s own</option>
            {FLORAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 110px', minWidth: 0 }}>
          <label style={labelStyle}>Border</label>
          <select value={options.style.border_style || ''} onChange={(e) => setStyle('border_style', e.target.value)} style={selectStyle}>
            <option value="">Event&apos;s own</option>
            {BORDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {estimate && (
        <div data-testid="invitation-estimate" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
          <div>Look: {estimate.direction.theme === 'default' ? 'classic cream and gold' : estimate.direction.theme} ({estimate.direction.themeSource}){estimate.direction.palette?.length ? ` · ${estimate.direction.palette.join(', ')}` : ''}</div>
          <div>{cost}</div>
          {!estimate.provider?.ready && <div style={{ color: 'var(--danger-text)' }}>{estimate.provider?.missing} is not set on the server, so generating will fail.</div>}
          <div>These choices apply to this run only; the event&apos;s own style is set in its Invitation Style fields.</div>
        </div>
      )}
      <button type="button" onClick={() => handleGenerate()} disabled={generating} data-testid="invitation-generate-go"
        style={{ ...goldFill, width: '100%', opacity: generating ? 0.6 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}>
        {generating ? (progress || 'Generating…') : 'Generate'}
      </button>
    </div>
  );

  const renderHistory = () => (
    <div data-testid="invitation-history">
      {loadingVersions && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Loading versions...</p>}
      {!loadingVersions && versions.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No versions found.</p>}
      {versions.map((v, i) => {
        const isCurrent = v.id === event.invitation_asset_id;
        const note = versionNote(v);
        return (
          <div key={v.id} style={{
            display: 'flex', gap: 12, padding: '10px 0',
            borderBottom: i < versions.length - 1 ? '1px solid var(--lala-parchment-3)' : 'none',
            opacity: isCurrent ? 1 : 0.8,
          }}>
            <img src={v.image_url} alt={`v${v.version}`}
              style={{ width: 60, height: 90, objectFit: 'cover', borderRadius: 6, border: isCurrent ? '2px solid var(--lala-gold)' : '1px solid var(--lala-parchment-3)', cursor: 'pointer' }}
              onClick={() => pickVersion(v)}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Version {v.version || versions.length - i}
                {isCurrent && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 4, fontWeight: 700 }}>CURRENT</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {v.kind && <span style={{ marginRight: 8 }}>{KIND_LABELS[v.kind] || v.kind}</span>}
                {v.theme && <span style={{ marginRight: 8 }}>{v.theme}</span>}
                {!isCurrent && <span>{STATUS_LABELS[v.status] || v.approval_status}</span>}
                {v.brand_reference && <span style={{ marginLeft: 6 }}>house style</span>}
              </div>
              {note && <div style={{ fontSize: 11, color: 'var(--warning-text)', marginTop: 2 }}><AlertCircle size={10} /> {note}</div>}
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                {new Date(v.created_at).toLocaleDateString()} {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
              <a href={v.image_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 10, color: 'var(--lala-gold-text)', textDecoration: 'none', fontWeight: 600 }}>Open</a>
              {!isCurrent && (
                <button onClick={() => pickVersion(v)}
                  style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--lala-gold-text)', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                  Use
                </button>
              )}
              {!isCurrent && (
                <button onClick={() => deleteVersion(v.id)}
                  style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--danger-text)', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                  Delete
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Inline mode (Task #1654): the Event Package page's Invitation section
  // embeds this same component and its same handlers/endpoints, but renders
  // the preview/edit/actions directly in the page instead of behind the
  // fixed-position backdrop modal below — a just-created event's automatic
  // generation must not cover the rest of the page while it runs.
  if (mode === 'inline') {
    return (
      <div className="epp-invitation-inline">
        {toast && (
          <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 10000, background: toast.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)', color: toast.type === 'error' ? 'var(--danger-text)' : 'var(--success-text)', border: `1px solid ${toast.type === 'error' ? 'var(--danger-border)' : 'var(--success-border)'}`, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
            {toast.msg}
          </div>
        )}

        <div className="epp-invitation-status-row">
          <span className={`epp-invitation-status epp-invitation-status-${status}`}>
            {status === 'generating' && <Loader2 size={12} className="epp-spin-icon" />}
            {status === 'approved' && <CheckCircle2 size={12} />}
            {statusLabel}
          </span>
          {status === 'approved' && (
            <span className="epp-invitation-approval-detail">
              Linked to event.
              {approvalInfo?.placementId && ' Placed on the episode’s timeline.'}
            </span>
          )}
          {(imageUrl || hasInvitation) && !busy && (
            <div className="epp-invitation-actions-inline">
              <button
                type="button" className="epp-icon-btn" title="Edit text" aria-label="Edit text"
                onClick={() => { const opening = modalTab !== 'edit'; setModalTab(opening ? 'edit' : 'preview'); if (opening) loadInvitationText(); }}
              >
                <Pencil size={14} />
              </button>
              <button type="button" className="epp-icon-btn" title="New words, same background" aria-label="New words, same background" onClick={() => handleRerollText()}>
                <Type size={14} />
              </button>
              <button type="button" className="epp-icon-btn" title="New background, same words" aria-label="New background, same words" onClick={() => handleRerollBackground()}>
                <ImageIcon size={14} />
              </button>
              <button type="button" className="epp-icon-btn" title="Regenerate (options)" aria-label="Regenerate" onClick={openOptions}>
                <RefreshCw size={14} />
              </button>
              <button type="button" className="epp-icon-btn" title="History" aria-label="History" aria-pressed={showHistory}
                onClick={() => { const next = !showHistory; setShowHistory(next); if (next) fetchVersions(); }}>
                <History size={14} />
              </button>
              {hasInvitation && !isPending && (
                <button type="button" className="epp-icon-btn" title="Download print-ready PNG" aria-label="Download print-ready PNG" onClick={handleDownloadPrint}>
                  <Download size={14} />
                </button>
              )}
              {isPending && (
                <>
                  <button type="button" className="epp-icon-btn" title="Approve" aria-label="Approve" onClick={handleApprove} disabled={approving}>
                    <CheckCircle2 size={14} />
                  </button>
                  <button type="button" className="epp-icon-btn" title="Reject" aria-label="Reject" onClick={handleReject}>
                    <XCircle size={14} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {busy && !imageUrl && (
          <div className="epp-invitation-generating">
            <Loader2 size={14} className="epp-spin-icon" /> {progress || 'Generating invitation…'}
          </div>
        )}
        {imageUrl && progressLine}

        {error && (
          <div className="epp-invitation-error">
            <AlertCircle size={13} /> <span>{error}</span>
            <button type="button" className="epp-invitation-retry" onClick={handleRetry} disabled={busy}>Retry</button>
          </div>
        )}

        {noticeBox}
        {choicesStrip}

        {imageUrl && (
          <div className="epp-invitation-preview-wrap">
            <img
              className="epp-invitation-preview" src={imageUrl} alt="Invitation preview"
              onClick={() => setShowZoom(true)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowZoom(true); } }}
              title="Click to view full size"
            />
            <div className="epp-invitation-preview-actions">
              <button type="button" className="epp-icon-btn" title="View full size" onClick={() => setShowZoom(true)}>
                <ZoomIn size={13} />
              </button>
              <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="epp-icon-btn" title="Open in new tab">
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        )}

        {showZoom && imageUrl && (
          <div className="epp-invitation-zoom-backdrop" onClick={() => setShowZoom(false)}>
            <div className="epp-invitation-zoom-frame" onClick={(e) => e.stopPropagation()}>
              <div className="epp-invitation-zoom-toolbar">
                <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="epp-icon-btn" title="Open in new tab">
                  <ExternalLink size={16} />
                </a>
                <button type="button" className="epp-icon-btn" title="Close" onClick={() => setShowZoom(false)}>
                  <X size={16} />
                </button>
              </div>
              <img className="epp-invitation-zoom-image" src={imageUrl} alt="Invitation, full size" />
            </div>
          </div>
        )}

        {!imageUrl && !hasInvitation && !busy && !showOptions && (
          <button type="button" className="epp-btn epp-btn-small" onClick={openOptions}>
            <Mail size={14} /> Generate Invitation
          </button>
        )}

        {showOptions && !busy && optionsPanel}

        {modalTab === 'edit' && (imageUrl || hasInvitation) && (
          <div className="epp-invitation-edit">
            {[
              { key: 'opening', label: 'Opening Line', rows: 2 },
              { key: 'body', label: 'Body', rows: 4 },
              { key: 'closing', label: 'Closing Line', rows: 2 },
            ].map((field) => (
              <div key={field.key} className="epp-invitation-edit-field">
                <label>{field.label}</label>
                <textarea
                  value={editText[field.key]}
                  onChange={(e) => setEditText((t) => ({ ...t, [field.key]: e.target.value }))}
                  rows={field.rows}
                />
              </div>
            ))}
            <button type="button" className="epp-btn epp-btn-primary epp-btn-small" onClick={handleEditText} disabled={rerendering}>
              {rerendering ? 'Saving…' : 'Save as new version'}
            </button>
          </div>
        )}

        {showHistory && renderHistory()}
      </div>
    );
  }

  const tabs = [
    ...(imageUrl ? [{ key: 'preview', label: 'Preview' }, { key: 'edit', label: 'Edit Text' }] : []),
    { key: 'history', label: 'History' },
    { key: 'generate', label: 'Generate' },
  ];

  return (
    <div style={{ position: 'relative' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 10000, background: toast.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)', color: toast.type === 'error' ? 'var(--danger-text)' : 'var(--success-text)', border: `1px solid ${toast.type === 'error' ? 'var(--danger-border)' : 'var(--success-border)'}`, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
          {toast.msg}
        </div>
      )}

      {showPreview && (imageUrl || modalTab === 'generate' || modalTab === 'history') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }} onClick={() => setShowPreview(false)}>
          <div style={{ background: 'var(--surface-bg)', borderRadius: 18, width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '18px 22px 0', borderBottom: '1px solid var(--lala-gold-line)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{event.name}</h3>
                <button onClick={() => setShowPreview(false)} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-secondary)', cursor: 'pointer' }}>x</button>
              </div>
              {isPending && (
                <div style={{ padding: '4px 12px', background: 'var(--warning-bg)', color: 'var(--warning-text)', borderRadius: 8, fontSize: 11, fontWeight: 600, marginBottom: 10, display: 'inline-block' }}>Pending your approval</div>
              )}
              <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
                {tabs.map(tab => (
                  <button key={tab.key} onClick={() => { setModalTab(tab.key); if (tab.key === 'history') fetchVersions(); if (tab.key === 'edit') loadInvitationText(); }}
                    style={{ background: 'none', border: 'none', borderBottom: modalTab === tab.key ? '2px solid var(--lala-gold)' : '2px solid transparent', padding: '6px 14px', fontSize: 13, fontWeight: modalTab === tab.key ? 700 : 400, color: modalTab === tab.key ? 'var(--lala-gold-text)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
              {progressLine}
              {error && modalTab !== 'edit' && (
                <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>{error}</span>
                  <button onClick={handleRetry} disabled={busy} style={{ ...redBtn, ...smallBtn }}>Retry</button>
                </div>
              )}
              {modalTab === 'preview' && imageUrl && (
                <>
                  {noticeBox}
                  {choicesStrip}
                  <img src={imageUrl} alt={`${event.name} invitation`} style={{ width: '100%', maxHeight: 460, objectFit: 'contain', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }} />
                </>
              )}
              {modalTab === 'edit' && (
                <div>
                  <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Edit the words; they are set on this card&apos;s background as a new version for your approval. No AI call — fast and free.</p>
                  {[
                    { key: 'opening', label: 'Opening Line', placeholder: 'e.g. You have been chosen for something rare.', rows: 2 },
                    { key: 'body', label: 'Body', placeholder: 'The main invitation prose — location, dress code, cost woven together...', rows: 5 },
                    { key: 'closing', label: 'Closing Line', placeholder: 'e.g. We look forward to your presence.', rows: 2 },
                  ].map(field => (
                    <div key={field.key} style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--lala-gold-text)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>{field.label}</label>
                      <textarea value={editText[field.key]} onChange={e => setEditText(t => ({ ...t, [field.key]: e.target.value }))} placeholder={field.placeholder} rows={field.rows}
                        style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box', border: '1px solid var(--lala-gold)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: 'var(--surface-card)', lineHeight: 1.6 }} />
                    </div>
                  ))}
                  {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>{error}</div>}
                  <button onClick={handleEditText} disabled={rerendering} style={{ ...goldFill, width: '100%', padding: '10px 0', opacity: rerendering ? 0.6 : 1, cursor: rerendering ? 'not-allowed' : 'pointer' }}>
                    {rerendering ? 'Saving...' : 'Save as New Version'}
                  </button>
                </div>
              )}
              {modalTab === 'history' && renderHistory()}
              {modalTab === 'generate' && optionsPanel}
            </div>

            {/* Footer */}
            {imageUrl && modalTab !== 'generate' && (
              <div style={{ padding: '12px 22px', borderTop: '1px solid var(--lala-gold-line)', background: 'var(--surface-bg)' }}>
                {isPending ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={handleReject} style={{ ...redBtn, flex: '1 1 70px' }}>Reject</button>
                    <button onClick={() => handleRerollText()} disabled={busy} title="New words, same background" style={{ ...grayBtn, flex: '1 1 90px', opacity: busy ? 0.6 : 1 }}>New words</button>
                    <button onClick={() => handleRerollBackground()} disabled={busy} title="New background, same words" style={{ ...grayBtn, flex: '1 1 110px', opacity: busy ? 0.6 : 1 }}>New background</button>
                    <button onClick={handleApprove} disabled={approving || busy} style={{ ...greenBtn, flex: '2 1 140px', opacity: approving ? 0.6 : 1 }}>{approving ? 'Approving...' : 'Approve Invitation'}</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={handleUnlink} disabled={unlinking} title="Remove from episode Assets tab" style={{ ...grayBtn, ...smallBtn, opacity: unlinking ? 0.6 : 1 }}>{unlinking ? '...' : 'Unlink'}</button>
                      <button onClick={handleDelete} disabled={deleting} title="Delete permanently" style={{ ...redBtn, ...smallBtn, opacity: deleting ? 0.6 : 1 }}>{deleting ? '...' : 'Delete'}</button>
                      <button onClick={handleDownloadPrint} title="Download the print-ready PNG" style={{ ...grayBtn, ...smallBtn }}>Print PNG</button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => handleRerollText()} disabled={busy} title="New words, same background" style={{ ...grayBtn, ...smallBtn, opacity: busy ? 0.6 : 1 }}>New words</button>
                      <button onClick={() => handleRerollBackground()} disabled={busy} title="New background, same words" style={{ ...grayBtn, ...smallBtn, opacity: busy ? 0.6 : 1 }}>New background</button>
                      <button onClick={() => setShowPreview(false)} style={{ ...goldFill, padding: '6px 18px' }}>Done</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {(hasInvitation || imageUrl) && <button onClick={() => { setModalTab('preview'); setShowPreview(true); }} style={goldBtn}>View</button>}
        <button onClick={openOptions} disabled={generating} style={{ ...((hasInvitation || imageUrl) ? goldBtn : goldFill), opacity: generating ? 0.6 : 1, cursor: generating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
          {generating ? (progress || 'Generating...') : (hasInvitation || imageUrl) ? 'Regenerate' : 'Generate Invite'}
        </button>
      </div>

      {error && !showPreview && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--danger-bg)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)', borderRadius: 6, padding: '6px 10px', fontSize: 11, marginTop: 4, zIndex: 100 }}>{error}</div>
      )}
    </div>
  );
}

// ─── INVITATION STYLE FIELDS ──────────────────────────────────────────────────

export function InvitationStyleFields({ formData, setFormData }) {
  // Local state for text inputs — prevents parent re-renders from destroying
  // mid-typing state. Only pushes to parent on blur.
  // (The detail modal uses an IIFE that remounts children on every md change,
  //  so any setFormData call that triggers a server save will reset child state.)
  const [moodText, setMoodText] = useState(formData.mood || '');
  const [colorText, setColorText] = useState((formData.color_palette || []).join(', '));
  return (
    <div style={{
      border: '1px solid var(--lala-gold)', borderRadius: 10,
      padding: '16px', marginTop: 12,
      background: 'var(--surface-bg)',
    }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--lala-gold-text)' }}>
        Invitation Style
      </h4>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--text-secondary)' }}>
        These fields shape the invitation's visual personality. Each event gets its own look.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Theme</label>
        <select
          value={formData.theme || ''}
          onChange={e => setFormData(f => ({ ...f, theme: e.target.value }))}
          style={selectStyle}
        >
          <option value="">Auto (based on dress code)</option>
          {THEME_OPTIONS.map(t => (
            <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Mood</label>
        <input
          type="text"
          placeholder="e.g. intimate, aspirational, electric, mysterious"
          value={moodText}
          onChange={e => setMoodText(e.target.value)}
          onBlur={e => setFormData(f => ({ ...f, mood: e.target.value }))}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Color Palette (comma-separated)</label>
        <input
          type="text"
          placeholder="e.g. blush, champagne, honey gold"
          value={colorText}
          onChange={e => setColorText(e.target.value)}
          onBlur={e => {
            const colors = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            setColorText(colors.join(', '));
            setFormData(f => ({ ...f, color_palette: colors }));
          }}
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Floral Style</label>
          <select
            value={formData.floral_style || ''}
            onChange={e => setFormData(f => ({ ...f, floral_style: e.target.value }))}
            style={selectStyle}
          >
            <option value="">Auto</option>
            {FLORAL_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Border Style</label>
          <select
            value={formData.border_style || ''}
            onChange={e => setFormData(f => ({ ...f, border_style: e.target.value }))}
            style={selectStyle}
          >
            <option value="">Auto</option>
            {BORDER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
  display: 'block', marginBottom: 4,
};

const inputStyle = {
  width: '100%', padding: '7px 10px',
  border: '1px solid var(--lala-parchment-3)', borderRadius: 7,
  fontSize: 12, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
  background: 'var(--surface-bg)',
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
};
