# Thumbnail Composer Visual Reference
## Complete Redesign - "Select Ingredients" Model

---

## 🎨 PAGE LAYOUT OVERVIEW

```
┌────────────────────────────────────────────────────────────────┐
│ 🎬 Thumbnail Composer                                          │
│ Episode → Assets → Generate                                     │
│                                                                 │
│ [●──●──○] Step Progress Indicator                              │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 🔵 PURPOSE BAR (Blue Gradient)                                 │
│                                                                 │
│ Step 2: Select Ingredients                                     │
│ Choose which assets this thumbnail will use.                   │
│ You'll design layout and styling in Template Studio next. ✨   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ SELECTION SUMMARY (White Card)                                 │
│                                                                 │
│ [✓] Required: 3/4  •  [✨] Optional: 12 selected              │
└────────────────────────────────────────────────────────────────┘

⚠️ [BLOCKING ERRORS - Only if missing required]
   Missing required: Main Host, Co-Host

┌────────────────────────────────────────────────────────────────┐
│ ▼ 👥 Characters [Required] [3/4] ◄── EXPANDED                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│ │ 👤 Main Host │ │ 👥 Co-Host   │ │ 🎭 Guest     │           │
│ │ ✅ Selected  │ │ ✅ Selected  │ │ ⏳ Missing   │           │
│ │              │ │              │ │              │           │
│ │ [Picker...]  │ │ [Picker...]  │ │ [Picker...]  │           │
│ └──────────────┘ └──────────────┘ └──────────────┘           │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ ▶ ✨ Icons [Optional] [3 selected]  ◄── COLLAPSED             │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ ▶ 👗 Wardrobe Showcase [Optional] [0 selected]                │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ ▶ 🖱️ UI Chrome [Optional] [1 selected]                        │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ ▶ 🎨 Branding [Optional] [2 selected]                         │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ ▶ 🖼️ Background [Optional] [1 selected]                       │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ ▶ 📝 Text Fields [Optional] [2 filled]                        │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ 📐 Output Formats                                              │
│ You can regenerate formats later.                             │
│                                                                 │
│ [✓] YouTube  [ ] Twitter  [✓] Instagram  [ ] TikTok          │
└────────────────────────────────────────────────────────────────┘

                    [SCROLL SPACE]

╔════════════════════════════════════════════════════════════════╗
║ STICKY BOTTOM BAR (Always Visible)                            ║
║                                                                ║
║ [← Back]                     [Continue to Template Studio →]  ║
╚════════════════════════════════════════════════════════════════╝
```

---

## 🔍 EXPANDED SECTION DETAIL

### When Icons Section is Expanded:

```
┌────────────────────────────────────────────────────────────────┐
│ ▼ ✨ Icons [Optional] [3 selected]                            │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ℹ️ Icon Holder will be added automatically when icons selected │
│                                                                 │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│ │ 🎮 Icon1 │ │ 🎯 Icon2 │ │ 🎨 Icon3 │ │ 🎭 Icon4 │          │
│ │     ✓    │ │     ✓    │ │     ✓    │ │          │          │
│ │ [Picker] │ │ [Picker] │ │ [Picker] │ │ [Picker] │          │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└────────────────────────────────────────────────────────────────┘
```

### When Text Fields Section is Expanded:

```
┌────────────────────────────────────────────────────────────────┐
│ ▼ 📝 Text Fields [Optional] [2 filled]                        │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 📝 Show Title                                                  │
│ [Enter show title...                              ]            │
│ Optional - leave blank if not needed                           │
│                                                                 │
│ 📝 Episode Number                                              │
│ [Enter episode number...                          ]            │
│ Optional - leave blank if not needed                           │
│                                                                 │
│ 📝 Custom Text                                                 │
│ [Enter custom text...                             ]            │
│ Optional - leave blank if not needed                           │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎯 STATUS INDICATORS

### Character Card States:

**SELECTED STATE**
```
┌──────────────────┐
│ 👤 Main Host     │ ◄── Green border
│ ✅ Selected      │ ◄── Green background pill
│                  │
│ [Asset Preview]  │
│ [Laura Smith]    │
└──────────────────┘
```

**MISSING STATE (Required)**
```
┌──────────────────┐
│ 🎭 Guest         │ ◄── Yellow border
│ ⏳ Missing       │ ◄── Yellow background pill
│                  │
│ [+ Select Asset] │
└──────────────────┘
```

### Section Header Badges:

```
[Required]  ◄── Red text, pink background, uppercase
[Optional]  ◄── Purple text, purple background, uppercase
[3/4]       ◄── Count badge, gray background
```

---

## 🌈 COLOR SYSTEM

### Status Colors:
- **Selected**: Green (#10b981) border, light green (#ecfdf5) bg
- **Missing**: Yellow (#fbbf24) border, light yellow (#fffbeb) bg
- **Required Badge**: Red (#dc2626) text, light red (#fee2e2) bg
- **Optional Badge**: Purple (#7c3aed) text, light purple (#ede9fe) bg

### Section Colors:
- **Purpose Bar**: Blue gradient (#1e3a8a → #3b82f6)
- **System Note**: Light blue (#f0f9ff) bg, blue (#3b82f6) border
- **Blocking Error**: Yellow (#fef3c7) bg, orange (#f59e0b) border

### Interaction Colors:
- **Hover**: Primary blue (#3b82f6)
- **Focus**: Blue shadow with ring
- **Disabled**: 50% opacity

---

## 📱 RESPONSIVE BEHAVIOR (Future)

### Desktop (>1200px):
- Character cards: 3 columns
- Icon grid: 4-5 columns
- Full width sticky bar

### Tablet (768-1200px):
- Character cards: 2 columns
- Icon grid: 3 columns
- Adjusted sticky bar padding

### Mobile (<768px):
- Character cards: 1 column
- Icon grid: 2 columns
- Stacked CTA buttons

---

## 🎬 ANIMATION DETAILS

### Expand/Collapse:
```css
@keyframes expandSection {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
Duration: 0.25s ease-out
```

### Arrow Rotation:
```css
.expand-arrow {
  transition: transform 0.2s ease;
}
.expanded .expand-arrow {
  transform: rotate(0deg);  /* ▼ */
}
.collapsed .expand-arrow {
  transform: rotate(-90deg); /* ▶ */
}
```

### CTA Button Hover:
```css
.cta-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}
```

---

## 🔤 TYPOGRAPHY SYSTEM

```
Purpose Title:     1.5rem  / 700 weight / white
Purpose Subtitle:  1rem    / 400 weight / white 95% opacity
Section Title:     1.125rem / 700 weight / gray-900
Character Name:    0.95rem / 700 weight / gray-900
Status Pill:       0.8rem  / 600 weight / contextual color
Badge:             0.75rem / 700 weight / uppercase
Helper Text:       0.8rem  / 400 weight / gray-500 / italic
```

---

## 📐 SPACING SYSTEM

```
Section Padding:        1.5rem
Section Gap:            1rem
Card Padding:           1rem
Character Card Gap:     0.75rem
Status Pill Padding:    3px 8px
Badge Padding:          3px 10px
Sticky Bar Padding:     1.25rem 2rem
Purpose Bar Padding:    1.75rem 2rem
```

---

## 🎨 SHADOW SYSTEM

```
Purpose Bar:      0 4px 12px rgba(30, 58, 138, 0.15)
Section Expanded: 0 2px 8px rgba(0, 0, 0, 0.06)
CTA Primary:      0 2px 8px rgba(59, 130, 246, 0.3)
CTA Primary Hover: 0 4px 12px rgba(59, 130, 246, 0.4)
Sticky Bar:       0 -4px 12px rgba(0, 0, 0, 0.08)
```

---

## ✅ ACCESSIBILITY NOTES

- **Keyboard Navigation**: Arrow buttons need `aria-expanded` attribute
- **Screen Readers**: Section headers need `aria-label` with count
- **Focus States**: All interactive elements have visible focus rings
- **Color Contrast**: All text meets WCAG AA standards (4.5:1)
- **Motion**: Animations respect `prefers-reduced-motion` (add media query)

---

## 🚨 CRITICAL SUCCESS FACTORS

1. **Mental Model**: User thinks "I'm selecting ingredients"
2. **Hierarchy**: Purpose Bar → Summary → Required → Optional
3. **Disclosure**: Collapsed sections reduce overwhelm
4. **Status**: Always visible (pills, badges, counts)
5. **Validation**: Only blocking errors shown
6. **Next Step**: Clear CTA with Template Studio mention

---

## 📊 COMPARISON TABLE

| Aspect              | OLD Design          | NEW Design          |
|---------------------|---------------------|---------------------|
| Mental Model        | Configure design    | Select ingredients  |
| Required Visibility | Always open, loud   | Collapsible, calm   |
| Optional State      | All expanded        | Collapsed by default|
| Error Display       | Red panic boxes     | Soft yellow notes   |
| Auto-Managed Assets | Yellow warnings     | Blue info notes     |
| Text Fields         | Heavy cards         | Lightweight inputs  |
| Formats             | Grid layout         | Horizontal row      |
| Navigation CTA      | "Review & Generate" | "Continue to TS →"  |
| Page Density        | ~12 screens         | ~4 screens          |
| Cognitive Load      | High (50+ inputs)   | Low (progressive)   |

---

**IMPLEMENTATION STATUS**: ✅ CSS Ready | ⏳ JSX Needs Replacement

Follow the [COMPOSER_REDESIGN_IMPLEMENTATION_GUIDE.md](./COMPOSER_REDESIGN_IMPLEMENTATION_GUIDE.md) for step-by-step replacement instructions.
