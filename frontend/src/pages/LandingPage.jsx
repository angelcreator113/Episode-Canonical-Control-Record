import React from 'react';
import { Link } from 'react-router-dom';
import { Flower2, Moon, Sparkles } from 'lucide-react';
import '../styles/LandingPage.css';

/* ──────────────────────────────────────────────────────────────
   LANDING PAGE — Prime Studios
   "A universe, styled to perfection."
   ────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="lp">

      {/* ── Nav ── */}
      <nav className="lp-nav">
        <div className="lp-wrap lp-nav__inner">
          <div className="lp-brand">
            <span className="lp-brand__dot" />
            PRIME STUDIOS
          </div>
          <div className="lp-nav__links">
            <a href="#show">The show</a>
            <a href="#world">The world</a>
            <a href="#studio">The studio</a>
            <Link to="/login" className="lp-nav__cta lp-pill">Enter</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="lp-hero">
        <div className="lp-blob lp-blob--blush" />
        <div className="lp-blob lp-blob--lilac" />
        <div className="lp-blob lp-blob--sand" />
        <div className="lp-wrap lp-hero__content">
          <span className="lp-badge lp-pill">SEASON ONE · NOW IN PRODUCTION</span>
          <h1>A universe,<br /><em>styled</em> to perfection.</h1>
          <p className="lp-lede">
            Prime Studios is the home of the LalaVerse — an original animated
            franchise where fashion, story, and world are produced under one roof.
          </p>
          <a href="#show" className="lp-btn-primary lp-pill">Meet Lala</a>
          <a href="#world" className="lp-btn-ghost lp-pill">Watch the world grow</a>
        </div>
      </header>

      {/* ── The flagship ── */}
      <section className="lp-section lp-section--alt" id="show">
        <div className="lp-wrap">
          <p className="lp-eyebrow">The flagship</p>
          <h2>Styling Adventures with Lala</h2>
          <p className="lp-section__sub">
            A show where the wardrobe is a character, the calendar is a plot
            device, and every episode leaves the world a little more real.
          </p>
          <div className="lp-cards">
            <div className="lp-card lp-card--blush">
              <div className="lp-card__icon"><Flower2 size={24} /></div>
              <h3>Wardrobe as story</h3>
              <p>
                Every look is canon — outfits carry memory, mood, and meaning
                across episodes. Style isn't decoration here; it's narrative.
              </p>
            </div>
            <div className="lp-card lp-card--lilac">
              <div className="lp-card__icon"><Moon size={24} /></div>
              <h3>A living world</h3>
              <p>
                Cities, calendars, and characters that persist. The world
                remembers every episode — and so do the fans.
              </p>
            </div>
            <div className="lp-card lp-card--sand">
              <div className="lp-card__icon"><Sparkles size={24} /></div>
              <h3>Made in the atelier</h3>
              <p>
                Script to screen inside our own production platform,
                purpose-built for this universe and the ones after it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The screening room ── */}
      <section className="lp-section lp-screening" id="screening">
        <div className="lp-wrap">
          <p className="lp-eyebrow">The screening room</p>
          <h2>See the world <em>move.</em></h2>
          <p className="lp-screening__sub">
            A moment from the atelier — hand-picked, freshly cut, straight from production.
          </p>
          {/* Wire to featured clip API when available:
              GET /api/site/featured-clip → { url, poster_url, caption } */}
          <div className="lp-screening__frame">
            <div className="lp-screening__poster">
              <span className="lp-screening__play" aria-hidden="true" />
            </div>
          </div>
          <div className="lp-screening__caption">
            <span className="lp-screening__cut-tag">APPROVED CUT</span>
            <span>Episode 12 — "The Gala" · 0:42</span>
          </div>
        </div>
      </section>

      {/* ── The world (stats) ── */}
      <section className="lp-section" id="world">
        <div className="lp-wrap lp-stats">
          <div className="lp-stat">
            <div className="lp-stat__num">219</div>
            <div className="lp-stat__lbl">Production milestones</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat__num">140+</div>
            <div className="lp-stat__lbl">Canon story systems</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat__num">∞</div>
            <div className="lp-stat__lbl">Looks per universe</div>
          </div>
        </div>
      </section>

      {/* ── The studio ── */}
      <section className="lp-section lp-section--alt" id="studio">
        <div className="lp-wrap lp-split">
          <div>
            <p className="lp-eyebrow">Behind the curtain</p>
            <h2>Not just a show.<br /><em>A franchise operating system.</em></h2>
            <p className="lp-split__body">
              The LalaVerse runs on Prime Studios' own platform — episode
              orchestration, continuity intelligence, and living world state,
              engineered to scale from one show to many. We didn't rent our
              pipeline. We built it.
            </p>
          </div>
          <div className="lp-atelier">
            <div className="lp-atelier__dots">
              <span style={{ background: '#E8C4CE' }} />
              <span style={{ background: '#D5C6E8' }} />
              <span style={{ background: '#E0CDB4' }} />
            </div>
            <div className="lp-atelier__row">
              <span>Episode 12 — script locked</span>
              <span className="lp-tag lp-tag--canon">canon ✓</span>
            </div>
            <div className="lp-atelier__row">
              <span>Wardrobe — 3 looks staged</span>
              <span className="lp-tag lp-tag--styling">styling</span>
            </div>
            <div className="lp-atelier__row">
              <span>World event — gala scheduled</span>
              <span className="lp-tag lp-tag--calendar">calendar</span>
            </div>
            <div className="lp-atelier__row">
              <span>Continuity engine — all green</span>
              <span className="lp-tag lp-tag--canon">verified</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quote band ── */}
      <section className="lp-quote-band">
        <div className="lp-blob lp-blob--quote" />
        <div className="lp-wrap lp-quote-band__content">
          <blockquote>
            "We're not making episodes. We're growing a world — and the world
            keeps the receipts."
          </blockquote>
          <cite>— The Prime Studios atelier</cite>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-wrap lp-foot">
          <div className="lp-foot__brand">
            <p>Prime Studios</p>
            <p>The atelier of the LalaVerse.</p>
          </div>
          <div className="lp-foot__links">
            <span>Press</span>
            <span>Careers</span>
            <Link to="/login" className="lp-foot__cta">Enter the studio</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
