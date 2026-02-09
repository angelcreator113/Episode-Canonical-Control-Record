import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ScriptGeneratorSmart = ({ episodeId, showId, onScriptGenerated }) => {
  const [template, setTemplate] = useState(null);
  const [variables, setVariables] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showConfig, setShowConfig] = useState(null);

  useEffect(() => {
    loadTemplateAndContext();
  }, [episodeId, showId]);

  const loadTemplateAndContext = async () => {
    try {
      setLoading(true);

      // Get show config
      const configRes = await axios.get(`/api/v1/shows/${showId}/config`);
      setShowConfig(configRes.data.data);

      // Get template
      const templateRes = await axios.get(`/api/v1/shows/${showId}/template`);
      setTemplate(templateRes.data.data);

      // Get AI suggestions (optional - component works without them)
      try {
        const suggestionsRes = await axios.post(`/api/v1/episodes/${episodeId}/script-suggestions`, {
          template_id: templateRes.data.data?.id
        });

        if (suggestionsRes.data.data && Array.isArray(suggestionsRes.data.data)) {
          setSuggestions(suggestionsRes.data.data);

          // Pre-fill variables with suggestions
          const initialVars = {};
          suggestionsRes.data.data.forEach(sugg => {
            initialVars[sugg.variable_key] = sugg.suggested_value;
          });
          setVariables(initialVars);
        }
      } catch (suggError) {
        console.warn('Could not load AI suggestions, continuing without them:', suggError.message);
        // Initialize empty variables from template
        if (templateRes.data.data?.variables) {
          const initialVars = {};
          templateRes.data.data.variables.forEach(variable => {
            initialVars[variable.key] = '';
          });
          setVariables(initialVars);
        }
      }

    } catch (error) {
      console.error('Failed to load generator context:', error);
      
      if (error.response?.status === 404) {
        alert('No script template found for this show. Please create a template first.');
      }
    } finally {
      setLoading(false);
    }
  };

  const generateScript = async () => {
    try {
      setGenerating(true);

      const response = await axios.post(`/api/v1/templates/${template.id}/generate`, {
        episode_id: episodeId,
        variables: variables
      });

      const generated = response.data.data;

      // Call parent callback with generated script
      if (onScriptGenerated) {
        onScriptGenerated(generated.script, generated.metadata);
      }

      alert(`✅ Script generated!\n\nDuration: ~${Math.round(generated.metadata.estimated_duration / 60)} minutes\nWords: ${generated.metadata.word_count}\nScenes: ${generated.metadata.scene_count}`);

    } catch (error) {
      console.error('Failed to generate script:', error);
      alert('Failed to generate script. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
        <p>Loading smart generator...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
        <h3 style={{ color: 'white', marginBottom: '12px' }}>No Template Found</h3>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>
          Create a script template for this show first.
        </p>
        <button
          onClick={() => alert('Template creator coming soon!')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Create Template
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '1000px', 
      margin: '0 auto', 
      padding: '32px 24px',
      color: 'white'
    }}>
      {/* Gradient Background Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        padding: '32px',
        marginBottom: '32px',
        boxShadow: '0 20px 40px rgba(102, 126, 234, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <span style={{ fontSize: '36px' }}>🤖</span>
          <h1 style={{ fontSize: '32px', fontWeight: '700', margin: '0' }}>
            Smart Script Generator
          </h1>
        </div>
        <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '15px', margin: '0', lineHeight: '1.6' }}>
          AI-powered script creation with intelligent variable suggestions based on your show's context and style
        </p>
      </div>

      {/* Info Cards */}
      {showConfig && (
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div style={{ 
            padding: '20px',
            backgroundColor: '#e8f4f8',
            border: '1px solid #c5e4eb',
            borderRadius: '8px',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ color: '#475569', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⏱️ Target Duration
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e40af' }}>
              {Math.round(showConfig.targetDuration / 60)} min
            </div>
          </div>
          
          <div style={{ 
            padding: '20px',
            backgroundColor: '#e8f4f8',
            border: '1px solid #c5e4eb',
            borderRadius: '8px',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ color: '#475569', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🎬 Format
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#059669', textTransform: 'capitalize' }}>
              {showConfig.format}
            </div>
          </div>
          
          <div style={{ 
            padding: '20px',
            backgroundColor: '#e8f4f8',
            border: '1px solid #c5e4eb',
            borderRadius: '8px',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ color: '#475569', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🎯 Tone
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#b45309', textTransform: 'capitalize' }}>
              {showConfig.toneOfVoice}
            </div>
          </div>
        </div>
      )}

      {/* Form Header */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: '#f3f4f6' }}>
          📝 Script Variables
        </h3>
        <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0' }}>
          Fill in the script details. AI suggestions are shown below each field.
        </p>
      </div>

      {/* Variables Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {template?.variables && Array.isArray(template.variables) ? (
          template.variables.map(variable => {
            const suggestion = suggestions.find(s => s.variable_key === variable.key);
            const isModified = suggestion && variables[variable.key] !== suggestion.suggested_value;

            return (
              <div key={variable.key} style={{
                backgroundColor: '#e8f4f8',
                border: '1px solid #c5e4eb',
                borderRadius: '10px',
                padding: '24px',
                transition: 'all 0.2s ease',
                ':hover': { borderColor: '#a8d5e2' }
              }}>
                <label style={{ display: 'block', marginBottom: '16px' }}>
                  <div style={{ 
                    fontSize: '15px', 
                    fontWeight: '700', 
                    color: '#1e293b',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {variable.label}
                    {variable.required && (
                      <span style={{ color: '#ef4444', fontSize: '16px' }}>•</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                    {variable.description}
                  </div>
                </label>

                <textarea
                  value={variables[variable.key] || ''}
                  onChange={(e) => setVariables({
                    ...variables,
                    [variable.key]: e.target.value
                  })}
                  placeholder={variable.examples?.[0] || `Enter ${variable.label.toLowerCase()}...`}
                  rows={3}
                  style={{
                    width: '100%',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    border: '1px solid #a8d5e2',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 0 0 0 rgba(2, 132, 199, 0)'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0284c7';
                    e.target.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#a8d5e2';
                    e.target.style.boxShadow = '0 0 0 0 rgba(2, 132, 199, 0)';
                  }}
                />

              {/* AI Suggestion */}
              {suggestion && (
                <div style={{
                  marginTop: '16px',
                  padding: '14px 16px',
                  backgroundColor: 'linear-gradient(135deg, #7c3aed10 0%, #a78bfa10 100%)',
                  border: '1px solid #7c3aed40',
                  borderRadius: '8px',
                  borderLeft: '4px solid #a78bfa'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    marginBottom: '10px'
                  }}>
                    <span style={{ 
                      fontSize: '12px', 
                      fontWeight: '700',
                      color: '#a78bfa',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      ✨ AI Suggestion
                    </span>
                    {isModified && (
                      <span style={{
                        fontSize: '11px',
                        color: '#166534',
                        fontWeight: '600',
                        backgroundColor: '#dcfce7',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        Modified
                      </span>
                    )}
                  </div>
                  <p style={{ 
                    fontSize: '14px', 
                    color: '#e5e7eb',
                    margin: '0 0 10px 0',
                    lineHeight: '1.5',
                    fontStyle: 'italic'
                  }}>
                    "{suggestion.suggested_value}"
                  </p>
                  {!isModified ? (
                    <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                      💡 {suggestion.context_used?.reasoning || 'AI-generated based on your show context'}
                    </div>
                  ) : (
                    <button
                      onClick={() => setVariables({
                        ...variables,
                        [variable.key]: suggestion.suggested_value
                      })}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: '#7c3aed',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#8d5cf2';
                        e.target.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#7c3aed';
                        e.target.style.transform = 'translateY(0)';
                      }}
                    >
                      ↶ Restore Suggestion
                    </button>
                  )}
                </div>
              )}

              {/* Examples */}
              {variable.examples && variable.examples.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#9ca3af', 
                    marginBottom: '10px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    💡 Quick Examples:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {variable.examples.map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => setVariables({
                          ...variables,
                          [variable.key]: ex
                        })}
                        style={{
                          padding: '8px 14px',
                          backgroundColor: '#ffffff',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '500',
                          transition: 'all 0.2s ease',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.borderColor = '#0284c7';
                          e.target.style.color = '#0369a1';
                          e.target.style.backgroundColor = '#dbeafe';
                          e.target.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.borderColor = '#cbd5e1';
                          e.target.style.color = '#475569';
                          e.target.style.backgroundColor = '#ffffff';
                          e.target.style.transform = 'translateY(0)';
                        }}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
          })
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
            <p>No variables found in template</p>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <div style={{ 
        marginTop: '40px', 
        display: 'flex', 
        justifyContent: 'center',
        gap: '12px'
      }}>
        <button
          onClick={generateScript}
          disabled={generating}
          style={{
            padding: '14px 40px',
            background: generating 
              ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: generating ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: '700',
            boxShadow: generating 
              ? '0 4px 12px rgba(0, 0, 0, 0.2)'
              : '0 8px 24px rgba(102, 126, 234, 0.3)',
            transition: 'all 0.3s ease',
            opacity: generating ? 0.8 : 1,
            transform: generating ? 'scale(0.98)' : 'scale(1)'
          }}
          onMouseEnter={(e) => {
            if (!generating) {
              e.target.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.4)';
              e.target.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!generating) {
              e.target.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.3)';
              e.target.style.transform = 'translateY(0)';
            }
          }}
        >
          {generating ? (
            <>
              <span style={{ marginRight: '8px' }}>⏳</span>
              Generating Script...
            </>
          ) : (
            <>
              <span style={{ marginRight: '8px' }}>✨</span>
              Generate Script
            </>
          )}
        </button>
      </div>

      {/* Footer Info */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        backgroundColor: '#e8f4f8',
        border: '1px solid #c5e4eb',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#475569', fontSize: '13px', margin: '0', lineHeight: '1.6' }}>
          💡 <span style={{ color: '#0369a1' }}>Tip:</span> The generated script can be edited and refined in the script editor. AI suggestions are based on your show's context and past episodes.
        </p>
      </div>
    </div>
  );
};

export default ScriptGeneratorSmart;
