import React from 'react';
import './MissingAssetPlaceholder.css';

/**
 * MissingAssetPlaceholder
 * Shows a placeholder for assets that are metadata-only (no uploaded file)
 * with an option to upload the file
 */
const MissingAssetPlaceholder = ({ asset, onUploadClick, compact = false }) => {
  const isMissing = asset.metadata?.file_status === 'missing' || 
                    asset.metadata?.needs_real_upload === true ||
                    (!asset.s3_url_raw && !asset.url);

  if (!isMissing) {
    return null;
  }

  const handleClick = (e) => {
    e.stopPropagation();
    if (onUploadClick) {
      onUploadClick(asset);
    }
  };

  if (compact) {
    return (
      <div className="missing-asset-compact" onClick={handleClick}>
        <div className="missing-icon">📤</div>
        <span className="missing-label">Upload Needed</span>
      </div>
    );
  }

  return (
    <div className="missing-asset-placeholder" onClick={handleClick}>
      <div className="missing-content">
        <div className="missing-icon-large">📤</div>
        <h4 className="missing-title">Upload Needed</h4>
        <p className="missing-description">
          {asset.name || 'This asset'}
        </p>
        <p className="missing-hint">Click to upload file</p>
      </div>
      
      {asset.metadata?.is_placeholder && (
        <div className="placeholder-badge">Placeholder</div>
      )}
    </div>
  );
};

export default MissingAssetPlaceholder;
