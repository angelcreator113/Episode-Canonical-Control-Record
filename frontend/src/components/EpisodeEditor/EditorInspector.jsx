/**
 * The editor's right panel (plan §3.6): Clip, Audio and Effects for the
 * selected block, or the beat card for the beat at the playhead.
 *
 * Editing (P3): a field the edit model stores is changed here and saved when
 * the field is left or Enter is pressed (one change, one undo step). Values
 * are the stored ones: milliseconds on the edit clock or in the source,
 * pixels at 1920×1080, decibels. A take's trim and level live on its Voice
 * Studio revision. Controls with no place in the edit model are shown
 * disabled with the reason.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Gamepad2, Lock } from 'lucide-react';
import { timecode, beatLabel, findingText } from '../../lib/editorModel';

const TABS = [['clip', 'Clip'], ['audio', 'Audio'], ['effects', 'Effects']];

function Field({ label, value, note }) {
  return (
    <div className="tle-field">
      <span className="tle-field-label">{label}</span>
      <input className="tle-input" value={value ?? '—'} readOnly aria-readonly="true" aria-label={label} title={note || 'Read only'} />
    </div>
  );
}

/** A stored number, saved on blur or Enter; Escape puts the stored value back. */
function NumberField({ label, value, unit, min, max, step = 1, onCommit, disabled, note }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  // What this field last saved: Enter then leaving the field saves once, not twice.
  const sent = useRef(null);
  useEffect(() => { setText(value == null ? '' : String(value)); sent.current = null; }, [value]);
  const commit = () => {
    if (text === (value == null ? '' : String(value)) || text === sent.current) return;
    const n = Number(text);
    if (text.trim() === '' || !Number.isFinite(n) || (min != null && n < min) || (max != null && n > max)) {
      setText(value == null ? '' : String(value));
      return;
    }
    sent.current = text;
    onCommit(n);
  };
  const id = `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="tle-field">
      <label className="tle-field-label" htmlFor={id}>{label}{unit ? <span className="tle-muted"> ({unit})</span> : null}</label>
      <input id={id} className="tle-input" type="number" inputMode="decimal" value={text} min={min} max={max} step={step} disabled={disabled}
        aria-label={label} title={note}
        onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') setText(value == null ? '' : String(value));
        }} />
    </div>
  );
}

function Pending({ label, value, reason }) {
  return (
    <div className="tle-field is-pending">
      <span className="tle-field-label">{label}</span>
      <input className="tle-input" value={value} disabled aria-disabled="true" aria-label={`${label} (${reason})`} title={reason} />
      <span className="tle-field-why">{reason}</span>
    </div>
  );
}

const db = (v) => (v == null ? '—' : `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(1)} dB`);
const ms = (v) => (v == null ? '—' : `${v} ms`);

function ClipTab({ block, layout, editable, act }) {
  const row = block.row || {};
  const can = editable && !block.locked;
  return (
    <>
      {block.kind === 'segment' && can
        ? <NumberField label="Start" unit="ms" value={Math.round(block.start)} step={33} onCommit={(v) => act.move(block, v)} note="Where it starts on the edit clock" />
        : <Field label="Start time" value={timecode(block.start)} />}
      {(block.kind === 'dialogue' || block.kind === 'audio_item') && can && <NumberField label="Start" unit="ms" value={Math.round(block.start)} step={33} onCommit={(v) => act.move(block, v)} />}
      <Field label="End time" value={timecode(block.end)} />
      <Field label="Duration" value={timecode(block.end - block.start)} />

      {block.kind === 'scene_clip' && (
        <>
          {can ? <NumberField label="Length" unit="ms" value={row.duration_ms} min={33} step={33} onCommit={(v) => act.updateScene(block, { duration_ms: Math.round(v) })} />
            : <Field label="Length" value={ms(row.duration_ms)} />}
          {row.source_kind !== 'angle_still' && (can ? (
            <>
              <NumberField label="Source in" unit="ms" value={row.source_in_ms} min={0} onCommit={(v) => act.updateScene(block, { source_in_ms: Math.round(v) })} />
              <NumberField label="Source out" unit="ms" value={row.source_out_ms} min={1} onCommit={(v) => act.updateScene(block, { source_out_ms: Math.round(v) })} />
            </>
          ) : (
            <>
              <Field label="Source in" value={ms(row.source_in_ms)} />
              <Field label="Source out" value={ms(row.source_out_ms)} />
            </>
          ))}
          <Field label="Beat" value={`${row.beat_number}: ${beatLabel(row.beat_number)}`} />
          {can && (
            <div className="tle-row tle-insp-actions">
              <button type="button" className="tle-btn tle-btn-small" onClick={() => act.reorderScene(block, -1)}>Earlier in the beat</button>
              <button type="button" className="tle-btn tle-btn-small" onClick={() => act.reorderScene(block, 1)}>Later in the beat</button>
            </div>
          )}
          <Field label="Source" value={row.source_kind === 'angle_still' ? 'Angle still' : row.source_kind === 'angle_video' ? 'Angle video' : 'Raw clip'} />
          {block.cut_ms > 0 && <p className="tle-insp-warn">Cut by {ms(block.cut_ms)} at the beat's locked end.</p>}
        </>
      )}

      {block.kind === 'segment' && (
        <>
          {can ? (
            <>
              <NumberField label="Source in" unit="ms" value={row.source_in_ms} min={0} onCommit={(v) => act.trimSegment(block, { source_in_ms: Math.round(v) })} />
              <NumberField label="Source out" unit="ms" value={row.source_out_ms} min={1} onCommit={(v) => act.trimSegment(block, { source_out_ms: Math.round(v) })} />
            </>
          ) : (
            <>
              <Field label="Source in" value={ms(row.source_in_ms)} />
              <Field label="Source out" value={ms(row.source_out_ms)} />
            </>
          )}
          <h4 className="tle-insp-h">Transform <span className="tle-muted">(px at 1920×1080)</span></h4>
          {['x', 'y', 'w', 'h'].map((k) => {
            const name = { x: 'Position X', y: 'Position Y', w: 'Width', h: 'Height' }[k];
            return can
              ? <NumberField key={k} label={name} value={layout ? layout[k] : null} min={k === 'w' || k === 'h' ? 1 : -1920} max={3840}
                  onCommit={(v) => act.layout(block, { ...layout, [k]: Math.round(v) })} note="Also drag Prime in the preview" />
              : <Field key={k} label={name} value={layout ? layout[k] : 'default'} />;
          })}
          {can && row.layout && <button type="button" className="tle-btn tle-btn-small" onClick={() => act.layout(block, null)}>Use the episode's default place</button>}
          <Pending label="Rotation" value="0°" reason="Deferred (D5)" />
          <Pending label="Opacity" value="100%" reason="Gate 2 (D5)" />
          <Field label="Anchor" value={`${row.anchor_kind}${row.anchor_beat ? ` ${row.anchor_beat}` : ''} + ${row.offset_ms || 0} ms`} />
          <Field label="Status" value={row.status} />
        </>
      )}
      {block.kind === 'dialogue' && block.problem && <p className="tle-insp-warn">This take will not play: {block.problem.replace(/_/g, ' ')}.</p>}
      {block.kind === 'audio_item' && (can ? (
        <>
          <NumberField label="Source in" unit="ms" value={row.source_in_ms} min={0} onCommit={(v) => act.audioItem(block, { source_in_ms: Math.round(v) })} />
          <NumberField label="Source out" unit="ms" value={row.source_out_ms} min={1} onCommit={(v) => act.audioItem(block, { source_out_ms: Math.round(v) })} />
        </>
      ) : (
        <>
          <Field label="Source in" value={ms(row.source_in_ms)} />
          <Field label="Source out" value={ms(row.source_out_ms)} />
        </>
      ))}
      <Pending label="Speed" value="1.0×" reason="Not supported: one clock (R8.4)" />
    </>
  );
}

function AudioTab({ block, editable, act }) {
  const row = block.row || {};
  const can = editable && !block.locked;
  if (block.kind === 'segment' || block.kind === 'commentary') {
    if (row.audio_in_ms == null) return <p className="tle-insp-note">This part of the take has no commentary.</p>;
    return can ? (
      <>
        <NumberField label="Gain" unit="dB" value={row.audio_gain_db} min={-24} max={12} step={0.1} onCommit={(v) => act.segmentAudio(block, { audio_gain_db: Math.round(v * 10) / 10 })} />
        <div className="tle-field">
          <label className="tle-field-label" htmlFor="f-muted">Muted in the episode</label>
          <input id="f-muted" type="checkbox" checked={Boolean(row.audio_muted)} onChange={(e) => act.segmentAudio(block, { audio_muted: e.target.checked })}
            title="Saved: a muted commentary is not in the render. Hiding Prime never mutes her." />
        </div>
        <NumberField label="Fade in" unit="ms" value={row.audio_fade_in_ms} min={0} max={2000} onCommit={(v) => act.segmentAudio(block, { audio_fade_in_ms: Math.round(v) })} />
        <NumberField label="Fade out" unit="ms" value={row.audio_fade_out_ms} min={0} max={2000} onCommit={(v) => act.segmentAudio(block, { audio_fade_out_ms: Math.round(v) })} />
      </>
    ) : (
      <>
        <Field label="Gain" value={db(row.audio_gain_db)} />
        <Field label="Muted in the episode" value={row.audio_muted ? 'Yes' : 'No'} note="Saved: a muted commentary is not in the render" />
        <Field label="Fade in" value={ms(row.audio_fade_in_ms)} />
        <Field label="Fade out" value={ms(row.audio_fade_out_ms)} />
      </>
    );
  }
  if (block.kind === 'audio_item') {
    if (can) {
      return (
        <>
          <NumberField label="Gain" unit="dB" value={row.gain_db} min={-24} max={12} step={0.1} onCommit={(v) => act.audioItem(block, { gain_db: Math.round(v * 10) / 10 })} />
          <NumberField label="Fade in" unit="ms" value={row.fade_in_ms} min={0} max={2000} onCommit={(v) => act.audioItem(block, { fade_in_ms: Math.round(v) })} />
          <NumberField label="Fade out" unit="ms" value={row.fade_out_ms} min={0} max={2000} onCommit={(v) => act.audioItem(block, { fade_out_ms: Math.round(v) })} />
          <NumberField label="Duck under dialogue" unit="dB" value={row.duck_under_dialogue_db} min={-24} max={0} step={0.5}
            onCommit={(v) => act.audioItem(block, { duck_under_dialogue_db: v })} note="How far it dips while a line plays (−24 to 0 dB)" />
          {row.duck_under_dialogue_db != null && <button type="button" className="tle-btn tle-btn-small" onClick={() => act.audioItem(block, { duck_under_dialogue_db: null })}>No ducking</button>}
        </>
      );
    }
    return (
      <>
        <Field label="Gain" value={db(row.gain_db)} />
        <Field label="Fade in" value={ms(row.fade_in_ms)} />
        <Field label="Fade out" value={ms(row.fade_out_ms)} />
        <Field label="Duck under dialogue" value={row.duck_under_dialogue_db == null ? 'Off' : db(row.duck_under_dialogue_db)} />
      </>
    );
  }
  if (block.kind === 'dialogue') {
    const take = block.take || {};
    return (
      <>
        <Field label="Gain" value={db(take.gain_db)} note="Set on the take in Voice Studio" />
        <Field label="Trim in" value={ms(take.in_ms)} note="Set on the take in Voice Studio" />
        <Field label="Trim out" value={ms(take.out_ms)} note="Set on the take in Voice Studio" />
        <p className="tle-insp-note">A take's trim and level live on its Voice Studio revision, not on the timeline.</p>
      </>
    );
  }
  return <p className="tle-insp-note">This clip has no sound of its own.</p>;
}

function BeatCard({ beat, readiness, editable, act, beatPlan, pipHidden }) {
  const [length, setLength] = useState('');
  useEffect(() => { setLength(beat ? String(beat.end - beat.start) : ''); }, [beat?.beat, beat?.start, beat?.end]);
  if (!beat) return <p className="tle-insp-note">No beat at the playhead.</p>;
  const r = readiness || { findings: [] };
  const plan = beatPlan && beatPlan.beat === beat.beat ? beatPlan : null;
  return (
    <div className="tle-beatcard" data-testid="beat-card">
      <h3 className="tle-beatcard-title">Beat {beat.beat}: {beat.name}</h3>
      <dl className="tle-dl">
        <dt>Prime</dt>
        <dd>
          {editable ? (
            <select className="tle-input tle-select" aria-label={`Prime in beat ${beat.beat}`} value={beat.prime_mode}
              onChange={(e) => act.beatMode(beat, e.target.value)}>
              <option value="required">Required</option>
              <option value="gameplay_only">Not needed (gameplay only)</option>
            </select>
          ) : (beat.prime_mode === 'gameplay_only' ? 'Not needed (gameplay only)' : 'Required')}
        </dd>
        <dt>Prime shown</dt>
        <dd>
          {pipHidden ? 'Hidden in this beat' : 'As the episode sets it'}
          {editable && (pipHidden
            ? <button type="button" className="tle-btn tle-btn-small" onClick={() => act.showPip(beat, pipHidden)}>Show Prime again</button>
            : <button type="button" className="tle-btn tle-btn-small" onClick={() => act.hidePip(beat)} title="Hides her picture; her commentary still plays">Hide Prime in this beat</button>)}
        </dd>
        <dt>Visual mode</dt><dd><Gamepad2 size={14} aria-hidden="true" /> Gameplay <span className="tle-muted">(the default; modes arrive with Gate 2)</span></dd>
        <dt>Length</dt><dd>{timecode(beat.end - beat.start)} {beat.locked ? <span className="tle-locked"><Lock size={12} aria-hidden="true" /> locked</span> : <span className="tle-muted">draft timing</span>}</dd>
        <dt>Starts</dt><dd>{timecode(beat.start)}</dd>
      </dl>
      {editable && (
        <div className="tle-beat-length">
          <label className="tle-field-label" htmlFor="f-beat-length">Set its length <span className="tle-muted">(ms)</span></label>
          <div className="tle-row">
            <input id="f-beat-length" className="tle-input" type="number" min="33" step="33" value={length} onChange={(e) => setLength(e.target.value)} />
            <button type="button" className="tle-btn tle-btn-small" onClick={() => act.planBeatLength(beat, Number(length))} disabled={!(Number(length) > 0)}>Preview the change</button>
          </div>
          {plan && (
            <div className="tle-plan" role="status" data-testid="beat-plan">
              <p>{timecode(plan.from.ms)} → {timecode(plan.to.ms)}. {plan.changes.length} {plan.changes.length === 1 ? 'thing moves' : 'things move'}; the edit becomes {timecode(plan.duration_ms.to)}.
                {plan.findings_added.length ? ` Adds ${plan.findings_added.length} ${plan.findings_added.length === 1 ? 'finding' : 'findings'}.` : ''}
                {plan.findings_cleared.length ? ` Clears ${plan.findings_cleared.length}.` : ''}</p>
              <button type="button" className="tle-btn tle-btn-small tle-btn-primary" onClick={() => act.applyBeatLength(beat, plan)}>Apply</button>
              <button type="button" className="tle-btn tle-btn-small" onClick={() => act.clearPlan()}>Cancel</button>
            </div>
          )}
          {beat.locked && <button type="button" className="tle-btn tle-btn-small" onClick={() => act.unlockBeat(beat)}>Back to draft timing</button>}
        </div>
      )}
      <h4 className="tle-insp-h">Findings</h4>
      {!r.findings.length ? <p className="tle-insp-note">None for this beat.</p> : (
        <ul className="tle-findings">
          {r.findings.map((f, i) => (
            <li key={`${f.code}-${f.ref || ''}-${i}`} className={`tle-finding is-${f.severity}`}>
              <span className="tle-finding-sev">{f.severity === 'blocking' ? 'Blocking' : 'Warning'}</span> {findingText(f)}
            </li>
          ))}
        </ul>
      )}
      {editable && <button type="button" className="tle-btn tle-btn-small" onClick={() => act.lockTiming()} title="Stores every beat's length now, so later clip changes never move the clock">Lock timing for all 14 beats</button>}
      <p className="tle-insp-note">Approving a beat arrives with Gate 2.</p>
    </div>
  );
}

export default function EditorInspector({ block, beat, readiness, editable = false, act = {}, liveLayout, beatPlan, pipHidden }) {
  const [tab, setTab] = useState('clip');
  const layout = block?.kind === 'segment'
    ? (liveLayout && liveLayout.segmentId === block.id ? liveLayout.layout : (block.row?.layout || block.layout || null))
    : null;
  return (
    <section className="tle-panel tle-inspector" aria-label="Inspector">
      <div className="tle-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tle-tab${tab === k ? ' is-active' : ''}`} onClick={() => setTab(k)} disabled={!block} aria-disabled={!block}>{label}</button>
        ))}
      </div>
      <div className="tle-insp-body">
        {!block && <BeatCard beat={beat} readiness={readiness} editable={editable} act={act} beatPlan={beatPlan} pipHidden={pipHidden} />}
        {block && (
          <>
            <div className="tle-insp-head">
              {block.image ? <img src={block.image} alt="" /> : <span className="tle-insp-thumb" aria-hidden="true" />}
              <div>
                <div className="tle-insp-name">{block.label}</div>
                <div className="tle-muted">{timecode(block.end - block.start)}</div>
              </div>
            </div>
            {tab === 'clip' && <ClipTab block={block} layout={layout} editable={editable} act={act} />}
            {tab === 'audio' && <AudioTab block={block} editable={editable} act={act} />}
            {tab === 'effects' && (
              <>
                <Pending label="Transition" value="Cut" reason="Transitions wait for Gate 2, when the preview and render draw them" />
                <p className="tle-insp-note">Effects beyond cut, crossfade and dip to black are not planned (ruling 12).</p>
              </>
            )}
            {block.locked && <p className="tle-insp-note">This lane is locked in this browser. Unlock it in its track header to edit.</p>}
            {!editable && <p className="tle-insp-note">Read only.</p>}
          </>
        )}
      </div>
    </section>
  );
}
