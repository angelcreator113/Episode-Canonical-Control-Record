/**
 * The event library's inline editor (New event, a template, Duplicate as New
 * Event): the form Producer Mode's Events tab drew above its queue, moved
 * here unchanged with the library (2026-10-25). EventLibrary owns the form's
 * state and its save; this draws it.
 */
import { InvitationStyleFields } from '../../pages/InvitationGenerator';
import { S, EVENT_TYPE_ICONS } from './producerStyles';
import { EVENT_TYPES, BIAS_OPTIONS } from '../../lib/eventLibrary';

export default function EventLibraryEditor({ lib }) {
  const {
    aiRevising, editingEvent, eventEditorRef, eventForm, findSimilarEvents, handleAiRevise, overlayTypes, saveEvent, savingEvent, sceneSets, setEditingEvent, setEventForm, worldEvents, worldLocations,
  } = lib;
  return (
            <div ref={eventEditorRef} data-testid="event-editor" style={{ background: 'var(--surface-card)', border: '2px solid var(--primary)', borderRadius: 12, padding: 20, marginBottom: 16, scrollMarginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 16px' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{editingEvent === 'new' ? '✨ New Event' : '✏️ Edit Event'}</h3>
                {/* Read-only badge when this event was spawned from a feed
                    profile (worldEvents.js POST /from-profile sets the FK).
                    Lets creators see the lineage without diving into the
                    canon_consequences JSON, and hints to edit the source
                    profile rather than this event for new traits. */}
                {eventForm.source_profile_id && (
                  <span
                    title="Created from a Pulse profile — edit the profile to change brand, lifestyle, or persona traits."
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--accent-subtle)', color: 'var(--accent-dark)', border: '1px solid var(--accent-light)', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace", letterSpacing: 0.4 }}
                  >
                    🌐 FROM FEED · profile #{eventForm.source_profile_id}
                  </span>
                )}
              </div>
              {/* Duplicate detection warning + AI Revise */}
              {eventForm.name && findSimilarEvents(eventForm.name).length > 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--warning-text)' }}>
                    ⚠️ Similar events: {findSimilarEvents(eventForm.name).map(e => e.name).join(', ')}
                  </div>
                  <button onClick={handleAiRevise} disabled={aiRevising} style={{
                    padding: '5px 14px', background: aiRevising ? 'var(--lala-parchment-2)' : 'var(--primary)',
                    color: aiRevising ? 'var(--text-faint)' : 'var(--text-inverse)', border: 'none', borderRadius: 8,
                    fontSize: 11, fontWeight: 700, cursor: aiRevising ? 'wait' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {aiRevising ? '⏳ Revising...' : '✨ AI Revise'}
                  </button>
                </div>
              )}

              {/* Venue & Location — WorldLocation picker + scene set */}
              <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--surface-bg)', borderRadius: 10, border: '1px solid var(--lala-parchment-3)' }}>
                <label style={{ ...S.fLabel, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>📍 Venue & Location</label>

                {/* WorldLocation venue picker — auto-fills name + address */}
                <div style={{ marginBottom: 8 }}>
                  <select
                    value={eventForm.venue_location_id || ''}
                    onChange={e => {
                      const locId = e.target.value || null;
                      const loc = worldLocations.find(l => l.id === locId);
                      const addr = loc ? [loc.street_address, loc.district, loc.city].filter(Boolean).join(', ') : '';
                      setEventForm(p => ({
                        ...p,
                        venue_location_id: locId,
                        venue_name: loc?.name || p.venue_name || '',
                        venue_address: addr || p.venue_address || '',
                        location_hint: addr || loc?.name || p.location_hint || '',
                      }));
                    }}
                    style={{ ...S.sel, width: '100%', marginBottom: 6 }}
                  >
                    <option value="">— Choose a venue from World Locations —</option>
                    {worldLocations.filter(l => l.location_type === 'venue' || l.location_type === 'interior' || l.venue_type).map(l => (
                      <option key={l.id} value={l.id}>🏪 {l.name}{l.venue_type ? ` (${l.venue_type.replace(/_/g, ' ')})` : ''}{l.district ? ` — ${l.district}` : ''}</option>
                    ))}
                    <option disabled>──── Other locations ────</option>
                    {worldLocations.filter(l => l.location_type !== 'venue' && !l.venue_type).map(l => (
                      <option key={l.id} value={l.id}>📍 {l.name} ({l.location_type})</option>
                    ))}
                  </select>
                </div>

                {/* Venue name + address (editable, auto-filled from location) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input
                    value={eventForm.venue_name || ''}
                    onChange={e => setEventForm(p => ({ ...p, venue_name: e.target.value }))}
                    placeholder="Venue Name (e.g. Club Noir)"
                    style={S.sel}
                  />
                  <input
                    value={eventForm.venue_address || ''}
                    onChange={e => setEventForm(p => ({ ...p, venue_address: e.target.value }))}
                    placeholder="Address (e.g. 742 Ocean Drive, South Beach, Miami)"
                    style={S.sel}
                  />
                </div>

                {/* Event date + time */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input
                    value={eventForm.event_date || ''}
                    onChange={e => setEventForm(p => ({ ...p, event_date: e.target.value }))}
                    placeholder="Event Date (e.g. Friday, March 15th)"
                    style={S.sel}
                  />
                  <input
                    value={eventForm.event_time || ''}
                    onChange={e => setEventForm(p => ({ ...p, event_time: e.target.value }))}
                    placeholder="Time (e.g. 9:00 PM - 2:00 AM)"
                    style={S.sel}
                  />
                </div>

                {/* Scene set picker for visual representation */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={eventForm.scene_set_id || ''} onChange={e => setEventForm(p => ({ ...p, scene_set_id: e.target.value || null }))} style={{ ...S.sel, flex: 1, minWidth: 200 }}>
                    <option value="">— Scene Set (visual) —</option>
                    {sceneSets.filter(ss => ss.scene_type === 'EVENT_LOCATION').map(ss => (
                      <option key={ss.id} value={ss.id}>🎬 {ss.name} (EVENT)</option>
                    ))}
                    {sceneSets.filter(ss => ss.scene_type !== 'EVENT_LOCATION' && ss.base_still_url).map(ss => (
                      <option key={ss.id} value={ss.id}>📍 {ss.name} ({ss.scene_type?.replace(/_/g, ' ')})</option>
                    ))}
                  </select>
                  {eventForm.scene_set_id && (() => {
                    const ss = sceneSets.find(s => s.id === eventForm.scene_set_id);
                    return ss ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {ss.base_still_url && <img src={ss.base_still_url} alt={ss.name} style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--lala-parchment-3)' }} />}
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success-text)' }}>✓ {ss.name}</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }} className="wa-grid wa-grid-3col">
                <FG label="Event Name *" value={eventForm.name} onChange={v => setEventForm(p => ({ ...p, name: v }))} placeholder="Velour Society Garden Soirée" />
                <div>
                  <label style={S.fLabel}>Type</label>
                  <select value={eventForm.event_type} onChange={e => setEventForm(p => ({ ...p, event_type: e.target.value }))} style={S.sel}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_TYPE_ICONS[t]} {t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <FG label="Host (who's hosting)" value={eventForm.host || ''} onChange={v => setEventForm(p => ({ ...p, host: v }))} placeholder="Velour Society, Fashion Week Committee" />
                <FG label="Brand Sponsor (optional)" value={eventForm.host_brand} onChange={v => setEventForm(p => ({ ...p, host_brand: v }))} placeholder="Velour, Chanel (leave empty if none)" />
                <FG label="Prestige (1-10)" value={eventForm.prestige} onChange={v => setEventForm(p => ({ ...p, prestige: parseInt(v) || 5 }))} type="number" min={1} max={10} />
                <FG label={eventForm.deal_type ? 'Difficulty' : 'Cost (coins)'} value={eventForm.cost_coins} onChange={v => setEventForm(p => ({ ...p, cost_coins: parseInt(v) || 0 }))} type="number" min={0} disabled={eventForm.is_paid === 'free'} />
                <FG label="Strictness (1-10)" value={eventForm.strictness} onChange={v => setEventForm(p => ({ ...p, strictness: parseInt(v) || 5 }))} type="number" min={1} max={10} />
                <div>
                  <label style={S.fLabel}>Deadline</label>
                  <select value={eventForm.deadline_type} onChange={e => setEventForm(p => ({ ...p, deadline_type: e.target.value }))} style={S.sel}>
                    {['none', 'low', 'medium', 'high', 'tonight', 'urgent'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {/* Optional minute count — overrides whatever the type implies
                    when set. Used by the brief snapshot's event_difficulty
                    block. Leave blank for "use the default for this type". */}
                <FG
                  label="Deadline minutes (optional)"
                  value={eventForm.deadline_minutes ?? ''}
                  onChange={v => setEventForm(p => ({ ...p, deadline_minutes: v === '' ? null : parseInt(v, 10) || null }))}
                  type="number"
                  min={1}
                  placeholder="e.g. 90"
                />
                <FG label="Dress Code" value={eventForm.dress_code} onChange={v => setEventForm(p => ({ ...p, dress_code: v }))} placeholder="romantic couture" />
                <div>
                  <label style={S.fLabel}>Dress Code Keywords</label>
                  <input
                    type="text"
                    value={(eventForm.dress_code_keywords || []).join(', ')}
                    onChange={e => {
                      const keywords = e.target.value.split(',').map(k => k.trim()).filter(Boolean);
                      setEventForm(p => ({ ...p, dress_code_keywords: keywords }));
                    }}
                    placeholder="romantic, garden, floral, soft"
                    style={S.sel}
                  />
                  {(eventForm.dress_code_keywords || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {eventForm.dress_code_keywords.map((kw, i) => (
                        <span key={i} style={{ padding: '2px 8px', background: 'var(--primary-subtle)', border: '1px solid var(--primary-light)', borderRadius: 6, fontSize: 11, color: 'var(--primary-text)', fontWeight: 600 }}>
                          {kw}
                          <button onClick={() => setEventForm(p => ({ ...p, dress_code_keywords: p.dress_code_keywords.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', marginLeft: 4, fontSize: 12 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={S.fLabel}>Browse Pool Bias</label>
                  <select value={eventForm.browse_pool_bias} onChange={e => setEventForm(p => ({ ...p, browse_pool_bias: e.target.value }))} style={S.sel}>
                    {BIAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                {/* Pool size pairs with bias — bias is the lean (luxury / mid /
                    balanced), size is how many candidates to surface. Default
                    is 8; bump for big browse moments, drop for tight choices. */}
                <FG
                  label="Browse Pool Size"
                  value={eventForm.browse_pool_size ?? 8}
                  onChange={v => setEventForm(p => ({ ...p, browse_pool_size: parseInt(v, 10) || 8 }))}
                  type="number"
                  min={1}
                  max={50}
                />
              </div>

              {/* Invitation Style */}
              <InvitationStyleFields formData={eventForm} setFormData={setEventForm} />

              {/* Career & Payment */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12, padding: 12, background: 'var(--surface-bg)', borderRadius: 8 }}>
                <div>
                  <label style={S.fLabel}>Career Tier</label>
                  <select value={eventForm.career_tier} onChange={e => setEventForm(p => ({ ...p, career_tier: parseInt(e.target.value) }))} style={S.sel}>
                    <option value={1}>1 — Emerging (Rep 0-2)</option>
                    <option value={2}>2 — Rising (Rep 3-4)</option>
                    <option value={3}>3 — Established (Rep 5-6)</option>
                    <option value={4}>4 — Influential (Rep 7-8)</option>
                    <option value={5}>5 — Elite (Rep 9-10)</option>
                  </select>
                </div>
                <div>
                  <label style={S.fLabel}>Event Cost Type</label>
                  <select value={eventForm.is_paid || 'no'} onChange={e => { const val = e.target.value; setEventForm(p => ({ ...p, is_paid: val, cost_coins: val === 'free' ? 0 : p.cost_coins })); }} style={S.sel}>
                    <option value="no">No — Lala pays to attend</option>
                    <option value="yes">Yes — Lala gets paid</option>
                    <option value="free">Free — No cost to attend</option>
                  </select>
                  {eventForm.is_paid === 'free' && <div style={{ fontSize: 10, color: 'var(--success-text)', marginTop: 2 }}>Free event — no cost.</div>}
                  {eventForm.is_paid === 'yes' && <div style={{ fontSize: 10, color: 'var(--primary-text)', marginTop: 2 }}>Lala earns coins for attending.</div>}
                </div>
                <FG label="Payment (if paid)" value={eventForm.payment_amount} onChange={v => setEventForm(p => ({ ...p, payment_amount: parseInt(v) || 0 }))} type="number" min={0} />
              </div>

              <FG label="Location Hint" value={eventForm.location_hint} onChange={v => setEventForm(p => ({ ...p, location_hint: v }))} placeholder="Parisian rooftop garden, golden hour, marble tables" full />
              <FG label="Narrative Stakes" value={eventForm.narrative_stakes} onChange={v => setEventForm(p => ({ ...p, narrative_stakes: v }))} placeholder="What this event means for Lala's arc..." textarea full />
              <FG label="Career Milestone" value={eventForm.career_milestone} onChange={v => setEventForm(p => ({ ...p, career_milestone: v }))} placeholder="First brand collaboration, first paid gig, etc." full />
              <FG label="On Fail" value={eventForm.fail_consequence} onChange={v => setEventForm(p => ({ ...p, fail_consequence: v }))} placeholder="What happens narratively if she fails..." full />
              <FG label="On Success → Unlocks" value={eventForm.success_unlock} onChange={v => setEventForm(p => ({ ...p, success_unlock: v }))} placeholder="What this opens up (future events, brand deals, etc.)" full />

              {/* ── Narrative Chain ───────────────────────────────────────────
                  Sequences this event after another and lists threads it
                  plants for future episodes. The next-event suggester reads
                  these (chain continuation +30, seed match +18) and the
                  brief snapshot captures them. Optional — leave parent
                  empty for standalone events. */}
              <div style={{ gridColumn: '1 / -1', marginTop: 8, padding: 12, background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 8 }}>
                <label style={{ ...S.fLabel, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>🔗 Narrative Chain (optional)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={S.fLabel}>Parent event (the one this follows)</label>
                    <select
                      value={eventForm.parent_event_id || ''}
                      onChange={e => setEventForm(p => ({ ...p, parent_event_id: e.target.value || null }))}
                      style={S.sel}
                    >
                      <option value="">— none (standalone) —</option>
                      {worldEvents
                        .filter(e => e.id !== editingEvent)
                        .map(e => (
                          <option key={e.id} value={e.id}>{e.name}{e.event_type ? ` (${e.event_type})` : ''}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label style={S.fLabel}>Chain position</label>
                    <input
                      type="number"
                      min={1}
                      value={eventForm.chain_position ?? ''}
                      onChange={e => setEventForm(p => ({ ...p, chain_position: e.target.value === '' ? null : parseInt(e.target.value, 10) }))}
                      placeholder="2"
                      style={{ ...S.sel, width: '100%' }}
                    />
                  </div>
                </div>
                <FG
                  label="Chain reason (why this follows the parent)"
                  value={eventForm.chain_reason || ''}
                  onChange={v => setEventForm(p => ({ ...p, chain_reason: v }))}
                  placeholder="The brand from the gala invited her back, this time for press."
                  textarea
                  full
                />
                <label style={S.fLabel}>Seeds for future events</label>
                <textarea
                  value={Array.isArray(eventForm.seeds_future_events) ? eventForm.seeds_future_events.join('\n') : ''}
                  onChange={e => setEventForm(p => ({
                    ...p,
                    seeds_future_events: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                  }))}
                  placeholder={'One per line — threads this event plants for later.\nExample:\nMaison Belle press meeting\nLala\'s number with Ari\nUnpaid invoice from Static Frequency'}
                  rows={3}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              {/* ── Required UI Overlays — split by category ──────────────────
                  Lala-phone overlays (phone, phone_icon) and on-screen
                  production overlays (production, frame) read from the same
                  required_ui_overlays array but render in two named buckets
                  driven by ui_overlay_types.category. Toggle-chip picker shows
                  every type the show has defined with a generated/pending
                  badge so creators can see asset readiness at a glance.
                  Custom names still work via the inline input — generator
                  matches by type_key OR name so a typed name is fine when
                  the asset gets generated later. */}
              {(() => {
                const selected = new Set(eventForm.required_ui_overlays || []);
                const isSelected = (t) => selected.has(t.type_key) || selected.has(t.name);
                const toggle = (t) => {
                  setEventForm(p => {
                    const cur = p.required_ui_overlays || [];
                    // Remove either form (type_key or name) so toggling off
                    // works regardless of which one was saved.
                    if (isSelected(t)) {
                      return { ...p, required_ui_overlays: cur.filter(n => n !== t.type_key && n !== t.name) };
                    }
                    // Prefer type_key when adding (stable across name renames).
                    return { ...p, required_ui_overlays: [...cur, t.type_key || t.name] };
                  });
                };
                const PHONE_CATS = new Set(['phone', 'phone_icon', 'icon']);
                const phoneTypes = overlayTypes.filter(t => PHONE_CATS.has(t.category || 'phone'));
                const uiTypes = overlayTypes.filter(t => !PHONE_CATS.has(t.category || 'phone'));
                // Custom entries — names in required_ui_overlays that don't
                // match any type the show has defined. Surfaced as plain
                // chips below the toggle grids so creators can still see
                // and remove them.
                const knownNames = new Set([
                  ...overlayTypes.map(t => t.type_key).filter(Boolean),
                  ...overlayTypes.map(t => t.name).filter(Boolean),
                ]);
                const customs = (eventForm.required_ui_overlays || []).filter(n => !knownNames.has(n));

                // Auto-suggest defaults based on event_type / prestige —
                // mirrors the generator's expectations so creators aren't
                // staring at a blank picker. Replaces (doesn't merge) since
                // creators usually want a clean slate when they click it.
                const autoSuggest = () => {
                  const suggestions = ['MailPanel', 'InviteLetterOverlay'];
                  if ((eventForm.prestige || 0) >= 4) suggestions.push('WardrobeList');
                  if (eventForm.career_milestone) suggestions.push('CareerList');
                  if (eventForm.event_type === 'brand_deal') suggestions.push('StatsPanel');
                  // Filter to types the show actually has defined; fall back to
                  // raw names for ones the show might still define later.
                  setEventForm(p => ({ ...p, required_ui_overlays: suggestions }));
                };

                const ToggleChip = ({ t }) => {
                  const sel = isSelected(t);
                  const ready = !!t.generated;
                  return (
                    <button
                      type="button"
                      onClick={() => toggle(t)}
                      title={ready ? `${t.name} — asset generated` : `${t.name} — type defined, no asset yet`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 8px', borderRadius: 6, fontSize: 11,
                        fontFamily: "'DM Mono', monospace", cursor: 'pointer',
                        border: `1px solid ${sel ? 'var(--lala-gold)' : 'var(--lala-parchment-3)'}`,
                        background: sel ? 'var(--lala-gold-soft)' : 'var(--surface-card)',
                        color: sel ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: sel ? 700 : 500,
                      }}
                    >
                      <span style={{ fontSize: 9, color: ready ? 'var(--success-text)' : 'var(--warning-text)' }}>{ready ? '●' : '○'}</span>
                      {t.name || t.type_key}
                    </button>
                  );
                };

                const sectionStyle = { gridColumn: '1 / -1', marginTop: 8, padding: 12, background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 8 };
                const renderSection = (label, types, helperText, customInputId) => (
                  <div style={sectionStyle}>
                    <label style={{ ...S.fLabel, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>{label}</label>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{helperText}</div>
                    {types.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', padding: '4px 0' }}>
                        No types defined for this category yet — make them in Assets → Lala's Phone or Overlays, or add a custom name below.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {types.map(t => <ToggleChip key={t.id || t.type_key || t.name} t={t} />)}
                      </div>
                    )}
                    <input
                      type="text"
                      id={customInputId}
                      placeholder="Add custom name (Enter or comma) — e.g. CountdownTimer, SponsorBug"
                      onKeyDown={e => {
                        if (e.key !== 'Enter' && e.key !== ',') return;
                        e.preventDefault();
                        const v = e.currentTarget.value.trim().replace(/,$/, '');
                        if (!v) return;
                        setEventForm(p => {
                          const existing = p.required_ui_overlays || [];
                          if (existing.includes(v)) return p;
                          return { ...p, required_ui_overlays: [...existing, v] };
                        });
                        e.currentTarget.value = '';
                      }}
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
                    />
                  </div>
                );

                return (
                  <>
                    <div style={{ gridColumn: '1 / -1', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>📺 Required UI Overlays</div>
                      <button
                        type="button"
                        onClick={autoSuggest}
                        title="Replace selection with sensible defaults based on this event's type + prestige"
                        style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, borderRadius: 6, border: '1px solid var(--lala-gold-line)', background: 'var(--lala-gold-soft)', color: 'var(--lala-gold-text)', cursor: 'pointer', fontFamily: "'DM Mono', monospace" }}
                      >
                        ✦ Auto-suggest
                      </button>
                    </div>
                    {renderSection(
                      '📱 Lala Phone Overlays',
                      phoneTypes,
                      'What Lala sees on her phone in-show. Auto-placed on the episode timeline at generation; ● = asset generated, ○ = type defined, no asset yet.',
                      'phone-overlay-custom'
                    )}
                    {renderSection(
                      '🎬 On-Screen UI Overlays',
                      uiTypes,
                      'On-screen production graphics — invitation cards, wardrobe checklists, stat panels. Same generator path; ● / ○ same as above.',
                      'ui-overlay-custom'
                    )}
                    {customs.length > 0 && (
                      <div style={{ gridColumn: '1 / -1', marginTop: 4, padding: '8px 12px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8 }}>
                        <div style={{ fontSize: 10, color: 'var(--warning-text)', fontFamily: "'DM Mono', monospace", marginBottom: 4, fontWeight: 700, letterSpacing: 0.4 }}>CUSTOM NAMES (no type defined yet)</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {customs.map((name, i) => (
                            <span key={`custom-${name}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--surface-card)', border: '1px solid var(--warning-border)', borderRadius: 4, fontSize: 11, color: 'var(--text-primary)', fontFamily: "'DM Mono', monospace" }}>
                              {name}
                              <button
                                type="button"
                                onClick={() => setEventForm(p => ({ ...p, required_ui_overlays: (p.required_ui_overlays || []).filter(n => n !== name) }))}
                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}
                                title="Remove"
                              >×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* ── Rewards & Requirements ────────────────────────────────────
                  Stat-delta rewards (coins/reputation/brand_trust/influence)
                  fund Lala's progression after success; the outcomes list
                  feeds the writer's narrative beats. Requirements are pre-
                  flight gates the next-event suggester reads (careerGoals.js
                  applies a -5 score penalty when reputation_min or
                  brand_trust_min isn't met). All numeric — leave at 0 to
                  skip that gate or reward. */}
              <div style={{ gridColumn: '1 / -1', marginTop: 8, padding: 12, background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 8 }}>
                <label style={{ ...S.fLabel, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>🏆 Rewards & Requirements</label>

                {/* Rewards row */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...S.fLabel, fontSize: 10, color: 'var(--success-text)', marginBottom: 6 }}>REWARDS — granted on success</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
                    {[
                      { key: 'coins', label: '🪙 Coins', placeholder: '500' },
                      { key: 'reputation', label: '⭐ Reputation', placeholder: '1' },
                      { key: 'brand_trust', label: '🤝 Brand Trust', placeholder: '1' },
                      { key: 'influence', label: '📣 Influence', placeholder: '1' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ ...S.fLabel, fontSize: 10 }}>{f.label}</label>
                        <input
                          type="number"
                          min={0}
                          value={eventForm.rewards?.[f.key] ?? 0}
                          onChange={e => setEventForm(p => ({
                            ...p,
                            rewards: { ...(p.rewards || {}), [f.key]: parseInt(e.target.value, 10) || 0 },
                          }))}
                          placeholder={f.placeholder}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                  </div>
                  <label style={{ ...S.fLabel, fontSize: 10 }}>Narrative outcomes (one per line)</label>
                  <textarea
                    value={Array.isArray(eventForm.rewards?.outcomes) ? eventForm.rewards.outcomes.join('\n') : ''}
                    onChange={e => setEventForm(p => ({
                      ...p,
                      rewards: {
                        ...(p.rewards || {}),
                        outcomes: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                      },
                    }))}
                    placeholder={'One per line — what unlocks narratively.\nExample:\nLala lands on the Maison Belle radar\nFirst paid styling gig confirmed'}
                    rows={2}
                    style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>

                {/* Requirements row */}
                <div>
                  <div style={{ ...S.fLabel, fontSize: 10, color: 'var(--danger)', marginBottom: 6 }}>REQUIREMENTS — gates that dock score when unmet</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { key: 'reputation_min', label: '⭐ Reputation min', placeholder: '3' },
                      { key: 'brand_trust_min', label: '🤝 Brand Trust min', placeholder: '2' },
                      { key: 'coins_min', label: '🪙 Coins min', placeholder: '100' },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ ...S.fLabel, fontSize: 10 }}>{f.label}</label>
                        <input
                          type="number"
                          min={0}
                          value={eventForm.requirements?.[f.key] ?? 0}
                          onChange={e => setEventForm(p => ({
                            ...p,
                            requirements: { ...(p.requirements || {}), [f.key]: parseInt(e.target.value, 10) || 0 },
                          }))}
                          placeholder={f.placeholder}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <FG label="Description" value={eventForm.description} onChange={v => setEventForm(p => ({ ...p, description: v }))} placeholder="Full event description..." textarea full />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button onClick={() => setEditingEvent(null)} style={S.secBtn}>Cancel</button>
                <button onClick={saveEvent} disabled={savingEvent || !eventForm.name} style={S.primaryBtn}>
                  {savingEvent ? '⏳...' : editingEvent === 'new' ? '✨ Create' : '💾 Save'}
                </button>
              </div>
            </div>
  );
}

// ─── Form Group helper ───
function FG({ label, value, onChange, placeholder, type = 'text', textarea, full, min, max, disabled }) {
  const style = { marginBottom: full ? 10 : 0 };
  return (
    <div style={style}>
      <label style={S.fLabel}>{label}</label>
      {textarea ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...S.tArea, opacity: disabled ? 0.5 : 1 }} rows={2} placeholder={placeholder} disabled={disabled} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...S.inp, opacity: disabled ? 0.5 : 1 }} placeholder={placeholder} min={min} max={max} disabled={disabled} />
      )}
    </div>
  );
}
