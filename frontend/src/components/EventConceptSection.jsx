/**
 * Event concept (Task #2132, step 4b of docs/EVENT_EPISODE_FLOW.md §8(u)).
 *
 * Read-only view of what the creation draft wrote that has no Basics row:
 * automation.concept, automation.activity, automation.styling_brief and the
 * dress_code_keywords column. Nothing here is editable; the dress code itself
 * stays in Basics. For planning only: the public description is the attendee
 * copy (doctrine rule 12), this is not.
 *
 * Labels follow doctrine rule 14 as step 4 shows them. Concept, activity and
 * the brief live only in automation and have no editable home, so they read
 * "Auto-drafted · AI draft". Keywords can change through the event PUT, so
 * they use draftStateOf against their saved copy: Auto-drafted, Edited, or no
 * label when never drafted.
 *
 * Renders nothing when the event has no concept, activity or styling brief.
 */
import { Sparkles, Pencil } from 'lucide-react';
import { draftStateOf } from '../utils/eventBasics';

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const list = (v) => (Array.isArray(v) ? v.map(text).filter(Boolean) : []);

function keywordsOf(event) {
  const raw = event?.dress_code_keywords;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[EventConceptSection] dress_code_keywords is not JSON; showing none:', err.message);
      return [];
    }
  }
  return [];
}

const DRAFTED = { state: 'auto_drafted' };

function StateLabel({ draft, testId }) {
  if (!draft) return null;
  const edited = draft.state === 'edited';
  const Icon = edited ? Pencil : Sparkles;
  return (
    <span className="epp-basic-state" data-testid={testId}>
      <Icon size={11} aria-hidden="true" /> {edited ? 'Edited' : 'Auto-drafted · AI draft'}
    </span>
  );
}

function Row({ label, draft, testId, children }) {
  return (
    <div className={`epp-basic is-${draft ? draft.state : 'set'}`} data-testid={testId}>
      <dt>
        {label}
        <StateLabel draft={draft} testId={`${testId}-state`} />
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function EventConceptSection({ event, dressCodeEdited = false }) {
  const auto = event?.canon_consequences?.automation || {};
  const concept = text(auto.concept);
  const activity = text(auto.activity);
  const brief = auto.styling_brief && typeof auto.styling_brief === 'object' ? auto.styling_brief : null;
  if (!concept && !activity && !brief) return null;

  const keywords = list(keywordsOf(event));
  const keywordsDraft = keywords.length > 0 ? draftStateOf(event, 'dress_code_keywords', keywordsOf(event)) : null;

  const formality = text(brief?.formality);
  const direction = text(brief?.style_direction);
  const needs = list(brief?.function_requirements);
  const avoid = list(brief?.avoid);
  const environment = text(brief?.environment);
  const footwear = text(brief?.footwear_requirements);

  return (
    <section className="epp-section epp-concept" data-testid="event-concept">
      <div className="epp-section-header">
        <h2 className="epp-section-title">Event concept</h2>
      </div>
      <p className="epp-concept-subtitle">For planning; not shown to guests</p>
      <dl className="epp-fields">
        {concept && (
          <Row label="Concept" draft={DRAFTED} testId="concept-concept">
            <span className="epp-basic-value epp-basic-prose">{concept}</span>
          </Row>
        )}
        {activity && (
          <Row label="Activity" draft={DRAFTED} testId="concept-activity">
            <span className="epp-basic-value epp-basic-prose">{activity}</span>
          </Row>
        )}
        {keywords.length > 0 && (
          <Row label="Keywords" draft={keywordsDraft} testId="concept-keywords">
            <ul className="epp-concept-chips">
              {keywords.map((k) => <li key={k} className="epp-concept-chip">{k}</li>)}
            </ul>
          </Row>
        )}
        {brief && (
          <Row label="Styling brief" draft={DRAFTED} testId="concept-brief">
            <dl className="epp-concept-brief">
              {formality && <div><dt>Formality</dt><dd>{formality}</dd></div>}
              {direction && <div><dt>Style direction</dt><dd>{direction}</dd></div>}
              {needs.length > 0 && <div><dt>Needs to allow</dt><dd>{needs.join(' · ')}</dd></div>}
              {avoid.length > 0 && <div><dt>Avoid</dt><dd>{avoid.join(' · ')}</dd></div>}
              {environment && <div data-testid="concept-brief-environment"><dt>Environment</dt><dd>{environment}</dd></div>}
              {footwear && <div data-testid="concept-brief-footwear"><dt>Footwear</dt><dd>{footwear}</dd></div>}
            </dl>
            {dressCodeEdited && (
              <p className="epp-concept-stale" data-testid="concept-brief-stale">Drafted with the original dress code.</p>
            )}
          </Row>
        )}
      </dl>
    </section>
  );
}
