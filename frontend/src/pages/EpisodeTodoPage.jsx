/**
 * EpisodeTodoPage — Standalone todo list for an episode
 *
 * Route: /episodes/:episodeId/todo
 *
 * Shows wardrobe tasks + social media tasks + financial summary
 * with completion toggling and progress tracking.
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../services/api';
import './WorldAdmin.css';

// ─── Track 6 CP7 module-scope helpers (Pattern F prophylactic — Api suffix) ───
// 6 helpers covering 6 fetch sites. Promise.all + .catch fallback semantics
// preserved with .catch(() => ({ data: {} })) on apiClient calls so the
// destructure-on-empty pattern at the call site continues to work.
export const getEpisodeTodoApi = (episodeId) =>
  apiClient.get(`/api/v1/episodes/${episodeId}/todo`);
export const getEpisodeTodoSocialApi = (episodeId) =>
  apiClient.get(`/api/v1/episodes/${episodeId}/todo/social`);
export const getEpisodeApi = (episodeId) =>
  apiClient.get(`/api/v1/episodes/${episodeId}`);
export const listShowEventsApi = (showId) =>
  apiClient.get(`/api/v1/world/${showId}/events`);
export const completeTodoSlotApi = (episodeId, slot, payload) =>
  apiClient.post(`/api/v1/episodes/${episodeId}/todo/complete/${slot}`, payload);
export const completeSocialTodoSlotApi = (episodeId, slot, payload) =>
  apiClient.post(`/api/v1/episodes/${episodeId}/todo/complete-social/${slot}`, payload);

const TIMING_ORDER = { before: 0, during: 1, after: 2 };
const TIMING_LABELS = { before: 'Before Event', during: 'During Event', after: 'After Event' };
const TIMING_COLORS = { before: '#f59e0b', during: '#6366f1', after: '#16a34a' };

export default function EpisodeTodoPage() {
  const { episodeId } = useParams();
  const [todoList, setTodoList] = useState(null);
  const [socialTasks, setSocialTasks] = useState([]);
  const [financials, setFinancials] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!episodeId) return;
    Promise.all([
      getEpisodeTodoApi(episodeId).then(r => r.data).catch(() => ({})),
      getEpisodeTodoSocialApi(episodeId).then(r => r.data).catch(() => ({})),
      getEpisodeApi(episodeId).then(r => r.data).catch(() => ({})),
    ]).then(([todoBody, socialBody, epBody]) => {
      const td = todoBody.data;
      if (td) {
        setTodoList(td);
        if (td.financial_summary) {
          const fs = typeof td.financial_summary === 'string' ? JSON.parse(td.financial_summary) : td.financial_summary;
          setFinancials(fs);
        }
      }
      const st = socialBody.social_tasks || [];
      setSocialTasks(typeof st === 'string' ? JSON.parse(st) : st);
      if (socialBody.financial_summary) {
        const fs = typeof socialBody.financial_summary === 'string' ? JSON.parse(socialBody.financial_summary) : socialBody.financial_summary;
        if (!financials) setFinancials(fs);
      }
      const ep = epBody.episode || epBody.data || epBody;
      if (ep?.id) setEpisode(ep);
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [episodeId]);

  // Load linked event
  useEffect(() => {
    if (!todoList?.event_id) return;
    listShowEventsApi(todoList.show_id)
      .then(res => {
        const ev = (res.data?.events || []).find(e => e.id === todoList.event_id);
        if (ev) setEvent(ev);
      })
      .catch(() => {});
  }, [todoList]);

  const toggleWardrobeTask = async (slot) => {
    try {
      const completed = !todoList.tasks.find(t => t.slot === slot)?.completed;
      const res = await completeTodoSlotApi(episodeId, slot, { completed });
      const d = res.data;
      if (d.success) {
        setTodoList(prev => ({ ...prev, tasks: d.tasks, completion: d.completion }));
      }
    } catch {}
  };

  const toggleSocialTask = async (slot) => {
    try {
      const task = socialTasks.find(t => t.slot === slot);
      const res = await completeSocialTodoSlotApi(episodeId, slot, { completed: !task?.completed });
      const d = res.data;
      if (d.success) setSocialTasks(d.social_tasks);
    } catch {}
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading todo list...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>Error: {error}</div>;
  if (!todoList && socialTasks.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>No todo list for this episode yet.</div>
        <Link to={`/episodes/${episodeId}`} style={{ color: '#B8962E', fontWeight: 600, fontSize: 13 }}>Back to Episode</Link>
      </div>
    );
  }

  const wardrobeTasks = todoList?.tasks || [];
  const wardrobeCompleted = wardrobeTasks.filter(t => t.completed).length;
  const socialCompleted = socialTasks.filter(t => t.completed).length;
  const totalTasks = wardrobeTasks.length + socialTasks.length;
  const totalCompleted = wardrobeCompleted + socialCompleted;
  const progressPct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  // Group social tasks by timing
  const socialByTiming = {};
  socialTasks.forEach(t => {
    const timing = t.timing || 'during';
    if (!socialByTiming[timing]) socialByTiming[timing] = [];
    socialByTiming[timing].push(t);
  });
  const timingKeys = Object.keys(socialByTiming).sort((a, b) => (TIMING_ORDER[a] || 1) - (TIMING_ORDER[b] || 1));

  const automation = event?.canon_consequences?.automation;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Link to={`/episodes/${episodeId}`} style={{ fontSize: 11, color: '#B8962E', textDecoration: 'none', fontWeight: 600 }}>
          ← Back to Episode
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', margin: '8px 0 4px', fontFamily: "'Lora', serif" }}>
          {episode?.title || 'Episode'} — Todo List
        </h1>
        {event && (
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {event.name}{automation?.host_display_name ? ` · Hosted by ${automation.host_display_name}` : ''}
            {automation?.venue_name ? ` · ${automation.venue_name}` : ''}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: 20, padding: '14px 16px', background: '#FAF7F0', borderRadius: 12, border: '1px solid #e8e0d0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: '#B8962E' }}>
            Progress: {totalCompleted} / {totalTasks} tasks
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, color: progressPct === 100 ? '#16a34a' : '#B8962E' }}>{progressPct}%</span>
        </div>
        <div style={{ height: 8, background: '#e8e0d0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: progressPct === 100 ? '#16a34a' : '#B8962E', borderRadius: 4, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Financial Summary */}
      {financials && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 100, padding: '10px 12px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: '#16a34a' }}>Income</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{(financials.total_income || 0).toLocaleString()}</div>
          </div>
          <div style={{ flex: 1, minWidth: 100, padding: '10px 12px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca' }}>
            <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: '#dc2626' }}>Expenses</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626' }}>{(financials.total_expenses || 0).toLocaleString()}</div>
          </div>
          <div style={{ flex: 1, minWidth: 100, padding: '10px 12px', background: (financials.net_profit || 0) >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: 10, border: `1px solid ${(financials.net_profit || 0) >= 0 ? '#bbf7d0' : '#fecaca'}` }}>
            <div style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', color: (financials.net_profit || 0) >= 0 ? '#16a34a' : '#dc2626' }}>Net</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: (financials.net_profit || 0) >= 0 ? '#16a34a' : '#dc2626' }}>
              {(financials.net_profit || 0) >= 0 ? '+' : ''}{(financials.net_profit || 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Wardrobe Tasks */}
      {wardrobeTasks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: '#B8962E', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>Wardrobe ({wardrobeCompleted}/{wardrobeTasks.length})</span>
            {wardrobeCompleted === wardrobeTasks.length && <span style={{ color: '#16a34a' }}>All done</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {wardrobeTasks.map(task => (
              <div
                key={task.slot}
                onClick={() => toggleWardrobeTask(task.slot)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  background: task.completed ? '#f0fdf4' : '#fff',
                  border: `1px solid ${task.completed ? '#bbf7d0' : '#e2e8f0'}`,
                  borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{task.completed ? '✅' : '⬜'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: task.completed ? '#16a34a' : '#1a1a2e', textDecoration: task.completed ? 'line-through' : 'none' }}>
                    {task.label}
                  </div>
                  {task.description && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{task.description}</div>}
                </div>
                {task.required && <span style={{ fontSize: 9, padding: '2px 6px', background: '#fef2f2', color: '#dc2626', borderRadius: 4, fontWeight: 600 }}>required</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social Media Tasks */}
      {socialTasks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: '#B8962E', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>Social Media ({socialCompleted}/{socialTasks.length})</span>
            {socialCompleted === socialTasks.length && <span style={{ color: '#16a34a' }}>All done</span>}
          </div>

          {timingKeys.map(timing => (
            <div key={timing} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: TIMING_COLORS[timing] || '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {TIMING_LABELS[timing] || timing}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {socialByTiming[timing].map(task => (
                  <div
                    key={task.slot}
                    onClick={() => toggleSocialTask(task.slot)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      background: task.completed ? '#f0fdf4' : task.source === 'platform' ? '#f0f7ff' : task.source === 'category' ? '#fafffe' : '#fff',
                      border: `1px solid ${task.completed ? '#bbf7d0' : '#e2e8f0'}`,
                      borderLeft: `3px solid ${task.completed ? '#16a34a' : TIMING_COLORS[timing] || '#e2e8f0'}`,
                      borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{task.completed ? '✅' : '⬜'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: task.completed ? '#16a34a' : '#1a1a2e', textDecoration: task.completed ? 'line-through' : 'none' }}>
                          {task.label}
                        </span>
                        {task.required && <span style={{ fontSize: 8, padding: '1px 5px', background: '#fef2f2', color: '#dc2626', borderRadius: 3, fontWeight: 600 }}>required</span>}
                        {task.source === 'platform' && <span style={{ fontSize: 8, padding: '1px 5px', background: '#dbeafe', color: '#1e40af', borderRadius: 3, fontWeight: 600 }}>{task.platform}</span>}
                        {task.source === 'category' && <span style={{ fontSize: 8, padding: '1px 5px', background: '#d1fae5', color: '#065f46', borderRadius: 3, fontWeight: 600 }}>niche</span>}
                      </div>
                      {task.description && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{task.description}</div>}
                    </div>
                    <span style={{ fontSize: 9, color: '#aaa', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>{task.platform}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guest List */}
      {automation?.guest_profiles?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: '#B8962E', marginBottom: 10 }}>
            Guest List ({automation.guest_profiles.length})
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {automation.guest_profiles.map((g, i) => (
              <span key={i} style={{ padding: '5px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                {g.display_name || g.handle}
                {g.relationship && <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 4 }}>{g.relationship}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
