// frontend/src/pages/SettingsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './SettingsPage.css';

const FONT_OPTIONS = [
  { value: 'Lora', label: 'Lora (Serif)', sample: 'The quick brown fox jumps over the lazy dog' },
  { value: 'DM Sans', label: 'DM Sans', sample: 'The quick brown fox jumps over the lazy dog' },
  { value: 'Georgia', label: 'Georgia', sample: 'The quick brown fox jumps over the lazy dog' },
  { value: 'system-ui', label: 'System Default', sample: 'The quick brown fox jumps over the lazy dog' },
];

const THEME_OPTIONS = [
  { value: 'parchment', label: 'Parchment', desc: 'Warm golden tones', colors: ['#FAF7F0', '#1C1814', '#B8962E'] },
  { value: 'midnight', label: 'Midnight', desc: 'Dark creative focus', colors: ['#1a1a2e', '#e0e0e0', '#C6A85E'] },
  { value: 'forest', label: 'Forest', desc: 'Deep green calm', colors: ['#1b2a1b', '#d4e4d4', '#8fbc8f'] },
];

const DEFAULT_SETTINGS = {
  theme: 'parchment',
  fontFamily: 'Lora',
  fontSize: 16,
  autosaveInterval: 8,
  autosaveEnabled: true,
  wordGoalDefault: 500,
  focusModeDefault: false,
  showSessionTimer: true,
  compactSidebar: false,
  soundEffects: false,
};

function getSettings() {
  try {
    const stored = localStorage.getItem('app_settings');
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem('app_settings', JSON.stringify(settings));
  // Dispatch custom event so other components can react
  window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
}

function SettingsPage() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState(getSettings);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('appearance');

  const update = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return next;
    });
  }, []);

  // Apply theme to body
  useEffect(() => {
    document.body.setAttribute('data-theme', settings.theme);
    document.documentElement.style.setProperty('--user-font-size', `${settings.fontSize}px`);
    document.documentElement.style.setProperty('--user-font-family', settings.fontFamily);
  }, [settings.theme, settings.fontSize, settings.fontFamily]);

  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
    { id: 'writing', label: 'Writing', icon: '✎' },
    { id: 'account', label: 'Account', icon: '👤' },
    { id: 'about', label: 'About', icon: 'ℹ️' },
  ];

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>Settings</h1>
        {saved && <span className="settings-saved-badge">Saved</span>}
      </header>

      <div className="settings-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-content">
        {/* ── APPEARANCE ── */}
        {activeTab === 'appearance' && (
          <div className="settings-section">
            <h2>Theme</h2>
            <div className="settings-theme-grid">
              {THEME_OPTIONS.map(theme => (
                <button
                  key={theme.value}
                  className={`theme-card ${settings.theme === theme.value ? 'selected' : ''}`}
                  onClick={() => update('theme', theme.value)}
                >
                  <div className="theme-preview">
                    {theme.colors.map((c, i) => (
                      <div key={i} className="theme-swatch" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="theme-name">{theme.label}</div>
                  <div className="theme-desc">{theme.desc}</div>
                </button>
              ))}
            </div>

            <h2>Font</h2>
            <div className="settings-font-grid">
              {FONT_OPTIONS.map(font => (
                <button
                  key={font.value}
                  className={`font-card ${settings.fontFamily === font.value ? 'selected' : ''}`}
                  onClick={() => update('fontFamily', font.value)}
                >
                  <div className="font-name">{font.label}</div>
                  <div className="font-sample" style={{ fontFamily: font.value }}>{font.sample}</div>
                </button>
              ))}
            </div>

            <h2>Font Size</h2>
            <div className="settings-slider-row">
              <span className="slider-label-sm">A</span>
              <input
                type="range"
                min="12"
                max="24"
                value={settings.fontSize}
                onChange={e => update('fontSize', Number(e.target.value))}
                className="settings-slider"
              />
              <span className="slider-label-lg">A</span>
              <span className="slider-value">{settings.fontSize}px</span>
            </div>

            <h2>Layout</h2>
            <label className="settings-toggle-row">
              <span>Compact sidebar</span>
              <input
                type="checkbox"
                checked={settings.compactSidebar}
                onChange={e => update('compactSidebar', e.target.checked)}
              />
              <span className="toggle-switch" />
            </label>
          </div>
        )}

        {/* ── WRITING ── */}
        {activeTab === 'writing' && (
          <div className="settings-section">
            <h2>Autosave</h2>
            <label className="settings-toggle-row">
              <span>Enable autosave</span>
              <input
                type="checkbox"
                checked={settings.autosaveEnabled}
                onChange={e => update('autosaveEnabled', e.target.checked)}
              />
              <span className="toggle-switch" />
            </label>
            {settings.autosaveEnabled && (
              <div className="settings-slider-row">
                <span className="slider-label-text">Interval</span>
                <input
                  type="range"
                  min="3"
                  max="30"
                  value={settings.autosaveInterval}
                  onChange={e => update('autosaveInterval', Number(e.target.value))}
                  className="settings-slider"
                />
                <span className="slider-value">{settings.autosaveInterval}s</span>
              </div>
            )}

            <h2>Session Goals</h2>
            <div className="settings-slider-row">
              <span className="slider-label-text">Default word goal</span>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={settings.wordGoalDefault}
                onChange={e => update('wordGoalDefault', Number(e.target.value))}
                className="settings-slider"
              />
              <span className="slider-value">{settings.wordGoalDefault} words</span>
            </div>

            <h2>Defaults</h2>
            <label className="settings-toggle-row">
              <span>Start in focus mode</span>
              <input
                type="checkbox"
                checked={settings.focusModeDefault}
                onChange={e => update('focusModeDefault', e.target.checked)}
              />
              <span className="toggle-switch" />
            </label>
            <label className="settings-toggle-row">
              <span>Show session timer</span>
              <input
                type="checkbox"
                checked={settings.showSessionTimer}
                onChange={e => update('showSessionTimer', e.target.checked)}
              />
              <span className="toggle-switch" />
            </label>
            <label className="settings-toggle-row">
              <span>Sound effects</span>
              <input
                type="checkbox"
                checked={settings.soundEffects}
                onChange={e => update('soundEffects', e.target.checked)}
              />
              <span className="toggle-switch" />
            </label>
          </div>
        )}

        {/* ── ACCOUNT ── */}
        {activeTab === 'account' && (
          <div className="settings-section">
            <h2>Profile</h2>
            <div className="settings-profile-card">
              <div className="profile-avatar">{(user?.name || user?.email || 'U')[0].toUpperCase()}</div>
              <div className="profile-info">
                <div className="profile-name">{user?.name || user?.email?.split('@')[0] || 'Creator'}</div>
                <div className="profile-email">{user?.email || 'Not set'}</div>
              </div>
            </div>

            <h2>Session</h2>
            <button className="settings-btn danger" onClick={logout}>
              Sign Out
            </button>

            <h2>Data</h2>
            <button
              className="settings-btn"
              onClick={() => {
                const data = JSON.stringify(getSettings(), null, 2);
                navigator.clipboard.writeText(data);
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }}
            >
              Export Settings to Clipboard
            </button>
            <button
              className="settings-btn danger-outline"
              onClick={() => {
                if (window.confirm('Reset all settings to defaults?')) {
                  setSettings({ ...DEFAULT_SETTINGS });
                  saveSettings(DEFAULT_SETTINGS);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2000);
                }
              }}
            >
              Reset to Defaults
            </button>
          </div>
        )}

        {/* ── ABOUT ── */}
        {activeTab === 'about' && (
          <div className="settings-section">
            <h2>Creative Engine</h2>
            <div className="about-card">
              <div className="about-logo">{'🎬'}</div>
              <div className="about-version">v2.0.0</div>
              <p className="about-desc">
                A narrative studio for creators. Write books, build characters,
                compose scenes, and produce episodes -- all in one place.
              </p>
              <div className="about-stack">
                <span className="tech-badge">React 18</span>
                <span className="tech-badge">Vite</span>
                <span className="tech-badge">Express</span>
                <span className="tech-badge">PostgreSQL</span>
                <span className="tech-badge">Claude AI</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsPage;
