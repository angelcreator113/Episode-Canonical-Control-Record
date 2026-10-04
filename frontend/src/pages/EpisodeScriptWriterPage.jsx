import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FileText, Wand2, Lock, Unlock, ChevronDown, ChevronUp, Eye,
  DollarSign, Shirt, MapPin, MessageCircle, BarChart3, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import './EpisodeScriptWriterPage.css';

const BEAT_NAMES = [
  'Opening Ritual', 'Login Sequence', 'Welcome', 'Interruption Pulse 1',
  'Reveal', 'Strategic Reaction', 'Interruption Pulse 2', 'Transformation Loop',
  'Reminder/Deadline', 'Event Travel', 'Event Outcome',
  'Deliverable Creation', 'Recap Panel', 'Cliffhanger',
];

/**
 * Which Brain rules a generation uses (2026-10-04). "Always inject" is a
 * request, not a guarantee: the writer takes the first 50 eligible rules by
 * severity then id, and this panel names the ones used and the ones left
 * out, for the next generation (the context) and for the script on screen
 * (its context_snapshot.brain_rules).
 */
export function BrainRulesPanel({ rules, heading }) {
  if (!rules) return null;
  const used = rules.used || [];
  const omitted = rules.omitted || [];
  const eligible = rules.eligible ?? used.length + omitted.length;
  return (
    <details className="brain-rules" data-testid="brain-rules">
      <summary>
        {heading}: {used.length} of {eligible} rules
        {omitted.length > 0 && <span className="brain-rules-omitted"> · {omitted.length} left out (limit {rules.limit})</span>}
      </summary>
      <div className="brain-rules-lists">
        <div>
          <h4>Used ({used.length})</h4>
          <ul data-testid="brain-rules-used">{used.map((r) => <li key={r.id}>{r.severity === 'critical' ? '🔴 ' : ''}{r.title}</li>)}</ul>
        </div>
        {omitted.length > 0 && (
          <div>
            <h4>Left out ({omitted.length})</h4>
            <p className="brain-rules-note">Over the limit of {rules.limit}. Lower a rule&apos;s severity or turn off Always inject on the ones that matter less, in the Show Bible.</p>
            <ul data-testid="brain-rules-omitted">{omitted.map((r) => <li key={r.id}>{r.title}</li>)}</ul>
          </div>
        )}
      </div>
    </details>
  );
}

function ContextPanel({ context }) {
  if (!context) return null;
  const rules = context.brain_rules;
  const omitted = rules?.omitted_count || 0;
  return (
    <div className="script-writer-context">
      <h3>Generation Context</h3>
      <div className="script-writer-context-grid">
        <div className={`context-chip ${context.has_brief ? 'ready' : 'missing'}`}>
          <FileText size={14} /> Brief: {context.brief_archetype || 'None'}
        </div>
        <div className={`context-chip ${context.scene_plan_beats > 0 ? 'ready' : 'missing'}`}>
          <MapPin size={14} /> {context.scene_plan_beats} beats planned
        </div>
        <div className={`context-chip ${context.has_event ? 'ready' : 'missing'}`}>
          <Eye size={14} /> {context.event_name || 'No event'}
          {context.event_prestige && ` (P${context.event_prestige})`}
        </div>
        <div className={`context-chip ${context.financial ? 'ready' : 'missing'}`}>
          <DollarSign size={14} />
          {context.financial
            ? `${context.financial.pressure_level} ($${context.financial.balance})`
            : 'No financial data'}
        </div>
        <div className={`context-chip ${context.wardrobe_items > 0 ? 'ready' : 'missing'}`}>
          <Shirt size={14} /> {context.wardrobe_items} wardrobe items
        </div>
        <div className={`context-chip ${context.feed_moments > 0 ? 'ready' : 'missing'}`}>
          <MessageCircle size={14} /> {context.feed_moments} feed moments
        </div>
        <div className={`context-chip ${omitted > 0 ? 'partial' : 'ready'}`} data-testid="brain-rules-chip">
          <BarChart3 size={14} />
          {rules ? `${rules.used_count} of ${rules.eligible} Brain rules` : `${context.franchise_laws} Brain rules`}
        </div>
        {context.opportunities > 0 && (
          <div className="context-chip ready">
            <DollarSign size={14} /> {context.opportunities} opportunities
          </div>
        )}
      </div>
      <BrainRulesPanel rules={rules} heading="Next generation" />
    </div>
  );
}

function ScriptBeat({ beat, index }) {
  const [expanded, setExpanded] = useState(index < 3);

  return (
    <div className={`script-beat ${expanded ? 'expanded' : ''}`}>
      <div className="script-beat-header" onClick={() => setExpanded(!expanded)}>
        <span className="script-beat-number">{beat.beat_number}</span>
        <span className="script-beat-name">{beat.beat_name || BEAT_NAMES[beat.beat_number - 1]}</span>
        {beat.location && <span className="script-beat-location">{beat.location}</span>}
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
      {expanded && (
        <div className="script-beat-lines">
          {(beat.lines || []).map((line, i) => (
            <div key={i} className={`script-line script-line-${line.type}`}>
              {line.speaker && <span className="script-line-speaker">{line.speaker}:</span>}
              <span className="script-line-text">{line.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScriptVersionItem({ script, isActive, onSelect }) {
  return (
    <div
      className={`script-version-item ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(script)}
    >
      <div className="script-version-info">
        <span className="script-version-num">v{script.version}</span>
        <span className={`script-version-status status-${script.status}`}>{script.status}</span>
      </div>
      <div className="script-version-meta">
        {script.word_count && <span>{script.word_count} words</span>}
        {script.financial_context?.pressure_level && (
          <span className={`pressure-${script.financial_context.pressure_level}`}>
            {script.financial_context.pressure_level}
          </span>
        )}
      </div>
      <div className="script-version-date">
        {new Date(script.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}

export default function EpisodeScriptWriterPage() {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const [showId, setShowId] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [scripts, setScripts] = useState([]);
  const [activeScript, setActiveScript] = useState(null);
  const [context, setContext] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [locking, setLocking] = useState(false);
  const [viewMode, setViewMode] = useState('structured'); // structured | raw
  const [error, setError] = useState(null);

  // Load episode
  useEffect(() => {
    api.get(`/api/v1/episodes/${episodeId}`)
      .then(r => {
        const ep = r.data.data || r.data;
        setEpisode(ep);
        setShowId(ep.show_id);
      })
      .catch(err => setError(err.message));
  }, [episodeId]);

  // Load scripts
  const loadScripts = useCallback(() => {
    api.get(`/api/v1/episode-scripts/${episodeId}`)
      .then(r => {
        const list = r.data.data || [];
        setScripts(list);
        if (list.length > 0 && !activeScript) {
          // Auto-select latest
          loadFullScript(list[0]);
        }
      })
      .catch(() => {});
  }, [episodeId, activeScript]);

  useEffect(() => { loadScripts(); }, [loadScripts]);

  // Load context
  useEffect(() => {
    if (!showId) return;
    api.get(`/api/v1/episode-scripts/${episodeId}/context?showId=${showId}`)
      .then(r => setContext(r.data.data))
      .catch(() => {});
  }, [episodeId, showId]);

  const loadFullScript = (scriptSummary) => {
    api.get(`/api/v1/episode-scripts/${episodeId}/version/${scriptSummary.version}`)
      .then(r => setActiveScript(r.data.data))
      .catch(() => setActiveScript(scriptSummary));
  };

  const handleGenerate = async () => {
    if (!showId) return;
    setGenerating(true);
    setError(null);
    const post = (confirmOverwrite) => api.post(`/api/v1/episode-scripts/${episodeId}/generate`, {
      showId, ...(confirmOverwrite ? { confirmOverwrite: true } : {}),
    });
    try {
      let r;
      try {
        r = await post(false);
      } catch (err) {
        if (err.response?.status === 409 && err.response?.data?.code === 'SCRIPT_OVERWRITE_CONFIRMATION_REQUIRED') {
          if (!window.confirm('This episode already has a script. Replace it?')) return;
          r = await post(true);
        } else {
          throw err;
        }
      }
      const script = r.data.data;
      setActiveScript(script);
      loadScripts();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleLock = async () => {
    if (!activeScript) return;
    setLocking(true);
    try {
      await api.post(`/api/v1/episode-scripts/${activeScript.id}/lock`);
      setActiveScript({ ...activeScript, status: 'locked' });
      loadScripts();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLocking(false);
    }
  };

  return (
    <div className="script-writer-page">
      <div className="script-writer-header">
        <button className="script-writer-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back
        </button>
        <div className="script-writer-title">
          <h1>Script Writer</h1>
          {episode && <p className="script-writer-episode-name">{episode.title}</p>}
        </div>
        <div className="script-writer-actions">
          <button
            className="script-writer-btn generate"
            onClick={handleGenerate}
            disabled={generating || !context?.ready}
          >
            <Wand2 size={16} />
            {generating ? 'Writing...' : 'Generate Script'}
          </button>
          {activeScript && activeScript.status !== 'locked' && (
            <button
              className="script-writer-btn lock"
              onClick={handleLock}
              disabled={locking}
            >
              <Lock size={16} /> Lock Script
            </button>
          )}
          {activeScript?.status === 'locked' && (
            <span className="script-writer-locked-badge">
              <Lock size={14} /> Locked
            </span>
          )}
        </div>
      </div>

      {error && <div className="script-writer-error">{error}</div>}

      <ContextPanel context={context} />

      <div className="script-writer-layout">
        {/* Sidebar — version list */}
        <div className="script-writer-sidebar">
          <h3>Versions ({scripts.length})</h3>
          {scripts.length === 0 && (
            <p className="script-writer-empty">No scripts yet. Generate one above.</p>
          )}
          {scripts.map(s => (
            <ScriptVersionItem
              key={s.id || s.version}
              script={s}
              isActive={activeScript?.version === s.version}
              onSelect={loadFullScript}
            />
          ))}
        </div>

        {/* Main — script viewer */}
        <div className="script-writer-main">
          {!activeScript ? (
            <div className="script-writer-empty-state">
              <FileText size={48} />
              <p>No script selected</p>
              <p>Generate a script to see it here, or select a version from the sidebar.</p>
            </div>
          ) : (
            <>
              <div className="script-writer-toolbar">
                <div className="script-writer-view-toggle">
                  <button
                    className={viewMode === 'structured' ? 'active' : ''}
                    onClick={() => setViewMode('structured')}
                  >Structured</button>
                  <button
                    className={viewMode === 'raw' ? 'active' : ''}
                    onClick={() => setViewMode('raw')}
                  >Raw Text</button>
                </div>
                <div className="script-writer-stats">
                  <span>{activeScript.word_count || '?'} words</span>
                  <span>{activeScript.beat_count || 14} beats</span>
                  {activeScript.voice_score && <span>Voice: {activeScript.voice_score}/100</span>}
                </div>
              </div>
              <BrainRulesPanel rules={activeScript.context_snapshot?.brain_rules} heading="This script used" />

              {viewMode === 'structured' && activeScript.script_json ? (
                <div className="script-writer-beats">
                  {activeScript.script_json.map((beat, i) => (
                    <ScriptBeat key={beat.beat_number || i} beat={beat} index={i} />
                  ))}
                </div>
              ) : (
                <pre className="script-writer-raw">{activeScript.script_text || 'No text'}</pre>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="script-writer-links">
        <Link to={`/episodes/${episodeId}/plan`}>Beat Plan</Link>
        <Link to={`/episodes/${episodeId}`}>Episode Detail</Link>
        <Link to={`/episodes/${episodeId}/todo`}>Todo List</Link>
      </div>
    </div>
  );
}
