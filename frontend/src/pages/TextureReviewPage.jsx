// pages/TextureReviewPage.jsx

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import './WorldStudio.css';

const API = '/api/v1';

// ─── Track 6 CP9 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 3 helpers covering 5 fetch sites on /texture-layer/* (getTextureLayerApi
// covers 2 sites — initial load + post-regenerate refetch;
// confirmTextureLayerApi covers 2 sites — single-layer + all variants).
export const getTextureLayerApi = (characterKey, storyNumber) =>
  apiClient.get(`${API}/texture-layer/${characterKey}/${storyNumber}`);
export const confirmTextureLayerApi = (storyNumber, payload) =>
  apiClient.post(`${API}/texture-layer/confirm/${storyNumber}`, payload);
export const regenerateTextureLayerApi = (storyNumber, layer, payload) =>
  apiClient.post(`${API}/texture-layer/regenerate/${storyNumber}/${layer}`, payload);

const LAYER_LABELS = {
  inner_thought:  'Inner Thought',
  conflict:       'Conflict Scene',
  body_narrator:  'Body Narrator',
  private_moment: 'Private Moment',
  post:           'Online Self Post',
  bleed:          'The Bleed',
};

const LAYER_COLORS = {
  inner_thought:  '#a889c8',
  conflict:       '#d4789a',
  body_narrator:  '#7ab3d4',
  private_moment: '#a889c8',
  post:           '#7ab3d4',
  bleed:          '#d4789a',
};

export default function TextureReviewPage() {
  const { storyNumber }        = useParams();
  const [searchParams]         = useSearchParams();
  const characterKey           = searchParams.get('char');
  const navigate               = useNavigate();

  const [texture, setTexture]  = useState(null);
  const [loading, setLoading]  = useState(true);
  const [saving, setSaving]    = useState(false);

  useEffect(() => {
    getTextureLayerApi(characterKey, storyNumber)
      .then(res => { setTexture(res.data?.texture || null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [characterKey, storyNumber]);

  const confirmLayer = async (layer) => {
    setSaving(true);
    const fieldMap = {
      inner_thought:  'inner_thought_confirmed',
      conflict:       'conflict_confirmed',
      body_narrator:  'body_narrator_confirmed',
      private_moment: 'private_moment_confirmed',
      post:           'post_confirmed',
      bleed:          'bleed_confirmed',
    };
    try {
      const res = await confirmTextureLayerApi(storyNumber, {
        character_key: characterKey,
        fields: [fieldMap[layer]],
      });
      setTexture(res.data?.texture);
    } catch { /* keep prior state on failure */ }
    setSaving(false);
  };

  const confirmAll = async () => {
    setSaving(true);
    try {
      const res = await confirmTextureLayerApi(storyNumber, { character_key: characterKey, fields: 'all' });
      setTexture(res.data?.texture);
    } catch { /* keep prior state on failure */ }
    setSaving(false);
  };

  const regenerateLayer = async (layer) => {
    try {
      await regenerateTextureLayerApi(storyNumber, layer, { character_key: characterKey });
      // Re-fetch texture after clearing
      try {
        const fresh = await getTextureLayerApi(characterKey, storyNumber);
        setTexture(fresh.data?.texture);
      } catch { /* refetch failed; leave UI as-is */ }
    } catch { /* regenerate failed; leave UI as-is */ }
  };

  if (loading) return (
    <div className="ws-empty">
      <div className="ws-spinner ws-spinner-lg" />
    </div>
  );

  if (!texture) return (
    <div className="ws-empty">
      <div className="ws-empty-icon">&#9678;</div>
      <div className="ws-empty-title">No texture found for Story {storyNumber}</div>
      <button className="ws-btn ws-btn-ghost" onClick={() => navigate(-1)}>Back</button>
    </div>
  );

  const layers = [
    {
      key: 'inner_thought',
      eligible: true,
      confirmed: texture.inner_thought_confirmed,
      content: (
        <>
          <div className="ws-section-label">
            {texture.inner_thought_type?.replace('_', ' ').toUpperCase()}
          </div>
          <p style={{ fontStyle: 'italic', lineHeight: 1.8, color: '#3a3a5a', fontSize: 14 }}>
            {texture.inner_thought_text}
          </p>
        </>
      ),
    },
    {
      key: 'body_narrator',
      eligible: true,
      confirmed: texture.body_narrator_confirmed,
      content: (
        <p style={{ lineHeight: 1.8, color: '#3a3a5a', fontSize: 14 }}>
          {texture.body_narrator_text}
        </p>
      ),
    },
    {
      key: 'conflict',
      eligible: texture.conflict_eligible,
      confirmed: texture.conflict_confirmed,
      content: texture.conflict_eligible ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Trigger', value: texture.conflict_trigger },
            { label: 'Surface', value: texture.conflict_surface_text },
            { label: 'Subtext', value: texture.conflict_subtext },
            { label: 'Silence Beat', value: texture.conflict_silence_beat },
            { label: 'Resolution', value: texture.conflict_resolution_type },
          ].map(({ label, value }) => value && (
            <div key={label}>
              <div className="ws-section-label">{label}</div>
              <p style={{ color: '#3a3a5a', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      ) : null,
    },
    {
      key: 'private_moment',
      eligible: texture.private_moment_eligible,
      confirmed: texture.private_moment_confirmed,
      content: texture.private_moment_eligible ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div className="ws-section-label">Setting</div>
            <p style={{ color: '#3a3a5a', fontSize: 13, margin: 0 }}>
              {texture.private_moment_setting}
            </p>
          </div>
          <div>
            <div className="ws-section-label">Sensory Anchor</div>
            <p style={{ color: '#3a3a5a', fontSize: 13, fontStyle: 'italic', margin: 0 }}>
              {texture.private_moment_sensory_anchor}
            </p>
          </div>
          <div>
            <div className="ws-section-label">The Moment</div>
            <p style={{ color: '#3a3a5a', fontSize: 14, lineHeight: 1.8, margin: 0 }}>
              {texture.private_moment_text}
            </p>
          </div>
        </div>
      ) : null,
    },
    {
      key: 'post',
      eligible: !!texture.post_text,
      confirmed: texture.post_confirmed,
      content: texture.post_text ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Post card */}
          <div style={{
            background: '#fafafa',
            border: '1px solid #e8e0f0',
            borderRadius: 12,
            padding: '14px 16px',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: '#9999b3', marginBottom: 8,
            }}>
              {texture.post_platform}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: '#1a1a2e', margin: 0 }}>
              {texture.post_text}
            </p>
          </div>
          {/* Audience responses */}
          {[
            { label: 'The Bestie', value: texture.post_audience_bestie, color: '#7ab3d4' },
            { label: 'The Paying Man', value: texture.post_audience_paying_man, color: '#d4789a' },
            { label: 'The Competitor', value: texture.post_audience_competitive_woman, color: '#a889c8' },
          ].map(({ label, value, color }) => value && (
            <div key={label} style={{
              padding: '10px 12px',
              borderLeft: `3px solid ${color}`,
              background: `${color}08`,
              borderRadius: '0 8px 8px 0',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                color, marginBottom: 4,
              }}>{label}</div>
              <p style={{ fontSize: 12, color: '#5a5a7a', margin: 0, lineHeight: 1.5 }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      ) : null,
    },
    {
      key: 'bleed',
      eligible: !!texture.bleed_text,
      confirmed: texture.bleed_confirmed,
      content: texture.bleed_text ? (
        <p style={{
          fontStyle: 'italic',
          lineHeight: 1.9,
          color: '#d4789a',
          fontSize: 14,
          borderLeft: '2px solid #d4789a',
          paddingLeft: 14,
        }}>
          {texture.bleed_text}
        </p>
      ) : null,
    },
  ];

  const eligibleLayers   = layers.filter(l => l.eligible);
  const confirmedCount   = eligibleLayers.filter(l => l.confirmed).length;
  const allConfirmed     = confirmedCount === eligibleLayers.length;

  return (
    <div className="world-studio" style={{ maxWidth: 740, margin: '0 auto', padding: '0 20px 40px' }}>

      {/* Header */}
      <div className="ws-page-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="ws-page-title">Story {storyNumber} — Texture Review</div>
          <div className="ws-page-subtitle">
            {confirmedCount} of {eligibleLayers.length} layers confirmed
            {texture.fully_confirmed && ' \u00b7 Complete'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="ws-btn ws-btn-ghost" onClick={() => navigate(-1)}>
            &larr; Back
          </button>
          {!allConfirmed && (
            <button
              className="ws-btn ws-btn-primary"
              onClick={confirmAll}
              disabled={saving}
            >
              {saving ? 'Saving\u2026' : 'Confirm All'}
            </button>
          )}
        </div>
      </div>

      {/* Amber's notes */}
      {texture.amber_notes?.length > 0 && (
        <div className="ws-card ws-card-lavender" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, #d4789a, #a889c8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: '#fff', fontWeight: 700,
            }}>A</div>
            <span className="ws-section-title">Amber noticed</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {texture.amber_notes.map((note, i) => (
              <div key={i} style={{ fontSize: 12, color: '#5a5a7a', lineHeight: 1.6 }}>
                <span style={{
                  fontWeight: 700,
                  color: '#a889c8',
                  marginRight: 6,
                  textTransform: 'capitalize',
                }}>
                  {note.type}:
                </span>
                {note.note}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {eligibleLayers.map(layer => (
          <div key={layer.key} className="ws-card" style={{
            borderLeft: layer.confirmed
              ? `3px solid ${LAYER_COLORS[layer.key]}`
              : '3px solid #f2eef8',
            opacity: layer.confirmed ? 1 : 0.95,
          }}>
            <div className="ws-section-header" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="ws-section-title">{LAYER_LABELS[layer.key]}</span>
                {layer.confirmed && (
                  <span className="ws-pill ws-pill-approved">&check; Confirmed</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!layer.confirmed && (
                  <>
                    <button
                      className="ws-btn ws-btn-ghost ws-btn-sm"
                      onClick={() => regenerateLayer(layer.key)}
                      disabled={saving}
                    >
                      &#8635; Regenerate
                    </button>
                    <button
                      className="ws-approve-btn approve"
                      onClick={() => confirmLayer(layer.key)}
                      disabled={saving}
                    >
                      &check; Confirm
                    </button>
                  </>
                )}
              </div>
            </div>
            <div>{layer.content}</div>
          </div>
        ))}
      </div>

      {allConfirmed && (
        <div className="ws-card ws-card-blue" style={{ marginTop: 24, textAlign: 'center' }}>
          <div className="ws-empty-icon">&check;</div>
          <div className="ws-empty-title">All texture confirmed</div>
          <div className="ws-empty-desc">
            Story {storyNumber} is ready for chapter assembly.
          </div>
        </div>
      )}
    </div>
  );
}
