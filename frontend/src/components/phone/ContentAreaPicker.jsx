/**
 * ContentAreaPicker — the Content stage's "Add an area" card (Evoni's
 * mockup, 2026-10-08): what this screen's areas show, the kinds to pick
 * from (the next area drawn on the phone gets the picked kind), and the
 * other screens that have content.
 *
 * The four kinds are existing content types; the mockup's Shopping list and
 * Career plan (in-world documents) have no content type yet.
 */
import { CONTENT_TYPE_MAP } from '../ScreenContentRenderer';
import './ContentAreaPicker.css';

const NO_ZONES = [];
const NO_OTHERS = [];

export const CONTENT_AREA_KINDS = [
  { key: 'latest_post', label: 'Latest post', desc: "From Lala's Feed", tone: 'ink', content_type: 'feed_posts', content_config: { max_items: 1 } },
  { key: 'dm_thread', label: 'DM thread', desc: 'A conversation in Messages', tone: 'pink', content_type: 'dm_thread', content_config: {} },
  { key: 'profile_card', label: 'Profile card', desc: 'Any character, from the registry', tone: 'lavender', content_type: 'profile_header', content_config: {} },
  { key: 'lala_stats', label: "Lala's stats", desc: 'Coins and her next goal', tone: 'gold', content_type: 'money_balance', content_config: {} },
];

/** A zone's kind in words: the picker's name when it matches one, else the content type's label. */
export function contentAreaLabel(zone) {
  if (!zone?.content_type) return 'Not set yet';
  const kind = CONTENT_AREA_KINDS.find(k => k.content_type === zone.content_type
    && Object.entries(k.content_config).every(([key, v]) => zone.content_config?.[key] === v));
  return kind?.label || CONTENT_TYPE_MAP[zone.content_type]?.label || zone.content_type;
}

export default function ContentAreaPicker({ zones = NO_ZONES, armedKey = null, onArm, otherScreens = NO_OTHERS, onPickScreen }) {
  const n = zones.length;
  return (
    <section className="content-area-picker" aria-label="Add a content area">
      <p className="content-area-picker__lead">Areas on a screen that show real show data and change per episode.</p>
      <div className="content-area-picker__summary" data-testid="content-area-summary">
        {n === 0
          ? 'No areas on this screen yet'
          : `${n} area${n === 1 ? '' : 's'} · ${zones.map(contentAreaLabel).join(', ')}`}
      </div>
      <div className="content-area-picker__heading">Add an area: pick what it shows, then drag it on the screen</div>
      <ul className="content-area-picker__kinds">
        {CONTENT_AREA_KINDS.map(k => (
          <li key={k.key}>
            <button
              type="button"
              className={`content-area-picker__kind is-${k.tone}${armedKey === k.key ? ' is-armed' : ''}`}
              aria-pressed={armedKey === k.key}
              onClick={() => onArm?.(armedKey === k.key ? null : k)}
              data-testid={`content-kind-${k.key}`}
            >
              <span className="content-area-picker__dot" aria-hidden="true" />
              <span className="content-area-picker__kind-text">
                <span className="content-area-picker__kind-name">{k.label}</span>
                <span className="content-area-picker__kind-desc">{armedKey === k.key ? 'Now drag on the phone' : k.desc}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {otherScreens.length > 0 && (
        <p className="content-area-picker__others" data-testid="content-other-screens">
          Other screens with content:{' '}
          {otherScreens.map(({ screen, count }, i) => (
            <span key={screen.id}>
              {i > 0 && ', '}
              <button type="button" className="content-area-picker__link" onClick={() => onPickScreen?.(screen)}>{screen.name} {count}</button>
            </span>
          ))}
          .
        </p>
      )}
    </section>
  );
}
