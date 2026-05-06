// frontend/src/components/Episodes/EpisodeScriptTab.jsx
// Beat-by-beat script reviewer with Show Brain AI rewrite

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import api from '../../services/api';

// Track 6 CP15 partial-migration extension (5th instance) — file already
// has 5 pre-existing api.* sites (lines 152, 161, 177, 191, 194). Add
// helpers for the 2 remaining raw fetch sites (world locations + world map).
// listLocationsApi is a CP8/CP11 cross-CP duplicate, reaches 3-fold.
export const listLocationsApi = () =>
  api.get('/api/v1/world/locations').then((r) => r.data);
export const getWorldMapApi = () =>
  api.get('/api/v1/world/map').then((r) => r.data);

const DreamMap = lazy(() => import('../DreamMap'));

const BEAT_NAMES = [
  { number: 1,  name: 'Opening Ritual',        icon: '🎬', color: '#5C3D8F' },
  { number: 2,  name: 'Login Sequence',         icon: '🔐', color: '#5C3D8F' },
  { number: 3,  name: 'Welcome',                icon: '👋', color: '#5C3D8F' },
  { number: 4,  name: 'Interruption Pulse 1',   icon: '📩', color: '#B8960C' },
  { number: 5,  name: 'Reveal',                 icon: '✨', color: '#B8960C' },
  { number: 6,  name: 'Strategic Reaction',     icon: '🎯', color: '#B8960C' },
  { number: 7,  name: 'Interruption Pulse 2',   icon: '💬', color: '#B8960C' },
  { number: 8,  name: 'Transformation Loop',    icon: '👗', color: '#C2185B' },
  { number: 9,  name: 'Reminder / Deadline',    icon: '⏰', color: '#C2185B' },
  { number: 10, name: 'Event Travel',           icon: '✈️', color: '#1A5276' },
  { number: 11, name: 'Event Outcome',          icon: '🏆', color: '#1A5276' },
  { number: 12, name: 'Deliverable Creation',   icon: '🎨', color: '#1A5276' },
  { number: 13, name: 'Recap Panel',            icon: '📊', color: '#145A32' },
  { number: 14, name: 'Cliffhanger',            icon: '🔥', color: '#145A32' },
];

function parseScriptIntoBeats(scriptText) {
  if (!scriptText?.trim()) return [];
  if (/##\s*BEAT:/i.test(scriptText)) {
    const sections = scriptText.split(/(?=##\s*BEAT:)/i);
    return sections.filter(s => s.trim()).map((section, i) => {
      const lines = section.split('\n').filter(l => l.trim());
      const header = lines[0] || '';
      const beatMatch = header.match(/##\s*BEAT:\s*(.+)/i);
      const beatLabel = beatMatch?.[1]?.trim() || `Beat ${i + 1}`;
      const info = BEAT_NAMES[i] || { number: i + 1, name: beatLabel, icon: '📌', color: '#888' };
      return { id: `beat-${i}`, number: i + 1, name: info.name, icon: info.icon, color: info.color, rawLabel: beatLabel, lines: lines.slice(1).filter(l => l.trim()), approved: false, raw: section };
    });
  }
  const lines = scriptText.split('\n').filter(l => l.trim());
  const per = Math.max(1, Math.ceil(lines.length / 14));
  return BEAT_NAMES.map((b, i) => {
    const bl = lines.slice(i * per, (i + 1) * per);
    return { id: `beat-${i}`, ...b, rawLabel: b.name, lines: bl, approved: false, raw: bl.join('\n') };
  }).filter(b => b.lines.length > 0);
}

function parseLine(line) {
  const t = (typeof line === 'string' ? line : '').trim();
  if (!t) return null;
  if (/^\[UI:|^\[STAT:|^\[MAIL:/i.test(t)) return { type: 'ui', text: t, hidden: true };
  if (/^\(.*\)$/.test(t)) return { type: 'action', text: t };
  const m = t.match(/^(Me|Prime|Lala|Kelli|Guest|[A-Z][a-z]+):\s*(.+)/);
  if (m) return { type: 'dialogue', speaker: m[1] === 'Me' ? 'Prime' : m[1], text: m[2].replace(/^[""]|[""]$/g, '') };
  return { type: 'narration', text: t };
}

function ScriptLine({ line, beatId, lineIndex, onEdit, onRewrite, rewriting }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const lineStr = typeof line === 'string' ? line : '';
  const parsed = parseLine(lineStr);
  if (!parsed || parsed.hidden) return null;
  const sc = { Prime: '#5C3D8F', Lala: '#C2185B', Kelli: '#1A5276', Guest: '#145A32' };

  if (editing) return (
    <div style={{ padding: '6px 0' }}>
      <textarea value={editText} onChange={e => setEditText(e.target.value)} autoFocus rows={3} style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #5C3D8F', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button onClick={() => { onEdit(beatId, lineIndex, editText); setEditing(false); }} style={{ background: '#5C3D8F', color: '#FFF', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
        <button onClick={() => setEditing(false)} style={{ background: '#F5F5F5', color: '#888', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="script-line-hover" style={{ padding: '5px 8px', borderRadius: 6, cursor: 'pointer' }} onClick={() => { setEditText(lineStr); setEditing(true); }}>
      {parsed.type === 'dialogue' && (
        <div>
          <span style={{ fontWeight: 700, fontSize: 12, color: sc[parsed.speaker] || '#333', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 8 }}>{parsed.speaker}</span>
          <span style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.7 }}>"{parsed.text}"</span>
          <button onClick={e => { e.stopPropagation(); onRewrite(beatId, lineIndex, lineStr); }} disabled={rewriting} className="rewrite-btn" style={{ marginLeft: 8, opacity: 0, background: 'none', border: 'none', fontSize: 10, color: '#5C3D8F', cursor: 'pointer', fontWeight: 600 }}>{rewriting ? '⏳' : '✦ Rewrite'}</button>
        </div>
      )}
      {parsed.type === 'action' && <div style={{ fontSize: 13, color: '#888', fontStyle: 'italic' }}>{parsed.text}</div>}
      {parsed.type === 'narration' && <div style={{ fontSize: 14, color: '#444', lineHeight: 1.7 }}>{parsed.text}</div>}
    </div>
  );
}

function BeatSection({ beat, scenePlan, expanded, onToggle, onApprove, onEdit, onRewrite, rewritingLine }) {
  const scene = scenePlan?.find(p => p.beat_number === beat.number);
  return (
    <div style={{ background: '#FFF', border: `1px solid ${beat.approved ? '#D4AF37' : '#EEE'}`, borderLeft: `4px solid ${beat.color}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden', boxShadow: beat.approved ? '0 2px 8px rgba(212,175,55,0.15)' : '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer', background: beat.approved ? '#FFFDF0' : '#FFF' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: beat.color + '18', color: beat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{beat.number}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>{beat.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{beat.name}</span>
            {beat.approved && <span style={{ background: '#D4AF37', color: '#FFF', padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700 }}>✓ APPROVED</span>}
          </div>
          {scene?.scene_set_name && <div onClick={(e) => { e.stopPropagation(); setShowMap(true); }} style={{ fontSize: 11, color: '#7ab3d4', marginTop: 2, cursor: 'pointer' }} title="Open DREAM Map">📍 {scene.scene_set_name}{scene?.angle_label ? ` · ${scene.angle_label}` : ''}</div>}
        </div>
        <span style={{ fontSize: 12, color: '#AAA' }}>{beat.lines.filter(l => { const p = parseLine(l); return p && !p.hidden; }).length} lines</span>
        <span style={{ fontSize: 12, color: '#CCC', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </div>
      {expanded && (
        <div style={{ padding: '4px 18px 16px' }}>
          {scene?.scene_context && <div style={{ background: '#F5F0FF', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#5C3D8F', lineHeight: 1.5, fontStyle: 'italic' }}>🎬 {scene.scene_context.slice(0, 200)}{scene.scene_context.length > 200 ? '...' : ''}</div>}
          {scene?.emotional_intent && <div style={{ background: '#FFF8E1', borderRadius: 8, padding: '6px 12px', marginBottom: 12, fontSize: 11, color: '#B8960C' }}>✦ {scene.emotional_intent}</div>}
          <div>{beat.lines.map((line, i) => <ScriptLine key={i} line={line} beatId={beat.id} lineIndex={i} onEdit={onEdit} onRewrite={onRewrite} rewriting={rewritingLine === `${beat.id}-${i}`} />)}</div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={e => { e.stopPropagation(); onApprove(beat.id); }} style={{ background: beat.approved ? '#FFF8E1' : 'linear-gradient(135deg, #2D1B69, #5C3D8F)', color: beat.approved ? '#B8960C' : '#FFF', border: beat.approved ? '1px solid #D4AF37' : 'none', borderRadius: 8, padding: '7px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{beat.approved ? '🔒 Approved' : '✓ Approve Beat'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EpisodeScriptTab({ episode, show }) {
  const episodeId = episode?.id;
  const showId = show?.id || episode?.show_id;
  const [scriptText, setScriptText] = useState(episode?.script_content || '');
  const [beats, setBeats] = useState([]);
  const [expandedBeat, setExpandedBeat] = useState('beat-0');
  const [scenePlan, setScenePlan] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rewritingLine, setRewritingLine] = useState(null);
  const [developerMode, setDeveloperMode] = useState(false);
  const [devScript, setDevScript] = useState('');
  const [toast, setToast] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [mapLocations, setMapLocations] = useState([]);
  const [mapImageUrl, setMapImageUrl] = useState(null);

  // Load map data when map is opened
  useEffect(() => {
    if (!showMap) return;
    listLocationsApi().then(d => setMapLocations(d.locations || [])).catch(() => {});
    getWorldMapApi().then(d => { if (d.url) setMapImageUrl(d.url); }).catch(() => {});
  }, [showMap]);

  useEffect(() => {
    if (!episodeId) return;
    const script = episode?.script_content || '';
    setScriptText(script); setDevScript(script);
    if (script) setBeats(parseScriptIntoBeats(script));
    api.get(`/api/v1/episode-brief/${episodeId}/plan`).then(res => {
      setScenePlan((res.data?.data || []).map(p => ({ ...p, scene_set_name: p.sceneSet?.name || null, scene_context: p.scene_context || p.sceneSet?.script_context || null })));
    }).catch(() => {});
  }, [episodeId]);

  useEffect(() => { if (scriptText) setBeats(parseScriptIntoBeats(scriptText)); }, [scriptText]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try { await api.put(`/api/v1/episodes/${episodeId}`, { script_content: scriptText }); setSaved(true); setTimeout(() => setSaved(false), 3000); }
    catch { setToast({ msg: 'Save failed', type: 'error' }); setTimeout(() => setToast(null), 3000); }
    finally { setSaving(false); }
  }, [episodeId, scriptText]);

  const handleEditLine = (beatId, lineIndex, newText) => {
    const nb = beats.map(b => { if (b.id !== beatId) return b; const nl = [...b.lines]; nl[lineIndex] = newText; return { ...b, lines: nl }; });
    setBeats(nb);
    setScriptText(nb.map(b => `## BEAT: ${b.rawLabel}\n${b.lines.join('\n')}`).join('\n\n'));
  };

  const handleRewriteLine = async (beatId, lineIndex, originalLine) => {
    setRewritingLine(`${beatId}-${lineIndex}`);
    try {
      const beat = beats.find(b => b.id === beatId);
      const parsed = parseLine(originalLine);
      const res = await api.post(`/api/v1/episode-brief/${episodeId}/rewrite-line`, { line: originalLine, speaker: parsed?.speaker || 'Prime', beatName: beat?.name, beatContext: scenePlan.find(p => p.beat_number === beat?.number)?.emotional_intent, showId });
      handleEditLine(beatId, lineIndex, res.data.rewrittenLine);
      setToast({ msg: 'Line rewritten ✦', type: 'success' }); setTimeout(() => setToast(null), 3000);
    } catch { setToast({ msg: 'Rewrite failed', type: 'error' }); setTimeout(() => setToast(null), 3000); }
    finally { setRewritingLine(null); }
  };

  const handleApprove = (beatId) => setBeats(prev => prev.map(b => b.id === beatId ? { ...b, approved: !b.approved } : b));

  const [guardResult, setGuardResult] = useState(null);

  const handleGenerate = async () => {
    setGenerating(true); setGenError(null); setGuardResult(null);
    try {
      const res = await api.post(`/api/v1/episode-brief/${episodeId}/generate-script`, { showId });
      const script = res.data.script || res.data.script_text || '';
      setScriptText(script); setDevScript(script);
      try { await api.put(`/api/v1/episodes/${episodeId}`, { script_content: script }); } catch {}

      // Check for auto-guard results
      if (res.data.guardResult) {
        setGuardResult(res.data.guardResult);
        const v = res.data.guardResult.violations?.length || 0;
        setToast({ msg: v > 0 ? `✦ Script generated — ⚠️ ${v} franchise violation(s)` : '✦ Script generated — ✅ Passed franchise guard', type: v > 0 ? 'error' : 'success' });
      } else {
        setToast({ msg: '✦ Script generated!', type: 'success' });
      }
      setTimeout(() => setToast(null), 5000);
    } catch (err) { setGenError(err.response?.data?.error || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const approvedCount = beats.filter(b => b.approved).length;
  const allApproved = beats.length > 0 && approvedCount === beats.length;
  const hasScript = !!scriptText?.trim();

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 0' }}>
      <style>{`.script-line-hover:hover{background:#F9F5FF}.script-line-hover:hover .rewrite-btn{opacity:1!important}.rewrite-btn{transition:opacity .15s}`}</style>
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: toast.type === 'error' ? '#FFEBEE' : '#E8F5E9', color: toast.type === 'error' ? '#C62828' : '#16a34a', border: `1px solid ${toast.type === 'error' ? '#FFCDD2' : '#A5D6A7'}`, borderRadius: 10, padding: '12px 18px', fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>{toast.msg}</div>}

      {hasScript && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1A1A1A' }}>{episode?.title}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>{beats.length} beats · {approvedCount} approved{allApproved && <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 600 }}>✓ Complete</span>}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setDeveloperMode(d => !d)} style={{ background: developerMode ? '#5C3D8F' : '#F5F5F5', color: developerMode ? '#FFF' : '#888', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 11, cursor: 'pointer', fontWeight: developerMode ? 600 : 400 }}>{developerMode ? '📖 Beat View' : '✎ Raw Editor'}</button>
            <button onClick={() => { if (!window.confirm('Regenerate the entire script? Your current script will be replaced.')) return; handleGenerate(); }} disabled={generating} style={{ background: '#F5F0FF', color: '#5C3D8F', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: generating ? 'not-allowed' : 'pointer', fontWeight: 600 }}>{generating ? '⏳ Generating...' : '✦ Regenerate'}</button>
            <button onClick={handleSave} disabled={saving} style={{ background: saved ? '#E8F5E9' : 'linear-gradient(135deg, #C9A83A, #B8962E)', color: saved ? '#16a34a' : '#FFF', border: 'none', borderRadius: 8, padding: '6px 18px', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? '⏳' : saved ? '✓ Saved' : '💾 Save'}</button>
          </div>
        </div>
      )}

      {hasScript && developerMode && <textarea value={devScript} onChange={e => { setDevScript(e.target.value); setScriptText(e.target.value); }} rows={30} style={{ width: '100%', padding: 16, fontFamily: 'monospace', fontSize: 13, border: '1px solid #EEE', borderRadius: 10, resize: 'vertical', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box', marginBottom: 24 }} />}

      {!developerMode && (hasScript ? (
        <div>
          {beats.map(beat => <BeatSection key={beat.id} beat={beat} scenePlan={scenePlan} expanded={expandedBeat === beat.id} onToggle={() => setExpandedBeat(expandedBeat === beat.id ? null : beat.id)} onApprove={handleApprove} onEdit={handleEditLine} onRewrite={handleRewriteLine} rewritingLine={rewritingLine} />)}
          {/* Franchise Guard Results */}
          {guardResult && (
            <div style={{
              marginTop: 16, borderRadius: 10, padding: '14px 18px',
              background: guardResult.violations?.length > 0 ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${guardResult.violations?.length > 0 ? '#fecaca' : '#bbf7d0'}`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: guardResult.violations?.length > 0 ? '#dc2626' : '#16a34a', marginBottom: 6 }}>
                {guardResult.violations?.length > 0 ? `🛡️ ${guardResult.violations.length} franchise violation(s)` : '🛡️ Passed franchise guard'}
                <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>({guardResult.rules_checked || '?'} rules checked)</span>
              </div>
              {guardResult.violations?.map((v, i) => (
                <div key={i} style={{ padding: '6px 10px', background: '#fff', borderRadius: 6, marginBottom: 4, fontSize: 12, color: '#dc2626', border: '1px solid #fecaca' }}>
                  <strong>{v.rule}:</strong> {v.explanation}
                </div>
              ))}
            </div>
          )}

          {allApproved && (
            <div style={{ background: 'linear-gradient(135deg, #E8F5E9, #F1F8E9)', border: '1px solid #A5D6A7', borderRadius: 12, padding: '20px 24px', marginTop: 16, textAlign: 'center' }}>
              <p style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#16a34a' }}>✦ All beats approved — script is ready</p>
              <button onClick={handleSave} style={{ background: '#16a34a', color: '#FFF', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>💾 Save Final Script</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: 500, margin: '0 auto', padding: '40px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>Generate Episode Script</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
              AI writes a 14-beat script using your event, outfit, and character data.
            </p>
          </div>

          {/* What feeds the script */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Script will use</div>
            {[
              { icon: '💌', label: 'Event + host + guests', ok: !!episode?.description },
              { icon: '👗', label: 'Wardrobe + brand intelligence', ok: true },
              { icon: '📍', label: 'Scene plan + locations', ok: scenePlan.length > 0 },
              { icon: '🪙', label: 'Financial pressure + coin balance', ok: true },
              { icon: '📱', label: 'Social tasks (content to create)', ok: true },
              { icon: '👥', label: 'Character voices + archetypes', ok: true },
              { icon: '📺', label: 'Previous episode continuity', ok: true },
              { icon: '🎯', label: 'Designed intent (SLAY/PASS/FAIL)', ok: !!episode?.evaluation_json || true },
              { icon: '📊', label: 'Season arc + emotional phase', ok: true },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12 }}>
                <span style={{ color: item.ok ? '#16a34a' : '#f59e0b' }}>{item.ok ? '✓' : '○'}</span>
                <span>{item.icon} {item.label}</span>
              </div>
            ))}
          </div>

          {genError && <div style={{ background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2', borderRadius: 8, padding: '10px 16px', fontSize: 13, marginBottom: 16 }}>{genError}</div>}

          <button onClick={handleGenerate} disabled={generating} style={{
            width: '100%', background: generating ? '#EEE' : 'linear-gradient(135deg, #C9A83A, #B8962E)',
            color: generating ? '#999' : '#FFF', border: 'none', borderRadius: 10, padding: '12px 0',
            fontSize: 15, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer',
            boxShadow: generating ? 'none' : '0 2px 8px rgba(184,150,46,0.25)',
          }}>
            {generating ? '⏳ Generating 14-beat script...' : '✦ Generate Script'}
          </button>
        </div>
      ))}

      {/* DREAM Map Modal */}
      {showMap && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowMap(false)}>
          <div style={{ width: '90vw', maxWidth: 1200, maxHeight: '85vh', background: '#1a1a2e', borderRadius: 16, overflow: 'hidden', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.4)' }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: '#B8962E', letterSpacing: 2 }}>DREAM MAP</span>
              <button onClick={() => setShowMap(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 16, cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
            </div>
            <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Loading map...</div>}>
              <DreamMap locations={mapLocations} mapImageUrl={mapImageUrl} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
