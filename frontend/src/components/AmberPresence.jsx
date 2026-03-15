// AmberPresence.jsx — Light Theme
//
// Amber's session-aware greeting card. Fetches a contextual greeting on mount,
// types it out character by character, and optionally plays it via ElevenLabs.
//
// Usage:
//   import AmberPresence from '../components/AmberPresence';
//   <AmberPresence page="dashboard" />
//
// Props:
//   page       — current page slug for contextual greeting (default: 'dashboard')
//   className  — optional wrapper class

import { useState, useEffect, useRef, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// ── Light theme color tokens ──────────────────────────────────────────────────
const C = {
  bg:          '#faf8f5',       // warm ivory
  surface:     '#ffffff',       // white card
  surfaceHigh: '#f5f2ee',       // slightly warm grey for expanded state
  border:      '#e8e2da',       // warm grey border
  borderGlow:  '#d4789a33',     // pink glow border (translucent)
  text:        '#2c2731',       // charcoal body text
  textDim:     '#6b6173',       // muted secondary text
  textFaint:   '#9e95a8',       // faint labels
  pink:        '#c4607e',       // adjusted pink for light bg
  pinkSoft:    '#d4789a15',     // pink wash
  pinkMid:     '#d4789a40',     // pink mid accent
  blue:        '#5a8fa8',       // steel blue
  lavender:    '#8a6aab',       // deeper lavender
  gold:        '#a88a4e',       // warm gold
  goldSoft:    '#c9a96e18',     // gold wash
};

const TYPEWRITER_SPEED = 28; // ms per character — feels like thought, not machine

export default function AmberPresence({ page = 'dashboard', className = '' }) {
  const [greeting,     setGreeting]     = useState('');
  const [displayed,    setDisplayed]    = useState('');
  const [typing,       setTyping]       = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try { return localStorage.getItem('amber-voice') !== '0'; } catch { return true; }
  });
  const [speaking,     setSpeaking]     = useState(false);
  const [state,        setState]        = useState(null);
  const [expanded,     setExpanded]     = useState(false);

  const audioRef    = useRef(null);
  const timerRef    = useRef(null);
  const indexRef    = useRef(0);

  // ── Typewriter effect ──────────────────────────────────────────────────────
  const startTyping = useCallback((text) => {
    setTyping(true);
    setDisplayed('');
    indexRef.current = 0;

    const tick = () => {
      if (indexRef.current < text.length) {
        setDisplayed(text.slice(0, indexRef.current + 1));
        indexRef.current++;
        timerRef.current = setTimeout(tick, TYPEWRITER_SPEED);
      } else {
        setTyping(false);
      }
    };
    timerRef.current = setTimeout(tick, 400); // initial pause — she's thinking
  }, []);

  // ── Fetch greeting ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchGreeting() {
      setLoading(true);
      try {
        const res  = await fetch(`${API}/api/v1/amber/greeting?page=${page}`);
        const data = await res.json();
        if (cancelled) return;

        setGreeting(data.greeting || '');
        setState(data.state || null);
        startTyping(data.greeting || '');

        if (voiceEnabled) speakGreeting(data.greeting);
      } catch {
        if (!cancelled) {
          const fallback = 'The system is quiet. I am here.';
          setGreeting(fallback);
          startTyping(fallback);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchGreeting();
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, startTyping]);

  // ── Voice — ElevenLabs with browser TTS fallback ────────────────────────────
  async function speakGreeting(text) {
    if (!text) return;
    setSpeaking(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/api/v1/amber/speak`, {
        method:  'POST',
        headers,
        body:    JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('speak failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(() => {});
        audioRef.current.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
        };
      }
    } catch {
      // Fallback to browser speech synthesis
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 0.92;
        utter.pitch = 1.0;
        // Prefer a female English voice
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => /samantha|zira|female|karen/i.test(v.name) && /en/i.test(v.lang))
                       || voices.find(v => /en/i.test(v.lang));
        if (preferred) utter.voice = preferred;
        utter.onend = () => setSpeaking(false);
        utter.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utter);
      } else {
        setSpeaking(false);
      }
    }
  }

  function toggleVoice() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    try { localStorage.setItem('amber-voice', next ? '1' : '0'); } catch {}
    if (!next) {
      if (audioRef.current) audioRef.current.pause();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }

  function replayVoice() {
    if (greeting && voiceEnabled) speakGreeting(greeting);
  }

  // ── Stat pills from system state ───────────────────────────────────────────
  const pills = state ? [
    state.daysSinceNovelWork !== null && {
      label: state.daysSinceNovelWork === 0
        ? 'Novel touched today'
        : `Novel: ${state.daysSinceNovelWork}d ago`,
      color: state.daysSinceNovelWork > 7 ? C.pink : state.daysSinceNovelWork > 3 ? C.gold : C.blue,
    },
    state.pendingStories > 0 && {
      label: `${state.pendingStories} pending`,
      color: C.gold,
    },
    state.novelWordCount > 0 && {
      label: `${state.novelWordCount.toLocaleString()} words`,
      color: C.lavender,
    },
    state.charactersDraft > 0 && {
      label: `${state.charactersDraft} chars in draft`,
      color: C.textDim,
    },
  ].filter(Boolean) : [];

  return (
    <div
      className={className}
      style={{
        background:   C.surface,
        border:       `1px solid ${C.borderGlow}`,
        borderLeft:   `3px solid ${C.pink}`,
        borderRadius: '14px',
        padding:      '24px 28px',
        position:     'relative',
        overflow:     'hidden',
        boxShadow:    '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* Subtle background glow */}
      <div style={{
        position:   'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at 0% 0%, ${C.pinkSoft} 0%, transparent 70%)`,
        borderRadius: '14px',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', position: 'relative' }}>
        {/* Amber indicator — pulses when speaking */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: speaking ? C.pink : C.pinkMid,
            transition: 'background 0.3s',
            boxShadow:  speaking ? `0 0 0 4px ${C.pinkSoft}` : 'none',
          }} />
          {speaking && (
            <div style={{
              position: 'absolute', inset: '-4px',
              borderRadius: '50%', border: `1px solid ${C.pink}`,
              animation: 'amber-pulse 1.2s ease infinite',
            }} />
          )}
        </div>

        <span style={{
          fontFamily:    'Georgia, serif',
          fontSize:      '11px',
          fontWeight:    '700',
          color:         C.pink,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          Amber
        </span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Voice toggle */}
        <button
          onClick={toggleVoice}
          title={voiceEnabled ? 'Mute Amber' : 'Unmute Amber'}
          style={{
            background:   voiceEnabled ? C.pinkSoft : 'transparent',
            border:       `1px solid ${voiceEnabled ? C.pinkMid : C.border}`,
            borderRadius: '8px',
            padding:      '4px 8px',
            cursor:       'pointer',
            color:        voiceEnabled ? C.pink : C.textFaint,
            fontSize:     '11px',
            transition:   'all 0.15s',
            display:      'flex', alignItems: 'center', gap: '4px',
          }}
        >
          {voiceEnabled ? '\u25C9 voice on' : '\u25CB voice off'}
        </button>

        {/* Replay */}
        {voiceEnabled && !speaking && greeting && (
          <button
            onClick={replayVoice}
            title="Hear Amber again"
            style={{
              background:   'transparent',
              border:       `1px solid ${C.border}`,
              borderRadius: '8px',
              padding:      '4px 8px',
              cursor:       'pointer',
              color:        C.textFaint,
              fontSize:     '11px',
              transition:   'all 0.15s',
            }}
          >
            \u21BA
          </button>
        )}
      </div>

      {/* Greeting text */}
      <div style={{ position: 'relative', minHeight: '52px' }}>
        {loading ? (
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', paddingTop: '8px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: C.pink, opacity: 0.3,
                animation: `amber-think 1.2s ease ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
        ) : (
          <p style={{
            fontFamily:    'Georgia, serif',
            fontSize:      '15px',
            lineHeight:    '1.8',
            color:         C.text,
            margin:        0,
            letterSpacing: '0.01em',
          }}>
            {displayed}
            {typing && (
              <span style={{
                display:       'inline-block',
                width:         '2px',
                height:        '16px',
                background:    C.pink,
                marginLeft:    '2px',
                verticalAlign: 'middle',
                animation:     'amber-cursor 0.8s ease infinite',
              }} />
            )}
          </p>
        )}
      </div>

      {/* Stat pills */}
      {pills.length > 0 && !loading && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '16px' }}>
          {pills.map((pill, i) => (
            <span key={i} style={{
              padding:       '3px 10px',
              borderRadius:  '20px',
              fontSize:      '10px',
              fontWeight:    '600',
              letterSpacing: '0.05em',
              color:         pill.color,
              background:    pill.color + '15',
              border:        `1px solid ${pill.color}33`,
            }}>
              {pill.label}
            </span>
          ))}
        </div>
      )}

      {/* Expand for full state — subtle link */}
      {state && !loading && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background:    'none',
            border:        'none',
            padding:       '0',
            marginTop:     '12px',
            cursor:        'pointer',
            fontSize:      '11px',
            color:         C.textFaint,
            letterSpacing: '0.05em',
            transition:    'color 0.15s',
          }}
        >
          {expanded ? '\u2191 less' : '\u2193 full picture'}
        </button>
      )}

      {expanded && state && (
        <div style={{
          marginTop:    '12px',
          padding:      '14px',
          background:   C.surfaceHigh,
          borderRadius: '10px',
          border:       `1px solid ${C.border}`,
        }}>
          {[
            ['Novel last touched', state.daysSinceNovelWork !== null ? `${state.daysSinceNovelWork} days ago` : 'No data'],
            ['Total approved lines', state.totalApprovedStories],
            ['Word count', state.novelWordCount?.toLocaleString()],
            ['Pending stories', state.pendingStories],
            ['Pending memories', state.pendingMemories],
            ['Characters in draft', state.charactersDraft],
          ].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: C.textFaint }}>{label}</span>
              <span style={{ fontSize: '11px', color: C.textDim, fontWeight: '600' }}>{val ?? '\u2014'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Hidden audio element */}
      <audio ref={audioRef} style={{ display: 'none' }} />

      <style>{`
        @keyframes amber-pulse {
          0%   { transform: scale(1);   opacity: 0.8; }
          50%  { transform: scale(1.8); opacity: 0;   }
          100% { transform: scale(1);   opacity: 0;   }
        }
        @keyframes amber-cursor {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes amber-think {
          0%, 80%, 100% { opacity: 0.15; transform: scale(0.75); }
          40%           { opacity: 0.8;  transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
