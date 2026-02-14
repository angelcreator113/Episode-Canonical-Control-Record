import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ExportDropdown.css';

function ExportDropdown({ episodeId }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleAction = (action) => {
    setOpen(false);
    switch (action) {
      case 'export-page':
        navigate(`/episodes/${episodeId}/export`);
        break;
      case 'download':
        // Navigate to export page for full render & download
        navigate(`/episodes/${episodeId}/export`);
        break;
      case 'schedule':
        console.log('📅 Export: Schedule post');
        // TODO: open schedule modal
        break;
      case 'youtube':
        console.log('📤 Export: Upload to YouTube');
        // TODO: YouTube upload flow
        break;
      case 'instagram':
        console.log('📤 Export: Upload to Instagram');
        // TODO: Instagram upload flow
        break;
      case 'draft':
        console.log('💾 Export: Save as draft');
        // TODO: save draft
        break;
      default:
        break;
    }
  };

  return (
    <div className="export-dropdown-wrapper">
      <button
        className="export-dropdown-btn"
        onClick={() => setOpen(!open)}
      >
        Export ▾
      </button>

      {open && (
        <>
          <div className="export-dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="export-dropdown-menu">
            <button className="export-dropdown-item primary" onClick={() => handleAction('export-page')}>
              <span className="edi">🎬</span>
              <div className="item-content">
                <span className="item-label">Export Studio</span>
                <span className="item-desc">Full render &amp; format settings</span>
              </div>
            </button>

            <div className="export-dropdown-divider" />

            <button className="export-dropdown-item" onClick={() => handleAction('download')}>
              <span className="edi">📥</span>
              <span className="item-label">Download to Device</span>
            </button>
            <button className="export-dropdown-item" onClick={() => handleAction('draft')}>
              <span className="edi">💾</span>
              <span className="item-label">Save as Draft</span>
            </button>

            <div className="export-dropdown-divider" />
            <div className="export-dropdown-section">Publish</div>

            <button className="export-dropdown-item" onClick={() => handleAction('youtube')}>
              <span className="edi">📺</span>
              <span className="item-label">Upload to YouTube</span>
            </button>
            <button className="export-dropdown-item" onClick={() => handleAction('instagram')}>
              <span className="edi">📱</span>
              <span className="item-label">Upload to Instagram</span>
            </button>
            <button className="export-dropdown-item" onClick={() => handleAction('schedule')}>
              <span className="edi">📅</span>
              <span className="item-label">Schedule Post</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ExportDropdown;
