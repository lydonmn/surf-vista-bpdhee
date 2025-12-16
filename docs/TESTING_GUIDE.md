
# Testing Guide - Admin Report Editing

## Pre-Testing Setup

### 1. Ensure Admin Access
```sql
-- Verify your user is an admin
SELECT id, email, is_admin FROM profiles WHERE email = 'your-email@example.com';

-- If not admin, make yourself admin
UPDATE profiles SET is_admin = true WHERE email = 'your-email@example.com';
```

### 2. Ensure Data Exists
1. Go to Admin Data screen
2. Click "Update All Data"
3. Wait for completion
4. Verify counts show data

## Test Cases

### Test 1: View Auto-Generated Report
**Steps:**
1. Navigate to Report tab
2. Verify report displays
3. Check that conditions text is detailed and descriptive

**Expected Result:**
- Report shows with detailed wave descriptions
- Includes wave size, period, wind, tide info
- Rating is displayed (0-10)
- All metrics are populated

**Pass Criteria:**
✅ Report displays correctly
✅ Text is detailed (not just "N/A")
✅ All sections are visible

---

### Test 2: Access Edit Screen
**Steps:**
1. On Report tab, click "Edit" button on a report
2. Verify edit screen loads

**Expected Result:**
- Edit screen opens
- Report data is displayed at top
- Text editor shows current text
- Character counter is visible

**Pass Criteria:**
✅ Edit screen loads without errors
✅ All report metrics are shown
✅ Text editor is populated
✅ Navigation works

---

### Test 3: Edit Report Text
**Steps:**
1. In edit screen, modify the report text
2. Add custom observations (e.g., "The Washout is firing today!")
3. Click "Save Changes"
4. Navigate back to Report tab

**Expected Result:**
- Save succeeds with success message
- Returns to Report tab
- Custom text is displayed
- "Edited [date]" indicator shows

**Pass Criteria:**
✅ Save completes successfully
✅ Custom text appears on report
✅ Edit indicator is visible
✅ No errors in console

---

### Test 4: Preview Mode
**Steps:**
1. Open edit screen
2. Click "Preview" button
3. Verify text display
4. Click "Edit" to return to editor

**Expected Result:**
- Preview shows formatted text
- Sentences are separated
- Preview button toggles state
- Can return to editing

**Pass Criteria:**
✅ Preview displays correctly
✅ Toggle works both ways
✅ Text formatting is applied
✅ No layout issues

---

### Test 5: Reset to Auto-Generated
**Steps:**
1. Open edit screen for a report with custom text
2. Click "Reset to Auto-Generated"
3. Confirm the action
4. Verify report reverts

**Expected Result:**
- Confirmation dialog appears
- After confirming, custom text is removed
- Auto-generated text is displayed
- "Edited" indicator disappears

**Pass Criteria:**
✅ Confirmation dialog shows
✅ Reset completes successfully
✅ Auto-generated text returns
✅ Edit indicator is removed

---

### Test 6: Custom Text Preservation
**Steps:**
1. Edit a report and save custom text
2. Go to Admin Data screen
3. Click "Update All Data"
4. Wait for completion
5. Return to Report tab

**Expected Result:**
- Data updates successfully
- Custom text is still present
- Metrics may update but text doesn't change
- Edit indicator still shows

**Pass Criteria:**
✅ Update completes without errors
✅ Custom text is preserved
✅ Metrics are updated
✅ No data loss

---

### Test 7: Quick Edit from Admin Panel
**Steps:**
1. Navigate to Admin Data screen
2. Verify today's report shows in "Surf Report Data" card
3. Click "Edit Report" button
4. Verify edit screen opens

**Expected Result:**
- Button is visible and clickable
- Edit screen opens for today's report
- All data is correct

**Pass Criteria:**
✅ Button works correctly
✅ Correct report loads
✅ Navigation is smooth

---

### Test 8: Non-Admin Access Block
**Steps:**
1. Sign in as non-admin user
2. Try to access `/edit-report?id=[report-id]` directly
3. Verify access is denied

**Expected Result:**
- Access denied message
- "Admin access required" shown
- Cannot edit reports

**Pass Criteria:**
✅ Non-admins are blocked
✅ Error message is clear
✅ Security is maintained

---

### Test 9: Character Counter
**Steps:**
1. Open edit screen
2. Type in the text editor
3. Watch character counter

**Expected Result:**
- Counter updates in real-time
- Shows accurate character count
- No lag or delay

**Pass Criteria:**
✅ Counter updates immediately
✅ Count is accurate
✅ No performance issues

---

### Test 10: Long Text Handling
**Steps:**
1. Open edit screen
2. Paste a very long report (1000+ characters)
3. Save and view on Report tab

**Expected Result:**
- Long text saves successfully
- Displays correctly on Report tab
- No truncation or overflow
- Scrollable if needed

**Pass Criteria:**
✅ Long text saves
✅ Display is correct
✅ No UI breaking
✅ Readable on mobile

---

## Integration Tests

### Test 11: Full Workflow
**Steps:**
1. Update all data from Admin Data screen
2. View auto-generated report
3. Edit the report with custom text
4. Save changes
5. Update all data again
6. Verify custom text is preserved
7. Reset to auto-generated
8. Verify auto-generated text returns

**Expected Result:**
- Complete workflow works smoothly
- No data loss at any step
- All features work together

**Pass Criteria:**
✅ All steps complete successfully
✅ No errors or crashes
✅ Data integrity maintained

---

### Test 12: Multiple Reports
**Steps:**
1. Generate reports for multiple days
2. Edit different reports with different text
3. Verify each report shows correct custom text
4. Update all data
5. Verify all custom texts are preserved

**Expected Result:**
- Multiple reports can be edited independently
- Each maintains its own custom text
- No cross-contamination

**Pass Criteria:**
✅ Each report is independent
✅ All custom texts preserved
✅ No mixing of data

---

## Performance Tests

### Test 13: Load Time
**Steps:**
1. Time how long edit screen takes to load
2. Time how long save takes
3. Time how long report display loads

**Expected Result:**
- Edit screen: < 1 second
- Save operation: < 2 seconds
- Report display: < 1 second

**Pass Criteria:**
✅ All operations are fast
✅ No noticeable lag
✅ Good user experience

---

### Test 14: Real-Time Updates
**Steps:**
1. Open Report tab on two devices
2. Edit report on device 1
3. Check if device 2 updates

**Expected Result:**
- Real-time subscription updates display
- Changes appear on device 2
- No manual refresh needed

**Pass Criteria:**
✅ Real-time updates work
✅ Both devices stay in sync
✅ No delays

---

## Edge Cases

### Test 15: Empty Report Text
**Steps:**
1. Open edit screen
2. Delete all text
3. Try to save

**Expected Result:**
- Save succeeds (empty is valid)
- Falls back to auto-generated text on display
- No errors

**Pass Criteria:**
✅ Empty text is handled
✅ Fallback works
✅ No crashes

---

### Test 16: Special Characters
**Steps:**
1. Open edit screen
2. Enter text with special characters: °, ', ", &, <, >
3. Save and view

**Expected Result:**
- Special characters save correctly
- Display correctly on Report tab
- No encoding issues

**Pass Criteria:**
✅ Special chars work
✅ No encoding errors
✅ Display is correct

---

### Test 17: Network Failure
**Steps:**
1. Open edit screen
2. Disable network
3. Try to save
4. Re-enable network

**Expected Result:**
- Error message shows
- Data is not lost
- Can retry save

**Pass Criteria:**
✅ Error handling works
✅ No data loss
✅ Retry is possible

---

## Regression Tests

### Test 18: Existing Features Still Work
**Steps:**
1. Verify video upload still works
2. Verify weather display still works
3. Verify tide display still works
4. Verify user authentication still works

**Expected Result:**
- All existing features work
- No breaking changes
- App is stable

**Pass Criteria:**
✅ No regressions
✅ All features functional
✅ App is stable

---

## Test Results Template

```
Test Date: ___________
Tester: ___________
Device: ___________
OS Version: ___________

Test 1: ☐ Pass ☐ Fail - Notes: ___________
Test 2: ☐ Pass ☐ Fail - Notes: ___________
Test 3: ☐ Pass ☐ Fail - Notes: ___________
...

Overall Status: ☐ All Pass ☐ Some Failures
Critical Issues: ___________
Minor Issues: ___________
Recommendations: ___________
```

## Automated Testing (Future)

Consider adding:
- Unit tests for Edge Functions
- Integration tests for database operations
- E2E tests for user workflows
- Performance benchmarks

---

**Happy Testing! 🧪**
