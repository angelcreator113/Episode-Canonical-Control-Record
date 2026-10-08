/**
 * PhoneMapStage — Lala's Phone's Map stage (Evoni's mockup, 2026-10-08:
 * "How Lala moves through her phone · Every tap, from the home screen out").
 *
 * The home screen on the phone, a line to each screen one of its zones
 * opens (green: it leads on; red: a dead end, Lala can't tap back out;
 * grey: the zone names no screen), and beside it what the phone can't do:
 * screens nothing leads to, and screens opened twice from one screen. A
 * screen opens in Connect. Reads phoneFlowMap (lib/phoneHubSummary); saves
 * nothing.
 */
import PhoneDevice from './PhoneDevice';
import { phoneFlowMap } from '../../lib/phoneHubSummary';
import './PhoneMapStage.css';

const NO_ICONS = [];
const noop = () => {};

const TAP_LINE = {
  onward: (t) => `${t.onward} link${t.onward === 1 ? '' : 's'} onward`,
  dead: () => 'dead end',
  missing: () => 'opens no screen',
};

export default function PhoneMapStage({
  overlays,
  icons = NO_ICONS,
  skin,
  customFrameUrl = null,
  globalFit,
  showId,
  onOpenScreen,
}) {
  const map = phoneFlowMap(overlays, icons);
  const { home, taps, deadEnds, unreachable, openedTwice } = map;

  if (!home) {
    return (
      <section className="phone-map-stage" aria-label="Phone map">
        <h3 className="phone-map-stage__title">How Lala moves through her phone</h3>
        <p className="phone-map-stage__empty">Give a screen an image in Build to start the map.</p>
      </section>
    );
  }

  const allGood = taps.length > 0 && deadEnds.length === 0 && unreachable.length === 0 && openedTwice.length === 0;

  return (
    <section className="phone-map-stage" aria-label="Phone map">
      <div className="phone-map-stage__head">
        <h3 className="phone-map-stage__title">How Lala moves through her phone</h3>
        <span className="phone-map-stage__sub">Every tap, from the home screen out</span>
      </div>

      <div className="phone-map-stage__body">
        <div className="phone-map-stage__home">
          <button type="button" className="phone-map-stage__device" onClick={() => onOpenScreen?.(home)} title={`Open ${home.name} in Connect`}>
            <PhoneDevice
              skin={skin}
              customFrameUrl={customFrameUrl}
              useCustomFrame={Boolean(customFrameUrl)}
              phoneScreen={home}
              activeScreen={home}
              firstScreen={home}
              globalFit={globalFit}
              icons={icons}
              showId={showId}
              onNavigate={noop}
            />
          </button>
          <div className="phone-map-stage__home-name">{home.name}</div>
          <div className="phone-map-stage__home-line">{taps.length} tap{taps.length === 1 ? '' : 's'} out</div>
        </div>

        <ol className="phone-map-stage__taps" data-testid="phone-map-taps">
          {taps.length === 0 && (
            <li className="phone-map-stage__none">Nothing on {home.name} opens a screen yet. Add tap zones in Connect.</li>
          )}
          {taps.map((t) => (
            <li key={t.zoneId} className={`phone-map-stage__tap is-${t.state}`}>
              <button
                type="button"
                className="phone-map-stage__node"
                onClick={() => onOpenScreen?.(t.target || home)}
                data-testid={`phone-map-tap-${t.zoneId}`}
              >
                {t.target?.url ? <img src={t.target.url} alt="" className="phone-map-stage__thumb" /> : <span className="phone-map-stage__thumb" aria-hidden="true" />}
                <span className="phone-map-stage__node-text">
                  <span className="phone-map-stage__node-name">{t.target?.name || t.label}</span>
                  <span className="phone-map-stage__node-line">
                    {t.target && t.label.toLowerCase() !== String(t.target.name || '').toLowerCase() ? `from ${t.label} · ` : ''}{TAP_LINE[t.state](t)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="phone-map-stage__notes">
          {unreachable.length > 0 && (
            <div className="phone-map-stage__note is-danger" data-testid="phone-map-unreachable">
              <div className="phone-map-stage__note-title">Not reachable</div>
              <ul className="phone-map-stage__chips">
                {unreachable.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="phone-map-stage__chip" onClick={() => onOpenScreen?.(s)}>
                      {s.url && <img src={s.url} alt="" />}
                      <span><strong>{s.name}</strong><em>nothing links here</em></span>
                    </button>
                  </li>
                ))}
              </ul>
              <p>Lala can never open {unreachable.length === 1 ? 'this screen' : 'these screens'}.</p>
              <button type="button" className="phone-map-stage__link" onClick={() => onOpenScreen?.(home)}>Link {unreachable.length === 1 ? 'it' : 'them'} from {home.name}</button>
            </div>
          )}

          {deadEnds.length > 0 && (
            <div className="phone-map-stage__note is-danger" data-testid="phone-map-dead-ends">
              <div className="phone-map-stage__note-title">{deadEnds.length} dead end{deadEnds.length === 1 ? '' : 's'}</div>
              <p>Lala can open {deadEnds.length === 1 ? 'it' : 'them'} but can&apos;t tap back out. A zone back to {home.name}, or an icon pinned on {home.name}, fixes it.</p>
              <ul className="phone-map-stage__names">
                {deadEnds.map((s) => (
                  <li key={s.id}><button type="button" className="phone-map-stage__link" onClick={() => onOpenScreen?.(s)}>{s.name}</button></li>
                ))}
              </ul>
            </div>
          )}

          {openedTwice.length > 0 && (
            <div className="phone-map-stage__note is-warn" data-testid="phone-map-opened-twice">
              <div className="phone-map-stage__note-title">Opened twice</div>
              {openedTwice.map((o) => (
                <p key={`${o.screen.id}>${o.target.id}`}>
                  On {o.screen.name}, {o.target.name} opens from {o.labels.map((l, i) => (
                    <span key={i}>{i > 0 ? (i === o.labels.length - 1 ? ' and ' : ', ') : ''}<strong>{l}</strong></span>
                  ))}.{' '}
                  <button type="button" className="phone-map-stage__link" onClick={() => onOpenScreen?.(o.screen)}>Show me</button>
                </p>
              ))}
            </div>
          )}

          {allGood && (
            <div className="phone-map-stage__note is-good" data-testid="phone-map-all-good">
              <div className="phone-map-stage__note-title">Every screen can be reached and left</div>
              <p>No dead ends, and nothing opened twice.</p>
            </div>
          )}

          <div className="phone-map-stage__note is-key">
            <div className="phone-map-stage__note-title">Key</div>
            <p><span className="phone-map-stage__key-onward">Green</span>: has its own taps onward</p>
            <p><span className="phone-map-stage__key-dead">Red</span>: dead end, no way back</p>
          </div>
        </div>
      </div>
    </section>
  );
}
