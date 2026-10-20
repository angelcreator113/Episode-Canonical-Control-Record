// frontend/src/components/Teleprompter/TeleprompterReader.jsx
// The teleprompter's full-screen reader (Evoni, 2026-10-20: "I need a
// teleprompter for my script and I need a way to be able to read the script
// and record at the same time"). One reader for both sources:
//   a picked script: the whole script, beat headings and a beat jump list;
//     "My lines big" (her lines bright and large, everyone else a dim cue,
//     stage directions dim italic) or "Everything the same"; production cue
//     lines ([UI:], [STAT:], [WEAR:], [TRANSITION:]) never show;
//   pasted text: as written, paragraphs kept.
// A reading line a third of the way down, auto-scroll, text size, a speed
// slider, mirror (for a beam-splitter), an optional 3-2-1. "Read & record"
// opens the front camera: with a script, one beat at a time, each take saved
// to the episode's Files with its beat; with pasted text, the take downloads.
// "Read as" (Evoni, 2026-10-20: "If I choose for example to read Lala's line
// can we make it so I know how much time I should stay silent and react while
// JustAWoman is reading her lines?"): whose lines are hers; every other
// spoken line, on the reading line, shows "Stay quiet · react" counting down
// its estimated time, an action "Action · Ns". "Pace by line times" holds
// each line on the reading line for its time, scaled by the pace slider.
// Batch 1 (Evoni, 2026-10-20): "Follow my voice" scrolls with what she
// says (lib/voiceFollow); time per beat while rehearsing a script, against
// the estimate; `//` pause, `*word*` emphasis and (breath) marks; a mic
// meter with a no-sound warning, and a framing grid on the camera preview.
// Batch 2 (Evoni, 2026-10-20): "Takes" lists the beat's takes already in
// Files, with a preview and a ★ (one favourite per beat); "Start from" picks
// the line within the beat a take begins on, and the take's name and its
// start_line say so.
// Keys: Space play/pause, Up/Down speed (or pace), PageUp/PageDown jump a
// half screen (a line, pacing by line times; clickers and foot pedals send
// these), Left/Right beat, Escape exits.

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronLeft, ChevronRight, Play, Pause, FlipHorizontal2, Timer, Video, VideoOff, Circle, Square,
  RotateCcw, Upload, Download, AlertTriangle, CheckCircle2, ALargeSmall, Gauge, Hourglass, SlidersHorizontal,
  AudioLines, Grid3x3, Clock, Film,
} from 'lucide-react';
import useVoiceFollow from '../../hooks/useVoiceFollow';
import useMicLevel from '../../hooks/useMicLevel';
import { advance, speechRecognition } from '../../lib/voiceFollow';
import { spokenWords, pauseCount } from '../../lib/teleprompterMarks';
import { beatSeconds } from '../../lib/scriptRuntime';
import { SESSION_KEY, SAVED_KEY, readTimes, writeTimes, durationText } from '../../lib/rehearsal';
import { cameraErrorMessage } from '../../lib/teleprompterLines';
import { MarkedText, MicMeter, FramingGrid, RehearsalPanel } from './TeleprompterParts';
import TakesPanel from './TeleprompterTakes';
import useDialogLayer from '../../hooks/useDialogLayer';
import useTakeRecorder from '../../hooks/useTakeRecorder';
import { teleprompterScript, pastedParagraphs, pastedScript, speakersOf, HER, takeName, takeExtension, downloadName, clock, lineChoice } from '../../lib/teleprompterLines';
import { rawClipsApi, hasTakeFields, beatTakes, withFavorite } from '../../lib/rawClipsApi';

export const SETTINGS_KEY = 'teleprompter.settings';
export const SIZE_MIN = 20;
export const SIZE_MAX = 96;
export const SPEED_MIN = 1;
export const SPEED_MAX = 20;
const PX_PER_STEP = 8; // speed 5 scrolls 40px a second
export const PACE_MIN = 0.5;
export const PACE_MAX = 2;
export const DEFAULTS = { size: 40, speed: 5, mirror: false, countdown: true, lineMode: 'mine', readAs: HER, pacing: 'steady', pace: 1, grid: false };
// Below this level for this long while recording: "No sound from your mic".
const QUIET_LEVEL = 0.04;
const QUIET_MS = 3000;
const roundPace = (n) => Math.round(n * 10) / 10;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** The viewer's settings on this device (localStorage), or the defaults. */
export function readSettings() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}') || {};
    return {
      size: Number.isFinite(raw.size) ? clamp(raw.size, SIZE_MIN, SIZE_MAX) : DEFAULTS.size,
      speed: Number.isFinite(raw.speed) ? clamp(raw.speed, SPEED_MIN, SPEED_MAX) : DEFAULTS.speed,
      mirror: typeof raw.mirror === 'boolean' ? raw.mirror : DEFAULTS.mirror,
      countdown: typeof raw.countdown === 'boolean' ? raw.countdown : DEFAULTS.countdown,
      lineMode: raw.lineMode === 'same' ? 'same' : 'mine',
      readAs: typeof raw.readAs === 'string' && raw.readAs.trim() ? raw.readAs : HER,
      pacing: ['lines', 'voice'].includes(raw.pacing) ? raw.pacing : 'steady',
      grid: typeof raw.grid === 'boolean' ? raw.grid : DEFAULTS.grid,
      pace: Number.isFinite(raw.pace) ? clamp(roundPace(raw.pace), PACE_MIN, PACE_MAX) : DEFAULTS.pace,
    };
  } catch (err) {
    console.error('[Teleprompter] settings not read:', err);
    return { ...DEFAULTS };
  }
}

const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]), video[controls], [href], [tabindex]:not([tabindex="-1"])';
// Keys typed into these keep their own meaning.
const OWN_KEYS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'VIDEO']);
const frame = (cb) => (typeof window.requestAnimationFrame === 'function'
  ? window.requestAnimationFrame(cb)
  : window.setTimeout(() => cb(performance.now()), 16));
const unframe = (id) => (typeof window.cancelAnimationFrame === 'function' ? window.cancelAnimationFrame(id) : window.clearTimeout(id));

// The viewer asked for less motion: the silence cue shows its number, no bar.
const reducedMotion = () => {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch (err) {
    console.error('[Teleprompter] reduced-motion not read:', err);
    return false;
  }
};

// Where an element sits in the scroll box's content (works mirrored too).
const topIn = (el, box) => el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;

// A line; `wordStart`/`cursor` number its words for Follow my voice.
function Line({ l, mine, at, lineRef, index, wordStart = null, cursor = -1, from = 0 }) {
  const common = { ref: lineRef, 'data-line': index, 'data-at': at || undefined };
  if (l.kind === 'para') return <p {...common} className="stp-para" data-testid="stp-para"><MarkedText text={l.text} wordStart={wordStart} cursor={cursor} from={from} /></p>;
  if (l.kind === 'breath') {
    return <p {...common} className="stp-direction is-breath" data-testid="stp-breath"><MarkedText text="(breath)" /> <span className="stp-sr">breath</span></p>;
  }
  if (l.kind === 'direction') return <p {...common} className="stp-direction" data-testid="stp-direction"><MarkedText text={l.text} /></p>;
  return (
    <div {...common} className={`stp-line is-${mine ? 'mine' : 'cue'}`} data-testid={mine ? 'stp-mine' : 'stp-cue'}>
      <span className="stp-speaker">{l.speaker}</span>
      {l.paren && <span className="stp-paren"><MarkedText text={l.paren} /></span>}
      <p className="stp-words"><MarkedText text={l.text} wordStart={wordStart} cursor={cursor} from={from} /></p>
    </div>
  );
}

// "Stay quiet · react" while someone else's line is on the reading line, or
// "Action · Ns" for a stage direction (Evoni, 2026-10-20).
function SilenceCue({ line, left, total, reduced }) {
  const n = Math.max(0, Math.ceil(left - 0.05));
  if (line.kind === 'direction') return <div className="stp-quiet is-action" role="status" data-testid="stp-quiet">Action · {n}s</div>;
  if (line.kind === 'breath') return <div className="stp-quiet is-action" role="status" data-testid="stp-quiet">Breath · {n}s</div>;
  const frac = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  return (
    <div className="stp-quiet" role="status" data-testid="stp-quiet">
      <span className="stp-quiet-label">Stay quiet · react</span>
      <span className="stp-quiet-n" data-testid="stp-quiet-n">{n}s</span>
      <span className="stp-quiet-who">{line.speaker}</span>
      {!reduced && <span className="stp-quiet-bar" data-testid="stp-quiet-bar" aria-hidden="true"><span style={{ transform: `scaleX(${frac})` }} /></span>}
    </div>
  );
}

/**
 * source: { kind: 'script', scriptText, episodeId, title } | { kind: 'text', text }.
 * startBeat: the beat number to open on. countdownMs: one count of the 3-2-1.
 */
export default function TeleprompterReader({ source, startBeat = null, onClose, countdownMs = 1000 }) {
  const isScript = source?.kind === 'script';
  const script = useMemo(() => (isScript ? teleprompterScript(source.scriptText) : null), [isScript, source?.scriptText]);
  const pasted = useMemo(() => (isScript ? null : pastedScript(source?.text)), [isScript, source?.text]);
  const paragraphs = useMemo(() => (isScript || pasted ? [] : pastedParagraphs(source?.text)), [isScript, pasted, source?.text]);
  const beats = script?.beats || [];
  const numbered = beats.some((b) => b.number !== null);

  const [settings, setSettings] = useState(readSettings);
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const [current, setCurrent] = useState(() => {
    const at = beats.findIndex((b) => b.number != null && Number(b.number) === Number(startBeat));
    return at >= 0 ? at : 0;
  });
  const [playing, setPlaying] = useState(false);
  const [count, setCount] = useState(0); // the 3-2-1 on screen
  const [recordOn, setRecordOn] = useState(false);
  const [save, setSave] = useState({ status: 'idle', progress: 0, error: null, clip: null });
  const [notice, setNotice] = useState(null);
  const [clips, setClips] = useState([]); // the episode's clips already in Files
  const [clipsLoaded, setClipsLoaded] = useState(false);
  const [showTakes, setShowTakes] = useState(false);
  const [starring, setStarring] = useState(null);
  const [takesError, setTakesError] = useState(null);
  // The line within the beat the next take starts on (0 = the top).
  const [startLine, setStartLine] = useState(0);
  const [sessionTakes, setSessionTakes] = useState(0); // pasted-text takes this visit
  const [reduced] = useState(reducedMotion);
  const [more, setMore] = useState(false);

  const rec = useTakeRecorder(recordOn);
  const { take, recording } = rec;
  const busyTake = recording || count > 0 || !!take;
  const oneBeat = isScript && recordOn && beats.length > 0;
  const beat = beats[current] || null;
  // Follow my voice falls back to the steady scroll where the browser can't listen.
  const voiceSupported = !!speechRecognition();
  const pacing = settings.pacing === 'voice' && !voiceSupported ? 'steady' : settings.pacing;
  const pace = settings.pace;

  // Every line in reading order, and where each beat's lines start.
  const layout = useMemo(() => {
    const flat = [];
    const beatFirst = [];
    if (isScript) {
      if (!oneBeat) flat.push(...script.intro);
      beats.forEach((b, i) => {
        if (oneBeat && i !== current) return;
        beatFirst[i] = flat.length;
        flat.push(...b.lines);
      });
    } else if (pasted) pasted.forEach((g) => flat.push(...g));
    else paragraphs.forEach((p) => flat.push({ kind: 'para', who: null, text: p, seconds: 0 }));
    return { flat, beatFirst };
  }, [isScript, oneBeat, script, beats, current, pasted, paragraphs]);
  const { flat } = layout;
  // Lines with speakers and times (not plain pasted prose).
  const hasLines = flat.some((l) => l.kind !== 'para');

  // "Read as": whose lines are hers; JustAWoman unless she picks another.
  const speakers = useMemo(() => speakersOf(isScript ? [...script.intro, ...beats.flatMap((b) => b.lines)] : (pasted || []).flat()), [isScript, script, beats, pasted]);
  const readAsChoices = speakers.length ? [...new Set([HER, 'Lala', ...speakers])] : [];
  // A name saved from another script that is not in this one reads as JustAWoman.
  const readAs = readAsChoices.includes(settings.readAs) ? settings.readAs : HER;
  const isMine = (l) => l.kind === 'para' || (!!l.who && l.who === readAs);

  // Follow my voice: her words in order, and where each of her lines starts.
  const voiceWords = useMemo(() => {
    const words = [];
    const start = [];
    const end = [];
    flat.forEach((l, i) => {
      if (!(l.kind === 'para' || (l.who && l.who === readAs))) return;
      start[i] = words.length;
      spokenWords(l.text).forEach((w) => words.push({ w: w.w, line: i }));
      end[i] = words.length;
    });
    return { words, start, end };
  }, [flat, readAs]);

  const [active, setActive] = useState(() => layout.beatFirst[current] ?? 0);
  // Follow my voice: the next word she has to say (an index in voiceWords).
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  // Where she started reading this time: words from here to the cursor read as said.
  const [voiceFrom, setVoiceFrom] = useState(0);
  const voiceOn = pacing === 'voice';

  const dialogRef = useRef(null);
  const scrollRef = useRef(null);
  const beatRefs = useRef([]);
  const lineRefs = useRef([]);
  const posRef = useRef(0);
  const timersRef = useRef([]);
  const previewRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useDialogLayer(true);

  // Focus in on open and back to the opener; the page behind does not scroll.
  useLayoutEffect(() => {
    const opener = document.activeElement;
    document.body.classList.add('stp-open');
    dialogRef.current?.focus();
    return () => {
      document.body.classList.remove('stp-open');
      if (opener && typeof opener.focus === 'function' && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (err) { console.error('[Teleprompter] settings not kept:', err); }
  }, [settings]);

  const clearTimers = () => { timersRef.current.forEach((t) => window.clearTimeout(t)); timersRef.current = []; };
  useEffect(() => clearTimers, []);

  // The clips already in Files: the beat's takes, and the next take is "take 3".
  const episodeId = isScript ? source.episodeId : null;
  useEffect(() => {
    if (!episodeId) return undefined;
    let live = true;
    rawClipsApi.list(episodeId)
      .then((rows) => { if (live) setClips(rows); })
      .catch((err) => console.error('[Teleprompter] could not count the takes in Files:', err))
      .finally(() => { if (live) setClipsLoaded(true); });
    return () => { live = false; };
  }, [episodeId, recordOn]);

  // The live preview shows the camera.
  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = rec.stream || null;
  }, [rec.stream]);

  // An unsaved or running take asks before the browser leaves.
  useEffect(() => {
    if (!busyTake) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busyTake]);

  const scrollToBox = (top) => {
    const box = scrollRef.current;
    if (!box) return;
    posRef.current = Math.max(0, top);
    box.scrollTop = posRef.current;
  };
  const scrollToLine = (i) => {
    const el = lineRefs.current[i];
    const box = scrollRef.current;
    if (el && box) scrollToBox(topIn(el, box) - box.clientHeight / 3);
  };
  const scrollToWord = (i) => {
    const box = scrollRef.current;
    const el = box?.querySelector(`[data-vw="${i}"]`);
    if (el) scrollToBox(topIn(el, box) - box.clientHeight / 3);
  };
  const moveCursor = (c) => { cursorRef.current = c; setCursor(c); };
  // Her place: the first of her words at or after line `at`.
  const syncCursor = (at) => {
    const { words, start, end } = voiceWords;
    if (words[cursorRef.current]?.line === at) return cursorRef.current;
    for (let i = Math.max(0, at); i < flat.length; i += 1) {
      if (start[i] != null && end[i] > start[i]) { moveCursor(start[i]); return start[i]; }
    }
    moveCursor(words.length);
    return words.length;
  };

  // Follow my voice: a line finished, the next comes up; someone else's
  // line counts down its time, then the prompter goes on by itself.
  const nextAfter = (line) => {
    const next = line + 1;
    if (next >= flat.length) { setPlaying(false); return; }
    setActive(next);
    if (voiceWords.start[next] != null) {
      const c = Math.max(cursorRef.current, voiceWords.start[next]);
      moveCursor(c);
      scrollToWord(c);
    } else scrollToLine(next);
  };
  const onHeard = (heard) => {
    const { words, end } = voiceWords;
    const next = advance(words, cursorRef.current, heard);
    if (next <= cursorRef.current) return;
    moveCursor(next);
    const line = words[next - 1].line;
    if (next >= end[line]) nextAfter(line);
    else { setActive(line); scrollToWord(next); }
  };
  const voice = useVoiceFollow(voiceOn && playing, { onHeard, recording });
  useEffect(() => {
    if (!voiceOn || !playing || !flat.length) return undefined;
    const l = flat[active];
    if (!l) return undefined;
    const wordless = voiceWords.start[active] != null && voiceWords.end[active] <= voiceWords.start[active];
    if (isMine(l) && !wordless) return undefined;
    scrollToLine(active);
    const t = window.setTimeout(() => nextAfter(active), Math.max(200, ((l.seconds || 0) + pauseCount(l.text)) * 1000));
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, playing, active, flat, readAs]);

  // Follow my voice while reading: the mic for the meter (recording has its own).
  const [voiceMic, setVoiceMic] = useState(null);
  const [voiceMicError, setVoiceMicError] = useState(null);
  useEffect(() => {
    if (!voiceOn || recordOn || !navigator.mediaDevices?.getUserMedia) return undefined;
    let live = true;
    let got = null;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((st) => {
        if (!live) { (st.getTracks?.() || []).forEach((t) => t.stop()); return; }
        got = st;
        setVoiceMic(st);
        setVoiceMicError(null);
      })
      .catch((err) => {
        console.error('[Teleprompter] microphone did not start for Follow my voice:', err);
        if (live) setVoiceMicError(err?.name === 'NotAllowedError' ? 'The microphone is blocked for Follow my voice. Allow it for this site in the browser, then try again.' : cameraErrorMessage(err));
      });
    return () => {
      live = false;
      (got?.getTracks?.() || []).forEach((t) => { try { t.stop(); } catch (err) { console.error('[Teleprompter] mic track did not stop:', err); } });
      setVoiceMic(null);
    };
  }, [voiceOn, recordOn]);
  const meterStream = recordOn ? rec.stream : voiceMic;
  const level = useMicLevel(meterStream);
  const levelRef = useRef(0);
  levelRef.current = level;
  // Recording and nothing heard for 3 seconds: say so.
  const [silent, setSilent] = useState(false);
  useEffect(() => {
    if (!recording) { setSilent(false); return undefined; }
    let loud = Date.now();
    const t = window.setInterval(() => {
      const now = Date.now();
      if (levelRef.current > QUIET_LEVEL) loud = now;
      setSilent(now - loud > QUIET_MS);
    }, 250);
    return () => window.clearInterval(t);
  }, [recording]);

  // Steady speed: speed steps of 8px a second, from wherever the text is.
  useEffect(() => {
    if (!playing || pacing !== 'steady') return undefined;
    const box = scrollRef.current;
    if (!box) return undefined;
    posRef.current = box.scrollTop;
    let last = null;
    let id;
    const step = (t) => {
      if (last != null) {
        posRef.current += ((t - last) / 1000) * settings.speed * PX_PER_STEP;
        box.scrollTop = posRef.current;
        if (box.scrollHeight > box.clientHeight && box.scrollTop + box.clientHeight >= box.scrollHeight - 1) { setPlaying(false); return; }
      }
      last = t;
      id = frame(step);
    };
    id = frame(step);
    return () => unframe(id);
  }, [playing, pacing, settings.speed]);

  // Pace by line times: each line holds on the reading line for its time
  // (divided by the pace), then the next comes up.
  useEffect(() => {
    if (!playing || pacing !== 'lines' || !flat.length) return undefined;
    const i = clamp(active, 0, flat.length - 1);
    scrollToLine(i);
    // A `//` pause holds a second more.
    const ms = Math.max(200, (((flat[i].seconds || 0) + pauseCount(flat[i].text)) / pace) * 1000);
    const t = window.setTimeout(() => {
      if (i >= flat.length - 1) setPlaying(false);
      else setActive(i + 1);
    }, ms);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, pacing, active, pace, flat]);

  // The silence cue counts down the line on the reading line while the
  // prompter runs; paused, it waits.
  const atLine = flat[active] || null;
  const cueTotal = atLine ? (pacing === 'lines' ? ((atLine.seconds || 0) + pauseCount(atLine.text)) / pace : (atLine.seconds || 0)) : 0;
  const showCue = !!atLine && !isMine(atLine) && cueTotal > 0;
  const [cueLeft, setCueLeft] = useState(cueTotal);
  const cueSpentRef = useRef(0);
  useEffect(() => { cueSpentRef.current = 0; setCueLeft(cueTotal); }, [active, cueTotal]);
  const running = playing || recording;

  // Rehearsal: time on each beat while the prompter runs (picked scripts).
  const store = (name) => { try { return window[name]; } catch (err) { console.error('[Teleprompter] storage not reachable:', err); return null; } };
  const rehearsalKey = isScript && numbered ? (source.episodeId || 'script') : null;
  const [times, setTimes] = useState(() => (rehearsalKey ? readTimes(store('sessionStorage'), SESSION_KEY(rehearsalKey)) || {} : {}));
  const [savedTimes, setSavedTimes] = useState(() => (rehearsalKey ? readTimes(store('localStorage'), SAVED_KEY(rehearsalKey)) : null));
  const [showTimes, setShowTimes] = useState(false);
  const [savedNote, setSavedNote] = useState(null);
  const beatKey = beat?.number ?? null;
  useEffect(() => {
    if (!rehearsalKey || !running || beatKey == null) return undefined;
    let last = Date.now();
    const t = window.setInterval(() => {
      const now = Date.now();
      const d = (now - last) / 1000;
      last = now;
      setTimes((m) => ({ ...m, [beatKey]: (m[beatKey] || 0) + d }));
    }, 500);
    return () => window.clearInterval(t);
  }, [rehearsalKey, running, beatKey]);
  useEffect(() => { if (rehearsalKey) writeTimes(store('sessionStorage'), SESSION_KEY(rehearsalKey), times); }, [rehearsalKey, times]);
  const rehearsalRows = beats.filter((b) => b.number != null && (times[b.number] || 0) >= 1).map((b) => ({
    key: b.number, number: b.number, actual: times[b.number], estimate: beatSeconds(b.raw || []),
    saved: savedTimes?.beats?.[b.number] ?? null, current: b === beat,
  }));
  const saveTimes = () => {
    const value = { savedAt: new Date().toISOString(), beats: Object.fromEntries(Object.entries(times).map(([k, v]) => [k, Math.round(v)])) };
    if (writeTimes(store('localStorage'), SAVED_KEY(rehearsalKey), value)) { setSavedTimes(value); setSavedNote(new Date().toLocaleString()); }
  };
  useEffect(() => {
    if (!running || !showCue) return undefined;
    let last = Date.now();
    const t = window.setInterval(() => {
      const now = Date.now();
      cueSpentRef.current += (now - last) / 1000;
      last = now;
      setCueLeft(Math.max(0, cueTotal - cueSpentRef.current));
    }, 100);
    return () => window.clearInterval(t);
  }, [running, showCue, cueTotal, active]);

  // A beat's heading on the reading line.
  const toBeat = (i) => {
    const el = beatRefs.current[i];
    const box = scrollRef.current;
    if (!box) return;
    if (!el) { scrollToBox(0); return; }
    scrollToBox(topIn(el, box) - box.clientHeight / 3);
  };

  // Opens on its beat; one beat at a time (recording) starts at its top.
  useLayoutEffect(() => {
    if (oneBeat) { scrollToBox(0); setActive(0); } else { toBeat(current); setActive(layout.beatFirst[current] ?? 0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oneBeat]);

  const goTo = (i) => {
    if (i < 0 || i >= beats.length || busyTake) return;
    setCurrent(i);
    setNotice(null);
    setStartLine(0);
    if (oneBeat) { setPlaying(false); scrollToBox(0); setActive(0); } else { toBeat(i); setActive(layout.beatFirst[i] ?? 0); }
  };

  // The beat and the line on the reading line follow the scroll.
  const onScroll = () => {
    const box = scrollRef.current;
    if (!box) return;
    if (Math.abs(box.scrollTop - posRef.current) > 2) posRef.current = box.scrollTop;
    const line = box.scrollTop + box.clientHeight / 3 + 4;
    if (!(pacing !== 'steady' && playing) && flat.length) {
      let at = 0;
      for (let i = 0; i < flat.length; i += 1) {
        const el = lineRefs.current[i];
        if (!el) continue;
        if (topIn(el, box) <= line) at = i; else break;
      }
      if (at !== active) setActive(at);
    }
    if (oneBeat || !beats.length) return;
    let b = 0;
    beatRefs.current.forEach((el, i) => { if (el && topIn(el, box) <= line) b = i; });
    if (b !== current) setCurrent(b);
  };

  const countdown = (then) => {
    clearTimers();
    setCount(3);
    timersRef.current.push(window.setTimeout(() => setCount(2), countdownMs));
    timersRef.current.push(window.setTimeout(() => setCount(1), countdownMs * 2));
    timersRef.current.push(window.setTimeout(() => { setCount(0); then(); }, countdownMs * 3));
  };
  const cancelCountdown = () => { clearTimers(); setCount(0); };

  const togglePlay = () => {
    if (count > 0) { cancelCountdown(); return; }
    if (playing) { setPlaying(false); return; }
    if (voiceOn) setVoiceFrom(syncCursor(active));
    if (settings.countdown && !recording) countdown(() => setPlaying(true));
    else setPlaying(true);
  };

  // A take starts with its "Start from" line on the reading line (the top: line 0).
  const fromLine = oneBeat ? clamp(startLine, 0, Math.max(0, flat.length - 1)) : 0;
  const toStart = () => {
    if (fromLine > 0) scrollToLine(fromLine); else scrollToBox(0);
    setActive(fromLine);
  };
  const record = () => {
    if (rec.camera.status !== 'ready' || busyTake) return;
    setNotice(null);
    setSave({ status: 'idle', progress: 0, error: null, clip: null });
    setPlaying(false);
    toStart();
    countdown(() => {
      toStart();
      if (voiceOn) setVoiceFrom(syncCursor(fromLine));
      if (rec.begin()) setPlaying(true);
    });
  };
  const stopTake = () => { setPlaying(false); rec.stop(); };
  const retake = () => { rec.discard(); setSave({ status: 'idle', progress: 0, error: null, clip: null }); toStart(); };

  // Who is on camera in Files: JustAWoman, Lala, or a guest by name.
  const performer = readAs === HER ? 'justawoman' : readAs === 'Lala' ? 'lala' : 'guest';
  const beatNumber = beat?.number != null ? Number(beat.number) : null;
  const inFiles = clips.filter((c) => c.performer === performer && Number(c.beat_number) === beatNumber && (performer !== 'guest' || c.guest_name === readAs)).length;
  const takeNo = isScript ? inFiles + 1 : sessionTakes + 1;
  const label = isScript ? `${takeName(beat, takeNo, fromLine > 0 ? fromLine + 1 : null)}${readAs !== HER ? ` · as ${readAs}` : ''}` : null;
  // The beat's takes in Files (every performer), for the Takes panel.
  const takes = beatTakes(clips, beatNumber);
  const canTakes = isScript && !!episodeId && beatNumber != null;

  const toggleFavorite = async (clip) => {
    const on = !clip.is_favorite;
    setTakesError(null);
    setStarring(clip.id);
    try {
      const row = await rawClipsApi.favorite(episodeId, clip.id, on);
      setClips((cs) => withFavorite(cs, clip.id, on, row));
    } catch (err) {
      console.error('[Teleprompter] favourite not saved:', err);
      setTakesError(err?.response?.data?.error || 'The star was not saved. Try again.');
    } finally {
      setStarring(null);
    }
  };

  const saveTake = async () => {
    if (!take) return;
    if (!isScript) {
      try {
        const a = document.createElement('a');
        a.href = take.url;
        a.download = downloadName(take.type);
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setNotice(`Downloaded ${a.download}`);
        setSessionTakes((n) => n + 1);
        // The URL goes after the download has started.
        const blobUrl = take.url;
        window.setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch (err) { console.error('[Teleprompter] take URL not revoked:', err); } }, 1000);
        rec.discard();
      } catch (err) {
        console.error('[Teleprompter] download failed:', err);
        setSave({ status: 'error', progress: 0, error: 'The take could not be downloaded.', clip: null });
      }
      return;
    }
    let clip = save.clip;
    setSave((s) => ({ ...s, status: 'saving', error: null }));
    try {
      if (!clip) {
        const file = new File([take.blob], `beat-${beatNumber ?? 'x'}-take-${takeNo}.${takeExtension(take.type)}`, { type: take.type });
        clip = await rawClipsApi.upload(source.episodeId, file, { performer, label, guestName: performer === 'guest' ? readAs : undefined }, (p) => setSave((s) => ({ ...s, progress: p })));
        setSave((s) => ({ ...s, clip }));
      }
      // The scene the take is for (Production plays clips by beat_number),
      // and the line it started on, once the server keeps start lines.
      if (clip?.id && beatNumber >= 1 && beatNumber <= 14 && Number(clip.beat_number) !== beatNumber) {
        const changes = hasTakeFields(clip) ? { beat_number: beatNumber, start_line: fromLine } : { beat_number: beatNumber };
        const linked = await rawClipsApi.update(source.episodeId, clip.id, changes);
        clip = { ...clip, ...(linked || changes) };
      }
      const seconds = take.seconds;
      setClips((c) => [...c, {
        ...clip, performer, guest_name: performer === 'guest' ? readAs : null, beat_number: beatNumber,
        duration_seconds: clip?.duration_seconds ?? seconds, created_at: clip?.created_at || new Date().toISOString(),
      }]);
      setNotice(`Saved to the episode's Files: ${label}`);
      setSave({ status: 'idle', progress: 0, error: null, clip: null });
      rec.discard();
    } catch (err) {
      console.error('[Teleprompter] take not saved:', err);
      const base = err?.response?.status === 413 ? 'The take is too big to upload.' : (err?.response?.data?.error || 'The take was not saved.');
      setSave((s) => ({ ...s, clip, status: 'error', error: clip ? `It is in Files, but not linked to Beat ${beatNumber} yet. ${base}` : base }));
    }
  };

  const toggleRecord = () => {
    if (recordOn && busyTake && !window.confirm(recording ? 'A take is recording. Stop and throw it away?' : 'This take is not saved yet. Throw it away?')) return;
    cancelCountdown();
    setPlaying(false);
    if (recordOn) rec.discard();
    setRecordOn((on) => !on);
  };

  const requestClose = () => {
    if (busyTake && !window.confirm(recording || count > 0 ? 'A take is recording. Stop and leave the teleprompter?' : 'This take is not saved yet. Leave and lose it?')) return;
    cancelCountdown();
    onCloseRef.current?.();
  };

  const faster = (dir) => {
    if (pacing === 'lines') set('pace', clamp(roundPace(pace + dir * 0.1), PACE_MIN, PACE_MAX));
    else set('speed', clamp(settings.speed + dir, SPEED_MIN, SPEED_MAX));
  };

  const onKeyDown = (e) => {
    const own = OWN_KEYS.has(e.target?.tagName);
    if (e.key === 'Escape') { e.stopPropagation(); requestClose(); return; }
    if (e.key === ' ' && !own && e.target?.tagName !== 'BUTTON') { e.preventDefault(); togglePlay(); return; }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !own) {
      e.preventDefault();
      faster(e.key === 'ArrowUp' ? 1 : -1);
      return;
    }
    if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault();
      const dir = e.key === 'PageDown' ? 1 : -1;
      if ((pacing === 'lines' || voiceOn) && flat.length) {
        const next = clamp(active + dir, 0, flat.length - 1);
        setActive(next);
        scrollToLine(next);
        if (voiceOn) setVoiceFrom(syncCursor(next));
        return;
      }
      const box = scrollRef.current;
      if (box) scrollToBox(box.scrollTop + dir * Math.max(80, box.clientHeight * 0.5));
      return;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !own && isScript) {
      e.preventDefault();
      goTo(current + (e.key === 'ArrowRight' ? 1 : -1));
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const problem = rec.camera.message || rec.error || (voiceOn ? voice.error || voiceMicError : null);
  const shown = oneBeat ? [{ ...beat, at: current }] : beats.map((b, i) => ({ ...b, at: i }));
  const empty = isScript ? !beats.length && !script.intro.length : !flat.length;
  // Lines render in layout order; each takes the next index.
  let n = 0;
  const renderLine = (l, key) => {
    const i = n;
    n += 1;
    return <Line key={key} l={l} index={i} mine={isMine(l)} at={i === active} lineRef={(el) => { lineRefs.current[i] = el; }}
      wordStart={voiceOn ? voiceWords.start[i] ?? null : null} cursor={cursor} from={voiceFrom} />;
  };
  lineRefs.current.length = flat.length;

  return createPortal(
    <div
      ref={dialogRef}
      className={`stp-root is-${settings.lineMode}${settings.mirror ? ' is-mirrored' : ''}${pacing !== 'steady' ? ' is-paced' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stp-title"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-testid="teleprompter"
    >
      <div className="stp-bar">
        <h2 className="stp-title" id="stp-title">
          <span className="stp-kicker">Teleprompter</span>
          <span className="stp-episode">{isScript ? (source.title || 'Script') : 'Your text'}</span>
        </h2>
        <div className="stp-bar-controls">
          {readAsChoices.length > 0 && (
            <label className="stp-readas">
              <span className="stp-readas-label" aria-hidden="true">Read as</span>
              <select value={readAs} aria-label="Read as" disabled={busyTake} onChange={(e) => set('readAs', e.target.value)} data-testid="stp-read-as">
                {readAsChoices.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>
          )}
          {isScript && numbered && beats.length > 0 && (
            <div className="stp-beatnav">
              <button type="button" className="stp-btn is-icon" aria-label="Previous beat" data-testid="stp-prev" disabled={current === 0 || busyTake} onClick={() => goTo(current - 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
              <label className="stp-jump">
                <span className="stp-sr">Jump to beat</span>
                <select value={String(current)} disabled={busyTake} onChange={(e) => goTo(Number(e.target.value))} data-testid="stp-jump">
                  {beats.map((b, i) => <option key={`${b.number}-${i}`} value={String(i)}>{b.number} · {b.name}{times[b.number] >= 1 ? ` · ${durationText(times[b.number])}` : ''}</option>)}
                </select>
              </label>
              <button type="button" className="stp-btn is-icon" aria-label="Next beat" data-testid="stp-next" disabled={current >= beats.length - 1 || busyTake} onClick={() => goTo(current + 1)}><ChevronRight size={20} aria-hidden="true" /></button>
            </div>
          )}
        </div>
        <button type="button" className="stp-btn is-icon stp-close" aria-label="Exit teleprompter" data-testid="stp-close" onClick={requestClose}><X size={22} aria-hidden="true" /></button>
      </div>

      <div className="stp-stage">
        <div className="stp-scroll" ref={scrollRef} onScroll={onScroll} data-testid="stp-scroll">
          <div className="stp-spacer is-top" aria-hidden="true" />
          <article className="stp-page" style={{ '--stp-size': `${settings.size}px` }} data-testid="stp-page">
            {isScript && !oneBeat && script.intro.map((l, i) => renderLine(l, `i-${i}`))}
            {isScript && shown.map((b) => (
              <section key={`${b.number}-${b.at}`} className="stp-beat" ref={(el) => { beatRefs.current[b.at] = el; }} data-testid="stp-beat" aria-current={b.at === current ? 'true' : undefined}>
                {b.number !== null && <h3 className="stp-beat-head">{b.number} · {b.name}</h3>}
                {b.lines.map((l, j) => renderLine(l, j))}
                {!b.lines.length && <p className="stp-direction">Nothing to read in this beat.</p>}
              </section>
            ))}
            {pasted && pasted.map((g, gi) => <div key={gi} className="stp-group">{g.map((l, j) => renderLine(l, j))}</div>)}
            {!isScript && !pasted && flat.map((l, i) => renderLine(l, i))}
            {empty && <p className="stp-direction">Nothing to read yet.</p>}
          </article>
          <div className="stp-spacer is-bottom" aria-hidden="true" />
        </div>
        <div className="stp-marker" aria-hidden="true" data-testid="stp-marker" />
        {showCue && !take && count === 0 && <SilenceCue line={atLine} left={cueLeft} total={cueTotal} reduced={reduced} />}

        {(recording || meterStream) && (
          <div className="stp-hud">
            {recording && (
              <div className="stp-recdot" role="status" data-testid="stp-recording">
                <span className="stp-dot" aria-hidden="true" /> REC {clock(rec.elapsed)}
              </div>
            )}
            {meterStream && <MicMeter level={level} silent={silent} />}
          </div>
        )}
        {recordOn && rec.camera.status === 'ready' && (
          <div className="stp-cam">
            <video ref={previewRef} className="stp-preview" muted autoPlay playsInline aria-label="Camera preview" data-testid="stp-preview" />
            {settings.grid && <FramingGrid />}
          </div>
        )}
        {showTakes && canTakes && !take && (
          <TakesPanel takes={takes} beatNumber={beatNumber} onFavorite={toggleFavorite} starring={starring} error={takesError} loading={!clipsLoaded} />
        )}
        {showTimes && rehearsalKey && !take && (
          <RehearsalPanel rows={rehearsalRows} savedAt={savedNote} onReset={() => { setTimes({}); setSavedNote(null); }} onSave={saveTimes} />
        )}
        {count > 0 && <div className="stp-countdown" aria-live="assertive" data-testid="stp-countdown">{count}</div>}

        {take && (
          <div className="stp-review" role="region" aria-label="Review the take" data-testid="stp-review">
            <video className="stp-review-video" src={take.url} controls playsInline data-testid="stp-review-video" />
            <p className="stp-review-name">{isScript ? label : `Take ${takeNo}`} · {clock(take.seconds)}</p>
            {save.status === 'saving' && (
              <div className="stp-progress" role="progressbar" aria-valuenow={save.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Uploading the take">
                <span style={{ width: `${save.progress}%` }} />
              </div>
            )}
            {save.status === 'error' && <p className="stp-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {save.error}</p>}
            <div className="stp-review-actions">
              <button type="button" className="stp-btn" data-testid="stp-retake" disabled={save.status === 'saving' || !!save.clip} onClick={retake}><RotateCcw size={18} aria-hidden="true" /> Retake</button>
              <button type="button" className="stp-btn is-primary" data-testid="stp-save" disabled={save.status === 'saving' || (isScript && !source.episodeId)} onClick={saveTake}>
                {isScript ? <Upload size={18} aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
                {save.status === 'error' ? 'Retry' : save.status === 'saving' ? 'Saving…' : isScript ? "Save to the episode's Files" : 'Download the take'}
              </button>
            </div>
          </div>
        )}
      </div>

      {(problem || notice) && (
        <p className={`stp-status${!problem ? ' is-ok' : ''}`} role={problem ? 'alert' : 'status'} data-testid="stp-status">
          {problem ? <AlertTriangle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
          <span>{problem || notice}</span>
          {rec.camera.status === 'error' && <button type="button" className="stp-btn is-small" onClick={rec.retry}>Try again</button>}
        </p>
      )}

      <div className="stp-controls">
        <button type="button" className="stp-btn is-primary is-play" data-testid="stp-play" aria-pressed={playing} aria-label={playing || count > 0 ? 'Pause' : 'Play'} onClick={togglePlay}>
          {playing || count > 0 ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
          <span className="stp-btn-text">{playing || count > 0 ? 'Pause' : 'Play'}</span>
        </button>
        {voiceOn ? (
          <span className={`stp-listening${voice.listening ? ' is-on' : ''}`} data-testid="stp-listening" role="status">
            <AudioLines size={18} aria-hidden="true" /> {voice.listening ? 'Listening' : playing ? 'Starting…' : 'Press Play and read'}
          </span>
        ) : pacing === 'lines' ? (
          <label className="stp-slider">
            <Gauge size={18} aria-hidden="true" />
            <span className="stp-sr">Pace</span>
            <input type="range" min={PACE_MIN} max={PACE_MAX} step={0.1} value={pace} onChange={(e) => set('pace', clamp(roundPace(Number(e.target.value)), PACE_MIN, PACE_MAX))} data-testid="stp-pace" aria-valuetext={`Pace ${pace} times`} />
            <span className="stp-value" aria-hidden="true">×{pace.toFixed(1)}</span>
          </label>
        ) : (
          <label className="stp-slider">
            <Gauge size={18} aria-hidden="true" />
            <span className="stp-sr">Speed</span>
            <input type="range" min={SPEED_MIN} max={SPEED_MAX} step={1} value={settings.speed} onChange={(e) => set('speed', Number(e.target.value))} data-testid="stp-speed" aria-valuetext={`Speed ${settings.speed}`} />
            <span className="stp-value" aria-hidden="true">{settings.speed}</span>
          </label>
        )}
        {/* On a phone the settings fold away behind one button, so the words keep the screen. */}
        <button type="button" className="stp-btn is-icon stp-more" data-testid="stp-more" aria-expanded={more} aria-controls="stp-extras" aria-label={more ? 'Hide settings' : 'Show settings'} onClick={() => setMore((m) => !m)}>
          <SlidersHorizontal size={18} aria-hidden="true" />
        </button>
        <div className={`stp-extras${more ? ' is-open' : ''}`} id="stp-extras">
        <div className="stp-size" role="group" aria-label="Text size">
          <button type="button" className="stp-btn is-icon" aria-label="Smaller text" data-testid="stp-smaller" disabled={settings.size <= SIZE_MIN} onClick={() => set('size', clamp(settings.size - 4, SIZE_MIN, SIZE_MAX))}>A-</button>
          <span className="stp-value" data-testid="stp-size"><ALargeSmall size={16} aria-hidden="true" /> {settings.size}</span>
          <button type="button" className="stp-btn is-icon" aria-label="Larger text" data-testid="stp-larger" disabled={settings.size >= SIZE_MAX} onClick={() => set('size', clamp(settings.size + 4, SIZE_MIN, SIZE_MAX))}>A+</button>
        </div>
        <button type="button" className="stp-btn" data-testid="stp-mirror" aria-pressed={settings.mirror} onClick={() => set('mirror', !settings.mirror)}>
          <FlipHorizontal2 size={18} aria-hidden="true" /> Mirror
        </button>
        <button type="button" className="stp-btn" data-testid="stp-countdown-toggle" aria-pressed={settings.countdown} title="Count 3-2-1 before scrolling" onClick={() => set('countdown', !settings.countdown)}>
          <Timer size={18} aria-hidden="true" /> 3-2-1
        </button>
        <div className="stp-pacing" role="group" aria-label="Pacing">
          <button type="button" className="stp-btn" data-testid="stp-pace-steady" aria-pressed={pacing === 'steady'} onClick={() => { setPlaying(false); set('pacing', 'steady'); }}>Steady</button>
          {hasLines && (
            <button type="button" className="stp-btn" data-testid="stp-pace-lines" aria-pressed={pacing === 'lines'} title="Hold each line on the reading line for its estimated time"
              onClick={() => { setPlaying(false); set('pacing', pacing === 'lines' ? 'steady' : 'lines'); }}>
              <Hourglass size={18} aria-hidden="true" /> Pace by line times
            </button>
          )}
          <button type="button" className="stp-btn" data-testid="stp-pace-voice" aria-pressed={pacing === 'voice'} disabled={!voiceSupported}
            title={voiceSupported ? 'Scroll as you read your lines aloud' : 'Needs Chrome or Edge'}
            onClick={() => { setPlaying(false); set('pacing', pacing === 'voice' ? 'steady' : 'voice'); }}>
            <AudioLines size={18} aria-hidden="true" /> Follow my voice
            {!voiceSupported && <span className="stp-needs" data-testid="stp-voice-needs">Needs Chrome or Edge</span>}
          </button>
        </div>
        {rehearsalKey && (
          <button type="button" className="stp-btn" data-testid="stp-rehearsal-toggle" aria-pressed={showTimes} onClick={() => { setShowTimes((v) => !v); setShowTakes(false); }}>
            <Clock size={18} aria-hidden="true" /> Times
          </button>
        )}
        {recordOn && (
          <button type="button" className="stp-btn" data-testid="stp-grid-toggle" aria-pressed={settings.grid} onClick={() => set('grid', !settings.grid)}>
            <Grid3x3 size={18} aria-hidden="true" /> Grid
          </button>
        )}
        {hasLines && (
          <div className="stp-modes" role="group" aria-label="Lines">
            <button type="button" className="stp-btn" data-testid="stp-mode-mine" aria-pressed={settings.lineMode === 'mine'} onClick={() => set('lineMode', 'mine')}>My lines big</button>
            <button type="button" className="stp-btn" data-testid="stp-mode-same" aria-pressed={settings.lineMode === 'same'} onClick={() => set('lineMode', 'same')}>Everything the same</button>
          </div>
        )}
        </div>
        {canTakes && (
          <button type="button" className="stp-btn" data-testid="stp-takes-toggle" aria-pressed={showTakes} aria-label={`Takes for beat ${beatNumber}: ${takes.length}`}
            onClick={() => { setShowTakes((v) => !v); setShowTimes(false); }}>
            <Film size={18} aria-hidden="true" /> <span className="stp-btn-text">Takes</span> <span className="stp-count">{takes.length}</span>
          </button>
        )}
        <button type="button" className={`stp-btn${recordOn ? ' is-on' : ''}`} data-testid="stp-record-mode" aria-pressed={recordOn} onClick={toggleRecord}>
          {recordOn ? <Video size={18} aria-hidden="true" /> : <VideoOff size={18} aria-hidden="true" />} Read &amp; record
        </button>
        {oneBeat && beat && beat.lines.length > 1 && (
          <label className="stp-startfrom">
            <span className="stp-startfrom-label" aria-hidden="true">Start from</span>
            <select value={String(fromLine)} aria-label="Start the take from line" disabled={busyTake} data-testid="stp-start-line"
              onChange={(e) => { const i = Number(e.target.value); setStartLine(i); if (i > 0) scrollToLine(i); else scrollToBox(0); setActive(i); }}>
              {beat.lines.map((l, i) => <option key={i} value={String(i)}>{i === 0 ? `${lineChoice(l, i)} (the top)` : lineChoice(l, i)}</option>)}
            </select>
          </label>
        )}
        {recordOn && (
          recording ? (
            <button type="button" className="stp-btn is-rec" data-testid="stp-stop" onClick={stopTake}><Square size={18} aria-hidden="true" /> Stop</button>
          ) : (
            <button type="button" className="stp-btn is-rec" data-testid="stp-record" disabled={rec.camera.status !== 'ready' || busyTake} onClick={record}
              title={isScript && beat ? `Record ${label}` : `Record take ${takeNo}`}>
              <Circle size={18} aria-hidden="true" /> {isScript && beatNumber != null ? `Record beat ${beatNumber} · take ${takeNo}` : `Record take ${takeNo}`}
            </button>
          )
        )}
      </div>
    </div>,
    document.body,
  );
}
