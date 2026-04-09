import React, { useState, useEffect } from 'react';
import {
  API, C, PLATFORMS, ARCHETYPE_LABELS, STATUS_LABELS, STATUS_COLORS,
  FEED_STATE_CONFIG, PROTAGONISTS, lalaClass, fp, authHeaders,
} from './feedConstants';

function FeedStatePicker({ profile, onStateChange }) {
  const [open,setOpen]   = useState(false);
  const [saving,setSaving] = useState(false);
  const current = profile.current_state;
  const cfg     = current?FEED_STATE_CONFIG[current]:null;
  const changeState = async newState=>{
    if(newState===current||saving)return;
    setSaving(true);
    try{
      const res=await fetch(`${API}/${profile.id}`,{method:'PATCH',headers:authHeaders(),body:JSON.stringify({current_state:newState})});
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'State change failed');}
      onStateChange?.(newState);
    }
    catch(err){console.error('State change failed:',err);alert('State change failed: '+(err.message||'Unknown error'));}
    finally{setSaving(false);setOpen(false);}
  };
  return (
    <div style={{position:'relative'}}>
      <button onClick={e=>{e.stopPropagation();setOpen(!open);}} style={{padding:'4px 12px',borderRadius:12,fontSize:11,fontWeight:700,cursor:'pointer',border:'none',
        background:cfg?cfg.bg:C.border,color:cfg?cfg.color:C.inkLight}}>
        {cfg?cfg.label:'Set State'} ▾
      </button>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:C.radiusSm,boxShadow:C.shadowMd,zIndex:100,minWidth:140,overflow:'hidden'}}>
          {Object.entries(FEED_STATE_CONFIG).map(([s,sc])=>(
            <button key={s} onClick={e=>{e.stopPropagation();changeState(s);}} disabled={saving} style={{width:'100%',padding:'7px 12px',textAlign:'left',fontSize:12,fontWeight:600,cursor:'pointer',border:'none',background:s===current?sc.bg:'transparent',color:sc.color,display:'block'}}>{sc.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// DETAIL PANEL
// ══════════════════════════════════════════════════════════════════════
function DetailPanel({ profile, fp: d, onClose, onFinalize, onCross, onEdit, onDelete, onRefresh,
  onRegenerate, regenerating, onLoadCrossingPreview, crossingPreview, setCrossingPreview,
  onLoadSceneContext, sceneContext, setSceneContext, onCopySceneContext, detailTab, setDetailTab,
  onApprove, onRejectCrossing, onSaveAsTemplate }) {
  const p = profile;
  const [editing,setEditing] = useState(false);
  const [draft,setDraft]     = useState({});
  const [followers,setFollowers] = useState(p.followers||[]);
  const [followLoading,setFollowLoading] = useState(null);

  useEffect(()=>{setFollowers(p.followers||[]);setSceneContext(null);setCrossingPreview(null);},[profile?.id]);

  const score = p.lala_relevance_score??d.lala_relevance_score??0;
  const lc    = lalaClass(score);
  const lColor = lc==='high'?C.lavender:lc==='mid'?C.blue:C.inkLight;

  const startEdit = ()=>{
    setDraft({ handle:p.handle||'', display_name:p.display_name||d.display_name||'', platform:p.platform||'', vibe_sentence:p.vibe_sentence||'', content_persona:p.content_persona||d.content_persona||'', real_signal:p.real_signal||d.real_signal||'', posting_voice:p.posting_voice||d.posting_voice||'', comment_energy:p.comment_energy||d.comment_energy||'', parasocial_function:p.parasocial_function||d.parasocial_function||'', emotional_activation:d.emotional_activation||p.emotional_activation||'', watch_reason:d.watch_reason||p.watch_reason||'', what_it_costs_her:d.what_it_costs_her||p.what_it_costs_her||'', current_trajectory:p.current_trajectory||d.current_trajectory||'', pinned_post:p.pinned_post||d.pinned_post||'' });
    setEditing(true);
  };

  const toggleFollow = async protag=>{
    setFollowLoading(protag.key);
    try{
      const isF=followers.some(f=>f.character_key===protag.key);
      if(isF){await fetch(`${API}/${p.id}/followers/${protag.key}`,{method:'DELETE',headers:authHeaders()});setFollowers(prev=>prev.filter(f=>f.character_key!==protag.key));}
      else{const res=await fetch(`${API}/${p.id}/followers`,{method:'POST',headers:authHeaders(),body:JSON.stringify({character_key:protag.key,character_name:protag.context.name})});const dt=await res.json();if(dt.follower)setFollowers(prev=>[...prev,dt.follower]);}
      if(onRefresh)onRefresh();
    }catch(err){console.error('Follow toggle error:',err);}
    finally{setFollowLoading(null);}
  };

  const Section = ({title,children})=>(
    <div style={{marginBottom:16}}>
      <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6,paddingBottom:4,borderBottom:`1px solid ${C.border}`}}>{title}</div>
      {children}
    </div>
  );
  const Field = ({label,value})=>value?(<div style={{marginBottom:6}}><div style={{fontSize:10,fontWeight:600,color:C.inkLight,marginBottom:2}}>{label}</div><div style={{fontSize:12,color:C.inkMid,lineHeight:1.6}}>{value}</div></div>):null;
  const inp=(label,key,multi)=>(
    <div style={{marginBottom:8}}>
      <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{label}</div>
      {multi?<textarea value={draft[key]||''} onChange={e=>setDraft(f=>({...f,[key]:e.target.value}))} rows={3} style={{width:'100%',padding:'7px 10px',borderRadius:C.radiusSm,border:`1.5px solid ${C.border}`,fontSize:12,color:C.ink,resize:'vertical',fontFamily:C.font,boxSizing:'border-box'}}/>
            :<input value={draft[key]||''} onChange={e=>setDraft(f=>({...f,[key]:e.target.value}))} style={{width:'100%',padding:'7px 10px',borderRadius:C.radiusSm,border:`1.5px solid ${C.border}`,fontSize:12,color:C.ink,fontFamily:C.font,boxSizing:'border-box'}}/>}
    </div>
  );

  return (
    <div style={{minHeight:'100%'}}>
      {/* Accent bar */}
      <div style={{height:4,background:`linear-gradient(90deg,${C.pink},${C.lavender},${C.blue})`}}/>
      {/* Header */}
      <div style={{padding:'16px 20px',borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8}}>
          <div>
            <div style={{fontSize:20,fontWeight:700,color:C.ink,marginBottom:2}}>{p.handle}</div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              {(p.display_name||d.display_name)&&<span style={{fontSize:13,color:C.inkMid}}>{p.display_name||d.display_name}</span>}
              <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:8,background:C.blueLight,color:C.blue}}>{p.platform}</span>
              {(p.archetype||d.archetype)&&<span style={{fontSize:11,color:C.inkLight}}>{ARCHETYPE_LABELS[p.archetype||d.archetype]||p.archetype||d.archetype}</span>}
              {p.adult_content_present&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:'#fde8e8',color:C.pink}}>18+ Content</span>}
              {p.feed_layer==='real_world'&&followers.some(f=>f.character_key==='lala')&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:C.blueLight,color:C.blue}}>◈ From JustAWoman's Feed — Lala follows</span>}
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:C.inkLight,lineHeight:1,flexShrink:0}}>×</button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <FeedStatePicker profile={p} onStateChange={(newState)=>{p.current_state=newState;onRefresh();}}/>
          {editing?(
            <>
              <button onClick={()=>{onEdit(p.id,draft);setEditing(false);}} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:700,background:'#e8f5ee',color:'#2d7a50',border:'none',cursor:'pointer'}}>✓ Save</button>
              <button onClick={()=>setEditing(false)} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.inkMid,border:`1px solid ${C.border}`,cursor:'pointer'}}>Cancel</button>
            </>
          ):(
            <>
              {p.status==='generated'&&<button onClick={()=>onFinalize(p.id)} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:700,background:'#e8f5ee',color:'#2d7a50',border:'none',cursor:'pointer'}}>✓ Finalize</button>}
              {p.status==='finalized'&&<button onClick={()=>{onLoadCrossingPreview(p.id);setDetailTab('crossing');}} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:700,background:C.lavLight,color:C.lavender,border:'none',cursor:'pointer'}}>⚡ Cross Into World</button>}
              {p.status==='crossed'&&<span style={{fontSize:11,color:C.lavender,fontWeight:600}}>✦ Crossed {p.crossed_at?`on ${new Date(p.crossed_at).toLocaleDateString()}`:''}</span>}
              <button onClick={()=>onRegenerate(p.id)} disabled={regenerating} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.blue,border:`1px solid ${C.blue}40`,cursor:regenerating?'not-allowed':'pointer'}}>
                {regenerating?'Regenerating…':'↻ Regenerate'}
              </button>
              <button onClick={startEdit} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.inkMid,border:`1px solid ${C.border}`,cursor:'pointer'}}>✎ Edit</button>
              {onSaveAsTemplate&&<button onClick={()=>onSaveAsTemplate(p.id)} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.blue,border:`1px solid ${C.blue}40`,cursor:'pointer'}}>⊞ Template</button>}
              <button onClick={()=>onDelete(p.id)} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:C.pink,border:`1px solid ${C.pinkMid}`,cursor:'pointer'}}>✕ Delete</button>
            </>
          )}
        </div>
      </div>

      {/* Detail tabs */}
      <div style={{display:'flex',gap:2,padding:'12px 20px 0',borderBottom:`1px solid ${C.border}`,background:C.surfaceAlt}}>
        {[['profile','Profile'],['intel','Intel'],['network','Network'],['scene','Scene'],['crossing','Crossing']].map(([k,l])=>(
          <button key={k} onClick={()=>{setDetailTab(k);if(k==='scene'&&!sceneContext)onLoadSceneContext(p.id);if(k==='crossing'&&!crossingPreview&&p.status!=='crossed')onLoadCrossingPreview(p.id);}} style={{
            padding:'8px 14px',fontSize:12,fontWeight:detailTab===k?700:500,cursor:'pointer',border:'none',borderBottom:`2px solid ${detailTab===k?C.lavender:'transparent'}`,
            background:'transparent',color:detailTab===k?C.lavender:C.inkLight,marginBottom:-1,transition:'all 0.15s'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ── */}
      {(detailTab==='profile') && (
        <>
          <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            {editing ? (
              <div style={{gridColumn:'1/-1'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 16px'}}>
                  {inp('Handle','handle')}{inp('Display Name','display_name')}{inp('Platform','platform')}{inp('Vibe Sentence','vibe_sentence')}
                </div>
                {inp('Content Persona','content_persona',true)}{inp('Real Signal','real_signal',true)}{inp('Posting Voice','posting_voice',true)}{inp('Comment Energy','comment_energy',true)}{inp('Parasocial Function','parasocial_function',true)}{inp('Emotional Activation','emotional_activation',true)}{inp('Why She Watches','watch_reason',true)}{inp('What It Costs Her','what_it_costs_her',true)}{inp('Trajectory','current_trajectory')}{inp('Pinned Post','pinned_post',true)}
              </div>
            ) : (
              <>
                {/* Platform Presence + Behind the Scenes */}
                {(p.platform_presences && Object.keys(p.platform_presences).length > 0) || p.public_persona || p.private_reality ? (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                    {p.platform_presences && Object.keys(p.platform_presences).length > 0 && (
                      <Section title="Platform Presences">
                        <div style={{display:'flex',flexDirection:'column',gap:4}}>
                          {Object.entries(p.platform_presences).map(([plat, info]) => (
                            <div key={plat} style={{padding:'6px 8px',background:plat===p.platform?'#eef2ff':'#f8f8f8',borderRadius:6,borderLeft:`3px solid ${plat==='onlyfans'?C.pink:plat===p.platform?C.lavender:'#ddd'}`}}>
                              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                <span style={{fontSize:11,fontWeight:700,color:C.ink}}>{plat}{info.is_primary?' ★':''}</span>
                                <span style={{fontSize:9,color:C.inkLight}}>{info.followers||''}</span>
                              </div>
                              {info.handle && <div style={{fontSize:10,color:C.inkMid}}>{info.handle}</div>}
                              <div style={{fontSize:10,color:C.inkLight,fontStyle:'italic'}}>{info.persona||info.content_style||''}</div>
                              {info.visibility==='discreet'&&<span style={{fontSize:8,fontWeight:700,padding:'1px 4px',borderRadius:3,background:'#fef3c7',color:'#92400e'}}>discreet</span>}
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}
                    <div>
                      {p.public_persona && <Section title="Public Persona"><div style={{fontSize:12,color:C.inkMid,lineHeight:1.6,fontStyle:'italic'}}>"{p.public_persona}"</div></Section>}
                      {p.private_reality && <Section title="Private Reality"><div style={{fontSize:12,color:C.pink,lineHeight:1.6}}>{p.private_reality}</div></Section>}
                      {p.front_platform && p.real_platform && p.front_platform !== p.real_platform && (
                        <div style={{fontSize:10,color:C.inkLight,padding:'4px 8px',background:'#fef2f2',borderRadius:6,marginTop:4}}>
                          Front: {p.front_platform} → Real: {p.real_platform}
                        </div>
                      )}
                      {p.celebrity_tier && p.celebrity_tier !== 'accessible' && (
                        <div style={{fontSize:10,fontWeight:700,color:p.celebrity_tier==='untouchable'?'#92400e':C.lavender,padding:'4px 8px',background:p.celebrity_tier==='untouchable'?'#fef3c7':'#eef2ff',borderRadius:6,marginTop:4}}>
                          {p.celebrity_tier==='untouchable'?'Cultural icon — never attends events':p.celebrity_tier==='exclusive'?'Exclusive — prestige 8+ events only':'Selective — prestige 5+ events'}
                        </div>
                      )}
                      {p.income_breakdown && Object.keys(p.income_breakdown).length > 0 && (
                        <Section title="Income Breakdown">
                          <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                            {Object.entries(p.income_breakdown).map(([src,pct])=>(
                              <span key={src} style={{fontSize:9,padding:'2px 6px',borderRadius:4,background:'#f0f0f0',color:C.inkMid}}>{src}: {pct}%</span>
                            ))}
                          </div>
                          {p.monthly_earnings_range && <div style={{fontSize:10,color:C.inkLight,marginTop:4}}>{p.monthly_earnings_range}/mo</div>}
                        </Section>
                      )}
                    </div>
                  </div>
                ) : null}

                <div>
                  <Section title="Content Persona"><div style={{fontSize:13,color:C.inkMid,lineHeight:1.7}}>{p.content_persona||d.content_persona}</div></Section>
                  <Section title="Real Signal"><div style={{fontSize:13,color:C.inkMid,lineHeight:1.7}}>{p.real_signal||d.real_signal}</div></Section>
                  <Section title="Posting Voice"><div style={{fontSize:13,color:C.inkMid,lineHeight:1.7}}>{p.posting_voice||d.posting_voice}</div></Section>
                  <Section title="Comment Energy"><div style={{fontSize:13,color:C.inkMid,lineHeight:1.7}}>{p.comment_energy||d.comment_energy}</div></Section>
                  {p.adult_content_present&&<Section title="Adult Content"><Field label="Type" value={p.adult_content_type||d.adult_content_type}/><Field label="Framing" value={p.adult_content_framing||d.adult_content_framing}/></Section>}
                </div>
                <div>
                  <Section title="Parasocial Function">
                    <div style={{fontSize:13,color:C.inkMid,lineHeight:1.7,marginBottom:8}}>{p.parasocial_function||d.parasocial_function}</div>
                    <Field label="Emotional Activation" value={d.emotional_activation||p.emotional_activation}/>
                    <Field label="Why She Watches" value={d.watch_reason||p.watch_reason}/>
                    <Field label="What It Costs Her" value={d.what_it_costs_her||p.what_it_costs_her}/>
                  </Section>
                  <Section title="Trajectory">
                    <div style={{fontSize:11,fontWeight:700,color:C.inkMid,marginBottom:4}}>{p.current_trajectory||d.current_trajectory}</div>
                    <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6}}>{p.trajectory_detail||d.trajectory_detail}</div>
                  </Section>
                  <Section title="Lala Relevance">
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                      <div style={{flex:1,height:6,borderRadius:3,background:C.border,overflow:'hidden'}}>
                        <div style={{height:'100%',borderRadius:3,background:lColor,width:`${score*10}%`,transition:'width 0.5s'}}/>
                      </div>
                      <span style={{fontSize:13,fontWeight:700,color:lColor,flexShrink:0}}>{score}/10</span>
                    </div>
                    <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6}}>{p.lala_relevance_reason||d.lala_relevance_reason}</div>
                  </Section>
                </div>
              </>
            )}
          </div>

          {/* Followers */}
          <div style={{padding:'0 20px 16px'}}>
            <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Character Followers</div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              {PROTAGONISTS.map(protag=>{
                const isF=followers.some(f=>f.character_key===protag.key);
                const fd=followers.find(f=>f.character_key===protag.key);
                const isL=followLoading===protag.key;
                return (
                  <button key={protag.key} onClick={()=>toggleFollow(protag)} disabled={isL} style={{
                    padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:700,cursor:'pointer',border:`1.5px solid ${isF?C.lavender:C.border}`,
                    background:isF?C.lavLight:'transparent',color:isF?C.lavender:C.inkMid,display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:16}}>{protag.icon}</span>
                    {isL?'…':isF?`${protag.context.name} follows`:`Add ${protag.context.name}`}
                    {fd?.follow_probability!=null&&<span style={{fontSize:10,opacity:0.7}}>{Math.round(fd.follow_probability*100)}%</span>}
                  </button>
                );
              })}
              {/* Dynamic character followers (not protagonists) */}
              {(()=>{const protagonistKeys=new Set(PROTAGONISTS.map(p=>p.key));const dynFollowers=followers.filter(f=>!protagonistKeys.has(f.character_key));return dynFollowers.map(f=>(
                <span key={f.character_key} style={{padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,
                  border:`1.5px solid ${C.border}`,background:'#e8f5e9',color:'#2e7d32',display:'inline-flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:14}}>👤</span> {f.character_name||f.character_key} follows
                  {f.follow_probability!=null&&<span style={{fontSize:10,opacity:0.7}}>{Math.round(f.follow_probability*100)}%</span>}
                </span>
              ));})()}
            </div>
            {followers.length>0&&(
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {followers.map(f=>(
                  <div key={f.character_key} style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,fontSize:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:f.follow_context?4:0}}>
                      <span style={{fontSize:15,color:f.character_key==='justawoman'?C.blue:C.lavender}}>{f.character_key==='justawoman'?'◈':'✦'}</span>
                      <span style={{fontWeight:700,color:C.ink}}>{f.character_name}</span>
                      {f.auto_generated&&<span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:4,background:C.blueLight,color:C.blue}}>auto</span>}
                      {f.follow_motivation&&<span style={{fontSize:10,color:C.inkLight,marginLeft:'auto'}}>{f.follow_motivation.replace('_',' ')}</span>}
                    </div>
                    {f.follow_context&&<div style={{color:C.inkMid,lineHeight:1.5,paddingLeft:22}}>{f.follow_context}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pinned post */}
          {(p.pinned_post||d.pinned_post)&&(
            <div style={{padding:'0 20px 16px'}}>
              <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Pinned Post</div>
              <div style={{padding:'10px 14px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.pink}`,fontSize:13,color:C.inkMid,lineHeight:1.6}}>
                <span style={{fontSize:11,fontWeight:700,color:C.pink,marginRight:6}}>📌</span>{p.pinned_post||d.pinned_post}
              </div>
            </div>
          )}

          {/* Sample captions */}
          {((p.sample_captions||d.sample_captions)||[]).length>0&&(
            <div style={{padding:'0 20px 16px'}}>
              <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Sample Captions</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {(p.sample_captions||d.sample_captions||[]).map((c,i)=>(
                  <div key={i} style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,borderLeft:`3px solid ${C.lavender}`,fontSize:12,color:C.inkMid,lineHeight:1.6}}>{c}</div>
                ))}
              </div>
            </div>
          )}

          {/* Moment log */}
          {((p.moment_log||d.moment_log)||[]).length>0&&(
            <div style={{padding:'0 20px 16px'}}>
              <div style={{fontSize:10,fontWeight:700,color:C.inkLight,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Moment Log</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {(p.moment_log||d.moment_log||[]).map((m,i)=>(
                  <div key={i} style={{padding:'10px 14px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.lavender,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:4}}>{m.moment_type} · {m.platform_format}</div>
                    <div style={{fontSize:12,color:C.ink,marginBottom:4}}>{m.description}</div>
                    <div style={{fontSize:11,color:C.inkMid,fontStyle:'italic',marginBottom:m.lala_seed?4:0}}>{m.protagonist_reaction||m.justawoman_reaction}</div>
                    {m.lala_seed&&<span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:8,background:C.lavLight,color:C.lavender}}>✦ Lala Seed — {m.lala_seed_reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── INTEL TAB — creator intel, aesthetic, revenue, known associates, controversies ── */}
      {detailTab==='intel' && (
        <div style={{padding:'16px 20px'}}>
          {/* Creator Intel Grid */}
          <Section title="Creator Intel">
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:8}}>
              {[
                ['📊','Post Frequency',p.post_frequency||d.post_frequency],
                ['💬','Engagement Rate',p.engagement_rate||d.engagement_rate],
                ['📍','Location',p.geographic_base||d.geographic_base],
                ['🎂','Age Range',p.age_range||d.age_range],
                ['💍','Relationship',p.relationship_status||d.relationship_status],
                ['🤝','Collab Style',p.collab_style||d.collab_style],
                ['📈','Tier Detail',p.influencer_tier_detail||d.influencer_tier_detail],
              ].filter(([,,v])=>v).map(([icon,label,val])=>(
                <div key={label} style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10,color:C.inkLight,marginBottom:2}}>{icon} {label}</div>
                  <div style={{fontSize:12,fontWeight:600,color:C.ink}}>{val}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Aesthetic DNA */}
          {(d.aesthetic_dna&&Object.keys(d.aesthetic_dna).length>0)&&(
            <Section title="Aesthetic DNA">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {d.aesthetic_dna.visual_style&&<div style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}><div style={{fontSize:10,color:C.inkLight,marginBottom:2}}>Visual Style</div><div style={{fontSize:12,color:C.ink}}>{d.aesthetic_dna.visual_style}</div></div>}
                {d.aesthetic_dna.color_palette&&<div style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`}}><div style={{fontSize:10,color:C.inkLight,marginBottom:2}}>Color Palette</div><div style={{fontSize:12,color:C.ink}}>{d.aesthetic_dna.color_palette}</div></div>}
                {d.aesthetic_dna.editing_style&&<div style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,gridColumn:'1/-1'}}><div style={{fontSize:10,color:C.inkLight,marginBottom:2}}>Editing Style</div><div style={{fontSize:12,color:C.ink}}>{d.aesthetic_dna.editing_style}</div></div>}
              </div>
              {(d.aesthetic_dna.vibe_tags||[]).length>0&&(
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:8}}>
                  {d.aesthetic_dna.vibe_tags.map((t,i)=>(
                    <span key={i} style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:C.lavLight,color:C.lavender}}>#{t.replace(/\s/g,'')}</span>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Revenue Streams */}
          {(p.revenue_streams||d.revenue_streams||[]).length>0&&(
            <Section title="Revenue Streams">
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {(p.revenue_streams||d.revenue_streams||[]).map((r,i)=>(
                  <div key={i} style={{padding:'6px 10px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,fontSize:12,color:C.ink}}>{typeof r==='string'?r:r.source||JSON.stringify(r)}</div>
                ))}
              </div>
            </Section>
          )}

          {/* Brand Partnerships */}
          {(p.brand_partnerships||d.brand_partnerships||[]).length>0&&(
            <Section title="Brand Partnerships">
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {(p.brand_partnerships||d.brand_partnerships||[]).map((bp,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,fontSize:12}}>
                    <span style={{fontWeight:600,color:C.ink}}>{bp.brand||'Unknown'}</span>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <span style={{fontSize:10,color:C.inkLight}}>{bp.type}</span>
                      {bp.visible===false&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:4,background:C.pinkLight,color:C.pink}}>hidden</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Audience Demographics */}
          {(d.audience_demographics&&Object.keys(d.audience_demographics).length>0)&&(
            <Section title="Audience Demographics">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {d.audience_demographics.primary_age&&<Field label="Primary Age" value={d.audience_demographics.primary_age}/>}
                {d.audience_demographics.gender_split&&<Field label="Gender Split" value={d.audience_demographics.gender_split}/>}
                {d.audience_demographics.psychographic&&<div style={{gridColumn:'1/-1'}}><Field label="Psychographic" value={d.audience_demographics.psychographic}/></div>}
              </div>
              {(d.audience_demographics.top_audience_locations||[]).length>0&&(
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:6}}>
                  {d.audience_demographics.top_audience_locations.map((loc,i)=>(
                    <span key={i} style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:C.blueLight,color:C.blue}}>📍 {loc}</span>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Controversy History */}
          {(p.controversy_history||d.controversy_history||[]).length>0&&(
            <Section title="Controversy History">
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {(p.controversy_history||d.controversy_history||[]).map((ch,i)=>{
                  const sevColor={minor:'#2d7a50',moderate:'#8a6010',major:'#c45858',career_threatening:'#8a2020'}[ch.severity]||C.inkMid;
                  return (
                    <div key={i} style={{padding:'10px 14px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,borderLeft:`3px solid ${sevColor}`}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <span style={{fontSize:10,fontWeight:700,color:sevColor,textTransform:'uppercase'}}>{ch.severity}</span>
                        {ch.date_approx&&<span style={{fontSize:10,color:C.inkLight}}>{ch.date_approx}</span>}
                        <span style={{fontSize:10,padding:'1px 6px',borderRadius:4,background:ch.resolved?'#e8f5ee':'#fde8e8',color:ch.resolved?'#2d7a50':'#8a2020',marginLeft:'auto'}}>{ch.resolved?'resolved':'ongoing'}</span>
                      </div>
                      <div style={{fontSize:12,color:C.ink,marginBottom:4}}>{ch.event}</div>
                      {ch.narrative_potential&&<div style={{fontSize:11,color:C.lavender,fontStyle:'italic'}}>{ch.narrative_potential}</div>}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Mirror Fields (JustAWoman) */}
          {d.justawoman_mirror&&Object.keys(d.justawoman_mirror).length>0&&(
            <Section title="JustAWoman Mirror">
              <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.pinkLight,border:`1px solid ${C.pink}40`}}>
                {Object.entries(d.justawoman_mirror).filter(([,v])=>v).map(([k,v])=>(
                  <div key={k} style={{marginBottom:6}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.pink,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:2}}>{k.replace(/_/g,' ')}</div>
                    <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6}}>{v}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ── NETWORK TAB — known associates and relationships ── */}
      {detailTab==='network' && (
        <div style={{padding:'16px 20px'}}>
          {/* Known Associates */}
          {(p.known_associates||d.known_associates||[]).length>0&&(
            <Section title="Known Associates">
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {(p.known_associates||d.known_associates||[]).map((a,i)=>(
                  <div key={i} style={{padding:'10px 14px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.ink}}>{a.handle}</div>
                      <div style={{fontSize:11,color:C.inkMid}}>{a.description}</div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
                      <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:8,background:C.blueLight,color:C.blue}}>{(a.relationship_type||'').replace(/_/g,' ')}</span>
                      {a.drama_level!=null&&<span style={{fontSize:10,color:a.drama_level>=7?C.pink:a.drama_level>=4?'#e67e22':C.inkLight}}>Drama: {a.drama_level}/10</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Sample Comments */}
          {((p.sample_comments||d.sample_comments)||[]).length>0&&(
            <Section title="Comment Section">
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {(p.sample_comments||d.sample_comments||[]).map((c,i)=>(
                  <div key={i} style={{padding:'8px 12px',borderRadius:C.radiusSm,background:C.surfaceAlt,border:`1px solid ${C.border}`,fontSize:12,color:C.inkMid,lineHeight:1.5}}>
                    <span style={{fontWeight:600,color:C.ink,marginRight:6}}>@user_{i+1}</span>{c}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Book Relevance */}
          {(p.book_relevance||d.book_relevance||[]).length>0&&(
            <Section title="Book Relevance">
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {(p.book_relevance||d.book_relevance||[]).map((r,i)=>(
                  <div key={i} style={{padding:'6px 10px',borderRadius:C.radiusSm,background:C.lavLight,border:`1px solid ${C.lavender}40`,fontSize:12,color:C.inkMid}}>✦ {r}</div>
                ))}
              </div>
            </Section>
          )}

          {(p.known_associates||d.known_associates||[]).length===0&&(p.sample_comments||d.sample_comments||[]).length===0&&(
            <div style={{textAlign:'center',padding:40,color:C.inkLight,fontSize:13}}>No network data available for this profile.</div>
          )}
        </div>
      )}

      {/* ── SCENE TAB — scene context for story engine injection ── */}
      {detailTab==='scene' && (
        <div style={{padding:'16px 20px'}}>
          <Section title="Scene Context">
            <div style={{fontSize:12,color:C.inkLight,marginBottom:12}}>Voice-safe formatted context for story engine injection. Author-knowledge fields are withheld.</div>
            {sceneContext?(
              <>
                <div style={{padding:'14px 16px',borderRadius:C.radiusSm,background:'#1a1625',color:'#d4d0e0',fontFamily:"'DM Mono', monospace",fontSize:11,lineHeight:1.7,whiteSpace:'pre-wrap',overflowX:'auto',maxHeight:400,overflowY:'auto',marginBottom:12}}>
                  {sceneContext}
                </div>
                <button onClick={onCopySceneContext} style={{padding:'8px 18px',borderRadius:C.radiusSm,fontSize:13,fontWeight:700,background:C.lavender,color:'#fff',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                  Copy to Clipboard
                </button>
              </>
            ):(
              <div style={{textAlign:'center',padding:30,color:C.inkLight}}><Spinner/> Loading scene context...</div>
            )}
          </Section>
        </div>
      )}

      {/* ── CROSSING TAB — preview what crossing creates ── */}
      {detailTab==='crossing' && (
        <div style={{padding:'16px 20px'}}>
          {p.status==='crossed'?(
            <div style={{textAlign:'center',padding:30}}>
              <div style={{fontSize:18,fontWeight:700,color:C.lavender,marginBottom:8}}>✦ Already Crossed</div>
              <div style={{fontSize:13,color:C.inkMid}}>This profile was crossed into the story world{p.crossed_at?` on ${new Date(p.crossed_at).toLocaleDateString()}`:''}</div>
            </div>
          ):crossingPreview?(
            <>
              <Section title="Crossing Preview">
                <div style={{fontSize:12,color:C.inkLight,marginBottom:12}}>This is what will be created in the Character Registry when you cross this profile.</div>
                <div style={{padding:'16px',borderRadius:C.radius,background:C.surfaceAlt,border:`2px dashed ${C.lavender}40`}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <Field label="Character Key" value={crossingPreview.character_key}/>
                    <Field label="Display Name" value={crossingPreview.display_name}/>
                    <Field label="Role Type" value={crossingPreview.role_type}/>
                    <Field label="Status" value={crossingPreview.status}/>
                    <div style={{gridColumn:'1/-1'}}><Field label="Description" value={crossingPreview.description}/></div>
                    <div style={{gridColumn:'1/-1'}}><Field label="Core Desire" value={crossingPreview.core_desire}/></div>
                    <div style={{gridColumn:'1/-1'}}><Field label="Core Wound" value={crossingPreview.core_wound}/></div>
                    <div style={{gridColumn:'1/-1'}}><Field label="Personality" value={crossingPreview.personality}/></div>
                  </div>
                </div>
              </Section>

              {crossingPreview.timeline_event&&(
                <Section title="Timeline Event">
                  <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.lavLight,border:`1px solid ${C.lavender}40`}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.ink,marginBottom:4}}>{crossingPreview.timeline_event.event_name}</div>
                    <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6,marginBottom:4}}>{crossingPreview.timeline_event.event_description}</div>
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:8,background:crossingPreview.timeline_event.impact_level==='major'?C.pinkLight:C.blueLight,color:crossingPreview.timeline_event.impact_level==='major'?C.pink:C.blue}}>
                      {crossingPreview.timeline_event.impact_level} impact
                    </span>
                  </div>
                </Section>
              )}

              {p.status==='finalized'&&(
                <>
                  {/* Crossing Approval Gate */}
                  {(()=>{
                    const approval=(p.full_profile||{})?._approval;
                    if(approval?.approved){
                      return(
                        <>
                          <div style={{padding:'10px 14px',borderRadius:C.radiusSm,background:'#e8f5ee',border:`1px solid #c3e6cb`,marginBottom:8,fontSize:12}}>
                            <span style={{fontWeight:700,color:'#2d7a50'}}>Approved for crossing</span>
                            {approval.approved_at&&<span style={{color:'#6b8a6b',marginLeft:8}}>{new Date(approval.approved_at).toLocaleDateString()}</span>}
                            {approval.approval_notes&&<div style={{color:'#4a6a4a',marginTop:4}}>{approval.approval_notes}</div>}
                          </div>
                          <button onClick={()=>onCross(p.id)} style={{width:'100%',padding:'12px',borderRadius:C.radiusSm,fontSize:14,fontWeight:700,background:C.lavender,color:'#fff',border:'none',cursor:'pointer'}}>
                            ⚡ Confirm Crossing Into World
                          </button>
                        </>
                      );
                    }
                    if(approval&&!approval.approved){
                      return(
                        <div style={{padding:'10px 14px',borderRadius:C.radiusSm,background:'#fde8e8',border:`1px solid #f5c6cb`,marginBottom:8,fontSize:12}}>
                          <span style={{fontWeight:700,color:'#8a2020'}}>Crossing rejected</span>
                          {approval.rejection_reason&&<div style={{color:'#6a3030',marginTop:4}}>{approval.rejection_reason}</div>}
                          <button onClick={()=>{const notes=prompt('Approval notes (optional):');if(notes!==null)onApprove(p.id,notes);}} style={{marginTop:8,padding:'6px 14px',borderRadius:C.radiusSm,fontSize:12,fontWeight:600,background:'transparent',color:'#2d7a50',border:`1px solid #c3e6cb`,cursor:'pointer'}}>Re-approve</button>
                        </div>
                      );
                    }
                    // No approval yet — show approve/reject buttons
                    return(
                      <div style={{display:'flex',gap:8,marginTop:8}}>
                        <button onClick={()=>{const notes=prompt('Approval notes (optional):');if(notes!==null)onApprove(p.id,notes);}} style={{flex:1,padding:'10px',borderRadius:C.radiusSm,fontSize:13,fontWeight:700,background:'#e8f5ee',color:'#2d7a50',border:`1px solid #c3e6cb`,cursor:'pointer'}}>
                          ✓ Approve for Crossing
                        </button>
                        <button onClick={()=>{const reason=prompt('Rejection reason:');if(reason!==null)onRejectCrossing(p.id,reason);}} style={{flex:1,padding:'10px',borderRadius:C.radiusSm,fontSize:13,fontWeight:700,background:'#fde8e8',color:'#8a2020',border:`1px solid #f5c6cb`,cursor:'pointer'}}>
                          ✕ Reject
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}
              {p.status!=='finalized'&&p.status!=='crossed'&&(
                <div style={{textAlign:'center',padding:12,fontSize:12,color:C.inkLight}}>Profile must be finalized before crossing.</div>
              )}
            </>
          ):(
            <div style={{textAlign:'center',padding:30,color:C.inkLight}}><Spinner/> Loading crossing preview...</div>
          )}

          {/* Crossing pathway info */}
          {(p.crossing_trigger||d.crossing_trigger)&&(
            <div style={{marginTop:16}}>
              <Section title="Crossing Pathway">
                <div style={{padding:'12px 16px',borderRadius:C.radiusSm,background:C.lavLight,border:`1px solid ${C.lavender}40`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.lavender,marginBottom:4}}>Trigger</div>
                  <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6,marginBottom:8}}>{p.crossing_trigger||d.crossing_trigger}</div>
                  <div style={{fontSize:11,fontWeight:700,color:C.lavender,marginBottom:4}}>Mechanism</div>
                  <div style={{fontSize:12,color:C.inkMid,lineHeight:1.6}}>{p.crossing_mechanism||d.crossing_mechanism}</div>
                </div>
              </Section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { DetailPanel, FeedStatePicker };
