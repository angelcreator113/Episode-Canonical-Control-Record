/**
 * The public, logged-out landing page at / (docs/design/
 * 2026-10-landing-and-stylesheet.md Part 1). Static: it calls no API and
 * shows no private production data. L3 (#2808) built the frame and the
 * hero; L4 (#2809) the flagship, world, studio, collaborate and closing
 * sections. Featured Production (#2810) slots in after Our World.
 */
import PublicSiteLayout from '../components/site/PublicSiteLayout';
import LandingHero from '../components/site/LandingHero';
import FlagshipShowSection from '../components/site/FlagshipShowSection';
import WorldPillars from '../components/site/WorldPillars';
import StudioOverview from '../components/site/StudioOverview';
import CollaborationSection from '../components/site/CollaborationSection';
import FinalCallToAction from '../components/site/FinalCallToAction';

export default function PublicLanding() {
  return (
    <PublicSiteLayout>
      <LandingHero />
      <FlagshipShowSection />
      <WorldPillars />
      <StudioOverview />
      <CollaborationSection />
      <FinalCallToAction />
    </PublicSiteLayout>
  );
}
