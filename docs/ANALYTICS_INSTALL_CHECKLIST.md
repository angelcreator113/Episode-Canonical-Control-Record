# Decision Analytics Installation Checklist

## Dependencies
- [x] Recharts installed (`npm install recharts` in frontend/)
- [ ] Package.json shows recharts dependency
- [ ] No installation errors

## Backend Running
- [ ] Backend started with `npm run dev`
- [ ] See "✓ Decision Analytics routes loaded" in logs
- [ ] API accessible at http://localhost:3002

## Frontend Running
- [ ] Frontend started with `npm run dev`
- [ ] No compilation errors
- [ ] Accessible at http://localhost:5174

## Dashboard Access
- [ ] Navigate to http://localhost:5174/analytics/decisions
- [ ] Page loads without errors
- [ ] Stats cards visible (even if showing 0)
- [ ] Export buttons visible

## With Sample Data (Optional)
- [ ] Run seed script to create test decisions
- [ ] Refresh dashboard
- [ ] Charts display with data
- [ ] Patterns section shows insights
- [ ] Export functions work

## Browser Console
- [ ] Open DevTools (F12)
- [ ] No red errors in Console
- [ ] No failed API requests in Network tab

## Success Criteria
✅ Dashboard accessible
✅ Recharts installed and working
✅ API endpoints responding
✅ Charts render (even if empty)
✅ Export buttons functional
