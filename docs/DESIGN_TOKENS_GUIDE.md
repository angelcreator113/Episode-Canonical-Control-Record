# Design Tokens — Usage Guide

## 🎨 Quick Reference

### Import in Your Component CSS
```css
/* Design tokens are globally available via index.css import */
/* Use CSS variables directly in your component styles */

.my-component {
  background: var(--surface-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-sm);
}
```

---

## 📦 Token Categories

### 1. Colors

#### Primary Brand
```css
var(--primary)        /* #3b82f6 - Main brand blue */
var(--primary-dark)   /* #2563eb - Hover/active states */
var(--primary-light)  /* #60a5fa - Subtle highlights */
var(--primary-subtle) /* #dbeafe - Backgrounds */
```

#### Semantic Colors
```css
/* Success (Green) */
var(--success)        /* #10b981 */
var(--success-bg)     /* #d1fae5 */
var(--success-border) /* #6ee7b7 */

/* Warning (Amber) */
var(--warning)        /* #f59e0b */
var(--warning-bg)     /* #fef3c7 */
var(--warning-border) /* #fbbf24 */

/* Danger (Red) */
var(--danger)         /* #ef4444 */
var(--danger-bg)      /* #fee2e2 */
var(--danger-border)  /* #fca5a5 */

/* Info (Blue) */
var(--info)           /* #3b82f6 */
var(--info-bg)        /* #dbeafe */
var(--info-border)    /* #93c5fd */
```

#### Gray Scale
```css
var(--gray-50)   /* #f9fafb - Lightest */
var(--gray-100)  /* #f3f4f6 */
var(--gray-200)  /* #e5e7eb - Default borders */
var(--gray-300)  /* #d1d5db */
var(--gray-400)  /* #9ca3af */
var(--gray-500)  /* #6b7280 - Muted text */
var(--gray-600)  /* #4b5563 */
var(--gray-700)  /* #374151 */
var(--gray-800)  /* #1f2937 */
var(--gray-900)  /* #111827 - Primary text */
```

#### Surfaces & Text
```css
/* Backgrounds */
var(--surface-bg)       /* #f8f9fb - Page background */
var(--surface-card)     /* #ffffff - Card background */
var(--surface-elevated) /* #ffffff - Modal/dropdown bg */

/* Text Colors */
var(--text-primary)     /* #111827 - Headings, body */
var(--text-secondary)   /* #6b7280 - Subtitles, labels */
var(--text-muted)       /* #9ca3af - Hints, disabled */
var(--text-inverse)     /* #ffffff - On dark backgrounds */

/* Borders */
var(--border-light)     /* #f3f4f6 - Very subtle */
var(--border)           /* #e5e7eb - Default */
var(--border-medium)    /* #d1d5db - Emphasis */
var(--border-dark)      /* #9ca3af - Strong */
```

---

### 2. Spacing

```css
var(--spacing-xs)   /* 0.25rem = 4px */
var(--spacing-sm)   /* 0.5rem = 8px */
var(--spacing-md)   /* 0.75rem = 12px */
var(--spacing-lg)   /* 1rem = 16px */
var(--spacing-xl)   /* 1.5rem = 24px */
var(--spacing-2xl)  /* 2rem = 32px */
var(--spacing-3xl)  /* 3rem = 48px */
```

#### Common Usage
```css
/* Card padding */
padding: var(--spacing-xl);  /* 24px */

/* Button padding */
padding: 0.75rem var(--spacing-lg);  /* 12px 16px */

/* Section gaps */
gap: var(--spacing-2xl);  /* 32px */

/* Tight spacing */
margin-bottom: var(--spacing-sm);  /* 8px */
```

---

### 3. Border Radius

```css
var(--radius-sm)   /* 8px - Small elements */
var(--radius)      /* 12px - STANDARD for buttons, inputs */
var(--radius-md)   /* 14px - Cards, panels */
var(--radius-lg)   /* 16px - Large containers */
var(--radius-xl)   /* 20px - Hero sections */
var(--radius-full) /* 9999px - Pills, circles */
```

#### When to Use
```css
/* Buttons, inputs, badges */
border-radius: var(--radius);  /* 12px */

/* Cards, sections */
border-radius: var(--radius-md);  /* 14px */

/* Avatars, status dots */
border-radius: var(--radius-full);  /* Circle */
```

---

### 4. Shadows

```css
var(--shadow-xs)  /* 0 1px 2px rgba(0,0,0,0.05) - Minimal */
var(--shadow-sm)  /* 0 1px 3px rgba(0,0,0,0.08) - Default cards */
var(--shadow)     /* 0 2px 6px rgba(0,0,0,0.1) - Elevated cards */
var(--shadow-md)  /* 0 4px 12px rgba(0,0,0,0.12) - Dropdowns */
var(--shadow-lg)  /* 0 8px 20px rgba(0,0,0,0.15) - Modals */
var(--shadow-xl)  /* 0 12px 32px rgba(0,0,0,0.18) - Hero */
```

#### Colored Shadows (For Primary Actions)
```css
var(--shadow-primary)  /* Blue shadow for primary buttons */
var(--shadow-success)  /* Green shadow for success buttons */
var(--shadow-danger)   /* Red shadow for danger buttons */
```

#### Usage Pattern
```css
/* Default card */
box-shadow: var(--shadow-sm);

/* Hover state */
.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

/* Primary button */
.btn-primary {
  box-shadow: var(--shadow-primary);
}
```

---

### 5. Typography

#### Font Families
```css
var(--font-sans)  /* System fonts: -apple-system, Segoe UI, Roboto... */
var(--font-mono)  /* Monospace: SF Mono, Cascadia Code... */
```

#### Font Sizes
```css
var(--text-xs)    /* 0.75rem = 12px */
var(--text-sm)    /* 0.875rem = 14px */
var(--text-base)  /* 1rem = 16px */
var(--text-lg)    /* 1.125rem = 18px */
var(--text-xl)    /* 1.25rem = 20px */
var(--text-2xl)   /* 1.5rem = 24px */
var(--text-3xl)   /* 1.875rem = 30px */
var(--text-4xl)   /* 2.25rem = 36px */
```

#### Font Weights
```css
var(--font-normal)    /* 400 */
var(--font-medium)    /* 500 */
var(--font-semibold)  /* 600 */
var(--font-bold)      /* 700 - STANDARD for headings */
var(--font-extrabold) /* 800 */
var(--font-black)     /* 900 - Hero titles */
```

#### Line Heights
```css
var(--leading-none)     /* 1 - Tight headlines */
var(--leading-tight)    /* 1.25 - Headings */
var(--leading-snug)     /* 1.375 - Subheadings */
var(--leading-normal)   /* 1.5 - Body text */
var(--leading-relaxed)  /* 1.625 - Long-form */
var(--leading-loose)    /* 2 - Spacious */
```

---

### 6. Transitions

```css
var(--transition-fast)  /* 150ms ease - Quick feedback */
var(--transition)       /* 200ms ease - STANDARD */
var(--transition-slow)  /* 300ms ease - Smooth animations */
```

#### Usage
```css
.button {
  transition: all var(--transition);
}

.dropdown {
  transition: opacity var(--transition-fast);
}

.modal {
  transition: transform var(--transition-slow);
}
```

---

### 7. Z-Index

```css
var(--z-sticky)   /* 50 - Sticky headers */
var(--z-dropdown) /* 100 - Dropdowns, popovers */
var(--z-popover)  /* 150 - Tooltips */
var(--z-modal)    /* 200 - Modals, dialogs */
var(--z-tooltip)  /* 250 - Top-most tooltips */
```

---

## 🧩 Pre-Built Component Classes

### Buttons

```css
/* Apply base + variant */
<button class="btn-standard btn-primary">Save</button>
```

**Variants:**
- `.btn-primary` — Blue gradient, main actions
- `.btn-secondary` — Gray, secondary actions
- `.btn-ghost` — Transparent, tertiary actions
- `.btn-danger` — Red tint, destructive actions
- `.btn-success` — Green gradient, confirmations

**Example:**
```jsx
<button className="btn-standard btn-primary">
  Create Episode
</button>

<button className="btn-standard btn-ghost">
  Cancel
</button>
```

---

### Cards

```css
/* Apply directly */
<div class="card-standard">Content</div>
<div class="card-elevated">Dropdown content</div>
```

**Variants:**
- `.card-standard` — Default card (1px border, sm shadow)
- `.card-elevated` — Elevated card (lighter border, md shadow)

---

### Badges

```css
<span class="badge-standard badge-success">Published</span>
```

**Variants:**
- `.badge-success` — Green (published, active)
- `.badge-warning` — Amber (pending, draft)
- `.badge-danger` — Red (error, critical)
- `.badge-info` — Blue (info, note)
- `.badge-neutral` — Gray (default)

---

### Inputs

```css
<input type="text" class="input-standard" />
<input type="text" class="input-standard input-error" />
```

**States:**
- `.input-standard` — Default input
- `.input-error` — Error state (red border)

---

## 📋 Common Patterns

### 1. Primary Button
```css
.my-button {
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius);
  font-weight: var(--font-bold);
  box-shadow: var(--shadow-primary);
  transition: all var(--transition);
}

.my-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.35);
}
```

### 2. Card with Hover Effect
```css
.my-card {
  background: var(--surface-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition);
}

.my-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--border-medium);
}
```

### 3. Status Badge
```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0.35rem 0.85rem;
  background: var(--success-bg);
  color: #065f46;
  border-radius: var(--radius);
  font-weight: var(--font-bold);
  font-size: var(--text-sm);
}
```

### 4. Warning Message
```css
.warning-box {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg);
  background: var(--warning-bg);
  border: 1px solid var(--warning-border);
  border-radius: var(--radius);
  padding: var(--spacing-lg) var(--spacing-xl);
  color: #78350f;
}
```

### 5. Dropdown Menu
```css
.dropdown {
  position: absolute;
  top: calc(100% + var(--spacing-sm));
  right: 0;
  background: var(--surface-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  z-index: var(--z-dropdown);
}
```

---

## 🎯 Design Guidelines

### Hierarchy
1. **Primary Actions:** Blue gradient + shadow
2. **Secondary Actions:** Gray with border
3. **Tertiary Actions:** Ghost (transparent)
4. **Destructive Actions:** Red tint

### Border Radius Consistency
- Buttons/Inputs: `12px`
- Cards/Panels: `14px`
- Badges/Pills: `8px` or `9999px` (full)

### Spacing Scale
- Tight: `8px` (sm)
- Default: `16px` (lg)
- Comfortable: `24px` (xl)
- Loose: `32px` (2xl)

### Shadow Depth
- At Rest: `shadow-sm`
- Hover: `shadow-md`
- Active/Modal: `shadow-lg`

---

## ✨ Examples in Real Components

### Episode Card
```css
.episode-card {
  background: var(--surface-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition);
}

.episode-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.episode-card-title {
  font-size: var(--text-xl);
  font-weight: var(--font-black);
  color: var(--text-primary);
  line-height: var(--leading-tight);
}

.episode-card-meta {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--spacing-sm);
}
```

### Form Section
```css
.form-section {
  background: var(--surface-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: var(--spacing-2xl);
  margin-bottom: var(--spacing-xl);
}

.form-section-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
}

.form-field {
  margin-bottom: var(--spacing-lg);
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.form-hint {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: var(--spacing-xs);
}
```

---

## 🚀 Quick Start Checklist

When creating a new component:

1. ✅ Use `var(--radius)` for border-radius (12px standard)
2. ✅ Use `var(--spacing-xl)` for card padding (24px)
3. ✅ Use `var(--shadow-sm)` for default shadows
4. ✅ Use `var(--font-bold)` for headings (700)
5. ✅ Use `var(--transition)` for smooth interactions (200ms)
6. ✅ Use semantic colors: `--success`, `--warning`, `--danger`
7. ✅ Use `var(--text-secondary)` for muted text
8. ✅ Use `var(--border)` for default borders (#e5e7eb)

---

**Token File Location:**  
`frontend/src/styles/design-tokens.css`

**Automatically Imported:**  
Via `frontend/src/index.css`

**Ready to Use:**  
All tokens available globally in any component CSS file!
