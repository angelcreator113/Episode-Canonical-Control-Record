/**
 * Person tab, section 6: what the writers know about them. The exact lines
 * the episode script writer reads about this person (made on the server by
 * the script writer's own functions, services/personPage writersPreview):
 * their lines about Lala in the cast block, their family block, and who
 * knows about their relationships. So Evoni can check it before a script.
 */
import { PenLine } from 'lucide-react';
import './PersonWriters.css';

export default function PersonWriters({ writers }) {
  const w = writers || {};
  const empty = !w.lala?.length && !w.family_block && !w.secrecy?.length;
  return (
    <section className="ch-card pwr" aria-labelledby="pwr-h" data-testid="person-writers">
      <h2 id="pwr-h" className="ch-h2"><PenLine size={20} aria-hidden="true" className="ch-h2-icon" /> What the writers know about them</h2>
      <p className="ch-note">The lines the episode script writer gets about them, word for word.</p>
      {!w.in_cast_block && (
        <p className="ch-note pwr-warn" data-testid="pwr-no-cast">
          They have no Pulse profile, so the cast list never names them: only the who-knows lines reach a script.
        </p>
      )}
      {empty ? (
        <p className="ch-note">Nothing about them yet beyond their profile.</p>
      ) : (
        <>
          {w.lala?.length > 0 && (
            <div className="pwr-block">
              <h3 className="pwr-h3">With Lala</h3>
              <pre className="pwr-lines">{w.lala.join('\n')}</pre>
            </div>
          )}
          {w.family_block && (
            <div className="pwr-block">
              <h3 className="pwr-h3">Family</h3>
              <pre className="pwr-lines">{w.family_block}</pre>
            </div>
          )}
          {w.secrecy?.length > 0 && (
            <div className="pwr-block">
              <h3 className="pwr-h3">Who knows</h3>
              <pre className="pwr-lines">{w.secrecy.map((l) => `- ${l}`).join('\n')}</pre>
            </div>
          )}
        </>
      )}
    </section>
  );
}
