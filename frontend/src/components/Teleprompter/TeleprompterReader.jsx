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
// Batch 3 (Evoni, 2026-10-20): "Phone remote" shows a QR code; the phone
// drives the prompter (useTeleprompterRemote). Voice clips: a line she
// recorded in Lala's (or anyone's) voice plays when it reaches the reading
// line while she reads as someone else; the silence cue counts the clip's
// own length, and in Pace by line times and Follow my voice the scroll waits
// for it to end. "Record voice" records the line on the reading line.
// On-screen moments (Evoni, 2026-10-23: "when lala is reacting or talking or
// things are being clicked on screen I need to react"): a [UI:] line shows
// as an "On screen · … · react" cue holding 3 seconds (× the pace), counted
// like someone else's line; "Show on-screen moments" turns them off. The
// cutscene, beats 11-13 (lib/scriptShowRules isCutsceneBeat), opens with a
// "Cutscene · watch & comment" banner, and only JustAWoman's lines there are
// read; the rest is watching time.
// "Record whole episode" (same day): in Read & record, "Whole episode" films
// one take from beat 1 (or this beat) to the end without stopping at beat
// ends; pause pauses the recording too. Each beat's heading reaching the
// reading line is a marker [{ beat, t }] in take time (lib/fullEpisodeTake),
// saved with the take as beat_marks, or downloadable until the server keeps them.
// Ending and saving a take (Evoni, 2026-10-24: "On the teleprompter I have no
// clear way of ending and saving a recording"): while a take runs the bar's
// top row is a big red "Stop & review" with Pause beside it (Pause pauses the
// scroll and the recording, one beat or whole episode; take time leaves the
// paused time out), and the settings that change the layout hide until the
// take ends. A one-beat (or pasted-text) take ends by itself 2 seconds after
// its last line has passed the reading line ("Ending the take…"); the whole
// episode still stops at its end. The review sheet ("Your take") has Save
// take, Retake (throw it away and record again) and Discard (asks, then back
// to the start, nothing saved); never saved by itself. After a save, "Next
// beat →" moves on ready to record. A take always counts 3-2-1 before it
// starts (3 seconds, to get into place), whatever the 3-2-1 setting, which is
// for reading.
// Teleprompter audit, recording and saving (Evoni, 2026-10-24: "fix all of
// them"): a take stops by itself just under the 500 MB upload limit; any take
// can be downloaded (or, on a phone, shared to Photos or Files) from the
// review, which stays open until she is done with it; the take's pieces are
// kept on the device as they are recorded (lib/takeStore), so Back (asked
// first), a reload or a crash never loses it: next time "You have an unsaved
// take" offers it back. The screen is kept on while recording, and the take
// pauses when the phone looks away or the camera is taken. The upload carries
// the beat, start line, markers and length in one request, and an expired
// sign-in never leaves the page with a take unsaved.
// Keys: Space play/pause, Up/Down speed (or pace), PageUp/PageDown jump a
// half screen (a line, pacing by line times; clickers and foot pedals send
// these), Left/Right beat, Enter or S stop & review a take, Escape closes
// the open panel (Takes, Times, Phone remote, Record voice, the phone's
// settings) or, with none open, exits (asking first while a take records).
// Reader audit (Evoni, 2026-10-24: "fix all of them"): opening or jumping to
// a beat puts its first line on the reading line, and Play starts there; a
// text size, line mode, on-screen moments or Read as change keeps the line
// she is on; Space and Up/Down stay Play/Pause and speed after she taps a
// control (a reader button, the speed slider, or a choice made in a list);
// Play at the end goes back to the top.

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ChevronLeft, ChevronRight, Play, Pause, FlipHorizontal2, Timer, Video, VideoOff, Circle, Square,
  RotateCcw, Upload, Download, AlertTriangle, Trash2, ArrowRight, CheckCircle2, ALargeSmall, Gauge, Hourglass, SlidersHorizontal,
  AudioLines, Grid3x3, Clock, Film, Smartphone, Mic, Volume2,
  Bell, MessageCircle, MousePointerClick, ArrowDownUp, Send, MonitorPlay, AppWindow, Monitor, EyeOff, Clapperboard, Smile, FileDown, Share2, History,
} from 'lucide-react';
import useVoiceFollow from '../../hooks/useVoiceFollow';
import useMicLevel from '../../hooks/useMicLevel';
import { advance, speechRecognition } from '../../lib/voiceFollow';
import { spokenWords, pauseCount } from '../../lib/teleprompterMarks';
import { beatSeconds } from '../../lib/scriptRuntime';
import { SESSION_KEY, SAVED_KEY, readTimes, writeTimes, durationText } from '../../lib/rehearsal';
import { cameraErrorMessage } from '../../lib/teleprompterLines';
import { MarkedText, MicMeter, FramingGrid, RehearsalPanel } from './TeleprompterParts';
import TakesPanel, { MarkLinks, seekVideo } from './TeleprompterTakes';
import useDialogLayer from '../../hooks/useDialogLayer';
import useTakeRecorder from '../../hooks/useTakeRecorder';
import useWakeLock from '../../hooks/useWakeLock';
import useBackGuard from '../../hooks/useBackGuard';
import { takeStore, takeKey, takeWhen } from '../../lib/takeStore';
import { takeAsFile, canShareTake, downloadBlob, shareTake, takeFileName } from '../../lib/takeFile';
import useTeleprompterRemote from '../../hooks/useTeleprompterRemote';
import useLineVoice from '../../hooks/useLineVoice';
import TeleprompterRemotePanel from './TeleprompterRemotePanel';
import VoiceRecordPanel from './VoiceRecord';
import { voiceClipsApi, isNotReady as voiceNotReady, VOICE_NOT_READY, clipsByLine, lineKey, withClip, clipSeconds, clipForLine } from '../../lib/voiceClipsApi';
import { teleprompterScript, pastedParagraphs, pastedScript, speakersOf, HER, takeName, takeExtension, downloadName, clock, lineChoice, withoutScreen } from '../../lib/teleprompterLines';
import { rawClipsApi, hasTakeFields, beatTakes, withFavorite, signInMessage } from '../../lib/rawClipsApi';
import { isCutsceneBeat } from '../../lib/scriptShowRules';
import {
  FULL_BITRATE, WARN_BYTES, UPLOAD_LIMIT_MB, MARKS_NOT_KEPT, fullTakeName, fullTakes, hasMarksField, markTime, cleanMarks,
  takeBytes, sizeText, marksText, marksFileName, STOP_BYTES, LIMIT_NOTE, interruptNote,
} from '../../lib/fullEpisodeTake';

export const SETTINGS_KEY = 'teleprompter.settings';
export const SIZE_MIN = 20;
export const SIZE_MAX = 96;
export const SPEED_MIN = 1;
export const SPEED_MAX = 20;
const PX_PER_STEP = 8; // speed 5 scrolls 40px a second
export const PACE_MIN = 0.5;
export const PACE_MAX = 2;
export const DEFAULTS = { size: 40, speed: 5, mirror: false, countdown: true, lineMode: 'mine', readAs: HER, pacing: 'steady', pace: 1, grid: false, playVoice: true, screen: true };
// The mic warning (Evoni, 2026-10-25: it warned 3 seconds in, before she had
// spoken). Nothing in the first 8 seconds of a take; then "yet" while the mic
// has never gone above this level, or, after sound, 15 seconds below it.
const QUIET_LEVEL = 0.04;
export const QUIET_GRACE_MS = 8000;
export const QUIET_LOST_MS = 15000;
// A one-beat take's last line passed: this long, then the take stops for review.
export const ENDING_MS = 2000;
const roundPace = (n) => Math.round(n * 10) / 10;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
// A `//` pause holds a second more (an on-screen moment holds its own 3 seconds).
const lineBreaks = (l) => (l?.kind === 'screen' ? 0 : pauseCount(l?.text));

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
      playVoice: typeof raw.playVoice === 'boolean' ? raw.playVoice : DEFAULTS.playVoice,
      screen: typeof raw.screen === 'boolean' ? raw.screen : DEFAULTS.screen,
      pace: Number.isFinite(raw.pace) ? clamp(roundPace(raw.pace), PACE_MIN, PACE_MAX) : DEFAULTS.pace,
    };
  } catch (err) {
    console.error('[Teleprompter] settings not read:', err);
    return { ...DEFAULTS };
  }
}

const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]), video[controls], [href], [tabindex]:not([tabindex="-1"])';
// Keys typed into these keep their own meaning.
const OWN_KEYS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'VIDEO', 'AUDIO']);
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

// The on-screen moment's icon (lib/teleprompterScreen screenIcon).
const SCREEN_ICONS = {
  phone: Smartphone, notify: Bell, dm: MessageCircle, post: Send, tap: MousePointerClick,
  scroll: ArrowDownUp, open: AppWindow, show: MonitorPlay, hide: EyeOff, other: Monitor, sound: Volume2,
  // Lala's automatic reaction (lib/teleprompterLines autoReactionCue).
  react: Smile,
};

// A line; `wordStart`/`cursor` number its words for Follow my voice.
function Line({ l, mine, at, lineRef, index, wordStart = null, cursor = -1, from = 0 }) {
  const common = { ref: lineRef, 'data-line': index, 'data-at': at || undefined };
  if (l.kind === 'screen') {
    const Icon = SCREEN_ICONS[l.icon] || Monitor;
    return (
      <p {...common} className="stp-screen" data-testid="stp-screen">
        <Icon size={18} aria-hidden="true" className="stp-screen-icon" />
        <span className="stp-screen-kicker">{l.kicker || 'On screen'}</span>
        <span className="stp-screen-text">{l.text}</span>
        <span className="stp-screen-react">react</span>
      </p>
    );
  }
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
// An on-screen moment: "On screen · react" with what happens; in the
// cutscene, someone else's line is watching time.
function SilenceCue({ line, left, total, reduced, voice = false }) {
  const n = Math.max(0, Math.ceil(left - 0.05));
  // No live region here: it would read the number every second. The
  // reader's one status line (cueSays) says what the cue is, once a line.
  if (line.kind === 'direction') return <div className="stp-quiet is-action" data-testid="stp-quiet">{line.cut ? 'Watching' : 'Action'} · {n}s</div>;
  if (line.kind === 'breath') return <div className="stp-quiet is-action" data-testid="stp-quiet">Breath · {n}s</div>;
  const frac = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const screenCue = line.kind === 'screen';
  return (
    <div className={`stp-quiet${screenCue ? ' is-screen' : ''}`} data-testid="stp-quiet">
      <span className="stp-quiet-label">{screenCue ? `${line.kicker || 'On screen'} · react` : line.cut ? 'Cutscene · watch' : 'Stay quiet · react'}</span>
      {voice && <span className="stp-quiet-voice" data-testid="stp-quiet-voice"><Volume2 size={14} aria-hidden="true" /> voice clip</span>}
      <span className="stp-quiet-n" data-testid="stp-quiet-n">{n}s</span>
      <span className="stp-quiet-who">{screenCue ? line.text : line.speaker}</span>
      {!reduced && <span className="stp-quiet-bar" data-testid="stp-quiet-bar" aria-hidden="true"><span style={{ transform: `scaleX(${frac})` }} /></span>}
    </div>
  );
}

// What the silence cue is, for a screen reader: said once when the line comes up, never the seconds.
export function cueSays(line) {
  if (!line) return '';
  if (line.kind === 'direction') return line.cut ? 'Watching' : 'Action';
  if (line.kind === 'breath') return 'Breath';
  if (line.kind === 'screen') return `${line.kicker || 'On screen'} · react · ${line.text}`;
  return `${line.cut ? 'Cutscene · watch' : 'Stay quiet · react'} · ${line.speaker}`;
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
  // Read & record with a picked script: one beat a take, or the whole episode in one.
  const [takeScope, setTakeScope] = useState('beat');
  const [episodeFrom, setEpisodeFrom] = useState('first'); // 'first' | 'this'
  // The whole-episode take's beat markers, and the beat (index) marked last.
  const [marks, setMarks] = useState([]);
  const marksRef = useRef([]);
  const lastMarkedRef = useRef(-1);
  // Markers the server could not keep yet (database update not run): she can download them.
  const [pendingMarks, setPendingMarks] = useState(null);
  // A take's 3-2-1 is running (not a reading one).
  const [arming, setArming] = useState(false);
  // The take's last line has passed: it stops for review in ENDING_MS.
  const [ending, setEnding] = useState(false);
  const endTimerRef = useRef(null);
  // After a saved one-beat take: the beat (index) "Next beat →" moves to.
  const [savedNext, setSavedNext] = useState(null);
  const recordBtnRef = useRef(null);
  const moreRef = useRef(null);
  // The prompter reached the end by itself: Play goes back to the top.
  const endedRef = useRef(false);
  const noteTimerRef = useRef(null);

  const episodeId = isScript ? source.episodeId : null;
  const rec = useTakeRecorder(recordOn, { storeKey: takeKey(episodeId) });
  const { take, recording } = rec;
  // A voice clip recording or waiting to be saved counts as unsaved work too.
  const [voiceBusy, setVoiceBusy] = useState(false);
  const busyTake = recording || count > 0 || !!take || rec.finishing || voiceBusy;
  // The screen stays on while Read & record is on (a locked phone stops a take).
  useWakeLock(recordOn);
  // The take was downloaded (or shared) to this device: its review says Done.
  const [downloaded, setDownloaded] = useState(null);
  // A take kept on this device but never saved, offered back on opening.
  const [offer, setOffer] = useState(null);
  // A take is running or about to: the bar is Stop & review and Pause.
  const takeLive = recording || arming;
  // Mid-take or in review: the controls that make no sense then are hidden.
  const midTake = takeLive || !!take;
  // Read & record, no take yet: ● Record leads the bar and Play is Practice
  // (Evoni, 2026-10-25: she read 9 minutes on Play thinking it recorded).
  const recordLead = recordOn && !midTake;
  // She pressed Practice (or Space) in Read & record: a banner says it is not
  // recording until a take starts or Read & record goes off.
  const [practicing, setPracticing] = useState(false);
  const canWhole = isScript && numbered && !!episodeId && beats.length > 0;
  const whole = canWhole && recordOn && takeScope === 'episode';
  const oneBeat = isScript && recordOn && beats.length > 0 && !whole;
  const beat = beats[current] || null;
  // Follow my voice falls back to the steady scroll where the browser can't listen.
  const voiceSupported = !!speechRecognition();
  const pacing = settings.pacing === 'voice' && !voiceSupported ? 'steady' : settings.pacing;
  const pace = settings.pace;

  // Every line in reading order, and where each beat's lines start.
  const layout = useMemo(() => {
    const flat = [];
    const beatFirst = [];
    const beatLines = [];
    let intro = [];
    // Each line's beat number and place in its beat (a voice clip's line), or null.
    const where = [];
    // Each line's own object in the script (before the cutscene mark) and the
    // list it came from: her place, kept across a reflow (findPlace).
    const src = [];
    const srcList = [];
    let groups = [];
    const own = (ls, list) => ls.forEach((l) => { src.push(l); srcList.push(list); });
    // On-screen moments show unless she turned them off; a voice clip's line
    // index (`vi`) never counts them, so clips recorded before keep their lines.
    const shownLines = (ls) => (settings.screen ? ls : withoutScreen(ls));
    if (isScript) {
      if (!oneBeat) { intro = shownLines(script.intro); flat.push(...intro); intro.forEach(() => where.push(null)); own(intro, script.intro); }
      beats.forEach((b, i) => {
        if (oneBeat && i !== current) return;
        beatFirst[i] = flat.length;
        // The cutscene (beats 11-13): only JustAWoman's lines are read there.
        const cut = isCutsceneBeat(b.number);
        const kept = shownLines(b.lines);
        const ls = kept.map((l) => (cut ? { ...l, cut: true } : l));
        beatLines[i] = ls;
        flat.push(...ls);
        own(kept, b.lines);
        ls.forEach((l) => where.push(b.number != null && l.vi != null ? { beat: Number(b.number), index: l.vi } : null));
      });
    } else if (pasted) {
      // Pasted text's on-screen moments show as a script's do, unless turned off.
      groups = pasted.map((g) => shownLines(g));
      groups.forEach((g, gi) => { flat.push(...g); own(g, pasted[gi]); });
    } else paragraphs.forEach((p) => { const l = { kind: 'para', who: null, text: p, seconds: 0 }; flat.push(l); own([l], null); });
    return { flat, beatFirst, where, beatLines, intro, src, srcList, groups };
  }, [isScript, oneBeat, script, beats, current, pasted, paragraphs, settings.screen]);
  const { flat, where } = layout;
  // Lines with speakers and times (not plain pasted prose).
  const hasLines = flat.some((l) => l.kind !== 'para');
  // The script has on-screen moments to show or hide.
  const hasScreen = (isScript ? [...script.intro, ...beats.flatMap((b) => b.lines)] : (pasted || []).flat()).some((l) => l.kind === 'screen');

  // "Read as": whose lines are hers; JustAWoman unless she picks another.
  const speakers = useMemo(() => speakersOf(isScript ? [...script.intro, ...beats.flatMap((b) => b.lines)] : (pasted || []).flat()), [isScript, script, beats, pasted]);
  const readAsChoices = speakers.length ? [...new Set([HER, 'Lala', ...speakers])] : [];
  // A name saved from another script that is not in this one reads as JustAWoman.
  const readAs = readAsChoices.includes(settings.readAs) ? settings.readAs : HER;
  // In the cutscene only JustAWoman speaks live; everyone else is the AI video.
  const isMine = (l) => l.kind === 'para' || (!!l.who && (l.cut ? l.who === HER : l.who === readAs));

  // Follow my voice: her words in order, and where each of her lines starts.
  const voiceWords = useMemo(() => {
    const words = [];
    const start = [];
    const end = [];
    flat.forEach((l, i) => {
      if (!(l.kind === 'para' || (l.who && (l.cut ? l.who === HER : l.who === readAs)))) return;
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
  const reviewRef = useRef(null);
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
  const cancelEnding = () => {
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    endTimerRef.current = null;
    setEnding(false);
  };
  useEffect(() => () => {
    clearTimers();
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
  }, []);
  // A short note in the status line that clears itself ("Back to the top").
  const flashNote = (text) => {
    setNotice(text);
    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
    noteTimerRef.current = window.setTimeout(() => { noteTimerRef.current = null; setNotice((n) => (n === text ? null : n)); }, 2500);
  };
  // Back to the dialog after a reader control acts, so Space and Up/Down
  // stay Play/Pause and speed (a clicker or a keyboard).
  const refocus = () => dialogRef.current?.focus();
  // A take that stopped any other way (an error, the remote) is not ending any more.
  useEffect(() => { if (!recording) cancelEnding(); }, [recording]);

  // The clips already in Files: the beat's takes, and the next take is "take 3".
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

  // A take kept on this device and never saved (Back, a reload, a crash):
  // offered back once, on opening.
  useEffect(() => {
    let live = true;
    takeStore().unsaved(takeKey(episodeId))
      .then((list) => { if (live && list.length) setOffer(list[0]); })
      .catch((err) => console.error('[Teleprompter] unsaved takes not looked for:', err));
    return () => { live = false; };
  }, [episodeId]);

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
  // The end of the script: the prompter stops; a whole-episode take stops with it.
  const endRef = useRef(null);
  const nextAfter = (line) => {
    const next = line + 1;
    if (next >= flat.length) { endRef.current?.(); return; }
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
  // Voice clips (batch 3): the episode's recorded lines; null until loaded.
  const voiceEpisode = isScript ? source.episodeId || null : null;
  const [voiceClips, setVoiceClips] = useState([]);
  const [voiceReady, setVoiceReady] = useState(null); // null loading, true, false (database update not run)
  useEffect(() => {
    if (!voiceEpisode) return undefined;
    let live = true;
    voiceClipsApi.list(voiceEpisode)
      .then((rows) => { if (live) { setVoiceClips(rows); setVoiceReady(true); } })
      .catch((err) => {
        console.error('[Teleprompter] voice clips not loaded:', err);
        if (live) setVoiceReady(voiceNotReady(err) ? false : null);
      });
    return () => { live = false; };
  }, [voiceEpisode]);
  const voiceByLine = useMemo(() => clipsByLine(voiceClips), [voiceClips]);
  // The clip of a line: someone else's spoken line with a recording.
  const clipOf = (i) => {
    const l = flat[i];
    const w = where[i];
    // The cutscene is an AI video: its characters speak for themselves.
    if (!l || !w || !l.who || l.who === readAs || l.cut || (l.kind !== 'cue' && l.kind !== 'mine')) return null;
    // Not a recording of other words (Script tab audit 6, 2026-10-24).
    return clipForLine(voiceByLine, w.beat, w.index, l.text);
  };
  const activeClip = settings.playVoice ? clipOf(active) : null;
  // In Pace by line times and Follow my voice the scroll waits for the clip.
  const holdForClip = !!activeClip && pacing !== 'steady';
  const lineVoice = useLineVoice(activeClip, activeClip ? `${active}:${activeClip.id}` : null, !!activeClip && playing && count === 0);

  const voice = useVoiceFollow(voiceOn && playing, { onHeard, recording });
  useEffect(() => {
    if (!voiceOn || !playing || !flat.length) return undefined;
    const l = flat[active];
    if (!l) return undefined;
    const wordless = voiceWords.start[active] != null && voiceWords.end[active] <= voiceWords.start[active];
    if (isMine(l) && !wordless) return undefined;
    scrollToLine(active);
    if (holdForClip) return undefined; // the clip's end moves on
    const t = window.setTimeout(() => nextAfter(active), Math.max(200, ((l.seconds || 0) + lineBreaks(l)) * 1000));
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, playing, active, flat, readAs, holdForClip]);

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
  // The mic warning: 'never' (no sound yet since the take started) or 'lost'
  // (sound earlier, then quiet for QUIET_LOST_MS); sound clears it at once.
  // Time paused does not count.
  const recPausedRef = useRef(false);
  recPausedRef.current = !!rec.paused;
  const [silent, setSilent] = useState(null);
  useEffect(() => {
    if (!recording) { setSilent(null); return undefined; }
    let ran = 0; // running time since the take started
    let loudAt = null; // running time of the last sound
    let last = Date.now();
    const t = window.setInterval(() => {
      const now = Date.now();
      const step = now - last;
      last = now;
      if (recPausedRef.current) { setSilent(null); return; }
      ran += step;
      if (levelRef.current > QUIET_LEVEL) { loudAt = ran; setSilent(null); return; }
      if (ran < QUIET_GRACE_MS) setSilent(null);
      else if (loudAt == null) setSilent('never');
      else setSilent(ran - loudAt >= QUIET_LOST_MS ? 'lost' : null);
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
        if (box.scrollHeight > box.clientHeight && box.scrollTop + box.clientHeight >= box.scrollHeight - 1) { endRef.current?.(); return; }
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
    if (holdForClip) return undefined; // the clip's end moves on
    // A `//` pause holds a second more.
    const ms = Math.max(200, (((flat[i].seconds || 0) + lineBreaks(flat[i])) / pace) * 1000);
    const t = window.setTimeout(() => {
      if (i >= flat.length - 1) endRef.current?.();
      else setActive(i + 1);
    }, ms);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, pacing, active, pace, flat, holdForClip]);

  // A clip played to its end: the next line comes up (paced modes).
  useEffect(() => {
    if (!playing || !holdForClip || !lineVoice.ended) return;
    if (pacing === 'voice') { nextAfter(active); return; }
    if (active >= flat.length - 1) endRef.current?.();
    else setActive(active + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineVoice.ended, playing, holdForClip]);

  // The silence cue counts down the line on the reading line while the
  // prompter runs; paused, it waits.
  const atLine = flat[active] || null;
  // A line with a voice clip counts the clip's own length.
  const activeClipSeconds = clipSeconds(activeClip);
  const cueTotal = !atLine ? 0 : activeClipSeconds != null ? activeClipSeconds
    : (pacing === 'lines' ? ((atLine.seconds || 0) + lineBreaks(atLine)) / pace : (atLine.seconds || 0));
  const showCue = !!atLine && !isMine(atLine) && cueTotal > 0;
  const [cueLeft, setCueLeft] = useState(cueTotal);
  const cueSpentRef = useRef(0);
  useEffect(() => { cueSpentRef.current = 0; setCueLeft(cueTotal); }, [active, cueTotal]);
  // A paused whole-episode take is not running: the cue and the times wait too.
  const running = playing || (recording && !rec.paused);

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

  // A beat's first line on the reading line, its heading just above
  // (reader audit: the heading there made the beat before's last line the
  // active one); a beat with nothing to read, its heading.
  const toBeat = (i) => {
    const box = scrollRef.current;
    if (!box) return;
    const first = layout.beatLines[i]?.length ? lineRefs.current[layout.beatFirst[i]] : null;
    const el = first || beatRefs.current[i];
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
    endedRef.current = false;
    setCurrent(i);
    setNotice(null);
    setSavedNext(null);
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
      // A beat's heading on the reading line counts as its first line.
      beatRefs.current.forEach((el, k) => {
        const f = layout.beatFirst[k];
        if (el && f != null && layout.beatLines[k]?.length && f > at && topIn(el, box) <= line) at = f;
      });
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
  const cancelCountdown = () => { clearTimers(); setCount(0); setArming(false); };

  // Her place across a reflow (text size, line mode, on-screen moments, Read
  // as): the line on the reading line, found again by its own object; one
  // that is no longer shown (an on-screen moment hidden) gives the next
  // line of its list that is.
  const placeRef = useRef(null);
  const findPlace = (place) => {
    if (!place?.line) return null;
    const at = layout.src.indexOf(place.line);
    if (at >= 0) return at;
    const list = place.list || [];
    for (let k = list.indexOf(place.line) + 1; k > 0 && k < list.length; k += 1) {
      const j = layout.src.indexOf(list[k]);
      if (j >= 0) return j;
    }
    return null;
  };
  const reflowRef = useRef(null);
  useLayoutEffect(() => {
    const now = [settings.size, settings.lineMode, settings.screen, readAs].join('|');
    const before = reflowRef.current;
    reflowRef.current = now;
    if (before == null || before === now || !flat.length) return;
    const place = placeRef.current;
    const at = clamp(findPlace(place) ?? active, 0, flat.length - 1);
    if (place?.start) setStartLine(findPlace(place.start) ?? 0);
    setActive(at);
    scrollToLine(at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.size, settings.lineMode, settings.screen, readAs]);
  // The reading area changes size (the phone's settings open or close, the
  // phone turns, a status line comes and goes): the same line stays on the reading line.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || typeof window.ResizeObserver !== 'function') return undefined;
    let height = box.clientHeight;
    const ro = new window.ResizeObserver(() => {
      if (box.clientHeight === height) return;
      height = box.clientHeight;
      const at = findPlaceRef.current?.(placeRef.current);
      if (at != null) scrollToLineRef.current?.(at);
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  const findPlaceRef = useRef(null);
  findPlaceRef.current = findPlace;
  const scrollToLineRef = useRef(null);
  scrollToLineRef.current = scrollToLine;
  // After the reflow above, so it is the place before the change.
  useLayoutEffect(() => {
    placeRef.current = {
      line: layout.src[active], list: layout.srcList[active],
      start: oneBeat && startLine > 0 ? { line: layout.src[startLine], list: layout.srcList[startLine] } : null,
    };
  });

  // The prompter is at the end: scrolled to the bottom (steady), or it ran
  // out of lines by itself (paced) and is still on the last.
  const atTheEnd = () => {
    if (!flat.length) return false;
    if (pacing !== 'steady') return endedRef.current && active >= flat.length - 1;
    const box = scrollRef.current;
    return !!box && box.scrollHeight > box.clientHeight && box.scrollTop + box.clientHeight >= box.scrollHeight - 1;
  };
  // A running take is paused: the recorder is, or the scroll stopped by hand
  // (a browser that can't pause its recorder), not because the take is ending.
  const takePaused = recording && (!!rec.paused || (!playing && !ending));
  const togglePlay = () => {
    if (count > 0) { cancelCountdown(); return; }
    // A take (one beat or whole episode): Pause pauses the recording too, and
    // Resume carries both on. Pausing while it ends keeps the take going.
    if (recording) {
      // A camera that ended can't carry on: Resume does nothing, Stop & review keeps the take.
      if (takePaused) { if (rec.paused && !rec.resume()) return; setPlaying(true); } else { cancelEnding(); setPlaying(false); rec.pause(); }
      return;
    }
    if (playing) { setPlaying(false); return; }
    if (recordOn) setPracticing(true);
    // At the end Play did nothing (reader audit): back to the top, and play.
    let from = active;
    if (atTheEnd()) {
      endedRef.current = false;
      from = oneBeat ? fromLine : 0;
      if (oneBeat) toStart(); else { scrollToBox(0); setActive(0); }
      flashNote('Back to the top');
    }
    endedRef.current = false;
    if (voiceOn) setVoiceFrom(syncCursor(from));
    if (settings.countdown && !recording) countdown(() => setPlaying(true));
    else setPlaying(true);
  };

  // A take starts with its "Start from" line on the reading line (the top: line 0).
  const fromLine = oneBeat ? clamp(startLine, 0, Math.max(0, flat.length - 1)) : 0;
  // The line's place in the beat without on-screen moments (start_line, "from line 4").
  const fromIndex = fromLine > 0 ? (flat[fromLine]?.vi ?? 0) : 0;
  const toStart = () => {
    if (fromLine > 0) scrollToLine(fromLine); else scrollToBox(0);
    setActive(fromLine);
  };

  // Whole episode: from the first numbered beat, or the one on screen.
  const firstBeat = Math.max(0, beats.findIndex((b) => b.number != null));
  const wholeFrom = episodeFrom === 'this' ? current : firstBeat;
  const toBeatStart = (i) => { setCurrent(i); toBeat(i); setActive(layout.beatFirst[i] ?? 0); };
  const resetMarks = () => { marksRef.current = []; lastMarkedRef.current = -1; setMarks([]); };
  const recordWhole = () => {
    const i = wholeFrom;
    setPracticing(false);
    setNotice(null);
    setSavedNext(null);
    setPendingMarks(null);
    setSave({ status: 'idle', progress: 0, error: null, clip: null });
    setPlaying(false);
    resetMarks();
    toBeatStart(i);
    setArming(true);
    countdown(() => {
      setArming(false);
      toBeatStart(i);
      if (voiceOn) setVoiceFrom(syncCursor(layout.beatFirst[i] ?? 0));
      if (!rec.begin({ videoBitsPerSecond: FULL_BITRATE, maxBytes: STOP_BYTES, meta: takeMeta('episode', i) })) return;
      const n = beats[i]?.number;
      marksRef.current = n != null ? [{ beat: Number(n), t: 0 }] : [];
      lastMarkedRef.current = i;
      setMarks(marksRef.current);
      rec.note({ marks: marksRef.current });
      setPlaying(true);
    });
  };
  // What the device keeps with a take, to review and save it after a reload.
  const takeMeta = (scope, at) => ({
    scope, beatIndex: at, beatNumber: beats[at]?.number ?? null, startLine: scope === 'beat' ? fromLine : 0, readAs, label,
  });
  // A take always counts 3-2-1 first (3 seconds to get into place); the 3-2-1
  // setting is for reading.
  const startTake = () => {
    if (whole) { recordWhole(); return; }
    setPracticing(false);
    setNotice(null);
    setSavedNext(null);
    setSave({ status: 'idle', progress: 0, error: null, clip: null });
    setPlaying(false);
    toStart();
    setArming(true);
    countdown(() => {
      setArming(false);
      toStart();
      if (voiceOn) setVoiceFrom(syncCursor(fromLine));
      if (rec.begin({ maxBytes: STOP_BYTES, meta: takeMeta('beat', current) })) setPlaying(true);
    });
  };
  const record = () => {
    if (rec.camera.status !== 'ready' || busyTake) return;
    startTake();
  };
  const stopTake = () => { cancelEnding(); setPlaying(false); rec.stop(); };
  // The take paused itself (the phone looked away, the camera was taken): the scroll waits too.
  useEffect(() => {
    if (rec.interrupted && recording) { cancelEnding(); setPlaying(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.interrupted]);
  // The take stopped itself just under the upload limit: say so; the scroll stops.
  useEffect(() => {
    if (!rec.limited) return;
    cancelEnding();
    setPlaying(false);
    setNotice(LIMIT_NOTE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.limited]);
  // Stop & review: the take stops and its review opens; before it starts, the 3-2-1 stops.
  const stopAndReview = () => {
    if (!recording) { if (count > 0) cancelCountdown(); return; }
    stopTake();
  };
  // A downloaded pasted-text take counts once it is done with.
  const doneWithTake = () => {
    if (downloaded && !isScript) setSessionTakes((k) => k + 1);
    setDownloaded(null);
    rec.discard();
  };
  // Retake: this take goes and the next one counts in straight away.
  const retake = () => {
    doneWithTake();
    setSave({ status: 'idle', progress: 0, error: null, clip: null });
    if (rec.camera.status === 'ready') startTake();
    else if (whole) { resetMarks(); toBeatStart(wholeFrom); } else toStart();
  };
  // Discard: asks, then back to the start of the beat (or the take's start line), nothing saved.
  const discardTake = () => {
    // A pasted-text take already downloaded: Done, nothing to ask.
    const kept = downloaded && !isScript;
    if (!kept && !window.confirm(downloaded ? "Throw this take away? It is downloaded, but not saved to the episode's Files." : 'Throw this take away? It has not been saved.')) return;
    doneWithTake();
    setSave({ status: 'idle', progress: 0, error: null, clip: null });
    if (whole) { resetMarks(); toBeatStart(wholeFrom); } else toStart();
  };
  // The end of the text: the prompter stops. A whole-episode take stops with
  // it; any other take ends ENDING_MS later ("Ending the take…"), then the review.
  endRef.current = () => {
    setPlaying(false);
    if (!recording) { endedRef.current = true; return; }
    if (whole) { stopTake(); return; }
    if (endTimerRef.current) return;
    setEnding(true);
    endTimerRef.current = window.setTimeout(() => { endTimerRef.current = null; setEnding(false); rec.stop(); }, ENDING_MS);
  };

  // The beat on the reading line while a whole-episode take runs: its
  // heading, as the scroll finds it, or the beat of the line on the reading line.
  const beatOfLine = (i) => {
    let b = 0;
    layout.beatFirst.forEach((f, k) => { if (f != null && f <= i) b = k; });
    return b;
  };
  const liveBeat = whole ? Math.max(current, beatOfLine(active)) : current;
  // Each beat heading reaching the reading line is a marker, in take time.
  useEffect(() => {
    if (!whole || !recording || liveBeat <= lastMarkedRef.current) return;
    const t = markTime(rec.takeTime());
    const add = [];
    for (let k = lastMarkedRef.current + 1; k <= liveBeat; k += 1) {
      if (beats[k]?.number != null) add.push({ beat: Number(beats[k].number), t });
    }
    lastMarkedRef.current = liveBeat;
    if (add.length) { marksRef.current = [...marksRef.current, ...add]; setMarks(marksRef.current); rec.note({ marks: marksRef.current }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whole, recording, liveBeat]);
  const liveNumber = beats[liveBeat]?.number ?? null;
  const lastNumber = beats.reduce((m, b) => (b.number != null && Number(b.number) > m ? Number(b.number) : m), 0);
  const takeSize = takeBytes(rec.bytes, rec.elapsed);

  const downloadMarks = (what) => {
    if (!what) return;
    try {
      const blob = new Blob([marksText(what.label, what.marks, source?.title || null)], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = marksFileName(what.label);
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => { try { URL.revokeObjectURL(url); } catch (err) { console.error('[Teleprompter] markers URL not revoked:', err); } }, 1000);
    } catch (err) {
      console.error('[Teleprompter] markers not downloaded:', err);
      setNotice('The markers could not be downloaded.');
    }
  };

  // Who is on camera in Files: JustAWoman, Lala, or a guest by name.
  const performer = readAs === HER ? 'justawoman' : readAs === 'Lala' ? 'lala' : 'guest';
  const beatNumber = beat?.number != null ? Number(beat.number) : null;
  const inFiles = clips.filter((c) => c.performer === performer && Number(c.beat_number) === beatNumber && (performer !== 'guest' || c.guest_name === readAs)).length;
  // Whole episode: "Full episode · take n", n from the full-episode takes in Files.
  const fullInFiles = fullTakes(clips).filter((c) => c.performer === performer && (performer !== 'guest' || c.guest_name === readAs)).length;
  const takeNo = whole ? fullInFiles + 1 : isScript ? inFiles + 1 : sessionTakes + 1;
  const label = whole ? fullTakeName(takeNo, readAs !== HER ? readAs : null)
    : isScript ? `${takeName(beat, takeNo, fromLine > 0 ? fromIndex + 1 : null)}${readAs !== HER ? ` · as ${readAs}` : ''}` : null;
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

  // The take to this device: a download (the review stays open; the take is
  // kept until she is done with it), or the phone's share sheet.
  const takeFile = isScript ? takeFileName(label, take ? takeExtension(take.type) : 'mp4') : (take ? downloadName(take.type) : null);
  const shareFile = useMemo(() => (take ? takeAsFile(take.blob, takeFile, take.type) : null), [take, takeFile]);
  const canShare = canShareTake(shareFile);
  const downloadTake = () => {
    if (!take) return;
    if (downloadBlob(take.blob, takeFile)) {
      setNotice(`Downloaded ${takeFile}`);
      setDownloaded(take.url);
    } else setSave((s) => ({ ...s, status: 'error', progress: 0, error: 'The take could not be downloaded.' }));
  };
  const shareThisTake = async () => {
    if (!shareFile) return;
    const how = await shareTake(shareFile, isScript ? label : 'Teleprompter take');
    if (how === 'shared') { setNotice(`Shared ${takeFile}`); setDownloaded(take?.url || true); } else if (how === 'failed') downloadTake();
  };

  // Before a big upload: a quick signed-in request, so the sign-in is fresh
  // (renewed here if it had run out). One that is over stops the save with
  // a plain message, the take kept; anything else goes on to the upload.
  const freshSignIn = async () => {
    try { await rawClipsApi.checkSession(source.episodeId); } catch (err) {
      if (err?.sessionExpired) throw err;
      console.error('[Teleprompter] sign-in check before the upload failed; uploading anyway:', err);
    }
  };

  const saveTake = async () => {
    if (!take) return;
    if (!isScript) { downloadTake(); return; }
    if (whole) { await saveWhole(); return; }
    let clip = save.clip;
    let stored = null;
    setSave((s) => ({ ...s, status: 'saving', error: null }));
    try {
      if (!clip) {
        await freshSignIn();
        const file = new File([take.blob], `beat-${beatNumber ?? 'x'}-take-${takeNo}.${takeExtension(take.type)}`, { type: take.type });
        // The beat, the start line and the length go with the upload (one request).
        ({ clip, stored } = await rawClipsApi.uploadTake(source.episodeId, file, {
          performer, label, guestName: performer === 'guest' ? readAs : undefined,
          beatNumber, startLine: fromIndex, seconds: take.seconds,
        }, (p) => setSave((s) => ({ ...s, progress: p }))));
        setSave((s) => ({ ...s, clip }));
      }
      // The scene the take is for (Production plays clips by beat_number),
      // and the line it started on, once the server keeps start lines. A
      // server that took them with the upload has linked it already.
      if (clip?.id && beatNumber >= 1 && beatNumber <= 14 && Number(clip.beat_number) !== beatNumber) {
        const changes = hasTakeFields(clip) && !stored ? { beat_number: beatNumber, start_line: fromIndex } : { beat_number: beatNumber };
        const linked = await rawClipsApi.update(source.episodeId, clip.id, changes, { keepSession: true });
        clip = { ...clip, ...(linked || changes) };
      }
      const seconds = take.seconds;
      setClips((c) => [...c, {
        ...clip, performer, guest_name: performer === 'guest' ? readAs : null, beat_number: beatNumber,
        duration_seconds: clip?.duration_seconds ?? seconds, created_at: clip?.created_at || new Date().toISOString(),
      }]);
      setNotice(`Saved to the episode's Files: ${label}`);
      // "Next beat →": the next beat, ready to record.
      setSavedNext(oneBeat && current < beats.length - 1 ? current + 1 : null);
      setSave({ status: 'idle', progress: 0, error: null, clip: null });
      doneWithTake();
    } catch (err) {
      console.error('[Teleprompter] take not saved:', err);
      const base = signInMessage(err) || (err?.response?.status === 413 ? 'The take is too big to upload.' : (err?.response?.data?.error || 'The take was not saved.'));
      setSave((s) => ({ ...s, clip, status: 'error', error: clip ? `It is in Files, but not linked to Beat ${beatNumber} yet. ${base}` : base }));
    }
  };

  // The whole-episode take: one file, beat_number left empty, then its markers.
  const saveWhole = async () => {
    const kept = cleanMarks(marksRef.current);
    let clip = save.clip;
    let keptSet = null;
    setSave((s) => ({ ...s, status: 'saving', error: null }));
    try {
      if (!clip) {
        await freshSignIn();
        const file = new File([take.blob], `full-episode-take-${takeNo}.${takeExtension(take.type)}`, { type: take.type });
        // The markers and the length go with the upload (one request).
        ({ clip, stored: keptSet } = await rawClipsApi.uploadTake(source.episodeId, file, {
          performer, label, guestName: performer === 'guest' ? readAs : undefined, beatMarks: kept, seconds: take.seconds,
        }, (p) => setSave((s) => ({ ...s, progress: p }))));
        setSave((s) => ({ ...s, clip }));
      }
      // A server that took the markers with the upload says whether it kept them.
      let stored = !!keptSet?.has('beat_marks');
      if (!keptSet && clip?.id && hasMarksField(clip)) {
        try {
          const linked = await rawClipsApi.update(source.episodeId, clip.id, { beat_marks: kept }, { keepSession: true });
          clip = { ...clip, ...(linked || { beat_marks: kept }) };
          stored = true;
        } catch (err) {
          // 409: the database update that keeps markers has not run.
          if (err?.response?.status !== 409) throw err;
          console.error('[Teleprompter] beat markers not kept yet:', err);
        }
      }
      const seconds = take.seconds;
      setClips((c) => [...c, {
        ...clip, performer, guest_name: performer === 'guest' ? readAs : null, beat_number: null,
        duration_seconds: clip?.duration_seconds ?? seconds, created_at: clip?.created_at || new Date().toISOString(),
      }]);
      if (stored) {
        setNotice(`Saved to the episode's Files: ${label} · ${kept.length} beat ${kept.length === 1 ? 'marker' : 'markers'}`);
        setPendingMarks(null);
      } else {
        setNotice(MARKS_NOT_KEPT);
        setPendingMarks({ label, marks: kept });
      }
      setSave({ status: 'idle', progress: 0, error: null, clip: null });
      doneWithTake();
      resetMarks();
    } catch (err) {
      console.error('[Teleprompter] full-episode take not saved:', err);
      const base = signInMessage(err) || (err?.response?.status === 413 ? `The take is too big to upload (the limit is ${UPLOAD_LIMIT_MB} MB).` : (err?.response?.data?.error || 'The take was not saved.'));
      setSave((s) => ({ ...s, clip, status: 'error', error: clip ? `It is in Files, but its beat markers are not saved yet. ${base}` : base }));
    }
  };

  const toggleRecord = () => {
    if (recordOn && busyTake && !window.confirm(recording ? 'A take is recording. Stop and throw it away?' : 'This take is not saved yet. Throw it away?')) return;
    cancelCountdown();
    cancelEnding();
    setPlaying(false);
    setSavedNext(null);
    if (recordOn) { doneWithTake(); resetMarks(); }
    setPracticing(false);
    setRecordOn((on) => !on);
  };

  // Leaving (the X, Escape, or the phone's Back): an unsaved take or voice
  // clip asks first; once she says so, its copy on this device goes too.
  const requestClose = () => {
    const ask = recording || count > 0 ? 'A take is recording. Stop and leave the teleprompter?'
      : (take || rec.finishing) ? 'This take is not saved yet. Leave and lose it?' : 'Your voice clip is not saved yet. Leave and lose it?';
    if (busyTake && !window.confirm(ask)) return false;
    cancelCountdown();
    if (busyTake) rec.discard();
    onCloseRef.current?.();
    return true;
  };
  useBackGuard(true, () => requestClose());

  // "You have an unsaved take": Review it opens it as she left it (Read &
  // record on, its beat, scope and markers); Throw it away forgets it.
  const reviewOffer = async () => {
    const o = offer;
    if (!o) return;
    setOffer(null);
    const m = o.meta || {};
    const got = await rec.restore(o);
    if (!got) { setNotice('That take could not be opened.'); return; }
    setNotice(null);
    setSavedNext(null);
    setSave({ status: 'idle', progress: 0, error: null, clip: null });
    if (isScript) {
      const at = Number.isInteger(m.beatIndex) && m.beatIndex >= 0 && m.beatIndex < beats.length ? m.beatIndex : current;
      setCurrent(at);
      setTakeScope(m.scope === 'episode' && canWhole ? 'episode' : 'beat');
      setStartLine(m.scope === 'beat' && Number.isInteger(m.startLine) ? m.startLine : 0);
      marksRef.current = cleanMarks(m.marks);
      lastMarkedRef.current = -1;
      setMarks(marksRef.current);
    }
    if (typeof m.readAs === 'string' && m.readAs) set('readAs', m.readAs);
    setRecordOn(true);
  };
  const dropOffer = async () => {
    const o = offer;
    if (!o || !window.confirm(`Throw away the take from ${takeWhen(o.startedAt)}? It can't be brought back.`)) return;
    setOffer(null);
    const gone = await takeStore().remove(o.id);
    if (!gone) console.error('[Teleprompter] unsaved take not thrown away:', o.id);
  };

  // "Next beat →" after a save: that beat, ready to record.
  const nextBeat = () => {
    if (savedNext == null) return;
    goTo(savedNext);
    window.setTimeout(() => recordBtnRef.current?.focus(), 0);
  };

  const faster = (dir) => {
    if (pacing === 'lines') set('pace', clamp(roundPace(pace + dir * 0.1), PACE_MIN, PACE_MAX));
    else set('speed', clamp(settings.speed + dir, SPEED_MIN, SPEED_MAX));
  };

  // The phone remote (batch 3): its commands do what the buttons here do.
  const [remoteOn, setRemoteOn] = useState(false);
  const [showRemote, setShowRemote] = useState(false);
  const onRemoteCommand = (cmd) => {
    switch (cmd) {
      case 'toggle': if (!take) togglePlay(); break;
      case 'faster': faster(1); break;
      case 'slower': faster(-1); break;
      case 'next_beat': if (isScript) goTo(current + 1); break;
      case 'prev_beat': if (isScript) goTo(current - 1); break;
      case 'bigger': set('size', clamp(settings.size + 4, SIZE_MIN, SIZE_MAX)); break;
      case 'smaller': set('size', clamp(settings.size - 4, SIZE_MIN, SIZE_MAX)); break;
      // A take starts only in Read & record; a stopped one waits for review here, never saved by itself.
      case 'record_start': if (recordOn && !busyTake && rec.camera.status === 'ready') record(); break;
      case 'record_stop': if (recording) stopAndReview(); break;
      default: break;
    }
  };
  const remoteState = {
    running: playing || count > 0, recording, recordMode: recordOn,
    canRecord: recordOn && rec.camera.status === 'ready' && !busyTake, reviewing: !!take,
    scope: whole ? 'episode' : 'beat', paused: !!rec.paused,
    beat: (whole ? liveNumber : beat?.number) ?? null, beatName: (whole ? beats[liveBeat]?.name : beat?.name) || null, title: isScript ? (source.title || 'Script') : 'Your text',
    pacing, speed: settings.speed, pace, size: settings.size,
  };
  const remote = useTeleprompterRemote(remoteOn, { episodeId: isScript ? source.episodeId || null : null, onCommand: onRemoteCommand, state: remoteState });
  const openRemote = () => {
    if (!remoteOn) { setRemoteOn(true); setShowRemote(true); return; }
    setShowRemote((v) => !v);
  };

  // Record voice (batch 3): the line on the reading line, someone else's spoken line in a numbered beat.
  const [voiceFor, setVoiceFor] = useState(null); // the flat index being recorded
  const voiceLineAt = (i) => {
    const l = flat[i];
    const w = where[i];
    if (!l || !w || !l.who || l.who === HER || (l.kind !== 'cue' && l.kind !== 'mine')) return null;
    return { beatNumber: w.beat, lineIndex: w.index, speaker: l.who, text: l.text };
  };
  const recordableLine = voiceEpisode && voiceReady ? voiceLineAt(active) : null;
  const voiceLine = voiceFor != null ? voiceLineAt(voiceFor) : null;
  // Closing the voice recorder with a clip not saved asks first.
  const closeVoice = () => {
    if (voiceBusy && !window.confirm('Your voice clip is not saved yet. Close and lose it?')) return;
    setVoiceFor(null);
  };
  const openVoice = () => { if (!recordableLine) return; setPlaying(false); cancelCountdown(); setVoiceFor(active); setShowTakes(false); setShowTimes(false); setShowRemote(false); };

  // Escape closes the open panel first; the reader only when none is open.
  const moreShown = () => {
    const el = moreRef.current;
    if (!el) return false;
    try { return window.getComputedStyle(el).display !== 'none'; } catch (err) {
      console.error('[Teleprompter] settings button style not read:', err);
      return true;
    }
  };
  const closePanel = () => {
    if (voiceLine && !take) setVoiceFor(null);
    else if (showRemote && remoteOn && !take) setShowRemote(false);
    else if (showTakes && canTakes && !take) setShowTakes(false);
    else if (showTimes && rehearsalKey && !take) setShowTimes(false);
    else if (more && !midTake && moreShown()) setMore(false);
    else return false;
    refocus();
    return true;
  };

  const onKeyDown = (e) => {
    const own = OWN_KEYS.has(e.target?.tagName);
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (closePanel()) { e.preventDefault(); return; }
      requestClose();
      return;
    }
    // Enter or S: stop the take and review it (Enter on a button does not press it too).
    if (recording && !own && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'Enter' || e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      stopAndReview();
      return;
    }
    // Space is Play/Pause on the reader's own buttons and speed slider too,
    // after a tap (reader audit: it pressed the last control again); in the
    // panels, the review sheet and text fields it keeps its own meaning.
    const control = !!e.target?.closest?.('.stp-bar, .stp-controls')
      && (e.target.tagName === 'BUTTON' || (e.target.tagName === 'INPUT' && e.target.type === 'range'));
    if (e.key === ' ' && (control || (!own && e.target?.tagName !== 'BUTTON'))) {
      e.preventDefault();
      if (control) refocus();
      if (!take) togglePlay();
      return;
    }
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
  const cueOn = showCue && !take && count === 0 && !ending;
  // Voice clips play through the speakers during a take; say how to keep them out of it.
  const headphones = recordOn && settings.playVoice && voiceClips.length > 0
    ? 'Voice clips play through the speakers during a take. Use headphones to keep them out of the take.' : null;
  // Each beat's lines as laid out (on-screen moments as set; cutscene lines marked).
  const shown = (oneBeat ? [{ ...beat, at: current }] : beats.map((b, i) => ({ ...b, at: i }))).map((b) => ({ ...b, shownLines: layout.beatLines[b.at] || [] }));
  const empty = isScript ? !beats.length && !script.intro.length : !flat.length;
  // "Start from": the beat's lines (on-screen moments are not a place to start); the top is 0.
  const startChoices = oneBeat
    ? flat.map((l, i) => ({ l, i })).filter(({ l }) => l.kind !== 'screen').map((c, k) => (k === 0 ? { ...c, i: 0 } : c))
    : [];
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
      className={`stp-root is-${settings.lineMode}${settings.mirror ? ' is-mirrored' : ''}${pacing !== 'steady' ? ' is-paced' : ''}${recordOn && rec.camera.status === 'ready' ? ' has-cam' : ''}`}
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
              <select value={readAs} aria-label="Read as" disabled={busyTake} onChange={(e) => { set('readAs', e.target.value); refocus(); }} data-testid="stp-read-as">
                {readAsChoices.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>
          )}
          {isScript && numbered && beats.length > 0 && (
            <div className="stp-beatnav">
              <button type="button" className="stp-btn is-icon" aria-label="Previous beat" data-testid="stp-prev" disabled={current === 0 || busyTake} onClick={() => goTo(current - 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
              <label className="stp-jump">
                <span className="stp-sr">Jump to beat</span>
                <select value={String(current)} disabled={busyTake} onChange={(e) => { goTo(Number(e.target.value)); refocus(); }} data-testid="stp-jump">
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
            {isScript && !oneBeat && layout.intro.map((l, i) => renderLine(l, `i-${i}`))}
            {isScript && shown.map((b) => (
              <section key={`${b.number}-${b.at}`} className="stp-beat" ref={(el) => { beatRefs.current[b.at] = el; }} data-testid="stp-beat" aria-current={b.at === current ? 'true' : undefined}>
                {b.number !== null && <h3 className="stp-beat-head">{b.number} · {b.name}</h3>}
                {isCutsceneBeat(b.number) && (
                  <p className="stp-cutscene" data-testid="stp-cutscene"><Clapperboard size={18} aria-hidden="true" /> Cutscene · watch &amp; comment</p>
                )}
                {b.shownLines.map((l, j) => renderLine(l, j))}
                {!b.shownLines.length && <p className="stp-direction">Nothing to read in this beat.</p>}
              </section>
            ))}
            {pasted && layout.groups.map((g, gi) => <div key={gi} className="stp-group">{g.map((l, j) => renderLine(l, j))}</div>)}
            {!isScript && !pasted && flat.map((l, i) => renderLine(l, i))}
            {empty && <p className="stp-direction">Nothing to read yet.</p>}
          </article>
          <div className="stp-spacer is-bottom" aria-hidden="true" />
        </div>
        <div className="stp-marker" aria-hidden="true" data-testid="stp-marker" />
        {cueOn && <SilenceCue line={atLine} left={cueLeft} total={cueTotal} reduced={reduced} voice={!!activeClip} />}
        <p className="stp-sr" role="status" data-testid="stp-quiet-live">{cueOn ? cueSays(atLine) : ''}</p>

        {(recording || meterStream || (practicing && recordLead)) && (
          <div className="stp-hud">
            {practicing && recordLead && (
              <div className="stp-practice" role="status" data-testid="stp-practicing">
                <Play size={14} aria-hidden="true" /> Practicing — not recording. Tap ● Record to record.
              </div>
            )}
            {recording && (
              <div className={`stp-recdot${rec.paused ? ' is-paused' : ''}`} role="status" data-testid="stp-recording">
                <span className="stp-dot" aria-hidden="true" /> {rec.paused ? 'PAUSED' : 'REC'} {clock(rec.elapsed)}
                {whole && liveNumber != null && <span data-testid="stp-rec-beat">· Beat {liveNumber} of {lastNumber}</span>}
                {whole && <span className="stp-rec-size" data-testid="stp-rec-size">· {sizeText(takeSize)}</span>}
                <span className="stp-rec-hint" data-testid="stp-rec-hint">
                  <span className="is-long">· Stop &amp; review when you&apos;re done</span>
                  <span className="is-short" aria-hidden="true">· Stop when done</span>
                </span>
              </div>
            )}
            {recording && interruptNote(rec.interrupted) && (
              <div className="stp-recwarn" role="alert" data-testid="stp-interrupted">
                <AlertTriangle size={16} aria-hidden="true" /> {interruptNote(rec.interrupted)}
              </div>
            )}
            {recording && ending && (
              <div className="stp-ending" role="status" data-testid="stp-ending">
                <Hourglass size={16} aria-hidden="true" /> Ending the take…
              </div>
            )}
            {recording && whole && takeSize >= WARN_BYTES && (
              <div className="stp-recwarn" role="alert" data-testid="stp-rec-warn">
                <AlertTriangle size={16} aria-hidden="true" /> Nearly {UPLOAD_LIMIT_MB} MB: that is the upload limit. Stop soon so the take can be saved.
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
          <TakesPanel takes={takes} beatNumber={beatNumber} onFavorite={toggleFavorite} starring={starring} error={takesError} loading={!clipsLoaded} fullTakes={fullTakes(clips)} />
        )}
        {showRemote && remoteOn && !take && <TeleprompterRemotePanel remote={remote} onClose={() => setShowRemote(false)} />}
        {voiceLine && !take && (
          <div className="stp-voicebox">
            <VoiceRecordPanel key={voiceFor} episodeId={voiceEpisode} line={voiceLine} clip={voiceByLine.get(lineKey(voiceLine.beatNumber, voiceLine.lineIndex)) || null}
              onSaved={(clip) => setVoiceClips((cs) => withClip(cs, clip))}
              onRemoved={(id) => setVoiceClips((cs) => cs.filter((c) => c.id !== id))}
              onNotReady={() => setVoiceReady(false)} onClose={() => setVoiceFor(null)} onBusy={setVoiceBusy} testId="stp-voice-panel" />
          </div>
        )}
        {showTimes && rehearsalKey && !take && (
          <RehearsalPanel rows={rehearsalRows} savedAt={savedNote} onReset={() => { setTimes({}); setSavedNote(null); }} onSave={saveTimes} />
        )}
        {count > 0 && <div className="stp-countdown" aria-live="assertive" data-testid="stp-countdown">{count}</div>}

        {take && (
          <div className="stp-review" role="region" aria-labelledby="stp-review-title" data-testid="stp-review">
            <div className="stp-review-head">
              <h3 className="stp-review-title" id="stp-review-title">Your take</h3>
              <p className="stp-review-name" data-testid="stp-review-name">{isScript ? label : `Take ${takeNo}`} · {clock(take.seconds)}</p>
            </div>
            <video ref={reviewRef} className="stp-review-video" src={take.url} controls playsInline data-testid="stp-review-video" />
            {whole && marks.length > 0 && (
              <MarkLinks marks={marks} onSeek={(t) => seekVideo(reviewRef.current, t)} testId="stp-review-marks" />
            )}
            {save.status === 'saving' && (
              <div className="stp-progress" role="progressbar" aria-valuenow={save.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Uploading the take">
                <span style={{ width: `${save.progress}%` }} />
              </div>
            )}
            {save.status === 'error' && <p className="stp-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {save.error}</p>}
            <div className="stp-review-actions">
              <button type="button" className="stp-btn is-primary stp-save" data-testid="stp-save" disabled={save.status === 'saving' || (isScript && !source.episodeId)} onClick={saveTake}>
                {isScript ? <Upload size={18} aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
                {save.status === 'error' ? 'Retry' : save.status === 'saving' ? 'Saving…' : isScript ? (
                  <span className="stp-save-text"><span className="stp-save-main">Save take</span><span className="stp-save-sub">to the episode&apos;s Files</span></span>
                ) : downloaded ? 'Download again' : 'Download the take'}
              </button>
              {/* A script take can go to this device too (one too big for Files, or a copy). */}
              {isScript && (
                <button type="button" className="stp-btn" data-testid="stp-download-take" disabled={save.status === 'saving'} onClick={downloadTake}
                  aria-label="Download the take" title="Download the take to this device">
                  <Download size={18} aria-hidden="true" /> Download
                </button>
              )}
              {canShare && (
                <button type="button" className="stp-btn" data-testid="stp-share-take" disabled={save.status === 'saving'} onClick={shareThisTake}
                  aria-label="Save to Photos or Files" title="Save to Photos or Files (share)">
                  <Share2 size={18} aria-hidden="true" /> Share
                </button>
              )}
              <button type="button" className="stp-btn" data-testid="stp-retake" disabled={save.status === 'saving' || !!save.clip} onClick={retake}><RotateCcw size={18} aria-hidden="true" /> Retake</button>
              {whole && marks.length > 0 && (
                <button type="button" className="stp-btn" data-testid="stp-review-download-marks" onClick={() => downloadMarks({ label, marks: cleanMarks(marks) })}>
                  <FileDown size={18} aria-hidden="true" /> Download markers
                </button>
              )}
              <button type="button" className={`stp-btn${downloaded && !isScript ? '' : ' is-discard'}`} data-testid="stp-discard" disabled={save.status === 'saving' || !!save.clip} onClick={discardTake}>
                {downloaded && !isScript ? <><CheckCircle2 size={18} aria-hidden="true" /> Done</> : <><Trash2 size={18} aria-hidden="true" /> Discard</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {(problem || notice || headphones) && (
        <p className={`stp-status${!problem ? ' is-ok' : ''}${!problem && !notice ? ' is-note' : ''}`} role={problem ? 'alert' : 'status'} data-testid="stp-status">
          {problem ? <AlertTriangle size={16} aria-hidden="true" /> : notice ? <CheckCircle2 size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
          <span>{problem || notice || headphones}</span>
          {/* After a save the headphones note stays, on a line of its own. */}
          {!problem && notice && headphones && <span className="stp-status-note" data-testid="stp-headphones">{headphones}</span>}
          {rec.camera.status === 'error' && <button type="button" className="stp-btn is-small" onClick={rec.retry}>Try again</button>}
          {savedNext != null && notice && !problem && (
            <button type="button" className="stp-btn is-primary stp-nextbeat" data-testid="stp-next-beat" onClick={nextBeat}
              aria-label={`Next beat: ${beats[savedNext]?.number ?? ''} · ${beats[savedNext]?.name ?? ''}, ready to record`}>
              Next beat <ArrowRight size={18} aria-hidden="true" />
            </button>
          )}
          {pendingMarks && !problem && (
            <button type="button" className="stp-btn" data-testid="stp-download-marks" onClick={() => downloadMarks(pendingMarks)}>
              <FileDown size={18} aria-hidden="true" /> Download markers
            </button>
          )}
        </p>
      )}

      {offer && !take && !recording && (
        <p className="stp-status is-ok" role="status" data-testid="stp-recover">
          <History size={16} aria-hidden="true" />
          <span>You have an unsaved take from {takeWhen(offer.startedAt)}{offer.meta?.label ? ` (${offer.meta.label})` : ''}.</span>
          <button type="button" className="stp-btn is-primary" data-testid="stp-recover-review" onClick={reviewOffer}>Review it</button>
          <button type="button" className="stp-btn" data-testid="stp-recover-drop" onClick={dropOffer}><Trash2 size={18} aria-hidden="true" /> Throw it away</button>
        </p>
      )}

      <div className={`stp-controls${takeLive ? ' is-take' : ''}`} data-testid="stp-controls">
        {takeLive ? (
          <>
            {/* A take: the way out is the biggest thing on the bar. */}
            <button type="button" className="stp-btn is-stop" data-testid="stp-stop" onClick={stopAndReview}
              title={recording ? 'Stop the take and review it (Enter or S)' : 'Stop before the take starts'}>
              <Square size={20} aria-hidden="true" fill="currentColor" /><span>{recording ? 'Stop & review' : 'Stop'}</span>
            </button>
            <button type="button" className="stp-btn is-pausetake" data-testid="stp-play" aria-pressed={playing} disabled={!recording}
              aria-label={takePaused ? 'Resume the take' : 'Pause the take'} title={takePaused ? 'Carry on scrolling and recording' : 'Pause the scroll and the recording'} onClick={togglePlay}>
              {takePaused ? <Play size={20} aria-hidden="true" /> : <Pause size={20} aria-hidden="true" />}
              <span>{takePaused ? 'Resume' : 'Pause'}</span>
            </button>
          </>
        ) : recordLead ? (
          <>
            <button type="button" ref={recordBtnRef} className="stp-btn is-rec is-lead" data-testid="stp-record" disabled={rec.camera.status !== 'ready' || busyTake} onClick={record}
              title={isScript && beat ? `Record ${label}` : `Record take ${takeNo}`}>
              <Circle size={18} aria-hidden="true" fill="currentColor" /> {whole ? `Record whole episode · take ${takeNo}` : isScript && beatNumber != null ? `Record beat ${beatNumber} · take ${takeNo}` : `Record take ${takeNo}`}
            </button>
            {/* Play only scrolls: in Read & record it says so. */}
            <button type="button" className="stp-btn stp-practice-btn" data-testid="stp-play" aria-pressed={playing}
              aria-label={playing || count > 0 ? 'Pause practice' : 'Practice — scroll without recording'} title="Scroll the words without recording" onClick={togglePlay}>
              {playing || count > 0 ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
              <span>{playing || count > 0 ? 'Pause' : 'Practice'}</span>
            </button>
          </>
        ) : (
          <button type="button" className="stp-btn is-primary is-play" data-testid="stp-play" aria-pressed={playing} aria-label={playing || count > 0 ? 'Pause' : 'Play'} disabled={!!take} onClick={togglePlay}>
            {playing || count > 0 ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
            <span className="stp-btn-text">{playing || count > 0 ? 'Pause' : 'Play'}</span>
          </button>
        )}
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
        {/* On a phone the settings fold away behind one button, so the words keep the screen.
            Mid-take and in review they hide: nothing that changes the layout then. */}
        {!midTake && (<>
        <button type="button" ref={moreRef} className="stp-btn is-icon stp-more" data-testid="stp-more" aria-expanded={more} aria-controls="stp-extras" aria-label={more ? 'Hide settings' : 'Show settings'} onClick={() => setMore((m) => !m)}>
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
        <button type="button" className="stp-btn" data-testid="stp-countdown-toggle" aria-pressed={settings.countdown} title="Count 3-2-1 before scrolling (a take always counts 3-2-1 first)" onClick={() => set('countdown', !settings.countdown)}>
          <Timer size={18} aria-hidden="true" /> 3-2-1
        </button>
        <div className="stp-pacing" role="group" aria-label="Pacing">
          <button type="button" className="stp-btn" data-testid="stp-pace-steady" aria-pressed={pacing === 'steady'} onClick={() => { cancelCountdown(); setPlaying(false); set('pacing', 'steady'); }}>Steady</button>
          {hasLines && (
            <button type="button" className="stp-btn" data-testid="stp-pace-lines" aria-pressed={pacing === 'lines'} title="Hold each line on the reading line for its estimated time"
              onClick={() => { cancelCountdown(); setPlaying(false); set('pacing', pacing === 'lines' ? 'steady' : 'lines'); }}>
              <Hourglass size={18} aria-hidden="true" /> Pace by line times
            </button>
          )}
          <button type="button" className="stp-btn" data-testid="stp-pace-voice" aria-pressed={pacing === 'voice'} disabled={!voiceSupported}
            title={voiceSupported ? 'Scroll as you read your lines aloud' : 'Needs Chrome or Edge'}
            onClick={() => { cancelCountdown(); setPlaying(false); set('pacing', pacing === 'voice' ? 'steady' : 'voice'); }}>
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
        {voiceEpisode && voiceReady !== null && (
          <button type="button" className="stp-btn" data-testid="stp-voice-toggle" aria-pressed={voiceReady && settings.playVoice} disabled={!voiceReady}
            title={voiceReady ? "Play the lines you recorded in someone else's voice when they reach the reading line" : VOICE_NOT_READY}
            onClick={() => set('playVoice', !settings.playVoice)}>
            <Volume2 size={18} aria-hidden="true" /> Play voice clips
            {!voiceReady && <span className="stp-needs" data-testid="stp-voice-not-ready">Waiting on a database update</span>}
          </button>
        )}
        <button type="button" className="stp-btn" data-testid="stp-remote-toggle" aria-pressed={showRemote && remoteOn}
          aria-label={remote.status === 'live' ? 'Phone remote: connected session open' : 'Phone remote'} onClick={openRemote}>
          <Smartphone size={18} aria-hidden="true" /> Phone remote{remote.status === 'live' && <span className="stp-live-dot" aria-hidden="true" />}
        </button>
        {hasScreen && (
          <button type="button" className="stp-btn" data-testid="stp-screen-toggle" aria-pressed={settings.screen} disabled={busyTake}
            title="Show what happens on Lala's screen as a cue to react to"
            onClick={() => { cancelCountdown(); setPlaying(false); set('screen', !settings.screen); }}>
            <MonitorPlay size={18} aria-hidden="true" /> Show on-screen moments
          </button>
        )}
        {hasLines && (
          <div className="stp-modes" role="group" aria-label="Lines">
            <button type="button" className="stp-btn" data-testid="stp-mode-mine" aria-pressed={settings.lineMode === 'mine'} onClick={() => set('lineMode', 'mine')}>My lines big</button>
            <button type="button" className="stp-btn" data-testid="stp-mode-same" aria-pressed={settings.lineMode === 'same'} onClick={() => set('lineMode', 'same')}>Everything the same</button>
          </div>
        )}
        </div>
        </>)}
        {canTakes && !midTake && (
          <button type="button" className="stp-btn" data-testid="stp-takes-toggle" aria-pressed={showTakes} aria-label={`Takes for beat ${beatNumber}: ${takes.length}`}
            onClick={() => { setShowTakes((v) => !v); setShowTimes(false); }}>
            <Film size={18} aria-hidden="true" /> <span className="stp-btn-text">Takes</span> <span className="stp-count">{takes.length}</span>
          </button>
        )}
        {recordableLine && !recordOn && !take && (
          <button type="button" className="stp-btn" data-testid="stp-voice-record" aria-pressed={voiceFor != null}
            aria-label={`Record voice for this ${recordableLine.speaker} line`} onClick={voiceFor != null ? closeVoice : openVoice}>
            <Mic size={18} aria-hidden="true" /> <span className="stp-btn-text">Record voice</span>
            {voiceByLine.has(lineKey(recordableLine.beatNumber, recordableLine.lineIndex)) && <span className="stp-count" aria-hidden="true">✓</span>}
          </button>
        )}
        {!midTake && (
          <button type="button" className={`stp-btn${recordOn ? ' is-on' : ''}`} data-testid="stp-record-mode" aria-pressed={recordOn} onClick={toggleRecord}>
            {recordOn ? <Video size={18} aria-hidden="true" /> : <VideoOff size={18} aria-hidden="true" />} Read &amp; record
          </button>
        )}
        {recordOn && canWhole && !midTake && (
          <div className="stp-scope" role="group" aria-label="What a take records">
            <button type="button" className="stp-btn" data-testid="stp-scope-beat" aria-pressed={!whole} disabled={busyTake} onClick={() => setTakeScope('beat')}>One beat</button>
            <button type="button" className="stp-btn" data-testid="stp-scope-episode" aria-pressed={whole} disabled={busyTake} onClick={() => setTakeScope('episode')}>
              <Clapperboard size={18} aria-hidden="true" /> Whole episode
            </button>
          </div>
        )}
        {whole && !midTake && (
          <label className="stp-startfrom">
            <span className="stp-startfrom-label" aria-hidden="true">From</span>
            <select value={episodeFrom} aria-label="Record the whole episode from" disabled={busyTake} data-testid="stp-episode-from" onChange={(e) => { setEpisodeFrom(e.target.value); refocus(); }}>
              <option value="first">From beat {beats[firstBeat]?.number ?? 1}</option>
              <option value="this">From this beat ({beat?.number ?? ''})</option>
            </select>
          </label>
        )}
        {oneBeat && beat && startChoices.length > 1 && !midTake && (
          <label className="stp-startfrom">
            <span className="stp-startfrom-label" aria-hidden="true">Start from</span>
            <select value={String(fromLine)} aria-label="Start the take from line" disabled={busyTake} data-testid="stp-start-line"
              onChange={(e) => { const i = Number(e.target.value); setStartLine(i); if (i > 0) scrollToLine(i); else scrollToBox(0); setActive(i); refocus(); }}>
              {startChoices.map(({ l, i }) => <option key={i} value={String(i)}>{i === 0 ? `${lineChoice(l, l.vi ?? 0)} (the top)` : lineChoice(l, l.vi)}</option>)}
            </select>
          </label>
        )}
      </div>
    </div>,
    document.body,
  );
}
