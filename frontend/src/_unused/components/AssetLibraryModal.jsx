import { useState, useEffect } from 'react';
import { FiX, FiSearch, FiImage, FiVideo, FiMusic, FiFile, FiCheck } from 'react-icons/fi';
import assetService from '../services/assetService';

/**
 * Asset Library Modal
 * Browse and import assets from global library
 */
export default function AssetLibraryModal({ isOpen, onClose, onImport, episodeId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedAssets, setSelectedAssets] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadAssets();
    }
  }, [isOpen]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const response = await assetService.getAssets({ 
        approval_status: 'APPROVED',  // Use uppercase to match database
        limit: 100 
      });
      console.log('Assets loaded:', response);
      console.log('Response.data:', response.data);
      
      // Backend returns: { status: 'SUCCESS', data: [...], count: 8 }
      // Axios wraps it as: { data: { status: 'SUCCESS', data: [...] } }
      const assetList = response.data?.data || response.data?.assets || response.assets || [];
      console.log('Extracted assets:', assetList);
      
      // Ensure it's an array
      const assetsArray = Array.isArray(assetList) ? assetList : [];
      console.log('Final assets array:', assetsArray.length, 'items');
      setAssets(assetsArray);
    } catch (error) {
      console.error('Failed to load assets:', error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const getAssetCategory = (assetType) => {
    if (!assetType) return 'other';
    const type = assetType.toLowerCase();
    if (type.includes('video')) return 'video';
    if (type.includes('image') || type.includes('logo') || type.includes('frame')) return 'image';
    if (type.includes('audio')) return 'audio';
    return 'other';
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = !searchQuery || 
      asset.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.asset_type?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Map asset types to filter categories
    const assetCategory = getAssetCategory(asset.asset_type);
    const matchesType = filterType === 'all' || assetCategory === filterType;
    
    return matchesSearch && matchesType;
  });

  const toggleAsset = (assetId) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handleImport = () => {
    const assetsToImport = assets.filter(a => selectedAssets.includes(a.id));
    onImport(assetsToImport);
    setSelectedAssets([]);
    onClose();
  };

  const getAssetIcon = (type) => {
    switch (type) {
      case 'image': return <FiImage style={{ color: '#3b82f6' }} />;
      case 'video': return <FiVideo style={{ color: '#9b59b6' }} />;
      case 'audio': return <FiMusic style={{ color: '#10b981' }} />;
      default: return <FiFile style={{ color: '#6b7280' }} />;
    }
  };

  if (!isOpen) return null;

  const styles = {
    overlay: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
    },
    modal: {
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      maxWidth: '1024px',
      width: '100%',
      margin: '0 16px',
      maxHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '24px',
      borderBottom: '1px solid #e5e7eb',
    },
    title: {
      fontSize: '20px',
      fontWeight: 600,
      color: '#111827',
    },
    closeButton: {
      color: '#9ca3af',
      cursor: 'pointer',
      background: 'none',
      border: 'none',
      padding: '4px',
    },
    searchContainer: {
      padding: '16px',
      borderBottom: '1px solid #e5e7eb',
    },
    searchInputContainer: {
      position: 'relative',
      marginBottom: '12px',
    },
    searchInput: {
      width: '100%',
      paddingLeft: '40px',
      paddingRight: '16px',
      paddingTop: '8px',
      paddingBottom: '8px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: '14px',
    },
    searchIcon: {
      position: 'absolute',
      left: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af',
    },
    filterButtons: {
      display: 'flex',
      gap: '8px',
    },
    filterButton: (active) => ({
      padding: '8px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      border: 'none',
      backgroundColor: active ? '#9b59b6' : '#f3f4f6',
      color: active ? 'white' : '#374151',
      transition: 'all 0.2s',
    }),
    content: {
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
    },
    loader: {
      textAlign: 'center',
      paddingTop: '48px',
      paddingBottom: '48px',
    },
    spinner: {
      animation: 'spin 1s linear infinite',
      borderRadius: '50%',
      height: '48px',
      width: '48px',
      border: '2px solid transparent',
      borderTopColor: '#9b59b6',
      margin: '0 auto',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '16px',
    },
    assetCard: (selected) => ({
      position: 'relative',
      border: `2px solid ${selected ? '#9b59b6' : '#e5e7eb'}`,
      borderRadius: '8px',
      padding: '12px',
      cursor: 'pointer',
      backgroundColor: selected ? '#f3e8ff' : 'white',
      transition: 'all 0.2s',
    }),
    checkIcon: {
      position: 'absolute',
      top: '8px',
      right: '8px',
      backgroundColor: '#9b59b6',
      color: 'white',
      borderRadius: '50%',
      padding: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    thumbnail: {
      aspectRatio: '16/9',
      backgroundColor: '#f3f4f6',
      borderRadius: '4px',
      marginBottom: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      minHeight: '120px',
      position: 'relative',
    },
    thumbnailImg: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      imageRendering: 'high-quality',
    },
    videoThumbnail: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    playOverlay: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgba(155, 89, 182, 0.8)',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    },
    assetInfo: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
    },
    assetText: {
      flex: 1,
      minWidth: 0,
    },
    assetName: {
      fontSize: '14px',
      fontWeight: 500,
      color: '#111827',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    assetType: {
      fontSize: '12px',
      color: '#6b7280',
      textTransform: 'capitalize',
    },
    footer: {
      padding: '16px',
      borderTop: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    footerText: {
      fontSize: '14px',
      color: '#6b7280',
    },
    footerButtons: {
      display: 'flex',
      gap: '12px',
    },
    cancelButton: {
      padding: '8px 16px',
      color: '#374151',
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: 500,
    },
    importButton: (disabled) => ({
      padding: '8px 16px',
      borderRadius: '8px',
      fontWeight: 500,
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      backgroundColor: disabled ? '#d1d5db' : '#9b59b6',
      color: disabled ? '#6b7280' : 'white',
      transition: 'all 0.2s',
    }),
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Import from Asset Library</h2>
          <button onClick={onClose} style={styles.closeButton}>
            <FiX style={{ fontSize: '24px' }} />
          </button>
        </div>

        {/* Search & Filter */}
        <div style={styles.searchContainer}>
          <div style={styles.searchInputContainer}>
            <FiSearch style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <div style={styles.filterButtons}>
            {['all', 'video', 'image', 'audio'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                style={styles.filterButton(filterType === type)}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Asset Grid */}
        <div style={styles.content}>
          {loading ? (
            <div style={styles.loader}>
              <div style={styles.spinner}></div>
              <p style={{ color: '#6b7280', marginTop: '16px' }}>Loading assets...</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div style={styles.loader}>
              <p style={{ color: '#6b7280' }}>No assets found</p>
            </div>
          ) : (
            <div style={styles.grid}>
              {filteredAssets.map(asset => (
                <div
                  key={asset.id}
                  onClick={() => toggleAsset(asset.id)}
                  style={styles.assetCard(selectedAssets.includes(asset.id))}
                >
                  {selectedAssets.includes(asset.id) && (
                    <div style={styles.checkIcon}>
                      <FiCheck style={{ fontSize: '14px' }} />
                    </div>
                  )}

                  <div style={{...styles.thumbnail}}>
                    {asset.s3_url_raw || asset.s3_url_processed || asset.metadata?.thumbnail_url ? (
                      (() => {
                        const isVideo = asset.asset_type?.toUpperCase().includes('VIDEO') || 
                                       asset.type?.toUpperCase().includes('VIDEO');
                        console.log('Asset:', asset.name, 'Type:', asset.asset_type, 'IsVideo:', isVideo, 'URL:', asset.s3_url_raw || asset.s3_url_processed);
                        
                        return isVideo ? (
                          <>
                            <video 
                              src={`${asset.s3_url_raw || asset.s3_url_processed}#t=0.1`}
                              style={styles.videoThumbnail}
                              preload="metadata"
                              muted
                              playsInline
                              onError={(e) => console.error('Video load error:', asset.name, e)}
                              onLoadedData={() => console.log('Video loaded:', asset.name)}
                            />
                            <div style={styles.playOverlay}>
                              <FiVideo style={{ color: '#fff', fontSize: '20px' }} />
                            </div>
                          </>
                        ) : (
                          <img 
                            src={asset.s3_url_raw || asset.s3_url_processed || asset.metadata?.thumbnail_url} 
                            alt={asset.name}
                            style={styles.thumbnailImg}
                            onError={(e) => console.error('Image load error:', asset.name, e)}
                          />
                        );
                      })()
                    ) : (
                      <div style={{ fontSize: '32px' }}>
                        {getAssetIcon(getAssetCategory(asset.asset_type))}
                      </div>
                    )}
                  </div>

                  <div style={styles.assetInfo}>
                    {getAssetIcon(getAssetCategory(asset.asset_type))}
                    <div style={styles.assetText}>
                      <p style={styles.assetName}>{asset.name}</p>
                      <p style={styles.assetType}>{asset.asset_type || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            {selectedAssets.length} asset{selectedAssets.length !== 1 ? 's' : ''} selected
          </p>
          <div style={styles.footerButtons}>
            <button onClick={onClose} style={styles.cancelButton}>
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selectedAssets.length === 0}
              style={styles.importButton(selectedAssets.length === 0)}
            >
              Import Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
