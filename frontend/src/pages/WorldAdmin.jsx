/**
 * WorldAdmin v2 — Producer Mode Dashboard
 * 
 * Route: /shows/:id/world
 * 
 * 5 Tabs:
 *   1. Overview — Stats, tier distribution, canon timeline
 *   2. Episode Ledger — All episodes with tier/score/deltas
 *   3. Events Library — Reusable event catalog (create, edit, inject)
 *   4. Characters — View/edit Lala stats, character rules, stat ledger
 *   5. Decision Log — Training data from creative decisions
 * 
 * Location: frontend/src/pages/WorldAdmin.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import './ShowDetail.css';

const STAT_ICONS = { coins: '🪙', reputation: '⭐', brand_trust: '🤝', influence: '📣', stress: '😰' };
const TIER_COLORS = { slay: '#FFD700', pass: '#22c55e', mid: '#eab308', fail: '#dc2626' };
const TIER_EMOJIS = { slay: '👑', pass: '✨', mid: '😐', fail: '💔' };
const EVENT_TYPE_ICONS = { invite: '💌', upgrade: '⬆️', guest: '🌟', fail_test: '💔', deliverable: '📦', brand_deal: '🤝' };
const EVENT_TYPES = ['invite', 'upgrade', 'guest', 'fail_test', 'deliverable', 'brand_deal'];
const BIAS_OPTIONS = ['balanced', 'glam', 'cozy', 'couture', 'trendy', 'romantic'];

const EMPTY_EVENT = {
  name: '', event_type: 'invite', host_brand: '', description: '',
  prestige: 5, cost_coins: 100, strictness: 5,
  deadline_type: 'medium', dress_code: '', location_hint: '',
  narrative_stakes: '', browse_pool_bias: 'balanced', browse_pool_size: 8,
  is_paid: false, payment_amount: 0, career_tier: 1,
  career_milestone: '', fail_consequence: '', success_unlock: '',
  requirements: {},
};

const CAREER_TIERS = [
  { value: 1, label: '1 — Emerging (Rep 0-2)', color: '#94a3b8' },
  { value: 2, label: '2 — Rising (Rep 3-4)', color: '#22c55e' },
  { value: 3, label: '3 — Established (Rep 5-6)', color: '#6366f1' },
  { value: 4, label: '4 — Influential (Rep 7-8)', color: '#eab308' },
  { value: 5, label: '5 — Elite (Rep 9-10)', color: '#dc2626' },
];

// ─── ALL 40 LALA CAREER EVENTS ───
const LALA_EVENTS = [
  // TIER 1: EMERGING (8 events)
  { name: 'Neighborhood Thrift Pop-Up', event_type: 'invite', prestige: 1, cost_coins: 0, strictness: 1, deadline_type: 'low', dress_code: 'casual street style', host_brand: 'Local Vintage Collective', location_hint: 'Converted warehouse, string lights, vinyl corner', narrative_stakes: 'Zero risk. Just show up and look cute.', career_tier: 1, career_milestone: 'First public appearance as a creator', fail_consequence: 'Nothing lost — low stakes intro', success_unlock: 'Community visibility begins', browse_pool_bias: 'cozy', is_paid: false, requirements: {} },
  { name: 'Cafe Grand Opening — "Bloom & Brew"', event_type: 'invite', prestige: 2, cost_coins: 0, strictness: 2, deadline_type: 'low', dress_code: 'aesthetic casual', host_brand: 'Bloom & Brew Coffee', location_hint: 'Pastel-walled cafe, dried flower arrangements, marble counters', narrative_stakes: 'Low. But the owner will remember if you flake.', career_tier: 1, career_milestone: 'First brand collaboration (even if tiny)', fail_consequence: 'Owner remembers flakers — no future invites', success_unlock: 'First brand tag and story feature', browse_pool_bias: 'cozy', is_paid: false, requirements: {}, description: 'Must post 1 story tagging the cafe' },
  { name: 'Content Girlies Meetup', event_type: 'guest', prestige: 2, cost_coins: 25, strictness: 2, deadline_type: 'none', dress_code: 'elevated casual', host_brand: 'Content Girlies Network', location_hint: 'Rooftop lounge, golden hour, city views', narrative_stakes: 'Networking. The connections here pay off 5 episodes later.', career_tier: 1, career_milestone: 'First creator community connection', fail_consequence: 'Missed networking — slower growth', success_unlock: 'Creator network unlocked', browse_pool_bias: 'trendy', is_paid: false, requirements: {} },
  { name: 'Local Boutique "Style Challenge"', event_type: 'invite', prestige: 2, cost_coins: 0, strictness: 3, deadline_type: 'medium', dress_code: 'boutique chic', host_brand: 'Maison Petite Boutique', location_hint: 'Small shop with exposed brick, curated racks, gold mirrors', narrative_stakes: 'Win = store credit + boutique repost. Lose = nothing lost.', career_tier: 1, career_milestone: 'First fashion-specific challenge', fail_consequence: 'Nothing lost — learning experience', success_unlock: 'Store credit (50 coins) + boutique repost', browse_pool_bias: 'glam', is_paid: false, requirements: {} },
  { name: 'Skincare Brand Product Testing', event_type: 'deliverable', prestige: 1, cost_coins: 0, strictness: 3, deadline_type: 'medium', dress_code: 'clean girl aesthetic', host_brand: 'Dew Drop Skincare', location_hint: 'Minimalist studio, white marble, plant walls', narrative_stakes: 'If content is good, they\'ll send more. If lazy, you\'re off the list.', career_tier: 1, career_milestone: 'First product-for-content exchange', fail_consequence: 'Removed from brand\'s gifting list', success_unlock: 'Recurring product partnerships', browse_pool_bias: 'balanced', is_paid: false, requirements: {} },
  { name: 'Street Style Photo Walk', event_type: 'invite', prestige: 1, cost_coins: 0, strictness: 1, deadline_type: 'none', dress_code: 'street style editorial', host_brand: 'Urban Lens Photography Club', location_hint: 'Graffiti alley, industrial bridges, golden hour streets', narrative_stakes: 'Pure investment. No reward except better content.', career_tier: 1, career_milestone: 'Portfolio building — content that elevates future pitches', fail_consequence: 'No penalty — self-investment opportunity', success_unlock: 'Stronger portfolio for future brand pitches', browse_pool_bias: 'trendy', is_paid: false, requirements: {} },
  { name: 'Farmer\'s Market "Creator Corner"', event_type: 'invite', prestige: 1, cost_coins: 0, strictness: 1, deadline_type: 'low', dress_code: 'cottage core / boho', host_brand: 'Sunday Market Collective', location_hint: 'Open-air market, wooden stalls, flower bouquets, honey jars', narrative_stakes: 'Wholesome. Good for brand personality content.', career_tier: 1, career_milestone: 'Community visibility — locals start recognizing her', fail_consequence: 'No penalty', success_unlock: 'Local community recognition', browse_pool_bias: 'cozy', is_paid: false, requirements: {} },
  { name: 'DIY Workshop — "Make Your Own Candle"', event_type: 'invite', prestige: 2, cost_coins: 30, strictness: 1, deadline_type: 'none', dress_code: 'cozy creative', host_brand: 'Wax & Wick Studio', location_hint: 'Warm studio, wooden tables, essential oils, soft music', narrative_stakes: 'Low cost, relaxing content. Shows range beyond fashion.', career_tier: 1, career_milestone: 'Lifestyle content diversification', fail_consequence: 'No penalty — personal enrichment', success_unlock: 'Lifestyle brand attention', browse_pool_bias: 'cozy', is_paid: false, requirements: {} },

  // TIER 2: RISING (8 events)
  { name: 'Velour Society Garden Soirée', event_type: 'invite', prestige: 5, cost_coins: 75, strictness: 5, deadline_type: 'low', dress_code: 'romantic garden casual', host_brand: 'Velour Society', location_hint: 'Sunlit courtyard garden, white linen tables, wisteria archways', narrative_stakes: 'Moderate. Success = future invites. Fail = they forget you.', career_tier: 2, career_milestone: 'First "society" invite — the world starts taking notice', fail_consequence: 'Forgotten by the society — no future invites', success_unlock: 'Society circle access + elevated brand attention', browse_pool_bias: 'romantic', is_paid: false, requirements: { reputation_min: 3 } },
  { name: 'Brand Gifting Suite — "Luxe Lounge"', event_type: 'brand_deal', prestige: 4, cost_coins: 0, strictness: 5, deadline_type: 'medium', dress_code: 'polished casual', host_brand: 'Multi-brand collective', location_hint: 'Hotel suite, velvet furniture, branded displays', narrative_stakes: 'Deliver quality = repeat invites. Low effort = blacklisted.', career_tier: 2, career_milestone: 'First multi-brand obligation — juggling deliverables', fail_consequence: 'Blacklisted from future gifting suites', success_unlock: 'Repeat brand invites + product worth ~200 coins', browse_pool_bias: 'glam', is_paid: true, payment_amount: 200, requirements: { reputation_min: 3 } },
  { name: 'Fashion Blogger Brunch', event_type: 'invite', prestige: 4, cost_coins: 50, strictness: 5, deadline_type: 'medium', dress_code: 'brunch elegance', host_brand: 'Style Collective Magazine', location_hint: 'Hotel restaurant, white tablecloths, champagne towers', narrative_stakes: 'The room is watching. Good impressions matter.', career_tier: 2, career_milestone: 'Sitting at the table with established creators', fail_consequence: 'Bad impression — slower industry ascent', success_unlock: 'Industry connections + magazine feature consideration', browse_pool_bias: 'glam', is_paid: false, requirements: { reputation_min: 3 } },
  { name: 'Local Magazine Cover Shoot Audition', event_type: 'fail_test', prestige: 5, cost_coins: 0, strictness: 7, deadline_type: 'high', dress_code: 'editorial versatile', host_brand: 'Metro Style Magazine', location_hint: 'Photography studio, backdrop changes, harsh lighting', narrative_stakes: 'HIGH. Fail = teaches resilience. Pass = career acceleration.', career_tier: 2, career_milestone: 'First audition — rejection is likely and important', fail_consequence: 'Teaches resilience — character development moment', success_unlock: 'Magazine cover + 150 coins + major credibility', browse_pool_bias: 'couture', is_paid: true, payment_amount: 150, requirements: { reputation_min: 3 } },
  { name: 'Fitness Brand Launch — "Move & Glow"', event_type: 'invite', prestige: 3, cost_coins: 0, strictness: 3, deadline_type: 'low', dress_code: 'athletic chic', host_brand: 'Move & Glow Activewear', location_hint: 'Rooftop yoga deck, sunrise lighting, smoothie bar', narrative_stakes: 'Low. But the photos tend to perform well on socials.', career_tier: 2, career_milestone: 'Cross-category content — shows versatility', fail_consequence: 'Missed viral content opportunity', success_unlock: 'Free activewear set + fitness brand access', browse_pool_bias: 'trendy', is_paid: false, requirements: {} },
  { name: 'Hair Salon VIP Preview Night', event_type: 'invite', prestige: 3, cost_coins: 0, strictness: 4, deadline_type: 'medium', dress_code: 'salon ready glamour', host_brand: 'Luxe Locks Salon', location_hint: 'Modern salon, neon accents, marble wash stations', narrative_stakes: 'Free glam + content. The salon gets tagged. Win-win.', career_tier: 2, career_milestone: 'Beauty industry entry point', fail_consequence: 'Missed beauty category expansion', success_unlock: 'Free blowout + beauty brand relationships', browse_pool_bias: 'glam', is_paid: false, requirements: {} },
  { name: 'Creator Economy Panel (Audience)', event_type: 'guest', prestige: 4, cost_coins: 40, strictness: 3, deadline_type: 'none', dress_code: 'smart casual professional', host_brand: 'CreateCon Local Chapter', location_hint: 'Co-working space, stage + seating, branded backdrop', narrative_stakes: 'Knowledge investment. Take notes, make connections.', career_tier: 2, career_milestone: 'Learning the business — future speaking opportunity', fail_consequence: 'No penalty — knowledge event', success_unlock: 'Future speaking invitation eligibility', browse_pool_bias: 'balanced', is_paid: false, requirements: {} },
  { name: 'Seasonal Window Display Collaboration', event_type: 'deliverable', prestige: 4, cost_coins: 0, strictness: 6, deadline_type: 'high', dress_code: 'theme-appropriate', host_brand: 'Heritage Department Store', location_hint: 'Storefront window, themed props, dramatic lighting', narrative_stakes: 'Deadline-driven. Quality matters. Portfolio piece.', career_tier: 2, career_milestone: 'First paid creative direction gig', fail_consequence: 'Missed deadline damages professional reputation', success_unlock: '100 coins + portfolio piece + store relationship', browse_pool_bias: 'couture', is_paid: true, payment_amount: 100, requirements: { reputation_min: 3 } },

  // TIER 3: ESTABLISHED (8 events)
  { name: 'Fashion Week Satellite Show', event_type: 'invite', prestige: 6, cost_coins: 100, strictness: 7, deadline_type: 'high', dress_code: 'avant-garde editorial', host_brand: 'Emerging Designers Collective', location_hint: 'Industrial venue, runway, front row seating', narrative_stakes: 'High. The photos will define her brand for months.', career_tier: 3, career_milestone: 'Fashion Week adjacent — the real industry notices', fail_consequence: 'Poor showing — industry takes note negatively', success_unlock: 'Fashion week press credentials + designer connections', browse_pool_bias: 'couture', is_paid: false, requirements: { reputation_min: 5 } },
  { name: 'Brand Ambassador Trial — "Maison Belle"', event_type: 'brand_deal', prestige: 6, cost_coins: 0, strictness: 7, deadline_type: 'high', dress_code: 'brand-aligned luxury casual', host_brand: 'Maison Belle', location_hint: 'Brand showroom, curated displays, personal stylist', narrative_stakes: 'CRITICAL. Success = recurring income. Fail = brand drops you.', career_tier: 3, career_milestone: 'First ambassador trial — long-term deal potential', fail_consequence: 'Brand drops you — reputation hit with luxury sector', success_unlock: 'Recurring income (200 coins/episode) + long-term deal', browse_pool_bias: 'couture', is_paid: true, payment_amount: 200, requirements: { reputation_min: 5, brand_trust_min: 4 } },
  { name: 'Rooftop Sunset Soirée', event_type: 'invite', prestige: 6, cost_coins: 120, strictness: 7, deadline_type: 'medium', dress_code: 'sunset glamour', host_brand: 'Luxe Events Group', location_hint: 'Penthouse rooftop, infinity pool, DJ, golden hour', narrative_stakes: 'Be seen, be remembered, or be forgotten.', career_tier: 3, career_milestone: 'A-list adjacent — rubbing shoulders with bigger names', fail_consequence: 'Forgotten — missed networking at elite level', success_unlock: 'A-list connections + VIP event invites', browse_pool_bias: 'glam', is_paid: false, requirements: { reputation_min: 5 } },
  { name: 'Podcast Guest Appearance', event_type: 'guest', prestige: 5, cost_coins: 0, strictness: 4, deadline_type: 'medium', dress_code: 'polished but authentic', host_brand: '"Style & Substance" Podcast', location_hint: 'Studio, ring lights, podcast mics, cozy set', narrative_stakes: 'If she\'s boring, the episode gets buried. If she shines, it circulates.', career_tier: 3, career_milestone: 'Voice authority — not just visuals, but ideas', fail_consequence: 'Episode buried — no audience growth from appearance', success_unlock: 'Exposure to 50K audience + thought leader credibility', browse_pool_bias: 'balanced', is_paid: false, requirements: { reputation_min: 4 } },
  { name: 'Sustainable Fashion Gala', event_type: 'invite', prestige: 6, cost_coins: 100, strictness: 7, deadline_type: 'high', dress_code: 'eco-luxury couture', host_brand: 'Green Thread Foundation', location_hint: 'Botanical garden venue, reclaimed materials decor, earth tones', narrative_stakes: 'The fashion world is watching sustainability. This positions her.', career_tier: 3, career_milestone: 'Values-aligned content — attracts conscious brands', fail_consequence: 'Greenwashing accusations if outfit isn\'t sustainable', success_unlock: 'Conscious brand partnerships + ethical fashion access', browse_pool_bias: 'couture', is_paid: false, requirements: { reputation_min: 5 } },
  { name: 'Creator House Weekend', event_type: 'invite', prestige: 5, cost_coins: 75, strictness: 4, deadline_type: 'low', dress_code: 'versatile content wardrobe (3 days)', host_brand: 'Hype House Collective', location_hint: 'Rented villa, pool, content stations, ring light everywhere', narrative_stakes: '3 days of content opportunity. Lazy = waste. Productive = goldmine.', career_tier: 3, career_milestone: 'Creator ecosystem immersion — alliances form here', fail_consequence: 'Wasted opportunity — no content from 3-day event', success_unlock: 'Creator alliances + 3 days of premium content', browse_pool_bias: 'trendy', is_paid: false, requirements: { reputation_min: 4 } },
  { name: 'Jewelry Brand Private Viewing', event_type: 'invite', prestige: 6, cost_coins: 0, strictness: 6, deadline_type: 'medium', dress_code: 'minimal elegant', host_brand: 'Lumière Fine Jewelry', location_hint: 'Private showroom, velvet cases, soft spotlighting', narrative_stakes: 'Handle the pieces well = future loans. Damage = reputation hit.', career_tier: 3, career_milestone: 'Luxury adjacent — trust unlocks higher-tier product loans', fail_consequence: 'Reputation hit — luxury brands reconsider', success_unlock: 'Luxury product loans for future content', browse_pool_bias: 'glam', is_paid: false, requirements: { reputation_min: 5, brand_trust_min: 4 } },
  { name: 'Industry Awards — Best Emerging Creator', event_type: 'invite', prestige: 7, cost_coins: 150, strictness: 8, deadline_type: 'high', dress_code: 'red carpet formal', host_brand: 'Digital Creator Awards', location_hint: 'Ballroom, red carpet, step-and-repeat, photographers', narrative_stakes: 'RED CARPET. Every photo will be scrutinized. Slay or be memed.', career_tier: 3, career_milestone: 'Awards recognition — legitimizes the career', fail_consequence: 'Memed for bad outfit — viral for wrong reasons', success_unlock: 'Industry legitimacy + luxury brand attention', browse_pool_bias: 'couture', is_paid: false, requirements: { reputation_min: 5 } },

  // TIER 4: INFLUENTIAL (8 events)
  { name: 'Luxury Brand Launch Party', event_type: 'invite', prestige: 8, cost_coins: 200, strictness: 9, deadline_type: 'high', dress_code: 'black tie couture', host_brand: 'Noir et Or Fashion House', location_hint: 'Grand ballroom, crystal chandeliers, champagne towers', narrative_stakes: 'MAXIMUM. This room decides future opportunities.', career_tier: 4, career_milestone: 'The big leagues. Luxury brands know her name.', fail_consequence: 'Major reputation damage — luxury doors close', success_unlock: 'Luxury brand partnerships + global visibility', browse_pool_bias: 'couture', is_paid: false, requirements: { reputation_min: 7, brand_trust_min: 5 } },
  { name: 'International Fashion Week — Front Row', event_type: 'invite', prestige: 8, cost_coins: 250, strictness: 9, deadline_type: 'high', dress_code: 'high fashion editorial', host_brand: 'Paris/Milan/NY Fashion Council', location_hint: 'Grand venue, runway, international press, front row', narrative_stakes: 'The photos from this event live forever. No pressure.', career_tier: 4, career_milestone: 'Global stage — content reaches international audiences', fail_consequence: 'Poor front-row showing — industry whispers', success_unlock: 'International audience + global press coverage', browse_pool_bias: 'couture', is_paid: false, requirements: { reputation_min: 7 } },
  { name: 'Brand Creative Director Meeting', event_type: 'brand_deal', prestige: 7, cost_coins: 0, strictness: 6, deadline_type: 'medium', dress_code: 'power professional', host_brand: 'Maison Belle', location_hint: 'Corporate office, glass conference room, mood boards on walls', narrative_stakes: 'This meeting determines if she gets a long-term deal or stays freelance.', career_tier: 4, career_milestone: 'From ambassador to creative partner', fail_consequence: 'Stays freelance — no retainer deal', success_unlock: '500 coins retainer + creative director role', browse_pool_bias: 'balanced', is_paid: true, payment_amount: 500, requirements: { reputation_min: 7, brand_trust_min: 6 } },
  { name: 'Exclusive Fragrance Launch — "Midnight Bloom"', event_type: 'invite', prestige: 7, cost_coins: 150, strictness: 7, deadline_type: 'high', dress_code: 'romantic dark luxury', host_brand: 'Midnight Bloom Perfumerie', location_hint: 'Candlelit garden, midnight blue velvet, gold accents', narrative_stakes: 'The fragrance world is intimate. Impress here = lifetime invites.', career_tier: 4, career_milestone: 'Sensory brand partnerships — beyond visual content', fail_consequence: 'Missed entry to fragrance/beauty luxury sector', success_unlock: 'Gifted fragrance collection + lifetime invites', browse_pool_bias: 'romantic', is_paid: false, requirements: { reputation_min: 6 } },
  { name: 'Charity Gala — Creator Table Host', event_type: 'invite', prestige: 8, cost_coins: 200, strictness: 8, deadline_type: 'high', dress_code: 'gala formal', host_brand: 'Hearts of Gold Foundation', location_hint: 'Historic mansion, orchestra, auction, formal dining', narrative_stakes: 'High society. The table she hosts reflects her judgment.', career_tier: 4, career_milestone: 'Social responsibility — brand becomes about more than fashion', fail_consequence: 'Poor table hosting — social circles question judgment', success_unlock: 'Philanthropy credibility + high society connections', browse_pool_bias: 'couture', is_paid: false, requirements: { reputation_min: 7, influence_min: 6 } },
  { name: 'Magazine Feature — 5-Page Editorial Shoot', event_type: 'deliverable', prestige: 8, cost_coins: 0, strictness: 8, deadline_type: 'high', dress_code: 'editorial — stylist-directed', host_brand: 'Vogue Adjacent Magazine', location_hint: 'Multiple locations, professional crew, all-day shoot', narrative_stakes: 'This goes to print. Permanent. No retakes.', career_tier: 4, career_milestone: 'Print feature — the old guard acknowledges the new', fail_consequence: 'Unflattering print feature — permanent record', success_unlock: '400 coins + print legitimacy + old guard respect', browse_pool_bias: 'couture', is_paid: true, payment_amount: 400, requirements: { reputation_min: 7 } },
  { name: 'Tech x Fashion Crossover Summit', event_type: 'guest', prestige: 7, cost_coins: 100, strictness: 5, deadline_type: 'medium', dress_code: 'futuristic smart', host_brand: 'Innovation & Style Conference', location_hint: 'Modern convention center, LED walls, interactive displays', narrative_stakes: 'Speaking opportunity. If invited to panel = major credibility boost.', career_tier: 4, career_milestone: 'Industry thought leader — not just a pretty face', fail_consequence: 'Missed thought leadership positioning', success_unlock: 'Panel speaker invitation + tech brand partnerships', browse_pool_bias: 'trendy', is_paid: false, requirements: { reputation_min: 6 } },
  { name: 'Private Island Brand Retreat', event_type: 'invite', prestige: 8, cost_coins: 0, strictness: 6, deadline_type: 'low', dress_code: 'resort luxury (5 days)', host_brand: 'Oceana Luxury Resorts', location_hint: 'Private island, overwater villas, white sand, turquoise water', narrative_stakes: '5 days, 5 creators. Content output must be exceptional.', career_tier: 4, career_milestone: 'Elite tier unlocked — she\'s in the smallest rooms now', fail_consequence: 'Lazy content = never invited to exclusive retreats again', success_unlock: 'All expenses + 300 coins + elite creator circle access', browse_pool_bias: 'glam', is_paid: true, payment_amount: 300, requirements: { reputation_min: 7, influence_min: 7 } },

  // TIER 5: ELITE (8 events)
  { name: 'Haute Couture Private Showing', event_type: 'invite', prestige: 9, cost_coins: 300, strictness: 10, deadline_type: 'high', dress_code: 'couture only (pieces provided)', host_brand: 'Maison Lumière Haute Couture', location_hint: 'Private atelier, hand-stitched pieces on display, champagne', narrative_stakes: 'One wrong move and you\'re never invited back.', career_tier: 5, career_milestone: 'The highest fashion tier — invited by the house itself', fail_consequence: 'Permanently blacklisted from the house', success_unlock: 'Couture house relationship + custom pieces', browse_pool_bias: 'couture', is_paid: false, requirements: { reputation_min: 9, brand_trust_min: 8 } },
  { name: 'Global Creator Summit — Keynote Speaker', event_type: 'guest', prestige: 9, cost_coins: 0, strictness: 8, deadline_type: 'high', dress_code: 'power elegant', host_brand: 'World Creator Alliance', location_hint: 'Grand theater, 5000-seat audience, live-streamed globally', narrative_stakes: 'Career-defining moment. This speech gets referenced for years.', career_tier: 5, career_milestone: 'Global voice — she speaks, the industry listens', fail_consequence: 'Forgettable speech — momentum stalls', success_unlock: '1000 coins speaker fee + global thought leader status', browse_pool_bias: 'balanced', is_paid: true, payment_amount: 1000, requirements: { reputation_min: 9, influence_min: 8 } },
  { name: 'The Celestial Ball', event_type: 'invite', prestige: 10, cost_coins: 500, strictness: 10, deadline_type: 'urgent', dress_code: 'theme couture (custom piece required)', host_brand: 'The Celestial Foundation', location_hint: 'Grand museum, theme installations, every camera in the world', narrative_stakes: 'ULTIMATE. This defines legacy.', career_tier: 5, career_milestone: 'THE event. If you\'re here, you\'ve made it.', fail_consequence: 'Fashion disaster on the world stage — career rehab needed', success_unlock: 'Legacy status + permanent fashion icon recognition', browse_pool_bias: 'couture', is_paid: false, requirements: { reputation_min: 10, brand_trust_min: 9 } },
  { name: 'Luxury Brand Co-Design Collection Launch', event_type: 'brand_deal', prestige: 9, cost_coins: 0, strictness: 9, deadline_type: 'high', dress_code: 'the collection itself', host_brand: 'Noir et Or x Lala Collaboration', location_hint: 'Flagship store, her name on the window, press event', narrative_stakes: 'Her reputation is literally on every tag. Quality is everything.', career_tier: 5, career_milestone: 'From creator to designer — her name IS the brand', fail_consequence: 'Collection flops — brand trust devastated', success_unlock: '2000 coins + royalties + designer credibility', browse_pool_bias: 'couture', is_paid: true, payment_amount: 2000, requirements: { reputation_min: 9, brand_trust_min: 8 } },
  { name: 'Documentary Feature — "The Rise"', event_type: 'deliverable', prestige: 9, cost_coins: 0, strictness: 5, deadline_type: 'low', dress_code: 'authentic — no costume', host_brand: 'Streaming Platform Original', location_hint: 'Multiple — her apartment, studios, events, hometown', narrative_stakes: 'Vulnerability required. Authenticity or it feels hollow.', career_tier: 5, career_milestone: 'Her story becomes content. Meta-narrative achieved.', fail_consequence: 'Hollow documentary — audience disconnects', success_unlock: '800 coins + streaming audience + authentic brand story', browse_pool_bias: 'balanced', is_paid: true, payment_amount: 800, requirements: { reputation_min: 9 } },
  { name: 'Philanthropy Launch — "Lala\'s Closet Foundation"', event_type: 'deliverable', prestige: 8, cost_coins: 200, strictness: 6, deadline_type: 'medium', dress_code: 'professional warmth', host_brand: 'Self-founded', location_hint: 'Community center, donated clothing racks, press coverage', narrative_stakes: 'This is her legacy play. Execution must be flawless.', career_tier: 5, career_milestone: 'Giving back — the brand transcends fashion', fail_consequence: 'Poor execution damages philanthropic credibility', success_unlock: 'Legacy beyond fashion + community impact', browse_pool_bias: 'cozy', is_paid: false, requirements: { reputation_min: 8, influence_min: 7 } },
  { name: 'International Cover Shoot — 3 Countries, 3 Covers', event_type: 'deliverable', prestige: 10, cost_coins: 0, strictness: 9, deadline_type: 'high', dress_code: 'varies by country — editorial directed', host_brand: 'Global Fashion Consortium', location_hint: 'Paris, Tokyo, New York — iconic locations per city', narrative_stakes: 'Three covers. Three cities. Three chances to define a global image.', career_tier: 5, career_milestone: 'International icon status', fail_consequence: 'Inconsistent covers — global image fragmented', success_unlock: '1500 coins + international icon status', browse_pool_bias: 'couture', is_paid: true, payment_amount: 1500, requirements: { reputation_min: 10, brand_trust_min: 9 } },
  { name: 'Legacy Award — Lifetime Achievement Ceremony', event_type: 'invite', prestige: 10, cost_coins: 0, strictness: 5, deadline_type: 'none', dress_code: 'legacy couture — her signature look', host_brand: 'Fashion & Culture Academy', location_hint: 'Grand opera house, orchestra, video retrospective, standing ovation', narrative_stakes: 'This is the final episode. Make it count.', career_tier: 5, career_milestone: 'THE END. She did it. From thrift shops to the opera house.', fail_consequence: 'None — this is the culmination', success_unlock: 'Story complete. Legacy secured.', browse_pool_bias: 'couture', is_paid: false, requirements: { reputation_min: 10 } },
];

const TABS = [
  { key: 'overview', icon: '📊', label: 'Overview' },
  { key: 'episodes', icon: '📋', label: 'Episode Ledger' },
  { key: 'events', icon: '💌', label: 'Events Library' },
  { key: 'characters', icon: '👑', label: 'Characters' },
  { key: 'decisions', icon: '🧠', label: 'Decision Log' },
];

function WorldAdmin() {
  const { id: showId } = useParams();

  const [show, setShow] = useState(null);
  const [charState, setCharState] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [stateHistory, setStateHistory] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [worldEvents, setWorldEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Event editor state
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventForm, setEventForm] = useState({ ...EMPTY_EVENT });
  const [savingEvent, setSavingEvent] = useState(false);
  const [injectTarget, setInjectTarget] = useState(null);
  const [generateTarget, setGenerateTarget] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generatedScript, setGeneratedScript] = useState(null);
  const [seeding, setSeeding] = useState(false);

  // Character editor state
  const [editingStats, setEditingStats] = useState(false);
  const [statForm, setStatForm] = useState({});
  const [savingStats, setSavingStats] = useState(false);

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => { loadData(); }, [showId]);
  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(null), 3000); return () => clearTimeout(t); }
  }, [successMsg]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.allSettled([
        api.get(`/api/v1/shows/${showId}`).then(r => setShow(r.data?.data || r.data)).catch(() => setShow({ id: showId, title: 'Show' })),
        api.get(`/api/v1/characters/lala/state?show_id=${showId}`).then(r => setCharState(r.data)).catch(() => {}),
        api.get(`/api/v1/episodes?show_id=${showId}&limit=100`).then(r => {
          const list = r.data?.episodes || r.data?.data || r.data || [];
          setEpisodes(Array.isArray(list) ? list : []);
        }).catch(() => setEpisodes([])),
        api.get(`/api/v1/world/${showId}/history`).then(r => setStateHistory(r.data?.history || [])).catch(() => setStateHistory([])),
        api.get(`/api/v1/world/${showId}/decisions`).then(r => setDecisions(r.data?.decisions || [])).catch(() => setDecisions([])),
        api.get(`/api/v1/world/${showId}/events`).then(r => setWorldEvents(r.data?.events || [])).catch(() => setWorldEvents([])),
      ]);
    } finally { setLoading(false); }
  };

  // ─── EVENT CRUD ───
  const openNewEvent = () => { setEventForm({ ...EMPTY_EVENT }); setEditingEvent('new'); };
  const openEditEvent = (ev) => { setEventForm({ ...EMPTY_EVENT, ...ev }); setEditingEvent(ev.id); };

  const saveEvent = async () => {
    setSavingEvent(true); setError(null);
    try {
      if (editingEvent === 'new') {
        const res = await api.post(`/api/v1/world/${showId}/events`, eventForm);
        if (res.data.success) { setWorldEvents(p => [res.data.event, ...p]); setEditingEvent(null); setSuccessMsg('Event created!'); }
      } else {
        const res = await api.put(`/api/v1/world/${showId}/events/${editingEvent}`, eventForm);
        if (res.data.success) { setWorldEvents(p => p.map(e => e.id === editingEvent ? res.data.event : e)); setEditingEvent(null); setSuccessMsg('Event updated!'); }
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setSavingEvent(false); }
  };

  const deleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event?')) return;
    try { await api.delete(`/api/v1/world/${showId}/events/${eventId}`); setWorldEvents(p => p.filter(e => e.id !== eventId)); setSuccessMsg('Deleted'); }
    catch (err) { setError(err.response?.data?.error || err.message); }
  };

  const injectEvent = async (eventId, episodeId) => {
    try {
      setSuccessMsg(null);
      setError(null);
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/inject`, { episode_id: episodeId });
      const d = res.data;
      if (d.success) {
        setWorldEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, status: 'used', used_in_episode_id: episodeId, times_used: (ev.times_used || 0) + 1 } : ev));
        setSuccessMsg(`✅ Injected! ${d.event_tag}`);
        setInjectTarget(null);
      } else {
        setError(d.error || d.message || 'Inject returned unexpected response');
      }
    } catch (err) {
      console.error('Inject error:', err);
      setError(err.response?.data?.error || err.response?.data?.message || err.message);
    }
  };

  const generateScript = async (eventId, episodeId) => {
    setGenerating(true); setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/${eventId}/generate-script`, { episode_id: episodeId });
      if (res.data.success) {
        setGeneratedScript({ script: res.data.script, event_name: res.data.event_name, beat_count: res.data.beat_count, line_count: res.data.line_count });
        setGenerateTarget(null);
      } else {
        setError(res.data.error || 'Generation returned no script');
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setGenerating(false); }
  };

  const seedEvents = async () => {
    if (!window.confirm('Seed all 40 Lala Career Events? This will add events to the library.')) return;
    setSeeding(true); setError(null);
    try {
      const res = await api.post(`/api/v1/world/${showId}/events/bulk-seed`, { events: LALA_EVENTS });
      if (res.data.success) {
        setSuccessMsg(`Seeded ${res.data.created_count} events!`);
        loadData();
      }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setSeeding(false); }
  };

  // ─── CHARACTER STAT EDIT ───
  const openStatEditor = () => { setStatForm({ ...charState?.state }); setEditingStats(true); };
  const saveStats = async () => {
    setSavingStats(true); setError(null);
    try {
      const res = await api.post(`/api/v1/characters/lala/state/update`, { show_id: showId, ...statForm, source: 'manual', notes: 'Manual edit from World Admin' });
      if (res.data.success) { setCharState(p => ({ ...p, state: res.data.state })); setEditingStats(false); setSuccessMsg('Stats updated!'); }
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setSavingStats(false); }
  };

  // ─── DERIVED ───
  const acceptedEpisodes = episodes.filter(ep => ep.evaluation_status === 'accepted');
  const tierCounts = acceptedEpisodes.reduce((acc, ep) => {
    const tier = ep.evaluation_json?.tier_final; if (tier) acc[tier] = (acc[tier] || 0) + 1; return acc;
  }, {});
  const overrideCount = acceptedEpisodes.filter(ep => (ep.evaluation_json?.overrides || []).length > 0).length;

  if (loading) return <div style={S.page}><div style={S.center}>Loading world data...</div></div>;

  return (
    <div style={S.page}>
      {/* ─── HEADER ─── */}
      <div style={S.header}>
        <div>
          <Link to={`/shows/${showId}`} style={S.backLink}>← Back to Show</Link>
          <h1 style={S.title}>🌍 Producer Mode</h1>
          <p style={S.subtitle}>{show?.title || 'Show'} — World Rules &amp; Canon</p>
        </div>
        <button onClick={loadData} style={S.refreshBtn}>🔄 Refresh</button>
      </div>

      {error && <div style={S.errorBanner}>{error}<button onClick={() => setError(null)} style={S.xBtn}>✕</button></div>}
      {successMsg && <div style={S.successBanner}>{successMsg}</div>}

      {/* ─── GENERATED SCRIPT PREVIEW ─── */}
      {generatedScript && (
        <div style={S.scriptOverlay}>
          <div style={S.scriptModal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>📝 Generated Script — {generatedScript.event_name}</h2>
              <button onClick={() => setGeneratedScript(null)} style={S.xBtn}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <span style={{ padding: '4px 10px', background: '#eef2ff', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#6366f1' }}>🎬 {generatedScript.beat_count} beats</span>
              <span style={{ padding: '4px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#16a34a' }}>📄 {generatedScript.line_count} lines</span>
              <button onClick={() => { navigator.clipboard.writeText(generatedScript.script); setSuccessMsg('Script copied to clipboard!'); }} style={{ padding: '4px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#475569' }}>📋 Copy</button>
            </div>
            <pre style={S.scriptPre}>{generatedScript.script}</pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setGeneratedScript(null)} style={S.secBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TABS ─── */}
      <div className="tab-navigation">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`tab-button ${activeTab === t.key ? 'active' : ''}`}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ════════════════════════ OVERVIEW ════════════════════════ */}
      {activeTab === 'overview' && (
        <div style={S.content}>
          <div style={S.card}>
            <h2 style={S.cardTitle}>👑 Lala's Current State</h2>
            {charState ? (
              <div style={S.statsRow}>
                {Object.entries(charState.state || {}).map(([k, v]) => (
                  <div key={k} style={S.statBox}>
                    <div style={{ fontSize: 22 }}>{STAT_ICONS[k]}</div>
                    <div style={S.statVal(k, v)}>{v}</div>
                    <div style={S.statLbl}>{k.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
            ) : <p style={S.muted}>No state yet. Evaluate an episode to initialize.</p>}
          </div>

          <div style={S.qGrid}>
            {[{ v: episodes.length, l: 'Episodes' }, { v: acceptedEpisodes.length, l: 'Evaluated' }, { v: overrideCount, l: 'Overrides' }, { v: worldEvents.length, l: 'Events' }].map((s, i) => (
              <div key={i} style={S.qBox}><div style={S.qVal}>{s.v}</div><div style={S.qLbl}>{s.l}</div></div>
            ))}
          </div>

          {Object.keys(tierCounts).length > 0 && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>🏆 Tier Distribution</h2>
              <div style={{ display: 'flex', gap: 12 }}>
                {['slay', 'pass', 'mid', 'fail'].map(tier => (
                  <div key={tier} style={{ flex: 1, padding: 14, borderRadius: 10, textAlign: 'center', background: TIER_COLORS[tier] + '12', border: `2px solid ${TIER_COLORS[tier]}30` }}>
                    <div style={{ fontSize: 22 }}>{TIER_EMOJIS[tier]}</div>
                    <div style={{ fontSize: 26, fontWeight: 800 }}>{tierCounts[tier] || 0}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>{tier.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stateHistory.length > 0 && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>📈 Canon Timeline</h2>
              {stateHistory.slice(0, 20).map((h, i) => {
                const deltas = typeof h.deltas_json === 'string' ? JSON.parse(h.deltas_json) : h.deltas_json;
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 5, flexShrink: 0, background: h.source === 'override' ? '#eab308' : h.source === 'manual' ? '#dc2626' : '#6366f1' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{h.episode_title || h.episode_id?.substring(0, 8)}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {Object.entries(deltas || {}).filter(([, v]) => v !== 0).map(([k, v]) => (
                          <span key={k} style={S.deltaBadge(v)}>{STAT_ICONS[k]} {v > 0 ? '+' : ''}{v}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{new Date(h.created_at).toLocaleDateString()} · {h.source}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ EPISODE LEDGER ════════════════════════ */}
      {activeTab === 'episodes' && (
        <div style={S.content}>
          <div style={S.card}>
            <h2 style={S.cardTitle}>📋 Episode Ledger</h2>
            <div style={S.tHead}>
              <span style={{ ...S.tCol, flex: '0 0 40px' }}>#</span>
              <span style={{ ...S.tCol, flex: 2 }}>Title</span>
              <span style={S.tCol}>Tier</span>
              <span style={S.tCol}>Score</span>
              <span style={S.tCol}>Overrides</span>
              <span style={S.tCol}>Status</span>
              <span style={S.tCol}>Actions</span>
            </div>
            {episodes.map((ep, i) => {
              const ej = ep.evaluation_json;
              return (
                <div key={ep.id} style={S.tRow}>
                  <span style={{ ...S.tCol, flex: '0 0 40px', fontWeight: 700 }}>{ep.episode_number || i + 1}</span>
                  <span style={{ ...S.tCol, flex: 2, fontWeight: 600 }}>{ep.title || 'Untitled'}</span>
                  <span style={S.tCol}>{ej?.tier_final ? <span style={S.tierPill(ej.tier_final)}>{TIER_EMOJIS[ej.tier_final]} {ej.tier_final.toUpperCase()}</span> : '—'}</span>
                  <span style={{ ...S.tCol, fontWeight: 700 }}>{ej?.score ?? '—'}</span>
                  <span style={S.tCol}>{(ej?.overrides || []).length > 0 ? `${(ej.overrides).length} ⬆️` : '—'}</span>
                  <span style={S.tCol}><span style={S.statusPill(ep.evaluation_status)}>{ep.evaluation_status || 'draft'}</span></span>
                  <span style={S.tCol}><Link to={`/episodes/${ep.id}/evaluate`} style={{ color: '#6366f1', fontSize: 12, textDecoration: 'none' }}>Evaluate</Link></span>
                </div>
              );
            })}
            {episodes.length === 0 && <div style={S.empty}>No episodes yet.</div>}
          </div>
        </div>
      )}

      {/* ════════════════════════ EVENTS LIBRARY ════════════════════════ */}
      {activeTab === 'events' && (
        <div style={S.content}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ ...S.cardTitle, margin: 0 }}>💌 Events Library ({worldEvents.length})</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              {worldEvents.length === 0 && (
                <button onClick={seedEvents} disabled={seeding} style={{ ...S.secBtn, background: '#fef3c7', borderColor: '#fbbf24', color: '#92400e' }}>
                  {seeding ? '⏳ Seeding...' : '🌱 Seed 40 Events'}
                </button>
              )}
              <button onClick={openNewEvent} style={S.primaryBtn}>+ Create Event</button>
            </div>
          </div>

          {/* Event editor */}
          {editingEvent && (
            <div style={{ background: '#fff', border: '2px solid #6366f1', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>{editingEvent === 'new' ? '✨ New Event' : '✏️ Edit Event'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                <FG label="Event Name *" value={eventForm.name} onChange={v => setEventForm(p => ({ ...p, name: v }))} placeholder="Velour Society Garden Soirée" />
                <div>
                  <label style={S.fLabel}>Type</label>
                  <select value={eventForm.event_type} onChange={e => setEventForm(p => ({ ...p, event_type: e.target.value }))} style={S.sel}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{EVENT_TYPE_ICONS[t]} {t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <FG label="Host / Brand" value={eventForm.host_brand} onChange={v => setEventForm(p => ({ ...p, host_brand: v }))} placeholder="Velour Society" />
                <FG label="Prestige (1-10)" value={eventForm.prestige} onChange={v => setEventForm(p => ({ ...p, prestige: parseInt(v) || 5 }))} type="number" min={1} max={10} />
                <FG label="Cost (coins)" value={eventForm.cost_coins} onChange={v => setEventForm(p => ({ ...p, cost_coins: parseInt(v) || 0 }))} type="number" min={0} />
                <FG label="Strictness (1-10)" value={eventForm.strictness} onChange={v => setEventForm(p => ({ ...p, strictness: parseInt(v) || 5 }))} type="number" min={1} max={10} />
                <div>
                  <label style={S.fLabel}>Deadline</label>
                  <select value={eventForm.deadline_type} onChange={e => setEventForm(p => ({ ...p, deadline_type: e.target.value }))} style={S.sel}>
                    {['none', 'low', 'medium', 'high', 'tonight', 'urgent'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <FG label="Dress Code" value={eventForm.dress_code} onChange={v => setEventForm(p => ({ ...p, dress_code: v }))} placeholder="romantic couture" />
                <div>
                  <label style={S.fLabel}>Browse Pool Bias</label>
                  <select value={eventForm.browse_pool_bias} onChange={e => setEventForm(p => ({ ...p, browse_pool_bias: e.target.value }))} style={S.sel}>
                    {BIAS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              {/* Career & Payment */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                <div>
                  <label style={S.fLabel}>Career Tier</label>
                  <select value={eventForm.career_tier} onChange={e => setEventForm(p => ({ ...p, career_tier: parseInt(e.target.value) }))} style={S.sel}>
                    {CAREER_TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.fLabel}>Paid Event?</label>
                  <select value={eventForm.is_paid ? 'yes' : 'no'} onChange={e => setEventForm(p => ({ ...p, is_paid: e.target.value === 'yes' }))} style={S.sel}>
                    <option value="no">No — Lala pays to attend</option>
                    <option value="yes">Yes — Lala gets paid</option>
                  </select>
                </div>
                <FG label="Payment (if paid)" value={eventForm.payment_amount} onChange={v => setEventForm(p => ({ ...p, payment_amount: parseInt(v) || 0 }))} type="number" min={0} />
              </div>

              <FG label="Location Hint" value={eventForm.location_hint} onChange={v => setEventForm(p => ({ ...p, location_hint: v }))} placeholder="Parisian rooftop garden, golden hour, marble tables" full />
              <FG label="Narrative Stakes" value={eventForm.narrative_stakes} onChange={v => setEventForm(p => ({ ...p, narrative_stakes: v }))} placeholder="What this event means for Lala's arc..." textarea full />
              <FG label="Career Milestone" value={eventForm.career_milestone} onChange={v => setEventForm(p => ({ ...p, career_milestone: v }))} placeholder="First brand collaboration, first paid gig, etc." full />
              <FG label="On Fail" value={eventForm.fail_consequence} onChange={v => setEventForm(p => ({ ...p, fail_consequence: v }))} placeholder="What happens narratively if she fails..." full />
              <FG label="On Success → Unlocks" value={eventForm.success_unlock} onChange={v => setEventForm(p => ({ ...p, success_unlock: v }))} placeholder="What this opens up (future events, brand deals, etc.)" full />
              <FG label="Description" value={eventForm.description} onChange={v => setEventForm(p => ({ ...p, description: v }))} placeholder="Full event description..." textarea full />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button onClick={() => setEditingEvent(null)} style={S.secBtn}>Cancel</button>
                <button onClick={saveEvent} disabled={savingEvent || !eventForm.name} style={S.primaryBtn}>
                  {savingEvent ? '⏳...' : editingEvent === 'new' ? '✨ Create' : '💾 Save'}
                </button>
              </div>
            </div>
          )}

          {/* Events grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {worldEvents.map(ev => (
              <div key={ev.id} style={S.evCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{EVENT_TYPE_ICONS[ev.event_type] || '📌'}</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: 0, flex: 1 }}>{ev.name}</h3>
                  <span style={S.statusPill(ev.status)}>{ev.status}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  <span style={S.eTag}>⭐ {ev.prestige}</span>
                  <span style={S.eTag}>🪙 {ev.cost_coins}</span>
                  <span style={S.eTag}>📏 {ev.strictness}</span>
                  <span style={S.eTag}>⏰ {ev.deadline_type}</span>
                  {ev.dress_code && <span style={S.eTag}>👗 {ev.dress_code}</span>}
                </div>
                {ev.host_brand && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>🏛️ {ev.host_brand}</div>}
                {(ev.career_tier || ev.is_paid) && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    {ev.career_tier && <span style={{ padding: '2px 8px', background: (CAREER_TIERS.find(t => t.value === ev.career_tier)?.color || '#94a3b8') + '18', borderRadius: 4, fontSize: 10, fontWeight: 600, color: CAREER_TIERS.find(t => t.value === ev.career_tier)?.color || '#94a3b8' }}>Tier {ev.career_tier}</span>}
                    {ev.is_paid && <span style={{ padding: '2px 8px', background: '#f0fdf4', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#16a34a' }}>💰 Paid {ev.payment_amount ? `(${ev.payment_amount} coins)` : ''}</span>}
                    {!ev.is_paid && ev.cost_coins > 0 && <span style={{ padding: '2px 8px', background: '#fef2f2', borderRadius: 4, fontSize: 10, fontWeight: 600, color: '#dc2626' }}>Costs {ev.cost_coins} coins</span>}
                  </div>
                )}
                {ev.career_milestone && <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, marginBottom: 4 }}>🎯 {ev.career_milestone}</div>}
                {ev.narrative_stakes && <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginBottom: 4, lineHeight: 1.4 }}>{ev.narrative_stakes}</div>}
                {ev.location_hint && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>📍 {ev.location_hint}</div>}
                {ev.status === 'used' && <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>✅ Injected (used {ev.times_used || 1}x)</div>}
                <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                  <button onClick={() => openEditEvent(ev)} style={S.smBtn}>✏️ Edit</button>
                  <button onClick={() => setInjectTarget(injectTarget === ev.id ? null : ev.id)} style={S.smBtn}>{ev.status === 'used' ? '💉 Re-inject' : '💉 Inject'}</button>
                  <button onClick={() => setGenerateTarget(generateTarget === ev.id ? null : ev.id)} style={S.smBtn}>📝 Generate</button>
                  <button onClick={() => deleteEvent(ev.id)} style={S.smBtnDanger}>🗑️</button>
                </div>
                {injectTarget === ev.id && (
                  <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Inject into which episode?</div>
                    {episodes.map(ep => (
                      <button key={ep.id} onClick={() => injectEvent(ev.id, ep.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', marginBottom: 4, color: '#1a1a2e' }}>
                        {ep.episode_number || '?'}. {ep.title || 'Untitled'}
                      </button>
                    ))}
                    {episodes.length === 0 && <span style={S.muted}>No episodes</span>}
                  </div>
                )}
                {generateTarget === ev.id && (
                  <div style={{ marginTop: 8, padding: 10, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 6 }}>📝 Generate full script skeleton for which episode?</div>
                    {episodes.map(ep => (
                      <button key={ep.id} onClick={() => generateScript(ev.id, ep.id)} disabled={generating}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, cursor: 'pointer', marginBottom: 4, color: '#1a1a2e' }}>
                        {generating ? '⏳ Generating...' : `${ep.episode_number || '?'}. ${ep.title || 'Untitled'}`}
                      </button>
                    ))}
                    {episodes.length === 0 && <span style={S.muted}>No episodes</span>}
                  </div>
                )}
              </div>
            ))}
            {worldEvents.length === 0 && !editingEvent && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💌</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No events yet</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>Create reusable events that inject directly into episode scripts.</div>
                <button onClick={openNewEvent} style={S.primaryBtn}>+ Create First Event</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════ CHARACTERS ════════════════════════ */}
      {activeTab === 'characters' && (
        <div style={S.content}>
          {/* Lala */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👑</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Lala</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Main Character · AI Avatar</p>
              </div>
              {!editingStats ? (
                <button onClick={openStatEditor} disabled={!charState} style={S.secBtn}>✏️ Edit Stats</button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditingStats(false)} style={S.secBtn}>Cancel</button>
                  <button onClick={saveStats} disabled={savingStats} style={S.primaryBtn}>{savingStats ? '⏳' : '💾 Save'}</button>
                </div>
              )}
            </div>

            {charState ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {Object.entries(charState.state || {}).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{STAT_ICONS[key]}</span>
                    <span style={{ flex: '0 0 100px', fontSize: 13, color: '#64748b', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                    {editingStats ? (
                      <input type="number" value={statForm[key] ?? val} onChange={e => setStatForm(p => ({ ...p, [key]: parseInt(e.target.value) }))}
                        style={{ width: 80, padding: '4px 8px', border: '1px solid #6366f1', borderRadius: 4, fontSize: 14, fontWeight: 700, textAlign: 'right', marginLeft: 'auto' }}
                        min={key === 'coins' ? -9999 : 0} max={key === 'coins' ? 99999 : 10} />
                    ) : (
                      <>
                        <div style={{ flex: 1, height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (val / (key === 'coins' ? 500 : 10)) * 100))}%`, borderRadius: 5, background: key === 'stress' ? (val >= 5 ? '#dc2626' : '#eab308') : key === 'coins' ? (val < 0 ? '#dc2626' : '#6366f1') : '#6366f1', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ flex: '0 0 40px', textAlign: 'right', fontSize: 15, fontWeight: 700, color: (key === 'stress' && val >= 5) || (key === 'coins' && val < 0) ? '#dc2626' : '#1a1a2e' }}>{val}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : <p style={S.muted}>No stats initialized. Evaluate an episode to auto-seed defaults.</p>}

            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px' }}>Character Rules</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Voice Activation', 'Required ✅'],
                  ['Idle Behaviors', 'Wave, mirror glance, inspect'],
                  ['Default Stats', '500 coins, 1 rep, 1 trust, 1 inf, 0 stress'],
                  ['Fail Behavior', 'Forced smile, softer voice, stress anim'],
                ].map(([l, v]) => (
                  <div key={l}><div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{l}</div><div style={{ fontSize: 13, color: '#1a1a2e' }}>{v}</div></div>
                ))}
              </div>
            </div>
          </div>

          {/* Prime */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>💎</div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>JustAWomanInHerPrime</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Creator Narrator</p>
              </div>
            </div>
            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Role', 'Narrator + Gameplay driver'],
                  ['Voice', 'Warm, strategic, luxury aspirational'],
                  ['Aliases', 'Prime:, Me:, You:'],
                  ['CTA Style', 'Confident, community-focused'],
                ].map(([l, v]) => (
                  <div key={l}><div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{l}</div><div style={{ fontSize: 13, color: '#1a1a2e' }}>{v}</div></div>
                ))}
              </div>
            </div>
          </div>

          {/* Stat ledger */}
          {stateHistory.length > 0 && (
            <div style={S.card}>
              <h2 style={S.cardTitle}>📜 Stat Change Ledger</h2>
              <div style={S.tHead}>
                <span style={S.tCol}>Episode</span>
                <span style={S.tCol}>Source</span>
                <span style={{ ...S.tCol, flex: 2 }}>Changes</span>
                <span style={S.tCol}>Date</span>
              </div>
              {stateHistory.map((h, i) => {
                const deltas = typeof h.deltas_json === 'string' ? JSON.parse(h.deltas_json) : h.deltas_json;
                return (
                  <div key={i} style={S.tRow}>
                    <span style={S.tCol}>{h.episode_title || h.episode_id?.substring(0, 8) || 'manual'}</span>
                    <span style={S.tCol}><span style={S.sourceBadge(h.source)}>{h.source}</span></span>
                    <span style={{ ...S.tCol, flex: 2, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {Object.entries(deltas || {}).filter(([, v]) => v !== 0).map(([k, v]) => (
                        <span key={k} style={S.deltaBadge(v)}>{STAT_ICONS[k]} {v > 0 ? '+' : ''}{v}</span>
                      ))}
                    </span>
                    <span style={{ ...S.tCol, fontSize: 11, color: '#94a3b8' }}>{new Date(h.created_at).toLocaleDateString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════ DECISIONS ════════════════════════ */}
      {activeTab === 'decisions' && (
        <div style={S.content}>
          <div style={S.card}>
            <h2 style={S.cardTitle}>🧠 Decision Log</h2>
            <p style={S.muted}>Training data from your creative decisions. Powers future AI suggestions.</p>
            {decisions.length > 0 ? decisions.map((d, i) => {
              const ctx = typeof d.context_json === 'string' ? JSON.parse(d.context_json) : d.context_json;
              const dec = typeof d.decision_json === 'string' ? JSON.parse(d.decision_json) : d.decision_json;
              return (
                <div key={i} style={{ padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ padding: '2px 8px', background: '#eef2ff', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#4338ca', textTransform: 'capitalize' }}>{d.type?.replace(/_/g, ' ')}</span>
                    {d.source && <span style={{ padding: '2px 8px', background: '#f1f5f9', borderRadius: 4, fontSize: 11, color: '#64748b' }}>{d.source}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{new Date(d.created_at).toLocaleString()}</span>
                  </div>
                  {ctx && <div style={{ fontSize: 11, color: '#64748b', wordBreak: 'break-all' }}>Context: {JSON.stringify(ctx)}</div>}
                  {dec && <div style={{ fontSize: 11, color: '#1a1a2e', fontWeight: 500, wordBreak: 'break-all' }}>Decision: {JSON.stringify(dec)}</div>}
                </div>
              );
            }) : <p style={S.muted}>No decisions logged yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Form Group helper ───
function FG({ label, value, onChange, placeholder, type = 'text', textarea, full, min, max }) {
  const style = { marginBottom: full ? 10 : 0 };
  return (
    <div style={style}>
      <label style={S.fLabel}>{label}</label>
      {textarea ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} style={S.tArea} rows={2} placeholder={placeholder} />
      ) : (
        <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} style={S.inp} placeholder={placeholder} min={min} max={max} />
      )}
    </div>
  );
}

// ─── STYLES ───
const S = {
  page: { maxWidth: 1200, margin: '0 auto', padding: '20px 24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  center: { textAlign: 'center', padding: 60, color: '#94a3b8' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  backLink: { color: '#6366f1', fontSize: 13, textDecoration: 'none', fontWeight: 500 },
  title: { margin: '4px 0 4px', fontSize: 26, fontWeight: 800, color: '#1a1a2e' },
  subtitle: { margin: 0, color: '#64748b', fontSize: 14 },
  refreshBtn: { padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, color: '#475569', fontSize: 13, cursor: 'pointer' },
  errorBanner: { display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 12 },
  successBanner: { padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#16a34a', fontSize: 13, marginBottom: 12, fontWeight: 600 },
  xBtn: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 },

  content: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#1a1a2e', margin: '0 0 16px' },
  muted: { color: '#94a3b8', fontSize: 13 },
  primaryBtn: { padding: '8px 18px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  secBtn: { padding: '8px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, color: '#475569', fontSize: 13, cursor: 'pointer' },
  smBtn: { padding: '4px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#475569' },
  smBtnDanger: { padding: '4px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#dc2626' },
  statsRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  statBox: { flex: '1 1 90px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, textAlign: 'center', minWidth: 90 },
  statVal: (k, v) => ({ fontSize: 26, fontWeight: 800, color: (k === 'stress' && v >= 5) || (k === 'coins' && v < 0) ? '#dc2626' : '#1a1a2e' }),
  statLbl: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 },
  qGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  qBox: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, textAlign: 'center' },
  qVal: { fontSize: 22, fontWeight: 800, color: '#1a1a2e' },
  qLbl: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginTop: 2 },
  tHead: { display: 'flex', gap: 8, padding: '8px 0', borderBottom: '2px solid #e2e8f0', fontWeight: 600, color: '#64748b', fontSize: 11, textTransform: 'uppercase' },
  tRow: { display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center', fontSize: 13 },
  tCol: { flex: 1, minWidth: 0 },
  empty: { padding: 20, textAlign: 'center', color: '#94a3b8' },
  tierPill: (t) => ({ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: TIER_COLORS[t] + '20', color: TIER_COLORS[t] }),
  statusPill: (s) => ({ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: s === 'accepted' ? '#f0fdf4' : s === 'computed' ? '#eef2ff' : s === 'ready' ? '#f0fdf4' : s === 'used' ? '#eef2ff' : '#f1f5f9', color: s === 'accepted' || s === 'ready' ? '#16a34a' : s === 'computed' || s === 'used' ? '#6366f1' : '#94a3b8' }),
  sourceBadge: (s) => ({ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: s === 'override' ? '#fef3c7' : s === 'manual' ? '#fef2f2' : '#eef2ff', color: s === 'override' ? '#92400e' : s === 'manual' ? '#dc2626' : '#4338ca' }),
  deltaBadge: (v) => ({ display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 600, background: v > 0 ? '#f0fdf4' : '#fef2f2', color: v > 0 ? '#16a34a' : '#dc2626' }),
  scriptOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  scriptModal: { background: '#fff', borderRadius: 16, padding: 24, maxWidth: 900, width: '100%', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  scriptPre: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '55vh', overflow: 'auto', color: '#1e293b', fontFamily: '"JetBrains Mono", "Fira Code", monospace' },
  evCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 },
  eTag: { padding: '2px 8px', background: '#f3e8ff', borderRadius: 4, fontSize: 11, color: '#7c3aed' },
  fLabel: { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' },
  inp: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', boxSizing: 'border-box' },
  sel: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', background: '#fff' },
  tArea: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, color: '#1a1a2e', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' },
};

export default WorldAdmin;
