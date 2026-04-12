import React from 'react';
import { C, ARCHETYPE_LABELS, STATUS_LABELS, STATUS_COLORS, FEED_STATE_CONFIG, fp, lalaClass } from './feedConstants';

export default function ProfileCard({ profile: p, selected, feedLayer, bulkMode, isChecked, onSelect, onToggle }) {
  const d = fp(p);
  const isActive = selected?.id === p.id;
  const sc = p.current_state && FEED_STATE_CONFIG[p.current_state];
  const stc = STATUS_COLORS[p.status] || STATUS_COLORS.draft;
  const score = p.lala_relevance_score ?? d.lala_relevance_score ?? 0;
  const lc = lalaClass(score);

  return (
    <div onClick={() => bulkMode ? onToggle(p.id) : onSelect(selected?.id === p.id ? null : p)}
      style={{ background: C.surface, borderRadius: C.radius, border: `2px solid ${isActive ? C.lavender : isChecked ? C.lavender + '80' : (feedLayer === 'lalaverse' && p.feed_layer === 'real_world') ? C.blue + '60' : C.border}`, cursor: 'pointer', overflow: 'hidden', boxShadow: isActive ? C.shadowMd : C.shadow, transition: 'all 0.15s', position: 'relative' }}>
      <div style={{ height: 3, background: (feedLayer === 'lalaverse' && p.feed_layer === 'real_world') ? `linear-gradient(90deg,${C.blue},${C.lavender})` : `linear-gradient(90deg,${C.pink},${C.lavender})` }} />
      {bulkMode && (
        <div style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 5, border: `2px solid ${isChecked ? C.lavender : C.border}`, background: isChecked ? C.lavender : C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
          {isChecked ? '✓' : ''}
        </div>
      )}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{p.creator_name || d.creator_name || p.handle}</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {sc && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: sc.bg, color: sc.color }}>{sc.label}</span>}
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: stc.bg, color: stc.color }}>{STATUS_LABELS[p.status] || p.status}</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.inkMid, marginBottom: 2 }}>{p.handle}{(p.display_name || d.display_name) && (p.creator_name || d.creator_name) && (p.display_name || d.display_name) !== (p.creator_name || d.creator_name) ? ` · ${p.display_name || d.display_name}` : !p.creator_name && !d.creator_name && (p.display_name || d.display_name) ? ` · ${p.display_name || d.display_name}` : ''}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: C.blueLight, color: C.blue }}>{p.platform}</span>
          {/* Multi-platform badges */}
          {p.platform_presences && Object.keys(p.platform_presences).filter(k => k !== p.platform).slice(0, 3).map(plat => (
            <span key={plat} style={{ fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 6, background: plat === 'onlyfans' ? '#fde8e8' : '#f0f0f0', color: plat === 'onlyfans' ? C.pink : C.inkLight }}>{p.platform_presences[plat]?.visibility === 'discreet' ? `${plat} ◇` : plat}</span>
          ))}
          {(p.archetype || d.archetype) && <span style={{ fontSize: 10, color: C.inkLight }}>{ARCHETYPE_LABELS[p.archetype || d.archetype] || p.archetype || d.archetype}</span>}
          {p.celebrity_tier && p.celebrity_tier !== 'accessible' && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: p.celebrity_tier === 'untouchable' ? '#fef3c7' : p.celebrity_tier === 'exclusive' ? '#e0e7ff' : '#f0fdf4', color: p.celebrity_tier === 'untouchable' ? '#92400e' : p.celebrity_tier === 'exclusive' ? '#3730a3' : '#065f46' }}>{p.celebrity_tier}</span>}
          {p.registry_character_id && <a href={`/character-registry?view=world&character=${p.registry_character_id}`} onClick={e => e.stopPropagation()} style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: '#eef0fb', color: '#6366f1', textDecoration: 'none' }} title="View in Character Registry">Registry →</a>}
          {p.adult_content_present && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: '#fde8e8', color: C.pink }}>18+</span>}
          {feedLayer === 'lalaverse' && p.feed_layer === 'real_world' && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: C.blueLight, color: C.blue }} title="From JustAWoman's Feed — Lala follows this account">◈ Following</span>}
        </div>
        {/* Public persona — what audiences think they do */}
        {p.public_persona && (
          <div style={{ fontSize: 10, color: C.inkLight, marginBottom: 4, fontStyle: 'italic' }}>"{p.public_persona}"</div>
        )}
        <div style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.content_persona || d.content_persona || p.vibe_sentence}
        </div>
        {/* Follow motivation + beauty */}
        {(p.follow_motivation || p.beauty_factor > 0 || p.event_excitement > 0) && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {p.follow_motivation && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: p.follow_motivation === 'aspiration' ? '#fef3c7' : p.follow_motivation === 'envy' ? '#fde8e8' : p.follow_motivation === 'competition' ? '#e0e7ff' : '#f0f0f0', color: p.follow_motivation === 'aspiration' ? '#92400e' : p.follow_motivation === 'envy' ? '#9d174d' : p.follow_motivation === 'competition' ? '#3730a3' : C.inkLight }}>{p.follow_motivation.replace('_', ' ')}</span>}
            {p.beauty_factor >= 7 && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: '#fce7f3', color: '#9d174d' }}>✧ {p.beauty_factor}/10</span>}
            {p.event_excitement >= 7 && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: '#fef3c7', color: '#92400e' }}>🔥 {p.event_excitement}</span>}
          </div>
        )}
        {(p.geographic_cluster || p.engagement_rate) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {p.geographic_cluster && <span style={{ fontSize: 10, color: C.inkLight }}>📍 {p.geographic_cluster}</span>}
            {p.engagement_rate && <span style={{ fontSize: 10, color: C.inkLight }}>💬 {p.engagement_rate}</span>}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: C.inkLight }}>{p.follower_count_approx || d.follower_count_approx || '—'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {p.followers?.length > 0 && (
              <div style={{ display: 'flex', gap: 3 }}>
                {p.followers.map(f => (
                  <span key={f.character_key} title={`${f.character_name} follows`} style={{ fontSize: 14, color: f.character_key === 'justawoman' ? C.blue : C.lavender }}>{f.character_key === 'justawoman' ? '◈' : '✦'}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 40, height: 3, borderRadius: 2, background: C.border, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 2, background: lc === 'high' ? C.lavender : lc === 'mid' ? C.blue : C.inkLight, width: `${score * 10}%` }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: lc === 'high' ? C.lavender : lc === 'mid' ? C.blue : C.inkLight }}>✦{score}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
