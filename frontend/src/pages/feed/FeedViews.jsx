/**
 * FeedViews.jsx — View tab components for the Feed
 * Timeline, Follows, Moments, Dashboard, Graph, Templates, Automation
 */
import React from 'react';
import {
  C, ARCHETYPE_LABELS, FEED_STATE_CONFIG, PROTAGONISTS, fp, lalaClass,
} from './feedConstants';

function Spinner() {
  return <span style={{display:'inline-block',width:14,height:14,border:`2px solid ${C.border}`,borderTopColor:C.lavender,borderRadius:'50%',animation:'spin 0.6s linear infinite'}}/>;
}

export default function FeedViewContent({
  feedView, loading, profiles, feedLayer, selected, setSelected, selectProfile, setDetailTab,
  followStats, momentsData, momentsLoading, diversityData, diversityLoading,
  suggestions, suggestionsLoading, loadSuggestions, acceptSuggestion,
  templates, deleteTemplate, saveAsTemplate, loadSceneContext,
  autoStatus, autoRunning, autoHistory, layerStatus,
  toggleScheduler, runAutoNow, updateAutoConfig, showToast, setAutoRunning,
}) {
  return <>
            {/* ── TIMELINE VIEW — simulated social feed ── */}
            {!loading&&profiles.length>0&&feedView==='timeline' && (
              <div style={{maxWidth:560,margin:'0 auto',display:'flex',flexDirection:'column',gap:16,marginBottom:16}}>
                {profiles.map(p=>{
                  const d=fp(p);
                  const captions=p.sample_captions||d.sample_captions||[];
                  const comments=p.sample_comments||d.sample_comments||[];
                  const pinned=p.pinned_post||d.pinned_post;
                  const sc=p.current_state&&FEED_STATE_CONFIG[p.current_state];
                  const score=p.lala_relevance_score??d.lala_relevance_score??0;
                  return (
                    <div key={p.id} style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,overflow:'hidden',boxShadow:C.shadow}}>
                      {/* Post header */}
                      <div style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:10,borderBottom:`1px solid ${C.border}`}}>
                        <div style={{width:40,height:40,borderRadius:'50%',background:`linear-gradient(135deg,${C.pink},${C.lavender})`,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:14,fontWeight:700,flexShrink:0}}>
                          {(p.handle||'').replace('@','').charAt(0).toUpperCase()}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:6}}>
                            <span style={{fontSize:14,fontWeight:700,color:C.ink,cursor:'pointer'}} onClick={()=>selectProfile(p)}>{p.display_name||d.display_name||p.handle}</span>
                            {sc&&<span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:8,background:sc.bg,color:sc.color}}>{sc.label}</span>}
                          </div>
                          <div style={{fontSize:12,color:C.inkLight}}>{p.handle} · {p.platform} · {p.follower_count_approx||d.follower_count_approx}{feedLayer==='lalaverse'&&p.feed_layer==='real_world'&&<span style={{marginLeft:6,fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:6,background:C.blueLight,color:C.blue}}>◈ Following</span>}</div>
                        </div>
                        <span style={{fontSize:10,fontWeight:700,color:score>=7?C.lavender:score>=4?C.blue:C.inkLight}}>✦{score}</span>
                      </div>
                      {/* Post body — pinned post or first caption */}
                      <div style={{padding:'14px 16px'}}>
                        <div style={{fontSize:13,color:C.ink,lineHeight:1.7,marginBottom:10,whiteSpace:'pre-wrap'}}>
                          {pinned||captions[0]||p.vibe_sentence||''}
                        </div>
                        {/* Aesthetic tags */}
                        {(d.aesthetic_dna?.vibe_tags||[]).length>0&&(
                          <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:10}}>
                            {(d.aesthetic_dna?.vibe_tags||[]).map((t,i)=>(
                              <span key={i} style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:C.lavLight,color:C.lavender}}>#{t.replace(/\s/g,'')}</span>
                            ))}
                          </div>
                        )}
                        {/* Engagement mock */}
                        <div style={{display:'flex',gap:16,fontSize:11,color:C.inkLight,borderTop:`1px solid ${C.border}`,paddingTop:8}}>
                          <span>{d.platform_metrics?.avg_likes||'—'} likes</span>
                          <span>{d.platform_metrics?.avg_comments||'—'} comments</span>
                          <span>{p.engagement_rate||d.engagement_rate||''}</span>
                        </div>
                      </div>
                      {/* Comments preview */}
                      {comments.length>0&&(
                        <div style={{padding:'0 16px 12px'}}>
                          {comments.slice(0,2).map((c,i)=>(
                            <div key={i} style={{fontSize:12,color:C.inkMid,lineHeight:1.5,padding:'4px 0',borderTop:i===0?`1px solid ${C.border}`:'none'}}>
                              <span style={{fontWeight:600,color:C.ink,marginRight:6}}>fan_{i+1}</span>{c}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Additional captions (scrollable) */}
                      {captions.length>1&&(
                        <div style={{padding:'0 16px 8px'}}>
                          <div style={{fontSize:10,fontWeight:700,color:C.inkLight,marginBottom:4}}>More posts</div>
                          {captions.slice(1,3).map((c,i)=>(
                            <div key={i} style={{fontSize:12,color:C.inkMid,lineHeight:1.5,padding:'4px 0',borderTop:`1px solid ${C.border}`}}>{c}</div>
                          ))}
                        </div>
                      )}
                      {/* Moment log preview */}
                      {(p.moment_log||d.moment_log||[]).length>0&&(
                        <div style={{padding:'0 16px 8px'}}>
                          <div style={{fontSize:10,fontWeight:700,color:C.inkLight,marginBottom:4}}>Key Moments</div>
                          {(p.moment_log||d.moment_log||[]).slice(0,2).map((m,i)=>{
                            const typeColors={controversy:'#ef4444',live:'#8b5cf6',post:'#3b82f6',collab:'#22c55e'};
                            return(
                              <div key={i} style={{fontSize:11,color:C.inkMid,padding:'3px 0',display:'flex',gap:6}}>
                                <span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:6,background:`${typeColors[m.moment_type]||C.border}15`,color:typeColors[m.moment_type]||C.inkLight,flexShrink:0}}>{m.moment_type}</span>
                                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.description}</span>
                                {m.lala_seed&&<span style={{fontSize:8,fontWeight:700,color:C.lavender,flexShrink:0}}>SEED</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Quick actions */}
                      <div style={{padding:'8px 16px',borderTop:`1px solid ${C.border}`,display:'flex',gap:8}}>
                        <button onClick={()=>selectProfile(p)} style={{fontSize:11,color:C.lavender,background:'none',border:'none',cursor:'pointer',fontWeight:600}}>View Full Profile</button>
                        <button onClick={()=>{loadSceneContext(p.id);selectProfile(p);setDetailTab('scene');}} style={{fontSize:11,color:C.blue,background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Use in Scene</button>
                        <button onClick={()=>saveAsTemplate(p.id)} style={{fontSize:11,color:C.pink,background:'none',border:'none',cursor:'pointer',fontWeight:600,marginLeft:'auto'}}>Save Template</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── FOLLOWS VIEW — who follows whom and why ── */}
            {!loading&&feedView==='follows' && (
              <div style={{maxWidth:800,margin:'0 auto'}}>
                <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20,marginBottom:16}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:12}}>Follow Engine Overview</div>
                  {followStats?(
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
                      <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                        <div style={{fontSize:22,fontWeight:700,color:C.lavender}}>{followStats.total_profiles}</div>
                        <div style={{fontSize:11,color:C.inkLight}}>Total Profiles</div>
                      </div>
                      <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                        <div style={{fontSize:22,fontWeight:700,color:'#2d7a50'}}>{followStats.followed_profiles}</div>
                        <div style={{fontSize:11,color:C.inkLight}}>Followed by Someone</div>
                      </div>
                      <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                        <div style={{fontSize:22,fontWeight:700,color:C.pink}}>{followStats.unfollowed_profiles}</div>
                        <div style={{fontSize:11,color:C.inkLight}}>Unfollowed</div>
                      </div>
                    </div>
                  ):(
                    <div style={{textAlign:'center',padding:20,color:C.inkLight,fontSize:13}}>Loading follow stats...</div>
                  )}
                  {followStats?.character_follows&&(
                    <div style={{marginTop:16}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Follows per Character</div>
                      {followStats.character_follows.map(cf=>{
                        const charProfile=followStats.character_profiles?.[cf.character_key];
                        return (
                          <div key={cf.character_key} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,marginBottom:6}}>
                            <span style={{fontSize:18,color:cf.character_key==='justawoman'?C.blue:C.lavender}}>{cf.character_key==='justawoman'?'◈':'✦'}</span>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:700,color:C.ink,fontSize:13}}>{charProfile?.name||cf.character_key}</div>
                              <div style={{fontSize:11,color:C.inkLight}}>Threshold: {charProfile?.threshold}</div>
                            </div>
                            <span style={{fontSize:20,fontWeight:700,color:C.lavender}}>{cf.count}</span>
                            <span style={{fontSize:11,color:C.inkLight}}>follows</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {followStats?.character_profiles&&(
                    <div style={{marginTop:16}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Follow Psychology & Affinities</div>
                      {Object.entries(followStats.character_profiles).map(([key,cp])=>(
                        <div key={key} style={{marginBottom:16,padding:'14px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                          <div style={{fontSize:13,fontWeight:700,color:C.ink,marginBottom:8}}>{cp.name}</div>
                          {/* Category Affinities */}
                          <div style={{marginBottom:8}}>
                            <div style={{fontSize:10,fontWeight:600,color:C.inkLight,marginBottom:4}}>Category Affinity</div>
                            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                              {cp.top_categories?.map(c=>(
                                <div key={c.category} style={{display:'flex',alignItems:'center',gap:4}}>
                                  <span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:C.blueLight,color:C.blue}}>{c.category}</span>
                                  <div style={{width:40,height:4,borderRadius:2,background:C.border,overflow:'hidden'}}>
                                    <div style={{height:'100%',background:C.blue,width:`${Math.round(c.weight*100)}%`}}/>
                                  </div>
                                  <span style={{fontSize:9,color:C.inkLight}}>{Math.round(c.weight*100)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Archetype Affinities */}
                          <div style={{marginBottom:8}}>
                            <div style={{fontSize:10,fontWeight:600,color:C.inkLight,marginBottom:4}}>Archetype Affinity</div>
                            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                              {cp.top_archetypes?.map(a=>(
                                <div key={a.archetype} style={{display:'flex',alignItems:'center',gap:4}}>
                                  <span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:C.lavLight,color:C.lavender}}>{ARCHETYPE_LABELS[a.archetype]||a.archetype}</span>
                                  <div style={{width:40,height:4,borderRadius:2,background:C.border,overflow:'hidden'}}>
                                    <div style={{height:'100%',background:C.lavender,width:`${Math.round(a.weight*100)}%`}}/>
                                  </div>
                                  <span style={{fontSize:9,color:C.inkLight}}>{Math.round(a.weight*100)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Motivation Weights */}
                          {cp.motivation_weights&&Object.keys(cp.motivation_weights).length>0&&(
                            <div>
                              <div style={{fontSize:10,fontWeight:600,color:C.inkLight,marginBottom:4}}>Motivation Weights</div>
                              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                                {Object.entries(cp.motivation_weights).sort((a,b)=>b[1]-a[1]).map(([mot,weight])=>(
                                  <div key={mot} style={{display:'flex',alignItems:'center',gap:4}}>
                                    <span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:C.pinkLight,color:C.pink}}>{mot.replace(/_/g,' ')}</span>
                                    <span style={{fontSize:9,color:C.inkLight}}>{Math.round(weight*100)}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Behavioral Modifiers */}
                          {cp.threshold!=null&&(
                            <div style={{display:'flex',gap:12,marginTop:8,fontSize:10,color:C.inkLight}}>
                              <span>Threshold: {cp.threshold}</span>
                              {cp.drama_bonus!=null&&<span>Drama bonus: {cp.drama_bonus>0?'+':''}{cp.drama_bonus}</span>}
                              {cp.adult_penalty!=null&&<span>Adult penalty: {cp.adult_penalty}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Per-profile follow indicators */}
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {profiles.map(p=>{
                    const d=fp(p);
                    const followers=p.followers||[];
                    return (
                      <div key={p.id} onClick={()=>selectProfile(p)} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',background:C.surface,borderRadius:C.radiusSm,border:`1px solid ${C.border}`,cursor:'pointer'}}>
                        <span style={{fontSize:13,fontWeight:700,color:C.ink,minWidth:120}}>{p.handle}</span>
                        <span style={{fontSize:11,color:C.inkLight,flex:1}}>{p.display_name||d.display_name||''}</span>
                        <div style={{display:'flex',gap:4}}>
                          {PROTAGONISTS.map(pr=>{
                            const f=followers.find(fl=>fl.character_key===pr.key);
                            return (
                              <span key={pr.key} style={{fontSize:13,padding:'2px 8px',borderRadius:8,
                                background:f?pr.key==='justawoman'?C.blueLight:C.lavLight:C.surfaceAlt,
                                color:f?pr.key==='justawoman'?C.blue:C.lavender:C.border,
                                fontWeight:f?700:400}}>
                                {pr.icon} {f?'follows':'—'}
                                {f?.follow_probability!=null&&<span style={{fontSize:9,marginLeft:3}}>{Math.round(f.follow_probability*100)}%</span>}
                              </span>
                            );
                          })}
                          {/* Show count of additional dynamic character followers */}
                          {(()=>{const protagonistKeys=new Set(PROTAGONISTS.map(p=>p.key));const dynFollowers=followers.filter(f=>!protagonistKeys.has(f.character_key));return dynFollowers.length>0?(
                            <span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:'#e8f5e9',color:'#2e7d32',fontWeight:600}}>+{dynFollowers.length} more</span>
                          ):null;})()}
                        </div>
                        <span style={{fontSize:10,fontWeight:700,color:C.lavender}}>✦{p.lala_relevance_score??0}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* ── MOMENTS VIEW — aggregated moment timeline across profiles ── */}
            {!loading&&feedView==='moments' && (
              <div style={{maxWidth:700,margin:'0 auto'}}>
                {momentsLoading&&<div style={{textAlign:'center',padding:30,color:C.inkLight}}><Spinner/> Loading moments…</div>}
                {momentsData&&!momentsLoading&&(
                  <>
                    <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
                      <div style={{padding:'10px 16px',borderRadius:C.radiusSm,background:C.surface,border:`1px solid ${C.border}`}}>
                        <div style={{fontSize:18,fontWeight:700,color:C.lavender}}>{momentsData.total}</div>
                        <div style={{fontSize:10,color:C.inkLight}}>Total Moments</div>
                      </div>
                      <div style={{padding:'10px 16px',borderRadius:C.radiusSm,background:C.surface,border:`1px solid ${C.border}`}}>
                        <div style={{fontSize:18,fontWeight:700,color:C.blue}}>{momentsData.profiles_with_moments}</div>
                        <div style={{fontSize:10,color:C.inkLight}}>Profiles</div>
                      </div>
                      {momentsData.type_counts&&Object.entries(momentsData.type_counts).map(([type,count])=>(
                        <div key={type} style={{padding:'10px 16px',borderRadius:C.radiusSm,background:C.surface,border:`1px solid ${C.border}`}}>
                          <div style={{fontSize:16,fontWeight:700,color:C.pink}}>{count}</div>
                          <div style={{fontSize:10,color:C.inkLight,textTransform:'capitalize'}}>{type}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {(momentsData.moments||[]).map((m,i)=>{
                        const typeColors={controversy:'#ef4444',live:'#8b5cf6',post:'#3b82f6',collab:'#22c55e',comment:'#f59e0b',dm:'#ec4899',disappearance:'#6b7280'};
                        const tc=typeColors[m.moment_type]||C.inkMid;
                        return(
                          <div key={i} style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,overflow:'hidden',boxShadow:C.shadow}}>
                            <div style={{height:3,background:tc}}/>
                            <div style={{padding:'12px 16px'}}>
                              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                                <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:8,background:`${tc}15`,color:tc,textTransform:'uppercase'}}>{m.moment_type}</span>
                                {m.platform_format&&<span style={{fontSize:10,color:C.inkLight}}>{m.platform_format}</span>}
                                <span style={{marginLeft:'auto',fontSize:11,fontWeight:700,color:C.ink,cursor:'pointer'}} onClick={()=>{const pr=profiles.find(p=>p.id===m.profile_id);if(pr)setSelected(pr);}}>{m.handle}</span>
                                <span style={{fontSize:10,color:C.inkLight}}>{m.platform}</span>
                                {m.lala_seed&&<span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:6,background:C.lavLight,color:C.lavender}}>Lala Seed</span>}
                              </div>
                              <div style={{fontSize:13,color:C.ink,lineHeight:1.6,marginBottom:6}}>{m.description}</div>
                              {m.protagonist_reaction&&<div style={{fontSize:12,color:C.inkMid,fontStyle:'italic',lineHeight:1.5}}>{m.protagonist_reaction}</div>}
                              {m.lala_seed_reason&&<div style={{fontSize:11,color:C.lavender,marginTop:4}}>Seed: {m.lala_seed_reason}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {momentsData.moments?.length===0&&<div style={{textAlign:'center',padding:40,color:C.inkLight}}>No moments logged yet. Generate profiles to populate the moment timeline.</div>}
                  </>
                )}
              </div>
            )}

            {/* ── DASHBOARD VIEW — diversity/composition analytics ── */}
            {feedView==='dashboard' && (
              <div style={{maxWidth:900,margin:'0 auto'}}>
                {diversityLoading&&<div style={{textAlign:'center',padding:30,color:C.inkLight}}><Spinner/> Loading analytics…</div>}
                {diversityData&&!diversityLoading&&(
                  <>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10,marginBottom:20}}>
                      <div style={{padding:'14px 16px',borderRadius:C.radius,background:C.surface,border:`1px solid ${C.border}`,textAlign:'center'}}>
                        <div style={{fontSize:28,fontWeight:700,color:C.lavender}}>{diversityData.total}</div>
                        <div style={{fontSize:11,color:C.inkLight}}>Total Profiles</div>
                      </div>
                      <div style={{padding:'14px 16px',borderRadius:C.radius,background:C.surface,border:`1px solid ${C.border}`,textAlign:'center'}}>
                        <div style={{fontSize:28,fontWeight:700,color:C.blue}}>{Object.keys(diversityData.archetypes||{}).length}</div>
                        <div style={{fontSize:11,color:C.inkLight}}>Archetypes Used</div>
                      </div>
                      <div style={{padding:'14px 16px',borderRadius:C.radius,background:C.surface,border:`1px solid ${C.border}`,textAlign:'center'}}>
                        <div style={{fontSize:28,fontWeight:700,color:C.pink}}>{Object.keys(diversityData.platforms||{}).length}</div>
                        <div style={{fontSize:11,color:C.inkLight}}>Platforms</div>
                      </div>
                      <div style={{padding:'14px 16px',borderRadius:C.radius,background:C.surface,border:`1px solid ${C.border}`,textAlign:'center'}}>
                        <div style={{fontSize:28,fontWeight:700,color:'#2d7a50'}}>{diversityData.adult_content?.ratio||'0%'}</div>
                        <div style={{fontSize:11,color:C.inkLight}}>Adult Content</div>
                      </div>
                    </div>

                    {/* Archetype Distribution */}
                    <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20,marginBottom:16}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:12}}>Archetype Distribution</div>
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        {Object.entries(diversityData.archetypes||{}).sort((a,b)=>b[1]-a[1]).map(([arch,count])=>(
                          <div key={arch} style={{display:'flex',alignItems:'center',gap:10}}>
                            <span style={{fontSize:11,fontWeight:600,color:C.ink,minWidth:130}}>{ARCHETYPE_LABELS[arch]||arch}</span>
                            <div style={{flex:1,height:16,background:C.surfaceAlt,borderRadius:8,overflow:'hidden',border:`1px solid ${C.border}`}}>
                              <div style={{height:'100%',background:`linear-gradient(90deg,${C.lavender},${C.pink})`,borderRadius:8,width:`${diversityData.total>0?(count/diversityData.total)*100:0}%`,transition:'width 0.3s'}}/>
                            </div>
                            <span style={{fontSize:12,fontWeight:700,color:C.inkMid,minWidth:30,textAlign:'right'}}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Platform + Tier side by side */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                      <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20}}>
                        <div style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:12}}>Platforms</div>
                        {Object.entries(diversityData.platforms||{}).sort((a,b)=>b[1]-a[1]).map(([plat,count])=>(
                          <div key={plat} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
                            <span style={{fontSize:12,fontWeight:600,color:C.ink,textTransform:'capitalize'}}>{plat}</span>
                            <span style={{fontSize:12,fontWeight:700,color:C.blue}}>{count}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20}}>
                        <div style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:12}}>Follower Tiers</div>
                        {Object.entries(diversityData.follower_tiers||{}).sort((a,b)=>b[1]-a[1]).map(([tier,count])=>(
                          <div key={tier} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
                            <span style={{fontSize:12,fontWeight:600,color:C.ink,textTransform:'capitalize'}}>{tier}</span>
                            <span style={{fontSize:12,fontWeight:700,color:C.lavender}}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Relevance Score Distribution */}
                    <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20,marginBottom:16}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:12}}>Relevance Score Distribution</div>
                      <div style={{display:'flex',gap:8,alignItems:'flex-end',height:100}}>
                        {Object.entries(diversityData.relevance_buckets||{}).map(([bucket,count])=>{
                          const maxCount=Math.max(...Object.values(diversityData.relevance_buckets||{}),1);
                          const height=Math.max(8,(count/maxCount)*80);
                          const colors={'0-2':C.border,'3-4':C.inkLight,'5-6':C.blue,'7-8':C.lavender,'9-10':C.pink};
                          return(
                            <div key={bucket} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                              <span style={{fontSize:10,fontWeight:700,color:C.ink}}>{count}</span>
                              <div style={{width:'100%',height,background:colors[bucket]||C.border,borderRadius:4}}/>
                              <span style={{fontSize:9,color:C.inkLight}}>{bucket}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Content Categories + Geographic Clusters */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                      {(diversityData.categories||[]).length>0&&(
                        <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20}}>
                          <div style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:12}}>Top Content Categories</div>
                          {diversityData.categories.map(c=>(
                            <div key={c.category} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                              <span style={{color:C.ink}}>{c.category}</span>
                              <span style={{fontWeight:700,color:C.lavender}}>{c.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {(diversityData.geographic_clusters||[]).length>0&&(
                        <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20}}>
                          <div style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:12}}>Top Geographic Clusters</div>
                          {diversityData.geographic_clusters.map(g=>(
                            <div key={g.cluster} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                              <span style={{color:C.ink}}>{g.cluster}</span>
                              <span style={{fontWeight:700,color:C.blue}}>{g.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* City Distribution (Lalaverse) */}
                    {Object.keys(diversityData.cities||{}).length>0&&(
                      <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20,marginBottom:16}}>
                        <div style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:12}}>LalaVerse City Distribution</div>
                        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                          {Object.entries(diversityData.cities).map(([city,count])=>(
                            <div key={city} style={{padding:'10px 16px',borderRadius:C.radiusSm,background:C.lavLight,border:`1px solid ${C.lavender}40`,textAlign:'center'}}>
                              <div style={{fontSize:18,fontWeight:700,color:C.lavender}}>{count}</div>
                              <div style={{fontSize:10,color:C.inkMid}}>{city.replace(/_/g,' ')}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── GRAPH VIEW — relationship suggestions and network ── */}
            {feedView==='graph' && (
              <div style={{maxWidth:900,margin:'0 auto'}}>
                <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20,marginBottom:16}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                    <div style={{fontSize:16,fontWeight:700,color:C.ink}}>Relationship Discovery</div>
                    <button onClick={loadSuggestions} disabled={suggestionsLoading} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,cursor:'pointer',border:`1px solid ${C.lavender}`,background:'transparent',color:C.lavender}}>
                      {suggestionsLoading?'Scanning…':'Rescan'}
                    </button>
                  </div>
                  {suggestionsLoading&&<div style={{textAlign:'center',padding:20,color:C.inkLight}}><Spinner/> Analyzing profiles for connections…</div>}
                  {suggestions&&!suggestionsLoading&&(
                    <>
                      <div style={{display:'flex',gap:12,marginBottom:16}}>
                        <div style={{padding:'10px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                          <div style={{fontSize:18,fontWeight:700,color:C.lavender}}>{suggestions.total_suggestions}</div>
                          <div style={{fontSize:10,color:C.inkLight}}>Potential Connections</div>
                        </div>
                        <div style={{padding:'10px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                          <div style={{fontSize:18,fontWeight:700,color:C.blue}}>{suggestions.total_analyzed}</div>
                          <div style={{fontSize:10,color:C.inkLight}}>Profiles Analyzed</div>
                        </div>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {(suggestions.suggestions||[]).map((s,i)=>{
                          const typeColors={competitors:'#ef4444',collab:'#22c55e',orbit:'#9ca3af',beef:'#f59e0b'};
                          return(
                            <div key={i} style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:12}}>
                              <div style={{flex:1}}>
                                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                                  <span style={{fontSize:13,fontWeight:700,color:C.ink}}>{s.profile_a.handle}</span>
                                  <span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:`${typeColors[s.suggested_type]||C.border}20`,color:typeColors[s.suggested_type]||C.inkMid,fontWeight:700}}>{s.suggested_type}</span>
                                  <span style={{fontSize:13,fontWeight:700,color:C.ink}}>{s.profile_b.handle}</span>
                                </div>
                                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                                  {s.reasons.map((r,j)=>(
                                    <span key={j} style={{fontSize:10,padding:'1px 6px',borderRadius:6,background:C.blueLight,color:C.blue}}>{r}</span>
                                  ))}
                                  <span style={{fontSize:10,color:C.inkLight,marginLeft:4}}>Score: {s.score}</span>
                                </div>
                              </div>
                              <button onClick={()=>acceptSuggestion(s.profile_a.id,s.profile_b.id,s.suggested_type)} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:11,fontWeight:700,background:'#e8f5ee',color:'#2d7a50',border:'none',cursor:'pointer',whiteSpace:'nowrap'}}>
                                + Accept
                              </button>
                            </div>
                          );
                        })}
                        {(suggestions.suggestions||[]).length===0&&<div style={{textAlign:'center',padding:30,color:C.inkLight}}>No new relationship suggestions. Try generating more profiles first.</div>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── TEMPLATES VIEW — saved profile templates ── */}
            {feedView==='templates' && (
              <div style={{maxWidth:700,margin:'0 auto'}}>
                <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20,marginBottom:16}}>
                  <div style={{fontSize:16,fontWeight:700,color:C.ink,marginBottom:16}}>Profile Templates</div>
                  <div style={{fontSize:12,color:C.inkLight,marginBottom:16}}>Save profiles as templates to quickly generate similar creators. Templates preserve platform, archetype, tier, and aesthetic settings.</div>
                  {templates.length===0&&<div style={{textAlign:'center',padding:30,color:C.inkLight}}>No templates saved yet. Open a profile and use "Save as Template" to create one.</div>}
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {templates.map(t=>(
                      <div key={t.id} style={{padding:'14px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                          <span style={{fontSize:14,fontWeight:700,color:C.ink}}>{t.name}</span>
                          <div style={{display:'flex',gap:6}}>
                            <span style={{fontSize:10,color:C.inkLight}}>Used {t.usage_count}x</span>
                            <button onClick={()=>deleteTemplate(t.id)} style={{fontSize:11,color:C.pink,background:'none',border:'none',cursor:'pointer'}}>Delete</button>
                          </div>
                        </div>
                        {t.description&&<div style={{fontSize:12,color:C.inkMid,marginBottom:6}}>{t.description}</div>}
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {t.template_data?.platform&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:C.blueLight,color:C.blue}}>{t.template_data.platform}</span>}
                          {t.template_data?.archetype&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:C.lavLight,color:C.lavender}}>{(ARCHETYPE_LABELS[t.template_data.archetype]||t.template_data.archetype)}</span>}
                          {t.template_data?.follower_tier&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:C.pinkLight,color:C.pink}}>{t.template_data.follower_tier}</span>}
                          {t.template_data?.content_category&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:C.surfaceAlt,color:C.inkMid}}>{t.template_data.content_category}</span>}
                          {t.template_data?.feed_layer&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:t.template_data.feed_layer==='lalaverse'?C.lavLight:C.blueLight,color:t.template_data.feed_layer==='lalaverse'?C.lavender:C.blue}}>{t.template_data.feed_layer==='lalaverse'?"Lala's Feed":"JustAWoman's Feed"}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── AUTOMATION VIEW — scheduler controls ── */}
            {feedView==='automation' && (
              <div style={{maxWidth:900,margin:'0 auto'}}>
                {/* Scheduler Status */}
                <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20,marginBottom:16}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                    <div style={{fontSize:16,fontWeight:700,color:C.ink}}>Feed Automation</div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={()=>toggleScheduler(autoStatus?.running?'stop':'start')} style={{padding:'6px 16px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,cursor:'pointer',border:'none',background:autoStatus?.running?'#ef4444':'#22c55e',color:'#fff'}}>
                        {autoStatus?.running?'Stop Scheduler':'Start Scheduler'}
                      </button>
                      <button onClick={runAutoNow} disabled={autoRunning} style={{padding:'6px 16px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,cursor:'pointer',border:`1px solid ${C.lavender}`,background:'transparent',color:C.lavender,opacity:autoRunning?0.5:1}}>
                        {autoRunning?'Running…':'Run Cycle Now'}
                      </button>
                    </div>
                  </div>

                  {/* Status indicators */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:16}}>
                    <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:autoStatus?.running?'#eef7ec':'#fde8e8',border:`1px solid ${autoStatus?.running?'#c3e6cb':'#f5c6cb'}`}}>
                      <div style={{fontSize:18,fontWeight:700,color:autoStatus?.running?'#22c55e':'#ef4444'}}>{autoStatus?.running?'Active':'Stopped'}</div>
                      <div style={{fontSize:11,color:C.inkLight}}>Scheduler</div>
                    </div>
                    <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                      <div style={{fontSize:18,fontWeight:700,color:C.lavender}}>{autoStatus?.interval_hours||4}h</div>
                      <div style={{fontSize:11,color:C.inkLight}}>Interval</div>
                    </div>
                    <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                      <div style={{fontSize:18,fontWeight:700,color:C.blue}}>{autoStatus?.history_count||0}</div>
                      <div style={{fontSize:11,color:C.inkLight}}>Runs Logged</div>
                    </div>
                    {autoStatus?.last_run&&(
                      <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                        <div style={{fontSize:12,fontWeight:700,color:C.ink}}>{new Date(autoStatus.last_run).toLocaleString()}</div>
                        <div style={{fontSize:11,color:C.inkLight}}>Last Run</div>
                      </div>
                    )}
                  </div>

                  {/* Layer fill status */}
                  {layerStatus&&(
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Layer Fill Status</div>
                      {Object.entries(layerStatus).map(([layer,ls])=>(
                        <div key={layer} style={{marginBottom:10}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                            <span style={{fontSize:12,fontWeight:700,color:C.ink}}>{layer==='real_world'?"JustAWoman's Feed":"Lala's Feed"}</span>
                            <span style={{fontSize:12,color:C.inkLight}}>{ls.total}/{ls.cap} ({ls.fill_pct}%)</span>
                          </div>
                          <div style={{height:8,borderRadius:4,background:C.surfaceAlt,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                            <div style={{height:'100%',borderRadius:4,background:layer==='real_world'?C.blue:C.lavender,width:`${ls.fill_pct}%`,transition:'width 0.3s'}}/>
                          </div>
                          <div style={{display:'flex',gap:12,marginTop:4}}>
                            <span style={{fontSize:10,color:C.inkLight}}>Generated: {ls.breakdown?.generated||0}</span>
                            <span style={{fontSize:10,color:C.inkLight}}>Finalized: {ls.breakdown?.finalized||0}</span>
                            <span style={{fontSize:10,color:C.inkLight}}>Crossed: {ls.breakdown?.crossed||0}</span>
                            <button onClick={()=>fillOneProfile(layer)} disabled={autoRunning||ls.remaining<=0} style={{fontSize:10,color:C.lavender,background:'transparent',border:'none',cursor:'pointer',fontWeight:700,marginLeft:'auto',opacity:autoRunning?0.5:1}}>
                              + Fill One
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sub-agent toggles */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Sub-Agents</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
                      {[
                        {key:'auto_fill_enabled',label:'Auto-Fill',desc:'Generate profiles to fill caps'},
                        {key:'auto_finalize_enabled',label:'Auto-Finalize',desc:'Lock high-relevance profiles'},
                        {key:'auto_relate_enabled',label:'Auto-Relate',desc:'Link relationships automatically'},
                        {key:'auto_follow_enabled',label:'Auto-Follow',desc:'Assign followers to new profiles'},
                        {key:'auto_cross_enabled',label:'Auto-Cross',desc:'Flag profiles ready for crossing'},
                        {key:'auto_discover_enabled',label:'Auto-Discover',desc:'Find potential relationships between profiles'},
                      ].map(a=>{
                        const enabled=autoStatus?.config?.[a.key]!==false;
                        return (
                          <div key={a.key} onClick={()=>updateAutoConfig({[a.key]:!enabled})} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:C.radiusSm,background:enabled?'#eef7ec':C.surfaceAlt,border:`1px solid ${enabled?'#c3e6cb':C.border}`,cursor:'pointer',transition:'all 0.15s'}}>
                            <div style={{width:14,height:14,borderRadius:3,background:enabled?'#22c55e':C.border,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#fff'}}>{enabled?'✓':''}</div>
                            <div>
                              <div style={{fontSize:12,fontWeight:700,color:C.ink}}>{a.label}</div>
                              <div style={{fontSize:10,color:C.inkLight}}>{a.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Config sliders */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
                    <div>
                      <label style={{fontSize:11,fontWeight:700,color:C.inkLight}}>Batch Size (per run)</label>
                      <select value={autoStatus?.config?.batch_size||5} onChange={e=>updateAutoConfig({batch_size:Number(e.target.value)})} style={{width:'100%',padding:'6px 10px',marginTop:4,borderRadius:C.radiusSm,border:`1px solid ${C.border}`,fontSize:12}}>
                        {[1,2,3,5,8,10,15,20].map(n=><option key={n} value={n}>{n} profiles</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:700,color:C.inkLight}}>Finalize Threshold</label>
                      <select value={autoStatus?.config?.finalize_threshold||7} onChange={e=>updateAutoConfig({finalize_threshold:Number(e.target.value)})} style={{width:'100%',padding:'6px 10px',marginTop:4,borderRadius:C.radiusSm,border:`1px solid ${C.border}`,fontSize:12}}>
                        {[5,6,7,8,9,10].map(n=><option key={n} value={n}>Relevance &ge; {n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:700,color:C.inkLight}}>Cross Threshold</label>
                      <select value={autoStatus?.config?.cross_threshold||9} onChange={e=>updateAutoConfig({cross_threshold:Number(e.target.value)})} style={{width:'100%',padding:'6px 10px',marginTop:4,borderRadius:C.radiusSm,border:`1px solid ${C.border}`,fontSize:12}}>
                        {[7,8,9,10].map(n=><option key={n} value={n}>Relevance &ge; {n}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Run History */}
                {autoHistory.length>0&&(
                  <div style={{background:C.surface,borderRadius:C.radius,border:`1px solid ${C.border}`,padding:20}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.ink,marginBottom:12}}>Recent Runs</div>
                    {autoHistory.map((run,i)=>(
                      <div key={i} style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,marginBottom:8}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                          <span style={{fontSize:12,fontWeight:700,color:C.ink}}>{new Date(run.ran_at).toLocaleString()}</span>
                          <span style={{fontSize:11,color:C.inkLight}}>{run.duration_ms}ms</span>
                        </div>
                        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                          <span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:'#eef7ec',color:'#22c55e'}}>+{run.summary?.profiles_created||0} created</span>
                          <span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:C.blueLight,color:C.blue}}>{run.summary?.profiles_finalized||0} finalized</span>
                          <span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:C.lavLight,color:C.lavender}}>{run.summary?.relationships_created||0} linked</span>
                          <span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:C.pinkLight,color:C.pink}}>{run.summary?.profiles_flagged||0} crossing-ready</span>
                          {(run.summary?.relationships_discovered||0)>0&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:'#e8f5e9',color:'#2e7d32'}}>{run.summary.relationships_discovered} discovered</span>}
                          {run.errors>0&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:8,background:'#fde8e8',color:'#ef4444'}}>{run.errors} errors</span>}
                        </div>
                        {run.layer_status&&(
                          <div style={{display:'flex',gap:16,marginTop:6}}>
                            <span style={{fontSize:10,color:C.inkLight}}>Real World: {run.layer_status.real_world?.count}/{run.layer_status.real_world?.cap}</span>
                            <span style={{fontSize:10,color:C.inkLight}}>LalaVerse: {run.layer_status.lalaverse?.count}/{run.layer_status.lalaverse?.cap}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
  </>;
}

export { Spinner };
