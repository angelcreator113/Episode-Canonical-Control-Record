/**
 * The event library's Ideas drawer (Evoni, 2026-09-30): The Pulse's
 * opportunities, ready to schedule as events, and the Feed event templates.
 * Moved unchanged from Producer Mode's Events tab with the library
 * (2026-10-25).
 */
import { X } from 'lucide-react';
import api from '../../services/api';
import { S } from './producerStyles';
import { atHandle } from '../../pages/feed/feedConstants';
import { TEMPLATE_CATEGORY_MAP } from '../../lib/eventLibrary';

export default function EventIdeasDrawer({ lib }) {
  const {
    feedEventResults, loadData, oppQuickForm, opportunities, setEventDetailModal, setEventsIdeasOpen, setFeedEventResults, setOppQuickForm, setToast, showId, worldEvents,
  } = lib;
  return (
            <>
              <div className="wa-ev-drawer-backdrop" data-testid="events-ideas-backdrop" onClick={() => setEventsIdeasOpen(false)} />
              <aside className="wa-ev-drawer" role="dialog" aria-modal="true" aria-labelledby="events-ideas-title" data-testid="events-ideas">
                <div className="wa-ev-drawer-head">
                  <h3 id="events-ideas-title" className="wa-ev-drawer-title">Ideas — Pulse opportunities &amp; event templates</h3>
                  <button type="button" className="wa-ev-drawer-close" data-testid="events-ideas-close" aria-label="Close Ideas" onClick={() => setEventsIdeasOpen(false)}>
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <div className="wa-ev-drawer-body">
                {/* ── Pipeline: Opportunities → Events ── */}
                <div style={{ background: 'var(--surface-bg)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: 'var(--lala-gold-text)' }}>
                      Pipeline — The Pulse → Opportunities → Events
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={async () => {
                        setToast('Scanning The Pulse for opportunities...');
                        try {
                          const res = await api.post(`/api/v1/feed-pipeline/${showId}/generate-opportunities`);
                          if (res.data.success) {
                            setToast(`${res.data.count} opportunities generated from Pulse profiles`);
                            loadData();
                          }
                        } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                        setTimeout(() => setToast(null), 3000);
                      }} style={{ ...S.smBtn, background: 'var(--primary)', color: 'var(--text-inverse)', border: 'none', fontSize: 10 }}>
                        🔍 Scan The Pulse
                      </button>
                      <button onClick={() => setOppQuickForm({ name: '', opportunity_type: 'modeling', prestige: 5, narrative_stakes: '' })} style={{ ...S.smBtn, fontSize: 10 }}>
                        + New Opportunity
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Scan The Pulse for opportunities, or pick a template below.
                  </div>
                </div>

                {/* Pipeline stats */}
                {opportunities.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {['offered','considering','booked','active','completed'].map(s => {
                      const count = opportunities.filter(o => o.status === s).length;
                      if (!count) return null;
                      const colors = { offered: ['var(--warning-text)', 'var(--warning-bg)'], considering: ['var(--primary-text)', 'var(--primary-subtle)'], booked: ['var(--success-text)', 'var(--success-bg)'], active: ['var(--success-text)', 'var(--success-bg)'], completed: ['var(--success-text)', 'var(--success-bg)'] };
                      const [fg, bg] = colors[s] || ['var(--text-secondary)', 'var(--lala-parchment-2)'];
                      return <span key={s} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600, background: bg, color: fg }}>{s}: {count}</span>;
                    })}
                    <span style={{ fontSize: 9, color: 'var(--text-secondary)', padding: '2px 4px' }}>
                      ${opportunities.filter(o => ['booked','active','completed','paid'].includes(o.status)).reduce((s, o) => s + (parseFloat(o.payment_amount) || 0), 0).toLocaleString()} booked
                    </span>
                  </div>
                )}

                {/* Quick create opportunity form */}
                {oppQuickForm && (
                  <div style={{ background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div><label style={{ fontSize: 10, color: 'var(--text-secondary)' }}>name</label><input value={oppQuickForm.name} onChange={e => setOppQuickForm(p => ({ ...p, name: e.target.value }))} placeholder="Velour Magazine Cover" style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12 }} /></div>
                      <div><label style={{ fontSize: 10, color: 'var(--text-secondary)' }}>type</label><select value={oppQuickForm.opportunity_type} onChange={e => setOppQuickForm(p => ({ ...p, opportunity_type: e.target.value }))} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12 }}>
                        {['modeling', 'runway', 'editorial', 'campaign', 'ambassador', 'brand_deal', 'casting_call', 'podcast', 'interview', 'award_show', 'social_event'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                      </select></div>
                      <div><label style={{ fontSize: 10, color: 'var(--text-secondary)' }}>prestige</label><input type="number" value={oppQuickForm.prestige} onChange={e => setOppQuickForm(p => ({ ...p, prestige: parseInt(e.target.value) || 5 }))} min="1" max="10" style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12 }} /></div>
                    </div>
                    <div style={{ marginBottom: 8 }}><label style={{ fontSize: 10, color: 'var(--text-secondary)' }}>stakes</label><input value={oppQuickForm.narrative_stakes} onChange={e => setOppQuickForm(p => ({ ...p, narrative_stakes: e.target.value }))} placeholder="Why this matters for Lala..." style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, fontSize: 12 }} /></div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => setOppQuickForm(null)} style={{ padding: '5px 14px', border: '1px solid var(--lala-parchment-3)', borderRadius: 6, background: 'var(--surface-card)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                      <button disabled={!oppQuickForm.name} onClick={async () => {
                        try {
                          await api.post(`/api/v1/opportunities/${showId}`, { ...oppQuickForm, category: 'fashion' });
                          setOppQuickForm(null);
                          setToast('Opportunity created');
                          loadData();
                        } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                      }} style={{ padding: '5px 14px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: 'var(--text-inverse)', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: !oppQuickForm.name ? 0.4 : 1 }}>Create</button>
                    </div>
                  </div>
                )}

                {/* Active Opportunities ready to schedule */}
                {(() => {
                  const schedulable = (opportunities || []).filter(o => !o.event_id && ['offered','considering','negotiating','booked'].includes(o.status));
                  if (schedulable.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: 'var(--lala-gold-text)', marginBottom: 8 }}>
                        Active Opportunities — ready to schedule ({schedulable.length})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                        {schedulable.map(opp => (
                          <div key={opp.id} style={{ background: 'var(--surface-card)', border: '1px solid var(--lala-parchment-3)', borderLeft: '4px solid var(--lala-gold)', borderRadius: 10, padding: '12px 14px' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{opp.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', gap: 6 }}>
                              <span>{opp.opportunity_type?.replace(/_/g, ' ')}</span>
                              {opp.connector_handle && <span>via {atHandle(opp.connector_handle)}</span>}
                              {opp.prestige && <span>⭐ {opp.prestige}</span>}
                            </div>
                            {opp.narrative_stakes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.3 }}>{typeof opp.narrative_stakes === 'string' ? opp.narrative_stakes.slice(0, 100) : ''}</div>}
                            <button onClick={async () => {
                              setToast(`Scheduling "${opp.name}"...`);
                              try {
                                const res = await api.post(`/api/v1/feed-pipeline/${showId}/schedule/${opp.id}`);
                                if (res.data.success) { setToast(`"${opp.name}" → Event created!`); loadData(); }
                              } catch (err) { setToast('Failed: ' + (err.response?.data?.error || err.message)); }
                            }} style={{ padding: '5px 14px', border: 'none', borderRadius: 6, background: 'var(--primary)', color: 'var(--text-inverse)', fontWeight: 600, fontSize: 11, cursor: 'pointer', width: '100%' }}>
                              📅 Schedule as Event
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Feed event templates grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                  {[
                    { name: 'Creator Roast Night', category: 'creator_economy', icon: '🔥', desc: 'Public roasting of creators by other creators. Everything is jokes until someone goes too far.', energy: 'chaotic', venue_theme: 'Dark underground comedy club with exposed brick, dramatic red spotlights, leather booths, vintage microphone on stage' },
                    { name: 'Fashion Mystery Box', category: 'fashion', icon: '📦', desc: 'Style looks from a mystery selection. Constraint reveals true taste — or lack of it.', energy: 'creative', venue_theme: 'Sleek futuristic showroom with glass display cases, neon accents, mirrored walls, mystery boxes on pedestals' },
                    { name: 'Creator Speed Dating', category: 'creator_economy', icon: '⚡', desc: 'Rapid-fire collab pitches. Alliances form fast. Some are regretted faster.', energy: 'networking', venue_theme: 'Modern co-working lounge with round tables, warm lighting, exposed ceiling beams, cocktail bar in corner' },
                    { name: 'Street Style Marathon', category: 'fashion', icon: '👟', desc: 'Extended street style documentation — the week\'s best looks ranked publicly.', energy: 'competitive', venue_theme: 'Luxury outdoor fashion district — cobblestone streets, designer storefronts, fairy lights strung between buildings, photography wall' },
                    { name: 'Beauty Battles', category: 'beauty', icon: '💄', desc: 'Head-to-head beauty challenges. The audience votes. The loser loses followers publicly.', energy: 'dramatic', venue_theme: 'Glamorous beauty arena with vanity mirror stations, ring lights everywhere, judges panel, pink neon runway' },
                    { name: 'Design Lab Week', category: 'creative', icon: '🎨', desc: 'Experimental design projects and innovation challenges. Where new ideas are tested publicly.', energy: 'creative', venue_theme: 'Industrial creative studio with paint-splattered floors, large canvases, skylights, modern art installations' },
                    { name: 'Community Build Week', category: 'creator_economy', icon: '🤝', desc: 'Collaborative content between otherwise competing creators. Forced proximity events.', energy: 'wholesome', venue_theme: 'Warm communal space with long wooden tables, greenery, soft natural lighting, open kitchen, cozy seating nooks' },
                    { name: 'The Great Glow-Up Challenge', category: 'beauty', icon: '✨', desc: 'Dramatic transformation challenge. Before and after content that goes viral.', energy: 'aspirational', venue_theme: 'Luxury spa and transformation center with marble floors, gold mirrors, professional styling stations, crystal chandeliers' },
                    { name: 'Creator Charity Week', category: 'creator_economy', icon: '💝', desc: 'Creators raise money for causes. Reputation washing meets genuine impact.', energy: 'feel-good', venue_theme: 'Elegant charity gala ballroom with auction stage, flower arrangements, candlelit tables, donation display board' },
                    { name: 'Midnight Music Festival', category: 'music', icon: '🎵', desc: 'Late-night music and performance event. Unexpected collabs happen after midnight.', energy: 'electric', venue_theme: 'Rooftop music venue at night with city skyline, string lights, DJ booth, velvet lounge areas, starlit sky' },
                    { name: 'Virtual Travel Festival', category: 'lifestyle', icon: '✈️', desc: 'Digital travel content — who can make home feel like elsewhere.', energy: 'escapist', venue_theme: 'Tropical resort-style venue with palm trees, infinity pool edge, sunset views, bamboo furniture, exotic flowers' },
                    { name: 'Artist Residency Month', category: 'creative', icon: '🖼️', desc: 'Creators slow down and make something intentional. The antidote to the content grind.', energy: 'reflective', venue_theme: 'Serene gallery loft with white walls, natural wood floors, large windows with garden views, minimal sculptures' },
                    { name: 'Creator Talent Show', category: 'creator_economy', icon: '🎤', desc: 'Hidden talents revealed. Singers, dancers, comedians — the audience discovers new sides.', energy: 'surprising', venue_theme: 'Intimate theater with velvet curtains, spotlit stage, orchestra seating, gold balcony railings, dramatic drapes' },
                  ].map(template => {
                    const catColors = {
                      fashion: { bg: 'var(--lala-gold-soft)', border: 'var(--lala-gold)', text: 'var(--lala-gold-text)' },
                      beauty: { bg: 'var(--accent-subtle)', border: 'var(--accent)', text: 'var(--accent-dark)' },
                      creator_economy: { bg: 'var(--info-bg)', border: 'var(--info)', text: 'var(--info-text)' },
                      creative: { bg: 'var(--primary-subtle)', border: 'var(--primary)', text: 'var(--primary-text)' },
                      music: { bg: 'var(--warning-bg)', border: 'var(--warning)', text: 'var(--warning-text)' },
                      lifestyle: { bg: 'var(--success-bg)', border: 'var(--success)', text: 'var(--success-text)' },
                    };
                    const cc = catColors[template.category] || catColors.creator_economy;
                    // Check if an event already exists from this template
                    const existingEvent = worldEvents.find(ev =>
                      ev.name?.includes(template.name) ||
                      ev.canon_consequences?.automation?.source_calendar_title === template.name
                    );

                    return (
                      <div key={template.name} style={{ background: existingEvent ? 'var(--success-bg)' : 'var(--surface-card)', border: `1px solid ${existingEvent ? 'var(--success-border)' : 'var(--lala-parchment-3)'}`, borderLeft: `4px solid ${existingEvent ? 'var(--success)' : cc.border}`, borderRadius: 10, padding: 16, transition: 'border-color 0.15s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 20 }}>{template.icon}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{template.name}</div>
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: cc.bg, color: cc.text, fontWeight: 600 }}>{template.category.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>{template.desc}</p>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--lala-parchment-2)', color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>Energy: {template.energy}</span>
                        </div>
                        {(feedEventResults[template.name]?.status === 'created' || existingEvent) ? (() => {
                          const created = feedEventResults[template.name]?.event || existingEvent;
                          const host = created?.host || created?.canon_consequences?.automation?.host_display_name || '';
                          return (
                            <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 8, padding: 10, fontSize: 12, marginTop: 6 }}>
                              <div style={{ fontWeight: 700, color: 'var(--success-text)', marginBottom: 4 }}>Event Created</div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{created?.name || template.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0' }}>
                                {host ? `Host: ${host} · ` : ''}Prestige: {created?.prestige || 5}{created?.status ? ` · ${created.status}` : ''}
                              </div>
                              <button
                                onClick={() => { setEventDetailModal(created); }}
                                style={{ marginTop: 6, padding: '4px 12px', borderRadius: 4, border: '1px solid var(--lala-gold)', background: 'var(--surface-card)', color: 'var(--lala-gold-text)', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                              >
                                Edit Event Details
                              </button>
                            </div>
                          );
                        })() : (
                          <button
                            disabled={feedEventResults[template.name]?.status === 'creating'}
                            onClick={async () => {
                              setFeedEventResults(prev => ({ ...prev, [template.name]: { status: 'creating' } }));
                              try {
                                // Create world event directly from template — no calendar middleware
                                const res = await api.post(`/api/v1/world/${showId}/events`, {
                                  name: template.name,
                                  event_type: 'invite',
                                  category: TEMPLATE_CATEGORY_MAP[template.category] || null,
                                  description: template.desc,
                                  prestige: 5,
                                  cost_coins: 150,
                                  dress_code: null,
                                  narrative_stakes: template.desc,
                                  location_hint: template.venue_theme || null,
                                  canon_consequences: {
                                    automation: {
                                      venue_theme: template.venue_theme,
                                      energy: template.energy,
                                      category: template.category,
                                    },
                                  },
                                  status: 'draft',
                                });
                                if (res.data.success || res.data.data) {
                                  const created = res.data.data || res.data;
                                  setFeedEventResults(prev => ({ ...prev, [template.name]: { status: 'created', event: created } }));
                                  loadData();
                                  setToast(`"${template.name}" created as draft — add host, venue, and details below`);
                                } else {
                                  setFeedEventResults(prev => ({ ...prev, [template.name]: { status: 'idle' } }));
                                  setToast(res.data.error || 'Failed to create event');
                                }
                              } catch (err) {
                                setFeedEventResults(prev => ({ ...prev, [template.name]: { status: 'idle' } }));
                                setToast('Failed: ' + (err.response?.data?.error || err.message));
                              }
                            }}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${cc.border}40`, background: `${cc.bg}80`, color: cc.text, fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'background 0.15s' }}
                          >
                            {feedEventResults[template.name]?.status === 'creating' ? 'Creating...' : 'Create This Event'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                </div>
              </aside>
            </>
  );
}
