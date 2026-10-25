/**
 * An event's "Edit details" modal: every field saved on blur through the
 * versioned save queue (Task #1786, #1788), the financial preview, the
 * overlays, the episode link, Decline / Mark Ready / Complete Episode.
 * Moved unchanged from Producer Mode's Events tab with the library
 * (2026-10-25); EventLibrary opens it (a card's "Edit details", an Ideas
 * template, or ?event=<id>).
 */
import api from '../../services/api';
import { S, EVENT_TYPE_ICONS } from './producerStyles';
import { seasonPageHref } from '../../lib/seasonPage';
import { InvitationButton, InvitationStyleFields } from '../../pages/InvitationGenerator';
import OverlayApprovalPanel from '../OverlayApprovalPanel';
import OpenInSceneSets from '../OpenInSceneSets';
import { EventInvitePreview } from '../../pages/feed/FeedEnhancements';
import { hydrateEventForModal, sameEditorValue, changedFields, missingForMarkReady, withoutOrganizerKeys } from '../../utils/eventEditorChanges';
import { createEventSaveQueue, isStaleSaveError, saveErrorMessage } from '../../utils/eventSaveVersion';
import { completeMoneyWarning } from '../../utils/moneyWarnings';
import { calcDifficulty, difficultyLabel, MODAL_SAVEABLE_FIELDS } from '../../lib/eventLibrary';

export default function EventDetailsModal({ lib }) {
  const {
    aiRevising, createVenueSceneSet, deleteEvent, episodes, eventDetailModal, eventFinancials, eventFinancialsLoading, eventModalQueueRef, eventModalStoredRef, financeConfig, injectEvent, injectSuccess, injecting, loadData, reconnecting, retrySceneSetLink, sceneSetReconnect, sceneSets, setAiRevising, setError, setEventDetailModal, setOutfitPickerEvent, setToast, setWorldEvents, showId, worldEvents,
  } = lib;
            // Hydrate missing fields from automation data + derive from
            // context (hydrateEventForModal, utils/eventEditorChanges.js —
            // the same values as before, now with where each came from).
            // What the modal shows is unchanged; what it saves is not
            // (Task #1786): every save sends only the fields whose value
            // differs from what the modal opened with.
            //
            // eventModalStoredRef holds the stored row as the modal opened
            // it, plus every change this modal has since saved. Its
            // hydration is the "opened with" baseline, so a field left as
            // shown — including a value invented at render — is never sent.
            if (eventModalStoredRef.current?.id !== eventDetailModal.id) {
              eventModalStoredRef.current = { ...eventDetailModal };
              eventModalQueueRef.current = createEventSaveQueue((url, body) => api.put(url, body), {
                getBase: () => eventModalStoredRef.current,
              });
              eventModalQueueRef.current.setVersion(eventDetailModal.updated_at);
            }
            const stored = eventModalStoredRef.current;
            const baseline = hydrateEventForModal(stored).values;
            const md = hydrateEventForModal(eventDetailModal).values;
            const auto = eventDetailModal.canon_consequences?.automation || {};
            const recordSaved = (fields) => {
              eventModalStoredRef.current = { ...eventModalStoredRef.current, ...fields };
            };
            // Every save from this modal: versioned and in order. A save
            // refused because the event changed elsewhere refreshes the
            // Events list, so closing and reopening shows the latest.
            const modalSave = async (body) => {
              try {
                return await eventModalQueueRef.current.save(`/api/v1/world/${showId}/events/${md.id}`, body);
              } catch (err) {
                if (isStaleSaveError(err)) loadData();
                throw err;
              }
            };
            const updateField = async (field, value) => {
              // A blur or change that leaves the value as opened sends
              // nothing, so focusing a field showing an invented value and
              // leaving it cannot save that value.
              if (sameEditorValue(value, baseline[field])) {
                setEventDetailModal(prev => prev ? { ...prev, [field]: value } : prev);
                return;
              }
              try {
                const res = await modalSave({ [field]: value });
                if (res.data.success && res.data.event) {
                  recordSaved({ [field]: value });
                  setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, ...res.data.event } : ev));
                  // Update modal but preserve any local edits by merging
                  setEventDetailModal(prev => prev ? { ...prev, [field]: value } : prev);
                }
              } catch (err) {
                console.warn(`[Event] Failed to save ${field}:`, err.response?.data?.error || err.message);
                setError(isStaleSaveError(err) ? `${saveErrorMessage(err)} Close this editor and reopen the event.` : (err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save event field'));
              }
            };
            const updateMultipleFields = async (fields) => {
              const changed = changedFields(baseline, fields, Object.keys(fields));
              if (Object.keys(changed).length === 0) return;
              try {
                const res = await modalSave(changed);
                if (res.data.success) {
                  recordSaved(changed);
                  const updated = res.data.event;
                  setWorldEvents(prev => prev.map(ev => ev.id === md.id ? updated : ev));
                  setEventDetailModal(updated);
                }
              } catch (err) {
                console.warn('[Event] Batch save failed:', err.response?.data?.error || err.message);
                setError(isStaleSaveError(err) ? `${saveErrorMessage(err)} Close this editor and reopen the event.` : (err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save event field'));
              }
            };
            const linkedScene = md.scene_set_id ? sceneSets.find(s => s.id === md.scene_set_id) : null;
            const hasInvalidSceneLink = Boolean(md.scene_set_id) && !linkedScene;
            const diff = calcDifficulty(md);
            const dl = difficultyLabel(diff);
            return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEventDetailModal(null)}>
              <div style={{ background: 'var(--surface-card)', borderRadius: 16, width: '90vw', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                {/* Location banner */}
                {linkedScene?.base_still_url && (
                  <div style={{ height: 140, overflow: 'hidden', position: 'relative', borderRadius: '16px 16px 0 0' }}>
                    {linkedScene.video_clip_url ? (
                      <video src={linkedScene.video_clip_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay loop muted playsInline />
                    ) : (
                      <img src={linkedScene.base_still_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 11, fontWeight: 700, color: 'var(--text-inverse)', background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: 6 }}>
                      📍 {linkedScene.name} {linkedScene.video_clip_url && '🎬'}
                    </div>
                    <button onClick={() => updateField('scene_set_id', null)} style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 9, color: 'var(--text-inverse)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Change</button>
                  </div>
                )}

                {/* Header — editable name */}
                <div style={{ padding: '16px 24px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <select value={md.event_type} onChange={e => updateField('event_type', e.target.value)} style={{ fontSize: 20, border: 'none', background: 'none', cursor: 'pointer' }}>
                    {Object.entries(EVENT_TYPE_ICONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input value={md.name} onChange={e => setEventDetailModal({ ...md, name: e.target.value })} onBlur={e => updateField('name', e.target.value)}
                    style={{ flex: 1, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', border: 'none', borderBottom: '1px dashed var(--lala-parchment-3)', outline: 'none', padding: '2px 0' }} />
                  <span style={S.statusPill(md.status)}>{md.status}</span>
                  <button onClick={() => setEventDetailModal(null)} style={{ background: 'var(--lala-parchment-2)', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>

                {/* Editable fields grid */}
                <div style={{ padding: '8px 24px 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                    <div><label style={S.fLabel}>Host</label><input value={md.host || ''} onChange={e => setEventDetailModal({ ...md, host: e.target.value })} onBlur={e => updateField('host', e.target.value)} style={S.sel} /></div>
                    <div><label style={S.fLabel}>Brand</label><input value={md.host_brand || ''} onChange={e => setEventDetailModal({ ...md, host_brand: e.target.value })} onBlur={e => updateField('host_brand', e.target.value)} style={S.sel} /></div>
                    <div><label style={S.fLabel}>Dress Code</label><input value={md.dress_code || ''} onChange={e => setEventDetailModal({ ...md, dress_code: e.target.value })} onBlur={e => updateField('dress_code', e.target.value)} style={S.sel} /></div>
                  </div>

                  {/* Venue & Date */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div><label style={S.fLabel}>Venue Name</label><input value={md.venue_name || ''} onChange={e => setEventDetailModal({ ...md, venue_name: e.target.value })} onBlur={e => updateField('venue_name', e.target.value)} placeholder="The Velvet Room, SoHo Loft..." style={S.sel} /></div>
                    <div><label style={S.fLabel}>Venue Address</label><input value={md.venue_address || ''} onChange={e => setEventDetailModal({ ...md, venue_address: e.target.value })} onBlur={e => updateField('venue_address', e.target.value)} placeholder="123 Fashion Ave, Lower East Side" style={S.sel} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div><label style={S.fLabel}>Event Date</label><input type="date" value={md.event_date || ''} onChange={e => { setEventDetailModal({ ...md, event_date: e.target.value }); updateField('event_date', e.target.value); }} style={S.sel} /></div>
                    <div><label style={S.fLabel}>Event Time</label><input type="time" value={md.event_time || ''} onChange={e => { setEventDetailModal({ ...md, event_time: e.target.value }); updateField('event_time', e.target.value); }} style={S.sel} /></div>
                  </div>

                  {/* Guest List */}
                  {(() => {
                    const automation = md.canon_consequences?.automation;
                    const guests = automation?.guest_profiles || [];
                    return guests.length > 0 ? (
                      <div style={{ marginBottom: 12 }}>
                        <label style={S.fLabel}>Guest List ({guests.length})</label>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {guests.map((g, i) => (
                            <span key={i} style={{ padding: '3px 8px', background: 'var(--lala-parchment-2)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {g.display_name || g.handle}
                              <span style={{ fontSize: 9, color: 'var(--text-secondary)', marginLeft: 4 }}>{g.relationship || ''}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                    <div><label style={S.fLabel}>Prestige</label><input type="number" min={1} max={10} value={md.prestige} onChange={e => { setEventDetailModal({ ...md, prestige: parseInt(e.target.value) || 5 }); }} onBlur={e => updateField('prestige', parseInt(e.target.value) || 5)} style={S.sel} /></div>
                    <div><label style={S.fLabel}>{md.deal_type ? 'Difficulty' : 'Cost 🪙'}</label><input type="number" min={0} value={md.cost_coins} onChange={e => { setEventDetailModal({ ...md, cost_coins: parseInt(e.target.value) || 0 }); }} onBlur={e => updateField('cost_coins', parseInt(e.target.value) || 0)} style={S.sel} /></div>
                    <div><label style={S.fLabel}>Strictness</label><input type="number" min={1} max={10} value={md.strictness} onChange={e => { setEventDetailModal({ ...md, strictness: parseInt(e.target.value) || 5 }); }} onBlur={e => updateField('strictness', parseInt(e.target.value) || 5)} style={S.sel} /></div>
                    <div><label style={S.fLabel}>Deadline</label><select value={md.deadline_type} onChange={e => updateField('deadline_type', e.target.value)} style={S.sel}>{['none','low','medium','high','tonight','urgent'].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div><label style={S.fLabel}>Career Tier</label><input type="number" min={1} max={5} value={md.career_tier || 1} onChange={e => { setEventDetailModal({ ...md, career_tier: parseInt(e.target.value) || 1 }); }} onBlur={e => updateField('career_tier', parseInt(e.target.value) || 1)} style={S.sel} /></div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={S.fLabel}>Location (Scene Set)</label>
                      {linkedScene && (
                          <div style={{ background: 'var(--success-bg)', borderRadius: 8, border: '1px solid var(--success-border)', marginBottom: 6, overflow: 'hidden' }}>
                            {linkedScene.base_still_url && (
                              <div style={{ position: 'relative' }}>
                                {linkedScene.video_clip_url ? (
                                  <video src={linkedScene.video_clip_url} style={{ width: '100%', height: 80, objectFit: 'cover' }} autoPlay loop muted playsInline />
                                ) : (
                                  <img src={linkedScene.base_still_url} alt={linkedScene.name} style={{ width: '100%', height: 80, objectFit: 'cover' }} />
                                )}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--success-text)' }}>✓ {linkedScene.name}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{linkedScene.scene_type?.replace(/_/g, ' ')}</div>
                              </div>
                              {linkedScene.video_clip_url && (
                                <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--info-bg)', color: 'var(--info-text)' }}>🎬 Video</span>
                              )}
                              <button onClick={() => updateField('scene_set_id', null)} style={{ ...S.smBtn, fontSize: 10, padding: '2px 8px' }}>✕ Remove</button>
                            </div>
                            {/* S8: its images are made in Scene Sets. */}
                            <div style={{ padding: '0 10px 8px' }}>
                              {!linkedScene.base_still_url && (
                                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>No image yet: make its base in Scene Sets.</div>
                              )}
                              <OpenInSceneSets showId={showId} setId={linkedScene.id} fromLabel="the event"
                                from={seasonPageHref(showId, 'events', { event: md.id })}
                                testId="event-editor-open-scene-sets" className="wa-open-scene-sets" />
                            </div>
                          </div>
                      )}
                      {hasInvalidSceneLink && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--warning-bg)', borderRadius: 8, border: '1px solid var(--warning-border)', marginBottom: 6 }}>
                          <div style={{ flex: 1, fontSize: 11, color: 'var(--warning-text)' }}>
                            This event is linked to a scene set that no longer exists. Pick a new scene set below.
                          </div>
                          <button onClick={() => updateField('scene_set_id', null)} style={{ ...S.smBtn, fontSize: 10, padding: '2px 8px' }}>Clear</button>
                        </div>
                      )}
                      {(!md.scene_set_id || hasInvalidSceneLink) && sceneSets.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                          {sceneSets.map(ss => (
                            <button key={ss.id} onClick={() => updateField('scene_set_id', ss.id)} style={{
                              padding: 0, border: '2px solid var(--lala-parchment-3)', borderRadius: 8, background: 'var(--surface-card)',
                              cursor: 'pointer', overflow: 'hidden', textAlign: 'left', transition: 'border-color 0.12s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--lala-parchment-3)'}>
                              {ss.base_still_url ? (
                                <img src={ss.base_still_url} alt={ss.name} style={{ width: '100%', height: 60, objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: 60, background: 'var(--surface-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>📍</div>
                              )}
                              <div style={{ padding: '4px 6px' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ss.name}</div>
                                <div style={{ fontSize: 8, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{ss.scene_type?.replace(/_/g, ' ')}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {!md.scene_set_id && sceneSets.length === 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No scene sets yet. Create one for this venue below, or in Scene Sets.</div>
                      )}
                      {/* S8, answer 3: the venue's scene set, created and linked; its images are made in Scene Sets. */}
                      {!linkedScene && (
                        <button
                          onClick={async () => {
                            const set = await createVenueSceneSet(md);
                            if (set) {
                              await updateField('scene_set_id', set.id);
                              setToast(`“${set.name}” created and linked: make its images in Scene Sets`);
                            }
                          }}
                          style={{ marginTop: 6, width: '100%', padding: '8px 14px', borderRadius: 8, border: '1px dashed var(--primary)', background: 'var(--primary-subtle)', color: 'var(--primary-text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                        >
                          Create the scene set
                        </button>
                      )}
                    </div>
                    <div>
                      <label style={S.fLabel}>Payment</label>
                      <select value={md.is_free ? 'free' : md.is_paid ? 'paid' : 'costs'} onChange={e => {
                        const v = e.target.value;
                        const updates = { is_paid: v === 'paid', is_free: v === 'free' };
                        if (v === 'free') updates.cost_coins = 0;
                        setEventDetailModal({ ...md, ...updates });
                        updateField('is_paid', updates.is_paid);
                        updateField('is_free', updates.is_free);
                        if (v === 'free') updateField('cost_coins', 0);
                      }} style={S.sel}>
                        <option value="costs">Costs coins</option>
                        <option value="paid">💰 Lala gets paid</option>
                        <option value="free">🎟️ Free entry</option>
                      </select>
                    </div>
                  </div>
                  {md.is_paid && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={S.fLabel}>Payment Amount (coins)</label>
                      <input type="number" min={0} value={md.payment_amount || 0} onChange={e => setEventDetailModal({ ...md, payment_amount: parseInt(e.target.value) || 0 })} onBlur={e => updateField('payment_amount', parseInt(e.target.value) || 0)} style={{ ...S.sel, width: 120 }} />
                    </div>
                  )}

                  {/* Difficulty badge + AI Enhance */}
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ padding: '3px 10px', background: dl.bg, color: dl.color, borderRadius: 6, fontSize: 11, fontWeight: 700 }}>🎯 Difficulty: {diff} {dl.text}</span>
                    <button onClick={async () => {
                      setAiRevising(true);
                      try {
                        const emptyFields = [];
                        if (!md.host) emptyFields.push('host');
                        if (!md.host_brand) emptyFields.push('host_brand');
                        if (!md.description) emptyFields.push('description');
                        if (!md.narrative_stakes) emptyFields.push('narrative_stakes');
                        if (!md.career_milestone) emptyFields.push('career_milestone');
                        if (!md.fail_consequence) emptyFields.push('fail_consequence');
                        if (!md.success_unlock) emptyFields.push('success_unlock');
                        if (!md.location_hint) emptyFields.push('location_hint');
                        if (!md.venue_name) emptyFields.push('venue_name');
                        if (!md.venue_address) emptyFields.push('venue_address');
                        if (!md.dress_code) emptyFields.push('dress_code');
                        if (!(md.dress_code_keywords?.length > 0)) emptyFields.push('dress_code_keywords');

                        const res = await api.post(`/api/v1/world/${showId}/events/ai-fix`, {
                          warnings: [{ msg: `ENHANCE: Fill in ALL missing fields for this event.

Event: "${md.name}" (${md.event_type}, prestige ${md.prestige})
Brand: "${md.host_brand || 'not set'}"
Host: "${md.host || 'EMPTY — MUST FILL THIS'}"
Venue: "${md.venue_name || 'not set'}"

IMPORTANT: The "host" field is the person or organization hosting this event. It MUST be filled.
IMPORTANT: "venue_address" should be a specific fictional street address like "47 Rue de Rivoli, Le Marais" or "221 West 4th Street, SoHo". Not generic.
IMPORTANT: "dress_code" should be specific like "cocktail chic", "black tie optional", "streetwear elevated". Not generic.

Current values:
- host="${md.host || ''}" ${!md.host ? '← EMPTY, MUST FILL' : ''}
- host_brand="${md.host_brand || ''}"
- venue_name="${md.venue_name || ''}"
- venue_address="${md.venue_address || ''}" ${!md.venue_address ? '← EMPTY, MUST FILL with specific street address' : ''}
- dress_code="${md.dress_code || ''}" ${!md.dress_code ? '← EMPTY, MUST FILL' : ''}
- narrative_stakes="${md.narrative_stakes || ''}"
- career_milestone="${md.career_milestone || ''}"
- description="${md.description || ''}"
- fail_consequence="${md.fail_consequence || ''}"
- success_unlock="${md.success_unlock || ''}"
- location_hint="${md.location_hint || ''}"

Empty fields to fill: ${emptyFields.join(', ') || 'none'}.

${md.narrative_stakes ? `Keep and expand: "${md.narrative_stakes}"` : 'Write compelling narrative stakes.'}

Return action "enhance" with new_value as a JSON object containing ALL fields listed above. MUST include "host", "venue_address", and "dress_code".` }],
                          events: worldEvents.slice(0, 10),
                          episodes,
                        });

                        const suggestions = res.data?.data || [];
                        if (suggestions.length > 0 && suggestions[0].new_value) {
                          let data = suggestions[0].new_value;
                          if (typeof data === 'string') try { data = JSON.parse(data); } catch { data = {}; }
                          if (typeof data === 'object') {
                            const merged = { ...md };
                            // The organizer is never filled from AI output
                            // (Task #1786): host, host_brand and
                            // source_profile_id are skipped here, and the
                            // old host fallback (`${host_brand} Events`, or
                            // the name before "—") is gone. The organizer is
                            // chosen in the Event Package.
                            for (const [key, val] of Object.entries(withoutOrganizerKeys(data))) {
                              // Fill any empty/null/undefined field
                              const current = md[key];
                              const isEmpty = current === null || current === undefined || current === '' || (Array.isArray(current) && current.length === 0);
                              if (val && isEmpty) {
                                merged[key] = val;
                              }
                            }
                            // Always update these if AI provided richer versions
                            if (data.description && (!md.description || data.description.length > md.description.length)) merged.description = data.description;
                            if (data.narrative_stakes && (!md.narrative_stakes || data.narrative_stakes.length > md.narrative_stakes.length)) merged.narrative_stakes = data.narrative_stakes;
                            setEventDetailModal(merged);
                            // Batch save, in one PUT, only the fields the AI
                            // changed from what the modal opened with —
                            // never an organizer field, never a value the
                            // modal invented and the AI left alone.
                            const saveable = ['name','event_type','description','prestige','cost_coins','strictness','deadline_type','dress_code','dress_code_keywords','location_hint','narrative_stakes','career_milestone','career_tier','fail_consequence','success_unlock','is_paid','is_free','payment_amount','browse_pool_bias','venue_name','venue_address','event_date','event_time'];
                            const toSave = withoutOrganizerKeys(changedFields(baseline, merged, saveable));
                            let lockedMsg = null;
                            if (Object.keys(toSave).length > 0) {
                              try {
                                const res = await modalSave(toSave);
                                if (res.data.success) {
                                  recordSaved(toSave);
                                  // The list keeps the server's row only — not
                                  // the modal's hydrated copy, whose invented
                                  // values would otherwise look stored.
                                  const serverData = res.data.event || {};
                                  setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, ...serverData } : ev));
                                }
                              } catch (err) {
                                // A refusal is not retried field by field: the
                                // event changed elsewhere (Task #1788).
                                if (isStaleSaveError(err)) {
                                  setToast(`${saveErrorMessage(err)} Close this editor and reopen the event.`);
                                  setTimeout(() => setToast(null), 6000);
                                  return;
                                }
                                // If batch fails (e.g. missing column), try saving fields one by one
                                console.warn('[Event] Batch save failed, trying individual:', err.response?.data?.error);
                                for (const [key, val] of Object.entries(toSave)) {
                                  try {
                                    await modalSave({ [key]: val });
                                    recordSaved({ [key]: val });
                                  } catch (e2) {
                                    console.warn(`[Event] Skip ${key}:`, e2.response?.data?.error || e2.message);
                                    // The terms lock (§8(x) D4) is said, not skipped silently.
                                    if (e2.response?.data?.code === 'EVENT_TERMS_LOCKED') lockedMsg = e2.response.data.error;
                                  }
                                }
                              }
                            }
                            setToast(lockedMsg ? `✨ Enhanced — but not saved: ${lockedMsg}` : '✨ Enhanced — review the filled fields');
                            setTimeout(() => setToast(null), lockedMsg ? 6000 : 3000);
                          }
                        }
                      } catch (err) {
                        setToast(err.response?.data?.error || 'Enhance failed');
                        setTimeout(() => setToast(null), 3000);
                      } finally { setAiRevising(false); }
                    }} disabled={aiRevising} style={{
                      padding: '4px 14px', background: aiRevising ? 'var(--lala-parchment-2)' : 'var(--primary)',
                      color: aiRevising ? 'var(--text-faint)' : 'var(--text-inverse)', border: 'none', borderRadius: 8,
                      fontSize: 11, fontWeight: 700, cursor: aiRevising ? 'wait' : 'pointer',
                    }}>
                      {aiRevising ? '⏳ Enhancing...' : '✨ AI Enhance'}
                    </button>
                  </div>

                  {/* Keywords */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={S.fLabel}>Dress Code Keywords</label>
                    <input value={(md.dress_code_keywords || []).join(', ')} onChange={e => setEventDetailModal({ ...md, dress_code_keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) })}
                      onBlur={e => updateField('dress_code_keywords', e.target.value.split(',').map(k => k.trim()).filter(Boolean))} placeholder="romantic, garden, floral" style={S.sel} />
                    {(md.dress_code_keywords || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {md.dress_code_keywords.map((kw, i) => <span key={i} style={{ padding: '2px 8px', background: 'var(--primary-subtle)', border: '1px solid var(--primary-light)', borderRadius: 6, fontSize: 10, color: 'var(--primary-text)', fontWeight: 600 }}>{kw}</span>)}
                      </div>
                    )}
                  </div>

                  {/* Invite Preview — phone notification mockup */}
                  <div style={{ borderTop: '1px solid var(--lala-parchment-2)', paddingTop: 14, marginTop: 8, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Invite Preview</div>
                    <EventInvitePreview event={md} />
                  </div>

                  {/* Invitation Style */}
                  <InvitationStyleFields
                    formData={md}
                    setFormData={fn => {
                      const updated = typeof fn === 'function' ? fn(md) : fn;
                      setEventDetailModal(updated);
                      const invFields = {};
                      for (const k of ['theme', 'mood', 'color_palette', 'floral_style', 'border_style']) {
                        if (updated[k] !== md[k]) invFields[k] = updated[k];
                      }
                      if (Object.keys(invFields).length > 0) updateMultipleFields(invFields);
                    }}
                  />

                  {/* Generate invitation button in detail modal */}
                  <div style={{ marginTop: 8, marginBottom: 12 }}>
                    <InvitationButton event={md} showId={showId} onGenerated={(url, assetId) => {
                      setEventDetailModal(prev => prev ? { ...prev, invitation_url: url, invitation_asset_id: assetId } : prev);
                      loadData();
                    }} />
                  </div>

                  {/* Narrative fields */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={S.fLabel}>Narrative Stakes</label>
                    <textarea value={md.narrative_stakes || ''} onChange={e => setEventDetailModal({ ...md, narrative_stakes: e.target.value })} onBlur={e => updateField('narrative_stakes', e.target.value)} rows={2} placeholder="What this event means for Lala's arc..." style={{ ...S.sel, resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={S.fLabel}>Career Milestone</label>
                    <input value={md.career_milestone || ''} onChange={e => setEventDetailModal({ ...md, career_milestone: e.target.value })} onBlur={e => updateField('career_milestone', e.target.value)} placeholder="First brand collaboration..." style={S.sel} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={S.fLabel}>Location Hint</label>
                    <input value={md.location_hint || ''} onChange={e => setEventDetailModal({ ...md, location_hint: e.target.value })} onBlur={e => updateField('location_hint', e.target.value)} placeholder="Parisian rooftop, golden hour..." style={S.sel} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={S.fLabel}>Description</label>
                    <textarea value={md.description || ''} onChange={e => setEventDetailModal({ ...md, description: e.target.value })} onBlur={e => updateField('description', e.target.value)} rows={2} placeholder="Full event description..." style={{ ...S.sel, resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div><label style={S.fLabel}>Fail Consequence</label><input value={md.fail_consequence || ''} onChange={e => setEventDetailModal({ ...md, fail_consequence: e.target.value })} onBlur={e => updateField('fail_consequence', e.target.value)} placeholder="Reputation drops..." style={S.sel} /></div>
                    <div><label style={S.fLabel}>Success Unlock</label><input value={md.success_unlock || ''} onChange={e => setEventDetailModal({ ...md, success_unlock: e.target.value })} onBlur={e => updateField('success_unlock', e.target.value)} placeholder="Unlocks VIP access..." style={S.sel} /></div>
                  </div>

                  {/* Financial Preview — fetched from /financial-forecast.
                      Shows real outfit cost from the picked pieces, event
                      extras (drinks/valet/photo booth) scaled by prestige,
                      social-task rewards, and a "next goal" progress bar.
                      Falls back to a loading row while the fetch is in
                      flight, and a graceful "—" when the endpoint errored
                      (older env, missing columns). */}
                  {(() => {
                    const fc = eventFinancials;
                    const loading = eventFinancialsLoading && !fc;
                    const income = fc?.income?.total ?? 0;
                    const expenses = fc?.expenses?.total ?? 0;
                    const net = fc?.net ?? 0;
                    const aff = fc?.affordability || {};
                    const nextGoal = fc?.next_goal || financeConfig?.next_goal;
                    const currentBalance = financeConfig?.current_balance ?? 0;
                    const balanceAfter = aff.balance_after ?? currentBalance;
                    return (
                      <div style={{ borderTop: '1px solid var(--lala-parchment-2)', paddingTop: 14, marginTop: 8, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Financial Preview</div>
                          {loading && <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>calculating…</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 90, padding: '8px 10px', background: 'var(--success-bg)', borderRadius: 8, border: '1px solid var(--success-border)' }}>
                            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: 'var(--success-text)' }}>Income (coins)</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--success-text)' }}>{income.toLocaleString()}</div>
                            {fc?.income?.event_payment > 0 && <div style={{ fontSize: 9, color: 'var(--success-text)' }}>Payment: {fc.income.event_payment}</div>}
                            {fc?.income?.content_revenue_est > 0 && <div style={{ fontSize: 9, color: 'var(--success-text)' }}>Content est: +{fc.income.content_revenue_est}</div>}
                            {/* A deal's payouts (deal build PR 5): components at Complete, content fees on approval. */}
                            {fc?.income?.deal_components > 0 && <div style={{ fontSize: 9, color: 'var(--success-text)' }}>Deal fees: {fc.income.deal_components}</div>}
                            {fc?.income?.content_fees > 0 && <div style={{ fontSize: 9, color: 'var(--success-text)' }}>Content fees: +{fc.income.content_fees}</div>}
                          </div>
                          <div style={{ flex: 1, minWidth: 90, padding: '8px 10px', background: 'var(--danger-bg)', borderRadius: 8, border: '1px solid var(--danger-border)' }}>
                            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: 'var(--danger-text)' }}>Expenses (coins)</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--danger-text)' }}>{expenses.toLocaleString()}</div>
                            {fc?.expenses?.event_cost > 0 && <div style={{ fontSize: 9, color: 'var(--danger-text)' }}>Event: {fc.expenses.event_cost}</div>}
                            {fc?.expenses?.outfit_retail > 0 && <div style={{ fontSize: 9, color: 'var(--danger-text)' }}>Outfit ({fc.outfit_source === 'actual' ? `${fc.outfit_piece_count} pieces` : 'est'}): {fc.expenses.outfit_retail}</div>}
                            {fc?.expenses?.outfit_rentals > 0 && <div style={{ fontSize: 9, color: 'var(--danger-text)' }}>Rentals: +{fc.expenses.outfit_rentals}</div>}
                            {(fc?.expenses?.drinks_est || fc?.expenses?.valet_est || fc?.expenses?.photo_booth_est) ? (
                              <div style={{ fontSize: 9, color: 'var(--danger-text)' }}>
                                Extras: {[
                                  fc.expenses.drinks_est && `drinks ${fc.expenses.drinks_est}`,
                                  fc.expenses.valet_est && `valet ${fc.expenses.valet_est}`,
                                  fc.expenses.photo_booth_est && `photo ${fc.expenses.photo_booth_est}`,
                                ].filter(Boolean).join(', ')}
                              </div>
                            ) : null}
                            {/* A deal event's itemised costs (Task #2365): Lala's
                                rows count, comped rows are listed but never. */}
                            {fc?.expenses?.itemised?.costs?.length > 0 && (
                              <div style={{ fontSize: 9, color: 'var(--danger-text)' }} data-testid="forecast-itemised">
                                Costs: {fc.expenses.itemised.lala_total}
                                {fc.expenses.itemised.comped_total > 0 ? ` (comped ${fc.expenses.itemised.comped_total})` : ''}
                              </div>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 90, padding: '8px 10px', background: net >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)', borderRadius: 8, border: `1px solid ${net >= 0 ? 'var(--success-border)' : 'var(--danger-border)'}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: net >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>Net P&L (baseline)</span>
                              {/* EST pill — shown when outfit cost is a
                                  prestige-tier fallback (no outfit picked) so
                                  the bottom-line balance reads as projection,
                                  not fact. Hides once an outfit is saved. */}
                              {fc?.outfit_source === 'estimate' && (
                                <span title="Outfit cost is a prestige-based estimate. Pick an outfit to lock the real number." style={{ padding: '0 4px', borderRadius: 3, fontSize: 7, fontWeight: 700, fontFamily: "'DM Mono', monospace", letterSpacing: 0.4, background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' }}>EST</span>
                              )}
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: net >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>{net >= 0 ? '+' : ''}{net.toLocaleString()}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
                              {aff.balance_before != null
                                ? `${aff.balance_before.toLocaleString()} → ${balanceAfter.toLocaleString()}`
                                : (net >= 0 ? 'Profitable' : 'Costs more than earns')}
                            </div>
                          </div>
                        </div>
                        {/* Tier-dependent income — only a deal's contractual
                            bonus (bonus_terms), paid at Complete for the tier
                            it names. The generic tier reward, paid bonus and
                            event reward are retired (Q12; deal build PR 5), so
                            this row shows only when the deal contains a bonus. */}
                        {fc?.tier_bonuses && (fc.tier_bonuses.slay.total !== 0 || fc.tier_bonuses.pass.total !== 0) && (
                          <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8 }}>
                            <div style={{ fontSize: 8, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: 'var(--warning-text)', marginBottom: 4 }}>
                              On Complete (tier-dependent)
                            </div>
                            {[
                              { tier: 'slay', label: '👑 If SLAY', bonus: fc.tier_bonuses.slay, projected: fc.projected_balance?.if_slay },
                              { tier: 'pass', label: '✨ If PASS', bonus: fc.tier_bonuses.pass, projected: fc.projected_balance?.if_pass },
                            ].map(row => {
                              const parts = [];
                              if (row.bonus.deal_bonus > 0) parts.push(`deal bonus +${row.bonus.deal_bonus}`);
                              return (
                                <div key={row.tier} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, color: 'var(--warning-text)', marginBottom: 2 }}>
                                  <span>{row.label} <span style={{ fontSize: 9, color: 'var(--warning-text)' }}>· {parts.join(', ')}</span></span>
                                  <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
                                    +{row.bonus.total} → balance {row.projected != null ? row.projected.toLocaleString() : '—'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {/* Milestones progress — "next goal" bar + reward preview. */}
                        {nextGoal && (
                          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning-text)' }}>
                                Next: {nextGoal.label}
                                {nextGoal.episode_id && (
                                  <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 500, color: 'var(--warning-text)' }}>
                                    · ep-scoped
                                  </span>
                                )}
                              </span>
                              <span style={{ fontSize: 10, color: 'var(--warning-text)', fontFamily: "'DM Mono', monospace" }}>
                                {balanceAfter.toLocaleString()} / {Number(nextGoal.threshold).toLocaleString()} coins
                              </span>
                            </div>
                            <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                width: `${Math.max(0, Math.min(100, (balanceAfter / Number(nextGoal.threshold)) * 100))}%`,
                                height: '100%',
                                background: balanceAfter >= Number(nextGoal.threshold) ? 'var(--success)' : 'var(--lala-gold)',
                                transition: 'width 0.3s',
                              }} />
                            </div>
                            {nextGoal.reward_coins > 0 && (() => {
                              // Goal descriptions sometimes have a baked-in
                              // "Current balance is N coins" sentence from
                              // when the goal was created. That number is
                              // a snapshot, not live, and reads as wrong
                              // the moment the actual balance moves. Strip
                              // it so the description doesn't argue with
                              // the balance shown two lines above.
                              const cleanDesc = String(nextGoal.description || '')
                                .replace(/\s*Current balance is [-\d,]+\s*coins?\.?/gi, '')
                                .trim();
                              return (
                                <div style={{ fontSize: 10, color: 'var(--warning-text)', marginTop: 3 }}>
                                  🎁 Reward on reach: +{Number(nextGoal.reward_coins).toLocaleString()} coins{cleanDesc ? ` — ${cleanDesc}` : ''}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 6 }}>
                          {fc ? `From ${fc.outfit_source === 'actual' ? 'picked outfit' : 'prestige estimate'} + event extras. Refreshes when outfit changes.` : 'Loading forecast…'}
                        </div>
                        {/* Finalize Financials button — executes real transactions */}
                        {md.used_in_episode_id && (
                          <button
                            onClick={async (e) => {
                              const btn = e.target;
                              btn.disabled = true;
                              btn.textContent = 'Finalizing...';
                              try {
                                const res = await api.post(`/api/v1/world/${showId}/episodes/${md.used_in_episode_id}/finalize-financials`);
                                if (res.data.success) {
                                  const d = res.data.data;
                                  if (d.already_finalized) {
                                    setToast(`Already finalized — balance: ${d.balance}`);
                                  } else {
                                    setToast(`${d.transactions.length} transactions executed — balance: ${d.balance_after} coins (${d.summary.net_profit >= 0 ? '+' : ''}${d.summary.net_profit} net)`);
                                  }
                                }
                              } catch (err) {
                                setToast('Failed: ' + (err.response?.data?.error || err.message));
                              }
                              btn.disabled = false;
                              btn.textContent = 'Finalize Financials';
                            }}
                            style={{ marginTop: 8, width: '100%', padding: '8px 14px', borderRadius: 8, border: '1px solid var(--lala-gold)', background: 'var(--surface-bg)', color: 'var(--lala-gold-text)', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                          >
                            Finalize Financials
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* ═══ Overlay Command Center ═══ */}
                  {/* ═══ Overlay Command Center ═══ */}
                  <div style={{ borderTop: '2px solid var(--lala-parchment-2)', paddingTop: 14, marginTop: 12, marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>Episode Overlays</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setOutfitPickerEvent(md); }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--lala-gold-line)', background: 'var(--lala-gold-soft)', color: 'var(--lala-gold-text)', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>
                          👗 Pick Outfit
                        </button>
                      </div>
                    </div>

                    {/* Show-level overlays (always present) */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Show Overlays (always on)</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {['show_title', 'login_screen', 'phone_screen', 'icon_holder', 'cursor', 'exit_icon', 'minimize_icon'].map(id => (
                          <span key={id} style={{ padding: '2px 8px', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 6, fontSize: 9, fontWeight: 600 }}>
                            ✓ {id.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Episode-level overlays (selectable) */}
                    {(() => {
                      const episodeOverlays = [
                        { id: 'episode_title', name: 'Episode Title', icon: '🎬' },
                        { id: 'mail_panel', name: 'Mail Panel', icon: '💌' },
                        { id: 'wardrobe_list', name: 'Wardrobe List', icon: '👗' },
                        { id: 'closet_ui', name: 'Closet UI', icon: '🚪' },
                        { id: 'career_list', name: 'Career List', icon: '📋' },
                        { id: 'social_tasks', name: 'Social Tasks', icon: '📱' },
                        { id: 'stats_panel', name: 'Stats Panel', icon: '🪙' },
                      ];
                      // Parse current selections or auto-suggest
                      let selections = auto.required_ui_overlays || md.required_ui_overlays;
                      if (typeof selections === 'string') try { selections = JSON.parse(selections); } catch { selections = null; }
                      if (!Array.isArray(selections)) {
                        // Auto-suggest based on event type
                        selections = [];
                        const type = md.event_type || 'invite';
                        if (md.used_in_episode_id) selections.push('episode_title');
                        if (['invite', 'upgrade', 'brand_deal'].includes(type)) selections.push('mail_panel');
                        if ((md.prestige || 5) >= 4) selections.push('wardrobe_list', 'closet_ui');
                        if (['brand_deal', 'deliverable'].includes(type) || (md.prestige || 5) >= 6) selections.push('career_list');
                        if (auto.social_tasks?.length > 0) selections.push('social_tasks');
                        if (md.is_paid || (md.prestige || 5) >= 7) selections.push('stats_panel');
                      }

                      return (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Episode Overlays (select for this episode)</div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {episodeOverlays.map(o => {
                              const selected = selections.includes(o.id);
                              return (
                                <button key={o.id} onClick={async () => {
                                  const newSelections = selected ? selections.filter(s => s !== o.id) : [...selections, o.id];
                                  try {
                                    await api.put(`/api/v1/world/${showId}/events/${md.id}/overlay-selections`, { selected_overlays: newSelections });
                                    setEventDetailModal(prev => prev ? { ...prev, required_ui_overlays: newSelections } : prev);
                                    setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, required_ui_overlays: newSelections } : ev));
                                  } catch { /* non-blocking */ }
                                }} style={{
                                  padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                                  background: selected ? 'var(--primary-subtle)' : 'var(--lala-parchment-2)',
                                  color: selected ? 'var(--primary-text)' : 'var(--text-secondary)',
                                  border: `1px solid ${selected ? 'var(--primary-light)' : 'var(--lala-parchment-3)'}`,
                                }}>
                                  {o.icon} {o.name} {selected ? '✓' : ''}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Episode Title + Custom Overlay Actions */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                      {md.used_in_episode_id && (
                        <button onClick={async (e) => {
                          const btn = e.currentTarget;
                          btn.disabled = true; btn.textContent = '⏳ Generating...';
                          try {
                            const res = await api.post(`/api/v1/world/${showId}/episodes/${md.used_in_episode_id}/generate-title-overlay`);
                            if (res.data.success) setToast(`Title overlay: "${res.data.data.title}"`);
                          } catch (err) {
                            const status = err.response?.status;
                            const data = err.response?.data || {};
                            setToast('Failed: ' + (data.error || err.message));
                            // Stale link recovery — backend cleared the
                            // orphan used_in_episode_id; reload events so
                            // the now-detached row no longer shows this
                            // button on next render.
                            if (status === 404 && data.stale_link_cleared) loadData();
                          }
                          btn.disabled = false; btn.textContent = '🎬 Generate Episode Title';
                        }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--lala-gold)', background: 'var(--surface-bg)', color: 'var(--lala-gold-text)', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>
                          🎬 Generate Episode Title
                        </button>
                      )}
                      <button onClick={async () => {
                        const name = window.prompt('Custom overlay name (e.g., "Sponsor Logo", "Transition Card"):');
                        if (!name) return;
                        const prompt = window.prompt('Describe the overlay for AI generation:');
                        if (!prompt) return;
                        const scope = window.confirm('Is this a SHOW-level overlay (appears in every episode)?\n\nOK = Show level\nCancel = Episode level only') ? 'show' : 'episode';
                        const category = window.confirm('Is this a frame (large panel)?\n\nOK = Frame\nCancel = Icon') ? 'frame' : 'icon';
                        try {
                          const res = await api.post(`/api/v1/ui-overlays/${showId}/types`, {
                            name, prompt, category,
                            description: `Custom ${scope}-level ${category}: ${name}`,
                            beat: scope === 'show' ? 'Various' : 'Custom',
                          });
                          if (res.data.success) setToast(`Custom overlay "${name}" created — generate it in Assets → Lala's Phone`);
                        } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                      }} style={{ padding: '4px 12px', borderRadius: 6, border: '1px dashed var(--lala-ink-faint)', background: 'var(--surface-card)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>
                        + Add Custom Overlay
                      </button>
                    </div>
                  </div>

                  {/* Wardrobe Shopping List Overlay */}
                  <OverlayApprovalPanel
                    event={md}
                    showId={showId}
                    overlayType="wardrobe"
                    existingUrl={auto.wardrobe_overlay_url || null}
                    existingAssetId={auto.wardrobe_overlay_asset_id || null}
                    existingTasks={auto.wardrobe_tasks || []}
                    onGenerated={(url, assetId, tasks) => {
                      const newAuto = { ...auto, wardrobe_overlay_url: url, wardrobe_overlay_asset_id: assetId, wardrobe_tasks: tasks };
                      const updated = { ...eventDetailModal, canon_consequences: { ...eventDetailModal.canon_consequences, automation: newAuto } };
                      setEventDetailModal(updated);
                      setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, canon_consequences: updated.canon_consequences } : ev));
                    }}
                  />

                  {/* Social Tasks Overlay */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                    <button
                      onClick={async () => {
                        try {
                          setToast('Regenerating social tasks...');
                          const regen = await api.post(`/api/v1/world/${showId}/events/${md.id}/generate-social-checklist`, { force: true });
                          if (regen.data?.success) {
                            const tasks = regen.data?.data?.tasks || [];
                            const assetUrl = regen.data?.data?.assetUrl || auto.social_checklist_url || null;
                            const assetId = regen.data?.data?.assetId || auto.social_checklist_asset_id || null;
                            const newAuto = {
                              ...auto,
                              social_tasks: tasks,
                              social_checklist_url: assetUrl,
                              social_checklist_asset_id: assetId,
                            };
                            const updated = {
                              ...eventDetailModal,
                              canon_consequences: { ...eventDetailModal.canon_consequences, automation: newAuto },
                            };
                            setEventDetailModal(updated);
                            setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, canon_consequences: updated.canon_consequences } : ev));
                            // T5 (Task #2304): after Start Episode the tasks are saved to the episode's copy.
                            setToast(regen.data?.data?.savedTo === 'episode'
                              ? `Regenerated ${tasks.length} social tasks on the episode's task list`
                              : `Regenerated ${tasks.length} social tasks for this invite`);
                          }
                        } catch (err) {
                          setToast('Failed: ' + (err.response?.data?.error || err.message));
                        }
                      }}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--lala-gold-line)', background: 'var(--lala-gold-soft)', color: 'var(--lala-gold-text)', fontWeight: 600, fontSize: 10, cursor: 'pointer' }}
                    >
                      Regenerate Social Tasks
                    </button>
                  </div>
                  <OverlayApprovalPanel
                    event={md}
                    showId={showId}
                    overlayType="social"
                    existingUrl={auto.social_checklist_url || null}
                    existingAssetId={auto.social_checklist_asset_id || null}
                    existingTasks={auto.social_tasks || []}
                    onGenerated={(url, assetId, tasks) => {
                      const newAuto = { ...auto, social_checklist_url: url, social_checklist_asset_id: assetId, social_tasks: tasks };
                      const updated = { ...eventDetailModal, canon_consequences: { ...eventDetailModal.canon_consequences, automation: newAuto } };
                      setEventDetailModal(updated);
                      setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, canon_consequences: updated.canon_consequences } : ev));
                    }}
                  />

                  {/* Episode linking */}
                  <div style={{ borderTop: '1px solid var(--lala-parchment-2)', paddingTop: 14, marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Link to Episode</div>
                    {sceneSetReconnect?.eventId === md.id && (
                      <div data-testid="scene-set-reconnect" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', marginBottom: 6, background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8 }}>
                        <div style={{ flex: '1 1 180px', fontSize: 11, color: 'var(--warning-text)' }}>
                          <div style={{ fontWeight: 700 }}>
                            {sceneSetReconnect.status === 'choose' ? 'Event attached · Choose its scene set' : 'Event attached · Scene set needs reconnecting'}
                          </div>
                          {sceneSetReconnect.reason && <div style={{ marginTop: 2 }}>{sceneSetReconnect.reason}</div>}
                        </div>
                        {sceneSetReconnect.status === 'choose' ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
                            {(sceneSetReconnect.options || []).map((o) => (
                              <button key={o.id} data-testid={`scene-set-choice-${o.id}`} onClick={() => retrySceneSetLink(md.id, o.id)} disabled={reconnecting} style={{ ...S.smBtn, fontSize: 11, padding: '4px 10px' }}>
                                {o.name}{o.base_still_url ? '' : ' (no image yet)'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button onClick={() => retrySceneSetLink(md.id)} disabled={reconnecting} style={{ ...S.smBtn, fontSize: 11, padding: '4px 10px' }}>
                            {reconnecting ? 'Retrying…' : 'Retry'}
                          </button>
                        )}
                      </div>
                    )}
                    {injectSuccess?.eventId === md.id ? (
                      <div style={{ padding: 10, background: 'var(--success-bg)', borderRadius: 8, border: '2px solid var(--success)', textAlign: 'center', fontSize: 13, color: 'var(--success-text)', fontWeight: 700 }}>{injectSuccess.message}</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                        {episodes.map(ep => {
                          const isLinked = ep.id === md.used_in_episode_id;
                          return (
                            <button key={ep.id} onClick={() => injectEvent(md.id, ep.id)} disabled={injecting} style={{
                              textAlign: 'left', padding: '5px 8px',
                              background: isLinked ? 'var(--success-bg)' : 'var(--surface-card)',
                              border: isLinked ? '2px solid var(--success)' : '1px solid var(--lala-parchment-3)',
                              borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-primary)',
                            }}>
                              <div style={{ fontWeight: 600 }}>{ep.episode_number || '?'}. {(ep.title || '').slice(0, 14)}</div>
                              {isLinked && <div style={{ fontSize: 9, color: 'var(--success-text)' }}>✓ Linked</div>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '10px 24px', borderTop: '1px solid var(--lala-parchment-2)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button onClick={() => deleteEvent(md.id).then(() => setEventDetailModal(null))} style={S.smBtnDanger}>Delete</button>
                  {md.status === 'ready' && (
                    <button onClick={async () => {
                      const reason = window.prompt('Why is Lala declining? (e.g. "can\'t afford it", "schedule conflict", "not worth the drama")');
                      if (!reason) return;
                      try {
                        await api.post(`/api/v1/world/${showId}/events/${md.id}/decline`, { reason });
                        setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, status: 'declined' } : ev));
                        setEventDetailModal({ ...md, status: 'declined' });
                        setToast(`"${md.name}" declined — tracked for future callbacks`);
                      } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                    }} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid var(--warning)', background: 'var(--warning-bg)', color: 'var(--warning-text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                      Decline Invite
                    </button>
                  )}
                  {md.status === 'draft' && (
                    <button onClick={async () => {
                      // Validate required fields against what is stored
                      // (Task #1786): the row's own field or its saved
                      // automation copy, plus any edit made in this modal
                      // not yet saved. A value shown only because the modal
                      // invented it at render (the two-weeks-out date, the
                      // 'chic' dress code) counts as missing.
                      const pending = changedFields(baseline, md, MODAL_SAVEABLE_FIELDS);
                      const missing = missingForMarkReady({ ...stored, ...pending });
                      if (missing.length > 0) {
                        setToast(`Missing fields: ${missing.join(', ')}. Fill them or use AI Enhance first.`);
                        return;
                      }
                      // Confirmation summary. The venue-image bullet is conditional:
                      // if a scene set is already attached we'll skip regeneration
                      // (the backend also guards this, but skipping the call
                      // entirely saves a round-trip and makes the UX honest).
                      const hasVenue = !!(md.scene_set_id || md.venue_location_id);
                      const summary = `Mark "${md.name}" as ready?\n\nHost: ${md.host}\nVenue: ${md.venue_name}\nDate: ${md.event_date}\nPrestige: ${md.prestige}\n\nThis will:\n• Mark the event ready${Object.keys(pending).length ? ' and save your unsaved edits' : ''}\n• Generate social checklist\n${hasVenue ? '• Keep the attached venue (no regeneration)' : '• Show the venue\'s brief, to generate its images'}\n• Move out of Drafts`;
                      if (!window.confirm(summary)) return;
                      try {
                        // Mark ready, plus only the edits this modal has not
                        // saved yet — never a resave of the hydrated copy
                        // (Task #1786).
                        const fieldsToSave = { ...pending, status: 'ready' };
                        const res = await modalSave(fieldsToSave);
                        if (res.data.success) {
                          recordSaved(fieldsToSave);
                          const updated = { ...md, ...fieldsToSave };
                          setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, ...fieldsToSave } : ev));
                          setEventDetailModal(updated);
                          setToast('Event marked ready — generating checklist...');
                          // Auto-generate social checklist
                          try {
                            const clRes = await api.post(`/api/v1/world/${showId}/events/${md.id}/generate-social-checklist`);
                            if (clRes.data.success) {
                              const newAuto = { ...auto, social_tasks: clRes.data.data.tasks, social_checklist_url: clRes.data.data.assetUrl };
                              const withChecklist = { ...updated, canon_consequences: { ...updated.canon_consequences, automation: newAuto } };
                              setEventDetailModal(withChecklist);
                              setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, canon_consequences: withChecklist.canon_consequences } : ev));
                              // Only regenerate the venue if there isn't one
                              // already on the event. Prevents Mark-Ready from
                              // clobbering a scene set the creator deliberately
                              // picked. The backend also guards this, but
                              // skipping the call here is cheaper + cleaner.
                              if (hasVenue) {
                                setToast(`Ready! Checklist done. Kept attached venue.`);
                                loadData();
                              } else {
                                // S8: no image work here; the venue's set and
                                // its images are made in Scene Sets.
                                setToast('Ready! Checklist done. Create the venue\'s scene set, then make its images in Scene Sets.');
                                loadData();
                              }
                            }
                          } catch { /* non-blocking — checklist can be generated later */ }
                        }
                      } catch (err) {
                        // Refused because the event changed elsewhere: say
                        // so, and do not retry (Task #1788).
                        if (isStaleSaveError(err)) {
                          setToast(`${saveErrorMessage(err)} Close this editor and reopen the event.`);
                          return;
                        }
                        // If full save fails (columns missing), at least save status
                        try {
                          await modalSave({ status: 'ready' });
                          setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, status: 'ready' } : ev));
                          setEventDetailModal({ ...md, status: 'ready' });
                          setToast('Marked ready (some fields saved to automation only)');
                        } catch (e2) {
                          setToast('Failed: ' + (e2.response?.data?.error || err.message));
                        }
                      }
                    }} style={{ padding: '6px 20px', borderRadius: 8, border: '2px solid var(--success)', background: 'var(--success-bg)', color: 'var(--success-text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      Mark Ready
                    </button>
                  )}
                  {md.used_in_episode_id && md.status !== 'draft' && (
                    <button onClick={async () => {
                      if (!window.confirm(`Complete "${md.name}"?\n\nThis will:\n• Evaluate the episode (outfit + event + character state)\n• Apply social task bonuses (reputation, influence)\n• Finalize all financial transactions\n• Update Lala's character stats\n• Mark event as filmed`)) return;
                      // MB4 (§8(gg)): warn early on money; never blocks.
                      const moneyWarning = await completeMoneyWarning(showId, md.used_in_episode_id);
                      if (moneyWarning && !window.confirm(moneyWarning)) return;
                      try {
                        const res = await api.post(`/api/v1/world/${showId}/episodes/${md.used_in_episode_id}/complete`);
                        if (res.data.success) {
                          const d = res.data.data;
                          if (d.already_completed) {
                            setToast(`Already completed — ${d.evaluation?.tier?.toUpperCase()} (${d.evaluation?.score}/100)`);
                          } else {
                            setToast(`${d.evaluation.tier.toUpperCase()} (${d.evaluation.score}/100) — ${d.evaluation.narrative}`);
                            setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, status: 'filmed' } : ev));
                            setEventDetailModal(prev => prev ? { ...prev, status: 'filmed' } : prev);
                          }
                        }
                      } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                    }} style={{ padding: '6px 20px', borderRadius: 8, border: '2px solid var(--lala-gold)', background: 'var(--surface-bg)', color: 'var(--lala-gold-text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      👑 Complete Episode
                    </button>
                  )}
                  <div style={{ flex: 1 }} />
                  <button onClick={async () => {
                    // Send only the fields whose value differs from what the
                    // modal opened with (Task #1786). Most fields already
                    // saved on blur, so this is usually nothing. It never
                    // sends canon_consequences: nothing in this modal edits
                    // it, and sending the opened copy whole overwrote the
                    // Event Package's guests and a freshly generated
                    // invitation (docs/EVENT_EDITOR_REMOVAL_READ.md §5.2).
                    const toSave = changedFields(baseline, md, MODAL_SAVEABLE_FIELDS);
                    if (Object.keys(toSave).length === 0) {
                      setToast('No unsaved changes');
                      return;
                    }
                    try {
                      const res = await modalSave(toSave);
                      if (res.data.success) {
                        recordSaved(toSave);
                        setWorldEvents(prev => prev.map(ev => ev.id === md.id ? { ...ev, ...res.data.event } : ev));
                        setToast('Event saved');
                      }
                    } catch (err) {
                      setToast(isStaleSaveError(err) ? `${saveErrorMessage(err)} Close this editor and reopen the event.` : 'Save failed: ' + (err.response?.data?.error || err.message));
                    }
                  }} style={{ ...S.primaryBtn, padding: '6px 20px', fontSize: 13 }}>
                    💾 Save
                  </button>
                  <button onClick={() => setEventDetailModal(null)} style={{ ...S.smBtn, background: 'var(--lala-parchment-2)' }}>Close</button>
                </div>
              </div>
            </div>
            );
}
