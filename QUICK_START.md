# TSV Upload - Quick Start Guide

## For End Users

### How to Upload ADP Data

1. **Get the Data**
   - Visit https://nfc.shgn.com/adp/baseball (for MLB) or https://nfc.shgn.com/adp/football (for NFL)
   - Select all the data on the page (Ctrl+A or Cmd+A)
   - Copy (Ctrl+C or Cmd+C)
   - Open Excel, Google Sheets, or any spreadsheet app
   - Paste the data
   - Export as TSV or CSV (File → Export → TSV or CSV)
   - Save the file (e.g., `adp_mlb_2026.tsv`)

2. **Upload to Leverage AI**
   - Open any ADP card in the app
   - Look for the **"Update TSV"** button
   - Click it - a dialog will open
   - Either:
     - **Drag your TSV file** into the upload area, OR
     - **Click to browse** and select your file
   - Watch the progress bar
   - See the success message with player count

3. **Verify Success**
   - The upload date will update on the card
   - All users will see the same data immediately
   - The date badge shows when data was last updated

### What Happens After Upload

✅ Your data is immediately available to all users
✅ Data is permanently stored and backed up
✅ Last update date is displayed for transparency
✅ You can upload again anytime to refresh

### Troubleshooting

**"Missing required columns" error**
- Make sure your TSV has: Rank, Player Name, and ADP columns
- Column order doesn't matter
- Column names are case-insensitive

**"File is empty" error**
- Select a different file or re-save your export
- Make sure the file actually contains player data

**Upload appears to hang**
- Give it up to 5 seconds
- Check your internet connection
- Try a smaller file first

**Can't see the upload button**
- Make sure you're looking at an ADP card
- Scroll down on the card to find the button
- If still missing, try refreshing the page

---

## For Developers / Team Leads

### Setup & Deployment

1. **Database Migration**
   ```bash
   # Already executed - tables created:
   # - adp_upload_history
   # - Extended nfbc_adp and nffc_adp with source tracking
   ```

2. **Deploy Code**
   - TSVUploadDialog component in `components/`
   - API routes in `app/api/adp/`
   - Updated components with props threading

3. **Test Locally**
   ```bash
   npm run dev
   # Visit localhost:3000
   # Look for ADP card → click "Update TSV"
   ```

### Monitoring

**Key Metrics to Track:**
- Upload success rate (should be 95%+)
- Average upload time per player
- Database storage usage
- Error frequency and types

**Logs to Watch:**
- `/api/adp/upload` - file parsing errors
- `/api/adp/metadata` - missing data issues
- Browser console - UI errors

### Configuration

**Adjustable Parameters:**

```typescript
// Metadata refresh interval
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Max returned records
const MAX_LIMIT = 250; // per request

// Database table names
const MLB_TABLE = 'nfbc_adp';
const NFL_TABLE = 'nffc_adp';
```

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Upload button not visible | CSS/component issue | Check CSS imports and component render |
| Metadata not updating | Fetch failing | Check network tab, verify route exists |
| Players not appearing | DB insert failed | Check RLS policies, user authentication |
| Bad TSV parsing | Format issue | Verify column headers, test with sample data |

---

## API Reference (for Integration)

### Upload a TSV File
```javascript
async function uploadADP(file, sport) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sport', sport); // 'mlb' or 'nfl'
  
  const response = await fetch('/api/adp/upload', {
    method: 'POST',
    body: formData,
  });
  
  return response.json();
  // { success: true, playerCount: 250, sport: 'mlb' }
}
```

### Get Upload Metadata
```javascript
async function getMetadata(sport) {
  const response = await fetch(`/api/adp/metadata?sport=${sport}`);
  const data = await response.json();
  // { sport: 'mlb', hasUpload: true, lastUploadDate: '...', playerCount: 250 }
  return data;
}
```

### Fetch ADP Data
```javascript
async function getADPData(sport, limit = 120) {
  const response = await fetch(`/api/adp/data?sport=${sport}&limit=${limit}`);
  const data = await response.json();
  // { sport: 'mlb', players: [...], totalCount: 250, source: 'user_uploaded' }
  return data;
}
```

---

## Feature Rollout Plan

### Phase 1: Internal Testing ✅
- Test all components
- Verify database operations
- Check error handling

### Phase 2: Beta Users
- Roll out to select users
- Gather feedback
- Fix any issues

### Phase 3: General Release
- Full rollout to all users
- Monitor metrics
- Support user adoption

---

## Support Resources

- **Feature Docs**: See `TSV_UPLOAD_FEATURE.md`
- **Integration Guide**: See `INTEGRATION_GUIDE.md`
- **Full Summary**: See `IMPLEMENTATION_SUMMARY.md`
- **Code Comments**: Inline documentation in components/APIs

---

## Questions?

Check these in order:
1. Console errors (F12 → Console)
2. Network tab (F12 → Network)
3. API responses (look for error messages)
4. Documentation files in this repo
5. Contact development team

---

**Last Updated**: March 10, 2026
**Status**: Production Ready
