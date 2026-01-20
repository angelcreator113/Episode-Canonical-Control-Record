import React, { useState, useEffect } from 'react';
import './AssetManager.css';

/**
 * AssetManager Component
 * Upload and manage promotional assets with background removal
 */

const AssetManager = () => {
  const [assets, setAssets] = useState([]);
  const [pendingAssets, setPendingAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [file, setFile] = useState(null);
  const [assetType, setAssetType] = useState('PROMO_LALA');
  const [metadata, setMetadata] = useState('');
  const [showPending, setShowPending] = useState(false);

  const assetTypes = [
    { value: 'PROMO_LALA', label: '👩 Lala Promo' },
    { value: 'PROMO_JUSTAWOMANINHERPRIME', label: '💜 JustAWoman Promo' },
    { value: 'PROMO_GUEST', label: '👤 Guest Promo' },
    { value: 'BRAND_LOGO', label: '🏷️ Brand Logo' },
    { value: 'EPISODE_FRAME', label: '🖼️ Episode Frame' }
  ];

  // Load assets
  useEffect(() => {
    fetchAssets();
    fetchPendingAssets();
  }, [assetType]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/assets/approved/${assetType}`);
      if (!response.ok) throw new Error('Failed to fetch assets');
      const data = await response.json();
      setAssets(data.data || data.assets || []);
    } catch (err) {
      console.error('Error fetching assets:', err);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingAssets = async () => {
    try {
      const response = await fetch('/api/v1/assets/pending');
      if (response.ok) {
        const data = await response.json();
        setPendingAssets(data.data || data.assets || []);
      }
    } catch (err) {
      console.error('Error fetching pending assets:', err);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
  };

  const handleAssetTypeChange = (e) => {
    setAssetType(e.target.value);
    setAssets([]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      if (metadata && metadata.trim()) {
        try {
          JSON.parse(metadata);
        } catch (parseErr) {
          setError('Invalid JSON in metadata');
          setLoading(false);
          return;
        }
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('assetType', assetType);
      if (metadata && metadata.trim()) {
        formData.append('metadata', metadata);
      }

      const response = await fetch('/api/v1/assets', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Upload failed');
      }

      const data = await response.json();
      setSuccess(`✅ Asset uploaded successfully! Processing background removal...`);
      setFile(null);
      setMetadata('');

      await fetchPendingAssets();
      await fetchAssets();
      document.getElementById('assetForm')?.reset();
    } catch (err) {
      console.error('Error uploading asset:', err);
      setError(err.message || 'Failed to upload asset');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessBackground = async (assetId) => {
    if (!window.confirm('Process background removal with Runway ML?\n\nThis will use Runway API credits.')) {
      return;
    }

    try {
      setProcessingId(assetId);
      setError(null);

      const response = await fetch(`/api/v1/assets/${assetId}/process`, {
        method: 'PUT',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Processing failed');
      }

      const data = await response.json();
      setSuccess(`✅ Asset processed and approved! Ready for use in compositions.`);
      await fetchPendingAssets();
      await fetchAssets();
    } catch (err) {
      console.error('Error processing asset:', err);
      setError(err.message || 'Failed to process asset');
    } finally {
      setProcessingId(null);
    }
  };

  const getImageUrl = (asset) => {
    if (asset.s3_url_processed) return asset.s3_url_processed;
    if (asset.s3_url_raw) return asset.s3_url_raw;
    
    if (asset.s3_key_raw) {
      const bucket = process.env.REACT_APP_S3_PRIMARY_BUCKET || 'episode-metadata-dev';
      
      if (process.env.REACT_APP_USE_LOCALSTACK === 'true') {
        const endpoint = process.env.REACT_APP_AWS_ENDPOINT || 'http://localhost:4566';
        return `${endpoint}/${bucket}/${asset.s3_key_raw}`;
      }
      
      const region = process.env.REACT_APP_AWS_REGION || 'us-east-1';
      return `https://${bucket}.s3.${region}.amazonaws.com/${asset.s3_key_raw}`;
    }
    
    return null;
  };

  const AssetCard = ({ asset, isPending = false }) => {
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const imageUrl = getImageUrl(asset);

    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'all 0.2s',
        cursor: 'pointer',
        border: '2px solid transparent'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.borderColor = isPending ? '#f59e0b' : '#10b981';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'transparent';
      }}
      >
        <div style={{ 
          position: 'relative', 
          width: '100%', 
          paddingTop: '100%', 
          background: '#f3f4f6',
          overflow: 'hidden'
        }}>
          {imageLoading && !imageError && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}>
              <div className="spinner"></div>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading...</span>
            </div>
          )}

          {imageError && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: '#fef3c7'
            }}>
              <span style={{ fontSize: '2.5rem' }}>⚠️</span>
              <span style={{ fontSize: '0.875rem', color: '#92400e' }}>Failed to load</span>
            </div>
          )}

          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={asset.asset_type}
              onLoad={() => {
                setImageLoading(false);
                setImageError(false);
              }}
              onError={(e) => {
                setImageError(true);
                setImageLoading(false);
              }}
              style={{ 
                display: imageLoading ? 'none' : 'block',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            !imageLoading && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: '#f3f4f6'
              }}>
                <span style={{ fontSize: '3rem' }}>🖼️</span>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>No Preview</span>
              </div>
            )
          )}

          <div style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            padding: '0.375rem 0.875rem',
            background: isPending ? '#fbbf24' : '#10b981',
            color: 'white',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: '700',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
            {isPending ? '⏳ PENDING' : '✅ APPROVED'}
          </div>
        </div>

        <div style={{ padding: '1.25rem' }}>
          <p style={{ 
            margin: '0 0 0.5rem 0', 
            fontSize: '0.875rem', 
            fontWeight: '700', 
            color: '#667eea',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {asset.asset_type}
          </p>
          <p style={{ 
            margin: '0 0 0.75rem 0', 
            fontSize: '0.875rem', 
            color: '#6b7280',
            fontFamily: 'monospace',
            wordBreak: 'break-all'
          }} title={asset.id}>
            ID: {asset.id.substring(0, 12)}...
          </p>
          
          {asset.file_size_bytes && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem'
            }}>
              <span style={{ fontSize: '1rem' }}>📊</span>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {(asset.file_size_bytes / 1024).toFixed(1)} KB
              </span>
            </div>
          )}

          {isPending && (
            <button
              onClick={() => handleProcessBackground(asset.id)}
              disabled={processingId === asset.id}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: processingId === asset.id ? '#d1d5db' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: processingId === asset.id ? 'not-allowed' : 'pointer',
                boxShadow: processingId === asset.id ? 'none' : '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {processingId === asset.id ? (
                <>
                  <span className="spinner-sm"></span>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>🎨</span>
                  <span>Process Background</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  const currentAssetTypeLabel = assetTypes.find(t => t.value === assetType)?.label || assetType;

  return (
    <div className="asset-manager" style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <div className="asset-manager-container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.75rem', fontWeight: '700', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📸 Asset Manager
              </h1>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#6b7280' }}>
                Upload and manage promotional assets with AI background removal
              </p>
            </div>
            <button 
              onClick={() => {
                setShowPending(!showPending);
                setError(null);
                setSuccess(null);
              }} 
              style={{
                padding: '0.875rem 1.75rem',
                background: showPending ? '#6b7280' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {showPending ? (
                <>
                  <span>✅</span>
                  <span>View Approved</span>
                </>
              ) : (
                <>
                  <span>⏳</span>
                  <span>View Pending</span>
                  {pendingAssets.length > 0 && (
                    <span style={{
                      padding: '0.25rem 0.625rem',
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: '999px',
                      fontSize: '0.875rem',
                      fontWeight: '700'
                    }}>
                      {pendingAssets.length}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>

          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
            <div style={{ padding: '1rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '10px', boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginBottom: '0.375rem' }}>APPROVED ASSETS</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>{assets.length}</div>
            </div>
            <div style={{ padding: '1rem', background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', borderRadius: '10px', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginBottom: '0.375rem' }}>PENDING REVIEW</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>{pendingAssets.length}</div>
            </div>
            <div style={{ padding: '1rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '10px', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginBottom: '0.375rem' }}>CURRENT TYPE</div>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: 'white' }}>{currentAssetTypeLabel}</div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ margin: '0 0 0.375rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📤 Upload New Asset
            </h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
              Select asset type, choose a file, and upload for AI background removal
            </p>
          </div>

          <form id="assetForm" onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {/* Asset Type */}
              <div>
                <label htmlFor="assetType" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Asset Type <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  id="assetType"
                  value={assetType}
                  onChange={handleAssetTypeChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.875rem',
                    fontSize: '0.95rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    background: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {assetTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div>
                <label htmlFor="file" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Choose File <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="file"
                  id="file"
                  onChange={handleFileChange}
                  accept="image/*"
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.875rem',
                    fontSize: '0.95rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                />
                {file && (
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#10b981' }}>
                    ✓ {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>

            {/* Metadata (Optional) */}
            <div>
              <label htmlFor="metadata" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                Metadata (Optional JSON)
              </label>
              <textarea
                id="metadata"
                value={metadata}
                onChange={(e) => setMetadata(e.target.value)}
                placeholder='{"description": "Optional metadata"}'
                rows="2"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.875rem',
                  fontSize: '0.875rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  background: 'white',
                  fontFamily: 'monospace',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !file}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading || !file ? '#d1d5db' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: loading || !file ? 'not-allowed' : 'pointer',
                boxShadow: loading || !file ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem'
              }}
            >
              {loading ? (
                <>
                  <span className="spinner-sm"></span>
                  <span>Uploading & Processing...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Upload & Process Asset</span>
                </>
              )}
            </button>
          </form>

          {/* Alerts */}
          {error && (
            <div style={{
              marginTop: '1rem',
              padding: '0.875rem 1rem',
              background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
              border: '2px solid #ef4444',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: '#991b1b',
              fontSize: '0.95rem',
              fontWeight: '600'
            }}>
              <span style={{ fontSize: '1.25rem' }}>❌</span>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div style={{
              marginTop: '1rem',
              padding: '0.875rem 1rem',
              background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
              border: '2px solid #10b981',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: '#065f46',
              fontSize: '0.95rem',
              fontWeight: '600'
            }}>
              <span style={{ fontSize: '1.25rem' }}>✅</span>
              <span>{success}</span>
            </div>
          )}
        </div>

        {/* Assets Grid */}
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 0.375rem 0', fontSize: '1.25rem', fontWeight: '700', color: '#1f2937' }}>
              {showPending ? '⏳ Pending Assets' : `✅ ${currentAssetTypeLabel}`}
              <span style={{
                marginLeft: '0.75rem',
                padding: '0.375rem 0.875rem',
                background: showPending ? '#fbbf24' : '#10b981',
                color: 'white',
                borderRadius: '999px',
                fontSize: '1rem',
                fontWeight: '700'
              }}>
                {showPending ? pendingAssets.length : assets.length}
              </span>
            </h2>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#6b7280' }}>
              {showPending 
                ? 'Assets waiting for background removal processing' 
                : 'Processed and approved assets ready to use'}
            </p>
          </div>

          {loading && (
            <div style={{ 
              textAlign: 'center', 
              padding: '4rem 2rem',
              background: 'white',
              borderRadius: '16px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
            }}>
              <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
              <p style={{ margin: 0, fontSize: '1.1rem', color: '#6b7280' }}>Loading assets...</p>
            </div>
          )}

          {!loading && (
            <>
              {showPending ? (
                pendingAssets.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '4rem 2rem',
                    background: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
                  }}>
                    <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>✨</div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                      No Pending Assets
                    </h3>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '1.1rem' }}>
                      All uploaded assets have been processed
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {pendingAssets.map(asset => (
                      <AssetCard key={asset.id} asset={asset} isPending={true} />
                    ))}
                  </div>
                )
              ) : (
                assets.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '4rem 2rem',
                    background: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
                  }}>
                    <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>📦</div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: '700', color: '#1f2937' }}>
                      No Assets Yet
                    </h3>
                    <p style={{ margin: '0 0 0.5rem 0', color: '#6b7280', fontSize: '1.1rem' }}>
                      Upload your first {currentAssetTypeLabel.toLowerCase()} asset to get started
                    </p>
                    <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.95rem' }}>
                      Assets will appear here after background removal processing
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {assets.map(asset => (
                      <AssetCard key={asset.id} asset={asset} isPending={false} />
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetManager;
