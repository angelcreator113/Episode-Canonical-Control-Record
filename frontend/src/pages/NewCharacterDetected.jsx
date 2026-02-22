/**
 * NewCharacterDetected.jsx
 * frontend/src/pages/NewCharacterDetected.jsx
 *
 * Mid-interview notification card shown when Claude detects
 * a new character name that isn't already in the registry.
 *
 * Props:
 *   character   — { name, type, role, appearance_mode, belief, emotional_function, writer_notes }
 *   onConfirm   — called with the character object when author clicks "Add to registry"
 *   onDismiss   — called when author clicks "Not a character"
 *   registryId  — id of the active registry to create character in
 *   discoveredDuring — name of the interview subject (for context)
 */

import { useState } from 'react';

const REGISTRY_API = '/api/v1/character-registry';
const MEMORIES_API = '/api/v1/memories';

export default function NewCharacterDetected({
  character,
  onConfirm,
  onDismiss,
  registryId,
  discoveredDuring,
}) {
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      const res = await fetch(`${MEMORIES_API}/character-interview-create-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registry_id: registryId,
          character,
          discovered_during: discoveredDuring,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create character');
      onConfirm?.(data.character);
    } catch (err) {
      console.error('NewCharacterDetected create failed:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.card}>
      <div style={s.badge}>✦ NEW CHARACTER DETECTED</div>
      <div style={s.name}>{character.name}</div>
      {character.type && <div style={s.type}>{character.type}</div>}
      {character.role && <div style={s.role}>{character.role}</div>}
      <div style={s.actions}>
        <button
          style={{ ...s.confirmBtn, opacity: saving ? 0.6 : 1 }}
          onClick={handleConfirm}
          disabled={saving}
        >
          {saving ? 'Adding…' : 'Add to registry →'}
        </button>
        <button style={s.dismissBtn} onClick={onDismiss}>
          Not a character
        </button>
      </div>
    </div>
  );
}

const s = {
  card: {
    background: 'rgba(201,168,76,0.06)',
    border: '1px solid rgba(201,168,76,0.25)',
    borderRadius: 10,
    padding: '14px 18px',
    margin: '8px 0',
    maxWidth: 420,
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#C9A84C',
    marginBottom: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1E1914',
    marginBottom: 2,
  },
  type: {
    fontSize: 12,
    color: '#8B7E6A',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 2,
  },
  role: {
    fontSize: 13,
    color: '#5A4F44',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 8,
  },
  confirmBtn: {
    background: '#C9A84C',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  dismissBtn: {
    background: 'transparent',
    color: '#8B7E6A',
    border: '1px solid rgba(139,126,106,0.3)',
    borderRadius: 6,
    padding: '7px 14px',
    fontSize: 13,
    cursor: 'pointer',
  },
};
