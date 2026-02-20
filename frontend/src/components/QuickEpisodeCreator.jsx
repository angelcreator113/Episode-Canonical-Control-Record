/**
 * QuickEpisodeCreator — Single-Page Episode Setup
 * 
 * Collapses: CreateEpisode + WorldAdmin Event + Event Injection + Script Skeleton
 * into ONE streamlined form.
 * 
 * Flow:
 *   1. Pick show (auto-detected if only one)
 *   2. Episode basics (title, number, season, description)
 *   3. Event setup (name, type, dress code, prestige, cost, stakes)
 *   4. Click "Create Episode" → creates episode + event + injects event + generates script skeleton
 *   5. Redirects to episode detail page ready for wardrobe + evaluate
 * 
 * Route: /shows/:showId/quick-episode
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const STORAGE_KEY_PREFIX = 'quick_episode_draft_';

// ─── PRESET EVENT TEMPLATES ───
const EVENT_PRESETS = [
  { 
    label: '🥂 Cocktail Party', event_type: 'cocktail', dress_code: 'cocktail elegant',
    dress_code_keywords: ['elegant', 'cocktail', 'sophisticated', 'chic'],
    prestige: 5, strictness: 4, cost: 50,
  },
  { 
    label: '🌸 Garden Soirée', event_type: 'garden', dress_code: 'romantic garden casual',
    dress_code_keywords: ['romantic', 'garden', 'casual', 'floral', 'soft', 'feminine'],
    prestige: 5, strictness: 4, cost: 75,
  },
  { 
    label: '🎨 Art Gallery Opening', event_type: 'gallery', dress_code: 'avant-garde artistic',
    dress_code_keywords: ['artistic', 'avant-garde', 'bold', 'modern', 'edgy'],
    prestige: 7, strictness: 6, cost: 100,
  },
  { 
    label: '💎 Gala / Black Tie', event_type: 'gala', dress_code: 'black tie formal',
    dress_code_keywords: ['formal', 'black-tie', 'luxury', 'glamorous', 'elite'],
    prestige: 9, strictness: 8, cost: 200,
  },
  { 
    label: '☕ Casual Brunch', event_type: 'brunch', dress_code: 'casual chic',
    dress_code_keywords: ['casual', 'relaxed', 'chic', 'daytime', 'light'],
    prestige: 3, strictness: 2, cost: 25,
  },
  { 
    label: '🎵 Music Event', event_type: 'concert', dress_code: 'edgy nightlife',
    dress_code_keywords: ['edgy', 'nightlife', 'bold', 'dark', 'streetwear'],
    prestige: 6, strictness: 5, cost: 80,
  },
  { 
    label: '📸 Brand Launch', event_type: 'brand_launch', dress_code: 'luxury brand aligned',
    dress_code_keywords: ['luxury', 'brand', 'polished', 'high-fashion', 'curated'],
    prestige: 8, strictness: 7, cost: 150,
  },
  { 
    label: '✏️ Custom Event', event_type: '', dress_code: '',
    dress_code_keywords: [], prestige: 5, strictness: 5, cost: 50,
  },
];

// ─── NARRATIVE STAKES TEMPLATES ───
const STAKES_PRESETS = [
  "First impression — Lala needs to prove herself",
  "Comeback after a disaster — reputation on the line",
  "Trying to impress a specific person or brand",
  "Infiltrating a circle above her current status",
  "Relaxed vibes — low pressure, chance to experiment",
  "Everything is going right — maintain momentum",
  "Running low on coins — must style smart with owned items",
];

export default function QuickEpisodeCreator() {
  const { showId } = useParams();
  const navigate = useNavigate();

  // ─── State ───
  const [show, setShow] = useState(null);
  const [charState, setCharState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [lastEpisode, setLastEpisode] = useState(null);

  // Episode fields
  const [title, setTitle] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [season, setSeason] = useState(1);
  const [description, setDescription] = useState('');

  // Event fields
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState('');
  const [dressCode, setDressCode] = useState('');
  const [dressCodeKeywords, setDressCodeKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [prestige, setPrestige] = useState(5);
  const [strictness, setStrictness] = useState(5);
  const [cost, setCost] = useState(50);
  const [hostBrand, setHostBrand] = useState('');
  const [narrativeStakes, setNarrativeStakes] = useState('');
  const [inviteType, setInviteType] = useState('invite');
  const [isFree, setIsFree] = useState(false);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'restored'
  const saveTimerRef = useRef(null);
  const isRestoringRef = useRef(false);
  const storageKey = `${STORAGE_KEY_PREFIX}${showId}`;

  // ─── Restore draft from localStorage on mount ───
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const draft = JSON.parse(saved);
        isRestoringRef.current = true;
        if (draft.title) setTitle(draft.title);
        if (draft.description) setDescription(draft.description);
        if (draft.selectedPreset) setSelectedPreset(draft.selectedPreset);
        if (draft.eventName) setEventName(draft.eventName);
        if (draft.eventType) setEventType(draft.eventType);
        if (draft.dressCode) setDressCode(draft.dressCode);
        if (draft.dressCodeKeywords) setDressCodeKeywords(draft.dressCodeKeywords);
        if (draft.prestige != null) setPrestige(draft.prestige);
        if (draft.strictness != null) setStrictness(draft.strictness);
        if (draft.cost != null) setCost(draft.cost);
        if (draft.hostBrand) setHostBrand(draft.hostBrand);
        if (draft.narrativeStakes) setNarrativeStakes(draft.narrativeStakes);
        if (draft.inviteType) setInviteType(draft.inviteType);
        if (draft.isFree) setIsFree(draft.isFree);
        // Don't restore episodeNumber/season — those come from API
        setSaveStatus('restored');
        setTimeout(() => {
          isRestoringRef.current = false;
          setSaveStatus(null);
        }, 2000);
      }
    } catch { /* corrupted storage — ignore */ }
  }, [storageKey]);

  // ─── Auto-save to localStorage (debounced 800ms) ───
  const saveDraft = useCallback(() => {
    if (isRestoringRef.current) return;
    const draft = {
      title, description, selectedPreset, eventName, eventType,
      dressCode, dressCodeKeywords, prestige, strictness, cost,
      hostBrand, narrativeStakes, inviteType, isFree,
      savedAt: new Date().toISOString(),
    };
    // Only save if there's meaningful content
    if (title || eventName || description || dressCode) {
      setSaveStatus('saving');
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch { /* storage full — ignore */ }
      setTimeout(() => setSaveStatus('saved'), 300);
      setTimeout(() => setSaveStatus(null), 2500);
    }
  }, [title, description, selectedPreset, eventName, eventType, dressCode,
      dressCodeKeywords, prestige, strictness, cost, hostBrand,
      narrativeStakes, inviteType, isFree, storageKey]);

  useEffect(() => {
    if (isRestoringRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveDraft, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [saveDraft]);

  // ─── Clear draft ───
  const clearDraft = () => {
    localStorage.removeItem(storageKey);
    setSaveStatus(null);
  };

  // ─── Load show + character state + last episode number ───
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Get show
        const showRes = await api.get(`/api/v1/shows/${showId}`);
        setShow(showRes.data?.show || showRes.data);

        // Get character state
        try {
          const csRes = await api.get(`/api/v1/characters/lala/state?show_id=${showId}`);
          setCharState(csRes.data?.state || csRes.data);
        } catch { setCharState({ coins: 0, reputation: 1, stress: 0 }); }

        // Get last episode number
        try {
          const epsRes = await api.get(`/api/v1/episodes?show_id=${showId}&limit=1&sort=episode_number&order=DESC`);
          const eps = epsRes.data?.episodes || epsRes.data?.rows || [];
          if (eps.length > 0) {
            setLastEpisode(eps[0]);
            setEpisodeNumber(String((eps[0].episode_number || 0) + 1));
            setSeason(eps[0].season_number || eps[0].season || 1);
          } else {
            setEpisodeNumber('1');
          }
        } catch { setEpisodeNumber('1'); }
      } catch (err) {
        setError('Failed to load show data');
      } finally { setLoading(false); }
    };
    load();
  }, [showId]);

  // ─── Apply preset ───
  const applyPreset = (preset) => {
    setSelectedPreset(preset.label);
    setEventType(preset.event_type);
    setDressCode(preset.dress_code);
    setDressCodeKeywords([...preset.dress_code_keywords]);
    setPrestige(preset.prestige);
    setStrictness(preset.strictness);
    setCost(preset.cost);
  };

  // ─── Keyword management ───
  const addKeyword = () => {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !dressCodeKeywords.includes(kw)) {
      setDressCodeKeywords([...dressCodeKeywords, kw]);
    }
    setKeywordInput('');
  };

  // ─── CREATE EVERYTHING ───
  const handleCreate = async () => {
    if (!title.trim()) { setError('Episode title is required'); return; }
    if (!eventName.trim()) { setError('Event name is required'); return; }

    setCreating(true);
    setError(null);

    try {
      // 1. Create Episode
      const epRes = await api.post('/api/v1/episodes', {
        title: title.trim(),
        show_id: showId,
        season_number: season,
        episode_number: parseInt(episodeNumber) || 1,
        description: description.trim(),
        status: 'draft',
        episode_type: 'regular',
      });
      const episode = epRes.data?.data || epRes.data?.episode || epRes.data;
      const episodeId = episode?.id;
      if (!episodeId) throw new Error('Episode created but no ID returned');

      // 2. Create Event
      const evRes = await api.post(`/api/v1/world/${showId}/events`, {
        show_id: showId,
        name: eventName.trim(),
        event_type: eventType,
        invite_type: inviteType,
        dress_code: dressCode,
        dress_code_keywords: dressCodeKeywords,
        prestige: prestige,
        strictness: strictness,
        cost: isFree ? 0 : cost,
        is_paid: false,
        host_brand: hostBrand,
        narrative_stakes: narrativeStakes,
        location: '',
      });
      const event = evRes.data?.event || evRes.data;

      // 3. Inject event into episode
      try {
        await api.post(`/api/v1/world/${showId}/events/${event.id}/inject`, {
          episode_id: episodeId,
        });
      } catch (injectErr) {
        // Try alternate inject method
        try {
          await api.put(`/api/v1/world/${showId}/events/${event.id}`, {
            episode_id: episodeId,
          });
        } catch { /* event created but not injected — not fatal */ }
      }

      // 4. Generate script skeleton with [EVENT:] tag
      const scriptContent = generateScriptSkeleton(title, eventName, dressCode, narrativeStakes);
      try {
        await api.put(`/api/v1/episodes/${episodeId}`, {
          script_content: scriptContent,
        });
      } catch { /* script save failed — not fatal */ }

      // 5. Clear draft and navigate to episode detail
      clearDraft();
      navigate(`/episodes/${episodeId}`);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to create episode');
    } finally {
      setCreating(false);
    }
  };

  // ─── Script skeleton generator ───
  function generateScriptSkeleton(epTitle, evName, dresscode, stakes) {
    return `[EVENT: ${evName} | Dress Code: ${dresscode} | Stakes: ${stakes || 'Standard'}]

# ${epTitle}

## COLD OPEN
Lala prepares for ${evName}. ${stakes || 'The pressure is on.'}

## WARDROBE MOMENT
She opens the closet. The dress code is ${dresscode}.
What she wears tonight will matter.

## THE EVENT
Lala arrives at ${evName}.
[Scene: arrival, first impressions, social dynamics]

## THE TURNING POINT
[Scene: key moment that defines the episode outcome]

## AFTERMATH
[Scene: consequences, reflection, stat changes]
`;
  }

  // ─── RENDER ───
  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.loadingBox}>
          <div style={{ fontSize: 32 }}>⚡</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.headerLabel}>QUICK CREATE</div>
          <div style={S.headerTitle}>New Episode</div>
          <div style={S.headerSub}>{show?.title || show?.name || 'Show'} · Season {season}</div>
        </div>
        {charState && (
          <div style={S.statsBox}>
            <div style={S.statItem}>🪙 <strong>{charState.coins ?? 0}</strong></div>
            <div style={S.statItem}>⭐ <strong>{charState.reputation ?? 1}</strong></div>
            <div style={S.statItem}>😤 <strong>{charState.stress ?? 0}</strong></div>
          </div>
        )}
      </div>

      {/* Save status indicator */}
      <div style={S.saveBar}>
        {saveStatus === 'restored' && (
          <span style={{ color: '#6366f1' }}>Draft restored</span>
        )}
        {saveStatus === 'saving' && (
          <span style={{ color: '#94a3b8' }}>Saving...</span>
        )}
        {saveStatus === 'saved' && (
          <span style={{ color: '#22c55e' }}>Draft saved</span>
        )}
        {!saveStatus && localStorage.getItem(storageKey) && (
          <span style={{ color: '#94a3b8' }}>Draft auto-saved</span>
        )}
        {localStorage.getItem(storageKey) && (
          <button onClick={() => {
            clearDraft();
            setTitle(''); setDescription(''); setSelectedPreset(null);
            setEventName(''); setEventType(''); setDressCode('');
            setDressCodeKeywords([]); setPrestige(5); setStrictness(5);
            setCost(50); setHostBrand(''); setNarrativeStakes('');
            setInviteType('invite'); setIsFree(false);
          }} style={S.clearBtn}>Clear Draft</button>
        )}
      </div>

      {error && (
        <div style={S.errorBanner}>
          {error}
          <button onClick={() => setError(null)} style={S.xBtn}>✕</button>
        </div>
      )}

      {/* ═══ SECTION 1: EPISODE BASICS ═══ */}
      <div style={S.section}>
        <div style={S.sectionHeader}>
          <span style={S.sectionNum}>1</span>
          <span style={S.sectionLabel}>Episode</span>
        </div>

        <div style={S.fieldRow}>
          <div style={S.fieldHalf}>
            <label style={S.label}>Episode # *</label>
            <input type="number" value={episodeNumber} onChange={e => setEpisodeNumber(e.target.value)}
              style={S.input} min="1" />
          </div>
          <div style={S.fieldHalf}>
            <label style={S.label}>Season</label>
            <input type="number" value={season} onChange={e => setSeason(parseInt(e.target.value) || 1)}
              style={S.input} min="1" />
          </div>
        </div>

        <div style={S.field}>
          <label style={S.label}>Title *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            style={S.input} placeholder="e.g. The Comeback Garden" />
        </div>

        <div style={S.field}>
          <label style={S.label}>Episode Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            style={{ ...S.input, minHeight: 60, resize: 'vertical' }}
            placeholder="What's the narrative context? Where is Lala emotionally?" />
        </div>
      </div>

      {/* ═══ SECTION 2: EVENT SETUP ═══ */}
      <div style={S.section}>
        <div style={S.sectionHeader}>
          <span style={S.sectionNum}>2</span>
          <span style={S.sectionLabel}>Event</span>
        </div>

        {/* Preset buttons */}
        <div style={S.field}>
          <label style={S.label}>Quick Preset</label>
          <div style={S.presetGrid}>
            {EVENT_PRESETS.map((p, i) => (
              <button key={i} onClick={() => applyPreset(p)}
                style={{
                  ...S.presetBtn,
                  background: selectedPreset === p.label ? '#6366f1' : '#f8fafc',
                  color: selectedPreset === p.label ? '#fff' : '#1a1a2e',
                  border: selectedPreset === p.label ? '2px solid #6366f1' : '1px solid #e2e8f0',
                }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={S.field}>
          <label style={S.label}>Event Name *</label>
          <input type="text" value={eventName} onChange={e => setEventName(e.target.value)}
            style={S.input} placeholder="e.g. Velour Society Garden Soirée" />
        </div>

        <div style={S.fieldRow}>
          <div style={S.fieldThird}>
            <label style={S.label}>Prestige</label>
            <div style={S.sliderRow}>
              <input type="range" min="1" max="10" value={prestige}
                onChange={e => setPrestige(parseInt(e.target.value))} style={S.slider} />
              <span style={S.sliderVal}>{prestige}</span>
            </div>
          </div>
          <div style={S.fieldThird}>
            <label style={S.label}>Strictness</label>
            <div style={S.sliderRow}>
              <input type="range" min="1" max="10" value={strictness}
                onChange={e => setStrictness(parseInt(e.target.value))} style={S.slider} />
              <span style={S.sliderVal}>{strictness}</span>
            </div>
          </div>
          <div style={S.fieldThird}>
            <label style={S.label}>Cost</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="number" value={isFree ? 0 : cost}
                onChange={e => setCost(parseInt(e.target.value) || 0)}
                style={{ ...S.input, width: 80 }} disabled={isFree} />
              <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={isFree} onChange={e => setIsFree(e.target.checked)} />
                Free
              </label>
            </div>
          </div>
        </div>

        <div style={S.fieldRow}>
          <div style={S.fieldHalf}>
            <label style={S.label}>Dress Code</label>
            <input type="text" value={dressCode} onChange={e => setDressCode(e.target.value)}
              style={S.input} placeholder="romantic garden casual" />
          </div>
          <div style={S.fieldHalf}>
            <label style={S.label}>Event Type</label>
            <input type="text" value={eventType} onChange={e => setEventType(e.target.value)}
              style={S.input} placeholder="garden, gala, brunch..." />
          </div>
        </div>

        {/* Keywords */}
        <div style={S.field}>
          <label style={S.label}>Dress Code Keywords</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input type="text" value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
              style={{ ...S.input, flex: 1 }} placeholder="Add keyword, press Enter" />
            <button onClick={addKeyword} style={S.addBtn}>+</button>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {dressCodeKeywords.map((kw, i) => (
              <span key={i} style={S.chip}>
                {kw}
                <button onClick={() => setDressCodeKeywords(dressCodeKeywords.filter((_, j) => j !== i))}
                  style={S.chipX}>×</button>
              </span>
            ))}
          </div>
        </div>

        <div style={S.fieldRow}>
          <div style={S.fieldHalf}>
            <label style={S.label}>Host / Brand</label>
            <input type="text" value={hostBrand} onChange={e => setHostBrand(e.target.value)}
              style={S.input} placeholder="Velour, Chanel..." />
          </div>
          <div style={S.fieldHalf}>
            <label style={S.label}>Invite Type</label>
            <select value={inviteType} onChange={e => setInviteType(e.target.value)} style={S.input}>
              <option value="invite">Invite</option>
              <option value="open">Open</option>
              <option value="exclusive">Exclusive</option>
              <option value="vip">VIP</option>
            </select>
          </div>
        </div>

        {/* Narrative stakes */}
        <div style={S.field}>
          <label style={S.label}>Narrative Stakes</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {STAKES_PRESETS.map((s, i) => (
              <button key={i} onClick={() => setNarrativeStakes(s)}
                style={{
                  ...S.stakeBtn,
                  background: narrativeStakes === s ? '#eef2ff' : '#fff',
                  border: narrativeStakes === s ? '1px solid #6366f1' : '1px solid #e2e8f0',
                  color: narrativeStakes === s ? '#6366f1' : '#64748b',
                }}>
                {s}
              </button>
            ))}
          </div>
          <textarea value={narrativeStakes} onChange={e => setNarrativeStakes(e.target.value)}
            style={{ ...S.input, minHeight: 40, resize: 'vertical' }}
            placeholder="Or write custom stakes..." />
        </div>
      </div>

      {/* ═══ PREVIEW SUMMARY ═══ */}
      <div style={S.preview}>
        <div style={S.previewHeader}>📋 Preview</div>
        <div style={S.previewGrid}>
          <div><strong>Episode {episodeNumber}:</strong> {title || '—'}</div>
          <div><strong>Event:</strong> {eventName || '—'}</div>
          <div><strong>Dress Code:</strong> {dressCode || '—'} {dressCodeKeywords.length > 0 && `(${dressCodeKeywords.join(', ')})`}</div>
          <div><strong>Prestige:</strong> {prestige} · <strong>Strictness:</strong> {strictness} · <strong>Cost:</strong> {isFree ? 'Free' : `${cost} coins`}</div>
          {narrativeStakes && <div><strong>Stakes:</strong> {narrativeStakes}</div>}
        </div>
      </div>

      {/* ═══ CREATE BUTTON ═══ */}
      <button onClick={handleCreate} disabled={creating || !title.trim() || !eventName.trim()}
        style={{
          ...S.createBtn,
          opacity: creating || !title.trim() || !eventName.trim() ? 0.5 : 1,
        }}>
        {creating ? '⏳ Creating...' : '⚡ Create Episode'}
      </button>

      <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
        Creates episode, event, injects event, and generates script skeleton — all in one click.
        You'll land on the episode detail page ready for wardrobe + evaluation.
      </div>
    </div>
  );
}


// ═══ STYLES ═══
const S = {
  page: {
    maxWidth: 720, margin: '0 auto', padding: '24px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  loadingBox: { textAlign: 'center', padding: 80 },

  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', background: 'linear-gradient(135deg, #1a1a2e, #2d1b4e)',
    borderRadius: 14, marginBottom: 20, color: '#fff',
  },
  headerLabel: { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#a78bfa', marginBottom: 2 },
  headerTitle: { fontSize: 22, fontWeight: 800 },
  headerSub: { fontSize: 12, color: '#e2e8f0', marginTop: 2 },
  statsBox: { display: 'flex', gap: 14, fontSize: 13, color: '#e2e8f0' },
  statItem: { display: 'flex', alignItems: 'center', gap: 4 },

  saveBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 11, fontWeight: 600, marginBottom: 8, minHeight: 20, padding: '0 4px',
  },
  clearBtn: {
    background: 'none', border: '1px solid #e2e8f0', borderRadius: 6,
    padding: '2px 10px', fontSize: 10, color: '#94a3b8', cursor: 'pointer',
    fontWeight: 600,
  },

  errorBanner: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca',
    borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 12,
  },
  xBtn: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 },

  section: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
    padding: 20, marginBottom: 16,
  },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionNum: {
    background: '#6366f1', color: '#fff', width: 26, height: 26, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
  },
  sectionLabel: { fontSize: 16, fontWeight: 700, color: '#1a1a2e' },

  field: { marginBottom: 14 },
  fieldRow: { display: 'flex', gap: 12, marginBottom: 14 },
  fieldHalf: { flex: 1 },
  fieldThird: { flex: 1 },

  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 },
  input: {
    width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, color: '#1a1a2e', background: '#fff', outline: 'none',
    boxSizing: 'border-box',
  },

  sliderRow: { display: 'flex', alignItems: 'center', gap: 8 },
  slider: { flex: 1, cursor: 'pointer' },
  sliderVal: { fontSize: 14, fontWeight: 700, color: '#6366f1', minWidth: 20, textAlign: 'center' },

  presetGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  presetBtn: {
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.15s',
  },

  addBtn: {
    width: 36, height: 36, borderRadius: 8, border: '1px solid #e2e8f0',
    background: '#f8fafc', fontSize: 18, cursor: 'pointer', color: '#6366f1', fontWeight: 700,
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', background: '#eef2ff', borderRadius: 6,
    fontSize: 11, color: '#4338ca', fontWeight: 600,
  },
  chipX: {
    background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer',
    fontSize: 14, fontWeight: 700, padding: 0, lineHeight: 1,
  },

  stakeBtn: {
    padding: '4px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
    transition: 'all 0.15s',
  },

  preview: {
    padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: 12, marginBottom: 16,
  },
  previewHeader: { fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 },
  previewGrid: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#475569' },

  createBtn: {
    width: '100%', padding: '14px 24px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none', borderRadius: 12, color: '#fff', fontSize: 16, fontWeight: 700,
    cursor: 'pointer', transition: 'all 0.2s',
  },
};
