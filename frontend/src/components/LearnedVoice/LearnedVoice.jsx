/**
 * Character voices that learn (Evoni, 2026-10-25): how a character really
 * sounds, from the lines she approved and the edits she made, and the voice
 * rules learned from them (lib/characterVoice).
 *
 * "How they really sound": the newest approved lines, with where they hold
 * (gameplay, cutscene, narration) and the episode and beat.
 * "Learned voice": bigger rules waiting for Approve (or Dismiss), with the
 * example (AI wrote → she changed it to); small rules applied by themselves,
 * each with Undo; the approved ones; and the ones grown out of over the
 * season, from the episode they came in (a simple voice timeline).
 * Learn now asks for new rules from what she has approved since.
 *
 * One voice per character for the book and the show. Shown on a character's
 * Voice & Pulse tab, and for her (JustAWoman) on the Your voice page.
 */
import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Check, X, Undo2, ChevronDown, Quote } from 'lucide-react';
import { voiceApi, isVoiceNotReady, VOICE_LEARN_NOT_READY, VOICE_CONTEXTS, contextLabel, groupRules, newestLines, learnSummary, SOURCE_LABELS, whereLine } from '../../lib/characterVoice';
import './LearnedVoice.css';

const errorText = (err, fallback) => err?.response?.data?.error || err?.response?.data?.message || fallback;

function ContextChip({ context }) {
  const label = contextLabel(context);
  if (!label) return <span className="lv-chip is-any">Everywhere</span>;
  return <span className={`lv-chip is-${context}`}>{label}</span>;
}

function RuleExample({ rule }) {
  if (!rule.example_original && !rule.example_edited) return null;
  return (
    <div className="lv-example" data-testid="lv-example">
      {rule.example_original && <p className="lv-was"><span className="lv-tag">AI wrote</span>{rule.example_original}</p>}
      {rule.example_edited && <p className="lv-now"><span className="lv-tag">You changed it to</span>{rule.example_edited}</p>}
    </div>
  );
}

function RuleMeta({ rule }) {
  const bits = [];
  if (rule.from_episode_number != null) bits.push(`from episode ${rule.from_episode_number}`);
  if (Number(rule.signal_count) > 0) bits.push(`${rule.signal_count} ${Number(rule.signal_count) === 1 ? 'edit' : 'edits'}`);
  return (
    <span className="lv-meta">
      <ContextChip context={rule.context} />
      {bits.length > 0 && <span>{bits.join(' · ')}</span>}
    </span>
  );
}

export default function LearnedVoice({ characterKey, name = 'They', you = false }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | not-ready | error
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [showEarlier, setShowEarlier] = useState(false);

  const load = useCallback(async () => {
    if (!characterKey) return;
    try {
      const d = await voiceApi.character(characterKey);
      setData(d || {});
      setState('ready');
    } catch (err) {
      console.error('[LearnedVoice] load failed:', err);
      setState(isVoiceNotReady(err) ? 'not-ready' : 'error');
    }
  }, [characterKey]);

  useEffect(() => { setState('loading'); setData(null); load(); }, [load]);

  const act = async (kind, rule) => {
    setBusy(`${kind}-${rule.id}`); setNote(null);
    try {
      await voiceApi[kind](rule.id);
      setNote({ text: kind === 'approve' ? 'Approved: it is part of the voice now.' : kind === 'dismiss' ? 'Dismissed.' : 'Undone: that rule no longer applies.' });
      await load();
    } catch (err) {
      console.error(`[LearnedVoice] ${kind} failed:`, err);
      setNote({ error: true, text: isVoiceNotReady(err) ? VOICE_LEARN_NOT_READY : errorText(err, `Could not ${kind} that rule.`) });
    } finally { setBusy(null); }
  };

  const learn = async () => {
    setBusy('learn'); setNote(null);
    try {
      const result = await voiceApi.learn(characterKey);
      setNote({ text: learnSummary(result), testId: 'lv-learn-result' });
      await load();
    } catch (err) {
      console.error('[LearnedVoice] learn failed:', err);
      const status = err?.response?.status;
      setNote({ error: true, text: isVoiceNotReady(err) ? VOICE_LEARN_NOT_READY : status === 429 ? 'Too many tries just now; try again in a minute.' : errorText(err, 'Could not learn from the latest lines.') });
    } finally { setBusy(null); }
  };

  const who = data?.name || name;
  const their = you ? 'your' : 'their';

  if (state === 'loading') {
    return <section className="lv" data-testid="learned-voice"><p className="lv-note">Loading {their} learned voice…</p></section>;
  }
  if (state === 'not-ready' || state === 'error') {
    return (
      <section className="lv" data-testid="learned-voice" aria-labelledby="lv-h">
        <h2 id="lv-h" className="lv-h2">Learned voice</h2>
        <p className="lv-note" data-testid={state === 'not-ready' ? 'lv-not-ready' : 'lv-error'}>
          {state === 'not-ready' ? VOICE_LEARN_NOT_READY : `Could not load ${their} learned voice.`}
        </p>
        {state === 'error' && <button type="button" className="lv-btn-soft" onClick={() => { setState('loading'); load(); }}>Try again</button>}
      </section>
    );
  }

  const groups = groupRules(data?.rules, filter);
  const lines = newestLines(data?.lines, filter);
  const nothing = !lines.length && !groups.waiting.length && !groups.autoApplied.length && !groups.active.length && !groups.earlier.length;

  return (
    <section className="lv" data-testid="learned-voice" aria-labelledby="lv-h">
      <div className="lv-head">
        <span className="lv-head-text">
          <h2 id="lv-h" className="lv-h2">{you ? 'Your voice, learned' : 'Learned voice'}</h2>
          <span className="lv-note">{you ? 'From the lines you approved and your edits to them.' : 'From the lines approved for them and the edits made to them.'} One voice for the book and the show.</span>
        </span>
        <button type="button" className="lv-btn" data-testid="lv-learn" disabled={!!busy} onClick={learn}>
          <Sparkles size={16} aria-hidden="true" /> {busy === 'learn' ? 'Learning…' : 'Learn now'}
        </button>
      </div>

      <div className="lv-filter" role="group" aria-label="Where it holds">
        {[{ key: 'all', label: 'All' }, ...VOICE_CONTEXTS].map((c) => (
          <button key={c.key} type="button" className={`lv-filter-btn${filter === c.key ? ' is-on' : ''}`} aria-pressed={filter === c.key} onClick={() => setFilter(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      {note && <p className={`lv-note${note.error ? ' is-error' : ' is-done'}`} role="status" data-testid={note.testId || 'lv-status'}>{note.text}</p>}

      {nothing && (
        <p className="lv-note" data-testid="lv-empty">
          Nothing learned yet{filter !== 'all' ? ` for ${contextLabel(filter)}` : ''}. Approve lines and keep rewrites in the Script tab, then Learn now.
        </p>
      )}

      {lines.length > 0 && (
        <div className="lv-block" data-testid="lv-lines">
          <h3 className="lv-h3">How {you ? 'you' : who} really {you ? 'sound' : 'sounds'}</h3>
          <ul className="lv-lines">
            {lines.map((l) => (
              <li key={l.id} className="lv-line">
                <span className="lv-quote-mark" aria-hidden="true"><Quote size={14} /></span>
                <span className="lv-line-text">{l.text}</span>
                <span className="lv-meta">
                  <ContextChip context={l.context} />
                  {whereLine(l) && <span>{whereLine(l)}</span>}
                  {SOURCE_LABELS[l.source] && <span>{SOURCE_LABELS[l.source]}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {groups.waiting.length > 0 && (
        <div className="lv-block" data-testid="lv-waiting">
          <h3 className="lv-h3">Waiting for you <span className="lv-count">{groups.waiting.length}</span></h3>
          <ul className="lv-rules">
            {groups.waiting.map((r) => (
              <li key={r.id} className="lv-rule is-waiting" data-testid={`lv-rule-${r.id}`}>
                <p className="lv-rule-text">{r.rule_text}</p>
                <RuleMeta rule={r} />
                <RuleExample rule={r} />
                <span className="lv-actions">
                  <button type="button" className="lv-btn" disabled={!!busy} onClick={() => act('approve', r)}><Check size={16} aria-hidden="true" /> Approve</button>
                  <button type="button" className="lv-btn-soft" disabled={!!busy} onClick={() => act('dismiss', r)}><X size={16} aria-hidden="true" /> Dismiss</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {groups.autoApplied.length > 0 && (
        <div className="lv-block" data-testid="lv-auto">
          <h3 className="lv-h3">Applied automatically <span className="lv-count">{groups.autoApplied.length}</span></h3>
          <p className="lv-note">Small rules learned from {you ? 'your' : 'the'} edits. Undo takes one back.</p>
          <ul className="lv-rules">
            {groups.autoApplied.map((r) => (
              <li key={r.id} className="lv-rule" data-testid={`lv-rule-${r.id}`}>
                <p className="lv-rule-text">{r.rule_text}</p>
                <RuleMeta rule={r} />
                <RuleExample rule={r} />
                <span className="lv-actions">
                  <button type="button" className="lv-btn-soft" disabled={!!busy} onClick={() => act('undo', r)}><Undo2 size={16} aria-hidden="true" /> Undo</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {groups.active.length > 0 && (
        <div className="lv-block" data-testid="lv-active">
          <h3 className="lv-h3">In {their} voice <span className="lv-count">{groups.active.length}</span></h3>
          <ul className="lv-rules">
            {groups.active.map((r) => (
              <li key={r.id} className="lv-rule is-active" data-testid={`lv-rule-${r.id}`}>
                <p className="lv-rule-text">{r.rule_text}</p>
                <RuleMeta rule={r} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {groups.earlier.length > 0 && (
        <div className="lv-block" data-testid="lv-earlier">
          <button type="button" className="lv-fold" aria-expanded={showEarlier} aria-controls="lv-earlier-list" onClick={() => setShowEarlier((s) => !s)}>
            <ChevronDown size={16} aria-hidden="true" className={showEarlier ? 'is-open' : ''} />
            Earlier (grown out of) <span className="lv-count">{groups.earlier.length}</span>
          </button>
          <ol className="lv-timeline" id="lv-earlier-list" hidden={!showEarlier}>
            {showEarlier && groups.earlier.map((r) => (
              <li key={r.id} className="lv-step">
                <span className="lv-step-ep">{r.from_episode_number != null ? `Episode ${r.from_episode_number}` : 'Earlier'}</span>
                <span className="lv-step-text">{r.rule_text}</span>
                <ContextChip context={r.context} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
