/**
 * The editor's right panel (plan §3.6): Clip, Audio and Effects for the
 * selected block, or the beat card for the beat at the playhead. P1 shows
 * the stored values read only; changing them arrives in P3. Controls with no
 * place in the edit model are shown disabled with the reason.
 */
import React, { useState } from 'react';
import { Gamepad2, Lock } from 'lucide-react';
import { timecode, beatLabel, findingText } from '../../lib/editorModel';

const TABS = [['clip', 'Clip'], ['audio', 'Audio'], ['effects', 'Effects']];

function Field({ label, value, note }) {
  return (
    <div className="tle-field">
      <span className="tle-field-label">{label}</span>
      <input className="tle-input" value={value ?? '—'} readOnly aria-readonly="true" aria-label={label} title={note || 'Editing arrives in P3'} />
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

function ClipTab({ block }) {
  const row = block.row || {};
  const sourceIn = row.source_in_ms ?? row.audio_in_ms;
  const sourceOut = row.source_out_ms ?? row.audio_out_ms;
  return (
    <>
      <Field label="Start time" value={timecode(block.start)} />
      <Field label="End time" value={timecode(block.end)} />
      <Field label="Duration" value={timecode(block.end - block.start)} />
      {sourceIn != null && <Field label="Source in" value={timecode(sourceIn)} />}
      {sourceOut != null && <Field label="Source out" value={timecode(sourceOut)} />}
      {block.kind === 'segment' && (
        <>
          <h4 className="tle-insp-h">Transform</h4>
          <Field label="Position X" value={row.layout ? row.layout.x : 'default'} note="Pixels at 1920×1080. Moving it in the preview arrives in P3" />
          <Field label="Position Y" value={row.layout ? row.layout.y : 'default'} />
          <Field label="Width" value={row.layout ? row.layout.w : 'default'} />
          <Field label="Height" value={row.layout ? row.layout.h : 'default'} />
          <Pending label="Rotation" value="0°" reason="Deferred (D5)" />
          <Pending label="Opacity" value="100%" reason="Gate 2 (D5)" />
          <Field label="Anchor" value={`${row.anchor_kind}${row.anchor_beat ? ` ${row.anchor_beat}` : ''} + ${row.offset_ms || 0} ms`} />
          <Field label="Status" value={row.status} />
        </>
      )}
      {block.kind === 'scene_clip' && (
        <>
          <Field label="Beat" value={`${row.beat_number}: ${beatLabel(row.beat_number)}`} />
          <Field label="Source" value={row.source_kind === 'angle_still' ? 'Angle still' : row.source_kind === 'angle_video' ? 'Angle video' : 'Raw clip'} />
          {block.cut_ms > 0 && <p className="tle-insp-warn">Cut by {ms(block.cut_ms)} at the beat's locked end.</p>}
        </>
      )}
      {block.kind === 'dialogue' && block.problem && <p className="tle-insp-warn">This take will not play: {block.problem.replace(/_/g, ' ')}.</p>}
      <Pending label="Speed" value="1.0×" reason="Not supported: one clock (R8.4)" />
    </>
  );
}

function AudioTab({ block }) {
  const row = block.row || {};
  if (block.kind === 'segment' || block.kind === 'commentary') {
    return (
      <>
        <Field label="Gain" value={db(row.audio_gain_db)} />
        <Field label="Muted in the episode" value={row.audio_muted ? 'Yes' : 'No'} note="Saved: a muted commentary is not in the render" />
        <Field label="Fade in" value={ms(row.audio_fade_in_ms)} />
        <Field label="Fade out" value={ms(row.audio_fade_out_ms)} />
      </>
    );
  }
  if (block.kind === 'audio_item') {
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

function BeatCard({ beat, readiness }) {
  if (!beat) return <p className="tle-insp-note">No beat at the playhead.</p>;
  const r = readiness || { findings: [] };
  return (
    <div className="tle-beatcard" data-testid="beat-card">
      <h3 className="tle-beatcard-title">Beat {beat.beat}: {beat.name}</h3>
      <dl className="tle-dl">
        <dt>Prime</dt><dd>{beat.prime_mode === 'gameplay_only' ? 'Not needed (gameplay only)' : 'Required'}</dd>
        <dt>Visual mode</dt><dd><Gamepad2 size={14} aria-hidden="true" /> Gameplay <span className="tle-muted">(the default; modes arrive with Gate 2)</span></dd>
        <dt>Length</dt><dd>{timecode(beat.end - beat.start)} {beat.locked ? <span className="tle-locked"><Lock size={12} aria-hidden="true" /> locked</span> : <span className="tle-muted">draft timing</span>}</dd>
        <dt>Starts</dt><dd>{timecode(beat.start)}</dd>
      </dl>
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
      <p className="tle-insp-note">Approving a beat arrives with Gate 2.</p>
    </div>
  );
}

export default function EditorInspector({ block, beat, readiness }) {
  const [tab, setTab] = useState('clip');
  return (
    <section className="tle-panel tle-inspector" aria-label="Inspector">
      <div className="tle-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tle-tab${tab === k ? ' is-active' : ''}`} onClick={() => setTab(k)} disabled={!block} aria-disabled={!block}>{label}</button>
        ))}
      </div>
      <div className="tle-insp-body">
        {!block && <BeatCard beat={beat} readiness={readiness} />}
        {block && (
          <>
            <div className="tle-insp-head">
              {block.image ? <img src={block.image} alt="" /> : <span className="tle-insp-thumb" aria-hidden="true" />}
              <div>
                <div className="tle-insp-name">{block.label}</div>
                <div className="tle-muted">{timecode(block.end - block.start)}</div>
              </div>
            </div>
            {tab === 'clip' && <ClipTab block={block} />}
            {tab === 'audio' && <AudioTab block={block} />}
            {tab === 'effects' && (
              <>
                <Pending label="Transition" value="Cut" reason="Placing transitions arrives in P3" />
                <p className="tle-insp-note">Effects beyond cut, crossfade and dip to black are not planned (ruling 12).</p>
              </>
            )}
            <p className="tle-insp-note">Read only: editing arrives in P3.</p>
          </>
        )}
      </div>
    </section>
  );
}
