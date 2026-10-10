/**
 * The public, logged-out landing page at / (docs/design/
 * 2026-10-landing-and-stylesheet.md Part 1). L3 (#2808) built the frame and
 * the hero; L4 (#2809) the flagship, world, studio, collaborate and closing
 * sections; L5 (#2810) Featured Production.
 *
 * Task #2822: the page reads the Website page's published media once from
 * the public endpoint (siteMedia.fetchPublicSlots) and each section uses
 * its slot when present, else the bundled default. Sections render at once
 * with their defaults and swap in the published media in the same boxes,
 * so nothing shifts while loading. `preview` (the signed-in /site-preview)
 * reads drafts too when ?drafts=1.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PublicSiteLayout from '../components/site/PublicSiteLayout';
import LandingHero from '../components/site/LandingHero';
import FlagshipShowSection from '../components/site/FlagshipShowSection';
import WorldPillars from '../components/site/WorldPillars';
import FeaturedScreening from '../components/site/FeaturedScreening';
import StudioOverview from '../components/site/StudioOverview';
import CollaborationSection from '../components/site/CollaborationSection';
import FinalCallToAction from '../components/site/FinalCallToAction';
import { SiteContentContext, fetchPreviewSlots, fetchPublicSlots } from '../components/site/siteMedia';

export default function PublicLanding({ preview = false }) {
  const [params] = useSearchParams();
  const drafts = preview && params.get('drafts') === '1';
  const [content, setContent] = useState({ slots: {}, loaded: false });

  useEffect(() => {
    let cancelled = false;
    (drafts ? fetchPreviewSlots() : fetchPublicSlots()).then((slots) => {
      if (!cancelled) setContent({ slots, loaded: true });
    });
    return () => { cancelled = true; };
  }, [drafts]);

  return (
    <SiteContentContext.Provider value={content}>
      <PublicSiteLayout>
        {preview && (
          <p className="site-preview-banner" role="status">
            {drafts ? 'Preview: drafts and published media, as only you can see them.' : 'Preview: the site as visitors see it.'}
          </p>
        )}
        <LandingHero />
        <FlagshipShowSection />
        <WorldPillars />
        <FeaturedScreening />
        <StudioOverview />
        <CollaborationSection />
        <FinalCallToAction />
      </PublicSiteLayout>
    </SiteContentContext.Provider>
  );
}
