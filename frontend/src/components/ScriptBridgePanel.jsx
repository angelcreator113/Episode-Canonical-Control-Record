/**
 * ScriptBridgePanel.jsx
 * frontend/src/components/ScriptBridgePanel.jsx
 *
 * Lives in the Book Editor right sidebar — generates episode scripts
 * from approved book lines.
 *
 * Two pipelines visible:
 *   JustAWomanInHerPrime → book lines adapted into narrator voice
 *   Lala                 → generated from stat conditions + personality
 *
 * Usage in StorytellerPage.jsx:
 *
 *   import ScriptBridgePanel from '../components/ScriptBridgePanel';
 *
 *   // Add tab:
 *   { key: 'script', label: '⟶ Script' }
 *
 *   // Render:
 *   {activeRightTab === 'script' && (
 *     <ScriptBridgePanel
 *       bookId={book.id}
 *       bookTitle={book.title}
 *       chapterId={activeChapter?.id}
 *       chapterTitle={activeChapter?.title}
 *       showId={showId}
 *     />
 *   )}
 */

import { useState } from 'react';

const API = '/api/v1/memories/generate-script-from-book';

const GOLD  = '#C9A84C';
const INK   = '#1C1917';
const PARCH = '#FAF8F4';

const PNOS_ACTS = [
  'Act I — Pattern',
  'Act II — Pressure',
  'Act III — Pivot',
  'Act IV — Build',
  'Act V — Integration',
];

const PNOS_BELIEFS = [
  'If I find the right niche, everything will click.',
  'Maybe I\'m just not meant for this. Maybe I\'m delusional.',
  'What if I stop trying to fit into niches and create my own world?',
  'I can sustain this. Even when it\'s fragile. Even when no one is watching.',
  'This is the first thing I\'ve built that feels like me.',
];

const ARCS = ['ARC 1', 'ARC 2', 'ARC 3'];

export default function ScriptBridgePanel({ bookId, bookTitle, chapterId, chapterTitle, showId }) {
  const [form, setForm] = useState({
    event_name:     '',
    event_prestige: 7,
    dress_code:     '',
    stakes:         '',
    episode_arc:    'ARC 1',
    pnos_act:       'Act I — Pattern',
    pnos_belief:    PNOS_BELIEFS[0],
    line_count:     5,
    lala_confidence: 75,
    lala_reputation: 50,
    lala_coins:      400,
  });

  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);
  const [copied,   setCopied]   = useState(false);
  const [tab,      setTab]      = useState('form'); // 'form' | 'script' | 'breakdown'

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  async function generate() {
    if (!bookId) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          book_id:     bookId,
          chapter_id:  chapterId || undefined,
          show_id:     showId    || undefined,
          event_name:  form.event_name  || 'Upcoming Event',
          event_prestige: Number(form.event_prestige),
          dress_code:  form.dress_code  || 'Luxury',
          stakes:      form.stakes      || 'Building reputation',
          episode_arc: form.episode_arc,
          pnos_act:    form.pnos_act,
          pnos_belief: form.pnos_belief,
          line_count:  Number(form.line_count),
          lala_stats: {
            confidence: Number(form.lala_confidence),
            reputation: Number(form.lala_reputation),
            coins:      Number(form.lala_coins),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setResult(data);
      setTab('script');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyScript() {
    if (!result?.script) return;
    await navigator.clipboard.writeText(result.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={s.shell}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <div style={s.headerLabel}>SCRIPT BRIDGE</div>
          <div style={s.headerPipeline}>
            <PipelineTag color='#C9A84C' label='JLAW ← book' />
            <span style={s.pipeArrow}>+</span>
            <PipelineTag color='#E879F9' label='LALA ← stats' />
          </div>
        </div>
        {chapterTitle && (
          <div style={s.chapterRef}>from: {chapterTitle}</div>
        )}
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {[
          { key: 'form',      label: '⚙ Config'    },
          { key: 'script',    label: '⟶ Script',   disabled: !result },
          { key: 'breakdown', label: '◈ Breakdown', disabled: !result },
        ].map(t => (
          <button
            key={t.key}
            style={{
              ...s.tab,
              borderBottom: tab === t.key ? `2px solid ${GOLD}` : '2px solid transparent',
              color: tab === t.key ? GOLD : 'rgba(28,25,23,0.35)',
              opacity: t.disabled ? 0.3 : 1,
            }}
            onClick={() => !t.disabled && setTab(t.key)}
            disabled={t.disabled}
            type='button'
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Config form */}
      {tab === 'form' && (
        <div style={s.form}>

          {/* Guidance intro */}
          <div style={{
            background: 'rgba(201,168,76,0.06)',
            border: '1px solid rgba(201,168,76,0.15)',
            borderRadius: 6,
            padding: '12px 14px',
            marginBottom: 18,
          }}>
            <div style={{
              fontFamily: "'Lora', serif",
              fontSize: 14,
              fontWeight: 600,
              color: '#96790F',
              marginBottom: 6,
            }}>
              Book → Episode Script
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              color: 'rgba(28,25,23,0.6)',
              lineHeight: 1.55,
            }}>
              Configure the episode scene below, then hit <strong>Generate Script</strong>.
              The bridge pulls approved lines from the current chapter and generates
              a two-character script — <em>JustAWomanInHerPrime</em> (adapted from book)
              and <em>Lala</em> (AI-driven by her stats).
            </div>
          </div>

          <Field label='Event name'>
            <input
              style={s.input}
              value={form.event_name}
              onChange={e => set('event_name', e.target.value)}
              placeholder='Velour Annual Gala'
            />
          </Field>

          <div style={s.row}>
            <Field label='Prestige (1-10)'>
              <input
                style={{ ...s.input, width: 60 }}
                type='number' min={1} max={10}
                value={form.event_prestige}
                onChange={e => set('event_prestige', e.target.value)}
              />
            </Field>
            <Field label='Lines from book'>
              <input
                style={{ ...s.input, width: 60 }}
                type='number' min={1} max={10}
                value={form.line_count}
                onChange={e => set('line_count', e.target.value)}
              />
            </Field>
          </div>

          <Field label='Dress code'>
            <input
              style={s.input}
              value={form.dress_code}
              onChange={e => set('dress_code', e.target.value)}
              placeholder='Black tie, luxury'
            />
          </Field>

          <Field label='Stakes'>
            <textarea
              style={{ ...s.input, minHeight: 52, resize: 'vertical' }}
              value={form.stakes}
              onChange={e => set('stakes', e.target.value)}
              placeholder='First major prestige test. She needs this one.'
              rows={2}
            />
          </Field>

          {/* Arc + PNOS */}
          <div style={s.divider}>
            <span style={s.dividerLabel}>PNOS POSITION</span>
          </div>

          <Field label='Arc'>
            <select style={s.input} value={form.episode_arc} onChange={e => set('episode_arc', e.target.value)}>
              {ARCS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>

          <Field label='PNOS Act'>
            <select style={s.input} value={form.pnos_act} onChange={e => set('pnos_act', e.target.value)}>
              {PNOS_ACTS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>

          <Field label="JustAWoman's current belief">
            <select
              style={{ ...s.input, fontStyle: 'italic' }}
              value={form.pnos_belief}
              onChange={e => set('pnos_belief', e.target.value)}
            >
              {PNOS_BELIEFS.map(b => (
                <option key={b} value={b}>"{b}"</option>
              ))}
            </select>
          </Field>

          {/* Lala stats */}
          <div style={s.divider}>
            <span style={s.dividerLabel}>LALA'S CURRENT STATS</span>
            <span style={s.dividerSub}>drives her dialogue tone</span>
          </div>

          <div style={s.statsGrid}>
            <StatSlider
              label='Confidence'
              value={form.lala_confidence}
              onChange={v => set('lala_confidence', v)}
              color='#C9A84C'
            />
            <StatSlider
              label='Reputation'
              value={form.lala_reputation}
              onChange={v => set('lala_reputation', v)}
              color='#60A5FA'
            />
            <StatSlider
              label='Coins'
              value={form.lala_coins}
              max={2000}
              onChange={v => set('lala_coins', v)}
              color='#34D399'
            />
          </div>

          {/* Tone preview */}
          <div style={s.tonePreview}>
            <div style={s.toneLabel}>LALA WILL SOUND</div>
            <div style={s.toneText}>{getLalaTonePreview(form)}</div>
          </div>

          {/* Error */}
          {error && (
            <div style={s.errorBox}>{error}</div>
          )}

          {/* Generate button */}
          <button
            style={{
              ...s.generateBtn,
              opacity: loading ? 0.6 : 1,
              cursor:  loading ? 'not-allowed' : 'pointer',
            }}
            onClick={generate}
            disabled={loading}
            type='button'
          >
            {loading
              ? <><span style={s.spinner}>◌</span> Generating…</>
              : '⟶ Generate Script'}
          </button>

          {!chapterId && (
            <div style={s.note}>
              No chapter selected. Will use the most recent chapter with approved lines.
            </div>
          )}
        </div>
      )}

      {/* Script output */}
      {tab === 'script' && result && (
        <div style={s.scriptPane}>
          <div style={s.scriptActions}>
            <div style={s.scriptMeta}>
              {result.beat_count} beats · {result.meta?.lines_used} book lines
            </div>
            <button
              style={s.copyBtn}
              onClick={copyScript}
              type='button'
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          {/* Character pipeline indicators */}
          <div style={s.characterPipeline}>
            <div style={s.pipelineItem}>
              <div style={{ ...s.pipelineDot, background: GOLD }} />
              <div>
                <div style={{ ...s.pipelineCharName, color: GOLD }}>JustAWomanInHerPrime</div>
                <div style={s.pipelineSource}>adapted from: {result.meta?.chapter_title}</div>
              </div>
            </div>
            <div style={s.pipelineItem}>
              <div style={{ ...s.pipelineDot, background: '#E879F9' }} />
              <div>
                <div style={{ ...s.pipelineCharName, color: '#E879F9' }}>Lala</div>
                <div style={s.pipelineSource}>generated · {result.meta?.lala_tone}</div>
              </div>
            </div>
          </div>

          <pre style={s.scriptText}>{result.script}</pre>

          <button
            style={s.regenerateBtn}
            onClick={() => setTab('form')}
            type='button'
          >
            ← Edit & Regenerate
          </button>
        </div>
      )}

      {/* Beat breakdown */}
      {tab === 'breakdown' && result && (
        <div style={s.breakdown}>
          <div style={s.breakdownSection}>
            <div style={s.breakdownLabel}>SOURCE LINES USED</div>
            {result.source_lines?.map((line, i) => (
              <div key={line.id || i} style={s.sourceLine}>
                <div style={s.sourceLineNum}>{String(i + 1).padStart(2, '0')}</div>
                <div style={s.sourceLineText}>{line.content}</div>
              </div>
            ))}
          </div>

          <div style={s.breakdownSection}>
            <div style={s.breakdownLabel}>BEAT STRUCTURE</div>
            {result.jlaw_beats?.concat(result.lala_beats || [])
              .sort((a, b) => result.script.indexOf(a.content) - result.script.indexOf(b.content))
              .map((beat, i) => (
                <div key={i} style={s.beatRow}>
                  <div style={{
                    ...s.beatChar,
                    color: beat.hasJLAW && beat.hasLala ? 'rgba(28,25,23,0.4)'
                      : beat.hasJLAW ? GOLD
                      : '#E879F9',
                  }}>
                    {beat.hasJLAW && beat.hasLala ? 'BOTH'
                      : beat.hasJLAW ? 'JLAW'
                      : 'LALA'}
                  </div>
                  <div style={s.beatTitle}>{beat.title}</div>
                  <div style={s.beatTagCount}>{beat.tags} tags</div>
                </div>
              ))
            }
          </div>

          <div style={s.breakdownSection}>
            <div style={s.breakdownLabel}>GENERATION CONTEXT</div>
            <MetaRow label='Book'    value={result.meta?.book_title} />
            <MetaRow label='Chapter' value={result.meta?.chapter_title} />
            <MetaRow label='Event'   value={result.meta?.event_name} />
            <MetaRow label='Arc'     value={result.meta?.episode_arc} />
            <MetaRow label='PNOS'    value={result.meta?.pnos_act} />
            <MetaRow label='JLAW arc' value={result.meta?.jlaw_arc} />
            <MetaRow label='Lala tone' value={result.meta?.lala_tone} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function PipelineTag({ color, label }) {
  return (
    <div style={{
      fontFamily:    'DM Mono, monospace',
      fontSize:      11,
      letterSpacing: '0.1em',
      color,
      background:    `${color}14`,
      border:        `1px solid ${color}30`,
      borderRadius:  4,
      padding:       '3px 8px',
    }}>
      {label}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily:    'DM Mono, monospace',
        fontSize:      11,
        letterSpacing: '0.14em',
        color:         'rgba(28,25,23,0.45)',
        marginBottom:  6,
      }}>
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function StatSlider({ label, value, max = 100, onChange, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'rgba(28,25,23,0.45)', letterSpacing: '0.1em' }}>
          {label.toUpperCase()}
        </span>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color }}>
          {value}
        </span>
      </div>
      <input
        type='range' min={0} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color }}
      />
    </div>
  );
}

function MetaRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid rgba(28,25,23,0.06)' }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.12em', color: 'rgba(28,25,23,0.4)', width: 72, flexShrink: 0 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'rgba(28,25,23,0.7)' }}>
        {value}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getLalaTonePreview(form) {
  const c = Number(form.lala_confidence);
  const coins = Number(form.lala_coins);
  if (c > 80)  return 'Bold, selective — "Bestie, of course they invited me."';
  if (c < 40)  return 'Determined, cautious — "Okay... I can do this."';
  if (coins < 200) return 'Strategic, measured — "We need to be smart."';
  return 'Aspirational, warm — "Main character energy. Let\'s go."';
}

// ── Styles ─────────────────────────────────────────────────────────────────

const GOLD_DIM = 'rgba(184,150,63,0.75)';

const s = {
  shell: {
    display:       'flex',
    flexDirection: 'column',
    padding:       '0 0 32px',
    position:      'relative',
  },
  header: {
    padding:      '16px 18px 12px',
    borderBottom: '1px solid rgba(201,168,76,0.15)',
  },
  headerTop: {
    display:       'flex',
    justifyContent: 'space-between',
    alignItems:    'center',
    marginBottom:  6,
  },
  headerLabel: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      12,
    letterSpacing: '0.22em',
    color:         GOLD,
  },
  headerPipeline: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
  },
  pipeArrow: {
    fontFamily: 'DM Mono, monospace',
    fontSize:   13,
    color:      'rgba(28,25,23,0.2)',
  },
  chapterRef: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      12,
    color:         'rgba(28,25,23,0.35)',
    fontStyle:     'italic',
    letterSpacing: '0.04em',
  },
  tabs: {
    display:      'flex',
    borderBottom: '1px solid rgba(28,25,23,0.08)',
  },
  tab: {
    flex:          1,
    background:    'none',
    border:        'none',
    borderBottom:  '2px solid transparent',
    fontFamily:    'DM Mono, monospace',
    fontSize:      12,
    letterSpacing: '0.1em',
    padding:       '11px 0',
    cursor:        'pointer',
    transition:    'color 0.12s',
  },
  form: {
    padding: '16px 18px',
    overflowY: 'auto',
  },
  input: {
    width:       '100%',
    background:  'rgba(28,25,23,0.03)',
    border:      '1px solid rgba(28,25,23,0.12)',
    borderRadius: 4,
    fontFamily:  'DM Mono, monospace',
    fontSize:    13,
    color:       'rgba(28,25,23,0.8)',
    padding:     '8px 10px',
    boxSizing:   'border-box',
    outline:     'none',
  },
  row: {
    display: 'flex',
    gap:     12,
  },
  divider: {
    display:      'flex',
    alignItems:   'center',
    gap:          10,
    margin:       '16px 0 12px',
    borderTop:    '1px solid rgba(28,25,23,0.08)',
    paddingTop:   14,
  },
  dividerLabel: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      11,
    letterSpacing: '0.18em',
    color:         'rgba(28,25,23,0.3)',
  },
  dividerSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize:   11,
    color:      'rgba(28,25,23,0.25)',
    letterSpacing: '0.04em',
  },
  statsGrid: {
    display:       'flex',
    flexDirection: 'column',
    gap:           0,
  },
  tonePreview: {
    background:   'rgba(201,168,76,0.06)',
    border:       '1px solid rgba(201,168,76,0.15)',
    borderRadius: 5,
    padding:      '10px 12px',
    marginBottom: 14,
  },
  toneLabel: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      11,
    letterSpacing: '0.14em',
    color:         GOLD_DIM,
    marginBottom:  5,
  },
  toneText: {
    fontFamily: "'Lora', serif",
    fontSize:   13,
    color:      'rgba(28,25,23,0.55)',
    fontStyle:  'italic',
    lineHeight: 1.6,
  },
  errorBox: {
    background:   'rgba(220,38,38,0.06)',
    border:       '1px solid rgba(220,38,38,0.2)',
    borderRadius: 4,
    padding:      '10px 12px',
    fontFamily:   'DM Mono, monospace',
    fontSize:     13,
    color:        '#DC2626',
    marginBottom: 12,
  },
  generateBtn: {
    width:         '100%',
    background:    'rgba(201,168,76,0.12)',
    border:        '1px solid rgba(201,168,76,0.35)',
    borderRadius:  5,
    fontFamily:    'DM Mono, monospace',
    fontSize:      13,
    letterSpacing: '0.12em',
    color:         '#96790F',
    padding:       '12px 0',
    display:       'flex',
    alignItems:    'center',
    justifyContent: 'center',
    gap:           8,
    cursor:        'pointer',
    transition:    'opacity 0.12s',
  },
  spinner: {
    display:   'inline-block',
    animation: 'spin 1s linear infinite',
  },
  note: {
    marginTop:  10,
    fontFamily: 'DM Mono, monospace',
    fontSize:   11,
    color:      'rgba(28,25,23,0.3)',
    letterSpacing: '0.04em',
    textAlign:  'center',
  },
  scriptPane: {
    display:       'flex',
    flexDirection: 'column',
    flex:          1,
    overflow:      'hidden',
  },
  scriptActions: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        '10px 18px',
    borderBottom:   '1px solid rgba(28,25,23,0.08)',
  },
  scriptMeta: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      12,
    color:         'rgba(28,25,23,0.4)',
    letterSpacing: '0.06em',
  },
  copyBtn: {
    background:    'none',
    border:        '1px solid rgba(201,168,76,0.25)',
    borderRadius:  4,
    fontFamily:    'DM Mono, monospace',
    fontSize:      12,
    letterSpacing: '0.08em',
    color:         GOLD_DIM,
    padding:       '5px 12px',
    cursor:        'pointer',
  },
  characterPipeline: {
    display:    'flex',
    gap:        14,
    padding:    '10px 18px',
    borderBottom: '1px solid rgba(28,25,23,0.06)',
  },
  pipelineItem: {
    display:    'flex',
    alignItems: 'center',
    gap:        8,
  },
  pipelineDot: {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
  },
  pipelineCharName: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      12,
    fontWeight:    600,
    letterSpacing: '0.04em',
  },
  pipelineSource: {
    fontFamily: 'DM Mono, monospace',
    fontSize:   11,
    color:      'rgba(28,25,23,0.35)',
    letterSpacing: '0.04em',
  },
  scriptText: {
    fontFamily: 'DM Mono, monospace',
    fontSize:   13,
    color:      'rgba(28,25,23,0.75)',
    lineHeight: 1.7,
    padding:    '14px 18px',
    overflowY:  'auto',
    whiteSpace: 'pre-wrap',
    flex:       1,
    margin:     0,
  },
  regenerateBtn: {
    margin:        '10px 18px',
    background:    'none',
    border:        '1px solid rgba(28,25,23,0.12)',
    borderRadius:  4,
    fontFamily:    'DM Mono, monospace',
    fontSize:      12,
    letterSpacing: '0.08em',
    color:         'rgba(28,25,23,0.4)',
    padding:       '9px 0',
    cursor:        'pointer',
    width:         'calc(100% - 36px)',
  },
  breakdown: {
    padding:   '14px 18px',
    overflowY: 'auto',
  },
  breakdownSection: {
    marginBottom: 22,
  },
  breakdownLabel: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      11,
    letterSpacing: '0.18em',
    color:         'rgba(28,25,23,0.3)',
    marginBottom:  10,
  },
  sourceLine: {
    display:      'flex',
    gap:          10,
    padding:      '7px 0',
    borderBottom: '1px solid rgba(28,25,23,0.06)',
  },
  sourceLineNum: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      12,
    color:         GOLD_DIM,
    flexShrink:    0,
    width:         20,
  },
  sourceLineText: {
    fontFamily: "'Lora', serif",
    fontSize:   14,
    fontStyle:  'italic',
    color:      'rgba(28,25,23,0.6)',
    lineHeight: 1.5,
  },
  beatRow: {
    display:      'flex',
    alignItems:   'center',
    gap:          10,
    padding:      '6px 0',
    borderBottom: '1px solid rgba(28,25,23,0.06)',
  },
  beatChar: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      11,
    letterSpacing: '0.08em',
    flexShrink:    0,
    width:         36,
  },
  beatTitle: {
    fontFamily: 'DM Mono, monospace',
    fontSize:   13,
    color:      'rgba(28,25,23,0.65)',
    flex:       1,
  },
  beatTagCount: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      11,
    color:         'rgba(28,25,23,0.3)',
    letterSpacing: '0.06em',
  },
};
