/**
 * Task list approval and its overlay (Task #2395, ruling P14, Evoni
 * 2026-09-30): "An episode's task list can be approved; approving offers
 * "Design task-list overlay" (cost shown) in the event's visual direction;
 * it becomes an episode overlay placed on the tasks/deadline beat,
 * replacing an earlier one."
 *
 * Rendered under the Career Checklist (EpisodeTodoList), the view of the
 * episode's one task list. All state comes from
 * GET /api/v1/episodes/:id/task-list-overlay (episodeTaskListOverlayService):
 *   - not approved             → "Approve task list"
 *   - approved, no overlay     → "Design task-list overlay — est. $0.04"
 *   - overlay current          → the overlay thumbnail and where it is placed
 *   - list changed since then  → "Task list changed — overlay outdated" and
 *                                "Approve task list & redesign (est. $0.04)"
 * The estimate is the server's, priced from the same options the overlay's
 * background is generated with; an unpriced model reads "price not set".
 */

import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, ListChecks, RefreshCw, TriangleAlert } from 'lucide-react';
import api from '../../services/api';
import { formatEstimate } from './EpisodeTitleCard';
import './EpisodeTaskListOverlay.css';

export const getTaskListOverlayApi = async (episodeId) =>
  (await api.get(`/api/v1/episodes/${episodeId}/task-list-overlay`))?.data?.data;
export const approveTaskListApi = async (episodeId, hash) =>
  (await api.post(`/api/v1/episodes/${episodeId}/task-list/approve`, { hash }))?.data?.data;
export const designTaskListOverlayApi = async (episodeId) =>
  (await api.post(`/api/v1/episodes/${episodeId}/task-list-overlay`))?.data?.data;

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

/**
 * @param {string} episodeId
 * @param {string} [listKey] — changes whenever the shown list changes, so
 *   the state (approved / outdated) is reloaded.
 */
export default function EpisodeTaskListOverlay({ episodeId, listKey = '' }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(null); // 'approve' | 'design' | null
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!episodeId) return;
    getTaskListOverlayApi(episodeId)
      .then((data) => { setState(data && typeof data === 'object' && 'approved' in data ? data : null); setError(null); })
      .catch((err) => {
        console.error('[EpisodeTaskListOverlay] load failed:', err);
        setError(errorText(err));
      });
  }, [episodeId]);

  useEffect(() => { load(); }, [load, listKey]);

  const approve = async () => {
    setBusy('approve');
    setError(null);
    try {
      setState(await approveTaskListApi(episodeId, state?.hash));
    } catch (err) {
      console.error('[EpisodeTaskListOverlay] approve failed:', err);
      setError(errorText(err));
      load();
    } finally {
      setBusy(null);
    }
  };

  const design = async () => {
    setBusy('design');
    setError(null);
    try {
      if (state?.offer?.requires_approval) await approveTaskListApi(episodeId, state?.hash);
      const data = await designTaskListOverlayApi(episodeId);
      setState(data?.state || null);
      if (!data?.state) load();
    } catch (err) {
      console.error('[EpisodeTaskListOverlay] design failed:', err);
      // A budget refusal (429), an unapproved or changed list (409) says why.
      setError(errorText(err));
      load();
    } finally {
      setBusy(null);
    }
  };

  if (!episodeId || !state || !state.task_count) {
    return error ? <div className="etlo-panel"><p className="etlo-error" role="alert">{error}</p></div> : null;
  }

  const { approved, overlay, offer } = state;
  const outdated = Boolean(overlay?.outdated);
  const cost = formatEstimate(offer?.estimate);

  return (
    <div className="etlo-panel" data-testid="episode-task-list-overlay">
      <div className="etlo-row">
        {approved ? (
          <span className="etlo-approved" data-testid="etlo-approved">
            <BadgeCheck size={14} aria-hidden="true" /> Task list approved
          </span>
        ) : !outdated && (
          <button type="button" className="etlo-btn" onClick={approve} disabled={busy !== null}>
            <BadgeCheck size={14} aria-hidden="true" />
            {busy === 'approve' ? 'Approving…' : 'Approve task list'}
          </button>
        )}

        {outdated && (
          <span className="etlo-outdated" data-testid="etlo-outdated">
            <TriangleAlert size={14} aria-hidden="true" /> Task list changed — overlay outdated
          </span>
        )}

        {offer?.offered && (
          <button type="button" className="etlo-btn etlo-btn-primary" onClick={design} disabled={busy !== null}>
            {offer.kind === 'redesign' ? <RefreshCw size={14} aria-hidden="true" /> : <ListChecks size={14} aria-hidden="true" />}
            {busy === 'design'
              ? 'Designing…'
              : offer.kind === 'redesign'
                ? `${offer.requires_approval ? 'Approve task list & redesign' : 'Redesign task-list overlay'} (est. ${cost})`
                : `Design task-list overlay — est. ${cost}`}
          </button>
        )}
      </div>

      {overlay?.image_url && (
        <figure className="etlo-figure">
          <img
            className={`etlo-thumb${outdated ? ' etlo-thumb-outdated' : ''}`}
            src={overlay.image_url}
            alt="Task-list overlay"
            data-testid="etlo-thumb"
          />
          {overlay.beat?.number && (
            <figcaption className="etlo-caption">
              Episode overlay · Beat {overlay.beat.number}{overlay.beat.name ? `: ${overlay.beat.name}` : ''}
            </figcaption>
          )}
        </figure>
      )}

      {error && <p className="etlo-error" role="alert">{error}</p>}
    </div>
  );
}
