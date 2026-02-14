import { useState } from 'react';
import axios from 'axios';

export default function YouTubeAnalyzer({ episodeId }) {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState('input');
  const [metadata, setMetadata] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [detectScenes, setDetectScenes] = useState(false);

  const handlePreview = async () => {
    try {
      setError(null);
      console.log('Fetching metadata for URL:', url);
      
      const response = await axios.get('/api/youtube/metadata', {
        params: { url }
      });
      
      console.log('Metadata received:', response.data);
      setMetadata(response.data.data);
      setStep('preview');
    } catch (err) {
      console.error('Preview error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch metadata');
    }
  };

  const handleAnalyze = async () => {
    try {
      setError(null);
      setStep('processing');
      
      console.log('Starting analysis:', { url, episodeId, detectScenes });
      
      const response = await axios.post('/api/youtube/analyze', {
        url,
        episode_id: episodeId,
        detect_scenes: detectScenes
      });
      
      console.log('Analysis complete:', response.data);
      setAnalysis(response.data.data);
      setStep('complete');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.response?.data?.error || err.message || 'Analysis failed');
      setStep('preview');
    }
  };

  const resetForm = () => {
    setUrl('');
    setStep('input');
    setMetadata(null);
    setAnalysis(null);
    setError(null);
    setDetectScenes(false);
  };

  // INPUT STEP
  if (step === 'input') {
    return (
      <div style={{ 
        maxWidth: '900px', 
        margin: '0 auto', 
        background: 'linear-gradient(135deg, #f3e7ff 0%, #e0f2fe 50%, #dbeafe 100%)',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        border: '1px solid #e9d5ff'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            color: '#1f2937',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '36px', marginRight: '12px' }}>📺</span>
            Analyze YouTube Video
          </h3>
          <p style={{ fontSize: '16px', color: '#6b7280' }}>
            Train the AI to match your preferred editing style by analyzing reference videos
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'block', 
            fontSize: '14px', 
            fontWeight: '600', 
            color: '#374151',
            marginBottom: '8px'
          }}>
            YouTube URL
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: '16px',
              border: '2px solid #d1d5db',
              borderRadius: '12px',
              outline: 'none',
              transition: 'all 0.2s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#a855f7';
              e.target.style.boxShadow = '0 0 0 3px rgba(168, 85, 247, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#d1d5db';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)',
          border: '2px solid #bfdbfe',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          cursor: 'pointer'
        }}
        onClick={() => setDetectScenes(!detectScenes)}>
          <label style={{ display: 'flex', alignItems: 'start', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={detectScenes}
              onChange={(e) => setDetectScenes(e.target.checked)}
              style={{ 
                width: '20px', 
                height: '20px', 
                marginRight: '16px',
                marginTop: '4px',
                cursor: 'pointer'
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: 'bold', 
                color: '#1f2937',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '24px', marginRight: '8px' }}>🎬</span>
                Enable Scene Detection
                <span style={{
                  marginLeft: '12px',
                  padding: '4px 10px',
                  background: '#f3e8ff',
                  color: '#7c3aed',
                  fontSize: '12px',
                  fontWeight: '600',
                  borderRadius: '12px'
                }}>Advanced</span>
              </div>
              <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6' }}>
                Automatically detect scene changes, extract thumbnails, and classify scene types using FFmpeg. 
                This will take longer (2-5 minutes) as it requires downloading the full video.
              </p>
              <div style={{ marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
                <span style={{ marginRight: '16px' }}>⏱️ ~2-5 min</span>
                <span style={{ marginRight: '16px' }}>📦 Full Download</span>
                <span>🤖 AI Classification</span>
              </div>
            </div>
          </label>
        </div>

        {error && (
          <div style={{
            padding: '20px',
            background: '#fef2f2',
            border: '2px solid #fecaca',
            borderRadius: '12px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'start' }}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>⚠️</span>
              <div>
                <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#7f1d1d' }}>Error</p>
                <p style={{ fontSize: '14px', color: '#991b1b', marginTop: '4px' }}>{error}</p>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <button
            onClick={handlePreview}
            disabled={!url}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: url ? '#2563eb' : '#d1d5db',
              color: 'white',
              fontSize: '16px',
              fontWeight: '600',
              borderRadius: '12px',
              border: 'none',
              cursor: url ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: url ? '0 4px 6px rgba(0,0,0,0.1)' : 'none'
            }}
            onMouseOver={(e) => {
              if (url) e.target.style.background = '#1d4ed8';
            }}
            onMouseOut={(e) => {
              if (url) e.target.style.background = '#2563eb';
            }}
          >
            <span style={{ fontSize: '20px' }}>👁️</span>
            <span>Preview</span>
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!url}
            style={{
              flex: 1,
              padding: '16px 24px',
              background: url ? 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)' : '#d1d5db',
              color: 'white',
              fontSize: '16px',
              fontWeight: '600',
              borderRadius: '12px',
              border: 'none',
              cursor: url ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: url ? '0 4px 6px rgba(0,0,0,0.1)' : 'none'
            }}
            onMouseOver={(e) => {
              if (url) e.target.style.background = 'linear-gradient(135deg, #7e22ce 0%, #db2777 100%)';
            }}
            onMouseOut={(e) => {
              if (url) e.target.style.background = 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)';
            }}
          >
            <span style={{ fontSize: '20px' }}>🤖</span>
            <span>Analyze with AI</span>
          </button>
        </div>

        <div style={{
          background: '#f9fafb',
          borderRadius: '12px',
          padding: '16px',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{ fontSize: '14px', color: '#6b7280', display: 'flex', alignItems: 'start' }}>
            <span style={{ fontSize: '18px', marginRight: '8px' }}>💡</span>
            <span>
              <strong style={{ color: '#374151' }}>Pro Tip:</strong> Choose videos that match your desired editing style. 
              The AI will learn from pacing, transitions, and storytelling techniques.
            </span>
          </p>
        </div>
      </div>
    );
  }

  // PREVIEW STEP
  if (step === 'preview' && metadata) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #f3e7ff 0%, #e0f2fe 50%, #dbeafe 100%)',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          border: '1px solid #e9d5ff'
        }}>
          <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '24px' }}>Video Preview</h3>
          
          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
            {metadata.thumbnails?.[0]?.url && (
              <img
                src={metadata.thumbnails[0].url}
                alt={metadata.title}
                style={{ width: '192px', height: '144px', objectFit: 'cover', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
              />
            )}
            
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', marginBottom: '12px' }}>{metadata.title}</h4>
              <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.8' }}>
                <p><strong>Channel:</strong> {metadata.author}</p>
                <p><strong>Views:</strong> {metadata.viewCount?.toLocaleString()}</p>
                <p><strong>Duration:</strong> {Math.floor(metadata.lengthSeconds / 60)}:{(metadata.lengthSeconds % 60).toString().padStart(2, '0')}</p>
                {metadata.category && <p><strong>Category:</strong> {metadata.category}</p>}
              </div>
            </div>
          </div>

          {detectScenes && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: '#f5f3ff',
              border: '2px solid #e9d5ff',
              borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', color: '#6b21a8', marginBottom: '8px' }}>
                <span style={{ fontSize: '20px', marginRight: '8px' }}>🎬</span>
                <span style={{ fontWeight: '600' }}>Scene detection enabled</span>
              </div>
              <p style={{ fontSize: '14px', color: '#7c3aed' }}>
                Processing will take approximately 2-5 minutes to download, analyze, and detect scenes.
              </p>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: '#fef2f2',
              border: '2px solid #fecaca',
              borderRadius: '12px'
            }}>
              <p style={{ color: '#991b1b' }}>{error}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
            <button
              onClick={() => setStep('input')}
              style={{
                padding: '14px 24px',
                background: '#4b5563',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = '#374151'}
              onMouseOut={(e) => e.target.style.background = '#4b5563'}
            >
              Back
            </button>
            <button
              onClick={handleAnalyze}
              style={{
                flex: 1,
                padding: '14px 24px',
                background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
              onMouseOver={(e) => e.target.style.background = 'linear-gradient(135deg, #7e22ce 0%, #db2777 100%)'}
              onMouseOut={(e) => e.target.style.background = 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)'}
            >
              <span style={{ fontSize: '20px' }}>🤖</span>
              <span>Analyze with AI</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PROCESSING STEP
  if (step === 'processing') {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mb-4"></div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {detectScenes ? '🎬 Processing Video & Detecting Scenes...' : '🤖 Analyzing Video...'}
          </h3>
          <p className="text-gray-600 mb-6">
            {detectScenes 
              ? 'This may take 2-5 minutes. Downloading video, analyzing content, and detecting scene changes...'
              : 'This may take 30-60 seconds...'}
          </p>
          
          <div className="max-w-md mx-auto space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">⬇️ Downloading video</span>
              <div className="animate-pulse text-purple-600">●</div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">☁️ Uploading to S3</span>
              <div className="animate-pulse text-purple-600">●</div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">🤖 Analyzing with Claude AI</span>
              <div className="animate-pulse text-purple-600">●</div>
            </div>
            {detectScenes && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">🎬 Detecting scenes</span>
                <div className="animate-pulse text-purple-600">●</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // COMPLETE STEP
  if (step === 'complete' && analysis) {
    return (
      <div className="p-6">
        <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-3">✅</span>
            <h3 className="text-xl font-bold text-green-900">Analysis Complete!</h3>
          </div>
          <p className="text-green-800">Video analyzed and saved to training library</p>
          
          <div className="mt-3 space-y-1 text-sm">
            <p><strong>Video ID:</strong> {analysis.metadata?.videoId || 'N/A'}</p>
            <p><strong>Duration:</strong> {analysis.metadata?.lengthSeconds ? 
              `${Math.floor(analysis.metadata.lengthSeconds / 60)}:${(analysis.metadata.lengthSeconds % 60).toString().padStart(2, '0')}` 
              : '0:00'}</p>
            <p><strong>Analyzed:</strong> {new Date(analysis.created_at).toLocaleString()}</p>
            {analysis.scenes_count > 0 && (
              <p className="text-purple-700 font-semibold">
                <span className="mr-2">🎬</span>
                {analysis.scenes_count} scenes detected
              </p>
            )}
          </div>
        </div>

        {analysis.analysis_result && !analysis.analysis_result.error && (
          <div className="mb-6">
            <h4 className="text-lg font-bold mb-4 flex items-center">
              <span className="mr-2">📊</span>
              Analysis Results
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(analysis.analysis_result)
                .filter(key => !['error', 'raw_analysis', 'raw_metadata'].includes(key))
                .map(key => {
                  const value = analysis.analysis_result[key];
                  const displayValue = typeof value === 'object' 
                    ? JSON.stringify(value, null, 2)
                    : String(value);
                  
                  return (
                    <div key={key} className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm font-semibold text-gray-600 mb-1 capitalize">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-gray-900">
                        {typeof value === 'object' ? (
                          <pre className="text-xs overflow-auto">{displayValue}</pre>
                        ) : (
                          displayValue
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {analysis.analysis_result?.error && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800">⚠️ Analysis incomplete: {analysis.analysis_result.error}</p>
            {analysis.analysis_result.raw_analysis && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-yellow-700 hover:text-yellow-900">
                  View Raw Analysis
                </summary>
                <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-auto max-h-48">
                  {analysis.analysis_result.raw_analysis}
                </pre>
              </details>
            )}
          </div>
        )}

        <button
          onClick={resetForm}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          Analyze Another Video
        </button>
      </div>
    );
  }

  return null;
}
