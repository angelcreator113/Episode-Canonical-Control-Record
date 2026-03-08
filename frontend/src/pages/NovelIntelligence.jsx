import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// ── Palette ───────────────────────────────────────────────────────────────
const C = {
  bg: '#fdf6f9', surface: '#ffffff', surfaceAlt: '#fef9fc', bgDeep: '#f5edf4',
  border: '#e8d5e8', borderDark: '#d4b8d4',
  text: '#2d1f2d', textDim: '#6b4d6b', textFaint: '#b09ab0',
  pink: '#d4789a', pinkSoft: '#d4789a0f', pinkMid: '#d4789a30',
  blue: '#7ab3d4', blueSoft: '#7ab3d412', blueMid: '#7ab3d430',
  lavender: '#a889c8', lavSoft: '#a889c812', lavMid: '#a889c830',
  gold: '#c9a96e', goldSoft: '#c9a96e18',
  red: '#d47878', redSoft: '#d4787812',
  green: '#78b89a', greenSoft: '#78b89a12',
};

const RULE_TYPE_CONFIG = {
  opening_phrase:      { label: 'Opening Phrase',      color: C.pink },
  closing_phrase:      { label: 'Closing Phrase',       color: C.pink },
  address_pattern:     { label: 'Address Pattern',      color: C.blue },
  scene_opening:       { label: 'Scene Opening',        color: C.lavender },
  scene_closing:       { label: 'Scene Closing',        color: C.lavender },
  dialogue_pattern:    { label: 'Dialogue Pattern',     color: C.blue },
  interior_monologue:  { label: 'Interior Monologue',   color: C.lavender },
  tonal_constraint:    { label: 'Tonal Constraint',     color: C.gold },
  structural_pattern:  { label: 'Structural Pattern',   color: C.pink },
};

const iS = {
  width: '100%', padding: '9px 12px', background: C.surfaceAlt,
  border: `1px solid ${C.border}`, borderRadius: '8px',
  fontSize: '13px', color: C.text, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'system-ui',
};

export default function NovelIntelligence({ bookId, seriesId }) {
  const [tab, setTab] = useState('rules');

  const [proposed, setProposed]   = useState([]);
  const [active, setActive]       = useState([]);
  const [rulesLoading, setRL]     = useState(false);

  const [metadata, setMetadata]   = useState(null);
  const [cascading, setCascading] = useState(false);
  const [metaLoading, setML]      = useState(false);
  const [editingField, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');

  const [err, setErr] = useState(null);

  useEffect(() => {
    if (tab === 'rules') loadRules();
    if (tab === 'metadata') loadMetadata();
  }, [tab, bookId, seriesId]);

  async function loadRules() {
    setRL(true);
    try {
      const params = seriesId ? `?series_id=${seriesId}` : '';
      const [propRes, activeRes] = await Promise.all([
        fetch(`${API}/api/v1/novel/voice-rules/proposed${params}`),
        fetch(`${API}/api/v1/novel/voice-rules/active${params}`),
      ]);
      const propData   = await propRes.json();
      const activeData = await activeRes.json();
      setProposed(propData.rules  || []);
      setActive(activeData.rules  || []);
    } catch (e) { setErr(e.message); }
    finally { setRL(false); }
  }

  async function loadMetadata() {
    if (!bookId) return;
    setML(true);
    try {
      const res  = await fetch(`${API}/api/v1/novel/manuscript/metadata/${bookId}`);
      if (res.status === 404) { setMetadata(null); }
      else { const data = await res.json(); setMetadata(data.metadata); }
    } catch { setMetadata(null); }
    finally { setML(false); }
  }

  async function confirmRule(id) {
    await fetch(`${API}/api/v1/novel/voice-rules/${id}/confirm`, { method: 'POST' });
    loadRules();
  }
  async function dismissRule(id) {
    await fetch(`${API}/api/v1/novel/voice-rules/${id}/dismiss`, { method: 'POST' });
    loadRules();
  }

  async function runCascade() {
    if (!bookId) return;
    setCascading(true); setErr(null);
    try {
      const res  = await fetch(`${API}/api/v1/novel/manuscript/cascade`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId, series_id: seriesId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMetadata(data.metadata);
    } catch (e) { setErr(e.message); }
    finally { setCascading(false); }
  }

  async function saveOverride() {
    if (!metadata || !editingField) return;
    await fetch(`${API}/api/v1/novel/manuscript/metadata/${metadata.id}/override`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides: { [editingField]: editValue } }),
    });
    setEditing(null);
    loadMetadata();
  }

  const meta = metadata ? { ...metadata, ...(metadata.author_overrides || {}) } : null;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: C.text, background: C.bg, minHeight: '100%', padding: '0' }}>

      {/* Inner tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surface, marginBottom: '20px' }}>
        {[
          { key: 'rules',    label: '◎ Voice Rules' },
          { key: 'metadata', label: '◇ Book Metadata' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none',
            borderBottom: tab === t.key ? `2px solid ${C.pink}` : '2px solid transparent',
            padding: '12px 20px', marginBottom: '-1px',
            fontSize: '13px', fontWeight: tab === t.key ? '600' : '400',
            color: tab === t.key ? C.text : C.textFaint, cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '0 2px' }}>
        {err && (
          <div style={{ padding: '10px 14px', background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: '8px', fontSize: '13px', color: C.red, marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
            {err} <button onClick={() => setErr(null)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* ── VOICE RULES ── */}
        {tab === 'rules' && (
          rulesLoading ? <CenteredSpin /> : (
            <div>
              {/* Proposed rules */}
              {proposed.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                  <SectionLabel color={C.pink}>
                    ◈ {proposed.length} pattern{proposed.length > 1 ? 's' : ''} detected from your edits
                  </SectionLabel>
                  <p style={{ fontSize: '12px', color: C.textFaint, marginBottom: '14px', lineHeight: '1.6' }}>
                    Claude noticed you making the same kind of edit {proposed[0]?.signal_count || 3}+ times. Confirm to add it as a permanent voice rule — every future generation will follow it automatically.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {proposed.map(rule => {
                      const conf = RULE_TYPE_CONFIG[rule.rule_type] || { label: rule.rule_type, color: C.blue };
                      return (
                        <div key={rule.id} style={{
                          background: C.surface,
                          border: `1px solid ${C.pink}44`,
                          borderLeft: `3px solid ${C.pink}`,
                          borderRadius: '10px',
                          padding: '16px 18px',
                          boxShadow: `0 2px 12px ${C.pinkSoft}`,
                        }}>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <Chip color={C.pink} bg={C.pinkSoft}>◈ Proposed</Chip>
                            <Chip color={conf.color} bg={`${conf.color}14`}>{conf.label}</Chip>
                            {rule.character_name && <Chip color={C.lavender} bg={C.lavSoft}>{rule.character_name}</Chip>}
                            <span style={{ fontSize: '11px', color: C.textFaint }}>from {rule.signal_count} edits</span>
                          </div>

                          <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', fontWeight: '600', color: C.text, marginBottom: '12px', lineHeight: '1.5' }}>
                            {rule.rule_text}
                          </div>

                          {rule.example_original && (
                            <div style={{ marginBottom: '12px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div style={{ padding: '8px 12px', background: C.redSoft, border: `1px solid ${C.red}33`, borderRadius: '6px' }}>
                                  <div style={{ fontSize: '9px', color: C.red, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Claude wrote</div>
                                  <div style={{ fontSize: '12px', color: C.textDim, lineHeight: '1.5' }}>{rule.example_original.slice(0, 120)}{rule.example_original.length > 120 ? '…' : ''}</div>
                                </div>
                                <div style={{ padding: '8px 12px', background: C.greenSoft, border: `1px solid ${C.green}33`, borderRadius: '6px' }}>
                                  <div style={{ fontSize: '9px', color: C.green, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>You changed it to</div>
                                  <div style={{ fontSize: '12px', color: C.textDim, lineHeight: '1.5' }}>{rule.example_edited.slice(0, 120)}{rule.example_edited.length > 120 ? '…' : ''}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => confirmRule(rule.id)} style={{ padding: '8px 18px', background: C.text, border: 'none', borderRadius: '6px', color: C.bg, fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
                              Add as Voice Rule →
                            </button>
                            <button onClick={() => dismissRule(rule.id)} style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textFaint, fontSize: '12px', cursor: 'pointer' }}>
                              Not a pattern
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active rules */}
              <div>
                <SectionLabel color={C.blue}>
                  ◎ {active.length} active voice rule{active.length !== 1 ? 's' : ''} — injecting into every generation
                </SectionLabel>
                {active.length === 0 ? (
                  <EmptyState icon="◎" title="No voice rules yet" sub="Edit generated lines and Claude will detect your patterns. After 3 matching edits, a rule proposal surfaces here." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {active.map(rule => {
                      const conf = RULE_TYPE_CONFIG[rule.rule_type] || { label: rule.rule_type, color: C.blue };
                      return (
                        <div key={rule.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${conf.color}`, borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '7px', flexWrap: 'wrap' }}>
                              <Chip color={C.green} bg={C.greenSoft}>● Active</Chip>
                              <Chip color={conf.color} bg={`${conf.color}14`}>{conf.label}</Chip>
                              {rule.character_name && <Chip color={C.lavender} bg={C.lavSoft}>{rule.character_name}</Chip>}
                            </div>
                            <div style={{ fontSize: '13px', color: C.text, lineHeight: '1.6' }}>{rule.rule_text}</div>
                            {rule.injection_count > 0 && (
                              <div style={{ fontSize: '10px', color: C.textFaint, marginTop: '5px' }}>Used {rule.injection_count}× in generation</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* ── BOOK METADATA ── */}
        {tab === 'metadata' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: '600', color: C.text, marginBottom: '3px' }}>Manuscript Cascade</div>
                <div style={{ fontSize: '12px', color: C.textFaint }}>
                  {meta ? `Generated from ${meta.stories_included} approved stories` : 'Reads all approved stories and generates book description, TOC, chapter titles, section titles.'}
                </div>
              </div>
              <button onClick={runCascade} disabled={cascading || !bookId} style={{
                padding: '10px 22px', background: cascading ? C.bgDeep : C.text,
                border: 'none', borderRadius: '8px', color: C.bg,
                fontSize: '13px', fontWeight: '600', cursor: cascading ? 'default' : 'pointer',
                fontFamily: 'Georgia, serif', display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {cascading && <Spin />}
                {cascading ? 'Generating…' : meta ? 'Regenerate →' : 'Generate from Approved Stories →'}
              </button>
            </div>

            {cascading && (
              <div style={{ padding: '20px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '10px', textAlign: 'center', marginBottom: '20px' }}>
                <Spin />
                <div style={{ fontSize: '13px', color: C.textDim, marginTop: '10px' }}>Reading approved stories and generating book metadata…</div>
              </div>
            )}

            {!meta && !cascading && !metaLoading && (
              <EmptyState icon="◇" title="No metadata yet" sub="Approve at least one story in StoryTeller, then click Generate above." />
            )}

            {metaLoading && <CenteredSpin />}

            {meta && !metaLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <MetaCard title="Book Title" color={C.pink} onEdit={() => { setEditing('book_title'); setEditValue(meta.book_title || ''); }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: '700', color: C.text, marginBottom: '6px' }}>{meta.book_title || '—'}</div>
                  {meta.tagline && <div style={{ fontSize: '13px', color: C.textDim, fontStyle: 'italic' }}>{meta.tagline}</div>}
                  {meta.one_line_logline && <div style={{ fontSize: '12px', color: C.textFaint, marginTop: '6px' }}>{meta.one_line_logline}</div>}
                </MetaCard>

                <MetaCard title="Amazon Description" color={C.lavender} onEdit={() => { setEditing('amazon_description'); setEditValue(meta.amazon_description || ''); }}>
                  <p style={{ fontSize: '13px', color: C.textDim, lineHeight: '1.8', margin: 0 }}>{meta.amazon_description || '—'}</p>
                </MetaCard>

                <MetaCard title="Arc Section Titles" color={C.blue}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      ['Establishment', meta.section_establishment],
                      ['Pressure',      meta.section_pressure],
                      ['Crisis',        meta.section_crisis],
                      ['Integration',   meta.section_integration],
                    ].map(([stage, title]) => (
                      <div key={stage} style={{ padding: '10px 14px', background: C.bgDeep, borderRadius: '8px', borderLeft: `2px solid ${C.blue}` }}>
                        <div style={{ fontSize: '9px', color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>{stage}</div>
                        <div style={{ fontSize: '13px', color: C.text, fontFamily: 'Georgia, serif', fontWeight: '600' }}>{title || '—'}</div>
                      </div>
                    ))}
                  </div>
                </MetaCard>

                {meta.table_of_contents?.length > 0 && (
                  <MetaCard title={`Table of Contents — ${meta.table_of_contents.length} chapters`} color={C.pink}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {meta.table_of_contents.map((ch, i) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', padding: '8px 12px', background: i % 2 === 0 ? C.bgDeep : 'transparent', borderRadius: '6px', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '11px', color: C.textFaint, minWidth: '24px', paddingTop: '2px' }}>{ch.chapter_number}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', color: C.text, fontWeight: '600', fontFamily: 'Georgia, serif' }}>{ch.title}</div>
                            {ch.summary && <div style={{ fontSize: '11px', color: C.textFaint, marginTop: '2px', lineHeight: '1.4' }}>{ch.summary}</div>}
                          </div>
                          <Chip color={
                            ch.arc_stage === 'establishment' ? C.blue :
                            ch.arc_stage === 'pressure'      ? C.lavender :
                            ch.arc_stage === 'crisis'        ? C.red : C.green
                          } bg="transparent">{ch.arc_stage}</Chip>
                        </div>
                      ))}
                    </div>
                  </MetaCard>
                )}

                {meta.lala_seed_moments?.length > 0 && (
                  <MetaCard title={`⬡ ${meta.lala_seed_count} Lala Seeds Detected`} color={C.gold}>
                    <p style={{ fontSize: '12px', color: C.textFaint, marginBottom: '10px', lineHeight: '1.5' }}>
                      Moments where JustAWoman's bolder voice surfaced — source material for Lala's emergence.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {meta.lala_seed_moments.map((seed, i) => (
                        <div key={i} style={{ padding: '8px 12px', background: C.goldSoft, border: `1px solid ${C.gold}33`, borderRadius: '6px' }}>
                          <span style={{ fontSize: '10px', color: C.gold, fontWeight: '700' }}>Story {seed.story_number} · </span>
                          <span style={{ fontSize: '12px', color: C.textDim }}>{seed.moment}</span>
                        </div>
                      ))}
                    </div>
                  </MetaCard>
                )}

                {meta.dominant_themes?.length > 0 && (
                  <MetaCard title="Dominant Themes" color={C.lavender}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {meta.dominant_themes.map(t => <Chip key={t} color={C.lavender} bg={C.lavSoft}>{t}</Chip>)}
                    </div>
                  </MetaCard>
                )}
              </div>
            )}

            {/* Edit modal */}
            {editingField && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,31,45,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                <div style={{ background: C.surface, borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(45,31,45,0.2)' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: '600', marginBottom: '14px', color: C.text }}>Edit {editingField.replace(/_/g, ' ')}</div>
                  <textarea value={editValue} onChange={e => setEditValue(e.target.value)} style={{ ...iS, height: editingField === 'amazon_description' ? '180px' : '80px', resize: 'vertical', lineHeight: '1.7', marginBottom: '14px', borderRadius: '8px' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={saveOverride} style={{ padding: '9px 20px', background: C.text, border: 'none', borderRadius: '8px', color: C.bg, fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>Save Override →</button>
                    <button onClick={() => setEditing(null)} style={{ padding: '9px 14px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textFaint, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionLabel({ color, children }) {
  return <div style={{ fontSize: '11px', color, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>{children}</div>;
}
function Chip({ color, bg, children }) {
  return <span style={{ padding: '2px 9px', background: bg || `${color}18`, border: `1px solid ${color}44`, borderRadius: '20px', fontSize: '10px', color, fontWeight: '600', letterSpacing: '0.05em' }}>{children}</span>;
}
function MetaCard({ title, color, children, onEdit }) {
  return (
    <div style={{ background: '#ffffff', border: `1px solid #e8d5e8`, borderTop: `2px solid ${color}`, borderRadius: '10px', padding: '18px 20px', boxShadow: '0 1px 6px rgba(168,137,200,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', color, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</div>
        {onEdit && <button onClick={onEdit} style={{ padding: '4px 10px', background: 'transparent', border: `1px solid #e8d5e8`, borderRadius: '6px', color: '#b09ab0', fontSize: '11px', cursor: 'pointer' }}>Edit</button>}
      </div>
      {children}
    </div>
  );
}
function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ padding: '48px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '28px', color: '#d4b8d4', marginBottom: '12px' }}>{icon}</div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: '#6b4d6b', marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: '#b09ab0', lineHeight: '1.6', maxWidth: '320px', margin: '0 auto' }}>{sub}</div>
    </div>
  );
}
function Spin() {
  return (
    <>
      <div style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #e8d5e8', borderTop: `2px solid #d4789a`, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
function CenteredSpin() {
  return <div style={{ padding: '48px', textAlign: 'center' }}><Spin /></div>;
}
