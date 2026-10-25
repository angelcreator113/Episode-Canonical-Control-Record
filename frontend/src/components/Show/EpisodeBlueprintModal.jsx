/**
 * The episode a multi-event Generate made, as a blueprint: its beats,
 * scene plan, social tasks and Pulse posts (EventLibrary's bulk "Generate
 * from N events"). Moved unchanged from Producer Mode with the library
 * (2026-10-25).
 */
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { seasonPageHref } from '../../lib/seasonPage';
import SocialTaskBadge from '../SocialTaskBadge';
import { platformLabel } from '../../pages/feed/feedConstants';

export default function EpisodeBlueprintModal({ lib }) {
  const navigate = useNavigate();
  const {
    episodeBlueprint, setEpisodeBlueprint, showId,
  } = lib;
  return createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setEpisodeBlueprint(null)}>
          <div style={{ background: 'var(--surface-card)', borderRadius: 16, maxWidth: 700, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🎬 Episode Blueprint</h2>
              <button onClick={() => setEpisodeBlueprint(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>

            {/* Episode info */}
            <div style={{ background: 'var(--surface-bg)', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid var(--lala-parchment-3)' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>{episodeBlueprint.episode?.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Episode {episodeBlueprint.episode?.episode_number} · {episodeBlueprint.brief?.episode_archetype} · Intent: {episodeBlueprint.brief?.designed_intent}</div>
            </div>

            {/* Financials */}
            {episodeBlueprint.financials && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ padding: '8px 14px', background: 'var(--success-bg)', borderRadius: 8, textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--success-text)' }}>Income</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success-text)' }}>{episodeBlueprint.financials.total_income}</div>
                </div>
                <div style={{ padding: '8px 14px', background: 'var(--danger-bg)', borderRadius: 8, textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--danger-text)' }}>Expenses</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger-text)' }}>{episodeBlueprint.financials.total_expenses}</div>
                </div>
                <div style={{ padding: '8px 14px', background: episodeBlueprint.financials.net_profit >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)', borderRadius: 8, textAlign: 'center', flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Net</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: episodeBlueprint.financials.net_profit >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>{episodeBlueprint.financials.net_profit}</div>
                </div>
              </div>
            )}

            {/* 14 Beats Timeline */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: 'var(--lala-gold-text)', marginBottom: 8 }}>14 Beats</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(episodeBlueprint.beats || []).map((beat, i) => {
                  // A beat's phase: a surface, and a dot the beat number reads white on (the text twins; the old fills were 2.2:1 to 3.0:1 under white).
                  const phaseColors = { before: 'var(--warning-bg)', during: 'var(--info-bg)', after: 'var(--accent-subtle)' };
                  const phaseDots = { before: 'var(--warning-text)', during: 'var(--info-text)', after: 'var(--accent-dark)' };
                  // Find feed moment for this beat from scene plan
                  const sp = episodeBlueprint.scenePlan?.find(s => s.beat_number === beat.beat);
                  const fm = sp?.feed_moment || episodeBlueprint.feedMoments?.[beat.beat];
                  return (
                    <div key={i} style={{ padding: '6px 10px', background: phaseColors[beat.phase] || 'var(--surface-bg)', borderRadius: 6 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: phaseDots[beat.phase] || 'var(--text-secondary)', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{beat.beat}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{beat.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{beat.description}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{beat.phase} · {beat.emotional_intent}</div>
                        </div>
                        {fm && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'var(--gray-900)', color: 'var(--text-inverse)', fontWeight: 700, flexShrink: 0 }}>📱</span>}
                      </div>
                      {/* Feed Moment — On-Screen Visual + Script Lines */}
                      {fm && (
                        <div style={{ marginTop: 6, marginLeft: 34, display: 'flex', gap: 6 }}>
                          {/* On-Screen Overlay (bright — what viewer sees) */}
                          <div style={{ flex: 1, padding: '6px 10px', background: 'var(--lala-gold-soft)', borderRadius: 8, border: '1px solid var(--lala-gold-line)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                              <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--lala-gold-text)', textTransform: 'uppercase' }}>On Screen · {(fm.on_screen || fm.phone_screen)?.type || 'notification'}</span>
                              <span style={{ fontSize: 8, color: 'var(--text-secondary)' }}>{fm.trigger_profile}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.4 }}>{(fm.on_screen || fm.phone_screen)?.content}</div>
                          </div>
                          {/* Script Lines — Both Voices */}
                          {(fm.script_lines || fm.lala_dialogue) && (
                            <div style={{ flex: 1, padding: '6px 10px', background: 'var(--surface-card)', borderRadius: 8, border: '1px solid var(--lala-parchment-3)' }}>
                              {/* JustAWoman — player voice */}
                              {fm.script_lines?.justawoman_line && (
                                <div style={{ marginBottom: 4 }}>
                                  <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--lala-gold-text)', textTransform: 'uppercase' }}>JustAWoman</span>
                                  <div style={{ fontSize: 11, color: 'var(--warning-text)', marginTop: 1 }}>"{fm.script_lines.justawoman_line}"</div>
                                </div>
                              )}
                              {/* Lala — character voice */}
                              <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--primary-text)', textTransform: 'uppercase' }}>Lala</span>
                              <div style={{ fontSize: 11, color: 'var(--text-primary)', marginTop: 1, fontFamily: "'Lora', serif" }}>
                                "{fm.script_lines?.lala_line || fm.lala_dialogue}"
                              </div>
                              {(fm.script_lines?.lala_internal || fm.lala_internal) && (
                                <div style={{ fontSize: 10, color: 'var(--primary-text)', fontStyle: 'italic', marginTop: 2 }}>
                                  [{fm.script_lines?.lala_internal || fm.lala_internal}]
                                </div>
                              )}
                              {/* Financial indicator */}
                              {fm.financial && (
                                <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, marginTop: 3, display: 'inline-block', background: fm.financial.affordable ? 'var(--success-bg)' : 'var(--danger-bg)', color: fm.financial.affordable ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 600 }}>
                                  Bank: {fm.financial.balance} → {fm.financial.affordable ? `-${fm.financial.outfit_cost} = ${fm.financial.remaining}` : `Need ${fm.financial.outfit_cost} (short ${fm.financial.outfit_cost - fm.financial.balance})`}
                                </div>
                              )}
                              {(fm.script_lines?.direction || fm.behavior_shift) && (
                                <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2 }}>→ {fm.script_lines?.direction || fm.behavior_shift}</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Social Tasks */}
            {episodeBlueprint.socialTasks?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: 'var(--lala-gold-text)', marginBottom: 8 }}>📱 Social Media Tasks ({episodeBlueprint.socialTasks.length})</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                  {episodeBlueprint.socialTasks.map((task, i) => (
                    <div key={i} style={{ padding: '6px 10px', background: task.source ? 'var(--lala-gold-soft)' : 'var(--surface-bg)', borderRadius: 6, fontSize: 11, borderLeft: task.source ? '3px solid var(--lala-gold)' : undefined }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>☐</span>
                        <span style={{ fontWeight: 600 }}>{task.label}</span>
                        <SocialTaskBadge task={task} />
                        {task.source === 'platform' && <span style={{ fontSize: 8, padding: '1px 4px', background: 'var(--info-bg)', color: 'var(--info-text)', borderRadius: 3 }}>{platformLabel(task.platform)}</span>}
                        {task.source === 'category' && <span style={{ fontSize: 8, padding: '1px 4px', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: 3 }}>niche</span>}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{task.description}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace", marginTop: 1 }}>{platformLabel(task.platform)} · {task.timing}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feed Activity */}
            {episodeBlueprint.feedPosts?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: 'var(--lala-gold-text)', marginBottom: 8 }}>📢 Pulse activity ({episodeBlueprint.feedPosts.length} posts)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {episodeBlueprint.feedPosts.map((post, i) => (
                    <div key={i} style={{ padding: '8px 12px', background: 'var(--surface-bg)', borderRadius: 8, borderLeft: '3px solid var(--lala-gold)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{post.handle} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({post.role})</span></div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontStyle: 'italic' }}>"{post.content}"</div>
                      <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2, fontFamily: "'DM Mono', monospace" }}>{post.platform}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => {
                const epId = episodeBlueprint.episode?.id;
                // Open Episode lands on Overview (Task #1905), as the queue's does.
                if (epId) window.location.href = `/episodes/${epId}?tab=overview`;
                else { setEpisodeBlueprint(null); navigate(seasonPageHref(showId, 'episodes')); }
              }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--text-inverse)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                Open Episode →
              </button>
              <button onClick={() => {
                const epId = episodeBlueprint.episode?.id;
                if (epId) window.location.href = `/episodes/${epId}/script-writer`;
                else setEpisodeBlueprint(null);
              }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--lala-gold)', background: 'transparent', color: 'var(--lala-gold-text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                Write Script
              </button>
              <button onClick={() => setEpisodeBlueprint(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--lala-parchment-3)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
  );
}
