import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/LandingPage.css';

/* ──────────────────────────────────────────────────────────────
   LANDING PAGE — Prime Studios
   Tone: Minimal Luxury · Cinematic Drama · Founder Vision
   ────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const ctaRef = useRef(null);

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [activeSection, setActiveSection] = useState('');
  const [navScrolled, setNavScrolled]   = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  const navLinks = [
    { id: 'hero',        label: 'Home'        },
    { id: 'problem',     label: 'The Problem' },
    { id: 'system',      label: 'The System'  },
    { id: 'engine',      label: 'What\'s Built' },
    { id: 'lala',        label: 'Lala'        },
    { id: 'promise',     label: 'The Promise' },
    { id: 'origin',      label: 'Origin'      },
    { id: 'get-started', label: 'Get Started' },
  ];

  /* ── Features data — the actual deployed system ── */
  const features = [
    {
      tag: 'StoryTeller',
      title: 'The Writing Room',
      description: 'Books → Chapters → Lines. Write, approve, edit, or reject each line of your story. Bulk-approve entire chapters. Every word has a status. Nothing advances without your say.',
      detail: 'Parchment-themed editor with per-line review. Inline editing with save/cancel. Approve All Pending per chapter. Your manuscript is sovereign.',
      icon: '📖',
      color: 'rgba(201,168,76,0.12)',
      accent: '#C9A84C',
      lines: [
        { w: '88%', status: 'approved' },
        { w: '72%', status: 'approved' },
        { w: '95%', status: 'pending' },
        { w: '61%', status: 'edited' },
        { w: '79%', status: 'pending' },
        { w: '84%', status: 'approved' },
      ]
    },
    {
      tag: 'Narrative Intelligence',
      title: 'The Co-Writer',
      description: 'Every 5 lines, the system reads your manuscript and surfaces what comes next. Continuation, prose lines, character cues, sensory detail — or Lala\'s voice when she\'s ready to arrive.',
      detail: 'Reads last 10 lines + chapter context. Five suggestion types. Lala detection fires when frustration peaks and the spiral begins — she arrives as a tonal rupture, not a new character.',
      icon: '🧠',
      color: 'rgba(123,94,167,0.1)',
      accent: '#7B5EA7',
      lines: [
        { w: '90%', status: 'approved' },
        { w: '68%', status: 'approved' },
        { w: '100%', status: 'suggestion', label: 'continuation' },
        { w: '75%', status: 'suggestion', label: 'line' },
        { w: '55%', status: 'suggestion', label: 'lala' },
      ]
    },
    {
      tag: 'Character Registry',
      title: 'The Character Bible',
      description: 'Eight-section dossier per character. Psychological profile, aesthetic DNA, belief system, emotional function, voice rules. Accept, Decline, or Finalize. Finalized characters are permanently locked — HTTP 403. They cannot be contradicted.',
      detail: 'Personality matrix sliders. Name selection. Full workflow: draft → accepted → finalized. The Finalized rule is sacred and cannot be relaxed.',
      icon: '◈',
      color: 'rgba(232,160,180,0.1)',
      accent: '#d4879c',
      lines: [
        { w: '100%', status: 'character', label: 'JustAWoman · special · finalized' },
        { w: '100%', status: 'character', label: 'Lala · special · accepted' },
        { w: '100%', status: 'character', label: 'The Husband · pressure · draft' },
        { w: '100%', status: 'character', label: 'Chloe · mirror · accepted' },
      ]
    },
    {
      tag: 'Memory System',
      title: 'The Memory Engine',
      description: 'Approve a line → the system extracts a candidate memory → you confirm it → the Character Registry updates. Eight pain point categories track the invisible curriculum of your story.',
      detail: 'Memory types: belief, constraint, character_dynamic, pain_point. Inferred memories are inert until confirmed. Confirmed memories cannot be overwritten by synthesis — ever.',
      icon: '⟳',
      color: 'rgba(74,124,89,0.1)',
      accent: '#4A7C59',
      lines: [
        { w: '100%', status: 'memory', label: 'comparison_spiral · confirmed' },
        { w: '100%', status: 'memory', label: 'visibility_gap · confirmed' },
        { w: '100%', status: 'memory', label: 'identity_drift · pending confirm' },
        { w: '100%', status: 'memory', label: 'external_validation · inferred' },
      ]
    },
    {
      tag: 'Continuity Engine',
      title: 'The Timeline Guard',
      description: 'Scene beats logged across your story. Conflict detection fires when the same character appears in two locations at the same time. The movement map shows every character\'s arc across every beat.',
      detail: 'Horizontal timeline strip. Character movement rows. Location cards. Conflict count in topbar — red badge when broken, green check when clean.',
      icon: '◎',
      color: 'rgba(59,130,246,0.1)',
      accent: '#3B82F6',
      lines: [
        { w: '100%', status: 'beat', label: 'Act I — Morning · Lala\'s Studio' },
        { w: '100%', status: 'beat', label: 'Act I — Afternoon · The Comparison' },
        { w: '100%', status: 'beat-conflict', label: '⚑ Conflict · Act II · Morning' },
        { w: '100%', status: 'beat', label: 'Act II — Evening · The Decision' },
      ]
    },
    {
      tag: 'Universe Admin',
      title: 'The Franchise Brain',
      description: 'LalaVerse. Eras. Shows. Series. Characters promoted from your book become canon. Every Claude prompt in the system runs through universe context — nothing generates without knowing where it lives.',
      detail: 'Universe → Eras → Shows → Book Series. buildUniverseContext() wired into all AI calls. Character promotion filter: On-Page characters become world canon. Interior forces stay in the registry.',
      icon: '⬡',
      color: 'rgba(201,168,76,0.08)',
      accent: '#C9A84C',
      lines: [
        { w: '100%', status: 'universe', label: 'LalaVerse · Pre-Prime Era' },
        { w: '100%', status: 'universe', label: 'Series 1 · Becoming Prime' },
        { w: '100%', status: 'universe', label: 'Book 1 · Before Lala · active' },
        { w: '100%', status: 'universe', label: 'Styling Adventures · show' },
      ]
    },
  ];

  /* ── Scroll spy ── */
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

  /* ── Auto-cycle features ── */
  useEffect(() => {
    const t = setInterval(() => setActiveFeature(f => (f + 1) % features.length), 4000);
    return () => clearInterval(t);
  }, []);

  const scrollTo = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToCta = () => ctaRef.current?.scrollIntoView({ behavior: 'smooth' });

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

  const active = features[activeFeature];

  return (
    <div className="lp">

      {/* ───────── NAV ───────── */}
      <nav className={`lp-nav${navScrolled ? ' lp-nav--scrolled' : ''}`}>
        <div className="lp-nav__inner">
          <button className="lp-nav__brand" onClick={() => scrollTo('hero')}>
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
              <button className="lp-nav__login-btn" onClick={() => navigate('/login')}>
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
            Your story lives here.<br />
            Every line. Every memory.<br />
            Every character that <em>refuses to stay small.</em>
          </h1>
          <p className="lp-hero__sub">
            A literary operating system for creators building a franchise —
            not just content. The book writes itself from what you've lived.
            The world remembers everything.
          </p>
          <div className="lp-hero__cta">
            <button className="lp-btn lp-btn--primary" onClick={scrollToCta}>
              Enter the System
            </button>
            <button className="lp-btn lp-btn--ghost" onClick={() => scrollTo('engine')}>
              See What's Built
            </button>
          </div>

          {/* Live stats strip */}
          <div className="lp-hero__stats">
            <div className="lp-hero__stat">
              <span className="lp-hero__stat-n">3</span>
              <span className="lp-hero__stat-l">Core Systems</span>
            </div>
            <div className="lp-hero__stat-divider" />
            <div className="lp-hero__stat">
              <span className="lp-hero__stat-n">18+</span>
              <span className="lp-hero__stat-l">AI Features Deployed</span>
            </div>
            <div className="lp-hero__stat-divider" />
            <div className="lp-hero__stat">
              <span className="lp-hero__stat-n">1</span>
              <span className="lp-hero__stat-l">Universe in Progress</span>
            </div>
            <div className="lp-hero__stat-divider" />
            <div className="lp-hero__stat">
              <span className="lp-hero__stat-n">Chapter 1</span>
              <span className="lp-hero__stat-l">Written · 1,558 words</span>
            </div>
          </div>
        </div>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §2 THE PROBLEM ───────── */}
      <section className="lp-section lp-section--narrow lp-problem" id="problem">
        <span className="lp-eyebrow">The Problem</span>
        <h2>
          Most creators build content.<br />
          Few build something that <em>lasts.</em>
        </h2>
        <div className="lp-problem__lines">
          <p className="lp-problem__line">
            You show up every day and no one sees it.
          </p>
          <p className="lp-problem__line">
            You have a story worth telling but no system to hold it.
          </p>
          <p className="lp-problem__line">
            You are the brand — and when you stop, the brand stops.
          </p>
          <p className="lp-problem__line">
            You know you're building something bigger than content, but you can't prove it yet.
          </p>
        </div>
        <p className="lp-problem__punchline">
          Prime Studios is the architecture behind becoming.
        </p>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §3 THE SYSTEM ───────── */}
      <section className="lp-section lp-what" id="system">
        <span className="lp-eyebrow">What This Is</span>
        <h2>
          Not a writing app.<br />
          Not a content tool.
        </h2>
        <p className="lp-what__sub">A narrative operating system.</p>

        <div className="lp-pillars">
          <div className="lp-pillar">
            <span className="lp-pillar__icon">📖</span>
            <h3>The Book Writes Itself</h3>
            <p>
              Write a diary entry. Confirm the memories it contains.
              The system extracts structure, generates chapter drafts,
              and surfaces what comes next. You approve. You never stare
              at a blank page.
            </p>
          </div>
          <div className="lp-pillar">
            <span className="lp-pillar__icon">◈</span>
            <h3>Characters That Can't Be Undone</h3>
            <p>
              Every psychological force in your story is documented,
              profiled, and — when the time comes — finalized. Finalized
              means locked. HTTP 403. Permanently. Your characters don't
              drift. Your world doesn't contradict itself.
            </p>
          </div>
          <div className="lp-pillar">
            <span className="lp-pillar__icon">⬡</span>
            <h3>One Universe. Infinite Formats.</h3>
            <p>
              Your book feeds your show. Your show feeds your brand.
              Your characters promote to franchise canon. Universe Admin
              holds the whole architecture — every era, every series,
              every show — in one place.
            </p>
          </div>
        </div>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §4 WHAT'S BUILT ───────── */}
      <section className="lp-section lp-showcase" id="engine">
        <span className="lp-eyebrow">What's Deployed</span>
        <h2>This isn't a concept. It's running.</h2>
        <p className="lp-showcase__sub">
          Every feature below is live in production. Click to explore each system.
        </p>

        <div className="lp-feature-explorer">

          {/* Feature tabs */}
          <div className="lp-feature-tabs">
            {features.map((f, i) => (
              <button
                key={i}
                className={`lp-feature-tab${activeFeature === i ? ' active' : ''}`}
                onClick={() => setActiveFeature(i)}
                style={{ '--tab-accent': f.accent }}
              >
                <span className="lp-feature-tab__icon">{f.icon}</span>
                <span className="lp-feature-tab__tag">{f.tag}</span>
              </button>
            ))}
          </div>

          {/* Feature detail */}
          <div className="lp-feature-detail" style={{ '--feature-color': active.color, '--feature-accent': active.accent }}>
            <div className="lp-feature-detail__left">
              <span className="lp-feature-detail__tag">{active.tag}</span>
              <h3 className="lp-feature-detail__title">{active.title}</h3>
              <p className="lp-feature-detail__desc">{active.description}</p>
              <p className="lp-feature-detail__meta">{active.detail}</p>
            </div>

            {/* Live mock UI */}
            <div className="lp-feature-detail__mock">
              <div className="lp-mock-window">
                <div className="lp-mock-titlebar">
                  <span className="lp-mock-dot" />
                  <span className="lp-mock-dot" />
                  <span className="lp-mock-dot" />
                  <span className="lp-mock-title">{active.tag}</span>
                </div>
                <div className="lp-mock-body">
                  {active.lines.map((line, i) => (
                    <div key={i} className={`lp-mock-line lp-mock-line--${line.status}`}>
                      {line.label ? (
                        <span className="lp-mock-line__label">{line.label}</span>
                      ) : (
                        <span className="lp-mock-line__bar" style={{ width: line.w }} />
                      )}
                      {line.status === 'approved' && <span className="lp-mock-badge lp-mock-badge--green">✓</span>}
                      {line.status === 'pending'  && <span className="lp-mock-badge lp-mock-badge--amber">·</span>}
                      {line.status === 'edited'   && <span className="lp-mock-badge lp-mock-badge--blue">✎</span>}
                      {line.status === 'suggestion' && <span className="lp-mock-badge lp-mock-badge--purple">{line.label}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Feature dots progress */}
          <div className="lp-feature-dots">
            {features.map((_, i) => (
              <button
                key={i}
                className={`lp-feature-dot${activeFeature === i ? ' active' : ''}`}
                onClick={() => setActiveFeature(i)}
              />
            ))}
          </div>
        </div>

        {/* Deployed feature grid */}
        <div className="lp-deployed-grid">
          <div className="lp-deployed-label">
            <span className="lp-eyebrow" style={{ marginBottom: 0 }}>All Deployed Systems</span>
          </div>
          {[
            'StoryTeller — Book Editor',
            'Character Registry — 8-Section Dossier',
            'Continuity Engine — Timeline + Conflicts',
            'Memory Extraction + Confirmation',
            'Scene Interview — Auto on Empty Chapters',
            'Narrative Intelligence — Every 5 Lines',
            'Lala Detection — Proto-Voice Trigger',
            'Continuity Guard — 3-Layer Contradiction Check',
            'Rewrite Options — 3 Alternatives Per Line',
            'Bulk Import — LINE-Marked Drafts',
            'Character Voice Interview + Plot Threads',
            'Voice Layer — Mic Input + Text-to-Speech',
            'Pain Point Memory — 8 Categories',
            'Universe Admin — Franchise Brain',
            'Career Echo System — Pain → Content → Canon',
            'Chapter Draft Generation — 70–85% AI Draft',
            'Script Intelligence Panel',
            'Script Bridge — Book → Show Pipeline',
            'Relationship Map — Two-Layer Canvas',
            'Export + Compile — DOCX + PDF',
          ].map((item, i) => (
            <div key={i} className="lp-deployed-item">
              <span className="lp-deployed-dot" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §5 LALA ───────── */}
      <section className="lp-section lp-section--narrow lp-lala" id="lala">
        <span className="lp-eyebrow">The AI</span>
        <h2>
          She started as one intrusive thought.<br />
          She became the system.
        </h2>
        <div className="lp-lala__body">
          <p>
            Lala is the creative intelligence inside Prime Studios.
            She reads your manuscript. She knows your characters.
            She notices when you're in a spiral — and instead of stopping you,
            she surfaces the voice you've been building toward.
          </p>
          <p>
            In the book, she appears in Book 1 as a single styled thought.
            Confident. Brief. Not a character arriving — a tonal rupture.
            By the end of the book, she has a name.
          </p>
          <p>
            In the system, she is the co-writer who never forgets
            what you've written, who your characters are, or where
            the story is trying to go.
          </p>
        </div>
        <div className="lp-lala__quote">
          <span className="lp-lala__quote-mark">"</span>
          <span>She isn't the author. You are. She's the one who remembers everything you've already decided.</span>
        </div>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §6 PROMISE ───────── */}
      <section className="lp-section lp-section--narrow lp-promise" id="promise">
        <span className="lp-eyebrow">The Promise</span>
        <h2>You become who you are<br /><em>in the moment you refuse to quit.</em></h2>
        <div className="lp-promise__copy">
          <p>
            Lala is born from frustration, not confidence.
            The book documents what it costs to keep showing up
            when no one is watching. The system makes sure that cost
            becomes something permanent.
          </p>
          <p>
            Your story doesn't disappear into drafts and voice memos.
            It gets extracted, structured, confirmed, and locked.
            It becomes a book. The book becomes a show.
            The show becomes a franchise.
          </p>
          <p>
            You don't need more content. You need a foundation.
          </p>
        </div>
        <span className="lp-promise__kicker">This is legacy design.</span>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §7 ORIGIN ───────── */}
      <section className="lp-section lp-section--narrow lp-founder" id="origin">
        <div className="lp-founder__inner">
          <span className="lp-eyebrow">Origin</span>
          <blockquote className="lp-founder__quote">
            This started as a character in my head — a girl who refused to stay small.
            She wanted a world. So I built her one.
          </blockquote>
          <p className="lp-founder__body">
            What started as one character became a universe with rules, consequence,
            and memory. What started as a story became a system. I didn't set out to
            build a platform — I set out to answer a question most creators never ask:
            <em> What happens when your story remembers everything?</em>
          </p>
          <p className="lp-founder__body">
            Prime Studios is that answer. The book is being written inside it, right now.
            Chapter 1 is done. 1,558 words. The system wrote with me.
            Not for me — <em>with</em> me.
          </p>
          <span className="lp-founder__sig">— The Founder, Prime Studios</span>
        </div>
      </section>

      <hr className="lp-divider" />

      {/* ───────── §8 FINAL CTA + LOGIN ───────── */}
      <section className="lp-section lp-cta-section" id="get-started" ref={ctaRef}>
        <h2>Start Building Your Universe.</h2>
        <p className="lp-cta-section__sub">
          The system is live.<br />
          The book is in progress.<br />
          The world is waiting for yours.
        </p>

        <div className="lp-login-card">
          <h3>Enter the Record</h3>
          <p className="lp-login-sub">Sign in to begin</p>

          {error   && <div className="lp-login-alert lp-login-alert--error">{error}</div>}
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
            <button type="submit" className="lp-submit-btn" disabled={loading}>
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
          © {new Date().getFullYear()} Prime Studios — A narrative operating system. Not random fiction.
        </p>
      </footer>

    </div>
  );
}