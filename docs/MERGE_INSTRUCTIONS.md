# How to Replace "History" Tab with Merged Component

## File: frontend/src/pages/EpisodeDetail.jsx

### Step 1: Import the new component
```javascript
import DecisionHistoryWithAnalytics from '../components/DecisionHistoryWithAnalytics';
```

### Step 2: Find the "History" TabPanel
Look for the tab panel that shows decision history (around line 400-500)

### Step 3: Replace the content
Replace the existing history content with:
```javascript
<TabPanel value={activeTab} index={7}> {/* Adjust index if needed */}
  <DecisionHistoryWithAnalytics episodeId={episodeId} />
</TabPanel>
```

### Step 4: Update tab label (optional)
Change the tab label from "History" to "Decisions" or "Decisions & History"
```javascript
<Tab icon={<FaHistory />} label="Decisions" />
```

## Benefits of This Approach

✅ **Single source of truth** - All decision data in one place
✅ **Immediate feedback** - See patterns as you make decisions
✅ **Less navigation** - No switching between tabs
✅ **Better UX** - Analytics + history = complete picture
✅ **Cleaner UI** - Reduces tab clutter

## What Gets Merged

### Analytics Section (Top)
- Summary cards (Total Decisions, AI Suggestions, Avg Confidence)
- Decisions by Category (horizontal bars)
- Most Common Decisions (frequency chart)
- AI-generated insights

### History Section (Bottom)
- Chronological list of all decisions
- Individual decision details with context
- Undo functionality for each decision
- Export buttons (JSON/CSV)

## Features Included

1. **Auto-loading** - Loads data when episodeId changes
2. **Smart insights** - Generates personalized feedback
3. **Category icons** - Visual indicators for decision types
4. **Export functionality** - Download data for AI training
5. **Undo support** - Placeholder for future undo feature
6. **Empty state** - Helpful message when no decisions exist

Done! The merged tab will now show both analytics and history.
