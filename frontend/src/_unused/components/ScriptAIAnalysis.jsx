import { useState, useEffect } from 'react';
import { FiZap, FiCheckCircle, FiAlertCircle, FiClock, FiRefreshCw, FiSliders } from 'react-icons/fi';
import scriptsService from '../services/scriptsService';

/**
 * Script AI Analysis Component
 * Shows AI analysis status and results
 */
export default function ScriptAIAnalysis({ episodeId, scriptId, script }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisEnabled, setAnalysisEnabled] = useState(script?.ai_analysis_enabled || false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Duration settings
  const [targetDuration, setTargetDuration] = useState(180); // 3 minutes default
  const [showSettings, setShowSettings] = useState(false);
  const [pacing, setPacing] = useState('medium'); // slow, medium, fast

  // Load metadata on mount if script has been analyzed
  useEffect(() => {
    if (scriptId && script?.last_analyzed_at) {
      loadMetadata();
    }
  }, [scriptId, script?.last_analyzed_at]);

  const loadMetadata = async () => {
    try {
      setLoading(true);
      const response = await scriptsService.getScriptMetadata(scriptId);
      if (response.metadata && response.metadata.length > 0) {
        setAnalysisResults({
          scenes: response.metadata,
          total_duration: response.metadata.reduce((sum, m) => sum + (m.duration_target_seconds || 0), 0),
          confidence_score: 0.90, // TODO: Store this in DB
        });
      }
    } catch (err) {
      console.error('Failed to load metadata:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAnalysis = async () => {
    try {
      setError(null);
      const newState = !analysisEnabled;
      await scriptsService.toggleAIAnalysis(scriptId, newState);
      setAnalysisEnabled(newState);
    } catch (err) {
      console.error('Failed to toggle AI analysis:', err);
      setError('Failed to update AI analysis setting');
    }
  };

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const response = await scriptsService.analyzeScript(scriptId, {
        targetDuration,
        pacing
      });
      setAnalysisResults(response.analysis);
    } catch (err) {
      console.error('AI analysis failed:', err);
      setError(err.response?.data?.message || 'Analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    if (analyzing) return <FiRefreshCw className="animate-spin text-purple-500" />;
    if (analysisResults) return <FiCheckCircle className="text-green-500" />;
    if (analysisEnabled) return <FiClock className="text-yellow-500" />;
    return <FiAlertCircle className="text-gray-400" />;
  };

  const getStatusText = () => {
    if (analyzing) return 'Analyzing script with Claude AI...';
    if (analysisResults) return 'Analysis complete';
    if (analysisEnabled) return 'Ready for analysis';
    return 'AI analysis disabled';
  };

  if (!scriptId) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
        Select a script to enable AI analysis
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-4" style={{
      background: 'linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%)',
      borderRadius: '16px',
      border: '2px solid #e9d5ff',
      padding: '24px',
      marginTop: '20px',
      boxShadow: '0 4px 12px rgba(139, 92, 246, 0.1)'
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4" style={{ marginBottom: '20px' }}>
        <div className="flex items-center space-x-3" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FiZap className="text-purple-500 text-xl" style={{ color: '#8b5cf6', fontSize: '24px' }} />
          <h3 className="text-lg font-semibold text-gray-900" style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>AI Script Analysis</h3>
        </div>
        
        {/* Toggle Switch */}
        <label className="flex items-center cursor-pointer" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '12px' }}>
          <div className="relative" style={{ position: 'relative', width: '56px', height: '32px' }}>
            <input
              type="checkbox"
              className="sr-only"
              style={{ display: 'none' }}
              checked={analysisEnabled}
              onChange={handleToggleAnalysis}
            />
            <div className={`block w-14 h-8 rounded-full ${analysisEnabled ? 'bg-purple-500' : 'bg-gray-300'}`} style={{
              width: '56px',
              height: '32px',
              borderRadius: '16px',
              background: analysisEnabled ? 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)' : '#d1d5db',
              transition: 'all 0.3s ease',
              boxShadow: analysisEnabled ? '0 4px 12px rgba(139, 92, 246, 0.4)' : 'none'
            }}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${analysisEnabled ? 'transform translate-x-6' : ''}`} style={{
              position: 'absolute',
              left: analysisEnabled ? '28px' : '4px',
              top: '4px',
              width: '24px',
              height: '24px',
              borderRadius: '12px',
              background: '#ffffff',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
            }}></div>
          </div>
          <span className="ml-3 text-sm font-medium text-gray-700" style={{
            fontSize: '14px',
            fontWeight: '600',
            color: analysisEnabled ? '#8b5cf6' : '#6b7280'
          }}>
            {analysisEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </label>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Status Bar */}
      <div className="flex items-center space-x-2 mb-4">
        {getStatusIcon()}
        <span className="text-sm text-gray-600">{getStatusText()}</span>
        {script?.last_analyzed_at && (
          <span className="text-xs text-gray-400">
            Last analyzed: {new Date(script.last_analyzed_at).toLocaleString()}
          </span>
        )}
      </div>

      {/* Duration Settings */}
      {analysisEnabled && (
        <>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              width: '100%',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: '#f9fafb',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '14px',
              color: '#374151'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f3f4f6'}
            onMouseOut={(e) => e.currentTarget.style.background = '#f9fafb'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiSliders />
              <span>Video Settings</span>
            </div>
            <span style={{ color: '#8b5cf6', fontWeight: '600' }}>
              {formatDuration(targetDuration)} • {pacing}
            </span>
          </button>

          {showSettings && (
            <div style={{
              marginBottom: '16px',
              padding: '16px',
              background: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb'
            }}>
              {/* Target Duration Slider */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Target Video Duration: <span style={{ color: '#8b5cf6' }}>{formatDuration(targetDuration)}</span>
                </label>
                <input
                  type="range"
                  min="60"
                  max="600"
                  step="15"
                  value={targetDuration}
                  onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: '4px',
                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((targetDuration - 60) / (600 - 60)) * 100}%, #e5e7eb ${((targetDuration - 60) / (600 - 60)) * 100}%, #e5e7eb 100%)`,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                  <span>1:00</span>
                  <span>5:00</span>
                  <span>10:00</span>
                </div>
              </div>

              {/* Pacing Options */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Video Pacing</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {['slow', 'medium', 'fast'].map((pace) => (
                    <button
                      key={pace}
                      onClick={() => setPacing(pace)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        border: pacing === pace ? 'none' : '1px solid #d1d5db',
                        background: pacing === pace ? 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)' : '#ffffff',
                        color: pacing === pace ? '#ffffff' : '#374151',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => {
                        if (pacing !== pace) e.currentTarget.style.background = '#f9fafb';
                      }}
                      onMouseOut={(e) => {
                        if (pacing !== pace) e.currentTarget.style.background = '#ffffff';
                      }}
                    >
                      {pace.charAt(0).toUpperCase() + pace.slice(1)}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                  {pacing === 'slow' && '🐢 More detailed scenes, longer shots'}
                  {pacing === 'medium' && '⚡ Balanced pacing, standard cuts'}
                  {pacing === 'fast' && '🚀 Quick cuts, dynamic energy'}
                </p>
              </div>

              {/* Duration Info */}
              <div style={{
                fontSize: '12px',
                color: '#1e40af',
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                border: '1px solid #93c5fd',
                borderRadius: '8px',
                padding: '8px',
                marginTop: '12px'
              }}>
                <strong>💡 Tip:</strong> AI will distribute the {formatDuration(targetDuration)} across all detected scenes based on {pacing} pacing.
              </div>
            </div>
          )}
        </>
      )}

      {/* Analysis Button */}
      {analysisEnabled && (
        <button
          onClick={handleRunAnalysis}
          disabled={analyzing || loading}
          className={`w-full py-2 px-4 rounded-lg font-medium transition ${
            analyzing || loading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-purple-500 text-white hover:bg-purple-600'
          }`}
          style={{
            width: '100%',
            padding: '12px 24px',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: '600',
            border: 'none',
            cursor: analyzing || loading ? 'not-allowed' : 'pointer',
            background: analyzing || loading
              ? '#d1d5db'
              : 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
            color: analyzing || loading ? '#9ca3af' : '#ffffff',
            boxShadow: analyzing || loading ? 'none' : '0 4px 12px rgba(139, 92, 246, 0.3)',
            transition: 'all 0.3s ease',
            transform: analyzing || loading ? 'none' : 'translateY(0)',
          }}
          onMouseOver={(e) => !analyzing && !loading && (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseOut={(e) => !analyzing && !loading && (e.currentTarget.style.transform = 'translateY(0)')}
        >
          {analyzing ? '⚡ Analyzing with Claude AI...' : `🚀 Run AI Analysis (${formatDuration(targetDuration)} video)`}
        </button>
      )}

      {/* Loading State */}
      {loading && (
        <div className="mt-4 text-center">
          <FiRefreshCw className="animate-spin mx-auto text-purple-500 text-2xl" />
          <p className="text-sm text-gray-500 mt-2">Loading analysis results...</p>
        </div>
      )}

      {/* Analysis Results */}
      {!loading && analysisResults && (
        <div style={{ marginTop: '24px' }}>
          {/* Summary Stats at Top */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '24px',
            padding: '16px',
            background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#8b5cf6', marginBottom: '4px' }}>
                {analysisResults.scenes?.length || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Scenes</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#8b5cf6', marginBottom: '4px' }}>
                {analysisResults.total_duration || 0}s
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Total Duration</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#8b5cf6', marginBottom: '4px' }}>
                {(analysisResults.confidence_score * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Confidence</div>
            </div>
          </div>

          {/* Scenes Grid */}
          <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🎬 Detected Scenes ({analysisResults.scenes?.length || 0})
            </h4>
            {analysisResults.scenes?.length > 0 ? (
              <div style={{ display: 'grid', gap: '16px', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
                {analysisResults.scenes.map((scene, idx) => {
                  const sceneTypeColors = {
                    intro: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
                    main: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
                    transition: { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
                    outro: { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' }
                  };
                  const energyColors = {
                    high: { bg: '#fecaca', text: '#991b1b', icon: '🔥' },
                    medium: { bg: '#fed7aa', text: '#9a3412', icon: '⚡' },
                    low: { bg: '#bbf7d0', text: '#166534', icon: '🌿' }
                  };
                  const colors = sceneTypeColors[scene.scene_type] || sceneTypeColors.main;
                  const energy = energyColors[scene.energy_level] || energyColors.medium;

                  return (
                    <div key={idx} style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      padding: '16px',
                      border: `2px solid ${colors.border}`,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(139, 92, 246, 0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                    }}>
                      {/* Scene Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>
                          {scene.scene_id}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          background: colors.bg,
                          color: colors.text,
                          padding: '4px 10px',
                          borderRadius: '20px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {scene.scene_type}
                        </span>
                      </div>

                      {/* Scene Metrics */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ textAlign: 'center', padding: '8px', background: '#f9fafb', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Duration</div>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: '#8b5cf6' }}>
                            {scene.duration_target_seconds}s
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '8px', background: energy.bg, borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Energy</div>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: energy.text }}>
                            {energy.icon} {scene.energy_level}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '8px', background: '#f9fafb', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Clips</div>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: '#8b5cf6' }}>
                            {scene.estimated_clips_needed}
                          </div>
                        </div>
                      </div>

                      {/* Visual Requirements */}
                      {scene.visual_requirements?.requirements && (
                        <div style={{
                          paddingTop: '12px',
                          borderTop: '1px solid #e5e7eb'
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🎨 Visual Requirements
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {scene.visual_requirements.requirements.map((req, i) => (
                              <span key={i} style={{
                                fontSize: '11px',
                                background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                                color: '#6b21a8',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontWeight: '500',
                                border: '1px solid #d8b4fe'
                              }}>
                                {req}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '20px' }}>No scenes detected yet</p>
            )}
          </div>

          {/* Suggestions */}
          {analysisResults.suggestions && analysisResults.suggestions.length > 0 && (
            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '20px', marginTop: '20px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💡 AI Suggestions
              </h4>
              <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderRadius: '12px', padding: '16px', border: '1px solid #fcd34d' }}>
                {analysisResults.suggestions.map((suggestion, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: idx < analysisResults.suggestions.length - 1 ? '8px' : '0' }}>
                    <span style={{ fontSize: '16px', marginRight: '8px', flexShrink: 0 }}>✨</span>
                    <span style={{ fontSize: '14px', color: '#78350f', lineHeight: '1.5' }}>{suggestion}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {analysisResults.warnings && analysisResults.warnings.length > 0 && (
            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '20px', marginTop: '20px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚠️ Warnings
              </h4>
              <div style={{ background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', borderRadius: '12px', padding: '16px', border: '1px solid #fca5a5' }}>
                {analysisResults.warnings.map((warning, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: idx < analysisResults.warnings.length - 1 ? '8px' : '0' }}>
                    <span style={{ fontSize: '16px', marginRight: '8px', flexShrink: 0 }}>⚡</span>
                    <span style={{ fontSize: '14px', color: '#7f1d1d', lineHeight: '1.5' }}>{warning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      {!analysisEnabled && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4" style={{
          marginTop: '16px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          border: '2px solid #bfdbfe',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <p className="text-sm text-blue-700" style={{
            fontSize: '14px',
            color: '#1e40af',
            lineHeight: '1.6',
            margin: 0
          }}>
            <strong style={{ fontWeight: '700' }}>💡 Enable AI analysis</strong> to automatically detect scenes, estimate durations, identify energy levels, and suggest visual requirements from your script using Claude AI.
          </p>
        </div>
      )}
    </div>
  );
}
