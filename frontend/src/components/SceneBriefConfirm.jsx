/**
 * The Scene Brief, shown before a paid scene generation (ruling S2, Evoni
 * 2026-09-30; EVENT_EPISODE_FLOW.md §8(dd)): "The Scene Brief is shown
 * before any paid generation, each line labelled "From venue", "From event",
 * or "Your override", with missing essentials flagged."
 *
 * The brief comes from POST /api/v1/scene-sets/:id/brief, the same brief the
 * generation sends (sceneBriefService). Each line can be edited (it becomes
 * "Your override"), removed when it is not essential, or reset to its
 * source. Missing essentials are listed at the top and on their lines; they
 * do not block generating. Confirm hands the overrides to the generation.
 *
 * The event (ruling S3, Evoni 2026-09-30: "Generating for an event requires
 * choosing that event explicitly; never the first match."): a base brief has
 * an Event choice listing the show's events, with "No event". It opens on
 * the event passed in (eventId), else the event the base was last made for,
 * else none; it never picks an event by itself. An angle's event is its
 * base's, shown and not chosen here. Confirm hands the choice over too.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import apiClient from '../services/api';
import './SceneBriefConfirm.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const sceneBriefApi = (setId, body) =>
  apiClient.post(`${API_BASE}/scene-sets/${setId}/brief`, body);
export const showEventsApi = (showId) => apiClient.get(`${API_BASE}/world/${showId}/events`);

const NO_EVENT = '';
/** The event choices: by date (undated last), then name. */
export function eventOptions(events) {
  return [...(events || [])]
    .filter((e) => e && e.id)
    .sort((a, b) => {
      const da = a.event_date || '';
      const db = b.event_date || '';
      if (da !== db) return !da ? 1 : !db ? -1 : da.localeCompare(db);
      return String(a.name || '').localeCompare(String(b.name || ''));
    })
    .map((e) => ({ id: e.id, label: e.event_date ? `${e.name} · ${String(e.event_date).slice(0, 10)}` : (e.name || 'Untitled event') }));
}

export const SOURCE_LABELS = Object.freeze({ venue: 'From venue', event: 'From event', override: 'Your override' });
const LAYER_TITLES = Object.freeze({ place: 'The place', event: 'The event', shot: 'The shot', environment: 'Environment' });
const LAYERS = ['place', 'event', 'shot', 'environment'];

/** "est. $0.04", "price not set", or null when there is no estimate. */
export function estimateText(estimate) {
  if (!estimate) return null;
  if (typeof estimate.usd !== 'number') return 'price not set';
  return `est. $${estimate.usd.toFixed(2)}`;
}

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong';

/**
 * @param {string} setId
 * @param {string} [angleId]       — an angle's brief; the base's without it
 * @param {string} title           — "Generate base image"
 * @param {string} [note]          — e.g. "Each angle uses this brief with its own camera."
 * @param {string} [description]   — an edited, unsaved description to show
 * @param {boolean} [refine]       — the artifact-review regenerate's brief
 * @param {string} [showId]        — the set's show, whose events are offered (S3)
 * @param {string|null} [eventId]  — the event to open the base brief on (S3);
 *                                   not given: the base's own
 * @param {Function} [requestBrief] — (body) => request, for a brief that is not
 *                                   a scene set's: venue generation's (S5), made
 *                                   for its event, so no event choice is offered
 * @param {Function} onConfirm     — (overrides, { eventId }) => void; eventId
 *                                   only for a base brief (null: no event)
 * @param {Function} onCancel
 */
export default function SceneBriefConfirm({ setId, angleId = null, title, note = null, description, refine = false, showId = null, eventId, requestBrief = null, onConfirm, onCancel }) {
  const [data, setData] = useState(null);
  const [overrides, setOverrides] = useState(null); // null until the first brief says what is saved
  const [editing, setEditing] = useState(null); // { key, text }
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState(null);
  const fixedEvent = Boolean(requestBrief);
  const isBase = !angleId && !fixedEvent;
  // The latest requestBrief, so a caller's inline function does not re-ask.
  const requestRef = useRef(requestBrief);
  requestRef.current = requestBrief;

  // chosen: the event to ask the brief for (S3); undefined asks for the base's own.
  const load = useCallback(async (next, chosen) => {
    setLoading(true);
    try {
      const body = {};
      if (angleId) body.angle_id = angleId;
      if (refine) body.refine = true;
      if (isBase && chosen !== undefined) body.event_id = chosen || null;
      if (next) body.overrides = next;
      if (typeof description === 'string') body.canonical_description = description;
      const res = requestRef.current ? await requestRef.current(body) : await sceneBriefApi(setId, body);
      const d = res.data?.data || null;
      setData(d);
      if (!next) setOverrides(d?.brief?.overrides || {});
      setError(null);
    } catch (err) {
      console.error('[SceneBriefConfirm] brief load failed:', err);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [setId, angleId, description, refine, isBase]);

  useEffect(() => { load(null, eventId); }, [load, eventId]);

  useEffect(() => {
    if (!isBase || !showId) return undefined;
    let live = true;
    showEventsApi(showId)
      .then((res) => { if (live) setEvents(res.data?.events || []); })
      .catch((err) => {
        console.error('[SceneBriefConfirm] events load failed:', err);
        if (live) setEvents([]);
      });
    return () => { live = false; };
  }, [isBase, showId]);

  const chosenEvent = data?.brief?.event_id || null;
  const change = (next) => {
    setOverrides(next);
    load(next, isBase ? chosenEvent : undefined);
  };
  const chooseEvent = (value) => load(overrides, value === NO_EVENT ? null : value);
  const saveEdit = () => {
    if (!editing) return;
    change({ ...(overrides || {}), [editing.key]: editing.text });
    setEditing(null);
  };
  const removeLine = (key) => change({ ...(overrides || {}), [key]: '' });
  const resetLine = (key) => {
    const next = { ...(overrides || {}) };
    delete next[key];
    change(next);
  };

  const brief = data?.brief;
  const missing = brief?.missing || [];
  const cost = estimateText(data?.estimate);
  // Removed lines are gone from the brief; they are listed so they can be restored.
  const removed = Object.entries(overrides || {})
    .filter(([key, text]) => !text && !(brief?.lines || []).some((l) => l.key === key));

  return createPortal(
    <div className="sbc-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="sbc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sbc-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="scene-brief-confirm"
      >
        <header className="sbc-head">
          <div>
            <h2 id="sbc-title" className="sbc-title">{title}</h2>
            <p className="sbc-sub">The Scene Brief this generation sends.</p>
          </div>
          <button type="button" className="sbc-icon" onClick={onCancel} aria-label="Close"><X size={16} /></button>
        </header>

        {error && <p className="sbc-error" role="alert">{error}</p>}
        {!brief && loading && <p className="sbc-loading">Loading the brief…</p>}

        {brief && (
          <div className="sbc-body">
            {missing.length > 0 && (
              <div className="sbc-missing" role="alert" data-testid="sbc-missing">
                <AlertTriangle size={14} aria-hidden="true" />
                <span>Missing essentials: {missing.map((m) => m.label).join(', ')}. You can still generate.</span>
              </div>
            )}
            {note && <p className="sbc-note">{note}</p>}

            {LAYERS.map((layer) => {
              const lines = brief.lines.filter((l) => l.layer === layer);
              const eventChoice = layer === 'event' && (isBase ? (
                <label className="sbc-event-choice">
                  <span>Event</span>
                  <select
                    value={chosenEvent || NO_EVENT}
                    onChange={(e) => chooseEvent(e.target.value)}
                    disabled={loading || Boolean(editing)}
                    aria-label="Event"
                    data-testid="sbc-event"
                  >
                    <option value={NO_EVENT}>No event</option>
                    {/* The chosen event stays listed even before the show's events load. */}
                    {chosenEvent && !(events || []).some((e) => e.id === chosenEvent) && (
                      <option value={chosenEvent}>{lines.find((l) => l.key === 'concept')?.text || 'The chosen event'}</option>
                    )}
                    {eventOptions(events).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
              ) : fixedEvent ? (
                <p className="sbc-note" data-testid="sbc-event-fixed">Made for this event.</p>
              ) : (
                <p className="sbc-note" data-testid="sbc-event-from-base">The angles take the event their base was made for.</p>
              ));
              if (layer === 'event' && lines.length === 0) {
                return (
                  <section key={layer} className="sbc-layer">
                    <h3 className="sbc-layer-title">{LAYER_TITLES[layer]}</h3>
                    {eventChoice}
                    <p className="sbc-note" data-testid="sbc-no-event">No event chosen: the brief has no event layer.</p>
                  </section>
                );
              }
              if (lines.length === 0) return null;
              return (
                <section key={layer} className="sbc-layer">
                  <h3 className="sbc-layer-title">{LAYER_TITLES[layer]}</h3>
                  {eventChoice}
                  <ul className="sbc-lines">
                    {lines.map((line) => {
                      const isMissing = line.essential && !line.text;
                      const isEditing = editing?.key === line.key;
                      return (
                        <li
                          key={line.key}
                          className={`sbc-line${isMissing ? ' sbc-line-missing' : ''}`}
                          data-testid={`sbc-line-${line.key}`}
                        >
                          <div className="sbc-line-head">
                            <span className="sbc-line-label">{line.label}</span>
                            <span className={`sbc-source sbc-source-${line.source}`} data-testid={`sbc-source-${line.key}`}>
                              {SOURCE_LABELS[line.source] || line.source}
                            </span>
                            {isMissing && <span className="sbc-flag">Missing</span>}
                            <span className="sbc-actions">
                              {!isEditing && (
                                <button type="button" className="sbc-icon" onClick={() => setEditing({ key: line.key, text: line.text })} aria-label={`Edit ${line.label}`}>
                                  <Pencil size={13} />
                                </button>
                              )}
                              {line.source === 'override' && (
                                <button type="button" className="sbc-icon" onClick={() => resetLine(line.key)} aria-label={`Reset ${line.label}`}>
                                  <RotateCcw size={13} />
                                </button>
                              )}
                              {!line.essential && line.source !== 'override' && (
                                <button type="button" className="sbc-icon" onClick={() => removeLine(line.key)} aria-label={`Remove ${line.label}`}>
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </span>
                          </div>
                          {isEditing ? (
                            <div className="sbc-edit">
                              <textarea
                                value={editing.text}
                                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                                rows={3}
                                maxLength={1000}
                                aria-label={`${line.label} text`}
                              />
                              <div className="sbc-edit-actions">
                                <button type="button" className="sbc-btn" onClick={() => setEditing(null)}>Cancel</button>
                                <button type="button" className="sbc-btn sbc-btn-primary" onClick={saveEdit}>Use this</button>
                              </div>
                            </div>
                          ) : (
                            <p className="sbc-text">{line.text || '—'}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            {removed.length > 0 && (
              <section className="sbc-layer">
                <h3 className="sbc-layer-title">Removed</h3>
                <ul className="sbc-lines">
                  {removed.map(([key]) => (
                    <li key={key} className="sbc-line sbc-line-removed" data-testid={`sbc-removed-${key}`}>
                      <div className="sbc-line-head">
                        <span className="sbc-line-label">{key.replace(/_/g, ' ')}</span>
                        <span className="sbc-source sbc-source-override">Your override</span>
                        <span className="sbc-actions">
                          <button type="button" className="sbc-icon" onClick={() => resetLine(key)} aria-label={`Restore ${key}`}>
                            <RotateCcw size={13} />
                          </button>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="sbc-layer">
              <h3 className="sbc-layer-title">Always</h3>
              <ul className="sbc-rules">
                {(brief.rules || []).map((r) => <li key={r}>{r}</li>)}
              </ul>
            </section>
          </div>
        )}

        <footer className="sbc-foot">
          <button type="button" className="sbc-btn" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="sbc-btn sbc-btn-primary"
            disabled={!brief || loading || Boolean(editing)}
            onClick={() => onConfirm(overrides || {}, isBase ? { eventId: chosenEvent } : {})}
            data-testid="sbc-confirm"
          >
            {cost ? `Generate — ${cost}` : 'Generate'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
