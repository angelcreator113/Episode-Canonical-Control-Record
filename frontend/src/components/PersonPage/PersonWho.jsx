/**
 * Person tab, section 1: who they are. Their name, the name they post
 * under, the other names they go by (their Pulse profile's "also known as"),
 * their role and a line about them.
 */
import { IdCard } from 'lucide-react';
import { ROLE_LABELS } from '../../constants/characterConstants';
import './PersonWho.css';

/** Their role as the cast says it: Lala is the Protagonist; else the label or the role type. */
export function roleOf(who) {
  if (who?.role_label) return who.role_label;
  if (who?.is_lala) return ROLE_LABELS.protagonist;
  const t = who?.role_type;
  return ROLE_LABELS[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : null);
}

export default function PersonWho({ who, openTab }) {
  const role = roleOf(who);
  return (
    <section className="ch-card pw" aria-labelledby="pw-h" data-testid="person-who">
      <h2 id="pw-h" className="ch-h2"><IdCard size={20} aria-hidden="true" className="ch-h2-icon" /> Who they are</h2>
      <dl className="pw-list">
        <div className="pw-row"><dt>Name</dt><dd className="pw-name">{who.name}</dd></div>
        {who.online_as && <div className="pw-row"><dt>Online as</dt><dd>{who.online_as}</dd></div>}
        <div className="pw-row">
          <dt>Also known as</dt>
          <dd>
            {who.aliases?.length
              ? <span className="pw-akas">{who.aliases.map((a) => <span key={a} className="pw-aka">{a}</span>)}</span>
              : <span className="ch-note">No other names recorded.</span>}
          </dd>
        </div>
        <div className="pw-row"><dt>Role</dt><dd>{role || <span className="ch-note">Not set</span>}</dd></div>
      </dl>
      {who.summary
        ? <p className="pw-summary">{who.summary}</p>
        : (
          <p className="ch-note">
            No line about them yet.{' '}
            {openTab && <button type="button" className="ch-link pw-inline" onClick={() => openTab('overview')}>Write who they are on Overview</button>}
          </p>
        )}
    </section>
  );
}
