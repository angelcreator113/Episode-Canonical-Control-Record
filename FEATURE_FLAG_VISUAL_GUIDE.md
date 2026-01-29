# Visual Guide: Feature Flag Toggle UI

## What Users See at Step 2

### **Yellow Banner (Always Visible)**

```
╔══════════════════════════════════════════════════════════════════════╗
║ 🧪 Beta: Use New "Select Ingredients" UI Design ☐                   ║
║ Toggle between old and new Step 2 layouts. Your preference is saved.║
║                                                  [📋 Classic UI Active]║
╚══════════════════════════════════════════════════════════════════════╝
```

**After checking the box:**

```
╔══════════════════════════════════════════════════════════════════════╗
║ 🧪 Beta: Use New "Select Ingredients" UI Design ☑                   ║
║ Toggle between old and new Step 2 layouts. Your preference is saved.║
║                                                    [✨ New UI Active] ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## NEW UI (Checked ✨)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Step 2: Select Ingredients                                           │
│ Choose which assets this thumbnail will use. You'll design layout   │
│ and styling in Template Studio next.                                │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ ✓ Required: 2/2          •          ✨ Optional: 3 selected         │
└──────────────────────────────────────────────────────────────────────┘

▼ 👥 Characters  [Required]  2/2
  ┌─────────────┐  ┌─────────────┐
  │ 👩 Lala      │  │ 💜 JustAWoman│
  │ ✅ Selected │  │ ✅ Selected │
  └─────────────┘  └─────────────┘

▶ ✨ Icons  [Optional]  3 selected

▶ 👗 Wardrobe  [Optional]  0 selected

▶ 🖱️ UI Chrome  [Optional]  0 selected

▼ 🖼️ Background  [Required]  1/1
  [Select background...]

▼ 📐 Output Formats  [Optional]  2 selected
  ☑ YOUTUBE   ☐ INSTAGRAM_FEED   ☑ FACEBOOK

╔══════════════════════════════════════════════════════════════════════╗
║ [← Back]                              [Continue to Template Studio →]║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## CLASSIC UI (Unchecked 📋)

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📋 Classic UI Mode                                                   │
│ This is the original Step 2 interface. Toggle the switch above      │
│ to try the new "Select Ingredients" design.                         │
└──────────────────────────────────────────────────────────────────────┘

Step 2: Configure Assets & Formats

👥 Required Characters
┌─────────────────┐ ┌─────────────────┐
│ 👩 Lala (Host) *│ │ 💜 JustAWoman * │
│ [Select asset...│ │ [Select asset...│
└─────────────────┘ └─────────────────┘

✨ Optional Assets
▸ 🎨 Icons (3 selected)
▸ 👗 Wardrobe (0 selected)

🖼️ Background *
[Select background...]

📐 Output Formats
☑ YOUTUBE  ☑ INSTAGRAM_FEED  ☐ FACEBOOK

[← Back]                    [Next: Review & Generate →]
```

---

## Key Visual Differences

| Element | Classic UI | New UI |
|---------|-----------|--------|
| **Header** | Simple text | Blue gradient purpose bar |
| **Summary** | None | Green/yellow completion stats |
| **Sections** | Always visible | Collapsible with arrows |
| **Status** | Implicit | Explicit pills (✅/⏳) |
| **Layout** | Vertical list | Card-based with grids |
| **CTA** | Regular button | Sticky bottom bar |
| **Required** | Red asterisk (*) | Orange "Required" badge |
| **Optional** | In `<details>` | Badge + count |

---

## Testing Sequence Visual

```
┌─────────┐
│ Step 1  │ Select Episode + Template
└────┬────┘
     │
     ▼
┌─────────┐
│ Step 2  │ ◄─── Feature Flag Banner Here
└────┬────┘      Toggle ☐ → ☑
     │           
     ├─────────► Classic UI (☐ unchecked)
     │           • Simple layout
     │           • Vertical sections
     │           • "Next: Review & Generate"
     │
     └─────────► New UI (☑ checked)
                 • Purpose bar
                 • Selection summary
                 • Collapsible sections
                 • "Continue to Template Studio"
     │
     ▼
┌─────────┐
│ Step 3  │ Review & Generate
└─────────┘
```

---

## Browser DevTools Check

**Console Output:**
```
🚩 Feature Flag: New Step 2 UI DISABLED
🚩 Feature Flag: New Step 2 UI ENABLED
```

**localStorage (Application tab):**
```
Key: composer.newStep2UI
Value: "true"  ← New UI enabled
Value: "false" ← Classic UI enabled
```

---

## Quick Test Script

1. **Go to Step 2** → See yellow banner
2. **Checkbox unchecked** → See "📋 Classic UI Active"
3. **Check the box** → See "✨ New UI Active"
4. **UI changes instantly** → No page reload
5. **F5 refresh** → Preference persists
6. **Select assets** → Toggle UI → Assets persist
7. **Click Next/Continue** → Both work

**Test passes if:** No errors, data persists, both UIs functional.

---

**Visual Guide Complete** ✅
