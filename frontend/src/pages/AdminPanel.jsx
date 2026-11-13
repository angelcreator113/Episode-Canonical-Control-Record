/**
 * Admin Panel Page
 * One page with four tabs (Evoni, 2026-11-13):
 *   Overview                  what is waiting and what is not answering
 *   The Pulse                 the Social Director's home (docs/design/2026-10-the-pulse.md §1)
 *   Website & Show Settings   the public site's images and video, and the active
 *                             show's settings: two sections side by side, each
 *                             with its own data and its own saves
 *   Security & Access         the Audit Log, the recent sign-in and rate-limit
 *                             refusals, and the admin tools
 *
 * ?tab= selects a section; every key that existed before still opens what it
 * opened (pulse, website, show-settings, and tools, now Security & Access).
 * The route is wrapped in AdminOnly (App.jsx), so nothing here loads for
 * anyone outside the admin group. Roles are Cognito groups; this page shows
 * no role editor.
 */

import React from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Wallet, BarChart3, Coins, Map as MapIcon, Palette, Trash2, ChevronRight, CalendarDays, ScrollText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import WebsiteAdmin from './WebsiteAdmin';
import ShowSettings from './ShowSettings';
import AdminShowGate from '../components/Admin/AdminShowGate';
import AdminOverview from '../components/Admin/AdminOverview';
import PulseDirector from './AdminPulse';
import RateLimitRefusals from '../components/Admin/RateLimitRefusals';
import '../styles/AdminPanel.css';
import './AdminPulse.css';

// Admin's tabs, in order. The first is the default. `sections` are the ?tab=
// keys a tab answers to: its own first, then the keys kept for old links.
export const TABS = [
  { key: 'overview', label: 'Overview', sections: ['overview'] },
  { key: 'pulse', label: 'The Pulse', sections: ['pulse'] },
  { key: 'website', label: 'Website & Show Settings', sections: ['website', 'show-settings'] },
  { key: 'security', label: 'Security & Access', sections: ['security', 'tools'] },
];
// The two sections of Website & Show Settings. Each keeps its own ?tab= key.
const SITE_SECTIONS = [
  { key: 'website', label: 'Website' },
  { key: 'show-settings', label: 'Show settings' },
];
// The header's initials and today's date (Evoni's Admin mock, 2026-10-17).
export const initialsOf = (user) => {
  const name = (user?.name || user?.email?.split('@')[0] || 'A').trim();
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] || ''))).toUpperCase() || 'A';
};
const todayLabel = (now = new Date()) => now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
// The section a ?tab= value names (an unknown one is the default), and the tab that holds it.
const sectionFrom = (value) => (TABS.some((t) => t.sections.includes(value)) ? value : TABS[0].key);
const tabOf = (section) => TABS.find((t) => t.sections.includes(section)).key;

// Admin tools index — each entry is a route in App.jsx.
const ADMIN_TOOLS = [
  { route: '/cfo', label: 'CFO Agent', Icon: Wallet,
    desc: 'Runs cost, dependency, resource and health audits across the system.' },
  { route: '/analytics/decisions', label: 'Decision Analytics', Icon: BarChart3,
    desc: 'Insights from your editing decisions, used to train the AI.' },
  { route: '/ai-costs', label: 'AI Costs', Icon: Coins,
    desc: 'AI spend broken down by day, model and feature.' },
  { route: '/site-organizer', label: 'Site Organizer', Icon: MapIcon,
    desc: 'Audits navigation: sidebar and route alignment, dead links, orphan pages.' },
  { route: '/design-agent', label: 'Design Agent', Icon: Palette,
    desc: 'Audits design: responsive breakpoints, tokens, consistency, accessibility.' },
  { route: '/recycle-bin', label: 'Recycle Bin', Icon: Trash2,
    desc: 'Restores soft-deleted items, grouped by type.' },
];

// Admin › Show settings: the active show's settings (AdminShowGate picks
// the show). The show's own Config/Advanced tab is ?sub= here.
function AdminShowSettings() {
  return (
    <AdminShowGate resetKeys={['sub']}>
      {(showId) => <ShowSettings key={showId} showId={showId} tabParam="sub" />}
    </AdminShowGate>
  );
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section = sectionFrom(params.get('tab'));
  const tab = tabOf(section);
  // ?sub= belongs to the section it was set on (Show settings' Config/Advanced,
  // The Pulse's sub-tabs), so changing section drops it.
  const selectTab = (key) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('tab', key);
    next.delete('sub');
    return next;
  }, { replace: true });
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="admin-panel-page adm">
      <div className="admin-container">
        <header className="adm-hero">
          <div className="adm-hero-text">
            <h1>Admin</h1>
            <p className="adm-kicker">Manage · Monitor · Guide · Grow</p>
          </div>
          {user && (
            <span className="adm-user" data-testid="adm-user">
              <span className="adm-avatar" aria-hidden="true">{initialsOf(user)}</span>
              <span className="adm-user-email">{user.email || user.name}</span>
            </span>
          )}
        </header>

        <div className="adm-bar">
          <div className="adm-tabs" role="tablist" aria-label="Admin sections">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`admin-tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls={`admin-panel-${t.key}`}
                className={tab === t.key ? 'adm-tab is-active' : 'adm-tab'}
                onClick={() => selectTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="adm-date" data-testid="adm-date"><CalendarDays size={16} aria-hidden="true" />{todayLabel()}</span>
        </div>

        <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`} className="admin-tabpanel">
        {section === 'overview' && <AdminOverview />}
        {section === 'pulse' && <PulseDirector />}
        {tab === 'website' && (<>
          <div className="adm-site-switch" role="group" aria-label="Website and show settings">
            {SITE_SECTIONS.map((sec) => (
              <button
                key={sec.key}
                type="button"
                aria-pressed={section === sec.key}
                className={section === sec.key ? 'adm-site-btn is-active' : 'adm-site-btn'}
                onClick={() => selectTab(sec.key)}
              >
                {sec.label}
              </button>
            ))}
          </div>
          {section === 'website' && <WebsiteAdmin />}
          {section === 'show-settings' && <AdminShowSettings />}
        </>)}
        {tab === 'security' && (<>
        <section className="admin-tools" aria-labelledby="admin-audit-heading">
          <h2 id="admin-audit-heading" className="admin-tools-heading">Audit Log</h2>
          <ul className="admin-tools-list">
            <li>
              <Link className="admin-tool" to="/admin/audit" data-testid="admin-audit-link">
                <ScrollText className="admin-tool-icon" size={20} aria-hidden="true" />
                <span className="admin-tool-text">
                  <span className="admin-tool-label">Audit Log</span>
                  <span className="admin-tool-desc">Who created, edited, deleted or downloaded what, and when.</span>
                </span>
                <ChevronRight className="admin-tool-chevron" size={16} aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </section>

        <RateLimitRefusals />

        <section className="admin-tools" aria-labelledby="admin-roles-heading">
          <h2 id="admin-roles-heading" className="admin-tools-heading">Roles</h2>
          <p className="admin-roles-note" data-testid="admin-roles-note">
            Who is an admin, editor or viewer is set by group membership in Amazon Cognito, not on this page.
            {user?.groups?.length ? ` You are signed in as ${user.email || user.name}, in: ${user.groups.join(', ')}.` : ''}
          </p>
        </section>

        <section className="admin-tools" aria-labelledby="admin-tools-heading">
          <h2 id="admin-tools-heading" className="admin-tools-heading">Admin tools</h2>
          <ul className="admin-tools-list">
            {ADMIN_TOOLS.map(({ route, label, Icon, desc }) => (
              <li key={route}>
                <button
                  type="button"
                  className="admin-tool"
                  onClick={() => navigate(route)}
                >
                  <Icon className="admin-tool-icon" size={20} aria-hidden="true" />
                  <span className="admin-tool-text">
                    <span className="admin-tool-label">{label}</span>
                    <span className="admin-tool-desc">{desc}</span>
                  </span>
                  <ChevronRight className="admin-tool-chevron" size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
        </>)}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
