// UniverseTabBar.jsx
// Drop-in tab bar replacement for /universe
// Two clusters: Show side (existing) + Story side (new)
// Import this and replace your existing tab row

// USAGE — in your Universe page component, replace the tab bar with:
//
//   import UniverseTabBar from './UniverseTabBar';
//   <UniverseTabBar activeTab={activeTab} onChange={setActiveTab} />
//
// Then add cases for 'story_dashboard', 'knowledge', and 'writing_rhythm'
// in your tab content switch/conditional.
//
// Add these imports at the top of Universe.jsx:
//   import StoryDashboard from './StoryDashboard';
//   import FranchiseBrain from './FranchiseBrain';
//   import WritingRhythm from './WritingRhythm';

export const SHOW_TABS = [
  { key: 'universe',       label: 'Universe',      icon: '◈' },
  { key: 'social-import',  label: 'Social Import', icon: '▦' },
  { key: 'series',         label: 'Series',        icon: '◧' },
  { key: 'production',     label: 'Production',    icon: '▨' },
  { key: 'wardrobe',       label: 'Wardrobe',      icon: '△' },
  { key: 'assets',         label: 'Assets',        icon: '□' },
];

export const STORY_TABS = [
  { key: 'story-dashboard',  label: 'Story',     icon: '✦' },
  { key: 'knowledge',        label: 'Knowledge', icon: '⬡' },
  { key: 'writing-rhythm',   label: 'Rhythm',    icon: '◇' },
];

export default function UniverseTabBar({ activeTab, onChange }) {
  const isShowTab  = SHOW_TABS.some(t => t.key === activeTab);
  const isStoryTab = STORY_TABS.some(t => t.key === activeTab);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      borderBottom: '1px solid #e0d9ce',
      background: '#fff0f3',
      flexWrap: 'wrap',
      gap: '0',
    }}>
      {/* Show cluster */}
      <div style={{ display: 'flex' }}>
        {SHOW_TABS.map(tab => (
          <Tab key={tab.key} tab={tab} active={activeTab === tab.key} onClick={() => onChange(tab.key)} />
        ))}
      </div>

      {/* Divider */}
      <div style={{
        width: '1px',
        height: '20px',
        background: '#e0d9ce',
        margin: '0 8px',
        flexShrink: 0,
      }} />

      {/* Story cluster */}
      <div style={{ display: 'flex' }}>
        {STORY_TABS.map(tab => (
          <Tab key={tab.key} tab={tab} active={activeTab === tab.key} onClick={() => onChange(tab.key)} isStory />
        ))}
      </div>
    </div>
  );
}

function Tab({ tab, active, onClick, isStory }) {
  const activeColor = isStory ? '#b8863e' : '#1a1714';
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        borderBottom: active ? `2px solid ${activeColor}` : '2px solid transparent',
        padding: '12px 16px',
        marginBottom: '-1px',
        fontSize: '12px',
        letterSpacing: '0.04em',
        color: active ? activeColor : '#a89f94',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        transition: 'color 0.15s ease',
        fontWeight: active ? '600' : '400',
      }}
    >
      <span style={{ fontSize: '10px', opacity: active ? 1 : 0.6 }}>{tab.icon}</span>
      {tab.label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSE PAGE INTEGRATION GUIDE
// Paste this into your Universe.jsx as a reference
// ─────────────────────────────────────────────────────────────────────────────

/*
// At top of Universe.jsx — add these imports:
import UniverseTabBar, { SHOW_TABS, STORY_TABS } from './UniverseTabBar';
import StoryDashboard from './StoryDashboard';
import FranchiseBrain from './FranchiseBrain';
import WritingRhythm from './WritingRhythm';

// In your component state — your existing tab state stays the same:
const [activeTab, setActiveTab] = useState('universe');

// Replace your existing tab bar JSX with:
<UniverseTabBar activeTab={activeTab} onChange={setActiveTab} />

// In your tab content area — add these three cases alongside your existing ones:
{activeTab === 'story-dashboard' && (
  <StoryDashboard
    bookId={YOUR_BOOK_ID}
    registryId={YOUR_REGISTRY_ID}
  />
)}

{activeTab === 'knowledge' && (
  <FranchiseBrain />
)}

{activeTab === 'writing-rhythm' && (
  <WritingRhythm />
)}

// That's it. The show tabs and their content are unchanged.
// The story tabs are additive — no existing code breaks.
*/
