'use strict';

/**
 * UI Overlay Generation Service
 *
 * Generates the 11 core UI overlay assets for "Styling Adventures with Lala."
 * Each overlay is a transparent PNG matching the show's design tokens:
 * parchment #FAF7F0, gold #B8962E, ink #2C2C2C
 *
 * Overlays are show-level assets (not per-scene-set) — consistent brand identity.
 */

const { generateImageUrl } = require('./imageGenerationService');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({ region: AWS_REGION });

// ── SHARED STYLE PREFIX (used in phone screen prompts) ──────────────────────
const STYLE_PREFIX = 'Luxury fashion app UI element. Gold (#B8962E) metallic finish, parchment (#FAF7F0) tones, dark ink (#2C2C2C) accents. Clean, minimal, high-end. Think Chanel meets Apple. ';

// ── OVERLAY TYPE DEFINITIONS ─────────────────────────────────────────────────

const OVERLAY_TYPES = [
  // ── SHOW-LEVEL FRAMES (permanent — always present, every episode) ──
  {
    id: 'show_title',
    name: 'Show Title',
    category: 'frame',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Intro/Outro',
    description: 'Show title card — "Styling Adventures with Lala" in show typography',
    prompt: 'A luxury show title card overlay. Elegant parchment cream background with thin gold border frame. Center text reading "Styling Adventures with Lala" in refined serif typography. Gold foil effect on the text. Subtle gold sparkle particles around the text. Below the title, a thin gold decorative line with a small crown or diamond icon. Luxury fashion show branding. The text must be clearly readable. Isolated on plain background.',
    useCase: 'invitation', // DALL-E — needs text rendering
  },
  {
    id: 'login_screen',
    name: 'Login Screen',
    category: 'frame',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 1-2',
    description: 'Login screen frame — no cursor, just the elegant entry portal',
    prompt: 'A luxury login screen UI frame. Dark elegant background with gold border. Center: an empty text input field with a golden line border. Below: a golden "Enter" button. Subtle gold particles around edges. The aesthetic of a luxury virtual world portal. Only the word "Enter" on the button. No cursor, no typing. Fashion tech aesthetic. Isolated on plain background.',
  },
  {
    id: 'phone_screen',
    name: 'Phone Screen',
    category: 'frame',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Feed moments',
    description: 'Phone mockup frame for rendering feed posts inside — same frame, different content per episode.',
    prompt: 'A luxury smartphone frame mockup, front view. Thin gold bezels, rounded corners, notch at top. The screen area is completely empty white — blank canvas for content. Phone frame is elegant dark with gold edge accents. No UI inside screen — completely blank. Premium phone mockup. Isolated on plain background.',
  },
  {
    id: 'icon_holder',
    name: 'Icon Holder / Display',
    category: 'frame',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Various',
    description: 'Circular icon display mount — holds any icon. Reused across all episodes.',
    prompt: 'A luxury circular icon holder/mount. Elegant gold circle frame with soft inner glow, empty center for placing icons inside. Thin gold border ring with subtle ornate detailing. The center is transparent/empty. Think luxury app icon background. Isolated on plain background.',
  },

  // ── EPISODE-LEVEL FRAMES (selected per episode based on content) ──
  {
    id: 'episode_title',
    name: 'Episode Title Card',
    category: 'frame',
    lifecycle: 'per_episode',
    scope: 'episode',
    beat: 'Intro',
    description: 'Episode title card — generated from the episode title, event name, and prestige. Uses DALL-E for text rendering.',
    prompt: 'A luxury episode title card overlay. Elegant dark background with gold border frame. Center text showing the episode title in refined serif typography with gold foil effect. Below the title, a thin gold line with episode number. Subtle gold sparkle particles. The text must be clearly readable. Luxury fashion show episode card. Isolated on plain background.',
    useCase: 'invitation', // DALL-E — needs text rendering
  },
  {
    id: 'mail_panel',
    name: 'Mail Panel',
    category: 'frame',
    lifecycle: 'variant',
    scope: 'episode',
    beat: 'Beat 3-4',
    description: 'Opened mail panel frame — luxury letter display. Base frame is permanent, letter content changes per episode.',
    prompt: 'A luxury opened mail panel UI frame, portrait orientation. Elegant parchment paper with gold borders and decorative corners. Empty center area for letter content. Thin gold line frame with ornate corner flourishes. Cream/ivory background with subtle texture. No text, no writing — empty frame only. Luxury stationery aesthetic. Isolated on plain background.',
  },
  {
    id: 'wardrobe_list',
    name: 'Wardrobe Shopping List',
    category: 'frame',
    lifecycle: 'per_episode',
    scope: 'episode',
    beat: 'Beat 5, 8',
    description: 'Wardrobe shopping checklist — regenerated each episode with cute vibe-based names for each outfit piece.',
    prompt: 'A luxury wardrobe shopping list panel UI overlay. Warm parchment/cream background with gold border frame. 7 empty checkbox rows with thin gold lines and a tiny wardrobe icon (dress, shoe, perfume bottle) beside each row. Each row has an empty square checkbox on the left and a horizontal line for text. Gold decorative header reading "Wardrobe Shopping List". Small dress hanger icon at top. No actual text in rows — empty template only. Luxury fashion planner aesthetic. Isolated on plain background.',
  },
  {
    id: 'career_list',
    name: 'Career Checklist',
    category: 'frame',
    lifecycle: 'per_episode',
    scope: 'episode',
    beat: 'Beat 9, 13',
    description: 'Career task checklist — regenerated each episode with event-specific deliverables and goals.',
    prompt: 'A luxury career checklist panel UI overlay. Soft lavender/cool white background with indigo border frame. 5 empty checkbox rows with thin indigo lines. Each row has an empty square checkbox on the left and a horizontal line for text. Indigo decorative header reading "Career Checklist" at top. Small star or briefcase icon at top. No actual text in rows — empty template only. Professional luxury planner aesthetic. Isolated on plain background.',
  },
  {
    id: 'social_tasks',
    name: 'Social Tasks Checklist',
    category: 'frame',
    lifecycle: 'per_episode',
    scope: 'episode',
    beat: 'Beat 5, 9',
    description: 'Social media task checklist — regenerated each episode with platform-specific content tasks grouped by timing (before/during/after).',
    prompt: 'A luxury social media checklist panel UI overlay. Warm parchment/cream background with gold border frame. Three sections labeled BEFORE, DURING, AFTER with 3-4 empty checkbox rows each. Each row has a small square checkbox and horizontal line for text. Gold decorative header reading "Social Media Checklist". Small phone/camera icon at top. Phase headers in different accent colors. No actual text in rows — empty template only. Luxury content planner aesthetic. Isolated on plain background.',
  },
  {
    id: 'closet_ui',
    name: 'Closet UI',
    category: 'frame',
    lifecycle: 'variant',
    scope: 'episode',
    beat: 'Beat 8',
    description: 'Wardrobe browser frame — base frame is permanent, items displayed inside change per episode.',
    prompt: 'A luxury wardrobe closet UI frame overlay. Elegant gold clothes hanger rack at the top with 4-5 empty hanger silhouettes. Below: a grid of 6 empty rounded rectangle slots for clothing items. Gold thin line borders. Cream/parchment background. Empty slots only — no actual clothes. Luxury fashion app aesthetic. Isolated on plain background.',
  },
  {
    id: 'stats_panel',
    name: 'Stats Panel',
    category: 'frame',
    lifecycle: 'per_episode',
    scope: 'episode',
    beat: 'Beat 13',
    description: 'Prime Bank display — regenerated each episode with current coins, credits, scores.',
    prompt: 'A luxury stats/score panel UI overlay. Parchment background with gold border frame. 4 rows showing currency categories with empty value areas: a coin icon row, a star icon row, a diamond icon row, and a heart icon row. Each row has a small icon on left and space for number on right. Gold line separators. No numbers — empty template. Luxury banking aesthetic. Isolated on plain background.',
  },

  // ── UI ICONS (all permanent show-level — generated once, reused forever) ──
  {
    id: 'cursor',
    name: 'Cursor',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 1-2',
    description: 'Elegant typing cursor — blinking line for login screen',
    prompt: 'A single elegant gold typing cursor line, vertical thin line with soft golden glow around it. Minimal, clean, just a blinking cursor indicator. Luxury tech aesthetic. Isolated on plain background.',
  },
  {
    id: 'mail_icon',
    name: 'Mail Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 3',
    description: 'Gold mail envelope icon with glow',
    prompt: 'A single luxury gold mail envelope icon, elegant and minimal, with soft warm glow. Gold metallic finish with small wax seal detail. Luxury fashion notification icon. Isolated on plain background. No text.',
  },
  {
    id: 'voice_icon',
    name: 'Voice Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 4',
    description: 'Voice activation microphone — Lala speaks',
    prompt: 'A luxury gold microphone icon with elegant soundwave lines. Minimal, modern, fashion-forward. Gold metallic finish. Smooth flowing soundwave lines, not jagged. Luxury tech meets fashion house. Isolated on plain background. No text.',
  },
  {
    id: 'perfume_icon',
    name: 'Perfume Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 8',
    description: 'Perfume bottle icon — fragrance selection',
    prompt: 'A luxury gold perfume bottle icon, elegant and minimal. Classic fluted glass bottle silhouette with gold cap and subtle mist/spray detail. High-end fragrance aesthetic. Isolated on plain background. No text.',
  },
  {
    id: 'outfit_icon',
    name: 'Outfit Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 8',
    description: 'Dress/outfit icon — clothing selection',
    prompt: 'A luxury gold dress silhouette icon, elegant cocktail dress shape. Minimal, clean lines, gold metallic finish. Fashion illustration style — not detailed, just the silhouette. Isolated on plain background. No text.',
  },
  {
    id: 'shoes_icon',
    name: 'Shoes Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 8',
    description: 'High heel shoe icon — footwear selection',
    prompt: 'A luxury gold high heel stiletto shoe icon, elegant side profile silhouette. Minimal, clean lines, gold metallic finish. Fashion illustration style. Isolated on plain background. No text.',
  },
  {
    id: 'accessories_icon',
    name: 'Accessories Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 8',
    description: 'Accessories icon — bag/jewelry selection',
    prompt: 'A luxury gold handbag icon, elegant clutch or designer bag silhouette. Minimal, clean lines, gold metallic finish with small clasp detail. Fashion illustration style. Isolated on plain background. No text.',
  },
  {
    id: 'location_icon',
    name: 'Location Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 10',
    description: 'Map pin — event location / travel',
    prompt: 'A luxury gold map pin location icon, classic teardrop shape with small circle inside. Gold metallic finish with subtle motion lines suggesting travel. Minimal, clean. Isolated on plain background. No text.',
  },
  {
    id: 'reminder_icon',
    name: 'Reminder Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 9',
    description: 'Clock/alarm — urgency notification',
    prompt: 'A luxury gold alarm clock icon, elegant round clock face with gold hands. Small urgency pulse rings emanating outward. Minimal, clean design. Luxury watch brand aesthetic. Isolated on plain background. No text.',
  },
  {
    id: 'dm_icon',
    name: 'DM Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 14',
    description: 'Mysterious DM notification — dark intrigue',
    prompt: 'A dark mysterious chat bubble notification icon. Dark navy/charcoal rounded rectangle with subtle gold edge glow. Small anonymous silhouette avatar. Message area blurred suggesting mystery. Isolated on plain background. No text.',
  },
  {
    id: 'exit_icon',
    name: 'Exit Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Various',
    description: 'Exit/close button — X mark',
    prompt: 'A luxury gold X close button icon, elegant thin crossed lines forming an X. Gold metallic finish with subtle circle border. Minimal, clean, luxury app close button. Isolated on plain background.',
  },
  {
    id: 'minimize_icon',
    name: 'Minimize Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Various',
    description: 'Minimize/collapse button — dash mark',
    prompt: 'A luxury gold minimize button icon, elegant thin horizontal line (dash). Gold metallic finish with subtle circle border. Minimal, clean, luxury app minimize button. Isolated on plain background.',
  },
  {
    id: 'headphones_icon',
    name: 'Headphones Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 1',
    description: 'Opening Ritual — headphones on, sacred moment',
    prompt: 'A luxury gold over-ear headphones icon, elegant silhouette with gold metallic finish. Premium audio headphones, sleek curves, minimal detail. The sacred opening ritual icon. Isolated on plain background. No text.',
  },
  {
    id: 'brand_deal_icon',
    name: 'Brand Deal Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 7',
    description: 'Brand deal / partnership notification — handshake',
    prompt: 'A luxury gold handshake icon, two elegant hands meeting in a professional handshake. Gold metallic finish, minimal clean lines. Business partnership and brand collaboration aesthetic. Isolated on plain background. No text.',
  },
  {
    id: 'deadline_icon',
    name: 'Deadline Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Beat 9',
    description: 'Final countdown — red urgency, maximum pressure',
    prompt: 'A dramatic red and gold countdown timer icon, circular clock face with red accent glow and gold hands pointing to 12. Urgent pulse rings in red emanating outward. Maximum urgency aesthetic — the deadline is NOW. Isolated on plain background. No text.',
  },
  {
    id: 'phone_icon',
    name: 'Phone Icon',
    category: 'icon',
    lifecycle: 'permanent',
    scope: 'show',
    beat: 'Various',
    description: 'Phone tap icon — opens phone screen overlay',
    prompt: 'A luxury gold smartphone icon, elegant front-facing phone silhouette with thin gold bezels and rounded corners. Small notification dot in gold at top right. Minimal, clean lines, gold metallic finish. Luxury tech aesthetic — premium device icon. Isolated on plain background. No text.',
  },

  // ── PHONE HUB SCREENS (full phone views — match frontend SCREEN_TYPES) ────
  { id: 'home', name: 'Home', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'Home screen with app icons', prompt: STYLE_PREFIX + 'Phone home screen with glassmorphism app icon grid. Dreamy pink and lavender gradient background with sparkle particles. Frosted glass app icon slots in a grid layout. Rose gold status bar at top with time, signal, battery. Bottom dock with 4 frosted pill-shaped icons. Elegant and ethereal. Isolated on plain background.' },
  { id: 'feed', name: 'Feed', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Feed moments', description: 'Social media feed view', prompt: STYLE_PREFIX + 'Phone social media feed screen. Dreamy glassmorphism aesthetic. Scrollable cards with profile pics, like counts, comments. Frosted glass post cards on pink-lavender gradient. Rose gold accents. Sparkle particles. Isolated on plain background.' },
  { id: 'messages', name: 'Messages', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'Text conversations', prompt: STYLE_PREFIX + 'Phone messages screen with glassmorphism. Search bar at top, frosted glass message row cards. Elegant script "Messages" title. Pink-lavender gradient with sparkles. Bottom nav with frosted icons. Rose gold bezel chrome. Isolated on plain background.' },
  { id: 'dm', name: 'DMs', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Beat 14', description: 'Private direct messages', prompt: STYLE_PREFIX + 'Phone DM conversation screen. Chat bubbles in frosted glass, outgoing in rose gold tint, incoming in white frost. Message input bar at bottom. Pink-lavender gradient background with sparkle effects. Isolated on plain background.' },
  { id: 'story', name: 'Stories', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'Watching stories', prompt: STYLE_PREFIX + 'Phone stories viewer. Full-screen story with progress bars at top, username and avatar in top left, reply input at bottom. Dreamy gradient overlay. Rose gold UI elements. Isolated on plain background.' },
  { id: 'profile', name: 'Profile', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'Viewing a profile', prompt: STYLE_PREFIX + 'Phone profile screen. Circular avatar at top, username, bio text, follower/following counts. Grid of post thumbnails below. Glassmorphism header on pink-lavender gradient. Rose gold accent buttons. Isolated on plain background.' },
  { id: 'calls', name: 'Calls', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'Call history & FaceTime', prompt: STYLE_PREFIX + 'Phone call history screen. Frosted glass call entry rows with contact names, times, missed/received icons. Pink-lavender gradient. Rose gold phone icons. "Calls" title in elegant script. Isolated on plain background.' },
  { id: 'contacts', name: 'Contacts', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'Contact list', prompt: STYLE_PREFIX + 'Phone contacts list. Alphabetical sections with frosted glass contact cards. Circular avatar placeholders. Search bar at top. Pink-lavender gradient with sparkles. Rose gold accents. Isolated on plain background.' },
  { id: 'comments', name: 'Comments', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'Post reactions', prompt: STYLE_PREFIX + 'Phone comments section. Scrollable comment cards with avatars, usernames, comment text, like hearts. Frosted glass cards on pink-lavender gradient. Rose gold like buttons. Isolated on plain background.' },
  { id: 'live', name: 'Live', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'Going live', prompt: STYLE_PREFIX + 'Phone live streaming screen. LIVE badge in red at top, viewer count, floating hearts/reactions. Comment stream at bottom. Dreamy gradient overlay. Rose gold UI chrome. Isolated on plain background.' },
  { id: 'notif', name: 'Alerts', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'Notification center', prompt: STYLE_PREFIX + 'Phone notification center. Stacked notification cards with app icons, titles, previews. Frosted glass cards grouped by time. Pink-lavender gradient. Rose gold clear buttons. "Notifications" header. Isolated on plain background.' },
  { id: 'brand_deals', name: 'Brand Deals', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Beat 7', description: 'Sponsorship offers', prompt: STYLE_PREFIX + 'Phone brand deals dashboard. Cards showing brand logos, deal amounts, deadlines, status badges. Frosted glass on pink-lavender gradient. Gold accent for deal values. Professional luxury aesthetic. Isolated on plain background.' },
  { id: 'stats', name: 'Stats', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Beat 13', description: 'Analytics & metrics', prompt: STYLE_PREFIX + 'Phone analytics dashboard. Line charts, follower count, engagement rate, circular progress rings. Frosted glass chart cards on pink-lavender gradient. Rose gold data accents. Clean data visualization. Isolated on plain background.' },
  { id: 'creator_hub', name: 'Creator Hub', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'Content management', prompt: STYLE_PREFIX + 'Phone creator hub screen. Content calendar grid, draft posts, scheduled items. Frosted glass cards with thumbnails. Pink-lavender gradient. Rose gold action buttons. Creator tools aesthetic. Isolated on plain background.' },
  { id: 'deadlines', name: 'Deadlines', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Beat 9', description: 'Upcoming due dates', prompt: STYLE_PREFIX + 'Phone deadlines screen. Countdown timers, due date cards with urgency colors. Red accents for overdue items. Frosted glass cards on pink-lavender gradient. Rose gold clock icons. Isolated on plain background.' },
  { id: 'tasks', name: 'Tasks', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'To-do & reminders', prompt: STYLE_PREFIX + 'Phone task list. Checkbox rows with task descriptions, priority dots. Some checked off with line-through. Frosted glass list on pink-lavender gradient. Rose gold checkmarks. Isolated on plain background.' },
  { id: 'wardrobe', name: 'Closet', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Beat 8', description: 'Outfit selection', prompt: STYLE_PREFIX + 'Phone wardrobe/closet screen. Grid of clothing item cards with hanger icons. Category tabs at top (dresses, shoes, bags). Frosted glass cards on pink-lavender gradient. Rose gold selection borders. Isolated on plain background.' },
  { id: 'accessories', name: 'Accessories', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Beat 8', description: 'Jewelry & extras', prompt: STYLE_PREFIX + 'Phone accessories screen. Grid of jewelry, bags, sunglasses items. Sparkle effects on items. Frosted glass cards on pink-lavender gradient. Rose gold detail accents. Luxury accessory catalog. Isolated on plain background.' },
  { id: 'shop', name: 'Shopping', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'Browsing items', prompt: STYLE_PREFIX + 'Phone shopping screen. Product cards with prices, add-to-cart buttons. Search bar, category filters. Frosted glass on pink-lavender gradient. Rose gold price tags. Luxury shopping app aesthetic. Isolated on plain background.' },
  { id: 'camera', name: 'Camera', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'Taking content', prompt: STYLE_PREFIX + 'Phone camera screen. Viewfinder with grid lines, capture button at bottom center. Filter options, flash toggle. Minimal dark UI with rose gold capture ring. Frosted glass controls. Isolated on plain background.' },
  { id: 'map', name: 'Map', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Beat 10', description: 'DREAM map', prompt: STYLE_PREFIX + 'Phone map screen showing DREAM cities. Stylized map with 5 city pins (pink, purple, gold, green, blue). Rose gold map UI chrome. Location search bar at top. Dreamy illustrated map style. Frosted glass info cards. Isolated on plain background.' },
  { id: 'invite', name: 'Invitation', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Beat 3-4', description: 'Event invitations', prompt: STYLE_PREFIX + 'Phone invitation screen. Elegant event card with gold border, event name, date, venue, RSVP button. Frosted glass on pink-lavender gradient. Rose gold decorative flourishes. Luxury event invite aesthetic. Isolated on plain background.' },
  { id: 'settings', name: 'Settings', category: 'phone', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'Phone settings', prompt: STYLE_PREFIX + 'Phone settings screen. Toggle rows with labels and switch controls. Sections for notifications, privacy, display. Frosted glass rows on pink-lavender gradient. Rose gold toggle switches. Clean settings UI. Isolated on plain background.' },

  // ── PHONE HUB APP ICONS (square icons for home screen link zones) ──────────
  { id: 'icon_feed', name: 'Feed Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for Feed', prompt: STYLE_PREFIX + 'Square app icon for social feed. Glassmorphism frosted glass with newspaper/scroll symbol. Pink-lavender gradient background with sparkle. Rounded corners (iOS style). Isolated on plain background.' },
  { id: 'icon_messages', name: 'Messages Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for Messages', prompt: STYLE_PREFIX + 'Square app icon for messages. Glassmorphism frosted glass with chat bubble symbol. Pink-lavender gradient with sparkle. Rounded corners. Isolated on plain background.' },
  { id: 'icon_dm', name: 'DMs Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for DMs', prompt: STYLE_PREFIX + 'Square app icon for DMs. Glassmorphism frosted glass with paper plane send symbol. Pink-lavender gradient with sparkle. Rounded corners. Isolated on plain background.' },
  { id: 'icon_camera', name: 'Camera Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for Camera', prompt: STYLE_PREFIX + 'Square app icon for camera. Glassmorphism frosted glass with camera lens symbol. Pink-lavender gradient with sparkle. Rounded corners. Isolated on plain background.' },
  { id: 'icon_closet', name: 'Closet Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for Closet', prompt: STYLE_PREFIX + 'Square app icon for wardrobe closet. Glassmorphism frosted glass with dress hanger symbol. Pink-lavender gradient with sparkle. Rounded corners. Isolated on plain background.' },
  { id: 'icon_shop', name: 'Shop Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for Shopping', prompt: STYLE_PREFIX + 'Square app icon for shopping. Glassmorphism frosted glass with shopping bag symbol. Pink-lavender gradient with sparkle. Rounded corners. Isolated on plain background.' },
  { id: 'icon_stats', name: 'Stats Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for Stats', prompt: STYLE_PREFIX + 'Square app icon for analytics/stats. Glassmorphism frosted glass with bar chart symbol. Pink-lavender gradient with sparkle. Rounded corners. Isolated on plain background.' },
  { id: 'icon_settings', name: 'Settings Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for Settings', prompt: STYLE_PREFIX + 'Square app icon for settings. Glassmorphism frosted glass with gear symbol. Pink-lavender gradient with sparkle. Rounded corners. Isolated on plain background.' },
  { id: 'icon_brand_deals', name: 'Deals Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for Brand Deals', prompt: STYLE_PREFIX + 'Square app icon for brand deals. Glassmorphism frosted glass with handshake symbol. Pink-lavender gradient with sparkle. Rounded corners. Isolated on plain background.' },
  { id: 'icon_creator_hub', name: 'Hub Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for Creator Hub', prompt: STYLE_PREFIX + 'Square app icon for creator hub. Glassmorphism frosted glass with palette/paintbrush symbol. Pink-lavender gradient with sparkle. Rounded corners. Isolated on plain background.' },
  { id: 'icon_calls', name: 'Calls Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for Calls', prompt: STYLE_PREFIX + 'Square app icon for phone calls. Glassmorphism frosted glass with phone receiver symbol. Pink-lavender gradient with sparkle. Rounded corners. Isolated on plain background.' },
  { id: 'icon_contacts', name: 'Contacts Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for Contacts', prompt: STYLE_PREFIX + 'Square app icon for contacts. Glassmorphism frosted glass with person silhouette symbol. Pink-lavender gradient with sparkle. Rounded corners. Isolated on plain background.' },
  { id: 'icon_tasks', name: 'Tasks Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for Tasks', prompt: STYLE_PREFIX + 'Square app icon for tasks. Glassmorphism frosted glass with checkmark/checklist symbol. Pink-lavender gradient with sparkle. Rounded corners. Isolated on plain background.' },
  { id: 'icon_accessories', name: 'Accessories Icon', category: 'phone_icon', lifecycle: 'permanent', scope: 'show', beat: 'Various', description: 'App icon for Accessories', prompt: STYLE_PREFIX + 'Square app icon for accessories. Glassmorphism frosted glass with diamond/gem symbol. Pink-lavender gradient with sparkle. Rounded corners. Isolated on plain background.' },
];

// ── OVERLAY SCOPE HELPERS ────────────────────────────────────────────────────

const SHOW_OVERLAYS = OVERLAY_TYPES.filter(o => o.scope === 'show');
const EPISODE_OVERLAYS = OVERLAY_TYPES.filter(o => o.scope === 'episode');

/**
 * Auto-suggest which episode-level overlays are needed based on event data.
 */
function suggestOverlaysForEvent(event) {
  const suggestions = [];
  const type = event?.event_type || 'invite';
  const auto = event?.canon_consequences?.automation || {};

  // Mail panel — always for invite/upgrade events (invitation scene)
  if (['invite', 'upgrade', 'brand_deal'].includes(type)) {
    suggestions.push({ id: 'mail_panel', reason: 'Invitation scene' });
  }

  // Wardrobe list — if outfit pieces are selected or prestige >= 4
  if (event?.outfit_pieces?.length > 0 || (event?.prestige || 5) >= 4) {
    suggestions.push({ id: 'wardrobe_list', reason: 'Outfit selection scene' });
  }

  // Closet UI — if wardrobe is involved
  if (event?.outfit_pieces?.length > 0 || (event?.prestige || 5) >= 5) {
    suggestions.push({ id: 'closet_ui', reason: 'Wardrobe browsing scene' });
  }

  // Career list — for brand deals, deliverables, or prestige >= 6
  if (['brand_deal', 'deliverable'].includes(type) || (event?.prestige || 5) >= 6) {
    suggestions.push({ id: 'career_list', reason: type === 'brand_deal' ? 'Brand deliverables' : 'Career tasks' });
  }

  // Social tasks — if social tasks exist
  if (auto.social_tasks?.length > 0) {
    suggestions.push({ id: 'social_tasks', reason: `${auto.social_tasks.length} social tasks` });
  }

  // Stats panel — for brand deals (payment), upgrades, or prestige >= 7
  if (['brand_deal', 'upgrade'].includes(type) || event?.is_paid || (event?.prestige || 5) >= 7) {
    suggestions.push({ id: 'stats_panel', reason: event?.is_paid ? 'Financial reveal (paid event)' : 'Stats reveal' });
  }

  return suggestions;
}

// ── GENERATE SINGLE OVERLAY ──────────────────────────────────────────────────

async function generateOverlay(overlayType, showId, options = {}) {
  const customPrompt = options.customPrompt || overlayType.prompt;
  const prompt = STYLE_PREFIX + customPrompt;
  const size = overlayType.size || (overlayType.category === 'icon' ? 'square' : 'portrait');
  const skipBgRemoval = options.skipBgRemoval || false;
  const useCase = overlayType.category === 'icon' ? 'icon' : 'overlay';
  const imageUrl = await generateImageUrl(prompt, { size, quality: 'hd', useCase });

  if (!imageUrl) throw new Error(`Failed to generate ${overlayType.name}`);

  // Download and upload to S3
  const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 60000 });
  let buffer = Buffer.from(imgResponse.data);

  // Remove background → transparent PNG (unless skipped)
  let bgRemoved = false;
  if (!skipBgRemoval && process.env.REMOVEBG_API_KEY) {
    try {
      const bgRes = await axios.post(
        'https://api.remove.bg/v1.0/removebg',
        { image_url: imageUrl, size: 'auto', format: 'png' },
        { headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY }, responseType: 'arraybuffer', timeout: 45000 }
      );
      buffer = Buffer.from(bgRes.data);
      bgRemoved = true;
    } catch (bgErr) {
      console.warn(`[UIOverlay] Background removal failed for ${overlayType.name}:`, bgErr.message);
    }
  }

  const s3Key = `ui-overlays/${showId}/${overlayType.id}-${Date.now()}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: s3Key, Body: buffer,
    ContentType: 'image/png', CacheControl: 'max-age=31536000',
  }));
  const s3Url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

  return { url: s3Url, bg_removed: bgRemoved, prompt_used: customPrompt };
}

// ── REMOVE BACKGROUND FROM EXISTING ASSET ───────────────────────────────────

async function removeBackgroundFromAsset(assetId, models) {
  if (!process.env.REMOVEBG_API_KEY) {
    throw new Error('REMOVEBG_API_KEY not configured');
  }

  // Get the asset
  const [rows] = await models.sequelize.query(
    `SELECT id, s3_url_raw, s3_url_processed, metadata FROM assets WHERE id = :assetId AND deleted_at IS NULL`,
    { replacements: { assetId } }
  );
  if (!rows?.length) throw new Error('Asset not found');

  const asset = rows[0];
  const sourceUrl = asset.s3_url_processed || asset.s3_url_raw;
  if (!sourceUrl) throw new Error('Asset has no image URL');

  // Remove background via remove.bg
  const bgRes = await axios.post(
    'https://api.remove.bg/v1.0/removebg',
    { image_url: sourceUrl, size: 'auto', format: 'png' },
    { headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY }, responseType: 'arraybuffer', timeout: 45000 }
  );
  const buffer = Buffer.from(bgRes.data);

  // Upload to S3 with -nobg suffix
  const meta = typeof asset.metadata === 'string' ? JSON.parse(asset.metadata) : (asset.metadata || {});
  const overlayType = meta.overlay_type || 'unknown';
  const showId = meta.show_id || 'unknown';
  const s3Key = `ui-overlays/${showId}/${overlayType}-nobg-${Date.now()}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: s3Key, Body: buffer,
    ContentType: 'image/png', CacheControl: 'max-age=31536000',
  }));
  const newUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;

  // Update asset with new processed URL
  meta.bg_removed = true;
  meta.bg_removed_at = new Date().toISOString();
  await models.sequelize.query(
    `UPDATE assets SET s3_url_processed = :newUrl, metadata = CAST(:metadata AS jsonb), updated_at = NOW()
     WHERE id = :assetId`,
    { replacements: { newUrl, metadata: JSON.stringify(meta), assetId } }
  );

  return { url: newUrl, bg_removed: true };
}

// ── UPLOAD CUSTOM OVERLAY ───────────────────────────────────────────────────

async function uploadOverlayToS3(buffer, overlayTypeId, showId, contentType) {
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const s3Key = `ui-overlays/${showId}/${overlayTypeId}-custom-${Date.now()}.${ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: s3Key, Body: buffer,
    ContentType: contentType, CacheControl: 'max-age=31536000',
  }));
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

// ── GENERATE ALL OVERLAYS FOR SHOW ───────────────────────────────────────────

async function generateAllOverlays(showId, models, options = {}) {
  const { skipExisting = true, batchSize = 3, episodeId = null } = options;
  const results = [];

  // Check which overlays already exist
  let existingTypes = new Set();
  if (skipExisting) {
    const existing = await getShowOverlays(showId, models);
    existingTypes = new Set(existing.map(e => e.overlay_type));
  }

  // Include both hardcoded and custom overlay types
  const allTypes = await getAllOverlayTypes(showId, models);

  // Lifecycle-aware filtering:
  // - permanent: skip if already generated (regardless of episode)
  // - per_episode: always regenerate when episodeId provided, skip show-level generate
  // - variant: skip if base frame exists (variants are filled at episode level)
  const toGenerate = allTypes.filter(ot => {
    const lifecycle = ot.lifecycle || 'permanent';
    if (existingTypes.has(ot.id)) {
      return lifecycle === 'per_episode' && episodeId;
    }
    if (lifecycle === 'per_episode') return !!episodeId;
    return true;
  });
  console.log(`[UIOverlay] Generating ${toGenerate.length} overlays (${existingTypes.size} already exist, batch size ${batchSize})`);

  // Process in parallel batches
  for (let i = 0; i < toGenerate.length; i += batchSize) {
    const batch = toGenerate.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (overlayType) => {
        console.log(`[UIOverlay] Generating: ${overlayType.name}...`);
        const { url, bg_removed } = await generateOverlay(overlayType, showId);

        // Save asset via raw SQL (avoid model column mismatch)
        const lifecycle = overlayType.lifecycle || 'permanent';
        let assetId = null;
        try {
          const assetUuid = uuidv4();
          // Per-episode overlays: soft-delete old version for this episode first
          if (lifecycle === 'per_episode' && episodeId) {
            await models.sequelize.query(
              `UPDATE assets SET deleted_at = NOW() WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId
               AND episode_id = :episodeId AND metadata::text LIKE :typePattern AND deleted_at IS NULL`,
              { replacements: { showId, episodeId, typePattern: `%"overlay_type": "${overlayType.id}"%` } }
            );
          }
          await models.sequelize.query(
            `INSERT INTO assets (id, name, asset_type, s3_url_raw, s3_url_processed, show_id, episode_id, metadata, created_at, updated_at)
             VALUES (:id, :name, 'UI_OVERLAY', :url, :url, :showId, :episodeId, :metadata, NOW(), NOW())`,
            { replacements: {
              id: assetUuid,
              name: `UI Overlay: ${overlayType.name}`,
              url,
              showId,
              episodeId: (lifecycle === 'per_episode' ? episodeId : null),
              metadata: JSON.stringify({
                source: 'ui-overlay-generator',
                overlay_type: overlayType.id,
                overlay_beat: overlayType.beat,
                overlay_category: overlayType.category,
                overlay_lifecycle: lifecycle,
                episode_id: (lifecycle === 'per_episode' ? episodeId : null),
                bg_removed,
                generated_at: new Date().toISOString(),
              }),
            } }
          );
          assetId = assetUuid;
          console.log(`[UIOverlay] Asset saved: ${overlayType.name} → ${assetUuid}`);
        } catch (assetErr) {
          console.error(`[UIOverlay] Asset save FAILED for ${overlayType.name}:`, assetErr.message);
        }

        return {
          overlay_type: overlayType.id,
          name: overlayType.name,
          beat: overlayType.beat,
          url,
          bg_removed,
          asset_id: assetId,
        };
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const failedType = batch[batchResults.indexOf(result)];
        console.error(`[UIOverlay] Failed: ${failedType?.name}:`, result.reason?.message);
        results.push({ overlay_type: failedType?.id, name: failedType?.name, error: result.reason?.message });
      }
    }

    console.log(`[UIOverlay] Batch ${Math.floor(i / batchSize) + 1} complete (${results.filter(r => r.url).length} total generated)`);
  }

  console.log(`[UIOverlay] Done: ${results.filter(r => r.url).length}/${toGenerate.length} generated`);
  return results;
}

// ── GET ALL OVERLAY TYPES (hardcoded + custom from DB) ──────────────────────

async function getAllOverlayTypes(showId, models) {
  const customTypes = await getCustomOverlayTypes(showId, models);
  // Custom types override hardcoded ones with same id/type_key
  const customKeys = new Set(customTypes.map(c => c.id));
  const defaults = OVERLAY_TYPES.filter(ot => !customKeys.has(ot.id));
  return [...defaults, ...customTypes];
}

async function getCustomOverlayTypes(showId, models) {
  try {
    const [rows] = await models.sequelize.query(
      `SELECT id, type_key, name, category, beat, description, prompt, sort_order
       FROM ui_overlay_types WHERE show_id = :showId AND deleted_at IS NULL
       ORDER BY sort_order ASC, name ASC`,
      { replacements: { showId } }
    );
    return (rows || []).map(r => ({
      id: r.type_key,
      name: r.name,
      category: r.category || 'icon',
      beat: r.beat || '',
      description: r.description || '',
      prompt: r.prompt,
      sort_order: r.sort_order,
      custom: true,
      custom_id: r.id,
    }));
  } catch (err) {
    console.error('[UIOverlay] getCustomOverlayTypes failed:', err.message);
    return [];
  }
}

// ── GET EXISTING OVERLAYS FOR SHOW ───────────────────────────────────────────

async function getShowOverlays(showId, models) {
  try {
    // Cast metadata to text to avoid JSONB parsing issues in some Sequelize/pg versions
    const [rows] = await models.sequelize.query(
      `SELECT id, name, asset_type, asset_role,
              s3_url_processed, s3_url_raw,
              metadata::text as metadata_text,
              approval_status
       FROM assets
       WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId AND deleted_at IS NULL
       ORDER BY name ASC`,
      { replacements: { showId } }
    );

    if (!rows || rows.length === 0) {
      // Fallback: also check for overlays stored with asset_role containing 'UI.OVERLAY'
      try {
        const [fb] = await models.sequelize.query(
          `SELECT id, name, asset_type, asset_role,
                  s3_url_processed, s3_url_raw,
                  metadata::text as metadata_text,
                  approval_status
           FROM assets
           WHERE show_id = :showId AND deleted_at IS NULL
           AND (
             asset_role LIKE 'UI.OVERLAY.%'
             OR LOWER(asset_type) = 'ui_overlay'
             OR name LIKE 'UI Overlay:%'
           )
           ORDER BY name ASC`,
          { replacements: { showId } }
        );
        if (fb && fb.length > 0) {
          console.log(`[UIOverlay] Found ${fb.length} overlays via fallback query`);
          return mapOverlayRows(fb);
        }
      } catch (fbErr) {
        console.error('[UIOverlay] Fallback query failed:', fbErr.message);
      }
      return [];
    }

    return mapOverlayRows(rows);
  } catch (err) {
    console.error('[UIOverlay] getShowOverlays failed:', err.message);
    return [];
  }
}

function mapOverlayRows(rows) {
  return rows.map(r => {
    let meta = {};
    try {
      meta = r.metadata_text ? JSON.parse(r.metadata_text) : {};
    } catch { /* malformed JSON — use empty */ }

    const overlayType = meta.overlay_type
      || (r.asset_role ? r.asset_role.replace('UI.OVERLAY.', '').toLowerCase() : null)
      || (r.name ? r.name.replace('UI Overlay: ', '').toLowerCase().replace(/\s+/g, '_') : null)
      || r.name;

    return {
      ...r,
      metadata: meta,
      overlay_type: overlayType,
      beat: meta.overlay_beat || '',
      url: r.s3_url_processed || r.s3_url_raw,
    };
  });
}

module.exports = {
  OVERLAY_TYPES,
  SHOW_OVERLAYS,
  EPISODE_OVERLAYS,
  STYLE_PREFIX,
  generateOverlay,
  generateAllOverlays,
  getAllOverlayTypes,
  getCustomOverlayTypes,
  getShowOverlays,
  removeBackgroundFromAsset,
  uploadOverlayToS3,
  suggestOverlaysForEvent,
};
