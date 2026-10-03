/**
 * Producer Mode → Episodes → Production: the show's episodes as a grid, a
 * list or a board, with New Episode. Moved from the show page's Episodes tab
 * when the two show workspaces became one (Evoni, 2026-10-03).
 * Props: showId, episodes, onChanged (reload after a status change or delete).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import episodeService from '../../services/episodeService';
import EpisodeCard from '../EpisodeCard';
import EpisodeKanbanBoard from '../Episodes/EpisodeKanbanBoard';

const STATUS_ICON = { draft: '✏️', scripted: '📜', in_build: '🎬', in_review: '👀', published: '✅', archived: '📦' };
const TIERS = { slay: { e: '👑', c: '#FFD700' }, pass: { e: '✨', c: '#22c55e' }, safe: { e: '😐', c: '#eab308' }, fail: { e: '💔', c: '#dc2626' } };

function evaluation(ep) {
  if (typeof ep.evaluation_json !== 'string') return ep.evaluation_json || null;
  try {
    return JSON.parse(ep.evaluation_json);
  } catch (err) {
    console.error('[ShowEpisodesBoard] bad evaluation_json:', err);
    return null;
  }
}

// total: the show's true episode count (the list stops at 100), when known.
export default function ShowEpisodesBoard({ showId, episodes = [], total = null, onChanged }) {
  const navigate = useNavigate();
  const [view, setView] = useState('grid');
  const completed = episodes.filter((e) => e.evaluation_status === 'accepted').length;
  // One way to start an episode: the new-episode flow.
  const newEpisode = () => navigate(`/shows/${showId}/new-episode`);
  const open = (id) => navigate(`/episodes/${id}`);

  const changeStatus = async (episodeId, status) => {
    try {
      await episodeService.updateEpisode(episodeId, { status });
      onChanged?.();
    } catch (err) {
      console.error('[ShowEpisodesBoard] status change failed:', err);
    }
  };
  const remove = async (episodeId) => {
    if (!window.confirm('Are you sure you want to delete this episode?')) return;
    try {
      await episodeService.deleteEpisode(episodeId);
      onChanged?.();
    } catch (err) {
      console.error('[ShowEpisodesBoard] delete failed:', err);
    }
  };

  const sorted = [...episodes].sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
  return (
    <div className="show-episodes-board" data-testid="show-episodes-board">
      <div className="seb-head">
        <p className="seb-count" data-testid="seb-count">
          {(total ?? episodes.length)} episode{(total ?? episodes.length) !== 1 ? 's' : ''}
          {total != null && total > episodes.length && ` · showing the first ${episodes.length}`}
          {completed > 0 && ` · ${completed} completed`}
        </p>
        <div className="seb-actions">
          <div className="seb-views" role="group" aria-label="Episode view">
            {['grid', 'list', 'kanban'].map((v) => (
              <button key={v} type="button" aria-pressed={view === v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
                {v === 'grid' ? '⊞ Grid' : v === 'list' ? '≡ List' : '◫ Board'}
              </button>
            ))}
          </div>
          <button type="button" className="seb-new" onClick={newEpisode}>+ New Episode</button>
        </div>
      </div>

      {episodes.length === 0 ? (
        <div className="seb-empty">
          <div className="seb-empty-icon">📺</div>
          <h3>No episodes yet</h3>
          <p>An episode starts from an event: set the event up in Events, then start its episode.</p>
          <button type="button" className="seb-new" onClick={newEpisode}>+ New Episode</button>
        </div>
      ) : view === 'kanban' ? (
        <EpisodeKanbanBoard episodes={episodes} onStatusChange={changeStatus} onEpisodeClick={(ep) => open(ep.id || ep)} />
      ) : view === 'list' ? (
        <div className="seb-table-wrap">
          <table className="seb-table">
            <thead>
              <tr><th>#</th><th>Title</th><th>Status</th><th>Tier</th><th>Score</th></tr>
            </thead>
            <tbody>
              {sorted.map((ep) => {
                const ev = evaluation(ep);
                const tier = ev?.tier_final ? TIERS[ev.tier_final] : null;
                return (
                  <tr key={ep.id} onClick={() => open(ep.id)}>
                    <td>{ep.episode_number || '—'}</td>
                    <td className="seb-title">{ep.title || 'Untitled'}</td>
                    <td>{STATUS_ICON[ep.status] || '⚪'}</td>
                    <td>{tier ? <span style={{ color: tier.c }}>{tier.e}</span> : '—'}</td>
                    <td>{ev?.score || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="seb-grid">
          {sorted.map((ep) => (
            <EpisodeCard key={ep.id} episode={ep} onView={open} onEdit={(id) => navigate(`/episodes/${id}/edit`)} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}
