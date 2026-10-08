import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import SocialTaskBadge from '../SocialTaskBadge';
import { isSocialTaskRequired } from '../../utils/socialTaskSource';

// The wardrobe list wears the gold accent, the career list the lavender
// (the Assets redesign, 2026-10-08): borders, check squares and the
// progress fill take the list's colour; actions are always the lavender.
// Styles in EpisodeAssetsTab.css (.etl-*).

/**
 * EpisodeTodoList
 *
 * Shows TWO to-do checklists for an episode:
 *   1. Wardrobe Shopping List (UI.OVERLAY.WARDROBE_LIST) — cute vibe-based names per outfit piece
 *   2. Career Checklist (UI.OVERLAY.CAREER_LIST) — a view of the episode's one
 *      task list (T2, §8(bb); Task #2294): host requirements, brand
 *      deliverables, Lala's goals and optional ideas, each labelled. It
 *      loads the saved list (GET /todo/social); Generate adds career goals
 *      and ideas to that list and saves them.
 *
 * Usage:
 *   <EpisodeTodoList
 *     episodeId={episode.id}
 *     showId={show.id}
 *     onAllRequiredComplete={() => { ... }}
 *   />
 */
export default function EpisodeTodoList({ episodeId, showId, onAllRequiredComplete }) {
  const [todoList, setTodoList] = useState(null);
  const [careerList, setCareerList] = useState(null);
  const [activeList, setActiveList] = useState('wardrobe');
  const [generating, setGenerating] = useState(false);
  const [generatingCareer, setGeneratingCareer] = useState(false);
  const [locking, setLocking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAsset, setShowAsset] = useState(false);

  const fetchTodoList = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/episodes/${episodeId}/todo`);
      setTodoList(res.data.data);
      if (res.data.data?.completion?.all_required_done && onAllRequiredComplete) {
        onAllRequiredComplete();
      }
    } catch (err) {
      console.error('[TodoList] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => { fetchTodoList(); }, [fetchTodoList]);

  // T2: the Career Checklist shows the episode's one task list, as saved.
  const fetchOneList = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/episodes/${episodeId}/todo/social`);
      const saved = res?.data?.social_tasks;
      const assetUrl = res?.data?.career_asset_url || null; // T4: the saved image
      if (Array.isArray(saved) && saved.length > 0) {
        setCareerList((prev) => ({ ...(prev || {}), tasks: saved, assetUrl: prev?.assetUrl || assetUrl }));
      }
    } catch (err) {
      console.error('[TodoList] task list fetch error:', err);
    }
  }, [episodeId]);

  useEffect(() => { fetchOneList(); }, [fetchOneList]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await api.post(`/api/v1/episodes/${episodeId}/todo/generate`, { showId });
      await fetchTodoList();
    } catch (err) {
      setError(err.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateCareer = async () => {
    setGeneratingCareer(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/todo/generate-career`, { showId });
      setCareerList(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Career list generation failed');
    } finally {
      setGeneratingCareer(false);
    }
  };

  const toggleIncluded = async (slot) => {
    if (!todoList || todoList.status === 'locked') return;
    const updated = todoList.tasks.map(t =>
      t.slot === slot ? { ...t, included: t.included === false ? true : false } : t
    );
    setTodoList(prev => ({ ...prev, tasks: updated }));
    try {
      await api.post(`/api/v1/episodes/${episodeId}/todo/save-selection`, { tasks: updated });
    } catch { /* best-effort save */ }
  };

  const handleLock = async () => {
    setLocking(true);
    setError(null);
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/todo/lock`);
      setTodoList(prev => ({ ...prev, status: 'locked', asset_url: res.data.assetUrl }));
    } catch (err) {
      setError(err.response?.data?.error || 'Lock failed');
    } finally {
      setLocking(false);
    }
  };

  const handleUnlock = async () => {
    try {
      await api.post(`/api/v1/episodes/${episodeId}/todo/unlock`);
      setTodoList(prev => ({ ...prev, status: 'generated' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Unlock failed');
    }
  };

  if (loading) return (
    <p className="eat-note">Loading checklist...</p>
  );

  if (!todoList) return (
    <div className="etl-empty">
      <div className="etl-empty-icon" aria-hidden="true">👗</div>
      <p className="etl-empty-title">No to-do lists yet</p>
      <p className="etl-text">
        Generate your wardrobe shopping list first — cute, vibe-based names for each outfit piece.
      </p>
      {error && <p className="etl-error" role="alert">{error}</p>}
      <button type="button" className="etl-btn-primary" onClick={handleGenerate} disabled={generating}>
        {generating ? 'Generating...' : 'Generate Wardrobe Shopping List'}
      </button>
    </div>
  );

  const { tasks, completion, asset_url, status } = todoList;
  const isLocked = status === 'locked';
  const includedTasks = tasks.filter(t => t.included !== false);
  const excludedCount = tasks.length - includedTasks.length;
  const pct = completion.total > 0 ? Math.round((completion.completed / completion.total) * 100) : 0;

  const isWardrobe = activeList === 'wardrobe';
  const currentTasks = isWardrobe ? tasks : (careerList?.tasks || []);
  const currentAsset = isWardrobe ? asset_url : careerList?.assetUrl;

  return (
    <div className={`etl ${isWardrobe ? 'is-wardrobe' : 'is-career'}`}>

      {showAsset && currentAsset && (
        <div className="etl-modal" onClick={() => setShowAsset(false)}>
          <div className="etl-modal-card" role="dialog" aria-label="Overlay preview" onClick={e => e.stopPropagation()}>
            <img src={currentAsset} alt={isWardrobe ? 'Wardrobe list' : 'Career list'} />
            <p className="etl-modal-role">
              {isWardrobe ? 'UI.OVERLAY.WARDROBE_LIST' : 'UI.OVERLAY.CAREER_LIST'}
            </p>
            <button type="button" className="etl-btn-primary is-wide" onClick={() => setShowAsset(false)}>Done</button>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="etl-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={isWardrobe}
          className={`etl-tab is-wardrobe${isWardrobe ? ' is-on' : ''}`}
          onClick={() => setActiveList('wardrobe')}
        >
          👗 Wardrobe Shopping List
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isWardrobe}
          className={`etl-tab is-career${!isWardrobe ? ' is-on' : ''}`}
          onClick={() => setActiveList('career')}
        >
          💼 Career Checklist
        </button>
      </div>

      {/* Career list — generate prompt if not yet created */}
      {!isWardrobe && !careerList && (
        <div className="etl-empty is-inline">
          <div className="etl-empty-icon" aria-hidden="true">💼</div>
          <p className="etl-text">
            Generate your career checklist: Lala's goals and ideas, added to the episode's task list. Deliverables come from the event's terms.
          </p>
          <button type="button" className="etl-btn-primary" onClick={handleGenerateCareer} disabled={generatingCareer}>
            {generatingCareer ? 'Generating...' : 'Generate Career Checklist'}
          </button>
        </div>
      )}

      {/* Header — only show for wardrobe or when career exists */}
      {(isWardrobe || careerList) && (
      <div className={`etl-head${completion.all_required_done && isWardrobe ? ' is-done' : ''}`}>
        <div>
          <h3 className="etl-title">
            {isWardrobe ? 'Wardrobe Shopping List' : 'Career Checklist'}
            {isLocked && isWardrobe && <span className="etl-locked">LOCKED</span>}
          </h3>
          <p className="etl-sub">
            {isWardrobe ? (
              <>
                {includedTasks.length} task{includedTasks.length !== 1 ? 's' : ''} selected
                {excludedCount > 0 && <span> ({excludedCount} excluded)</span>}
                {completion.all_required_done && <span className="etl-ready">Ready to go!</span>}
              </>
            ) : (
              <>{careerList?.tasks?.length || 0} tasks on the episode's list</>
            )}
          </p>
        </div>
        <div className="etl-actions">
          {currentAsset && (
            <button type="button" className="etl-btn" onClick={() => setShowAsset(true)}>Preview Overlay</button>
          )}
          {isWardrobe && !isLocked ? (
            <>
              <button type="button" className="etl-btn-primary" onClick={handleLock} disabled={locking || includedTasks.length === 0}>
                {locking ? 'Locking...' : 'Lock'}
              </button>
              <button type="button" className="etl-btn" onClick={handleGenerate} disabled={generating}>
                {generating ? '...' : 'Regenerate'}
              </button>
            </>
          ) : isWardrobe ? (
            <button type="button" className="etl-btn" onClick={handleUnlock}>Unlock</button>
          ) : (
            <button type="button" className="etl-btn" onClick={handleGenerateCareer} disabled={generatingCareer}>
              {generatingCareer ? '...' : 'Regenerate'}
            </button>
          )}
        </div>
      </div>
      )}

      {/* Progress bar */}
      {isWardrobe && (
      <div className={`etl-progress${completion.all_required_done ? ' is-done' : ''}`} aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      )}

      {/* Tasks */}
      {(isWardrobe || careerList) && (
      <ul className="etl-tasks">
        {currentTasks.map((task) => {
          const excluded = task.included === false;
          const required = isWardrobe ? task.required : isSocialTaskRequired(task);
          return (
            <li key={task.slot} className={`etl-task${excluded ? ' is-excluded' : task.completed ? ' is-done' : ''}`}>
              {/* Include/exclude toggle */}
              {!isLocked && isWardrobe && (
                <button
                  type="button"
                  className={`etl-toggle${excluded ? ' is-off' : ''}`}
                  onClick={() => toggleIncluded(task.slot)}
                  title={excluded ? 'Include in checklist' : 'Exclude from checklist'}
                  aria-label={excluded ? 'Include in checklist' : 'Exclude from checklist'}
                  aria-pressed={!excluded}
                >
                  {!excluded && '✓'}
                </button>
              )}

              {/* Completion checkbox (locked wardrobe or career list) */}
              {((isLocked && isWardrobe) || !isWardrobe) && !excluded && (
                <span className={`etl-check${task.completed ? ' is-done' : required ? ' is-required' : ''}`} aria-label={task.completed ? 'Done' : 'Not done'}>
                  {task.completed && '✓'}
                </span>
              )}

              <div className="etl-task-text">
                <div className="etl-task-label">{task.label}</div>
                {task.description && <div className="etl-task-desc">{task.description}</div>}
              </div>

              <div className="etl-task-side">
                {/* Career tasks show their source (T1, §8(bb); Task #2292) */}
                {!isWardrobe && !excluded && <SocialTaskBadge task={task} />}
                {isWardrobe && !task.required && !excluded && <span className="etl-tag is-optional">optional</span>}
                {excluded && <span className="etl-tag">excluded</span>}
              </div>
            </li>
          );
        })}
      </ul>
      )}

      {error && <p className="etl-error" role="alert">{error}</p>}
    </div>
  );
}
