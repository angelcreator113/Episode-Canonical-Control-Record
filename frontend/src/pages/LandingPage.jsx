import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/LandingPage.css';

/* ──────────────────────────────────────────────────────────────
   LANDING PAGE — Cinematic IP-Level Brand Page
   Tone: Minimal Luxury · Cinematic Drama · Founder Vision
   ────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const ctaRef = useRef(null);

  /* ── Login form state ── */
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  const [activeSection, setActiveSection] = useState('');
  const [navScrolled, setNavScrolled]     = useState(false);

  const navLinks = [
    { id: 'hero',        label: 'Home' },
    { id: 'problem',     label: 'The Problem' },
    { id: 'how-it-works',label: 'How It Works' },
    { id: 'engine',      label: 'The Engine' },
    { id: 'promise',     label: 'The Promise' },
    { id: 'built-for',   label: 'Built For' },
    { id: 'expansion',   label: 'Expansion' },
    { id: 'origin',      label: 'Origin' },
    { id: 'get-started', label: 'Get Started' },
  ];

  /* ── Scroll spy: highlight active section ── */
  useEffect(() => {
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 40);

      const offsets = navLinks.map(({ id }) => {
        const el = document.getElementById(id);
        if (!el) return { id, top: Infinity };
        return { id, top: el.getBoundingClientRect().top };
      });
      const current = offsets
        .filter(o => o.top <= 180)
        .sort((a, b) => b.top - a.top)[0];
      if (current) setActiveSection(current.id);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToCta = () => {
    ctaRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await login(email, password);
      setSuccess('Welcome.');
    } catch (err) {
      const status = err.response?.status;
      const serverMsg = err.response?.data?.message;
      let msg;
      if (serverMsg) {
        msg = serverMsg;
      } else if (!err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error')) {
        msg = 'Unable to reach the server. Please check your connection and try again.';
      } else if (status === 401) {
        msg = 'Invalid email or password. Please try again.';
      } else if (status === 429) {
        msg = 'Too many attempts. Please wait a moment and try again.';
      } else if (status >= 500) {
        msg = 'Server error. Please try again in a few moments.';
      } else {
        msg = 'Login failed. Please check your credentials and try again.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="lp">

      {/* ───────── NAV BAR ───────── */}
      <nav className={`lp-nav${navScrolled ? ' lp-nav--scrolled' : ''}`}>
        <div className="lp-nav__inner">
          <button
            className="lp-nav__brand"
            onClick={() => scrollTo('hero')}
          >
            Prime Studios
          </button>

          <ul className="lp-nav__links">
            {navLinks.map(({ id, label }) => (
              <li key={id}>
                <button
                  className={`lp-nav__link${activeSection === id ? ' active' : ''}`}
                  onClick={() => scrollTo(id)}
                >
                  {label}
                </button>
              </li>
            ))}
            <li className="lp-nav__login-li">
              <button
                className="lp-nav__login-btn"
                onClick={() => navigate('/login')}
              >
                Log In
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* ───────── §1 HERO ───────── */}
      <section className="lp-hero" id="hero">
        <div className="lp-hero__inner">
          <span className="lp-eyebrow">Prime Studios</span>
          <h1>
            Build your story.<br />
            Expand your brand.<br />
            Within a world that <em>remembers.</em>
          </h1>
          <p className="lp-hero__sub">
            A literary-first narrative platform where creators turn identity into story,
            and story into legacy.
          </p>
          <div className="lp-hero__cta">
            <button className="lp-btn lp-btn--primary" onClick={scrollToCta}>
              Start Building Your Universe
            </button>
            <a className="lp-btn lp-btn--ghost" href="#how-it-works">
              See How It Works
            </a>
          </div>
        </div>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §2 THE PROBLEM ───────── */}
      <section className="lp-section lp-section--narrow lp-problem" id="problem">
        <span className="lp-eyebrow">The Problem</span>
        <h2>
          Most creators build content.<br />
          Few build universes.
        </h2>
        <div className="lp-problem__lines">
          <p className="lp-problem__line">
            Creators burn out because they chase trends.
          </p>
          <p className="lp-problem__line">
            Writers stall because they lack structure.
          </p>
          <p className="lp-problem__line">
            Brands collapse because they don't have narrative cohesion.
          </p>
        </div>
        <p className="lp-problem__punchline">
          Prime Studios gives you the architecture behind becoming.
        </p>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §3 WHAT THIS IS ───────── */}
      <section className="lp-section lp-what" id="how-it-works">
        <span className="lp-eyebrow">What This Is</span>
        <h2>
          Not a writing app.<br />
          Not a game engine.
        </h2>
        <p className="lp-what__sub">A narrative operating system.</p>

        <div className="lp-pillars">
          <div className="lp-pillar">
            <span className="lp-pillar__icon">📖</span>
            <h3>Literary-First Canon Control</h3>
            <p>
              Define eras, world rules, and character arcs. Every decision is recorded.
              Every timeline is protected. Your canon is sovereign.
            </p>
          </div>
          <div className="lp-pillar">
            <span className="lp-pillar__icon">🎬</span>
            <h3>Multi-Format Expansion</h3>
            <p>
              Books → Shows → Interactive Experiences → Creator Tools.
              One universe, infinite expressions. Scale your IP without losing coherence.
            </p>
          </div>
          <div className="lp-pillar">
            <span className="lp-pillar__icon">🧠</span>
            <h3>Built-In Consequence Systems</h3>
            <p>
              Reputation. Economy. Evolution. Canon timeline. Your world doesn't just exist —
              it remembers, reacts, and compounds.
            </p>
          </div>
        </div>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §4 PRODUCT SHOWCASE ───────── */}
      <section className="lp-section lp-showcase" id="engine">
        <span className="lp-eyebrow">The Engine</span>
        <h2>See what you're building inside.</h2>

        <div className="lp-panels">
          {/* Panel 1 — Writing Room */}
          <div className="lp-panel">
            <div className="lp-panel__ui">
              <div className="lp-panel__ui-bar" />
              <div className="lp-panel__ui-bar" />
              <div className="lp-panel__ui-bar" />
              <div className="lp-panel__ui-bar" />
              <div className="lp-panel__ui-bar" />
            </div>
            <span className="lp-panel__label">StoryTeller</span>
            <span className="lp-panel__title">The Writing Room</span>
          </div>

          {/* Panel 2 — Universe Admin */}
          <div className="lp-panel">
            <div className="lp-panel__ui">
              <div className="lp-panel__ui-grid">
                <div className="lp-panel__ui-cell" />
                <div className="lp-panel__ui-cell" />
                <div className="lp-panel__ui-cell" />
                <div className="lp-panel__ui-cell" />
                <div className="lp-panel__ui-cell" />
                <div className="lp-panel__ui-cell" />
              </div>
            </div>
            <span className="lp-panel__label">Universe</span>
            <span className="lp-panel__title">World Administration</span>
          </div>

          {/* Panel 3 — Story Structure */}
          <div className="lp-panel">
            <div className="lp-panel__ui">
              <div className="lp-panel__ui-bar" style={{ width: '90%' }} />
              <div className="lp-panel__ui-bar" style={{ width: '65%', background: 'rgba(201,168,76,0.2)' }} />
              <div className="lp-panel__ui-bar" style={{ width: '45%' }} />
              <div className="lp-panel__ui-bar" style={{ width: '75%', background: 'rgba(123,94,167,0.2)' }} />
              <div className="lp-panel__ui-bar" style={{ width: '55%' }} />
            </div>
            <span className="lp-panel__label">Canon</span>
            <span className="lp-panel__title">Story Structure &amp; Arcs</span>
          </div>

          {/* Panel 4 — Evaluation Engine */}
          <div className="lp-panel">
            <div className="lp-panel__ui">
              <div className="lp-panel__ui-grid">
                <div className="lp-panel__ui-cell" style={{ background: 'rgba(201,168,76,0.08)' }} />
                <div className="lp-panel__ui-cell" />
                <div className="lp-panel__ui-cell" style={{ background: 'rgba(123,94,167,0.08)' }} />
                <div className="lp-panel__ui-cell" style={{ background: 'rgba(74,124,89,0.08)' }} />
                <div className="lp-panel__ui-cell" />
                <div className="lp-panel__ui-cell" style={{ background: 'rgba(201,168,76,0.08)' }} />
              </div>
            </div>
            <span className="lp-panel__label">Intelligence</span>
            <span className="lp-panel__title">Evaluation Engine</span>
          </div>
        </div>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §5 CORE PROMISE ───────── */}
      <section className="lp-section lp-section--narrow lp-promise" id="promise">
        <span className="lp-eyebrow">The Promise</span>
        <h2>Grow with Lala — help her rise, and rise with her.</h2>
        <div className="lp-promise__copy">
          <p>
            Prime Studios merges story, identity, and progression into one system.
          </p>
          <p>
            Your characters evolve. Your world remembers. Your universe compounds.
          </p>
          <p>
            This is not content creation.
          </p>
        </div>
        <span className="lp-promise__kicker">This is legacy design.</span>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §6 WHO IT'S FOR ───────── */}
      <section className="lp-section lp-section--narrow lp-audience" id="built-for">
        <span className="lp-eyebrow">Built For</span>
        <h2>Not everyone.</h2>
        <ul className="lp-audience__list">
          <li className="lp-audience__item">Story-driven creators</li>
          <li className="lp-audience__item">Literary world-builders</li>
          <li className="lp-audience__item">Interactive fiction designers</li>
          <li className="lp-audience__item">Fashion &amp; beauty narrative brands</li>
          <li className="lp-audience__item">Ambitious founders building IP</li>
        </ul>
        <p className="lp-audience__note">Clarity over volume.</p>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §7 EXPANSION PATH ───────── */}
      <section className="lp-section lp-expand" id="expansion">
        <span className="lp-eyebrow">How It Expands</span>
        <h2>One universe. Infinite formats.</h2>
        <div className="lp-expand__track">
          <div className="lp-expand__node">
            <div className="lp-expand__icon">📖</div>
            <span className="lp-expand__label">Book</span>
          </div>
          <span className="lp-expand__arrow">→</span>
          <div className="lp-expand__node">
            <div className="lp-expand__icon">📺</div>
            <span className="lp-expand__label">Show</span>
          </div>
          <span className="lp-expand__arrow">→</span>
          <div className="lp-expand__node">
            <div className="lp-expand__icon">🎮</div>
            <span className="lp-expand__label">Interactive</span>
          </div>
          <span className="lp-expand__arrow">→</span>
          <div className="lp-expand__node">
            <div className="lp-expand__icon">🛠</div>
            <span className="lp-expand__label">Creator&nbsp;Portal</span>
          </div>
          <span className="lp-expand__arrow">→</span>
          <div className="lp-expand__node">
            <div className="lp-expand__icon">📱</div>
            <span className="lp-expand__label">App</span>
          </div>
        </div>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §8 FOUNDER STORY ───────── */}
      <section className="lp-section lp-section--narrow lp-founder" id="origin">
        <div className="lp-founder__inner">
          <span className="lp-eyebrow">Origin</span>
          <blockquote className="lp-founder__quote">
            This began as a character in my head — a girl who refused to stay small.
            She wanted a world. So I built her one.
          </blockquote>
          <p className="lp-founder__body">
            What started as a story became a system. What started as one character became
            an entire universe with rules, consequence, and memory. I didn't set out to
            build a platform — I set out to answer a question most creators never ask:
            <em> What happens when your story remembers everything?</em>
          </p>
          <p className="lp-founder__body">
            Prime Studios is the answer. Not a tool. A foundation.
            For creators who feel it in their bones: <em>I'm meant to build something
            bigger than content.</em>
          </p>
          <span className="lp-founder__sig">— The Founder, Prime Studios</span>
        </div>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §9 FINAL CTA + EMBEDDED LOGIN ───────── */}
      <section className="lp-section lp-cta-section" id="get-started" ref={ctaRef}>
        <h2>Start Building Your Universe.</h2>
        <p className="lp-cta-section__sub">
          You don't need another platform.<br />
          You need a foundation.
        </p>

        {/* Embedded login card */}
        <div className="lp-login-card">
          <h3>Enter the Record</h3>
          <p className="lp-login-sub">Sign in to begin</p>

          {error && <div className="lp-login-alert lp-login-alert--error">{error}</div>}
          {success && <div className="lp-login-alert lp-login-alert--success">{success}</div>}

          <form onSubmit={handleLogin}>
            <div className="lp-form-group">
              <label htmlFor="lp-email">Email</label>
              <input
                id="lp-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className="lp-form-group">
              <label htmlFor="lp-password">Password</label>
              <div className="lp-pw-wrap">
                <input
                  id="lp-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="lp-pw-eye"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '◉' : '◎'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="lp-submit-btn"
              disabled={loading}
            >
              {loading ? 'Entering…' : 'Enter the Universe'}
            </button>
          </form>

          <p className="lp-login-help">
            Enter your credentials to access the canonical record
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <p className="lp-footer__text">
          © {new Date().getFullYear()} Prime Studios — Narrative Branding. Not random fiction.
        </p>
      </footer>

    </div>
  );
}
