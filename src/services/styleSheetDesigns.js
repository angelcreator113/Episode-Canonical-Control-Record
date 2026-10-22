/**
 * The Style Page's five designs (Evoni, 2026-10-22: LaLa_Canva_Style_Sheets
 * .pptx, "All 5 every episode"): The Episode Look, The Style Diary, Runway
 * to Reality, The Color Story and Invited to Slay. Each one is data, read
 * from her deck: every frame, line and line of text at its place on the
 * 960 x 1440 page (one deck pixel = one unit), its colours, sizes and fonts
 * (Georgia's headings print in Gelasio, its metric twin; Aptos in DM Sans).
 *
 * One description drives both drawings, so they cannot drift: the server
 * draws it on a canvas (styleSheetRenderService.drawDesign) and the Style
 * Page lays it out in HTML (StyleDesign.jsx, from GET /style-sheet's
 * `designs`).
 *
 * Element kinds:
 *   photo   a framed photo spot: `spot` is the shared spot it shows (see
 *           designPhotos), `label` the deck's caption under ADD PHOTO
 *   text    fixed text, or a `field` filled from the episode (designFields)
 *           with the deck's `placeholder` while it is empty
 *   box     a framed panel (behind a caption)
 *   swatch  one palette circle, `index` 0..5
 *   rule    a line (the footer's gold rule)
 *
 * Every design comes in six sizes (Evoni: "fit with a matching border"):
 * the whole design is shown, centred, and the design's background fills
 * the rest.
 */

const DESIGN_WIDTH = 960;
const DESIGN_HEIGHT = 1440;

const DESIGNS = Object.freeze([
  {
    key: "episode_look", name: "The Episode Look", number: "01", background: "#FFF9F5",
    elements: [
      { kind: "text", x: 48.0, y: 24.0, w: 864.0, h: 42.2, text: "STYLING ADVENTURES", size: 37.3, color: "#BE955B", font: "serif", bold: false, italic: false, align: "center" },
      { kind: "text", x: 48.0, y: 67.2, w: 864.0, h: 48.0, text: "with LaLa", size: 40.0, color: "#5A3769", font: "serif", bold: false, italic: true, align: "center" },
      { kind: "text", x: 57.6, y: 129.6, w: 844.8, h: 28.8, size: 16.0, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center", field: "episode_event", placeholder: "EPISODE  __  •  EVENT / VENUE" },
      { kind: "text", x: 57.6, y: 174.7, w: 844.8, h: 62.4, text: "THE EPISODE LOOK", size: 37.3, color: "#38283B", font: "serif", bold: true, italic: false, align: "center" },
      { kind: "photo", spot: "hero", label: "HERO / LALA", x: 52.8, y: 244.8, w: 528.0, h: 494.4, fill: "#F6D8E6", radius: 11.5 },
      { kind: "photo", spot: "venue", label: "VENUE", x: 595.2, y: 244.8, w: 312.0, h: 232.3, fill: "#DCC9F1", radius: 11.5 },
      { kind: "photo", spot: "inspo", label: "FASHION INSPIRATION", x: 595.2, y: 491.5, w: 312.0, h: 247.7, fill: "#DCEAF4", radius: 11.5 },
      { kind: "text", x: 52.8, y: 758.4, w: 854.4, h: 33.6, text: "THE LOOK • THREE ANGLES", size: 24.0, color: "#5A3769", font: "serif", bold: false, italic: false, align: "left" },
      { kind: "photo", spot: "front", label: "FRONT", x: 52.8, y: 801.6, w: 271.7, h: 230.4, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "side", label: "SIDE", x: 343.7, y: 801.6, w: 271.7, h: 230.4, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "back", label: "BACK", x: 634.6, y: 801.6, w: 271.7, h: 230.4, fill: "#FFF9F5", radius: 11.5 },
      { kind: "text", x: 52.8, y: 1057.9, w: 854.4, h: 28.8, text: "WARDROBE BREAKDOWN", size: 24.0, color: "#5A3769", font: "serif", bold: false, italic: false, align: "center" },
      { kind: "photo", spot: "body", label: "OUTFIT", x: 52.8, y: 1096.3, w: 113.3, h: 211.2, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "shoes", label: "SHOES", x: 175.7, y: 1096.3, w: 113.3, h: 211.2, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "bag", label: "PURSE", x: 298.6, y: 1096.3, w: 113.3, h: 211.2, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "jewelry", label: "JEWELRY", x: 421.4, y: 1096.3, w: 113.3, h: 211.2, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "hair", label: "HAIR", x: 544.3, y: 1096.3, w: 113.3, h: 211.2, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "perfume", label: "PERFUME", x: 667.2, y: 1096.3, w: 113.3, h: 211.2, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "nails", label: "NAILS", x: 790.1, y: 1096.3, w: 113.3, h: 211.2, fill: "#FFF9F5", radius: 11.5 },
      { kind: "rule", x: 52.8, y: 1396.8, w: 854.4, h: 0.0, color: "#BE955B", width: 2.0 },
      { kind: "text", x: 57.6, y: 1403.5, w: 844.8, h: 22.1, text: "LaLaVerse   •   FASHION  /  ATTENTION  /  MONEY", size: 14.7, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center" },
      { kind: "text", x: 871.7, y: 1365.1, w: 38.4, h: 19.2, text: "01", size: 13.3, color: "#BE955B", font: "sans", bold: false, italic: false, align: "left" },
    ],
  },
  {
    key: "style_diary", name: "The Style Diary", number: "02", background: "#F9EDF5",
    elements: [
      { kind: "text", x: 48.0, y: 24.0, w: 864.0, h: 42.2, text: "STYLING ADVENTURES", size: 37.3, color: "#BE955B", font: "serif", bold: false, italic: false, align: "center" },
      { kind: "text", x: 48.0, y: 67.2, w: 864.0, h: 48.0, text: "with LaLa", size: 40.0, color: "#5A3769", font: "serif", bold: false, italic: true, align: "center" },
      { kind: "text", x: 57.6, y: 129.6, w: 844.8, h: 28.8, size: 16.0, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center", field: "episode_look", placeholder: "EPISODE  __  •  LOOK  __" },
      { kind: "text", x: 57.6, y: 174.7, w: 844.8, h: 62.4, text: "THE STYLE DIARY", size: 37.3, color: "#38283B", font: "serif", bold: true, italic: false, align: "center" },
      { kind: "text", x: 67.2, y: 225.6, w: 825.6, h: 33.6, text: "A little fashion. A lot of story.", size: 22.7, color: "#5A3769", font: "serif", bold: false, italic: true, align: "center" },
      { kind: "photo", spot: "hero", label: "MAIN OUTFIT", x: 57.6, y: 283.2, w: 528.0, h: 580.8, fill: "#FFFFFF", radius: 11.5 },
      { kind: "photo", spot: "detail", label: "DETAIL SHOT", x: 609.6, y: 305.3, w: 288.0, h: 259.2, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "venue", label: "VENUE MOOD", x: 609.6, y: 587.5, w: 288.0, h: 254.4, fill: "#DCC9F1", radius: 11.5 },
      { kind: "text", x: 62.4, y: 897.6, w: 835.2, h: 38.4, text: "THE DETAILS", size: 26.7, color: "#5A3769", font: "serif", bold: false, italic: false, align: "left" },
      { kind: "photo", spot: "shoes", label: "SHOES", x: 62.4, y: 950.4, w: 195.8, h: 240.0, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "bag", label: "BAG", x: 277.4, y: 950.4, w: 195.8, h: 240.0, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "jewelry", label: "JEWELRY", x: 492.5, y: 950.4, w: 195.8, h: 240.0, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "beauty", label: "BEAUTY", x: 707.5, y: 950.4, w: 195.8, h: 240.0, fill: "#FFF9F5", radius: 11.5 },
      { kind: "box", x: 62.4, y: 1224.0, w: 835.2, h: 124.8, fill: "#FFFFFF", stroke: "#E8B9CA", radius: 17.3 },
      { kind: "text", x: 86.4, y: 1238.4, w: 787.2, h: 28.8, text: "STYLE NOTES / CAPTION", size: 18.7, color: "#BE955B", font: "sans", bold: true, italic: false, align: "left" },
      { kind: "text", x: 86.4, y: 1274.9, w: 787.2, h: 43.2, size: 18.7, color: "#5A3769", font: "sans", bold: false, italic: false, align: "left", field: "tagline", placeholder: "Add a quote, fashion story, or episode moment here." },
      { kind: "rule", x: 52.8, y: 1396.8, w: 854.4, h: 0.0, color: "#BE955B", width: 2.0 },
      { kind: "text", x: 57.6, y: 1403.5, w: 844.8, h: 22.1, text: "LaLaVerse   •   FASHION  /  ATTENTION  /  MONEY", size: 14.7, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center" },
      { kind: "text", x: 871.7, y: 1365.1, w: 38.4, h: 19.2, text: "02", size: 13.3, color: "#BE955B", font: "sans", bold: false, italic: false, align: "left" },
    ],
  },
  {
    key: "runway", name: "Runway to Reality", number: "03", background: "#F9F4FA",
    elements: [
      { kind: "text", x: 48.0, y: 24.0, w: 864.0, h: 42.2, text: "STYLING ADVENTURES", size: 37.3, color: "#BE955B", font: "serif", bold: false, italic: false, align: "center" },
      { kind: "text", x: 48.0, y: 67.2, w: 864.0, h: 48.0, text: "with LaLa", size: 40.0, color: "#5A3769", font: "serif", bold: false, italic: true, align: "center" },
      { kind: "text", x: 57.6, y: 129.6, w: 844.8, h: 28.8, size: 16.0, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center", field: "episode_event", placeholder: "EPISODE  __  •  EVENT / VENUE" },
      { kind: "text", x: 57.6, y: 174.7, w: 844.8, h: 62.4, text: "RUNWAY TO REALITY", size: 37.3, color: "#38283B", font: "serif", bold: true, italic: false, align: "center" },
      { kind: "text", x: 57.6, y: 228.5, w: 844.8, h: 28.8, size: 17.3, color: "#BE955B", font: "sans", bold: true, italic: false, align: "center", field: "look_city_occasion", placeholder: "LOOK  __   |   CITY  __   |   OCCASION  __" },
      { kind: "photo", spot: "hero", label: "FULL BODY HERO", x: 62.4, y: 273.6, w: 484.8, h: 782.4, fill: "#DCC9F1", radius: 11.5 },
      { kind: "photo", spot: "detail", label: "OUTFIT DETAIL", x: 571.2, y: 273.6, w: 326.4, h: 374.4, fill: "#F6D8E6", radius: 11.5 },
      { kind: "photo", spot: "back", label: "BACK VIEW", x: 571.2, y: 670.1, w: 326.4, h: 385.9, fill: "#FFF9F5", radius: 11.5 },
      { kind: "text", x: 62.4, y: 1081.0, w: 835.2, h: 33.6, text: "THE FINISHING TOUCHES", size: 25.3, color: "#5A3769", font: "serif", bold: false, italic: false, align: "left" },
      { kind: "photo", spot: "shoes", label: "SHOES", x: 62.4, y: 1130.9, w: 192.0, h: 232.3, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "bag", label: "PURSE", x: 273.6, y: 1130.9, w: 192.0, h: 232.3, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "jewelry", label: "ACCESSORIES", x: 484.8, y: 1130.9, w: 192.0, h: 232.3, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "hair", label: "HAIR", x: 696.0, y: 1130.9, w: 192.0, h: 232.3, fill: "#FFF9F5", radius: 11.5 },
      { kind: "rule", x: 52.8, y: 1396.8, w: 854.4, h: 0.0, color: "#BE955B", width: 2.0 },
      { kind: "text", x: 57.6, y: 1403.5, w: 844.8, h: 22.1, text: "LaLaVerse   •   FASHION  /  ATTENTION  /  MONEY", size: 14.7, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center" },
      { kind: "text", x: 871.7, y: 1365.1, w: 38.4, h: 19.2, text: "03", size: 13.3, color: "#BE955B", font: "sans", bold: false, italic: false, align: "left" },
    ],
  },
  {
    key: "color_story", name: "The Color Story", number: "04", background: "#F6F1FC",
    elements: [
      { kind: "text", x: 48.0, y: 24.0, w: 864.0, h: 42.2, text: "STYLING ADVENTURES", size: 37.3, color: "#BE955B", font: "serif", bold: false, italic: false, align: "center" },
      { kind: "text", x: 48.0, y: 67.2, w: 864.0, h: 48.0, text: "with LaLa", size: 40.0, color: "#5A3769", font: "serif", bold: false, italic: true, align: "center" },
      { kind: "text", x: 57.6, y: 129.6, w: 844.8, h: 28.8, size: 16.0, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center", field: "episode_event", placeholder: "EPISODE  __  •  EVENT / VENUE" },
      { kind: "text", x: 57.6, y: 174.7, w: 844.8, h: 62.4, text: "THE COLOR STORY", size: 37.3, color: "#38283B", font: "serif", bold: true, italic: false, align: "center" },
      { kind: "text", x: 62.4, y: 226.6, w: 835.2, h: 33.6, text: "MOOD  •  TEXTURE  •  SILHOUETTE", size: 20.0, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center" },
      { kind: "photo", spot: "hero", label: "MAIN LOOK", x: 62.4, y: 281.3, w: 398.4, h: 518.4, fill: "#FFFFFF", radius: 11.5 },
      { kind: "photo", spot: "venue", label: "VENUE / SETTING", x: 484.8, y: 281.3, w: 412.8, h: 240.0, fill: "#DCEAF4", radius: 11.5 },
      { kind: "photo", spot: "inspo", label: "INSPIRATION", x: 484.8, y: 542.4, w: 412.8, h: 257.3, fill: "#F6D8E6", radius: 11.5 },
      { kind: "text", x: 67.2, y: 825.6, w: 825.6, h: 32.6, text: "PALETTE", size: 26.7, color: "#5A3769", font: "serif", bold: false, italic: false, align: "left" },
      { kind: "swatch", index: 0, x: 86.4, y: 876.5, w: 91.2, h: 91.2, fill: "#E8B9CA" },
      { kind: "swatch", index: 1, x: 222.7, y: 876.5, w: 91.2, h: 91.2, fill: "#DCC9F1" },
      { kind: "swatch", index: 2, x: 359.0, y: 876.5, w: 91.2, h: 91.2, fill: "#BE955B" },
      { kind: "swatch", index: 3, x: 495.4, y: 876.5, w: 91.2, h: 91.2, fill: "#DCEAF4" },
      { kind: "swatch", index: 4, x: 631.7, y: 876.5, w: 91.2, h: 91.2, fill: "#E7B9A7" },
      { kind: "swatch", index: 5, x: 768.0, y: 876.5, w: 91.2, h: 91.2, fill: "#FFF9F5" },
      { kind: "text", x: 67.2, y: 993.6, w: 825.6, h: 32.6, text: "BEAUTY + ACCESSORIES", size: 25.3, color: "#5A3769", font: "serif", bold: false, italic: false, align: "left" },
      { kind: "photo", spot: "hair", label: "HAIR", x: 62.4, y: 1048.3, w: 151.7, h: 244.8, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "beauty", label: "MAKEUP", x: 233.3, y: 1048.3, w: 151.7, h: 244.8, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "nails", label: "NAILS", x: 404.2, y: 1048.3, w: 151.7, h: 244.8, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "jewelry", label: "JEWELRY", x: 575.0, y: 1048.3, w: 151.7, h: 244.8, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "bag", label: "BAG", x: 745.9, y: 1048.3, w: 151.7, h: 244.8, fill: "#FFF9F5", radius: 11.5 },
      { kind: "box", x: 62.4, y: 1315.2, w: 835.2, h: 45.1, fill: "#FFFFFF", stroke: "#E8B9CA", radius: 17.3 },
      { kind: "text", x: 76.8, y: 1322.9, w: 806.4, h: 24.0, size: 16.0, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center", field: "mood", placeholder: "EPISODE MOOD:  [ ADD YOUR DESCRIPTION ]" },
      { kind: "rule", x: 52.8, y: 1396.8, w: 854.4, h: 0.0, color: "#BE955B", width: 2.0 },
      { kind: "text", x: 57.6, y: 1403.5, w: 844.8, h: 22.1, text: "LaLaVerse   •   FASHION  /  ATTENTION  /  MONEY", size: 14.7, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center" },
      { kind: "text", x: 871.7, y: 1365.1, w: 38.4, h: 19.2, text: "04", size: 13.3, color: "#BE955B", font: "sans", bold: false, italic: false, align: "left" },
    ],
  },
  {
    key: "invited", name: "Invited to Slay", number: "05", background: "#FFF9F5",
    elements: [
      { kind: "text", x: 48.0, y: 24.0, w: 864.0, h: 42.2, text: "STYLING ADVENTURES", size: 37.3, color: "#BE955B", font: "serif", bold: false, italic: false, align: "center" },
      { kind: "text", x: 48.0, y: 67.2, w: 864.0, h: 48.0, text: "with LaLa", size: 40.0, color: "#5A3769", font: "serif", bold: false, italic: true, align: "center" },
      { kind: "text", x: 57.6, y: 129.6, w: 844.8, h: 28.8, size: 16.0, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center", field: "episode_event_name", placeholder: "EPISODE  __  •  EVENT  __" },
      { kind: "text", x: 57.6, y: 174.7, w: 844.8, h: 62.4, text: "INVITED TO SLAY", size: 37.3, color: "#38283B", font: "serif", bold: true, italic: false, align: "center" },
      { kind: "box", x: 57.6, y: 235.2, w: 844.8, h: 100.8, fill: "#F6D8E6", stroke: "#BE955B", radius: 17.3 },
      { kind: "text", x: 76.8, y: 254.4, w: 806.4, h: 28.8, size: 24.0, color: "#5A3769", font: "sans", bold: true, italic: false, align: "center", field: "event_host_city", placeholder: "EVENT NAME / HOST / DREAM CITY" },
      { kind: "text", x: 76.8, y: 292.8, w: 806.4, h: 22.1, size: 16.0, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center", field: "date_dress_vibe", placeholder: "DATE  __   •   DRESS CODE  __   •   VIBE  __" },
      { kind: "photo", spot: "hero", label: "LALA FINAL LOOK", x: 57.6, y: 360.0, w: 523.2, h: 590.4, fill: "#DCC9F1", radius: 11.5 },
      { kind: "photo", spot: "venue", label: "EVENT VENUE", x: 604.8, y: 360.0, w: 297.6, h: 283.2, fill: "#DCEAF4", radius: 11.5 },
      { kind: "photo", spot: "inspo", label: "FASHION REFERENCE", x: 604.8, y: 667.2, w: 297.6, h: 283.2, fill: "#F6D8E6", radius: 11.5 },
      { kind: "text", x: 62.4, y: 984.0, w: 835.2, h: 33.6, text: "LOOK CHECKLIST", size: 26.7, color: "#5A3769", font: "serif", bold: false, italic: false, align: "left" },
      { kind: "photo", spot: "body", label: "OUTFIT", x: 57.6, y: 1041.6, w: 113.3, h: 206.4, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "shoes", label: "SHOES", x: 180.5, y: 1041.6, w: 113.3, h: 206.4, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "bag", label: "BAG", x: 303.4, y: 1041.6, w: 113.3, h: 206.4, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "jewelry", label: "JEWELRY", x: 426.2, y: 1041.6, w: 113.3, h: 206.4, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "hair", label: "HAIR", x: 549.1, y: 1041.6, w: 113.3, h: 206.4, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "perfume", label: "PERFUME", x: 672.0, y: 1041.6, w: 113.3, h: 206.4, fill: "#FFF9F5", radius: 11.5 },
      { kind: "photo", spot: "nails", label: "NAILS", x: 794.9, y: 1041.6, w: 113.3, h: 206.4, fill: "#FFF9F5", radius: 11.5 },
      { kind: "box", x: 62.4, y: 1276.8, w: 835.2, h: 69.1, fill: "#FFFFFF", stroke: "#BE955B", radius: 17.3 },
      { kind: "text", x: 81.6, y: 1294.1, w: 796.8, h: 28.8, size: 16.0, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center", field: "tagline", placeholder: "EPISODE CAPTION / STYLE RATING / STORY NOTE" },
      { kind: "rule", x: 52.8, y: 1396.8, w: 854.4, h: 0.0, color: "#BE955B", width: 2.0 },
      { kind: "text", x: 57.6, y: 1403.5, w: 844.8, h: 22.1, text: "LaLaVerse   •   FASHION  /  ATTENTION  /  MONEY", size: 14.7, color: "#5A3769", font: "sans", bold: false, italic: false, align: "center" },
      { kind: "text", x: 871.7, y: 1365.1, w: 38.4, h: 19.2, text: "05", size: 13.3, color: "#BE955B", font: "sans", bold: false, italic: false, align: "left" },
    ],
  },
]);

const SIZES = Object.freeze({
  pinterest: { width: 1000, height: 1500, label: 'Pinterest' },
  fb_feed: { width: 1080, height: 1350, label: 'Facebook feed' },
  fb_story: { width: 1080, height: 1920, label: 'Facebook story' },
  ig_feed: { width: 1080, height: 1350, label: 'Instagram feed' },
  ig_story: { width: 1080, height: 1920, label: 'Instagram story' },
  tiktok: { width: 1080, height: 1920, label: 'TikTok' },
});

const findDesign = (key) => DESIGNS.find((d) => d.key === key) || null;

/** Where the design sits inside a size: scale and offsets (centred, whole). */
function fitDesign(size) {
  const scale = Math.min(size.width / DESIGN_WIDTH, size.height / DESIGN_HEIGHT);
  return { scale, x: (size.width - DESIGN_WIDTH * scale) / 2, y: (size.height - DESIGN_HEIGHT * scale) / 2 };
}

const BEAUTY = ['eyes', 'lips', 'skin'];
const COLUMN_SPOTS = ['body', 'shoes', 'bag', 'jewelry', 'hair', 'perfume', 'nails'];

/**
 * Where each photo spot's picture is in the sheet GET /style-sheet builds:
 * a path like "look.hero" or "wardrobe.columns.2.image", or null. The main
 * photo falls back to Front; Beauty is the first of eyes, lips, skin; the
 * wardrobe spots are the sheet's WARDROBE BREAKDOWN columns (the saved
 * look's pieces, her hair and nails photos). The Style Page reads the same
 * paths (`design_values.photo_paths`), so the sheet's pictures are sent once.
 */
function designPhotoPaths(sheet) {
  const look = sheet.look || {};
  const first = (...paths) => paths.find((p) => Boolean(at(sheet, p))) || null;
  const columns = sheet.wardrobe?.columns || [];
  const out = {
    hero: first('look.hero', 'look.front'),
    front: first('look.front'),
    side: first('look.side'),
    back: first('look.back'),
    detail: look.detail ? 'look.detail' : null,
    venue: first('venue.image'),
    inspo: first('inspo.photos.0.image', 'inspo.textures.0.image'),
    beauty: first(...BEAUTY.map((k) => `beauty.${k}`)),
  };
  for (const key of COLUMN_SPOTS) {
    const i = columns.findIndex((c) => c.key === key);
    out[key] = i >= 0 ? first(`wardrobe.columns.${i}.image`) : null;
  }
  return out;
}

/** The value at a dotted path ("wardrobe.columns.2.image"), or undefined. */
function at(obj, path) {
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Each photo spot's picture (a data URL), or null. */
function designPhotos(sheet) {
  return Object.fromEntries(Object.entries(designPhotoPaths(sheet)).map(([spot, p]) => [spot, p ? at(sheet, p) : null]));
}

const clean = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const upper = (v) => (v ? v.toUpperCase() : v);
const joined = (parts, sep) => {
  const present = parts.filter(([, v]) => clean(v));
  return present.length ? present.map(([label, v]) => (label ? `${label} ${clean(v)}` : clean(v))).join(sep) : null;
};

/**
 * Each text field's words from the episode's own data, or null (the deck's
 * placeholder then shows). Nothing is invented: a missing part is left out.
 */
function designFields(sheet) {
  const ep = sheet.episode?.label || null; // "EPISODE 01"
  const event = sheet.event || {};
  const venue = sheet.venue || {};
  const withEpisode = (rest) => (ep || rest ? [ep, rest].filter(Boolean).join('  •  ') : null);
  // The deck sets these lines in capitals.
  return {
    episode_event: upper(withEpisode(joined([[null, event.name], [null, venue.name]], ' / '))),
    episode_event_name: upper(withEpisode(joined([['EVENT', event.name]], ''))),
    episode_look: upper(withEpisode(joined([['LOOK', sheet.episode?.title]], ''))),
    look_city_occasion: upper(joined([['LOOK', sheet.episode?.title], ['CITY', venue.chip], ['OCCASION', event.type]], '   |   ')),
    event_host_city: upper(joined([[null, event.name], [null, event.host], [null, venue.chip]], ' / ')),
    date_dress_vibe: upper(joined([['DATE', event.when], ['DRESS CODE', event.dress_code], ['VIBE', event.vibe]], '   •   ')),
    tagline: clean(sheet.tagline),
    mood: Array.isArray(sheet.mood_words) && sheet.mood_words.length ? `EPISODE MOOD:  ${sheet.mood_words.join(' · ')}` : null,
  };
}

/** The five palette circles' colours: her saved palette, else the deck's. */
function designPalette(sheet) {
  return (Array.isArray(sheet.palette) ? sheet.palette : []).map((s) => s && s.hex).filter(Boolean);
}

/** The spots each design shows, for "Used in N of 5" and "Not on this design". */
function designSpots(design) {
  return [...new Set(design.elements.filter((e) => e.kind === 'photo').map((e) => e.spot))];
}

/** What the Style Page needs to lay the designs out: the designs, the sizes, and this sheet's values. */
function designsForPage(sheet) {
  return {
    designs: DESIGNS,
    sizes: Object.entries(SIZES).map(([key, s]) => ({ key, ...s })),
    values: { photo_paths: designPhotoPaths(sheet), fields: designFields(sheet), palette: designPalette(sheet) },
  };
}

module.exports = {
  DESIGNS, SIZES, DESIGN_WIDTH, DESIGN_HEIGHT, findDesign, fitDesign,
  designPhotoPaths, designPhotos, designFields, designPalette, designSpots, designsForPage,
};
