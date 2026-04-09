import { useState, useEffect } from 'react';
import api from '../services/api';

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

// ─── INVITATION BUTTON COMPONENT ──────────────────────────────────────────────

export function InvitationButton({ event, showId, onGenerated }) {
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

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${event.id}/generate-invitation`);
      setImageUrl(res.data.data?.imageUrl);
      setPendingAssetId(res.data.data?.assetId);
      setModalTab('preview');
      setShowPreview(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!pendingAssetId) return;
    setApproving(true);
    try {
      await api.post(`/api/v1/world/${showId}/events/${event.id}/approve-invitation`, { assetId: pendingAssetId });
      setPendingAssetId(null);
      setShowPreview(false);
      if (onGenerated) onGenerated(imageUrl, pendingAssetId);
      showToast('Invitation approved');
    } catch (err) {
      setError(err.response?.data?.error || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!pendingAssetId) return;
    try { await api.post(`/api/v1/world/${showId}/events/${event.id}/reject-invitation`, { assetId: pendingAssetId }); } catch {}
    setPendingAssetId(null);
    setImageUrl(event.invitation_url || null);
    setShowPreview(false);
  };

  const handleRerender = async () => {
    setRerendering(true);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${event.id}/re-render-invitation`, { invitation_text: editText });
      setImageUrl(res.data.imageUrl);
      setModalTab('preview');
      showToast('Invitation re-rendered with your text');
    } catch (err) {
      setError(err.response?.data?.error || 'Re-render failed');
    } finally {
      setRerendering(false);
    }
  };

  // Load existing invitation text when edit tab opens
  const loadInvitationText = async () => {
    try {
      const res = await api.get(`/api/v1/world/${showId}/events/${event.id}/invitation-text`);
      if (res.data.invitation_text) {
        setEditText(res.data.invitation_text);
      }
    } catch { /* use defaults */ }
  };

  const handleUnlink = async () => {
    if (!currentAssetId) return;
    if (!window.confirm('Remove this invitation from the episode Assets tab? It stays in the show library.')) return;
    setUnlinking(true);
    try {
      await api.post(`/api/v1/world/${showId}/events/${event.id}/unlink-invitation`, { assetId: currentAssetId });
      showToast('Invitation unlinked from episode');
      setShowPreview(false);
      if (onGenerated) onGenerated(null, null);
    } catch (err) {
      setError(err.response?.data?.error || 'Unlink failed');
    } finally {
      setUnlinking(false);
    }
  };

  const handleDelete = async () => {
    if (!currentAssetId) return;
    if (!window.confirm('Delete this invitation permanently? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/world/${showId}/events/${event.id}/invitation/${currentAssetId}`);
      setImageUrl(null);
      setPendingAssetId(null);
      setShowPreview(false);
      showToast('Invitation deleted');
      if (onGenerated) onGenerated(null, null);
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const fetchVersions = async () => {
    setLoadingVersions(true);
    try {
      const res = await api.get(`/api/v1/world/${showId}/events/${event.id}/invitation-history`);
      setVersions(res.data?.data || []);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const deleteVersion = async (assetId) => {
    if (!window.confirm('Delete this version permanently?')) return;
    try {
      await api.delete(`/api/v1/world/${showId}/events/${event.id}/invitation/${assetId}`);
      setVersions(prev => prev.filter(v => v.id !== assetId));
      // If we deleted the current one, clear the preview
      if (assetId === event.invitation_asset_id) {
        setImageUrl(null);
        if (onGenerated) onGenerated(null, null);
      }
      showToast('Version deleted');
    } catch (err) {
      showToast(err.response?.data?.error || 'Delete failed', 'error');
    }
  };

  const btn = (bg, color, border) => ({ borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: border || 'none', background: bg, color });
  const goldBtn  = btn('#FAF7F0', '#B8962E', '1px solid #D4AF37');
  const goldFill = btn('#B8962E', '#FFF');
  const greenBtn = btn('#16a34a', '#FFF');
  const redBtn   = btn('#FFF', '#DC2626', '1px solid #FECACA');
  const grayBtn  = btn('#F5F5F5', '#666', '1px solid #EEE');

  return (
    <div style={{ position: 'relative' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 10000, background: toast.type === 'error' ? '#FFEBEE' : '#E8F5E9', color: toast.type === 'error' ? '#C62828' : '#1A7A40', border: `1px solid ${toast.type === 'error' ? '#FFCDD2' : '#A5D6A7'}`, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
          {toast.msg}
        </div>
      )}

      {showPreview && imageUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }} onClick={() => setShowPreview(false)}>
          <div style={{ background: '#FAF7F0', borderRadius: 18, width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '18px 22px 0', borderBottom: '1px solid rgba(184,150,46,0.2)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1A1A1A' }}>{event.name}</h3>
                <button onClick={() => setShowPreview(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#999', cursor: 'pointer' }}>x</button>
              </div>
              {isPending && (
                <div style={{ padding: '4px 12px', background: '#FEF3C7', color: '#92400E', borderRadius: 8, fontSize: 11, fontWeight: 600, marginBottom: 10, display: 'inline-block' }}>Pending your approval</div>
              )}
              <div style={{ display: 'flex', gap: 0 }}>
                {[{ key: 'preview', label: 'Preview' }, { key: 'edit', label: 'Edit Text' }, { key: 'history', label: 'History' }].map(tab => (
                  <button key={tab.key} onClick={() => { setModalTab(tab.key); if (tab.key === 'history') fetchVersions(); if (tab.key === 'edit') loadInvitationText(); }}
                    style={{ background: 'none', border: 'none', borderBottom: modalTab === tab.key ? '2px solid #B8962E' : '2px solid transparent', padding: '6px 16px', fontSize: 13, fontWeight: modalTab === tab.key ? 700 : 400, color: modalTab === tab.key ? '#B8962E' : '#888', cursor: 'pointer' }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
              {modalTab === 'preview' && (
                <img src={imageUrl} alt={`${event.name} invitation`} style={{ width: '100%', maxHeight: 460, objectFit: 'contain', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }} />
              )}
              {modalTab === 'edit' && (
                <div>
                  <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888', lineHeight: 1.5 }}>Edit the text, then re-render. No DALL-E call — fast and free.</p>
                  {[
                    { key: 'opening', label: 'Opening Line', placeholder: 'e.g. You have been chosen for something rare.', rows: 2 },
                    { key: 'body', label: 'Body', placeholder: 'The main invitation prose — location, dress code, cost woven together...', rows: 5 },
                    { key: 'closing', label: 'Closing Line', placeholder: 'e.g. We look forward to your presence.', rows: 2 },
                  ].map(field => (
                    <div key={field.key} style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#B8962E', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>{field.label}</label>
                      <textarea value={editText[field.key]} onChange={e => setEditText(t => ({ ...t, [field.key]: e.target.value }))} placeholder={field.placeholder} rows={field.rows}
                        style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box', border: '1px solid #D4AF37', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: '#FFF', lineHeight: 1.6 }} />
                    </div>
                  ))}
                  {error && <div style={{ background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>{error}</div>}
                  <button onClick={handleRerender} disabled={rerendering} style={{ ...goldFill, width: '100%', padding: '10px 0', opacity: rerendering ? 0.6 : 1, cursor: rerendering ? 'not-allowed' : 'pointer' }}>
                    {rerendering ? 'Re-rendering...' : 'Re-render Invitation'}
                  </button>
                </div>
              )}
              {modalTab === 'history' && (
                <div>
                  {loadingVersions && <p style={{ fontSize: 12, color: '#888' }}>Loading versions...</p>}
                  {!loadingVersions && versions.length === 0 && <p style={{ fontSize: 12, color: '#888' }}>No versions found.</p>}
                  {versions.map((v, i) => {
                    const isCurrent = v.id === event.invitation_asset_id;
                    return (
                      <div key={v.id} style={{
                        display: 'flex', gap: 12, padding: '10px 0',
                        borderBottom: i < versions.length - 1 ? '1px solid #F0EDE6' : 'none',
                        opacity: isCurrent ? 1 : 0.8,
                      }}>
                        <img src={v.image_url} alt={`v${v.version}`}
                          style={{ width: 60, height: 90, objectFit: 'cover', borderRadius: 6, border: isCurrent ? '2px solid #B8962E' : '1px solid #EEE', cursor: 'pointer' }}
                          onClick={() => { setImageUrl(v.image_url); setModalTab('preview'); }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                            Version {v.version || i + 1}
                            {isCurrent && <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', background: '#E8F5E9', color: '#16a34a', borderRadius: 4, fontWeight: 700 }}>CURRENT</span>}
                          </div>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                            {v.theme && <span style={{ marginRight: 8 }}>{v.theme}</span>}
                            <span>{v.approval_status}</span>
                            {v.composited === 'true' && <span style={{ marginLeft: 6, color: '#16a34a' }}>composited</span>}
                          </div>
                          <div style={{ fontSize: 10, color: '#AAA', marginTop: 2 }}>
                            {new Date(v.created_at).toLocaleDateString()} {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
                          <a href={v.image_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 10, color: '#B8962E', textDecoration: 'none', fontWeight: 600 }}>Open</a>
                          {!isCurrent && (
                            <button onClick={() => deleteVersion(v.id)}
                              style={{ background: 'none', border: 'none', fontSize: 10, color: '#DC2626', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 22px', borderTop: '1px solid rgba(184,150,46,0.15)', background: '#FAF7F0' }}>
              {isPending ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleReject} style={{ ...redBtn, flex: 1 }}>Reject</button>
                  <button onClick={handleGenerate} disabled={generating} style={{ ...grayBtn, flex: 1, opacity: generating ? 0.6 : 1 }}>{generating ? '...' : 'Regenerate'}</button>
                  <button onClick={handleApprove} disabled={approving} style={{ ...greenBtn, flex: 2, opacity: approving ? 0.6 : 1 }}>{approving ? 'Approving...' : 'Approve Invitation'}</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={handleUnlink} disabled={unlinking} title="Remove from episode Assets tab" style={{ ...grayBtn, fontSize: 11, padding: '6px 10px', opacity: unlinking ? 0.6 : 1 }}>{unlinking ? '...' : 'Unlink'}</button>
                    <button onClick={handleDelete} disabled={deleting} title="Delete permanently" style={{ ...redBtn, fontSize: 11, padding: '6px 10px', opacity: deleting ? 0.6 : 1 }}>{deleting ? '...' : 'Delete'}</button>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={handleGenerate} disabled={generating} style={{ ...grayBtn, fontSize: 11, padding: '6px 10px', opacity: generating ? 0.6 : 1 }}>{generating ? '...' : 'Regenerate'}</button>
                    <button onClick={() => setShowPreview(false)} style={{ ...goldFill, padding: '6px 18px' }}>Done</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {(hasInvitation || imageUrl) && <button onClick={() => { setModalTab('preview'); setShowPreview(true); }} style={goldBtn}>View</button>}
        <button onClick={handleGenerate} disabled={generating} style={{ ...((hasInvitation || imageUrl) ? goldBtn : goldFill), opacity: generating ? 0.6 : 1, cursor: generating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
          {generating ? 'Generating...' : (hasInvitation || imageUrl) ? 'Regenerate' : 'Generate Invite'}
        </button>
      </div>

      {error && !showPreview && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2', borderRadius: 6, padding: '6px 10px', fontSize: 11, marginTop: 4, zIndex: 100 }}>{error}</div>
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
      border: '1px solid #D4AF37', borderRadius: 10,
      padding: '16px', marginTop: 12,
      background: '#FDFBF5',
    }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#B8962E' }}>
        Invitation Style
      </h4>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: '#888' }}>
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
  fontSize: 11, fontWeight: 600, color: '#666',
  display: 'block', marginBottom: 4,
};

const inputStyle = {
  width: '100%', padding: '7px 10px',
  border: '1px solid #e0ddd5', borderRadius: 7,
  fontSize: 12, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
  background: '#FAFAFA',
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
};
