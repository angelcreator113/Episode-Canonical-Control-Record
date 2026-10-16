// frontend/src/pages/AssetLibrary.jsx - Global Asset Library Page
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutGrid, Image as ImageIcon, MapPin, Shirt, Armchair, AppWindow, Layers,
  Music, Sparkles, Paperclip, Search, UploadCloud, List, ChevronRight,
  LayoutTemplate, MoreVertical, Trash2, Tv, X, FileAudio,
} from 'lucide-react';
import { activeShowId } from '../utils/activeShow';
import { assetService } from '../services/assetService';
import showService from '../services/showService';
import AssetUploader from '../components/Assets/AssetUploader';
import './AssetLibrary.css';

/**
 * The library's folders. An asset's folder comes from its `category`
 * (the assets.category enum the uploader writes), else from its
 * asset_type / asset_role for older uploads made before categories.
 */
export const ASSET_CATEGORIES = {
  all:       { icon: LayoutGrid, color: '#c2407f', label: 'All Assets' },
  locations: { icon: MapPin,     color: '#7a5bd0', label: 'Locations' },
  wardrobe:  { icon: Shirt,      color: '#d4789a', label: 'Wardrobe' },
  props:     { icon: Armchair,   color: '#b8962e', label: 'Props & Decor' },
  ui:        { icon: AppWindow,  color: '#4f8cc9', label: 'UI Assets' },
  overlays:  { icon: Layers,     color: '#a46ee0', label: 'Overlays' },
  music:     { icon: Music,      color: '#e05a8a', label: 'Music & Audio' },
  branding:  { icon: Sparkles,   color: '#c9a84c', label: 'Logos & Branding' },
  other:     { icon: Paperclip,  color: '#94a3b8', label: 'Other' },
};

export function assetCategory(asset) {
  const c = String(asset.category || '').toLowerCase();
  if (c === 'background') return 'locations';
  if (c.startsWith('wardrobe')) return 'wardrobe';
  if (c === 'prop') return 'props';
  if (c === 'ui_element') return 'ui';
  if (c === 'overlay') return 'overlays';
  if (c === 'music' || c === 'sfx') return 'music';

  const type = String(asset.asset_type || asset.asset_role || '').toUpperCase();
  if (type.includes('LOGO') || type.includes('BRAND')) return 'branding';
  if (type.includes('INTRO') || type.includes('OUTRO')) return 'overlays';
  if (type.includes('MUSIC') || type.includes('AUDIO')) return 'music';
  if (type.includes('WARDROBE') || type.includes('OUTFIT')) return 'wardrobe';
  if (type.includes('BACKGROUND')) return 'locations';
  if (type.includes('GRAPHIC') || type.includes('OVERLAY')) return 'overlays';
  return 'other';
}

/** Landscape, portrait or square from the stored pixel size; null when unknown. */
export function orientationOf(asset) {
  const w = Number(asset.width), h = Number(asset.height);
  if (!w || !h) return null;
  if (Math.abs(w - h) / Math.max(w, h) < 0.05) return 'square';
  return w > h ? 'landscape' : 'portrait';
}

/** The uploader's category key → the asset_type an upload is filed under (unchanged). */
const categoryToAssetType = (category) => ({
  logos: 'BRAND_LOGO',
  intros: 'PROMO_VIDEO',
  outros: 'PROMO_VIDEO',
  music: 'PROMO_VIDEO',
  wardrobe: 'PROMO_LALA',
  graphics: 'EPISODE_FRAME',
  other: 'EPISODE_FRAME'
}[category] || 'EPISODE_FRAME');

const SORTS = {
  newest: { label: 'Newest', fn: (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0) },
  oldest: { label: 'Oldest', fn: (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0) },
  name:   { label: 'Name A–Z', fn: (a, b) => a.name.localeCompare(b.name) },
  size:   { label: 'Largest', fn: (a, b) => b.size - a.size },
};

const formatFileSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* Image, video, or an icon tile for audio and broken images */
function Thumb({ asset, className = '' }) {
  const [broken, setBroken] = useState(false);
  const cat = ASSET_CATEGORIES[asset.category] || ASSET_CATEGORIES.other;
  if (asset.type === 'audio' || broken || !(asset.url || asset.thumbnail_url)) {
    const Icon = asset.type === 'audio' ? FileAudio : cat.icon;
    return (
      <div className={`al-thumb al-thumb-icon ${className}`} style={{ '--cat': cat.color }}>
        <Icon size={34} aria-hidden />
      </div>
    );
  }
  if (asset.type === 'video') {
    return <video className={`al-thumb ${className}`} src={asset.url} muted preload="metadata" />;
  }
  return (
    <img className={`al-thumb ${className}`} src={asset.thumbnail_url || asset.url} alt={asset.name}
      loading="lazy" onError={() => setBroken(true)} />
  );
}

function AssetLibrary({ embedded = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [assets, setAssets] = useState([]);
  const [shows, setShows] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedShow, setSelectedShow] = useState('all');
  const [mediaType, setMediaType] = useState('all');
  const [place, setPlace] = useState('all');
  const [mood, setMood] = useState('all');
  const [orientation, setOrientation] = useState('all');
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [browseAll, setBrowseAll] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    if (openDropdownId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdownId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assetsResponse, showsResponse] = await Promise.all([
        assetService.getAssets({}),
        showService.getAllShows()
      ]);

      const assetsArray = assetsResponse.data?.data || assetsResponse.data || [];
      const mappedAssets = assetsArray.map(asset => {
        const ct = asset.content_type || '';
        return {
          id: asset.id,
          name: asset.name || asset.file_name || 'Untitled Asset',
          type: asset.media_type || (ct.startsWith('video') ? 'video' : ct.startsWith('audio') ? 'audio' : 'image'),
          category: assetCategory(asset),
          url: asset.s3_url_processed || asset.s3_url_raw || asset.url,
          thumbnail_url: asset.metadata?.thumbnail_url || null,
          size: asset.file_size_bytes || 0,
          width: asset.width,
          height: asset.height,
          location_name: asset.location_name || null,
          mood_tags: Array.isArray(asset.mood_tags) ? asset.mood_tags.filter(Boolean) : [],
          character_name: asset.character_name || null,
          show_id: asset.show_id,
          show_name: asset.show_name || null,
          episode_id: asset.episode_id,
          asset_scope: asset.asset_scope,
          created_at: asset.created_at
        };
      });

      setAssets(mappedAssets);

      const showsArray = showsResponse.data || showsResponse || [];
      setShows(showsArray);
    } catch (error) {
      console.error('Error fetching assets:', error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const places = useMemo(
    () => [...new Set(assets.map(a => a.location_name).filter(Boolean))].sort(),
    [assets]
  );

  const moods = useMemo(
    () => [...new Set(assets.flatMap(a => a.mood_tags.map(m => m.toLowerCase())))].sort(),
    [assets]
  );

  const filtersActive = selectedShow !== 'all' || mediaType !== 'all' || place !== 'all' || mood !== 'all'
    || orientation !== 'all' || searchQuery.trim() !== '';

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assets.filter(asset => {
      if (selectedCategory !== 'all' && asset.category !== selectedCategory) return false;
      if (selectedShow !== 'all' && asset.show_id !== selectedShow) return false;
      if (mediaType !== 'all' && asset.type !== mediaType) return false;
      if (place !== 'all' && asset.location_name !== place) return false;
      if (mood !== 'all' && !asset.mood_tags.some(m => m.toLowerCase() === mood)) return false;
      if (orientation !== 'all' && orientationOf(asset) !== orientation) return false;
      if (q && ![asset.name, asset.location_name, asset.character_name].some(v => (v || '').toLowerCase().includes(q))) return false;
      return true;
    }).sort(SORTS[sort].fn);
  }, [assets, selectedCategory, selectedShow, mediaType, place, mood, orientation, searchQuery, sort]);

  const categoryCounts = useMemo(() => assets.reduce((acc, asset) => {
    acc[asset.category] = (acc[asset.category] || 0) + 1;
    return acc;
  }, {}), [assets]);

  // A folder's cover is its newest asset with a picture.
  const covers = useMemo(() => {
    const out = {};
    [...assets].sort(SORTS.newest.fn).forEach(a => {
      if (!out[a.category] && a.type !== 'audio' && (a.thumbnail_url || a.url)) out[a.category] = a;
    });
    return out;
  }, [assets]);

  const recent = useMemo(() => [...assets].sort(SORTS.newest.fn).slice(0, 10), [assets]);

  const showFolders = selectedCategory === 'all' && !filtersActive && !browseAll;

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedShow('all');
    setMediaType('all');
    setPlace('all');
    setMood('all');
    setOrientation('all');
    setSearchQuery('');
    setBrowseAll(false);
  };

  const pickCategory = (key) => {
    setSelectedCategory(key);
    setBrowseAll(false);
  };

  const handleUpload = async (files, category, destination, extraMeta = {}) => {
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('assetType', categoryToAssetType(category));

        // If a show is selected, attach it
        if (selectedShow !== 'all') {
          formData.append('show_id', selectedShow);
          formData.append('metadata', JSON.stringify({
            show_id: selectedShow,
            asset_scope: 'SHOW',
            purpose: category,
            uploadedFrom: 'AssetLibrary'
          }));
        } else {
          formData.append('metadata', JSON.stringify({
            asset_scope: 'GLOBAL',
            purpose: category,
            uploadedFrom: 'AssetLibrary'
          }));
        }

        // Append extra metadata fields
        if (extraMeta.category) formData.append('category', extraMeta.category);
        if (extraMeta.entity_type) formData.append('entity_type', extraMeta.entity_type);
        if (extraMeta.character_name) formData.append('character_name', extraMeta.character_name);

        await assetService.uploadAsset(formData);
        console.log(`✅ Uploaded: ${file.name}`);
      }

      await fetchData();
      setShowUploader(false);
      alert(`Successfully uploaded ${files.length} asset(s)!`);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload assets: ' + error.message);
    }
  };

  const handleDeleteAsset = async (assetId) => {
    if (!confirm('Delete this asset permanently?')) return;
    try {
      await assetService.deleteAsset(assetId);
      setAssets(assets.filter(a => a.id !== assetId));
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete asset');
    }
  };

  const pageClass = `asset-library-page${embedded ? ' asset-library-embedded' : ''}`;

  if (loading) {
    return (
      <div className={pageClass}>
        <div className="asset-library-loading">
          <div className="loading-spinner"></div>
          <p>Loading assets...</p>
        </div>
      </div>
    );
  }

  const searchBox = (
    <label className="al-search">
      <Search size={18} aria-hidden />
      <input type="text" placeholder="Search assets…" value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)} aria-label="Search assets" />
      {searchQuery && (
        <button type="button" className="al-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
          <X size={16} aria-hidden />
        </button>
      )}
    </label>
  );

  const uploadBtn = (
    <button type="button" className="al-upload" onClick={() => setShowUploader(true)}>
      <UploadCloud size={18} aria-hidden /> Upload
    </button>
  );

  const visibleCategories = Object.entries(ASSET_CATEGORIES)
    .filter(([key]) => key === 'all' || categoryCounts[key]);

  return (
    <div className={pageClass}>
      {/* ── Banner ─────────────────────────────────────────────── */}
      {!embedded ? (
        <header className="al-banner">
          <div className="al-banner-left">
            <span className="al-brand">LalaVerse</span>
            <div>
              <h1 className="al-title">Asset Library</h1>
              <div className="al-tagline">Scenes · Props · UI · Wardrobe · More</div>
            </div>
          </div>
          <div className="al-banner-tools">
            {searchBox}
            {uploadBtn}
          </div>
        </header>
      ) : (
        <div className="al-embedded-bar">
          <span className="al-embedded-count">{assets.length} asset{assets.length !== 1 ? 's' : ''}</span>
          {searchBox}
          {uploadBtn}
        </div>
      )}

      <div className="al-body">
        {/* ── Folders rail ─────────────────────────────────────── */}
        <aside className="al-rail" aria-label="Asset folders">
          <nav className="al-rail-nav">
            {visibleCategories.map(([key, cat]) => {
              const Icon = cat.icon;
              const n = key === 'all' ? assets.length : categoryCounts[key];
              return (
                <button key={key} type="button"
                  className={`al-rail-btn ${selectedCategory === key ? 'is-active' : ''}`}
                  aria-pressed={selectedCategory === key}
                  onClick={() => pickCategory(key)}>
                  <Icon size={20} aria-hidden />
                  <span className="al-rail-label">{cat.label}</span>
                  <span className="al-rail-count">{n || 0}</span>
                </button>
              );
            })}
          </nav>
          <div className="al-rail-divider" />
          <div className="al-rail-heading">Elsewhere in the studio</div>
          <nav className="al-rail-nav">
            <Link className="al-rail-btn" to="/template-studio"><LayoutTemplate size={20} aria-hidden /><span className="al-rail-label">Templates</span></Link>
          </nav>
        </aside>

        {/* ── Main ─────────────────────────────────────────────── */}
        <main className="al-main">
          {/* filter row */}
          <div className="al-filters">
            <select className="al-filter" value={mediaType} onChange={(e) => setMediaType(e.target.value)} aria-label="Type">
              <option value="all">Type: All</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="audio">Audio</option>
            </select>
            {places.length > 0 && (
              <select className="al-filter" value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Location">
                <option value="all">Location: All</option>
                {places.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            {moods.length > 0 && (
              <select className="al-filter" value={mood} onChange={(e) => setMood(e.target.value)} aria-label="Mood">
                <option value="all">Mood: All</option>
                {moods.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            )}
            <select className="al-filter" value={orientation} onChange={(e) => setOrientation(e.target.value)} aria-label="Orientation">
              <option value="all">Orientation: All</option>
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
              <option value="square">Square</option>
            </select>
            {shows.length > 0 && (
              <select className="al-filter" value={selectedShow} onChange={(e) => setSelectedShow(e.target.value)} aria-label="Show">
                <option value="all">Show: All</option>
                {shows.map(show => <option key={show.id} value={show.id}>{show.name}</option>)}
              </select>
            )}
            <select className="al-filter" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>Sort: {s.label}</option>)}
            </select>
            {(filtersActive || selectedCategory !== 'all' || browseAll) && (
              <button type="button" className="al-clear" onClick={clearFilters}>Clear</button>
            )}
            <div className="al-view-toggle" role="group" aria-label="View">
              <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}><LayoutGrid size={16} aria-hidden /> Grid</button>
              <button type="button" className={viewMode === 'list' ? 'is-active' : ''} aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}><List size={16} aria-hidden /> List</button>
            </div>
          </div>

          {assets.length === 0 ? (
            <div className="asset-library-empty">
              <div className="empty-icon"><ImageIcon size={40} aria-hidden /></div>
              <h3>No Assets Yet</h3>
              <p>Upload your first asset to get started</p>
              <div className="empty-actions">
                <button className="al-upload" onClick={() => setShowUploader(true)}>
                  <UploadCloud size={18} aria-hidden /> Upload Assets
                </button>
                {shows.length > 0 && (
                  <button
                    className="al-clear"
                    onClick={() => {
                      // The active show, else the shows list to choose one (audit CTX-01).
                      const active = activeShowId({ pathname: location.pathname, shows });
                      navigate(active ? `/shows/${active}?tab=assets` : '/shows');
                    }}
                  >
                    Go to Show Assets
                  </button>
                )}
              </div>
            </div>
          ) : showFolders ? (
            <>
              {/* folder cards */}
              <div className="al-folders">
                {visibleCategories.filter(([k]) => k !== 'all').map(([key, cat]) => {
                  const Icon = cat.icon;
                  const cover = covers[key];
                  return (
                    <button key={key} type="button" className="al-folder" onClick={() => pickCategory(key)}>
                      <div className="al-folder-cover" style={{ '--cat': cat.color }}>
                        {cover ? <Thumb asset={cover} /> : <div className="al-thumb al-thumb-icon"><Icon size={40} aria-hidden /></div>}
                      </div>
                      <div className="al-folder-foot">
                        <Icon size={20} aria-hidden className="al-folder-icon" />
                        <span className="al-folder-text">
                          <span className="al-folder-name">{cat.label}</span>
                          <span className="al-folder-count">{categoryCounts[key]} asset{categoryCounts[key] !== 1 ? 's' : ''}</span>
                        </span>
                        <ChevronRight size={20} aria-hidden className="al-chev" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* recent strip */}
              <section className="al-recent">
                <header className="al-recent-head">
                  <h2>Recent Assets</h2>
                  <button type="button" className="al-viewall" onClick={() => setBrowseAll(true)}>
                    View All <ChevronRight size={16} aria-hidden />
                  </button>
                </header>
                <div className="al-recent-strip">
                  {recent.map(a => (
                    <div key={a.id} className="al-recent-item" title={a.name}>
                      <Thumb asset={a} />
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : filteredAssets.length === 0 ? (
            <div className="no-results">
              <p>No assets match your filters</p>
              <button className="al-clear" onClick={clearFilters}>Clear filters</button>
            </div>
          ) : (
            <>
              <div className="al-results-head">
                {(ASSET_CATEGORIES[selectedCategory] || ASSET_CATEGORIES.all).label}
                <span>{filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}</span>
              </div>
              <div className={`al-grid view-${viewMode}`}>
                {filteredAssets.map(asset => {
                  const category = ASSET_CATEGORIES[asset.category] || ASSET_CATEGORIES.other;
                  const showInfo = shows.find(s => s.id === asset.show_id);
                  return (
                    <div key={asset.id} className="al-card">
                      <div className="al-card-media"><Thumb asset={asset} /></div>
                      <div className="al-card-info">
                        <span className="al-badge" style={{ '--cat': category.color }}>{category.label}</span>
                        <h4 className="al-card-name">{asset.name}</h4>
                        <div className="al-card-meta">
                          {[formatFileSize(asset.size), asset.location_name, formatDate(asset.created_at)].filter(Boolean).join(' · ')}
                          {showInfo && (
                            <button type="button" className="al-show-link"
                              onClick={(e) => { e.stopPropagation(); navigate(`/shows/${showInfo.id}?tab=assets`); }}>
                              <Tv size={13} aria-hidden /> {showInfo.name}
                            </button>
                          )}
                        </div>
                      </div>

                      <button type="button" className="al-menu-btn" title="More options" aria-label={`More options for ${asset.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === asset.id ? null : asset.id);
                        }}>
                        <MoreVertical size={18} aria-hidden />
                      </button>

                      {openDropdownId === asset.id && (
                        <div className="al-menu">
                          {showInfo && (
                            <button type="button" className="al-menu-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/shows/${showInfo.id}?tab=assets`);
                                setOpenDropdownId(null);
                              }}>
                              <Tv size={15} aria-hidden /> View in Show
                            </button>
                          )}
                          <button type="button" className="al-menu-item is-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAsset(asset.id);
                              setOpenDropdownId(null);
                            }}>
                            <Trash2 size={15} aria-hidden /> Delete Asset
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Upload Modal */}
      {showUploader && (
        <AssetUploader
          context="show"
          contextLabel="Upload to Asset Library"
          onUpload={handleUpload}
          onClose={() => setShowUploader(false)}
        />
      )}
    </div>
  );
}

export default AssetLibrary;
