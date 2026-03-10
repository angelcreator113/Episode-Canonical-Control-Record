// PdfIngestZone.jsx
// Drop-in PDF upload zone for the Franchise Brain ingest tab.

import { useState, useRef, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '/api/v1';

const C = {
  surface: '#ffffff', surfaceAlt: '#faf8f5', bgDeep: '#f0ece4',
  border: '#e0d9ce', borderDark: '#c8bfb0',
  text: '#1a1714', textDim: '#6b6259', textFaint: '#a89f94',
  accent: '#b8863e', accentSoft: '#b8863e0f', accentMid: '#b8863e33',
  red: '#b84040', redSoft: '#b8404012',
  green: '#3a8a60', greenSoft: '#3a8a6012',
  gold: '#c9a96e', goldSoft: '#c9a96e18',
};

export default function PdfIngestZone({ brain = 'story', source = 'franchise_bible', version = 'v3.1', onResult }) {
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState('');
  const [error, setError]         = useState(null);
  const [fileName, setFileName]   = useState(null);
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('PDF is too large. Maximum size is 20MB.');
      return;
    }

    setError(null);
    setFileName(file.name);
    setUploading(true);
    setProgress('Extracting text from PDF…');

    try {
      const formData = new FormData();
      formData.append('file',            file);
      formData.append('brain',           brain);
      formData.append('source_document', source);
      formData.append('source_version',  version);

      setProgress('Sending to knowledge extraction…');

      const res  = await fetch(`${API}/franchise-brain/ingest-pdf`, {
        method: 'POST',
        body:   formData,
        // No Content-Type header — browser sets it with boundary automatically
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setProgress('');
      setUploading(false);
      setFileName(null);

      if (onResult) onResult(data);
    } catch (err) {
      setError(err.message);
      setUploading(false);
      setProgress('');
    }
  }, [brain, source, version, onResult]);

  // Drag events
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDragging(false); };
  const onDrop      = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };
  const onFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ''; // reset so same file can be re-selected
  };

  return (
    <div style={{ marginBottom: '4px' }}>

      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? C.accent : uploading ? C.accentMid : C.borderDark}`,
          borderRadius: '3px',
          background: dragging ? C.accentSoft : uploading ? C.accentSoft : C.surfaceAlt,
          padding: '28px 20px',
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {uploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <Spin />
            <div style={{ fontSize: '13px', color: C.textDim }}>{progress}</div>
            {fileName && <div style={{ fontSize: '11px', color: C.textFaint }}>{fileName}</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '22px', opacity: 0.4 }}>⬡</div>
            <div style={{ fontSize: '13px', color: C.textDim, fontWeight: '500' }}>
              Drop a PDF here, or <span style={{ color: C.accent, textDecoration: 'underline' }}>browse</span>
            </div>
            <div style={{ fontSize: '11px', color: C.textFaint }}>
              Franchise bible, TDD, Roadmap, Deviations — any of your v3.1 docs · Max 20MB
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <BrainBadge active={brain === 'story'} color={C.accent}>Story Brain</BrainBadge>
              <BrainBadge active={brain === 'tech'}  color={C.gold}>Tech Brain</BrainBadge>
              <span style={{ fontSize: '10px', color: C.textFaint, alignSelf: 'center' }}>
                — selected above
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={onFileInput}
        style={{ display: 'none' }}
      />

      {/* Error */}
      {error && (
        <div style={{ marginTop: '8px', padding: '10px 12px', background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: '2px', fontSize: '12px', color: C.red, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', padding: '0 4px' }}>✕</button>
        </div>
      )}
    </div>
  );
}

function BrainBadge({ active, color, children }) {
  return (
    <span style={{
      padding: '2px 8px',
      background: active ? `${color}18` : 'transparent',
      border: `1px solid ${active ? color + '55' : '#e0d9ce'}`,
      borderRadius: '2px',
      fontSize: '10px',
      color: active ? color : '#a89f94',
      fontWeight: active ? '600' : '400',
      letterSpacing: '0.06em',
    }}>{children}</span>
  );
}

function Spin() {
  return (
    <>
      <div style={{ width: '18px', height: '18px', border: '2px solid #e0d9ce', borderTop: `2px solid #b8863e`, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
