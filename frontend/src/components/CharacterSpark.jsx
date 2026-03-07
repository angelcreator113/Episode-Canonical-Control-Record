/**
 * CharacterSpark.jsx — 3-Field Fast Character Entry Modal
 *
 * Light theme. Accepts name + desire_line + wound, then triggers
 * Claude Opus 4.5 pre-fill expansion for full character DNA.
 *
 * Props:
 *   open         — boolean, controls modal visibility
 *   onClose      — callback when modal closes
 *   registryId   — optional target registry UUID
 *   onCommit     — callback(spark) when spark is committed to registry
 */

import { useState, useCallback } from 'react';

const API = '/api/v1/character-registry';

// ── Light theme palette ───────────────────────────────────────────────────
const T = {
  bg:         '#f5f5f5',
  surface:    '#ffffff',
  surfaceAlt: '#f8f8f8',
  border:     '#e0e0e0',
  borderLight:'#d0d0d0',
  text:       '#1a1a1a',
  textDim:    '#666666',
  textFaint:  '#999999',
  accent:     '#c9a96e',
  accentHover:'#b8944e',
  red:        '#c96e6e',
  green:      '#6ec9a0',
  blue:       '#6e9ec9',
  purple:     '#9e6ec9',
};

const INPUT_STYLE = {
  width: '100%',
  padding: '10px 12px',
  background: T.surfaceAlt,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  color: T.text,
  fontSize: 13.5,
  fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};

const LABEL_STYLE = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: T.textDim,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  marginBottom: 6,
};

const BTN_PRIMARY = {
  padding: '10px 20px',
  background: T.accent,
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: 0.3,
  transition: 'background 0.2s',
};

const BTN_GHOST = {
  padding: '10px 16px',
  background: 'transparent',
  color: T.textDim,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  fontSize: 13,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

async function apiCall(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Prefill Preview ───────────────────────────────────────────────────────
function PrefillPreview({ prefill }) {
  if (!prefill) return null;
  const fields = [
    ['Character Key', prefill.character_key],
    ['Icon', prefill.icon],
    ['Desire Line', prefill.desire_line],
    ['Fear Line', prefill.fear_line],
    ['Wound', prefill.wound],
    ['Job', prefill.job],
    ['Job Antagonist', prefill.job_antagonist],
    ['Personal Antagonist', prefill.personal_antagonist],
    ['Recurring Object', prefill.recurring_object],
    ['Secret', prefill.secret],
    ['Voice Notes', prefill.voice_notes],
    ['Physical Description', prefill.physical_description],
    ['Backstory Hook', prefill.backstory_hook],
  ];

  return (
    <div style={{ marginTop: 16, padding: 16, background: T.surfaceAlt, borderRadius: 8, border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        ◆ Claude Opus Pre-Fill
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        {fields.map(([label, value]) => value ? (
          <div key={label}>
            <span style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
            <div style={{ fontSize: 12.5, color: T.text, marginTop: 2 }}>{value}</div>
          </div>
        ) : null)}
      </div>

      {/* Strengths */}
      {prefill.strengths?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <span style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>Strengths</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {prefill.strengths.map((s, i) => (
              <span key={i} style={{ padding: '3px 8px', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 11, color: T.text }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Life Domains */}
      {prefill.life_domains && (
        <div style={{ marginTop: 12 }}>
          <span style={{ fontSize: 10, color: T.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>Life Domains</span>
          {Object.entries(prefill.life_domains).map(([k, v]) => (
            <div key={k} style={{ fontSize: 12, color: T.textDim, marginTop: 3 }}>
              <strong style={{ color: T.text }}>{k}:</strong> {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export default function CharacterSpark({ open, onClose, registryId, onCommit }) {
  const [name, setName] = useState('');
  const [desire, setDesire] = useState('');
  const [wound, setWound] = useState('');
  const [spark, setSpark] = useState(null);
  const [prefilling, setPrefilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('input'); // input | prefill | review

  const reset = useCallback(() => {
    setName(''); setDesire(''); setWound('');
    setSpark(null); setError(null);
    setStep('input'); setPrefilling(false); setSaving(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose?.();
  }, [onClose, reset]);

  // Step 1: Save the spark
  const handleSave = useCallback(async () => {
    if (!name.trim() || !desire.trim() || !wound.trim()) {
      setError('All three fields are required');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const data = await apiCall('POST', '/sparks', {
        name: name.trim(),
        desire_line: desire.trim(),
        wound: wound.trim(),
        registry_id: registryId || null,
      });
      setSpark(data.spark);
      setStep('prefill');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [name, desire, wound, registryId]);

  // Step 2: Run Claude Opus pre-fill
  const handlePrefill = useCallback(async () => {
    if (!spark?.id) return;
    setError(null);
    setPrefilling(true);
    try {
      const data = await apiCall('POST', `/sparks/${spark.id}/prefill`);
      setSpark(data.spark);
      setStep('review');
    } catch (err) {
      setError(err.message);
    } finally {
      setPrefilling(false);
    }
  }, [spark]);

  // Step 3: Commit (signal parent)
  const handleCommit = useCallback(() => {
    onCommit?.(spark);
    handleClose();
  }, [spark, onCommit, handleClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 9998, backdropFilter: 'blur(3px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 520, maxHeight: '85vh', overflowY: 'auto',
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        zIndex: 9999, padding: 28,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: -0.3 }}>
              ✦ Character Spark
            </div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
              Three fields → Claude Opus expands → full DNA
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: T.textFaint, padding: 4 }}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['Input', 'Pre-fill', 'Review'].map((label, i) => {
            const stepMap = ['input', 'prefill', 'review'];
            const active = stepMap.indexOf(step) >= i;
            return (
              <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  height: 3, borderRadius: 2, marginBottom: 4,
                  background: active ? T.accent : T.border,
                  transition: 'background 0.3s',
                }} />
                <span style={{ fontSize: 10, color: active ? T.accent : T.textFaint, fontWeight: active ? 600 : 400 }}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ padding: '8px 12px', background: '#fdf2f2', border: `1px solid ${T.red}`, borderRadius: 6, fontSize: 12, color: T.red, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {/* Step: Input */}
        {step === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Marcus Hale"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Desire Line</label>
              <textarea
                value={desire}
                onChange={e => setDesire(e.target.value)}
                placeholder="What do they want more than anything?"
                rows={2}
                style={{ ...INPUT_STYLE, resize: 'vertical' }}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Wound</label>
              <textarea
                value={wound}
                onChange={e => setWound(e.target.value)}
                placeholder="What broke them? What can't they forgive?"
                rows={2}
                style={{ ...INPUT_STYLE, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button onClick={handleClose} style={BTN_GHOST}>Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving...' : 'Save Spark →'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Pre-fill */}
        {step === 'prefill' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✦</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>
              Spark saved: {spark?.name}
            </div>
            <div style={{ fontSize: 12, color: T.textDim, marginBottom: 20 }}>
              Ready to expand with Claude Opus 4.5 — this generates a full character DNA profile from your three fields.
            </div>

            {prefilling ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 24, height: 24, border: '2px solid #e0e0e0',
                  borderTop: `2px solid ${T.accent}`, borderRadius: '50%',
                  animation: 'spark-spin 0.9s linear infinite',
                }} />
                <span style={{ fontSize: 11, color: T.textDim, fontFamily: 'monospace' }}>Expanding character DNA...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                <button onClick={handleClose} style={BTN_GHOST}>Later</button>
                <button onClick={handlePrefill} style={BTN_PRIMARY}>
                  ◆ Run Pre-Fill
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && spark?.prefill_result && (
          <div>
            <div style={{ fontSize: 13, color: T.text, marginBottom: 8 }}>
              <strong>{spark.name}</strong> — expanded DNA ready for review
            </div>
            <PrefillPreview prefill={spark.prefill_result} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={handleClose} style={BTN_GHOST}>Close</button>
              <button
                onClick={handleCommit}
                style={{ ...BTN_PRIMARY, background: T.green }}
              >
                ✓ Commit to Registry
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spark-spin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  );
}
