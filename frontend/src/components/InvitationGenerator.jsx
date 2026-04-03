import { useState } from 'react';
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
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState(event.invitation_url || null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState(null);

  const hasInvitation = !!imageUrl;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post(
        `/api/v1/world/${showId}/events/${event.id}/generate-invitation`
      );
      const url = res.data.data?.imageUrl;
      setImageUrl(url);
      setShowPreview(true);
      if (onGenerated) onGenerated(url, res.data.data?.assetId);
    } catch (err) {
      setError(err.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {showPreview && imageUrl && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }}
          onClick={() => setShowPreview(false)}
        >
          <div style={{
            background: '#FFF', borderRadius: 16, padding: 24,
            maxWidth: 480, width: '90%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#2C2C2C' }}>
              {event.name} — Invitation
            </h3>
            <img
              src={imageUrl}
              alt={`${event.name} invitation`}
              style={{
                width: '100%', maxHeight: 500,
                objectFit: 'contain', borderRadius: 8,
              }}
            />
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, textAlign: 'center',
                  background: '#FAF7F0', color: '#B8962E',
                  borderRadius: 8, padding: '8px 0',
                  fontSize: 13, fontWeight: 600,
                  textDecoration: 'none',
                  border: '1px solid #D4AF37',
                }}
              >
                Open full size
              </a>
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  flex: 1, background: '#FAF7F0', color: '#B8962E',
                  border: '1px solid #D4AF37', borderRadius: 8, padding: '8px 0',
                  fontSize: 13, cursor: generating ? 'not-allowed' : 'pointer',
                  opacity: generating ? 0.6 : 1,
                }}
              >
                {generating ? 'Generating...' : 'Regenerate'}
              </button>
              <button
                onClick={() => setShowPreview(false)}
                style={{
                  background: '#B8962E',
                  color: '#FFF', border: 'none',
                  borderRadius: 8, padding: '8px 16px',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {hasInvitation && (
          <button
            onClick={() => setShowPreview(true)}
            style={{
              background: '#FAF7F0', color: '#B8962E',
              border: '1px solid #D4AF37', borderRadius: 6,
              padding: '4px 10px', fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View
          </button>
        )}
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background: generating
              ? '#EEE'
              : hasInvitation
                ? '#FAF7F0'
                : '#B8962E',
            color: generating ? '#999' : hasInvitation ? '#B8962E' : '#FFF',
            border: hasInvitation ? '1px solid #D4AF37' : 'none',
            borderRadius: 6,
            padding: '4px 12px', fontSize: 11, fontWeight: 600,
            cursor: generating ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {generating
            ? 'Generating...'
            : hasInvitation
              ? 'Regenerate invite'
              : 'Generate Invite'}
        </button>
      </div>

      {error && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#FFEBEE', color: '#C62828',
          border: '1px solid #FFCDD2', borderRadius: 6,
          padding: '6px 10px', fontSize: 11, marginTop: 4,
          zIndex: 100,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ─── INVITATION STYLE FIELDS ──────────────────────────────────────────────────

export function InvitationStyleFields({ formData, setFormData }) {
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
          value={formData.mood || ''}
          onChange={e => setFormData(f => ({ ...f, mood: e.target.value }))}
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
