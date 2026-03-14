/**
 * ChapterBrief.jsx
 * frontend/src/pages/ChapterBrief.jsx
 *
 * Shows writing context before manuscript lines.
 * Tells the writer: who, what emotional state, what must happen, what POV.
 * Editable inline — saves to PUT /api/v1/storyteller/chapters/:chapterId
 *
 * Usage in StorytellerPage.jsx, inside the chapter accordion,
 * ABOVE the line list:
 *
 *   import ChapterBrief from './ChapterBrief';
 *
 *   <ChapterBrief
 *     chapter={chapter}
 *     characters={registryCharacters}  // from character registry
 *     onUpdated={(updatedChapter) => {
 *       setChapters(prev => prev.map(c =>
 *         c.id === updatedChapter.id ? { ...updatedChapter, lines: c.lines } : c
 *       ));
 *     }}
 *   />
 *
 * You'll need to fetch registry characters once in StorytellerPage:
 *   GET /api/v1/character-registry/registries?show_id=... → registries → characters
 */

import { useState } from 'react';

const STORYTELLER_API = '/api/v1/storyteller';

const POV_OPTIONS = [
  { value: 'first_person', label: 'First Person',       color: '#8B6914' },
  { value: 'close_third',  label: 'Close Third',        color: '#4A6B8B' },
  { value: 'multi_pov',    label: 'Multi-POV',          color: '#6B4A8B' },
  { value: 'lala_voice',   label: 'Lala Proto-Voice',   color: '#8B4A6B' },
];

/** Normalize a registry character object to { id, name, type } */
function normalizeChar(c) {
  return {
    id:   c.id,
    name: c.name || c.display_name || 'Unnamed',
    type: c.type || c.role_type || 'special',
  };
}

export default function ChapterBrief({ chapter, characters = [], onUpdated }) {
  // Normalize characters once so downstream code always uses .name / .type
  const chars = characters.map(normalizeChar);

  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({
    primary_character_id:  chapter.primary_character_id  || '',
    pov:                   chapter.pov                   || 'first_person',
    theme:                 chapter.theme                 || '',
    scene_goal:            chapter.scene_goal            || '',
    emotional_state_start: chapter.emotional_state_start || '',
    emotional_state_end:   chapter.emotional_state_end   || '',
    chapter_notes:         chapter.chapter_notes         || '',
  });

  const primaryChar = chars.find(c => c.id === form.primary_character_id);
  const povOption   = POV_OPTIONS.find(p => p.value === (chapter.pov || 'first_person'));
  const isBlank     = !chapter.theme && !chapter.scene_goal && !chapter.primary_character_id;

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(
        `${STORYTELLER_API}/chapters/${chapter.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onUpdated?.({ ...chapter, ...form });
      setEditing(false);
    } catch (err) {
      console.error('ChapterBrief save error:', err);
    } finally {
      setSaving(false);
    }
  }

  // ── Collapsed read view (shown above lines always) ─────────────────────
  if (!editing) {
    return (
      <div style={s.brief}>

        {/* Top row — character + POV + edit button */}
        <div style={s.briefTop}>
          <div style={s.briefLeft}>
            {primaryChar ? (
              <div style={s.characterPill}>
                <div style={{
                  ...s.characterDot,
                  background: typeColor(primaryChar.type),
                }} />
                <span style={s.characterName}>{primaryChar.name}</span>
                <span style={s.characterType}>{primaryChar.type}</span>
              </div>
            ) : (
              <div style={{ ...s.characterPill, opacity: 0.4 }}>
                <div style={{ ...s.characterDot, background: 'rgba(30,25,20,0.2)' }} />
                <span style={s.characterName}>No character assigned</span>
              </div>
            )}

            <div style={{
              ...s.povBadge,
              color: povOption?.color || '#8B6914',
              background: `${povOption?.color}18` || 'rgba(139,105,20,0.08)',
            }}>
              {povOption?.label || 'First Person'}
            </div>
          </div>

          <button style={s.editBriefBtn} onClick={() => setEditing(true)}>
            {isBlank ? '+ Set chapter context' : '✎ Edit brief'}
          </button>
        </div>

        {/* Theme */}
        {chapter.theme && (
          <div style={s.themeRow}>
            <span style={s.briefLabel}>THEME</span>
            <span style={s.themeText}>{chapter.theme}</span>
          </div>
        )}

        {/* Scene goal */}
        {chapter.scene_goal && (
          <div style={s.goalRow}>
            <span style={s.briefLabel}>SCENE GOAL</span>
            <span style={s.goalText}>{chapter.scene_goal}</span>
          </div>
        )}

        {/* Emotional arc */}
        {(chapter.emotional_state_start || chapter.emotional_state_end) && (
          <div style={s.emotionalRow}>
            <span style={s.briefLabel}>ARC</span>
            <div style={s.emotionalArc}>
              {chapter.emotional_state_start && (
                <span style={s.emotionalState}>{chapter.emotional_state_start}</span>
              )}
              {chapter.emotional_state_start && chapter.emotional_state_end && (
                <span style={s.arcArrow}>→</span>
              )}
              {chapter.emotional_state_end && (
                <span style={{ ...s.emotionalState, color: '#4A7C59' }}>
                  {chapter.emotional_state_end}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Private notes indicator */}
        {chapter.chapter_notes && (
          <div style={s.notesIndicator}>
            ◆ Private notes
          </div>
        )}

        {/* Empty state prompt */}
        {isBlank && (
          <div style={s.emptyPrompt}>
            Set the chapter context before you write — who, what must happen, where they start emotionally.
          </div>
        )}
      </div>
    );
  }

  // ── Edit form ──────────────────────────────────────────────────────────
  return (
    <div style={s.editForm}>

      <div style={s.editHeader}>
        <div style={s.editTitle}>Chapter Brief</div>
        <div style={s.editSub}>This context guides writing and memory extraction. It is not part of the manuscript.</div>
      </div>

      {/* Primary character */}
      <BriefField label='PRIMARY CHARACTER' hint='Who is this chapter about?'>
        <select
          style={s.select}
          value={form.primary_character_id}
          onChange={e => set('primary_character_id', e.target.value)}
        >
          <option value=''>— Select character —</option>
          {chars.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.type})
            </option>
          ))}
        </select>
      </BriefField>

      {/* POV */}
      <BriefField label='POV'>
        <div style={s.povRow}>
          {POV_OPTIONS.map(opt => (
            <button
              key={opt.value}
              style={{
                ...s.povBtn,
                borderColor: form.pov === opt.value ? opt.color : 'rgba(30,25,20,0.12)',
                color: form.pov === opt.value ? opt.color : 'rgba(30,25,20,0.4)',
                background: form.pov === opt.value ? `${opt.color}10` : 'white',
              }}
              onClick={() => set('pov', opt.value)}
              type='button'
            >
              {opt.label}
            </button>
          ))}
        </div>
      </BriefField>

      {/* Theme */}
      <BriefField label='THEME' hint='The core idea this chapter explores'>
        <input
          style={s.input}
          placeholder='e.g. Admiration turning into self-comparison'
          value={form.theme}
          onChange={e => set('theme', e.target.value)}
        />
      </BriefField>

      {/* Scene goal */}
      <BriefField label='SCENE GOAL' hint='What must happen by the end of this chapter?'>
        <textarea
          style={{ ...s.textarea, minHeight: 60 }}
          placeholder='e.g. Establish the comparison pattern. Reader understands JustAWoman is measuring herself against Chloe and losing.'
          value={form.scene_goal}
          onChange={e => set('scene_goal', e.target.value)}
        />
      </BriefField>

      {/* Emotional arc */}
      <div style={{ display: 'flex', gap: 12 }}>
        <BriefField label='EMOTIONAL STATE — START' style={{ flex: 1 }}>
          <input
            style={s.input}
            placeholder='e.g. Inspired but quietly deflated'
            value={form.emotional_state_start}
            onChange={e => set('emotional_state_start', e.target.value)}
          />
        </BriefField>
        <BriefField label='EMOTIONAL STATE — END' style={{ flex: 1 }}>
          <input
            style={s.input}
            placeholder='e.g. Cracked open — something is shifting'
            value={form.emotional_state_end}
            onChange={e => set('emotional_state_end', e.target.value)}
          />
        </BriefField>
      </div>

      {/* Private notes */}
      <BriefField label='PRIVATE NOTES' hint='Never exported — writer only'>
        <textarea
          style={{ ...s.textarea, minHeight: 60 }}
          placeholder='Anything you need to remember while writing this chapter…'
          value={form.chapter_notes}
          onChange={e => set('chapter_notes', e.target.value)}
        />
      </BriefField>

      {/* Actions */}
      <div style={s.editActions}>
        <button style={s.cancelBtn} onClick={() => setEditing(false)} type='button'>
          Cancel
        </button>
        <button
          style={{ ...s.saveBtn, opacity: saving ? 0.6 : 1 }}
          onClick={save}
          disabled={saving}
          type='button'
        >
          {saving ? 'Saving…' : 'Save Brief'}
        </button>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function BriefField({ label, hint, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 5 }}>
        <label style={s.fieldLabel}>{label}</label>
        {hint && <span style={s.fieldHint}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function typeColor(type) {
  const colors = {
    pressure: '#B85C38',
    mirror:   '#7B5EA7',
    support:  '#4A7C59',
    shadow:   '#8B6914',
    special:  '#C6A85E',
  };
  return colors[type] || '#C6A85E';
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  // Read view
  brief: {
    background: '#f5f0e8',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 3,
    padding: '12px 16px',
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  briefTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  briefLeft: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  characterPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'white',
    border: '1px solid rgba(30,25,20,0.1)',
    borderRadius: 20,
    padding: '3px 10px 3px 6px',
  },
  characterDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  characterName: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 12,
    color: 'rgba(30,25,20,0.8)',
    fontStyle: 'italic',
  },
  characterType: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(30,25,20,0.35)',
    letterSpacing: '0.06em',
    marginLeft: 2,
  },
  povBadge: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.1em',
    padding: '3px 8px',
    borderRadius: 2,
  },
  editBriefBtn: {
    background: 'none',
    border: '1px solid rgba(201,168,76,0.25)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.1em',
    color: '#8B6914',
    padding: '4px 10px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  briefLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.12em',
    color: 'rgba(30,25,20,0.3)',
    flexShrink: 0,
  },
  themeRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'baseline',
  },
  themeText: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.7)',
  },
  goalRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
  },
  goalText: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: 'rgba(30,25,20,0.55)',
    lineHeight: 1.5,
    letterSpacing: '0.03em',
  },
  emotionalRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  emotionalArc: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  emotionalState: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: '#B85C38',
    letterSpacing: '0.04em',
  },
  arcArrow: {
    color: 'rgba(30,25,20,0.2)',
    fontSize: 12,
  },
  notesIndicator: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(30,25,20,0.2)',
    letterSpacing: '0.08em',
  },
  emptyPrompt: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.04em',
    lineHeight: 1.5,
    fontStyle: 'italic',
  },

  // Edit form
  editForm: {
    background: '#faf9f7',
    border: '1px solid rgba(201,168,76,0.25)',
    borderRadius: 3,
    padding: '16px 18px',
    marginBottom: 16,
  },
  editHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '1px solid rgba(201,168,76,0.12)',
  },
  editTitle: {
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 16,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.85)',
    marginBottom: 3,
  },
  editSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(30,25,20,0.3)',
    letterSpacing: '0.06em',
  },
  fieldLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.14em',
    color: 'rgba(30,25,20,0.4)',
    textTransform: 'uppercase',
  },
  fieldHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(30,25,20,0.25)',
    letterSpacing: '0.04em',
    textTransform: 'none',
    fontWeight: 400,
  },
  select: {
    width: '100%',
    background: 'white',
    border: '1px solid rgba(30,25,20,0.12)',
    borderRadius: 2,
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.75)',
    padding: '8px 10px',
    cursor: 'pointer',
    outline: 'none',
  },
  povRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  povBtn: {
    background: 'white',
    border: '1px solid',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.08em',
    padding: '6px 12px',
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  input: {
    width: '100%',
    background: 'white',
    border: '1px solid rgba(30,25,20,0.12)',
    borderRadius: 2,
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.8)',
    padding: '8px 10px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    background: 'white',
    border: '1px solid rgba(30,25,20,0.12)',
    borderRadius: 2,
    fontFamily: "'Lora', Georgia, serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.8)',
    padding: '8px 10px',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.6,
    boxSizing: 'border-box',
  },
  editActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 4,
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid rgba(30,25,20,0.12)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.1em',
    color: 'rgba(30,25,20,0.4)',
    padding: '7px 14px',
    cursor: 'pointer',
  },
  saveBtn: {
    background: '#C6A85E',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.12em',
    color: '#14100c',
    fontWeight: 600,
    padding: '7px 16px',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
};
