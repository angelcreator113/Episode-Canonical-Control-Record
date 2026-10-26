/**
 * What changed: the Episode Story Record (Evoni, 2026-10-17, stage C) as the
 * card Evoni reviews (Evoni, 2026-10-23: approved plan "from a finished
 * script to the story to the next episode", PR 2). The app reads the
 * finished script and proposes what changed: the episode's goals, the
 * relationships that moved, what Lala owes people (follow-ups), the plot
 * threads, the secrets and the season twists it plants or pays off. She
 * ticks, edits or drops each row; Save writes the ticked ones, once
 * (services/episodeStoryRecord approveRecord), and says what it wrote and
 * what it could not (a person not in the registry). Each row quotes the
 * line in the script that shows it. What an earlier Save wrote folds away
 * under "Already saved", so reading it again shows only what is new.
 *
 * Results → Story, step 1 of the story path (EpisodeBookSteps), and the
 * Script tab's "Read the finished script" (EpisodeScriptTab), which passes
 * readOnOpen: the card reads the script on opening when there is no record
 * yet. `embedded` leaves the title to the step; onStatus hears the
 * record's status (null, 'draft' or 'approved'); onSaving hears a Save start
 * (the step keeps itself open to show what Save wrote). When the Save wrote
 * a relationship change, the Pulse drafts posts about it for Review
 * (services/storyRipples); the result says how many are coming, with a
 * link to Review, where she approves them.
 *
 * Threads open by themselves (Evoni, 2026-10-26: "Let's let them open
 * themselves on new threads and build the threads list"): when the script
 * is read, its new threads that fit the story open right away and its
 * advances become notes on their threads (services/threadInbox). The card
 * shows them as already done, each with Undo (or, for one the check left
 * out, the reason and "Keep it after all"); closes stay rows to tick.
 * "See all the show's threads" opens the threads list (Show/SeasonThreads).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { ScrollText, Sparkles, Check, X, Pencil, Heart, Target, Users, MessageCircle, GitBranch, KeyRound, Shuffle, AlertTriangle, Plus, Megaphone, Undo2 } from 'lucide-react';
import api from '../../services/api';
import SeasonThreads from '../Show/SeasonThreads';
import './EpisodeStoryRecord.css';
import './EpisodeWhatChanged.css';

const STAGES = ['strangers', 'acquaintances', 'flirting', 'friends', 'close_friends', 'lovers', 'partners', 'exes', 'enemies'];
const LISTS = ['characters', 'secrets', 'threads', 'relationships', 'follow_ups', 'goals', 'twists'];
const words = (s) => String(s || '').replace(/_/g, ' ');
const Words = (s) => { const w = words(s); return w.charAt(0).toUpperCase() + w.slice(1); };
const errorOf = (err, fallback) => err?.response?.data?.error || fallback;
const copy = (list) => (list || []).map((x) => ({ ...x }));
const formOf = (record) => ({ what_happened: record?.what_happened || '', ...Object.fromEntries(LISTS.map((k) => [k, copy(record?.[k])])) });
const keep = (x) => x.keep !== false;
// A goal is ticked on Save only when the script covers it.
const ticked = (kind, x) => keep(x) && (kind !== 'goals' || !!x.covered);
const body = (form) => ({
  what_happened: form.what_happened,
  characters: form.characters.map(({ character_id, knew, learned, changed }) => ({ character_id, knew, learned, changed })),
  secrets: form.secrets.map(({ secret_id, what, how, keep: k }) => ({ secret_id, what, how, keep: k !== false })),
  threads: form.threads.map(({ key, thread_id, title, note, quote, action, keep: k }) => ({ key, thread_id, title, note, quote, action, keep: k !== false })),
  relationships: form.relationships.map(({ key, a, b, type, is_romantic, stage_before, stage_after, tension_before, tension_after, evidence_beat, note, quote, keep: k }) => ({
    key, a, b, type, is_romantic: !!is_romantic, stage_before, stage_after, tension_before, tension_after, evidence_beat, note, quote, keep: k !== false,
  })),
  follow_ups: form.follow_ups.map(({ key, person, text, due_hint, quote, keep: k }) => ({ key, person, text, due_hint, quote, keep: k !== false })),
  goals: form.goals.map(({ key, slot, covered, beat, note, quote, keep: k }) => ({ key, slot, covered: !!covered, beat, note, quote, keep: k !== false })),
  twists: form.twists.map(({ twist_id, what, beat, note, quote, keep: k }) => ({ twist_id, what, beat, note, quote, keep: k !== false })),
});
const beatOf = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 14 ? n : null;
};
const THREAD_ACTION = { new: 'New', advance: 'Moves on', close: 'Closes' };
/** Whether an earlier Save already wrote this item (record.applied). */
function wasSaved(kind, x, applied) {
  const done = applied?.[kind] || {};
  if (kind === 'goals') return !!done[x.slot];
  if (kind === 'secrets') return done[x.secret_id] === x.what || done[x.secret_id] === 'revealed';
  if (kind === 'twists') return done[x.twist_id] === x.what || done[x.twist_id] === 'paid_off';
  return !!done[x.key];
}
/** The script's own words for an item. */
const Quote = ({ text }) => (text ? <blockquote className="wc-quote">“{text}”</blockquote> : null);

const PULSE_REVIEW = '/admin?tab=pulse&sub=review';

function AppLink({ to, children }) {
  // Outside a router (a test, a preview), a plain link.
  return useInRouterContext()
    ? <Link className="wc-link" to={to}>{children}</Link>
    : <a className="wc-link" href={to}>{children}</a>;
}

/** One proposed item: keep it, edit it in place, or drop it. */
function Row({ id, label, kept, onKeep, editing, onEdit, onDrop, written, children, fields }) {
  return (
    <li className={`wc-row${kept ? '' : ' is-off'}${editing ? ' is-editing' : ''}`} data-testid={id}>
      <div className="wc-row-main">
        <label className="wc-keep">
          <input type="checkbox" checked={kept} onChange={(e) => onKeep(e.target.checked)} aria-label={`Keep: ${label}`} />
        </label>
        <div className="wc-row-body">{children}</div>
        <div className="wc-row-tools">
          {written && <span className="wc-chip is-written" title="Already saved">Saved</span>}
          <button type="button" className="wc-tool" aria-label={`${editing ? 'Done editing' : 'Edit'}: ${label}`} aria-pressed={editing} onClick={onEdit}>
            {editing ? <Check size={15} aria-hidden="true" /> : <Pencil size={15} aria-hidden="true" />}
          </button>
          <button type="button" className="wc-tool" aria-label={`Drop: ${label}`} onClick={onDrop}><X size={15} aria-hidden="true" /></button>
        </div>
      </div>
      {editing && <div className="wc-edit">{fields}</div>}
    </li>
  );
}

/** A kind of item: what is new, then what an earlier Save wrote, folded away. */
function Section({ icon: Icon, title, count, empty, children, saved = [], testid, after = null }) {
  return (
    <section className="wc-section" aria-label={title} data-testid={testid}>
      <h4 className="wc-section-title"><Icon size={15} aria-hidden="true" /> {title}{count > 0 && <span className="wc-count">{count}</span>}</h4>
      {count === 0 && <p className="esr-note">{saved.length ? 'Nothing new since your last Save.' : empty}</p>}
      {count > 0 && <ul className="wc-rows">{children}</ul>}
      {saved.length > 0 && (
        <details className="wc-saved" data-testid={`${testid}-saved`}>
          <summary>Already saved ({saved.length})</summary>
          <ul className="wc-rows">{saved}</ul>
        </details>
      )}
      {after && <ul className="wc-rows">{after}</ul>}
    </section>
  );
}

const Field = ({ label, children, wide = false }) => (
  <label className={`esr-field is-inline${wide ? ' wc-wide' : ''}`}>
    <span className="esr-sublabel">{label}</span>
    {children}
  </label>
);

export default function EpisodeStoryRecord({ episodeId, embedded = false, onStatus, onSaving, readOnOpen = false }) {
  const base = `/api/v1/book-from-show/episodes/${episodeId}/record`;
  const [data, setData] = useState(null);
  const [form, setForm] = useState(formOf(null));
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [result, setResult] = useState(null);
  const [editing, setEditing] = useState(null);
  const [allThreads, setAllThreads] = useState(false);
  const heard = useRef(onStatus);
  heard.current = onStatus;
  useEffect(() => { if (data) heard.current?.(data.record?.status || null); }, [data]);

  const take = useCallback((d) => {
    const next = {
      record: d?.record || null, cast: d?.cast || [], threads: d?.threads || [], goals: d?.goals || [], twists: d?.twists || [],
      show_id: d?.show_id || null, thread_states: d?.thread_states || {},
    };
    setData(next);
    setForm(formOf(next.record));
    setEditing(null);
  }, []);

  const run = useCallback(async (key, fn, failed, done) => {
    setBusy(key); setNote(null);
    try {
      const res = await fn();
      take(res.data);
      if (done) setNote({ text: done });
      return res.data;
    } catch (err) {
      console.error('[EpisodeStoryRecord] request failed:', err);
      setNote({ error: true, text: errorOf(err, failed) });
      return null;
    } finally { setBusy(null); }
  }, [take]);
  const read = useCallback(() => {
    setResult(null);
    return run('draft', () => api.post(`${base}/draft`, {}, { timeout: 180000 }), 'The script could not be read. Try again.', 'Read the whole script. Look each row over, then Save.')
      .then((d) => {
        // Read again after a Save: say how much is new.
        const rec = d?.record;
        if (!rec?.applied || !Object.keys(rec.applied).length) return d;
        // What opened by itself at this read is not "already saved".
        const auto = rec.applied.threads || {};
        const all = LISTS.filter((k) => k !== 'characters').flatMap((k) => (rec[k] || []).filter((x) => k !== 'threads' || !auto[x.key]?.auto).map((x) => wasSaved(k, x, rec.applied)));
        const old = all.filter(Boolean).length;
        setNote({ text: `Read it again: ${all.length - old} new, ${old} already saved (folded away below).` });
        return d;
      });
  }, [run, base]);

  const opened = useRef(false);
  useEffect(() => {
    let live = true;
    api.get(base).then((res) => {
      if (!live) return;
      take(res.data);
      // From the Script tab: read it now when there is nothing to show yet.
      if (readOnOpen && !res.data?.record && !opened.current) { opened.current = true; read(); }
    }).catch((err) => {
      console.error('[EpisodeStoryRecord] load failed:', err);
      if (live) { take(null); setNote({ error: true, text: errorOf(err, 'What changed could not be loaded.') }); }
    });
    return () => { live = false; };
  }, [base, take, readOnOpen, read]);

  // The thread states only (Undo, Keep it after all): the form keeps her edits.
  const threadAct = useCallback(async (key, fn, failed) => {
    setBusy(`thread-${key}`); setNote(null);
    try {
      await fn();
      const res = await api.get(base);
      setData((d) => ({ ...d, thread_states: res.data?.thread_states || {} }));
    } catch (err) {
      console.error('[EpisodeStoryRecord] thread action failed:', err);
      setNote({ error: true, text: errorOf(err, failed) });
    } finally { setBusy(null); }
  }, [base]);

  const dirty = useMemo(() => data && JSON.stringify(body(form)) !== JSON.stringify(body(formOf(data.record))), [data, form]);
  const redraft = () => {
    if (data?.record && !window.confirm('Read the script again? Its proposals replace the ones here. What you already saved stays saved.')) return undefined;
    return read();
  };
  // Save: your edits, then it counts and each ticked item is written.
  const save = async () => {
    setResult(null);
    if (dirty) {
      const ok = await run('save', () => api.put(base, body(form)), 'Your changes were not saved.');
      if (!ok) return;
    }
    onSaving?.();
    const out = await run('save', () => api.post(`${base}/approve`), 'It was not saved.');
    if (out) setResult(out.result || { written: [], skipped: [] });
  };

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setAt = (key, i, patch) => setForm((f) => ({ ...f, [key]: f[key].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const dropAt = (key, i) => { setEditing(null); setForm((f) => ({ ...f, [key]: f[key].filter((_, j) => j !== i) })); };
  const toggle = (id) => setEditing((e) => (e === id ? null : id));

  if (!data) return <section className="esr wc" aria-busy="true"><p className="esr-note">Loading what changed…</p></section>;
  const { record, cast } = data;
  const people = new Map(cast.map((c) => [c.id, c]));
  const nameOf = (id) => people.get(id)?.name || '?';
  const unlinked = (id) => people.has(id) && !people.get(id).linked;
  const applied = record?.applied || {};
  const listed = new Set(form.secrets.map((s) => s.secret_id));
  const spare = cast.flatMap((c) => (c.secrets || []).filter((s) => !listed.has(s.id)).map((s) => ({ ...s, character_id: c.id, name: c.name })));
  const locked = !!busy;
  const saved = (kind, x) => wasSaved(kind, x, applied);
  // Goals carried from an earlier episode's follow-ups (services/storyCarryForward).
  const carriedSlots = new Set((data.goals || []).filter((g) => g.follow_up_id).map((g) => g.slot));
  const kept = LISTS.filter((k) => k !== 'characters').reduce((n, k) => n + form[k].filter((x) => ticked(k, x) && !saved(k, x)).length, 0);
  // Ticking a goal the script did not cover says it is covered after all.
  const onKeep = (kind, i, v) => setAt(kind, i, kind === 'goals' && v ? { keep: true, covered: true } : { keep: v });
  const row = (kind, i, item, label, children, fields) => {
    const id = `wc-${kind.replace('_', '-')}-${i}`;
    return (
      <Row key={item.key || item.secret_id || item.twist_id || i} id={id} label={label} kept={ticked(kind, item)} onKeep={(v) => onKeep(kind, i, v)}
        editing={editing === id} onEdit={() => toggle(id)} onDrop={() => dropAt(kind, i)} written={saved(kind, item)} fields={fields}>
        {children}
      </Row>
    );
  };
  // Each kind's rows: [new, already saved].
  const rows = (kind, render) => {
    const all = form[kind].map((x, i) => ({ x, i, node: render(x, i) }));
    return [all.filter((r) => !saved(kind, r.x)).map((r) => r.node), all.filter((r) => saved(kind, r.x)).map((r) => r.node)];
  };
  const [goalRows, goalSaved] = rows('goals', (g, i) => row('goals', i, g, g.label, (
    <>
      <p className="wc-line">{g.label}</p>
      <p className="wc-meta">
        <span className={`wc-chip${g.covered ? ' is-good' : ''}`}>{g.covered ? `Covered${g.beat ? ` in beat ${g.beat}` : ''}` : 'Not covered'}</span>
        {carriedSlots.has(g.slot) && <span className="wc-chip" title="A follow-up from an earlier episode: Save marks it done">Carried over</span>}
        {g.note && <span className="wc-sub">{g.note}</span>}
      </p>
      <Quote text={g.quote} />
    </>
  ), (
    <>
      <Field label="Covered">
        <select value={g.covered ? 'yes' : 'no'} onChange={(e) => setAt('goals', i, { covered: e.target.value === 'yes', keep: e.target.value === 'yes' })}>
          <option value="yes">Covered: tick it</option>
          <option value="no">Not covered</option>
        </select>
      </Field>
      <Field label="Beat"><input type="number" min={1} max={14} value={g.beat ?? ''} onChange={(e) => setAt('goals', i, { beat: beatOf(e.target.value) })} /></Field>
      <Field label="How" wide><input type="text" value={g.note || ''} onChange={(e) => setAt('goals', i, { note: e.target.value })} /></Field>
    </>
  )));
  const [relRows, relSaved] = rows('relationships', (r, i) => {
    const label = `${nameOf(r.a)} and ${nameOf(r.b)}`;
    const missing = [r.a, r.b].filter(unlinked).map(nameOf);
    return row('relationships', i, r, label, (
      <>
        <p className="wc-line">{nameOf(r.a)} <span aria-hidden="true">↔</span><span className="wc-sr"> and </span> {nameOf(r.b)}</p>
        <p className="wc-meta">
          {r.is_romantic ? <span className="wc-chip is-romance"><Heart size={12} aria-hidden="true" /> Love interest</span> : r.type && <span className="wc-chip">{Words(r.type)}</span>}
          {(r.stage_before || r.stage_after) && <span className="wc-chip">{Words(r.stage_before) || '?'} → {words(r.stage_after) || '?'}</span>}
          {r.evidence_beat && <span className="wc-chip">Beat {r.evidence_beat}</span>}
        </p>
        {r.note && <p className="wc-sub">{r.note}</p>}
        <Quote text={r.quote} />
        {missing.length > 0 && <p className="wc-warn"><AlertTriangle size={13} aria-hidden="true" /> {missing.join(' and ')} {missing.length > 1 ? 'are' : 'is'} not in the registry yet: Save skips this one.</p>}
      </>
    ), (
      <>
        <Field label="Kind"><input type="text" value={r.type || ''} onChange={(e) => setAt('relationships', i, { type: e.target.value })} /></Field>
        <label className="wc-check"><input type="checkbox" checked={!!r.is_romantic} onChange={(e) => setAt('relationships', i, { is_romantic: e.target.checked })} /> Romantic</label>
        {[['stage_before', 'Before'], ['stage_after', 'After']].map(([k, l]) => (
          <Field key={k} label={l}>
            <select value={r[k] || ''} onChange={(e) => setAt('relationships', i, { [k]: e.target.value || null })}>
              <option value="">Not said</option>
              {STAGES.map((st) => <option key={st} value={st}>{words(st)}</option>)}
            </select>
          </Field>
        ))}
        <Field label="Beat"><input type="number" min={1} max={14} value={r.evidence_beat ?? ''} onChange={(e) => setAt('relationships', i, { evidence_beat: beatOf(e.target.value) })} /></Field>
        <Field label="What changed" wide><input type="text" value={r.note || ''} onChange={(e) => setAt('relationships', i, { note: e.target.value })} /></Field>
      </>
    ));
  });
  const [followRows, followSaved] = rows('follow_ups', (f, i) => row('follow_ups', i, f, f.text, (
    <>
      <p className="wc-line">{f.text}</p>
      <p className="wc-meta">
        {f.person && <span className="wc-chip"><Users size={12} aria-hidden="true" /> {nameOf(f.person)}</span>}
        {f.due_hint && <span className="wc-chip">Due: {f.due_hint}</span>}
      </p>
      <Quote text={f.quote} />
    </>
  ), (
    <>
      <Field label="What to do" wide><input type="text" value={f.text} onChange={(e) => setAt('follow_ups', i, { text: e.target.value })} /></Field>
      <Field label="With">
        <select value={f.person || ''} onChange={(e) => setAt('follow_ups', i, { person: e.target.value || null })}>
          <option value="">No one in particular</option>
          {cast.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="When"><input type="text" value={f.due_hint || ''} onChange={(e) => setAt('follow_ups', i, { due_hint: e.target.value })} /></Field>
    </>
  )));
  // Threads that opened by themselves (or were noted, or left out) at the read: shown as done, with Undo.
  const states = data.thread_states || {};
  const threadsBase = data.show_id ? `/api/v1/world/${data.show_id}/season/threads` : null;
  const AUTO_LABEL = { opened: 'Opened by itself', noted: 'Added as a note', left_out: 'Left out', undone: 'Undone' };
  const autoRows = form.threads.filter((t) => states[t.key]).map((t) => {
    const st = states[t.key];
    return (
      <li key={t.key} className={`wc-row${st.state === 'undone' || st.state === 'left_out' ? ' is-off' : ''}`} data-testid={`wc-thread-auto-${st.state}`}>
        <div className="wc-row-main">
          <div className="wc-row-body">
            <p className="wc-line">{t.title}</p>
            <p className="wc-meta">
              <span className={`wc-chip${st.state === 'opened' || st.state === 'noted' ? ' is-good' : ''}`}>{AUTO_LABEL[st.state]}</span>
              {st.state === 'noted' && st.thread_title !== t.title && <span className="wc-sub">on “{st.thread_title}”</span>}
              {t.note && <span className="wc-sub">{t.note}</span>}
            </p>
            {st.why && st.state === 'opened' && <p className="wc-sub">Why it matters: {st.why}</p>}
            {st.state === 'left_out' && st.reason && <p className="wc-warn"><AlertTriangle size={13} aria-hidden="true" /> {st.reason}</p>}
            <Quote text={t.quote} />
          </div>
          <div className="wc-row-tools">
            {threadsBase && st.can_undo && (
              <button type="button" className="esr-btn-soft" disabled={locked} aria-label={`Undo: ${t.title}`}
                onClick={() => threadAct(t.key, () => api.post(st.state === 'noted' ? `${threadsBase}/${st.thread_id}/notes/${st.note_key}/undo` : `${threadsBase}/${st.thread_id}/undo`), 'It was not undone.')}>
                <Undo2 size={14} aria-hidden="true" /> Undo
              </button>
            )}
            {threadsBase && (st.state === 'left_out' || (st.state === 'undone' && !st.note_key)) && (
              <button type="button" className="esr-btn-soft" disabled={locked} aria-label={`Keep it after all: ${t.title}`}
                onClick={() => threadAct(t.key, () => api.post(`${threadsBase}/${st.thread_id}/restore`), 'It was not kept.')}>
                <Check size={14} aria-hidden="true" /> Keep it after all
              </button>
            )}
          </div>
        </div>
      </li>
    );
  });
  const [threadRows, threadSaved] = rows('threads', (t, i) => (states[t.key] ? null : row('threads', i, t, t.title || 'New thread', (
    <>
      <p className="wc-line">{t.title || <em>Untitled</em>}</p>
      <p className="wc-meta">
        <span className={`wc-chip${t.action === 'close' ? ' is-good' : ''}`}>{THREAD_ACTION[t.action] || 'New'}</span>
        {t.note && <span className="wc-sub">{t.note}</span>}
      </p>
      <Quote text={t.quote} />
    </>
  ), (
    <>
      <Field label="The question" wide><input type="text" value={t.title} onChange={(e) => setAt('threads', i, { title: e.target.value })} /></Field>
      <Field label="Where it stands" wide><input type="text" value={t.note || ''} onChange={(e) => setAt('threads', i, { note: e.target.value })} /></Field>
      {t.thread_id && (
        <Field label="This episode">
          <select value={t.action} onChange={(e) => setAt('threads', i, { action: e.target.value })}>
            <option value="advance">Moves it on</option>
            <option value="close">Closes it</option>
          </select>
        </Field>
      )}
    </>
  ))));
  const threadNew = threadRows.filter(Boolean);
  const threadOld = threadSaved.filter(Boolean);
  const [secretRows, secretSaved] = rows('secrets', (s, i) => row('secrets', i, s, s.text, (
    <>
      <p className="wc-line">{people.has(s.character_id) ? `${nameOf(s.character_id)}: ` : ''}{s.text}</p>
      <p className="wc-meta">
        <span className="wc-chip">{s.what === 'revealed' ? 'Revealed' : 'Hinted at'}</span>
        {s.how && <span className="wc-sub">{s.how}</span>}
      </p>
    </>
  ), (
    <>
      <Field label="The audience">
        <select value={s.what} onChange={(e) => setAt('secrets', i, { what: e.target.value })}>
          <option value="hinted">Hinted at</option>
          <option value="revealed">Revealed</option>
        </select>
      </Field>
      <Field label="How" wide><input type="text" value={s.how || ''} onChange={(e) => setAt('secrets', i, { how: e.target.value })} /></Field>
    </>
  )));
  const [twistRows, twistSaved] = rows('twists', (t, i) => row('twists', i, t, t.title, (
    <>
      <p className="wc-line">{t.title}</p>
      <p className="wc-meta">
        <span className={`wc-chip${t.what === 'paid_off' ? ' is-good' : ''}`}>{t.what === 'paid_off' ? 'Paid off' : 'Planted'}{t.beat ? ` in beat ${t.beat}` : ''}</span>
        {t.note && <span className="wc-sub">{t.note}</span>}
      </p>
      <Quote text={t.quote} />
    </>
  ), (
    <>
      <Field label="Beat"><input type="number" min={1} max={14} value={t.beat ?? ''} onChange={(e) => setAt('twists', i, { beat: beatOf(e.target.value) })} /></Field>
      <Field label="How" wide><input type="text" value={t.note || ''} onChange={(e) => setAt('twists', i, { note: e.target.value })} /></Field>
    </>
  )));
  const due = data.twists || [];
  const missedTwists = due.filter((t) => !form.twists.some((x) => x.twist_id === t.id));

  return (
    <section className={`esr wc${embedded ? ' is-embedded' : ''}`} {...(embedded ? { 'aria-label': 'What changed' } : { 'aria-labelledby': 'wc-title' })} data-testid="episode-story-record">
      {!embedded && (
        <>
          <header className="esr-head">
            <ScrollText size={18} aria-hidden="true" className="esr-icon" />
            <h3 id="wc-title" className="esr-title">What changed</h3>
            {record && <span className={`esr-badge is-${record.status}`}>{record.status === 'approved' ? 'Saved' : 'Draft'}</span>}
          </header>
          <p className="esr-note">
            Read from the finished script: the goals it covers, the relationships that moved, what Lala owes people, the plot threads, the secrets and the season twists.
            Tick what is right, fix or drop the rest, then Save. Nothing is written until you do, except new plot threads: those open by themselves when they fit the story, each with Undo.
          </p>
        </>
      )}
      {note && <p className={`esr-note${note.error ? ' is-error' : ' is-done'}`} role="status">{note.text}</p>}

      {!record ? (
        <div className="esr-actions">
          <button type="button" className="esr-btn" disabled={locked} onClick={read}>
            <Sparkles size={14} aria-hidden="true" /> {busy === 'draft' ? 'Reading the script…' : 'Read the finished script'}
          </button>
        </div>
      ) : (
        <>
          <label className="esr-field">
            <span className="esr-label">What happened</span>
            <textarea rows={3} value={form.what_happened} onChange={(e) => set('what_happened', e.target.value)} />
          </label>

          <Section icon={Target} title="Goals" count={goalRows.length} saved={goalSaved} empty="This episode had no relationship goals." testid="wc-goals">
            {goalRows}
          </Section>

          <Section icon={Heart} title="Relationships" count={relRows.length} saved={relSaved} empty="No relationship moved in this script." testid="wc-relationships">
            {relRows}
          </Section>

          <Section icon={MessageCircle} title="Follow-ups" count={followRows.length} saved={followSaved} empty="Nothing left for a later episode." testid="wc-follow-ups">
            {followRows}
          </Section>

          <Section icon={GitBranch} title="Plot threads" count={threadNew.length + autoRows.length} saved={threadOld} empty="No thread opened or moved." testid="wc-threads"
            after={(
              <li className="wc-add">
                <button type="button" className="esr-btn-soft" onClick={() => {
                  set('threads', [...form.threads, { key: `new-${Date.now()}`, thread_id: null, title: '', note: '', action: 'new', keep: true }]);
                  setEditing(`wc-threads-${form.threads.length}`);
                }}><Plus size={14} aria-hidden="true" /> Add a thread</button>
              </li>
            )}>
            {autoRows}
            {threadNew}
          </Section>
          {data.show_id && (
            <div className="wc-all-threads">
              <button type="button" className="esr-btn-soft" aria-expanded={allThreads} onClick={() => setAllThreads((v) => !v)} data-testid="wc-all-threads">
                <GitBranch size={14} aria-hidden="true" /> {allThreads ? 'Hide the show\'s threads' : 'See all the show\'s threads'}
              </button>
              {allThreads && <SeasonThreads showId={data.show_id} compact />}
            </div>
          )}

          <Section icon={KeyRound} title="Secrets" count={secretRows.length} saved={secretSaved} empty="No secret was hinted at or revealed." testid="wc-secrets"
            after={spare.length > 0 ? (
              <li className="wc-add">
                <Field label="Add a secret">
                  <select value="" onChange={(e) => { const x = spare.find((y) => y.id === e.target.value); if (x) set('secrets', [...form.secrets, { secret_id: x.id, character_id: x.character_id, text: x.text, what: 'hinted', how: '', keep: true }]); }}>
                    <option value="">Choose…</option>
                    {spare.map((x) => <option key={x.id} value={x.id}>{x.name}: {x.text}</option>)}
                  </select>
                </Field>
              </li>
            ) : null}>
            {secretRows}
          </Section>

          {(due.length > 0 || form.twists.length > 0) && (
            <Section icon={Shuffle} title="Season twists" count={twistRows.length} saved={twistSaved} empty="The script does not plant or pay off a twist due here." testid="wc-twists"
              after={missedTwists.length > 0 ? (
                <li className="wc-add">
                  <Field label="The script does it after all">
                    <select value="" onChange={(e) => { const x = missedTwists.find((y) => y.id === e.target.value); if (x) set('twists', [...form.twists, { twist_id: x.id, title: x.title, what: x.what, beat: null, note: '', quote: '', keep: true }]); }}>
                      <option value="">Choose…</option>
                      {missedTwists.map((x) => <option key={x.id} value={x.id}>{x.what === 'paid_off' ? 'Pays off' : 'Plants'}: {x.title}</option>)}
                    </select>
                  </Field>
                </li>
              ) : null}>
              {twistRows}
            </Section>
          )}

          {form.characters.length > 0 && (
            <details className="wc-people">
              <summary className="esr-label">The people ({form.characters.length})</summary>
              {form.characters.map((c, i) => (
                <div key={c.character_id} className="esr-person" data-testid={`esr-person-${c.character_id}`}>
                  <div className="esr-row-head">
                    <strong className="esr-name">{c.name || nameOf(c.character_id)}</strong>
                    <button type="button" className="esr-x" aria-label={`Remove ${c.name}`} onClick={() => dropAt('characters', i)}><X size={14} /></button>
                  </div>
                  {[['knew', 'Knew'], ['learned', 'Learned'], ['changed', 'Changed']].map(([k, label]) => (
                    <Field key={k} label={label}><input type="text" value={c[k] || ''} onChange={(e) => setAt('characters', i, { [k]: e.target.value })} /></Field>
                  ))}
                </div>
              ))}
            </details>
          )}

          <div className="esr-actions wc-actions">
            <button type="button" className="esr-btn" disabled={locked} onClick={save} data-testid="wc-save">
              <Check size={14} aria-hidden="true" /> {busy === 'save' ? 'Saving…' : `Save${kept ? ` ${kept} ticked` : ''}`}
            </button>
            {dirty && <button type="button" className="esr-btn-soft" disabled={locked} onClick={() => setForm(formOf(record))}>Undo changes</button>}
            <button type="button" className="esr-btn-soft" disabled={locked} onClick={redraft}>
              <Sparkles size={14} aria-hidden="true" /> {busy === 'draft' ? 'Reading the script…' : 'Read it again'}
            </button>
          </div>
          {dirty && record.status === 'approved' && <p className="esr-note">Your changes put it back to draft until you Save.</p>}

          {result && (
            <div className="wc-result" role="status" data-testid="wc-result">
              <p className="wc-result-title">{result.written.length ? 'Saved:' : 'Saved. Nothing new to write: it was all saved before.'}</p>
              {result.written.length > 0 && <ul className="wc-result-list">{result.written.map((w, i) => <li key={i}>{w.text}</li>)}</ul>}
              {result.skipped.length > 0 && (
                <ul className="wc-result-list is-skipped">
                  {result.skipped.map((s, i) => (
                    <li key={i}>
                      <AlertTriangle size={13} aria-hidden="true" />
                      <span>
                        {s.reason === 'not_linked'
                          ? <>Link {s.name} to the registry first. <AppLink to="/character-registry">Open the Character Registry</AppLink></>
                          : s.reason === 'no_todo_list' ? 'Goals: this episode has no to-do list yet, so none was ticked.'
                            : 'Threads and follow-ups need the episode to belong to a show.'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {result.pulse_suggestions > 0 && (
                <p className="wc-pulse" data-testid="wc-pulse">
                  <Megaphone size={14} aria-hidden="true" />
                  <span>
                    {result.pulse_suggestions} Pulse suggestion{result.pulse_suggestions === 1 ? '' : 's'} about what changed will be waiting for you in Review. Nothing posts until you approve it.{' '}
                    <AppLink to={PULSE_REVIEW}>Open Review</AppLink>
                  </span>
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
