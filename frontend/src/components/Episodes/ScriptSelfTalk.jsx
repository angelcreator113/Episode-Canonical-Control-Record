/**
 * Her self-talk at Beat 13 (Evoni, 2026-10-25: "Yes build the goals and
 * stress script work"): Hard on herself · Honest · Kind. Saved on the
 * episode's brief (PUT /episode-brief/:id/self-talk, event_metadata
 * .self_talk); the writers write Beat 13 (Recap Panel) in that tone, and at
 * Complete kind or honest self-talk after a safe or failed result softens
 * her stress by one, while being hard on herself after a pass or a slay adds
 * one (src/utils/evaluationFormula selfTalkStressDelta). Nothing saved reads
 * as Honest for the writers and changes no stress.
 *
 *   tone      the saved tone, or null
 *   onChoose  (tone) => void; the chosen one again takes it back (null)
 *   saving    the tone being saved, or null
 *   failed    true when the last save failed
 */
import { MessageCircleHeart } from 'lucide-react';
import './ScriptSelfTalk.css';

export const SELF_TALK_OPTIONS = [
  { key: 'hard', label: 'Hard on herself' },
  { key: 'honest', label: 'Honest' },
  { key: 'kind', label: 'Kind' },
];
export const DEFAULT_SELF_TALK = 'honest';

const EFFECT = {
  hard: 'Beat 13 is blunt and self-critical. After a pass or a slay, it adds 1 stress.',
  honest: 'Beat 13 names what worked and what didn’t. After a safe or failed result, it softens the stress by 1.',
  kind: 'Beat 13 is gentle and forgiving. After a safe or failed result, it softens the stress by 1.',
};

export default function ScriptSelfTalk({ tone = null, onChoose, saving = null, failed = false, testId = 'script-self-talk' }) {
  const shown = tone || DEFAULT_SELF_TALK;
  return (
    <section className="sst" data-testid={testId} aria-labelledby={`${testId}-title`}>
      <h4 className="sst-title" id={`${testId}-title`}><MessageCircleHeart size={14} aria-hidden="true" /> Her self-talk · Beat 13</h4>
      <div className="sst-options" role="radiogroup" aria-labelledby={`${testId}-title`}>
        {SELF_TALK_OPTIONS.map((o) => (
          <button key={o.key} type="button" role="radio" aria-checked={shown === o.key}
            className={`sst-option${shown === o.key ? ' is-on' : ''}`} data-testid={`${testId}-${o.key}`}
            disabled={!!saving}
            onClick={() => onChoose?.(tone === o.key ? null : o.key)}>
            {saving === o.key ? 'Saving…' : o.label}
          </button>
        ))}
      </div>
      <p className="sst-note" data-testid={`${testId}-note`}>
        {EFFECT[shown]}{' '}
        {tone ? 'Saved for this episode; choose it again to take it back.' : 'Honest by default: choose one to save it. Until then her stress is not changed by it.'}
      </p>
      {failed && <p className="sst-fail" role="alert">Couldn&apos;t save her self-talk. Try again.</p>}
    </section>
  );
}
