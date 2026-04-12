// frontend/src/components/Show/ShowDistributionTab.jsx
import React, { useState, useEffect } from 'react';

/**
 * ShowDistributionTab — Compact, status-first distribution dashboard
 *
 * Platform tiles show status at a glance. Click to expand configuration.
 * Hashtags inline. Template preview with real data. No info banners.
 */

const PLATFORMS = [
  { id: 'youtube', name: 'YouTube', icon: '📺', color: '#FF0000', aspect: '16:9', titleLimit: 100, descLimit: 5000 },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#000000', aspect: '9:16', titleLimit: 150, descLimit: 2200 },
  { id: 'instagram', name: 'Instagram', icon: '📸', color: '#E4405F', aspect: '9:16', titleLimit: 0, descLimit: 2200 },
  { id: 'facebook', name: 'Facebook', icon: '👥', color: '#1877F2', aspect: '1:1', titleLimit: 255, descLimit: 63206 },
];

const S = {
  label: { fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 3, display: 'block' },
  input: { width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, outline: 'none', background: '#fafafa', boxSizing: 'border-box', fontFamily: 'inherit' },
  hint: { fontSize: 9, color: '#94a3b8', marginTop: 2, display: 'block' },
};

function ShowDistributionTab({ show, onUpdate }) {
  const [defaults, setDefaults] = useState({});
  const [expandedPlatform, setExpandedPlatform] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadDefaults(); }, [show.id]);

  const loadDefaults = async () => {
    let data = null;
    if (show.distribution_defaults) {
      data = typeof show.distribution_defaults === 'string' ? JSON.parse(show.distribution_defaults) : show.distribution_defaults;
    }
    if (!data || Object.keys(data).length === 0) {
      try {
        const res = await fetch(`/api/v1/world/${show.id}/distribution-defaults`);
        const json = await res.json();
        if (json.success && json.data && Object.keys(json.data).length > 0) data = json.data;
      } catch { /* fall through */ }
    }
    if (data && Object.keys(data).length > 0) {
      setDefaults(data);
    } else {
      const d = {};
      PLATFORMS.forEach(p => { d[p.id] = { enabled: false, account_name: '', account_url: '', default_hashtags: [], default_description_template: '', auto_publish: false }; });
      setDefaults(d);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/v1/world/${show.id}/distribution-defaults`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distribution_defaults: defaults }),
      });
      setHasChanges(false);
    } catch {
      try { await onUpdate({ distribution_defaults: JSON.stringify(defaults) }); setHasChanges(false); } catch { /* fail */ }
    }
    setSaving(false);
  };

  const update = (pid, field, value) => {
    setDefaults(prev => ({ ...prev, [pid]: { ...prev[pid], [field]: value } }));
    setHasChanges(true);
  };

  const togglePlatform = (pid) => update(pid, 'enabled', !defaults[pid]?.enabled);

  const addHashtag = (pid, tag) => {
    const current = defaults[pid]?.default_hashtags || [];
    if (tag && !current.includes(tag)) update(pid, 'default_hashtags', [...current, tag]);
  };

  const removeHashtag = (pid, tag) => {
    update(pid, 'default_hashtags', (defaults[pid]?.default_hashtags || []).filter(h => h !== tag));
  };

  const enabledCount = PLATFORMS.filter(p => defaults[p.id]?.enabled).length;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>Distribution</h2>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
            {enabledCount}/4 platforms configured · Defaults apply to all episodes
          </p>
        </div>
        <button onClick={handleSave} disabled={!hasChanges || saving} style={{
          padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: hasChanges ? 'pointer' : 'default',
          background: hasChanges ? '#B8962E' : '#e2e8f0', color: hasChanges ? '#fff' : '#94a3b8',
        }}>
          {saving ? 'Saving...' : hasChanges ? '💾 Save' : 'Saved'}
        </button>
      </div>

      {/* Platform Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {PLATFORMS.map(p => {
          const pd = defaults[p.id] || {};
          const isExpanded = expandedPlatform === p.id;
          return (
            <div key={p.id}
              onClick={() => setExpandedPlatform(isExpanded ? null : p.id)}
              style={{
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${isExpanded ? p.color : pd.enabled ? p.color + '40' : '#e2e8f0'}`,
                background: pd.enabled ? `${p.color}08` : '#fafafa',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{p.icon}</span>
                <div onClick={e => { e.stopPropagation(); togglePlatform(p.id); }} style={{
                  width: 28, height: 16, borderRadius: 8, cursor: 'pointer',
                  background: pd.enabled ? p.color : '#d1d5db', position: 'relative', transition: 'background 0.15s',
                }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 2, left: pd.enabled ? 14 : 2, transition: 'left 0.15s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{p.name}</div>
              <div style={{ fontSize: 10, color: pd.enabled ? p.color : '#94a3b8', marginTop: 1 }}>
                {pd.enabled ? (pd.account_name ? `@${pd.account_name}` : 'Configured') : 'Not set up'}
              </div>
              {pd.enabled && (pd.default_hashtags?.length > 0) && (
                <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 3 }}>
                  {pd.default_hashtags.length} hashtags
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded Platform Config */}
      {expandedPlatform && (() => {
        const p = PLATFORMS.find(pl => pl.id === expandedPlatform);
        const pd = defaults[expandedPlatform] || {};
        if (!p) return null;

        return (
          <div style={{
            border: `1px solid ${p.color}30`, borderRadius: 10, padding: 16, marginBottom: 16,
            background: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{p.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{p.name} Defaults</span>
                <span style={{ fontSize: 9, padding: '2px 6px', background: '#f1f5f9', borderRadius: 4, color: '#64748b', fontWeight: 600 }}>{p.aspect}</span>
              </div>
              <button onClick={() => setExpandedPlatform(null)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            {!pd.enabled ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px' }}>Enable {p.name} to configure defaults</p>
                <button onClick={() => togglePlatform(expandedPlatform)} style={{
                  padding: '6px 20px', borderRadius: 6, border: 'none', background: p.color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>Enable {p.name}</button>
              </div>
            ) : (
              <div>
                {/* Account + Template — two columns */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={S.label}>Account Handle</label>
                    <input value={pd.account_name || ''} onChange={e => update(expandedPlatform, 'account_name', e.target.value)}
                      placeholder={`@${show.name.toLowerCase().replace(/\s+/g, '')}`} style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Account URL</label>
                    <input value={pd.account_url || ''} onChange={e => update(expandedPlatform, 'account_url', e.target.value)}
                      placeholder={`https://${p.id}.com/...`} style={S.input} />
                  </div>
                </div>

                {/* Description Template */}
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Description Template</label>
                  <textarea value={pd.default_description_template || ''} onChange={e => update(expandedPlatform, 'default_description_template', e.target.value)}
                    placeholder={`Default ${p.name} description...\nUse {{episode_title}} and {{episode_number}} as placeholders.`}
                    rows={3} style={{ ...S.input, resize: 'vertical', lineHeight: 1.5 }} />
                  <small style={S.hint}>{'{{episode_title}}'} and {'{{episode_number}}'} auto-replace per episode · {p.titleLimit > 0 ? `Title: ${p.titleLimit} chars` : ''} Desc: {p.descLimit.toLocaleString()} chars</small>
                </div>

                {/* Hashtags */}
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Default Hashtags</label>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                    {(pd.default_hashtags || []).map(tag => (
                      <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', background: `${p.color}12`, color: p.color, borderRadius: 10, fontSize: 10, fontWeight: 600 }}>
                        {tag}
                        <button onClick={() => removeHashtag(expandedPlatform, tag)} style={{ background: 'none', border: 'none', color: p.color, cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <input placeholder="Add hashtag + Enter" style={{ ...S.input, width: 200 }} onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      let v = e.target.value.trim();
                      if (v && !v.startsWith('#')) v = '#' + v;
                      if (v.length > 1) { addHashtag(expandedPlatform, v); e.target.value = ''; }
                    }
                  }} />
                </div>

                {/* Auto-publish toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={pd.auto_publish || false} onChange={e => update(expandedPlatform, 'auto_publish', e.target.checked)} />
                  <span style={{ fontSize: 11, color: '#64748b' }}>Auto-publish when episode is marked "Published"</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* All Hashtags Summary */}
      {(() => {
        const allTags = [...new Set(PLATFORMS.flatMap(p => defaults[p.id]?.default_hashtags || []))];
        if (allTags.length === 0) return null;
        return (
          <div style={{ padding: '10px 14px', background: '#f8f8f8', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Show Hashtags (across all platforms)</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {allTags.map(tag => (
                <span key={tag} style={{ padding: '2px 8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 10, color: '#1a1a2e', fontWeight: 500 }}>{tag}</span>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default ShowDistributionTab;
