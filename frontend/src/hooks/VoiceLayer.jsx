/**
 * VoiceLayer.jsx
 * frontend/src/hooks/VoiceLayer.jsx
 *
 * Two exports:
 *
 * 1. useVoice() hook — mic input + text-to-speech
 *    Used in any component that needs voice in/out
 *
 * 2. MicButton component — drop-in mic button for any input field
 *
 * 3. SpeakButton component — reads any text aloud on click
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * USAGE — useVoice hook:
 *
 *   import { useVoice } from '../hooks/VoiceLayer';
 *
 *   const { speak, startListening, stopListening, listening, supported } = useVoice();
 *
 *   speak("Tell me about Chloe like you're describing her to a friend.");
 *   startListening((transcript) => setInput(transcript));
 *
 * USAGE — MicButton (attach to any textarea):
 *
 *   import { MicButton } from '../hooks/VoiceLayer';
 *
 *   <div style={{ position: 'relative' }}>
 *     <textarea value={input} onChange={e => setInput(e.target.value)} />
 *     <MicButton onTranscript={(text) => setInput(prev => prev + text)} />
 *   </div>
 *
 * USAGE — SpeakButton (reads text aloud):
 *
 *   import { SpeakButton } from '../hooks/VoiceLayer';
 *
 *   <SpeakButton text="Tell me about Chloe." />
 *
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ── Check browser support ──────────────────────────────────────────────────

const hasSpeechRecognition = typeof window !== 'undefined' && !!(
  window.SpeechRecognition || window.webkitSpeechRecognition
);

const hasSpeechSynthesis = typeof window !== 'undefined' && !!window.speechSynthesis;

// ══════════════════════════════════════════════════════════════════════════
//  useVoice HOOK
// ══════════════════════════════════════════════════════════════════════════

export function useVoice() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking]   = useState(false);
  const [error, setError]         = useState(null);

  const recognitionRef = useRef(null);
  const finalRef       = useRef('');      // FIX: ref instead of closure var
  const callbackRef    = useRef(null);    // FIX: always-current callback ref
  const synthRef       = useRef(
    typeof window !== 'undefined' ? window.speechSynthesis : null
  );

  // ── TEXT TO SPEECH ───────────────────────────────────────────────────
  const speak = useCallback((text, options = {}) => {
    if (!hasSpeechSynthesis || !text) return;

    // Cancel any current speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Voice settings — warm, clear, natural
    utterance.rate   = options.rate   || 0.88;  // slightly slower than default
    utterance.pitch  = options.pitch  || 1.0;
    utterance.volume = options.volume || 0.95;

    // Try to find a natural-sounding voice
    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Samantha') ||   // macOS natural
      v.name.includes('Karen') ||      // macOS AU
      v.name.includes('Zira') ||       // Windows natural
      v.name.includes('Google US') ||  // Chrome
      (v.lang === 'en-US' && v.localService)
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend   = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    synthRef.current.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setSpeaking(false);
  }, []);

  // ── SPEECH RECOGNITION ───────────────────────────────────────────────────
  const startListening = useCallback((onTranscript) => {
    if (!hasSpeechRecognition) {
      setError('Voice input not supported in this browser. Try Chrome.');
      return;
    }

    // Store callback in ref — survives re-renders without stale closures
    callbackRef.current = onTranscript;

    // Abort any existing session before starting fresh
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.lang           = 'en-US';

    // FIX: Reset accumulator ref fresh for each new session
    finalRef.current = '';

    recognition.onstart = () => {
      setListening(true);
      setError(null);
      finalRef.current = '';
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';

      // FIX: Start from resultIndex — never reprocess already-committed results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalRef.current += text + ' ';
        } else {
          interimTranscript += text;
        }
      }

      // Live display during recording: committed + current interim
      // This is for the textarea only — NOT what gets sent as the answer
      const displayText = (finalRef.current + interimTranscript).trim();
      callbackRef.current?.(displayText, {
        final:   finalRef.current.trim(),
        interim: interimTranscript,
        isFinal: false,
      });
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Check browser permissions.');
      } else if (event.error === 'no-speech') {
        // Pause — not an error
      } else if (event.error !== 'aborted') {
        setError(`Voice error: ${event.error}`);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      // FIX: Fire ONE clean final callback — committed text only, no interim
      // This is the answer that gets sent to the interview / character questions
      const finalText = finalRef.current.trim();
      if (finalText) {
        callbackRef.current?.(finalText, {
          final:   finalText,
          interim: '',
          isFinal: true,  // <-- CharacterVoiceInterview watches for this to trigger send
        });
      }
      finalRef.current = '';
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    // .stop() gracefully ends session and triggers onend → final clean callback
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      synthRef.current?.cancel();
    };
  }, []);

  return {
    // Speech output
    speak,
    stopSpeaking,
    speaking,
    // Speech input
    startListening,
    stopListening,
    listening,
    // State
    error,
    // Support flags
    supported: {
      input:  hasSpeechRecognition,
      output: hasSpeechSynthesis,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  MicButton COMPONENT
//
//  Mode A — CONTROLLED (use when parent already has useVoice):
//    <MicButton
//      listening={listening}
//      onStart={() => startListening(myCallback)}
//      onStop={stopListening}
//    />
//    No internal recognizer created. No conflict.
//
//  Mode B — STANDALONE (original usage):
//    <MicButton onTranscript={(text, meta) => setInput(text)} />
//    Manages its own internal voice instance.
//
// ══════════════════════════════════════════════════════════════════════════

export function MicButton({
  listening:  externalListening,
  onStart,
  onStop,
  onTranscript,
  size = 'normal',
  style: customStyle,
}) {
  const internal     = useVoice();
  const isControlled = externalListening !== undefined;
  const isListening  = isControlled ? externalListening : internal.listening;

  if (!hasSpeechRecognition) return null;

  function handleClick() {
    if (isControlled) {
      isListening ? onStop?.() : onStart?.();
    } else {
      if (internal.listening) {
        internal.stopListening();
      } else {
        internal.startListening((text, meta) => onTranscript?.(text, meta));
      }
    }
  }

  const isSmall = size === 'small';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button
        style={{
          ...mic.btn,
          width:  isSmall ? 28 : 36,
          height: isSmall ? 28 : 36,
          background: isListening ? 'rgba(184,92,56,0.12)' : 'rgba(201,168,76,0.08)',
          border:     isListening ? '1px solid rgba(184,92,56,0.4)' : '1px solid rgba(201,168,76,0.25)',
          animation:  isListening ? 'vl-pulse 1.5s ease-in-out infinite' : 'none',
          ...customStyle,
        }}
        onClick={handleClick}
        title={isListening ? 'Stop recording' : 'Speak your answer'}
        type="button"
      >
        {isListening
          ? <span style={{ ...mic.icon, color: '#B85C38', fontSize: isSmall ? 13 : 16 }}>◼</span>
          : <span style={{ ...mic.icon, color: '#C9A84C', fontSize: isSmall ? 13 : 16 }}>🎤</span>
        }
      </button>

      {isListening && <div style={mic.listeningLabel}>listening…</div>}
      {!isControlled && internal.error && <div style={mic.errorLabel}>{internal.error}</div>}

      <style>{`
        @keyframes vl-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(184,92,56,0.3); }
          50%       { box-shadow: 0 0 0 6px rgba(184,92,56,0); }
        }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  SpeakButton COMPONENT
// ══════════════════════════════════════════════════════════════════════════

export function SpeakButton({ text, label, size = 'normal', style: customStyle }) {
  const { speak, stopSpeaking, speaking, supported } = useVoice();
  const [active, setActive] = useState(false);

  if (!supported.output || !text) return null;

  function handleClick() {
    if (active) {
      stopSpeaking();
      setActive(false);
    } else {
      setActive(true);
      speak(text);
      // Auto-reset after estimated duration
      const words = text.split(' ').length;
      const duration = (words / 2.5) * 1000; // ~2.5 words per second
      setTimeout(() => setActive(false), duration + 500);
    }
  }

  const isSmall = size === 'small';

  return (
    <button
      style={{
        ...spk.btn,
        padding: isSmall ? '2px 6px' : '4px 10px',
        color: active ? '#C9A84C' : 'rgba(30,25,20,0.3)',
        borderColor: active ? 'rgba(201,168,76,0.3)' : 'rgba(30,25,20,0.1)',
        ...customStyle,
      }}
      onClick={handleClick}
      title={active ? 'Stop reading' : 'Read aloud'}
      type='button'
    >
      <span style={{ fontSize: isSmall ? 10 : 12 }}>
        {active ? '◼' : '▶'}
      </span>
      {label && (
        <span style={spk.label}>{active ? 'Stop' : label}</span>
      )}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  VoiceConversation COMPONENT
//  Drop-in replacement for any text input that supports full voice conversation
// ══════════════════════════════════════════════════════════════════════════

export function VoiceConversation({
  question,           // The question/prompt to speak on mount
  onAnswer,           // Called with final transcript
  placeholder,
  autoSpeak = true,   // Speak the question automatically
}) {
  const { speak, startListening, stopListening, listening, supported } = useVoice();
  const [transcript, setTranscript] = useState('');
  const [spoken, setSpoken] = useState(false);

  // Auto-speak the question when it appears
  useEffect(() => {
    if (autoSpeak && question && supported.output && !spoken) {
      // Small delay so it feels natural
      const timer = setTimeout(() => {
        speak(question);
        setSpoken(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [question, autoSpeak]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleMicResult(text, meta) {
    setTranscript(text);
    if (meta?.isFinal && text.trim()) {
      onAnswer?.(text.trim());
    }
  }

  return (
    <div style={vc.shell}>
      <textarea
        style={vc.input}
        value={transcript}
        onChange={e => setTranscript(e.target.value)}
        placeholder={placeholder || 'Speak or type your answer…'}
        rows={4}
        spellCheck
      />
      <div style={vc.actions}>
        {supported.input && (
          <MicButton
            listening={listening}
            onStart={() => startListening(handleMicResult)}
            onStop={stopListening}
          />
        )}
        {supported.output && question && (
          <SpeakButton
            text={question}
            label='Re-read question'
            size='small'
          />
        )}
        {transcript.trim() && (
          <button
            style={vc.sendBtn}
            onClick={() => { onAnswer?.(transcript.trim()); setTranscript(''); }}
            type='button'
          >
            Send →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const mic = {
  btn: {
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  icon: {
    lineHeight: 1,
  },
  listeningLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 7,
    color: '#B85C38',
    letterSpacing: '0.1em',
    animation: 'vl-pulse 1.5s ease-in-out infinite',
  },
  errorLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 7,
    color: '#B85C38',
    letterSpacing: '0.04em',
    maxWidth: 160,
    textAlign: 'center',
  },
};

const spk = {
  btn: {
    background: 'none',
    border: '1px solid',
    borderRadius: 2,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.12s',
  },
  label: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.08em',
  },
};

const vc = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  input: {
    background: '#f5f0e8',
    border: '1px solid rgba(30,25,20,0.1)',
    borderRadius: 2,
    fontFamily: "'Playfair Display', serif",
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(30,25,20,0.82)',
    padding: '10px 12px',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.65,
    width: '100%',
    boxSizing: 'border-box',
  },
  actions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  sendBtn: {
    background: '#C9A84C',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.1em',
    color: '#14100c',
    fontWeight: 600,
    padding: '7px 14px',
    cursor: 'pointer',
    marginLeft: 'auto',
  },
};
