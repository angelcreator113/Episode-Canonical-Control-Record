/**
 * VoiceModeButton.jsx
 * frontend/src/components/VoiceModeButton.jsx
 *
 * Drop-in button for the Character Registry dossier view.
 * Shows when character status is 'accepted' or 'finalized'.
 * Opens CharacterVoiceMode in 'voice' (deep session) mode.
 *
 * ════════════════════════════════════════════════════════════════════════
 * USAGE — add to CharacterDossier.jsx or the character detail view
 * ════════════════════════════════════════════════════════════════════════
 *
 *   import VoiceModeButton from '../components/VoiceModeButton';
 *
 *   // In the character action row (alongside Accept / Finalize buttons):
 *   <VoiceModeButton
 *     character={character}
 *     onProfileUpdate={() => refreshCharacter(character.id)}
 *   />
 *
 * Only renders if character.status is 'accepted' or 'finalized'.
 * Finalized characters are fully playable — they have the richest profiles.
 */

import { useState } from 'react';
import CharacterVoiceMode from '../pages/CharacterVoiceMode';

function typeColor(type) {
  return {
    protagonist: '#C9A84C', pressure: '#B85C38', mirror: '#7B5EA7',
    support: '#4A7C59',     shadow:   '#8B6914', special: '#C9A84C',
  }[type] || '#C9A84C';
}

export default function VoiceModeButton({ character, onProfileUpdate }) {
  const [open, setOpen] = useState(false);

  const eligible = character?.status === 'accepted' || character?.status === 'finalized';
  if (!eligible) return null;

  const color  = typeColor(character?.role_type);
  const name   = character?.selected_name || character?.display_name || 'this character';

  return (
    <>
      <button
        style={{
          background: 'none',
          border: `1px solid ${color}50`,
          borderRadius: 2,
          fontFamily: 'DM Mono, monospace',
          fontSize: 9,
          letterSpacing: '0.12em',
          color,
          padding: '7px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = `${color}12`;
          e.currentTarget.style.borderColor = `${color}80`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'none';
          e.currentTarget.style.borderColor = `${color}50`;
        }}
        onClick={() => setOpen(true)}
        title={`Talk to ${name} in their own voice`}
      >
        <span style={{ fontSize: 11 }}>{'\u25C8'}</span>
        TALK TO {name.toUpperCase()}
      </button>

      <CharacterVoiceMode
        character={character}
        mode="voice"
        open={open}
        onClose={() => setOpen(false)}
        onProfileUpdate={onProfileUpdate}
      />
    </>
  );
}
