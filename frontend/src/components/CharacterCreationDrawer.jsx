/**
 * CharacterCreationDrawer.jsx
 * frontend/src/components/CharacterCreationDrawer.jsx
 *
 * Spark on-ramp only. Three fields → navigate to /character-generator
 * with the seed pre-approved in route state.
 *
 * The Character Generator is the destination. This is the fast lane in.
 *
 * Props:
 *   open    — boolean
 *   onClose — () => void
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CharacterCreationDrawer.css';

const ROLE_OPTIONS = [
  { value: 'pressure', label: 'Pressure',  hint: "Creates friction that forces growth" },
  { value: 'mirror',   label: 'Mirror',    hint: "Reflects what she can't see in herself" },
  { value: 'support',  label: 'Support',   hint: 'Present, invested, imperfect' },
  { value: 'shadow',   label: 'Shadow',    hint: 'The road not taken' },
  { value: 'special',  label: 'Special',   hint: 'Outside the normal taxonomy' },
];

export default function CharacterCreationDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const [name, setName]     = useState('');
  const [vibe, setVibe]     = useState('');
  const [role, setRole]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  function reset() {
    setName(''); setVibe(''); setRole('');
    setError(null); setLoading(false);
  }

  function handleClose() { reset(); onClose(); }

  function handleSpark() {
    if (!name.trim() || !vibe.trim() || !role) return;
    setLoading(true);

    const seed = {
      name:        name.trim(),
      vibe:        vibe.trim(),
      role_type:   role,
      world:       'book1',
      _status:     'approved',
      _from_spark: true,
    };

    navigate('/character-generator', { state: { sparkSeed: seed } });
    handleClose();
  }

  const canSpark = name.trim().length > 0 && vibe.trim().length > 0 && role.length > 0;

  if (!open) return null;

  return (
    <>
      <div className="ccd-backdrop" onClick={handleClose} />
      <div className="ccd-drawer">
        <div className="ccd-header">
          <div className="ccd-header-text">
            <div className="ccd-eyebrow">CHARACTER REGISTRY</div>
            <h2 className="ccd-title">New Character</h2>
            <p className="ccd-subtitle">Three fields. That's all it takes to build a complete interior architecture.</p>
          </div>
          <button className="ccd-close" onClick={handleClose}>×</button>
        </div>

        <div className="ccd-body">
          <div className="ccd-field">
            <label className="ccd-label">NAME</label>
            <input
              className="ccd-input"
              placeholder="What are you calling her right now"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canSpark && handleSpark()}
              autoFocus
            />
          </div>

          <div className="ccd-field">
            <label className="ccd-label">VIBE</label>
            <input
              className="ccd-input"
              placeholder="Who is she in one sentence — energy, aesthetic, presence"
              value={vibe}
              onChange={e => setVibe(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canSpark && handleSpark()}
            />
          </div>

          <div className="ccd-field">
            <label className="ccd-label">ROLE</label>
            <div className="ccd-role-grid">
              {ROLE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`ccd-role-btn ${role === opt.value ? 'ccd-role-selected' : ''}`}
                  onClick={() => setRole(opt.value)}
                  type="button"
                >
                  <span className="ccd-role-label">{opt.label}</span>
                  <span className="ccd-role-hint">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="ccd-error">{error}</div>}
        </div>

        <div className="ccd-footer">
          <p className="ccd-footer-note">Opens the Character Generator with your spark pre-loaded.</p>
          <button
            className="ccd-generate-btn"
            onClick={handleSpark}
            disabled={!canSpark || loading}
          >
            {loading ? 'Opening…' : 'Generate →'}
          </button>
        </div>
      </div>
    </>
  );
}
