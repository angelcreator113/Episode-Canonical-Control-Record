/**
 * CharacterTherapy.jsx \u2014 Psychological Narrative Engine
 *
 * A character arrives carrying the emotional residue of story events.
 * The author can listen, respond, reveal truths, or withhold them.
 * The character reacts based on wound patterns and psychological state.
 *
 * Location: frontend/src/pages/CharacterTherapy.jsx
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './CharacterTherapy.css';

const API = '/api/v1/therapy';

/* \u2500\u2500 Character Nature Map \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

const CHARACTER_NATURES = {
  the_husband:             { icon: '\u25C7', label: 'The Husband',             defense: 'Quiet withdrawal' },
  justawoman:              { icon: '\u25C8', label: 'JustaWoman',              defense: 'Deflection through competence' },
  lala:                    { icon: '\u25C9', label: 'LaLa',                    defense: 'Controlled presentation' },
  the_comparison_creator:  { icon: '\u25CA', label: 'The Comparison Creator',  defense: 'Weaponized comparison' },
  the_almost_mentor:       { icon: '\u25CB', label: 'The Almost Mentor',       defense: 'Strategic disappearance' },
  the_witness:             { icon: '\u25CC', label: 'The Witness',             defense: 'Strategic silence' },
};

/* \u2500\u2500 Defense Mechanisms \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

const DEFENSE_MECHANISMS = [
  'Quiet withdrawal',
  'Deflection through competence',
  'Controlled presentation',
  'Humor as deflection',
  'Weaponized comparison',
  'Strategic disappearance',
  'Over-preparation',
  'Selective vulnerability',
  'Strategic silence',
];

/* \u2500\u2500 Emotional Dimensions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

const EMOTIONAL_DIMENSIONS = [
  { key: 'trust', label: 'Trust',  color: '#d4af37' },
  { key: 'grief', label: 'Grief',  color: '#4646aa' },
  { key: 'anger', label: 'Anger',  color: '#8b2500' },
  { key: 'hope',  label: 'Hope',   color: '#2e8b57' },
  { key: 'fear',  label: 'Fear',   color: '#666666' },
  { key: 'love',  label: 'Love',   color: '#c2185b' },
];

/* ================================================================
   SUB-COMPONENTS
   ================================================================ */

/* \u2500\u2500 Event Trigger Input \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function EventTrigger({ onTrigger, disabled }) {
  const [event, setEvent] = useState('');
  const submit = () => {
    if (!event.trim()) return;
    onTrigger(event.trim());
    setEvent('');
  };
  return (
    <div className="therapy-event-trigger">
      <input
        className="therapy-event-input"
        placeholder="Describe the story event that just happened\u2026"
        value={event}
        onChange={e => setEvent(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        disabled={disabled}
      />
      <button
        className="therapy-event-btn"
        onClick={submit}
        disabled={disabled || !event.trim()}
      >
        Open Session
      </button>
    </div>
  );
}

/* \u2500\u2500 Message Bubble \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function Message({ msg }) {
  const type = msg.role; // 'character' | 'author' | 'system'
  const emotionClass = msg.dominantEmotion || '';
  return (
    <div className={`therapy-msg ${type} ${emotionClass}`}>
      <div className="therapy-msg-sender">
        {type === 'character' ? msg.characterName || 'Character'
          : type === 'author' ? 'You (Author)'
          : 'System'}
      </div>
      <div className="therapy-msg-bubble">{msg.text}</div>
      {msg.emotionTag && (
        <span className="therapy-msg-emotion">{msg.emotionTag}</span>
      )}
    </div>
  );
}

/* \u2500\u2500 Typing Indicator \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function TypingIndicator({ name }) {
  return (
    <div className="therapy-typing">
      <span className="therapy-typing-label">{name} is processing</span>
      <span className="therapy-typing-dot" />
      <span className="therapy-typing-dot" />
      <span className="therapy-typing-dot" />
    </div>
  );
}

/* \u2500\u2500 Psychological State Panel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function PsychologicalState({ profile }) {
  if (!profile) return null;
  const emo = profile.emotional_state || {};
  const known  = profile.known  || [];
  const sensed = profile.sensed || [];
  const never  = profile.never_knows || [];

  return (
    <div className="therapy-psych-panel">
      <div className="therapy-psych-title">Psychological State</div>

      {/* Emotion bars */}
      <div className="therapy-emotion-grid">
        {EMOTIONAL_DIMENSIONS.map(d => {
          const val = emo[d.key] ?? 50;
          return (
            <div key={d.key} className="therapy-emotion-item">
              <div className="therapy-emotion-label">{d.label}</div>
              <div className="therapy-emotion-bar-bg">
                <div
                  className={`therapy-emotion-bar-fill ${d.key}`}
                  style={{ width: `${val}%` }}
                />
              </div>
              <div className="therapy-emotion-value">{val}</div>
            </div>
          );
        })}
      </div>

      {/* Knowledge tiers */}
      <div className="therapy-knowledge-tiers">
        <KnowledgeTier tier="known"  label="Known"       items={known} />
        <KnowledgeTier tier="sensed" label="Sensed"      items={sensed} />
        <KnowledgeTier tier="never"  label="Never Knows" items={never} />
      </div>
    </div>
  );
}

/* \u2500\u2500 Knowledge Tier \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function KnowledgeTier({ tier, label, items }) {
  return (
    <div className={`therapy-knowledge-tier ${tier}`}>
      <div className="therapy-tier-label">{label}</div>
      {items.length > 0 ? (
        <ul className="therapy-tier-items">
          {items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      ) : (
        <div className="therapy-tier-empty">None yet</div>
      )}
    </div>
  );
}

/* \u2500\u2500 Reveal Modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function RevealModal({ onClose, onSend, charName, loading }) {
  const [truth, setTruth] = useState('');
  const [type, setType]   = useState('full');

  return (
    <div className="therapy-modal-overlay" onClick={onClose}>
      <div className="therapy-modal" onClick={e => e.stopPropagation()}>
        <div className="therapy-modal-title">
          Reveal Truth to {charName}
        </div>
        <textarea
          className="therapy-reveal-textarea"
          placeholder="What truth will you share?"
          value={truth}
          onChange={e => setTruth(e.target.value)}
        />
        <div className="therapy-reveal-type-row">
          {['full', 'partial', 'never'].map(t => (
            <button
              key={t}
              className={`therapy-reveal-type-btn ${type === t ? 'active' : ''}`}
              onClick={() => setType(t)}
            >
              {t === 'full' ? 'Full Truth' : t === 'partial' ? 'Partial' : 'Sealed'}
            </button>
          ))}
        </div>
        <div className="therapy-reveal-actions">
          <button className="therapy-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="therapy-reveal-send-btn"
            disabled={!truth.trim() || loading}
            onClick={() => onSend(truth.trim(), type)}
          >
            {loading ? 'Revealing\u2026' : 'Reveal'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* \u2500\u2500 D\u00e9j\u00e0 Vu Overlay \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function DejaVuOverlay({ text, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="therapy-dejavu-overlay">
      <div className="therapy-dejavu-text">{text || 'D\u00e9j\u00e0 vu\u2026'}</div>
    </div>
  );
}

/* \u2500\u2500 Empty State \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function EmptyState() {
  return (
    <div className="therapy-empty">
      <div className="therapy-empty-icon">{'\u25C7'}</div>
      <div className="therapy-empty-title">Psychological Narrative Engine</div>
      <div className="therapy-empty-sub">
        Select a character from the sidebar, then describe a story event to begin a therapy session.
      </div>
    </div>
  );
}

/* \u2500\u2500 Load Screen \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

function LoadScreen() {
  return (
    <div className="therapy-loading">
      <div className="therapy-loading-spinner" />
      <div className="therapy-loading-text">Loading psychological profiles\u2026</div>
    </div>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function CharacterTherapy() {
  const { registryId } = useParams();
  const navigate = useNavigate();

  /* State */
  const [characters, setCharacters]       = useState([]);
  const [selectedChar, setSelectedChar]   = useState(null);
  const [profile, setProfile]             = useState(null);
  const [messages, setMessages]           = useState([]);
  const [sessionOpen, setSessionOpen]     = useState(false);
  const [loading, setLoading]             = useState(true);
  const [busy, setBusy]                   = useState(false);
  const [response, setResponse]           = useState('');
  const [showReveal, setShowReveal]       = useState(false);
  const [dejaVu, setDejaVu]              = useState(null);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [waiting, setWaiting]             = useState([]);

  const chatRef = useRef(null);

  /* Auto-scroll chat on new messages */
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, busy]);

  /* == Load characters from registry ================================ */

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/v1/character-registry/registries/${registryId}`);
        const data = await res.json();
        if (data.success && data.registry?.characters) {
          setCharacters(data.registry.characters);
        }
      } catch (e) {
        console.error('Failed to load characters for therapy:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [registryId]);

  /* == Load waiting room (characters who knocked) =================== */

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/waiting`);
        const data = await res.json();
        if (Array.isArray(data)) setWaiting(data);
      } catch (e) {
        console.error('Failed to load waiting sessions:', e);
      }
    })();
  }, [selectedChar]);

  /* == Load psychological profile for selected character ============= */

  const loadProfile = useCallback(async (charId) => {
    try {
      const res = await fetch(`${API}/profile/${charId}`);
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
      }
    } catch (e) {
      console.error('Failed to load therapy profile:', e);
    }
  }, []);

  /* == Select character ============================================= */

  const selectCharacter = useCallback((char) => {
    setSelectedChar(char);
    setMessages([]);
    setSessionOpen(false);
    setProfile(null);
    setSidebarOpen(false);
    loadProfile(char.id);
  }, [loadProfile]);

  /* == Open Session ================================================= */

  const openSession = async (event) => {
    if (!selectedChar) return;
    setBusy(true);
    try {
      const charKey = (selectedChar.selected_name || selectedChar.display_name || '')
        .toLowerCase().replace(/\s+/g, '_');
      const res = await fetch(`${API}/session-open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: selectedChar.id,
          character_key: charKey,
          event_description: event,
          profile: profile,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSessionOpen(true);
        // Add system message about the event
        addMessage('system', `Session opened \u2014 ${event}`);
        // Add character arrival
        if (data.character_response) {
          addMessage('character', data.character_response, {
            characterName: selectedChar.display_name,
            emotionTag: data.emotional_shift ? formatShift(data.emotional_shift) : null,
            dominantEmotion: data.dominant_emotion,
          });
        }
        // Deja vu detection
        if (data.deja_vu_detected && data.deja_vu_echo) {
          setDejaVu(data.deja_vu_echo);
        }
        // Update profile
        if (data.updated_state) {
          setProfile(prev => prev ? { ...prev, emotional_state: data.updated_state } : prev);
        }
      }
    } catch (e) {
      console.error('Session open error:', e);
      addMessage('system', 'Failed to open session. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  /* == Respond to character ========================================= */

  const sendResponse = async () => {
    if (!response.trim() || !selectedChar) return;
    const text = response.trim();
    setResponse('');
    addMessage('author', text);
    setBusy(true);
    try {
      const charKey = (selectedChar.selected_name || selectedChar.display_name || '')
        .toLowerCase().replace(/\s+/g, '_');
      const res = await fetch(`${API}/session-respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: selectedChar.id,
          character_key: charKey,
          author_response: text,
          current_state: profile?.emotional_state || {},
          defense: profile?.primary_defense || CHARACTER_NATURES[charKey]?.defense || '',
        }),
      });
      const data = await res.json();
      if (data.success && data.character_response) {
        addMessage('character', data.character_response, {
          characterName: selectedChar.display_name,
          emotionTag: data.emotional_shift ? formatShift(data.emotional_shift) : null,
          dominantEmotion: data.dominant_emotion,
        });
        if (data.updated_state) {
          setProfile(prev => prev ? { ...prev, emotional_state: data.updated_state } : prev);
        }
        if (data.threshold_warning) {
          addMessage('system', data.threshold_warning);
        }
      }
    } catch (e) {
      console.error('Respond error:', e);
      addMessage('system', 'Failed to send response.');
    } finally {
      setBusy(false);
    }
  };

  /* == Reveal truth ================================================= */

  const sendReveal = async (truth, type) => {
    if (!selectedChar) return;
    setBusy(true);
    setShowReveal(false);
    try {
      const charKey = (selectedChar.selected_name || selectedChar.display_name || '')
        .toLowerCase().replace(/\s+/g, '_');
      addMessage('author', `[Revealed ${type}: ${truth}]`);
      const res = await fetch(`${API}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: selectedChar.id,
          character_key: charKey,
          truth,
          reveal_type: type,
          current_state: profile?.emotional_state || {},
        }),
      });
      const data = await res.json();
      if (data.success && data.character_response) {
        addMessage('character', data.character_response, {
          characterName: selectedChar.display_name,
          emotionTag: data.emotional_shift ? formatShift(data.emotional_shift) : null,
          dominantEmotion: data.dominant_emotion,
        });
        if (data.updated_state) {
          setProfile(prev => prev ? { ...prev, emotional_state: data.updated_state } : prev);
        }
        if (data.knowledge_update) {
          setProfile(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              known: data.knowledge_update.known || prev.known,
              sensed: data.knowledge_update.sensed || prev.sensed,
              never_knows: data.knowledge_update.never_knows || prev.never_knows,
            };
          });
        }
      }
    } catch (e) {
      console.error('Reveal error:', e);
      addMessage('system', 'Failed to process reveal.');
    } finally {
      setBusy(false);
    }
  };

  /* == Close session ================================================ */

  const closeSession = async () => {
    if (!selectedChar) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/session-close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character_id: selectedChar.id,
          emotional_state: profile?.emotional_state || {},
          baseline: profile?.baseline || {},
          session_log: messages,
          sessions_completed: (profile?.sessions_completed || 0) + 1,
          known: profile?.known || [],
          sensed: profile?.sensed || [],
          never_knows: profile?.never_knows || [],
          deja_vu_events: profile?.deja_vu_events || [],
          primary_defense: profile?.primary_defense || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        addMessage('system', 'Session closed. Emotional baseline updated.');
        setSessionOpen(false);
        if (data.profile) {
          setProfile(data.profile);
        }
      }
    } catch (e) {
      console.error('Close session error:', e);
      addMessage('system', 'Failed to close session.');
    } finally {
      setBusy(false);
    }
  };

  /* == Helpers ====================================================== */

  const addMessage = (role, text, opts = {}) => {
    setMessages(prev => [...prev, { role, text, ...opts, id: Date.now() + Math.random() }]);
  };

  const formatShift = (shift) => {
    if (!shift || typeof shift !== 'object') return '';
    return Object.entries(shift)
      .filter(([, v]) => v !== 0)
      .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)
      .join(' \u00b7 ');
  };

  const getCharNature = (char) => {
    const key = (char.selected_name || char.display_name || '')
      .toLowerCase().replace(/\s+/g, '_');
    return CHARACTER_NATURES[key] || { icon: '\u25C7', label: char.display_name, defense: '' };
  };

  /* == Render ======================================================= */

  if (loading) return <LoadScreen />;

  return (
    <div className="therapy-container">

      {/* Mobile sidebar toggle button */}
      <button
        className="therapy-sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle character list"
      >
        {sidebarOpen ? '\u2715' : '\u25C7'}
      </button>

      {/* Mobile backdrop */}
      <div
        className={`therapy-sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Sidebar ── */}
      <div className={`therapy-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <div className="therapy-sidebar-header">
          <div className="therapy-sidebar-label">Narrative Engine</div>
          <div className="therapy-sidebar-title">Character Therapy</div>
        </div>
        <div className="therapy-char-list">
          {/* ── Waiting Room ── */}
          {waiting.length > 0 && (
            <div className="therapy-waiting-room">
              <div style={{
                padding: '8px 14px',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#c45c5c',
                borderBottom: '1px solid rgba(200,100,100,0.15)',
              }}>
                Waiting Room
              </div>
              {waiting.map(w => {
                const typeColor =
                  w.character_type === 'pnos' ? '#c45c5c'
                  : w.character_type === 'press' ? '#c2185b'
                  : '#7a6565';
                return (
                  <button
                    key={w.id}
                    className="therapy-char-btn waiting"
                    style={{ borderLeft: `3px solid ${typeColor}` }}
                    onClick={async () => {
                      const match = characters.find(c =>
                        c.id === w.character_id || c.slug === w.character_slug
                      );
                      if (match) {
                        selectCharacter(match);
                        try {
                          await fetch(`${API}/clear-waiting/${w.id}`, { method: 'POST' });
                          setWaiting(prev => prev.filter(p => p.id !== w.id));
                        } catch {}
                      }
                    }}
                  >
                    <span className="char-icon" style={{ color: typeColor }}>◇</span>
                    <span className="char-name" style={{ fontSize: 11 }}>
                      {w.character_name}
                    </span>
                    <span style={{
                      display: 'block',
                      fontSize: 9,
                      color: '#a08080',
                      marginTop: 2,
                      fontStyle: 'italic',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '160px',
                    }}>
                      {w.knock_message?.slice(0, 60) || 'Waiting outside the door…'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {/* ── Character List ── */}
          {characters.map(c => {
            const nature = getCharNature(c);
            return (
              <button
                key={c.id}
                className={`therapy-char-btn ${selectedChar?.id === c.id ? 'active' : ''}`}
                onClick={() => selectCharacter(c)}
              >
                <span className="char-icon">{nature.icon}</span>
                <span className="char-name">{c.display_name}</span>
                <span className="char-sessions">
                  {profile?.sessions_completed || 0}
                </span>
              </button>
            );
          })}
          {characters.length === 0 && (
            <div style={{ padding: '20px 14px', color: '#a08080', fontSize: 11, textAlign: 'center' }}>
              No characters in this registry
            </div>
          )}
        </div>
      </div>

      {/* ── Main Panel ── */}
      <div className="therapy-main">
        {!selectedChar ? (
          <EmptyState />
        ) : (
          <>
            {/* Header */}
            <div className="therapy-header">
              <button
                className="therapy-back-btn"
                onClick={() => navigate('/character-registry')}
              >
                \u2190 Registry
              </button>
              <div className="therapy-header-info">
                <div className="therapy-header-name">
                  {getCharNature(selectedChar).icon} {selectedChar.display_name}
                </div>
                <div className="therapy-header-defense">
                  Defense: {getCharNature(selectedChar).defense || 'Unknown'}
                </div>
              </div>
              <div className="therapy-session-count">
                Sessions: {profile?.sessions_completed || 0}
              </div>
            </div>

            {/* Chat Messages */}
            <div className="therapy-chat" ref={chatRef}>
              {messages.length === 0 && !sessionOpen && (
                <div className="therapy-empty">
                  <div className="therapy-empty-icon">{getCharNature(selectedChar).icon}</div>
                  <div className="therapy-empty-title">
                    {selectedChar.display_name} is waiting
                  </div>
                  <div className="therapy-empty-sub">
                    Describe a story event below to begin the session.
                  </div>
                </div>
              )}
              {messages.map(msg => (
                <Message key={msg.id} msg={msg} />
              ))}
              {busy && <TypingIndicator name={selectedChar.display_name} />}
            </div>

            {/* Psychological State */}
            {profile && <PsychologicalState profile={profile} />}

            {/* Input Area */}
            <div className="therapy-input-area">
              {!sessionOpen ? (
                <EventTrigger onTrigger={openSession} disabled={busy} />
              ) : (
                <>
                  <div className="therapy-respond-row">
                    <input
                      className="therapy-respond-input"
                      placeholder="Respond as the author\u2026"
                      value={response}
                      onChange={e => setResponse(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendResponse()}
                      disabled={busy}
                    />
                    <button
                      className="therapy-respond-btn"
                      onClick={sendResponse}
                      disabled={busy || !response.trim()}
                    >
                      Send
                    </button>
                  </div>
                  <div className="therapy-actions-row">
                    <div className="therapy-actions-left">
                      <button
                        className="therapy-action-btn reveal"
                        onClick={() => setShowReveal(true)}
                        disabled={busy}
                      >
                        Reveal Truth
                      </button>
                    </div>
                    <div className="therapy-actions-right">
                      <button
                        className="therapy-action-btn close-session"
                        onClick={closeSession}
                        disabled={busy}
                      >
                        Close Session
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Reveal Modal */}
      {showReveal && (
        <RevealModal
          charName={selectedChar?.display_name || 'Character'}
          onClose={() => setShowReveal(false)}
          onSend={sendReveal}
          loading={busy}
        />
      )}

      {/* D\u00e9j\u00e0 Vu Overlay */}
      {dejaVu && (
        <DejaVuOverlay
          text={dejaVu}
          onDone={() => setDejaVu(null)}
        />
      )}
    </div>
  );
}
