// frontend/src/components/Episodes/ScriptTableRead.jsx
// Table read (Script tab audit, 2026-10-15): the script as the page has it,
// saved or not, read through full screen: beat headings, who speaks in their
// colour, actions in italics, phone and overlay moments in words, no tags.
// The same view prints (printMode), so Print / PDF is the table read on paper.

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Smartphone, ScrollText } from 'lucide-react';
import { scriptSections, readLine, castOf } from '../../lib/scriptExport';
import { isHerSpeaker } from '../../lib/scriptSpeaker';
import useDialogLayer from '../../hooks/useDialogLayer';
import './ScriptTableRead.css';

// The Script tab's own speaker colours (EpisodeScriptTab ScriptLine `sc`);
// anyone else gets one of these, the same one every time.
const SPEAKER_COLORS = { Prime: 'var(--primary-text)', Lala: 'var(--accent-dark)', Kelli: 'var(--info-text)', Guest: 'var(--success-text)' };
const OTHER_COLORS = ['var(--lala-gold-text)', 'var(--lala-teal-dark)', 'var(--lala-pink-dark)', 'var(--lala-lavender-text)', 'var(--warning-text)', 'var(--danger-text)'];
export function speakerColor(name) {
  // Her names are JustAWoman, in one colour (Evoni, 2026-10-24).
  if (isHerSpeaker(name)) return SPEAKER_COLORS.Prime;
  if (SPEAKER_COLORS[name]) return SPEAKER_COLORS[name];
  let h = 0;
  for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return OTHER_COLORS[h % OTHER_COLORS.length];
}

const SIZES = [16, 18, 20, 22, 24, 27, 30];
const SIZE_KEY = 'scriptTableRead.fontSize';
function readSize() {
  try {
    const n = Number(window.localStorage.getItem(SIZE_KEY));
    return SIZES.includes(n) ? n : 20;
  } catch (err) {
    console.error('[ScriptTableRead] font size not read:', err);
    return 20;
  }
}

const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function Element({ r }) {
  switch (r.type) {
    case 'dialogue':
      return (
        <div className="str-dialogue" data-testid="table-read-dialogue">
          <span className="str-speaker" style={{ '--str-speaker': speakerColor(r.speaker) }}>{r.speaker}</span>
          {r.paren && <span className="str-paren">{r.paren}</span>}
          <p className="str-words">{r.text}</p>
        </div>
      );
    case 'action': return <p className="str-action">{r.text}</p>;
    case 'narration': return <p className="str-narration">{r.text}</p>;
    case 'moment':
      return <p className="str-moment" data-testid="table-read-moment"><Smartphone size={13} aria-hidden="true" /> {r.text}</p>;
    // Transitions and every other tag are for production, not the read.
    default: return null;
  }
}

export default function ScriptTableRead({ scriptText, title = '', onScreen = null, startBeat = 0, printMode = false, onClose, episodeId = null, cast = null }) {
  const { preamble, beats } = useMemo(() => scriptSections(scriptText), [scriptText]);
  // `marcus:` in lower case is Marcus when the script or the episode names him (lib/scriptSpeaker).
  const people = useMemo(() => castOf(preamble, beats, cast), [preamble, beats, cast]);
  const read = (lines) => lines.map((l) => readLine(l, onScreen, { cast: people })).filter((r) => r && ['dialogue', 'action', 'narration', 'moment'].includes(r.type));
  const [current, setCurrent] = useState(() => Math.min(Math.max(0, startBeat), Math.max(0, beats.length - 1)));
  const [size, setSize] = useState(readSize);
  const dialogRef = useRef(null);
  const scrollRef = useRef(null);
  const beatRefs = useRef([]);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // A dialog on the page's stack, so History under it leaves its Escape and
  // Tab alone (Script page audit 3, 2026-10-19; hooks/useDialogLayer).
  useDialogLayer(true);

  // Focus goes into the dialog and back to whatever opened it; the page
  // behind does not scroll while it is open.
  useLayoutEffect(() => {
    const opener = document.activeElement;
    document.body.classList.add('str-open');
    dialogRef.current?.focus();
    return () => {
      document.body.classList.remove('str-open');
      if (opener && typeof opener.focus === 'function' && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    if (startBeat > 0) beatRefs.current[current]?.scrollIntoView?.({ block: 'start' });
    // Only where it opened; later moves scroll from goTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(SIZE_KEY, String(size)); } catch (err) { console.error('[ScriptTableRead] font size not kept:', err); }
  }, [size]);

  // Print / PDF: the view prints as soon as it is up, and closes after.
  useEffect(() => {
    if (!printMode) return undefined;
    const done = () => onCloseRef.current?.();
    window.addEventListener('afterprint', done);
    try { window.print(); } catch (err) { console.error('[ScriptTableRead] print failed:', err); }
    return () => window.removeEventListener('afterprint', done);
  }, [printMode]);

  const goTo = (i) => {
    if (i < 0 || i >= beats.length) return;
    setCurrent(i);
    beatRefs.current[i]?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  };

  // The beat being read follows the scroll, so Next goes on from there.
  const onScroll = () => {
    const box = scrollRef.current;
    if (!box) return;
    let at = 0;
    beatRefs.current.forEach((el, i) => { if (el && el.offsetTop - box.offsetTop <= box.scrollTop + 48) at = i; });
    // Scrolled to the end: the last beat, whose top can't reach the top of
    // the box (Script page re-audit, 2026-10-19: it read one beat behind).
    if (box.scrollHeight > box.clientHeight && box.scrollTop + box.clientHeight >= box.scrollHeight - 2) at = Math.max(0, beats.length - 1);
    if (at !== current) setCurrent(at);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
    if (e.key !== 'Tab') return;
    // Tab stays inside the dialog.
    const items = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const numbered = beats.filter((b) => b.number !== null).length > 0;
  const sizeAt = SIZES.indexOf(size);
  const intro = read(preamble);

  return createPortal(
    <div
      ref={dialogRef}
      className={`str-root${printMode ? ' is-print' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="str-title"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-testid="table-read"
    >
      <div className="str-bar">
        <h2 className="str-title" id="str-title">
          <span className="str-kicker">Table read</span>
          {title && <span className="str-episode">{title}</span>}
        </h2>
        <div className="str-controls">
          {numbered && beats.length > 1 && (
            <>
              <label className="str-jump">
                <span className="str-sr">Jump to beat</span>
                <select value={String(current)} onChange={(e) => goTo(Number(e.target.value))} data-testid="table-read-jump">
                  {beats.map((b, i) => <option key={`${b.number}-${i}`} value={String(i)}>{b.number} · {b.name}</option>)}
                </select>
              </label>
              <button type="button" className="str-icon-btn" aria-label="Previous beat" data-testid="table-read-prev" disabled={current === 0} onClick={() => goTo(current - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
              <button type="button" className="str-icon-btn" aria-label="Next beat" data-testid="table-read-next" disabled={current >= beats.length - 1} onClick={() => goTo(current + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
            </>
          )}
          {/* Table read → Teleprompter on the beat being read (Evoni, 2026-10-20). */}
          {episodeId && !printMode && (
            <Link className="str-icon-btn str-prompter" data-testid="table-read-teleprompter"
              to={`/teleprompter?episode=${encodeURIComponent(episodeId)}${beats[current]?.number != null ? `&beat=${encodeURIComponent(beats[current].number)}` : ''}`}
              title="Read this beat on the teleprompter (the saved script)">
              <ScrollText size={16} aria-hidden="true" /> Teleprompter
            </Link>
          )}
          <button type="button" className="str-icon-btn str-size" aria-label="Smaller text" disabled={sizeAt <= 0} onClick={() => setSize(SIZES[sizeAt - 1])}>A-</button>
          <button type="button" className="str-icon-btn str-size" aria-label="Larger text" disabled={sizeAt >= SIZES.length - 1} onClick={() => setSize(SIZES[sizeAt + 1])}>A+</button>
          <button type="button" className="str-icon-btn" aria-label="Close table read" data-testid="table-read-close" onClick={() => onClose?.()}><X size={20} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="str-scroll" ref={scrollRef} onScroll={onScroll}>
        <article className="str-page" style={{ '--str-size': `${size}px` }}>
          {title && <h1 className="str-print-title">{title}</h1>}
          {intro.map((r, i) => <Element key={`p-${i}`} r={r} />)}
          {beats.map((b, i) => (
            <section key={`${b.number}-${i}`} className="str-beat" ref={(el) => { beatRefs.current[i] = el; }} data-testid="table-read-beat" aria-current={numbered && i === current ? 'true' : undefined}>
              {b.number !== null && <h3 className="str-beat-head">{b.number} · {b.name}</h3>}
              {read(b.lines).map((r, j) => <Element key={j} r={r} />)}
            </section>
          ))}
          {!beats.length && !intro.length && <p className="str-narration">No script yet.</p>}
        </article>
      </div>
    </div>,
    document.body,
  );
}
