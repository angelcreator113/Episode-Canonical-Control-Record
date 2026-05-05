import { useState, useEffect } from 'react';
import apiClient from '../services/api';

const API = '/api/v1';

// ─── Track 6 CP8 module-scope helper (Pattern F prophylactic — Api suffix) ───
export const getArcTrackingApi = (characterKey) =>
  apiClient.get(`${API}/arc-tracking/${characterKey}`);

export default function ArcTrackingPanel({ characterKey, characterName }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!characterKey) return;
    setLoading(true);
    getArcTrackingApi(characterKey)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, [characterKey]);

  if (loading) return (
    <div className="ws-card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: '#9999b3' }}>Loading arc data…</div>
    </div>
  );

  if (!data) return null;

  const { context } = data;

  return (
    <div className="ws-card" style={{ marginBottom: 16 }}>

      {/* Header */}
      <div
        style={{
          cursor: 'pointer', padding: '14px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: expanded ? '1px solid #f2eef8' : 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>
          Arc Tracking — {characterName}
        </span>
        <span style={{ fontSize: 11, color: '#9999b3' }}>{expanded ? '▾' : '▸'}</span>
      </div>

      {/* Always visible — key numbers */}
      <div className="arc-tracking-stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 1,
        borderTop: '1px solid #f2eef8',
      }}>
        {[
          { label: 'Wound Clock', value: context.wound_clock, color: '#d4789a' },
          { label: 'Stakes Level', value: `${context.stakes_level} / 10`, color: '#a889c8' },
          { label: 'Visibility', value: `${context.visibility_score}%`, color: '#7ab3d4' },
          { label: 'David Silence', value: context.david_silence_counter, color: '#c0392b' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 9, color: '#9999b3', marginTop: 3, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Visibility bar */}
      <div style={{ padding: '8px 16px 12px' }}>
        <div style={{ height: 6, background: '#f2eef8', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${context.visibility_score}%`,
            background: 'linear-gradient(90deg, #7ab3d4, #a889c8)',
            borderRadius: 3,
            transition: 'width 0.6s ease',
          }} />
        </div>
        <div style={{ fontSize: 11, color: '#9999b3', marginTop: 6, lineHeight: 1.5 }}>
          {context.visibility_narrative}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f2eef8', padding: '14px 16px' }}>

          {/* Wound clock narrative */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: '#a889c8', marginBottom: 4 }}>Wound Clock</div>
            <div style={{ fontSize: 12, color: '#5a5a7a', lineHeight: 1.6, fontStyle: 'italic' }}>
              {context.wound_clock_narrative}
            </div>
          </div>

          {/* Stakes narrative */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: '#a889c8', marginBottom: 4 }}>
              Stakes — Level {context.stakes_level}
            </div>
            <div style={{ fontSize: 12, color: '#5a5a7a', lineHeight: 1.6, fontStyle: 'italic' }}>
              {context.stakes_narrative}
            </div>
          </div>

          {/* Phone weight */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: '#a889c8', marginBottom: 4 }}>
              Recurring Object — Her Phone ({context.phone_appearances} appearances)
            </div>
            <div style={{ fontSize: 12, color: '#5a5a7a', lineHeight: 1.6, fontStyle: 'italic' }}>
              {context.phone_weight}
            </div>
          </div>

          {/* Stakes visualization — 10 level bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: '#a889c8', marginBottom: 6 }}>Stakes Progression</div>
            <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} style={{
                  flex: 1,
                  height: 24,
                  borderRadius: 3,
                  background: i < context.stakes_level
                    ? `hsl(${340 - (i * 15)}, ${60 + i * 4}%, ${65 - i * 3}%)`
                    : '#f2eef8',
                  transition: 'background 0.3s ease',
                  position: 'relative',
                }}>
                  {i === context.stakes_level - 1 && (
                    <div style={{
                      position: 'absolute',
                      top: -18,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: 9,
                      color: '#9999b3',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}>
                      {context.stakes_level}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bleed status */}
          <div style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: context.bleed_position.includes('not happened')
              ? '#f6f1fc'
              : '#fdf0f4',
            border: `1px solid ${context.bleed_position.includes('not happened') ? '#e8dcf5' : '#f5dce6'}`,
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: context.bleed_position.includes('not happened') ? '#a889c8' : '#d4789a',
              marginBottom: 4,
            }}>
              Lala Bleed — Story 47
            </div>
            <div style={{ fontSize: 11, color: '#5a5a7a', lineHeight: 1.5 }}>
              {context.bleed_position}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
