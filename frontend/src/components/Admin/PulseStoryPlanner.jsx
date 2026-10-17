/**
 * Admin › The Pulse › Story Clock › Day planner (Evoni's Story Clock mock,
 * 2026-10-17; lib/storyPlanner): Lala's day in ten time slots by the clock
 * time posts go out. Left, the slots with their counts; middle, the chosen
 * slot's posts, "Add a post to this time slot" and Later today; right, the
 * editor: caption, who posts, photo, date and time, status (scheduled,
 * held, draft, posted now) and tags. A live post keeps its words and time;
 * only its tags change. Styles: PulseStoryClock.css (sp-*).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Coffee, Dumbbell, Image as ImageIcon, ImagePlus, Loader2, Moon, MoreVertical, Music, Plus, Shirt,
  ShoppingBag, Sparkles, Sunrise, Trash2, Utensils, Wine, X,
} from 'lucide-react';
import {
  SLOTS, STATUS_LABELS, bySlot, clockLabel, firstSlot, formOf, plannerApi, slotOf, slotStart, slotTime, statusOf, whenOf,
} from '../../lib/storyPlanner';
import { posterOf } from '../../lib/pulsePosts';

const SLOT_ICONS = {
  morning: Sunrise, 'on-the-go': Coffee, studio: Shirt, lunch: Utensils, shopping: ShoppingBag,
  wellness: Dumbbell, evening: Wine, nightlife: Music, 'wind-down': Moon, 'late-night': Sparkles,
};
const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong.';
const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

function StatusChip({ post }) {
  const s = statusOf(post);
  return <span className={`sp-status is-${s}`}>{STATUS_LABELS[s]}</span>;
}

function PostRow({ post, compact, active, onEdit }) {
  const who = posterOf(post);
  const when = whenOf(post);
  const slot = when ? slotOf(when) : null;
  return (
    <li className={`sp-post${compact ? ' is-compact' : ''}${active ? ' is-active' : ''}`} data-testid="sp-post">
      {post.image_url
        ? <img className="sp-post-thumb" src={post.image_url} alt={post.image_description || ''} />
        : <span className="sp-post-thumb is-empty" aria-hidden="true"><ImageIcon size={20} /></span>}
      <div className="sp-post-body">
        <p className="sp-post-head">
          <b>{when ? clockLabel(when) : ''}{compact && slot ? ` · ${slot.label}` : ''}</b>
          {!compact && <span className="sp-who">{who.name}</span>}
        </p>
        <p className="sp-post-text">{post.content_text}</p>
        {!compact && Array.isArray(post.tags) && post.tags.length > 0 && (
          <ul className="sp-tags">{post.tags.map((t) => <li key={t}>{t}</li>)}</ul>
        )}
      </div>
      <StatusChip post={post} />
      <button type="button" className="sp-more" aria-label={`Edit ${who.name}'s post`} onClick={() => onEdit(post)}>
        <MoreVertical size={18} aria-hidden="true" />
      </button>
    </li>
  );
}

function TagsField({ tags, onChange }) {
  const [text, setText] = useState('');
  const add = () => {
    const tag = text.replace(/\s+/g, ' ').trim();
    if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...tags, tag]);
    setText('');
  };
  return (
    <div className="sp-tag-box">
      <ul className="sp-tags is-edit">
        {tags.map((t) => (
          <li key={t}>{t}<button type="button" aria-label={`Remove the tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}><X size={12} aria-hidden="true" /></button></li>
        ))}
      </ul>
      <input type="text" value={text} maxLength={40} placeholder="+ Add tag…" aria-label="Add a tag"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        onBlur={add} />
    </div>
  );
}

function Editor({ showId, post, day, slot, characters, onClose, onSaved }) {
  const [form, setForm] = useState(() => formOf(post, day, slot));
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const fileRef = useRef(null);
  const boxRef = useRef(null);
  const live = post?.status === 'live';
  // On a phone the editor sits under the day: bring it into view.
  useEffect(() => { boxRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }, []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  useEffect(() => () => { if (photo?.preview) URL.revokeObjectURL(photo.preview); }, [photo]);

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let preview = null;
    try { preview = URL.createObjectURL(file); } catch (err) { console.error('[StoryPlanner] no preview for the photo:', err); }
    setPhoto({ file, preview, alt: '' });
  };
  const save = async () => {
    setBusy(true); setNote(null);
    try {
      await plannerApi.savePost({ showId, post, form, characters, photo });
      onSaved(form.status === 'draft' && !live ? 'Saved as a draft without a time: it waits in Review, not on the planner.' : null);
    } catch (err) {
      console.error('[StoryPlanner] save failed:', err?.response?.status || err?.message);
      setNote(errorText(err));
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Delete this post? It is kept under Deleted in Review and can be restored.')) return;
    setBusy(true); setNote(null);
    try { await plannerApi.remove(post.id); onSaved(null); } catch (err) {
      console.error('[StoryPlanner] delete failed:', err?.response?.status || err?.message);
      setNote(errorText(err));
    } finally { setBusy(false); }
  };

  const picture = photo?.preview || post?.image_url || null;
  const canSave = live || form.content_text.trim().length > 0;
  return (
    <section ref={boxRef} className="sp-card sp-editor" aria-labelledby="sp-editor-heading" data-testid="sp-editor">
      <div className="sp-editor-head">
        <h3 id="sp-editor-heading">{post ? 'Edit story' : 'New story'}</h3>
        <button type="button" className="sp-icon-btn" aria-label="Close the editor" onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </div>
      {live && <p className="sp-hint">Posted: its words and time are locked. Tags can still change.</p>}
      <label className="sp-field">
        <span>Caption</span>
        <textarea rows={4} value={form.content_text} onChange={set('content_text')} readOnly={live} aria-label="Caption" />
        <span className="sp-count">{form.content_text.length} characters</span>
      </label>
      <label className="sp-field">
        <span>Character</span>
        <select value={form.character} onChange={set('character')} disabled={!!post} aria-label="Character">
          {post && !characters.some((c) => c.value === form.character)
            ? <option value={form.character}>{posterOf(post).name}</option> : null}
          {characters.map((c) => <option key={c.value} value={c.value}>{c.name}</option>)}
        </select>
      </label>
      <div className="sp-field">
        <span>Photo</span>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} data-testid="sp-photo-file" />
        <div className="sp-photo">
          {picture ? <img src={picture} alt="" /> : <span className="sp-photo-empty"><ImageIcon size={20} aria-hidden="true" /> No photo</span>}
          {!live && (
            <button type="button" className="sp-btn" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={16} aria-hidden="true" />{picture ? 'Replace' : 'Add a photo'}
            </button>
          )}
        </div>
      </div>
      <div className="sp-field">
        <span>Date &amp; time</span>
        <div className="sp-row">
          <input type="date" value={form.date} onChange={set('date')} disabled={live} aria-label="Date" />
          <input type="time" value={form.time} onChange={set('time')} disabled={live} aria-label="Time" />
        </div>
      </div>
      <label className="sp-field">
        <span>Status</span>
        <select value={form.status} onChange={set('status')} disabled={live} aria-label="Status">
          {live ? <option value="live">Posted</option> : (
            <>
              <option value="scheduled">Scheduled: goes out at this time</option>
              <option value="held">Held: waits until you release it</option>
              <option value="draft">Draft: no time yet</option>
              <option value="live">Post now</option>
            </>
          )}
        </select>
      </label>
      <div className="sp-field">
        <span>Tags</span>
        <TagsField tags={form.tags} onChange={set('tags')} />
      </div>
      {note && <p className="sp-error" role="alert">{note}</p>}
      <div className="sp-editor-actions">
        <button type="button" className="sp-btn is-primary" disabled={busy || !canSave} onClick={save}>
          {busy && <Loader2 size={16} className="pulse-spin" aria-hidden="true" />}{post ? 'Save changes' : 'Add story'}
        </button>
        {post && <button type="button" className="sp-btn" disabled={busy} onClick={remove}><Trash2 size={16} aria-hidden="true" />Delete story</button>}
      </div>
    </section>
  );
}

export default function PulseStoryPlanner({ showId, day, addKey = 0 }) {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [characters, setCharacters] = useState([{ value: 'lala', handle: 'lala', name: 'Lala', profileId: null }]);
  const [slotKey, setSlotKey] = useState(null);
  const [editing, setEditing] = useState(null); // { post } — post null for a new one

  const load = useCallback(async () => {
    try {
      setPosts(await plannerApi.day(showId, day));
      setError(null);
    } catch (err) {
      console.error('[StoryPlanner] the day could not be read:', err?.response?.status || err?.message);
      setError('The day could not be loaded.');
      setPosts([]);
    }
  }, [showId, day]);
  useEffect(() => { setPosts(null); setSlotKey(null); setEditing(null); load(); }, [load]);
  useEffect(() => {
    let alive = true;
    plannerApi.characters(showId)
      .then((list) => { if (alive) setCharacters(list); })
      .catch((err) => console.error('[StoryPlanner] the characters could not be read:', err?.response?.status || err?.message));
    return () => { alive = false; };
  }, [showId]);

  const grouped = useMemo(() => bySlot(posts || []), [posts]);
  const current = SLOTS.find((s) => s.key === (slotKey || (posts ? firstSlot(day, grouped) : null))) || SLOTS[0];
  useEffect(() => { if (addKey > 0) setEditing({ post: null }); }, [addKey]);

  const later = SLOTS.slice(SLOTS.indexOf(current) + 1).flatMap((s) => grouped[s.key]);
  const Icon = SLOT_ICONS[current.key];
  const onSaved = async (message) => { setEditing(null); setNote(message); await load(); };

  return (
    <div className={editing ? 'sp-grid has-editor' : 'sp-grid'} data-testid="sp-planner">
      <nav className="sp-card sp-slots" aria-label="Time slots">
        <h3 className="sp-title">Time slots</h3>
        <p className="sp-hint">{SLOTS.length} slots · your time zone · the day runs 6 AM to 6 AM</p>
        <ul>
          {SLOTS.map((s) => {
            const SIcon = SLOT_ICONS[s.key];
            const n = grouped[s.key].length;
            return (
              <li key={s.key}>
                <button type="button" className={s === current ? 'sp-slot is-active' : 'sp-slot'} aria-current={s === current ? 'true' : undefined}
                  onClick={() => setSlotKey(s.key)} data-testid={`sp-slot-${s.key}`}>
                  <span className="sp-slot-time">{slotTime(s)}</span>
                  <span className="sp-slot-icon" aria-hidden="true"><SIcon size={16} /></span>
                  <span className="sp-slot-text"><b>{s.label}</b><span>{posts ? plural(n, 'post') : '…'}</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="sp-card sp-day" aria-labelledby="sp-slot-heading">
        <div className="sp-day-head">
          <span className="sp-day-icon" aria-hidden="true"><Icon size={22} /></span>
          <div>
            <h3 id="sp-slot-heading">{slotTime(current)} · {current.label}</h3>
            <p className="sp-hint">{current.about}</p>
          </div>
        </div>
        {error && <p className="sp-error" role="alert">{error}</p>}
        {note && <p className="sp-hint" role="status">{note}</p>}
        {!posts && <p className="sp-hint"><Loader2 size={14} className="pulse-spin" aria-hidden="true" /> Loading the day…</p>}
        {posts && (
          <>
            <ul className="sp-posts" data-testid="sp-slot-posts">
              {grouped[current.key].map((p) => <PostRow key={p.id} post={p} active={editing?.post?.id === p.id} onEdit={(post) => setEditing({ post })} />)}
            </ul>
            <button type="button" className="sp-add" onClick={() => setEditing({ post: null })} data-testid="sp-add-to-slot">
              <Plus size={18} aria-hidden="true" /> Add a post to this time slot
            </button>
            <h4 className="sp-later-title">Later today</h4>
            {later.length === 0
              ? <p className="sp-hint">Nothing later today.</p>
              : <ul className="sp-posts" data-testid="sp-later">{later.map((p) => <PostRow key={p.id} post={p} compact active={editing?.post?.id === p.id} onEdit={(post) => setEditing({ post })} />)}</ul>}
          </>
        )}
      </section>

      {editing ? (
        <Editor key={editing.post?.id || `new-${current.key}-${day}`} showId={showId} post={editing.post} day={day}
          slot={editing.post ? slotOf(whenOf(editing.post) || slotStart(day, current)) : current}
          characters={characters} onClose={() => setEditing(null)} onSaved={onSaved} />
      ) : (
        <aside className="sp-card sp-editor is-empty">
          <p className="sp-hint">Pick a post to edit it, or add one to a time slot.</p>
        </aside>
      )}
    </div>
  );
}
