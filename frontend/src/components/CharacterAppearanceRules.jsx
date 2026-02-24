/**
 * CharacterAppearanceRules.jsx
 * frontend/src/components/CharacterAppearanceRules.jsx
 *
 * Displays character appearance rules in the chapter brief.
 * Shows only the characters relevant to the active chapter.
 * Author marks which characters are present — panel shows their rules.
 */

import { useState } from 'react';
import { CHARACTER_APPEARANCE_RULES } from '../data/characterAppearanceRules';

const ALL_CHARS = Object.values(CHARACTER_APPEARANCE_RULES);

export default function CharacterAppearanceRules({ chapterCharacters = [], onCharacterToggle }) {
  const [expanded, setExpanded] = useState(false);
  const [openChar, setOpenChar] = useState(null);

  const activeChars = ALL_CHARS.filter(c =>
    chapterCharacters.includes(c.name.toLowerCase().replace(/\s+/g, '_'))
  );

  return (
    <div style={st.panel}>
      <div style={st.header} onClick={() => setExpanded(!expanded)}>
        <div style={st.headerLeft}>
          <div style={st.eyebrow}>CHARACTERS IN THIS CHAPTER</div>
          <div style={st.summary}>
            {activeChars.length === 0
              ? 'None selected — mark who\'s present'
              : activeChars.map(c => c.name).join(' · ')}
          </div>
        </div>
        <div style={st.caret}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div style={st.body}>
          {/* Character selector */}
          <div style={st.grid}>
            {ALL_CHARS.map(char => {
              const id = char.name.toLowerCase().replace(/\s+/g, '_');
              const isActive = chapterCharacters.includes(id);
              return (
                <button
                  key={id}
                  style={{
                    ...st.charChip,
                    borderColor: isActive ? char.color : 'rgba(30,25,20,0.1)',
                    color:       isActive ? char.color : 'rgba(30,25,20,0.35)',
                    background:  isActive ? `${char.color}0e` : 'white',
                  }}
                  onClick={() => onCharacterToggle?.(id)}
                >
                  <div style={{ ...st.chipDot, background: char.color, opacity: isActive ? 1 : 0.3 }} />
                  <div style={st.chipInfo}>
                    <div style={st.chipName}>{char.name}</div>
                    <div style={st.chipMode}>{char.appearance_mode.split(' — ')[0]}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active character rules */}
          {activeChars.length > 0 && (
            <div style={st.rules}>
              {activeChars.map(char => {
                const id = char.name.toLowerCase().replace(/\s+/g, '_');
                const isOpen = openChar === id;
                const violations = char.what_he_cannot_do || char.what_she_cannot_do || char.what_they_cannot_do || [];
                return (
                  <div key={id} style={{ ...st.charRule, borderLeftColor: char.color }}>
                    <div style={st.charRuleHeader} onClick={() => setOpenChar(isOpen ? null : id)}>
                      <div style={st.charRuleName} >{char.name}</div>
                      <div style={{ ...st.modeBadge, color: char.color }}>{char.appearance_mode}</div>
                      <div style={st.rulesCaret}>{isOpen ? '▲' : '▼'}</div>
                    </div>

                    {/* Always show the first (most critical) rule */}
                    <div style={st.criticalRule}>
                      {char.rules[0]}
                    </div>

                    {isOpen && (
                      <div style={st.ruleDetail}>
                        {char.rules.slice(1).map((r, i) => (
                          <div key={i} style={st.ruleItem}>· {r}</div>
                        ))}
                        {violations.length > 0 && (
                          <div style={st.violations}>
                            <div style={st.violationsLabel}>CANNOT:</div>
                            {violations.map((v, i) => (
                              <div key={i} style={st.violationItem}>✕ {v}</div>
                            ))}
                          </div>
                        )}
                        {(char.how_he_enters || char.how_she_enters) && (
                          <div style={st.entryNote}>
                            <span style={st.entryLabel}>HOW THEY ENTER: </span>
                            {char.how_he_enters || char.how_she_enters}
                          </div>
                        )}
                        {char.absence_tracking && (
                          <div style={st.absenceNote}>
                            <span style={st.absenceLabel}>ABSENCE: </span>
                            {char.absence_tracking}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const st = {
  panel: {
    border: '1px solid rgba(219,112,147,0.18)',
    borderRadius: 6, overflow: 'hidden', marginBottom: 10,
    background: '#FFF0F3',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '12px 14px', cursor: 'pointer', gap: 10,
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 3, flex: 1 },
  eyebrow: {
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    letterSpacing: '0.2em', color: 'rgba(180,80,120,0.55)',
  },
  summary: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 13, fontStyle: 'italic', color: 'rgba(100,40,60,0.65)',
  },
  caret: { fontFamily: 'DM Mono, monospace', fontSize: 8, color: 'rgba(180,80,120,0.3)' },
  body: {
    borderTop: '1px solid rgba(219,112,147,0.12)',
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12,
  },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  charChip: {
    display: 'flex', alignItems: 'center', gap: 7,
    border: '1px solid', borderRadius: 2,
    padding: '6px 10px', cursor: 'pointer',
    transition: 'all 0.12s', textAlign: 'left',
  },
  chipDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0, transition: 'opacity 0.15s' },
  chipInfo: { display: 'flex', flexDirection: 'column', gap: 1 },
  chipName: {
    fontFamily: 'DM Mono, monospace', fontSize: 9.5,
    fontWeight: 600, letterSpacing: '0.06em',
  },
  chipMode: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.04em', opacity: 0.6,
  },
  rules: { display: 'flex', flexDirection: 'column', gap: 8 },
  charRule: {
    borderLeft: '2px solid', paddingLeft: 10,
    display: 'flex', flexDirection: 'column', gap: 5,
  },
  charRuleHeader: {
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
  },
  charRuleName: {
    fontFamily: 'DM Mono, monospace', fontSize: 10,
    fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(100,40,60,0.7)',
  },
  modeBadge: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.06em', flex: 1,
  },
  rulesCaret: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(180,80,120,0.3)',
  },
  criticalRule: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 12.5, fontStyle: 'italic',
    color: 'rgba(100,40,60,0.65)', lineHeight: 1.55,
  },
  ruleDetail: { display: 'flex', flexDirection: 'column', gap: 5 },
  ruleItem: {
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    color: 'rgba(100,40,60,0.5)', letterSpacing: '0.03em', lineHeight: 1.55,
  },
  violations: {
    display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4,
    background: 'rgba(184,92,56,0.06)', border: '1px solid rgba(184,92,56,0.15)',
    borderRadius: 3, padding: '7px 9px',
  },
  violationsLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.15em', color: '#B85C38', marginBottom: 2,
  },
  violationItem: {
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    color: 'rgba(184,92,56,0.7)', letterSpacing: '0.03em', lineHeight: 1.5,
  },
  entryNote: {
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    color: 'rgba(100,40,60,0.55)', letterSpacing: '0.03em', lineHeight: 1.6,
    marginTop: 3,
  },
  entryLabel: { color: 'rgba(180,80,120,0.35)', letterSpacing: '0.12em', fontSize: 8 },
  absenceNote: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(139,105,20,0.7)', letterSpacing: '0.03em', lineHeight: 1.6,
    background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)',
    borderRadius: 2, padding: '6px 9px', marginTop: 3,
  },
  absenceLabel: { color: '#8B6914', letterSpacing: '0.12em', fontSize: 7 },
};
