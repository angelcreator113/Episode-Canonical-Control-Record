/**
 * CharacterDepthPanel.jsx — Character Depth Engine UI
 *
 * 10-section depth panel rendered as DEPTH tab in character profile.
 * Sections: Body, Money, Time, Luck/Circumstance, Self-Narrative,
 * Blind Spot, Change Capacity, Operative Cosmology, Foreclosed Possibility, Joy.
 *
 * Light theme: warm off-white #FAFAFA base.
 * Pink cards for body/narrative/joy, blue for money/luck/cosmology,
 * lavender for blind spot/change/foreclosed.
 */

import { useState, useCallback } from 'react';
import { API_URL } from '../config/api';

/* ── Color scheme ───────────────────────────────────────────────────────────── */
const PINK    = { bg: '#FDF0F5', border: '#e8b4c8' };
const BLUE    = { bg: '#F0F7FD', border: '#a8c8e8' };
const LAVENDER = { bg: '#F5F0FD', border: '#b8a8d8' };

const SECTION_COLORS = {
  body: PINK, money: BLUE, time: PINK, luck: BLUE,
  narrative: PINK, blindspot: LAVENDER, change: LAVENDER,
  cosmology: BLUE, foreclosed: LAVENDER, joy: PINK,
};

/* ── Shared sub-components ──────────────────────────────────────────────────── */

function Badge({ value, color }) {
  if (!value) return null;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 12,
      fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
      background: color || '#eee', color: '#444', textTransform: 'uppercase',
    }}>
      {String(value).replace(/_/g, ' ')}
    </span>
  );
}

function Slider({ label, value, onChange, disabled }) {
  const val = value ?? 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 2 }}>
        <span>{label}</span>
        <span>{val}</span>
      </div>
      <input
        type="range" min={0} max={100} value={val}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        style={{ width: '100%', accentColor: '#d4789a' }}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, disabled, rows = 2, prominent }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 3, fontWeight: 500 }}>{label}</label>}
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        style={{
          width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6,
          fontSize: prominent ? 15 : 13, lineHeight: 1.5, resize: 'vertical',
          fontFamily: 'inherit', background: disabled ? '#f9f9f9' : '#fff',
          ...(prominent ? { fontWeight: 500 } : {}),
        }}
      />
    </div>
  );
}

function RadioGroup({ label, options, value, onChange, disabled }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4, fontWeight: 500 }}>{label}</label>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => !disabled && onChange(opt)}
            disabled={disabled}
            style={{
              padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 500,
              border: value === opt ? '2px solid #d4789a' : '1px solid #ccc',
              background: value === opt ? '#fdf0f4' : '#fff',
              color: value === opt ? '#c0527a' : '#666',
              cursor: disabled ? 'default' : 'pointer',
              textTransform: 'uppercase', letterSpacing: 0.3,
            }}
          >
            {opt.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionCard({ title, dimension, children, preview, onGenerate, generating }) {
  const colors = SECTION_COLORS[dimension] || PINK;
  return (
    <div style={{
      background: preview ? '#FFFBE6' : colors.bg,
      border: `2px solid ${preview ? '#e6c84c' : colors.border}`,
      borderRadius: 10, padding: 18, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: 1 }}>
          {title}
          {preview && <span style={{ marginLeft: 8, fontSize: 10, color: '#b8960a', fontWeight: 600 }}>PREVIEW</span>}
        </h4>
        <button
          onClick={onGenerate}
          disabled={generating}
          style={{
            padding: '4px 12px', borderRadius: 14, fontSize: 11, fontWeight: 600,
            border: '1px solid #ccc', background: '#fff', color: '#666',
            cursor: generating ? 'wait' : 'pointer',
          }}
        >
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>
      {children}
    </div>
  );
}

function AuthorToggle({ visible, onToggle, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
          borderRadius: 14, fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
          border: '1px solid #d4789a', background: visible ? '#fdf0f4' : '#fff',
          color: '#c0527a', cursor: 'pointer', marginBottom: visible ? 10 : 0,
        }}
      >
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
          background: visible ? '#c0527a' : '#ccc',
        }} />
        AUTHOR VIEW
      </button>
      {visible && children}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function CharacterDepthPanel({ characterId, characterName }) {
  const [depth, setDepth]             = useState({});
  const [proposed, setProposed]       = useState({});
  const [loaded, setLoaded]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [generating, setGenerating]   = useState({});
  const [confirming, setConfirming]   = useState(false);
  const [blindSpotVisible, setBlindSpotVisible] = useState(false);
  const [narrativeGapVisible, setNarrativeGapVisible] = useState(false);
  const [error, setError]             = useState(null);

  // ── Load depth data ──
  const loadDepth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/character-depth/${characterId}`);
      if (!res.ok) throw new Error('Failed to load depth data');
      const data = await res.json();
      setDepth(data.depth || {});
      setLoaded(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  // Load on first render
  if (!loaded && !loading) loadDepth();

  // ── Helpers ──
  const val = (field) => proposed[field] !== undefined ? proposed[field] : depth[field];
  const isPreview = (field) => proposed[field] !== undefined;
  const hasPreviews = Object.keys(proposed).length > 0;

  const setField = (field, value) => {
    setProposed(prev => ({ ...prev, [field]: value }));
  };

  // ── Generate ──
  const generateDimension = async (dimension) => {
    setGenerating(prev => ({ ...prev, [dimension]: true }));
    try {
      const res = await fetch(`${API_URL}/character-depth/${characterId}/generate/${dimension}`, { method: 'POST' });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      if (data.proposed) {
        setProposed(prev => ({ ...prev, ...data.proposed }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(prev => ({ ...prev, [dimension]: false }));
    }
  };

  const generateAll = async () => {
    setGenerating(prev => ({ ...prev, all: true }));
    try {
      const res = await fetch(`${API_URL}/character-depth/${characterId}/generate`, { method: 'POST' });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      if (data.proposed) {
        setProposed(data.proposed);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(prev => ({ ...prev, all: false }));
    }
  };

  // ── Confirm ──
  const confirmAll = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`${API_URL}/character-depth/${characterId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposed }),
      });
      if (!res.ok) throw new Error('Confirm failed');
      const data = await res.json();
      setDepth(data.depth || {});
      setProposed({});
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  };

  // ── Loading state ──
  if (loading && !loaded) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading depth profile...</div>;
  }

  const anyGenerating = Object.values(generating).some(Boolean);

  return (
    <div style={{ background: '#FAFAFA', padding: '20px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#333' }}>Depth Engine</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>{characterName}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasPreviews && (
            <button
              onClick={confirmAll}
              disabled={confirming}
              style={{
                padding: '6px 16px', borderRadius: 14, fontSize: 12, fontWeight: 700,
                border: '2px solid #4a8fb5', background: '#eef5fb', color: '#2a6f95',
                cursor: confirming ? 'wait' : 'pointer',
              }}
            >
              {confirming ? 'Saving...' : `Confirm ${Object.keys(proposed).length} Fields`}
            </button>
          )}
          <button
            onClick={generateAll}
            disabled={anyGenerating}
            style={{
              padding: '6px 16px', borderRadius: 14, fontSize: 12, fontWeight: 700,
              border: '2px solid #d4789a', background: '#fdf0f4', color: '#c0527a',
              cursor: anyGenerating ? 'wait' : 'pointer',
            }}
          >
            {generating.all ? 'Generating All...' : 'Generate All'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 10, marginBottom: 12, background: '#fef0f0', border: '1px solid #e8a0a0', borderRadius: 6, fontSize: 12, color: '#c44' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 10, border: 'none', background: 'none', color: '#c44', cursor: 'pointer' }}>dismiss</button>
        </div>
      )}

      {/* ── 1. JOY (most prominent — joy_trigger hero) ── */}
      <SectionCard title="Experience of Joy" dimension="joy" preview={isPreview('de_joy_trigger')} onGenerate={() => generateDimension('joy')} generating={generating.joy}>
        <TextArea label="What makes her fully alive" value={val('de_joy_trigger')} onChange={v => setField('de_joy_trigger', v)} prominent rows={3} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TextArea label="Where in the body joy lives" value={val('de_joy_body_location')} onChange={v => setField('de_joy_body_location', v)} />
          <TextArea label="Earliest memory of this joy" value={val('de_joy_origin')} onChange={v => setField('de_joy_origin', v)} />
        </div>
        <TextArea label="The joy she will not let herself have" value={val('de_forbidden_joy')} onChange={v => setField('de_forbidden_joy', v)} />
        <RadioGroup label="When joy is threatened" options={['fight','grieve','deny']} value={val('de_joy_threat_response')} onChange={v => setField('de_joy_threat_response', v)} />
        <Slider label="Current access to aliveness (0 = blocked, 100 = full)" value={val('de_joy_current_access')} onChange={v => setField('de_joy_current_access', v)} />
      </SectionCard>

      {/* ── 2. THE BODY ── */}
      <SectionCard title="The Body" dimension="body" preview={isPreview('de_body_relationship')} onGenerate={() => generateDimension('body')} generating={generating.body}>
        <div style={{ marginBottom: 10 }}>
          <Badge value={val('de_body_relationship')} color="#fce4ec" />
        </div>
        <Slider label="Body as currency (0-100)" value={val('de_body_currency')} onChange={v => setField('de_body_currency', v)} />
        <Slider label="Body control / discipline (0-100)" value={val('de_body_control')} onChange={v => setField('de_body_control', v)} />
        <Slider label="Body comfort / inhabitation (0-100)" value={val('de_body_comfort')} onChange={v => setField('de_body_comfort', v)} />
        <TextArea label="Body history" value={val('de_body_history')} onChange={v => setField('de_body_history', v)} rows={3} />
      </SectionCard>

      {/* ── 3. MONEY BEHAVIOR ── */}
      <SectionCard title="Money Behavior" dimension="money" preview={isPreview('de_money_behavior')} onGenerate={() => generateDimension('money')} generating={generating.money}>
        <div style={{ marginBottom: 10 }}>
          <Badge value={val('de_money_behavior')} color="#e3f2fd" />
        </div>
        {/* Class gap visual */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: 10, background: '#fff', borderRadius: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>ORIGIN</div>
            <Badge value={val('de_money_origin_class')} color="#e8eaf6" />
          </div>
          <div style={{ fontSize: 18, color: val('de_class_gap_direction') === 'up' ? '#4caf50' : val('de_class_gap_direction') === 'down' ? '#f44336' : '#999' }}>
            {val('de_class_gap_direction') === 'up' ? '\u2191' : val('de_class_gap_direction') === 'down' ? '\u2193' : '\u2194'}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>CURRENT</div>
            <Badge value={val('de_money_current_class')} color="#e8eaf6" />
          </div>
        </div>
        <TextArea label="Money wound" value={val('de_money_wound')} onChange={v => setField('de_money_wound', v)} rows={3} />
      </SectionCard>

      {/* ── 4. TIME ORIENTATION ── */}
      <SectionCard title="Time Orientation" dimension="time" preview={isPreview('de_time_orientation')} onGenerate={() => generateDimension('time')} generating={generating.time}>
        <div style={{ marginBottom: 10 }}>
          <Badge value={val('de_time_orientation')} color="#fce4ec" />
        </div>
        <TextArea label="Time wound" value={val('de_time_wound')} onChange={v => setField('de_time_wound', v)} rows={3} />
      </SectionCard>

      {/* ── 5. LUCK & CIRCUMSTANCE ── */}
      <SectionCard title="Luck & Circumstance" dimension="luck" preview={isPreview('de_world_belief')} onGenerate={() => generateDimension('luck')} generating={generating.luck}>
        <div style={{ marginBottom: 10 }}>
          <Badge value={val('de_world_belief')} color="#e3f2fd" />
        </div>
        <Slider label="Luck interpretation (0 = random, 100 = earned)" value={val('de_luck_interpretation')} onChange={v => setField('de_luck_interpretation', v)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TextArea label="Advantages (what the world gave)" value={val('de_circumstance_advantages')} onChange={v => setField('de_circumstance_advantages', v)} rows={3} />
          <TextArea label="Disadvantages (what the world took)" value={val('de_circumstance_disadvantages')} onChange={v => setField('de_circumstance_disadvantages', v)} rows={3} />
        </div>
        <TextArea label="Circumstance wound" value={val('de_circumstance_wound')} onChange={v => setField('de_circumstance_wound', v)} />
      </SectionCard>

      {/* ── 6. SELF-NARRATIVE ── */}
      <SectionCard title="Self-Narrative" dimension="narrative" preview={isPreview('de_self_narrative_origin')} onGenerate={() => generateDimension('narrative')} generating={generating.narrative}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <h5 style={{ margin: '0 0 8px', fontSize: 12, color: '#888', textTransform: 'uppercase' }}>What She Believes</h5>
            <TextArea label="Origin story" value={val('de_self_narrative_origin')} onChange={v => setField('de_self_narrative_origin', v)} />
            <TextArea label="Turning point" value={val('de_self_narrative_turning_point')} onChange={v => setField('de_self_narrative_turning_point', v)} />
            <TextArea label="Who she holds responsible" value={val('de_self_narrative_villain')} onChange={v => setField('de_self_narrative_villain', v)} />
          </div>
          <div>
            <h5 style={{ margin: '0 0 8px', fontSize: 12, color: '#888', textTransform: 'uppercase' }}>Actual Version</h5>
            <AuthorToggle visible={narrativeGapVisible} onToggle={() => setNarrativeGapVisible(!narrativeGapVisible)}>
              <TextArea label="What the self-narrative gets wrong" value={val('de_actual_narrative_gap')} onChange={v => setField('de_actual_narrative_gap', v)} rows={3} />
            </AuthorToggle>
            <TextArea label="Therapy target" value={val('de_therapy_target')} onChange={v => setField('de_therapy_target', v)} />
          </div>
        </div>
      </SectionCard>

      {/* ── 7. BLIND SPOT — AUTHOR ONLY ── */}
      <AuthorToggle visible={blindSpotVisible} onToggle={() => setBlindSpotVisible(!blindSpotVisible)}>
        <SectionCard title="This Is What She Cannot See" dimension="blindspot" preview={isPreview('de_blind_spot_category')} onGenerate={() => generateDimension('blindspot')} generating={generating.blindspot}>
          <div style={{ marginBottom: 10 }}>
            <Badge value={val('de_blind_spot_category')} color="#ede7f6" />
          </div>
          <TextArea label="The specific thing she cannot see about herself" value={val('de_blind_spot')} onChange={v => setField('de_blind_spot', v)} rows={3} />
          <TextArea label="Evidence visible to others that she misreads" value={val('de_blind_spot_evidence')} onChange={v => setField('de_blind_spot_evidence', v)} rows={3} />
          <TextArea label="What would have to happen for her to finally see it" value={val('de_blind_spot_crack_condition')} onChange={v => setField('de_blind_spot_crack_condition', v)} rows={3} />
        </SectionCard>
      </AuthorToggle>

      {/* ── 8. CHANGE CAPACITY ── */}
      <SectionCard title="Change Capacity" dimension="change" preview={isPreview('de_change_capacity')} onGenerate={() => generateDimension('change')} generating={generating.change}>
        <RadioGroup
          options={['highly_rigid','conditionally_open','cyclically_mobile','highly_fluid','fixed_by_choice']}
          value={val('de_change_capacity')}
          onChange={v => setField('de_change_capacity', v)}
        />
        <Slider label="Change capacity score (0 = rigid, 100 = fluid)" value={val('de_change_capacity_score')} onChange={v => setField('de_change_capacity_score', v)} />
        <TextArea label="What would have to be true for this character to change" value={val('de_change_condition')} onChange={v => setField('de_change_condition', v)} />
        <TextArea label="Who would have to be in the room" value={val('de_change_witness')} onChange={v => setField('de_change_witness', v)} />
        <div style={{ marginTop: 8 }}>
          <label style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>Arc Function</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {['arc','fixed','both'].map(opt => (
              <button
                key={opt}
                onClick={() => setField('de_arc_function', opt)}
                style={{
                  padding: '6px 18px', borderRadius: 6, fontSize: 13, fontWeight: 700,
                  border: val('de_arc_function') === opt ? '2px solid #8055b8' : '1px solid #ccc',
                  background: val('de_arc_function') === opt ? '#f5f0fd' : '#fff',
                  color: val('de_arc_function') === opt ? '#6a3d9a' : '#888',
                  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1,
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── 9. OPERATIVE COSMOLOGY ── */}
      <SectionCard title="Operative Cosmology" dimension="cosmology" preview={isPreview('de_operative_cosmology')} onGenerate={() => generateDimension('cosmology')} generating={generating.cosmology}>
        <div style={{ marginBottom: 10 }}>
          <Badge value={val('de_operative_cosmology')} color="#e3f2fd" />
        </div>
        <TextArea label="Stated religion / belief" value={val('de_stated_religion')} onChange={v => setField('de_stated_religion', v)} />
        <TextArea label="Where operative cosmology and stated religion diverge" value={val('de_cosmology_conflict')} onChange={v => setField('de_cosmology_conflict', v)} />
        <TextArea label="How she explains things to herself when they don't make sense" value={val('de_meaning_making_style')} onChange={v => setField('de_meaning_making_style', v)} />
      </SectionCard>

      {/* ── 10. FORECLOSED POSSIBILITY ── */}
      <SectionCard title="Foreclosed Possibility" dimension="foreclosed" preview={isPreview('de_foreclosed_possibilities')} onGenerate={() => generateDimension('foreclosed')} generating={generating.foreclosed}>
        <ForeclosedSection
          possibilities={val('de_foreclosed_possibilities')}
          origins={val('de_foreclosure_origins')}
          visibility={val('de_foreclosure_visibility')}
          crackConditions={val('de_crack_conditions')}
          onChange={(field, value) => setField(field, value)}
        />
      </SectionCard>
    </div>
  );
}


/* ── Foreclosed Possibility sub-component ────────────────────────────────────── */

const FORECLOSURE_CATEGORIES = ['love','safety','belonging','success','being_known'];

function ForeclosedSection({ possibilities, origins, visibility, crackConditions, onChange }) {
  const selected = Array.isArray(possibilities) ? possibilities : [];
  const originsObj = origins || {};
  const visObj = visibility || {};
  const crackObj = crackConditions || {};

  const toggleCategory = (cat) => {
    const next = selected.includes(cat)
      ? selected.filter(c => c !== cat)
      : [...selected, cat];
    onChange('de_foreclosed_possibilities', next);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {FORECLOSURE_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => toggleCategory(cat)}
            style={{
              padding: '5px 14px', borderRadius: 14, fontSize: 12, fontWeight: 600,
              border: selected.includes(cat) ? '2px solid #8055b8' : '1px solid #ccc',
              background: selected.includes(cat) ? '#f5f0fd' : '#fff',
              color: selected.includes(cat) ? '#6a3d9a' : '#888',
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {selected.map(cat => (
        <div key={cat} style={{ padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #e0d8ef', marginBottom: 10 }}>
          <h5 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#6a3d9a', textTransform: 'capitalize' }}>
            {cat.replace(/_/g, ' ')}
          </h5>
          <TextArea
            label="Origin — the experience that caused this foreclosure"
            value={originsObj[cat] || ''}
            onChange={v => onChange('de_foreclosure_origins', { ...originsObj, [cat]: v })}
          />
          <Slider
            label={`Visibility (0 = unconscious, 100 = fully aware)`}
            value={visObj[cat] ?? 50}
            onChange={v => onChange('de_foreclosure_visibility', { ...visObj, [cat]: v })}
          />
          <TextArea
            label="Crack condition — what would reopen this door"
            value={crackObj[cat] || ''}
            onChange={v => onChange('de_crack_conditions', { ...crackObj, [cat]: v })}
          />
        </div>
      ))}

      {selected.length === 0 && (
        <p style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>Select categories she has secretly given up on.</p>
      )}
    </div>
  );
}
