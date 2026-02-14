import React, { useState } from 'react';
import { FiStar, FiHeart, FiZap, FiCamera } from 'react-icons/fi';
import axios from 'axios';

const LalaScriptGenerator = ({ episodeId, onGenerated }) => {
  const [formula, setFormula] = useState({
    // 1. Opening Ritual
    emotional_vibe: '',
    
    // 2. Interruption
    interruption_type: '',
    interruption_content: '',
    
    // 3. Reveal
    event_theme: '',
    why_it_matters: '',
    
    // 4. Intention
    identity_stepping_into: '',
    
    // 5. Transformation
    outfit_vibe: '',
    accessory_vibe: '',
    shoe_energy: '',
    final_touch: '',
    
    // 6. Payoff
    what_this_look_makes_you_feel: '',
    
    // 7. Invitation
    audience_action: '',
    
    // 8. Cliffhanger
    next_tease: ''
  });

  const [generating, setGenerating] = useState(false);
  const [generatedScript, setGeneratedScript] = useState(null);

  const emotionalVibes = [
    'confidence', 'softness', 'power', 'romance', 'reset', 'glow-up'
  ];

  const interruptionTypes = [
    'invitation', 'message', 'challenge', 'quest', 'realization'
  ];

  const audienceActions = [
    'style_own_version', 'comment', 'shop', 'join_next_episode'
  ];

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      
      const response = await axios.post(`/api/v1/episodes/${episodeId}/generate-lala-script`, {
        formula
      });
      
      setGeneratedScript(response.data.data.script);
      
      if (onGenerated) {
        onGenerated(response.data.data.script, response.data.data.metadata);
      }
    } catch (error) {
      console.error('Failed to generate script:', error);
      alert('Failed to generate script');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: '900',
          background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px'
        }}>
          ✨ Styling Adventures Generator
        </h1>
        <p style={{ fontSize: '16px', color: '#6b7280' }}>
          The Formula That Creates Episodes, Not Videos
        </p>
      </div>

      {/* 1. Opening Ritual */}
      <div className="ed-card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '16px'
        }}>
          <FiStar size={24} style={{ color: '#ec4899' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
            1. Opening Ritual (Brand Anchor)
          </h3>
        </div>
        
        <div style={{
          padding: '16px',
          backgroundColor: '#fdf2f8',
          borderRadius: '8px',
          marginBottom: '16px',
          borderLeft: '4px solid #ec4899'
        }}>
          <p style={{ 
            fontStyle: 'italic', 
            color: '#831843',
            margin: 0,
            fontSize: '15px'
          }}>
            "Bestie, come style me — I'm ready for a new slay. Logging in…"
          </p>
        </div>

        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
          What emotional shift are we styling today? *
        </label>
        <select
          value={formula.emotional_vibe}
          onChange={(e) => setFormula({ ...formula, emotional_vibe: e.target.value })}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px'
          }}
        >
          <option value="">Choose vibe...</option>
          {emotionalVibes.map(vibe => (
            <option key={vibe} value={vibe}>{vibe}</option>
          ))}
        </select>
      </div>

      {/* 2. The Interruption */}
      <div className="ed-card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '16px'
        }}>
          <FiZap size={24} style={{ color: '#f59e0b' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
            2. The Interruption (Story Trigger)
          </h3>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
            What interrupts Lala's day? *
          </label>
          <select
            value={formula.interruption_type}
            onChange={(e) => setFormula({ ...formula, interruption_type: e.target.value })}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            <option value="">Choose trigger...</option>
            {interruptionTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
            What's the content of this interruption?
          </label>
          <textarea
            value={formula.interruption_content}
            onChange={(e) => setFormula({ ...formula, interruption_content: e.target.value })}
            placeholder="e.g., 'You've been invited to the Annual Fashion Gala'"
            rows={3}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              resize: 'vertical'
            }}
          />
        </div>
      </div>

      {/* 3. The Reveal */}
      <div className="ed-card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '16px'
        }}>
          <FiCamera size={24} style={{ color: '#8b5cf6' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
            3. The Reveal (Adventure Begins)
          </h3>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
            What is the event/adventure theme? *
          </label>
          <input
            type="text"
            value={formula.event_theme}
            onChange={(e) => setFormula({ ...formula, event_theme: e.target.value })}
            placeholder="e.g., 'Rooftop Sunset Gala'"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
            Why does this event matter? *
          </label>
          <textarea
            value={formula.why_it_matters}
            onChange={(e) => setFormula({ ...formula, why_it_matters: e.target.value })}
            placeholder="e.g., 'This is where influencers meet fashion designers'"
            rows={3}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              resize: 'vertical'
            }}
          />
        </div>
      </div>

      {/* 4. The Intention */}
      <div className="ed-card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          marginBottom: '16px'
        }}>
          <FiHeart size={24} style={{ color: '#ef4444' }} />
          <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
            4. The Intention (Identity)
          </h3>
        </div>

        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
          Who is Lala becoming? What identity is she stepping into? *
        </label>
        <input
          type="text"
          value={formula.identity_stepping_into}
          onChange={(e) => setFormula({ ...formula, identity_stepping_into: e.target.value })}
          placeholder="e.g., 'A confident trendsetter who owns the room'"
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px'
          }}
        />
      </div>

      {/* 5. Transformation Loop */}
      <div className="ed-card" style={{ marginBottom: '24px', padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
          5. Transformation Loop (Core Gameplay)
        </h3>

        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
              Outfit Vibe *
            </label>
            <input
              type="text"
              value={formula.outfit_vibe}
              onChange={(e) => setFormula({ ...formula, outfit_vibe: e.target.value })}
              placeholder="e.g., 'Sophisticated elegance with edge'"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
              Accessory Vibe
            </label>
            <input
              type="text"
              value={formula.accessory_vibe}
              onChange={(e) => setFormula({ ...formula, accessory_vibe: e.target.value })}
              placeholder="e.g., 'Statement gold jewelry'"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
              Shoe Energy
            </label>
            <input
              type="text"
              value={formula.shoe_energy}
              onChange={(e) => setFormula({ ...formula, shoe_energy: e.target.value })}
              placeholder="e.g., 'Sky-high confidence in red heels'"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
              Final Touch / Signature Detail
            </label>
            <input
              type="text"
              value={formula.final_touch}
              onChange={(e) => setFormula({ ...formula, final_touch: e.target.value })}
              placeholder="e.g., 'Signature red lip and diamond studs'"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
      </div>

      {/* 6. The Payoff */}
      <div className="ed-card" style={{ marginBottom: '24px', padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
          6. The Payoff (Mirror the Viewer)
        </h3>

        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
          What does this look make you feel? *
        </label>
        <textarea
          value={formula.what_this_look_makes_you_feel}
          onChange={(e) => setFormula({ ...formula, what_this_look_makes_you_feel: e.target.value })}
          placeholder="e.g., 'Like you can walk into any room and own it with quiet confidence'"
          rows={3}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            resize: 'vertical'
          }}
        />
      </div>

      {/* 7. The Invitation */}
      <div className="ed-card" style={{ marginBottom: '24px', padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
          7. The Invitation (Soft Conversion)
        </h3>

        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
          How can the audience join in? *
        </label>
        <select
          value={formula.audience_action}
          onChange={(e) => setFormula({ ...formula, audience_action: e.target.value })}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px'
          }}
        >
          <option value="">Choose action...</option>
          {audienceActions.map(action => (
            <option key={action} value={action}>
              {action.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* 8. The Cliffhanger */}
      <div className="ed-card" style={{ marginBottom: '32px', padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
          8. The Cliffhanger (Return Loop)
        </h3>

        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
          What's teased for next time? *
        </label>
        <textarea
          value={formula.next_tease}
          onChange={(e) => setFormula({ ...formula, next_tease: e.target.value })}
          placeholder="e.g., 'New DM from mysterious brand... Paris Fashion Week invite?'"
          rows={3}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            resize: 'vertical'
          }}
        />
      </div>

      {/* Generate Button */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={handleGenerate}
          disabled={generating || !formula.emotional_vibe || !formula.event_theme}
          style={{
            padding: '16px 48px',
            background: generating ? '#9ca3af' : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: generating || !formula.emotional_vibe ? 'not-allowed' : 'pointer',
            fontWeight: '700',
            fontSize: '16px',
            boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)'
          }}
        >
          {generating ? '✨ Generating Your Episode...' : '🎬 Generate Episode Script'}
        </button>
      </div>

      {/* Generated Script Preview */}
      {generatedScript && (
        <div className="ed-card" style={{ marginTop: '32px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
            ✅ Episode Script Generated!
          </h3>
          <div style={{
            backgroundColor: '#f9fafb',
            padding: '16px',
            borderRadius: '8px',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            <pre style={{
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              margin: 0,
              fontFamily: 'monospace',
              fontSize: '13px'
            }}>
              {generatedScript}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default LalaScriptGenerator;
