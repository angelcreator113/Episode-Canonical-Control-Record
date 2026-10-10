/**
 * The public, logged-out landing page at / (docs/design/
 * 2026-10-landing-and-stylesheet.md Part 1). Static: it calls no API and
 * shows no private production data. L3 (#2808) builds the frame and the
 * hero; the flagship, world, featured, studio, collaborate and closing
 * sections follow in #2809 and #2810.
 */
import PublicSiteLayout from '../components/site/PublicSiteLayout';
import LandingHero from '../components/site/LandingHero';

export default function PublicLanding() {
  return (
    <PublicSiteLayout>
      <LandingHero />
    </PublicSiteLayout>
  );
}
