
# 6K Video Upload - Setup Checklist

## 🎯 Complete These Steps to Enable 6K Video Uploads

### ✅ Step 1: Dependencies (COMPLETED)
- [x] Installed `expo-media-library` package
- [x] Updated `app.json` with permissions
- [x] Updated `app/admin.tsx` with validation logic

**Status**: ✅ DONE - No action needed

---

### ⚠️ Step 2: Database Migration (ACTION REQUIRED)

**What**: Add metadata columns to videos table

**How**:
1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `ucbilksfpnmltrkwvzft`
3. Go to: **SQL Editor** (left sidebar)
4. Click: **New Query**
5. Copy SQL from: `docs/DATABASE_MIGRATION_6K.sql`
6. Paste into editor
7. Click: **Run** (or press Cmd/Ctrl + Enter)
8. Verify: Success message appears

**Expected Result**:
```
Success. No rows returned
```

**Verify**:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'videos' 
AND column_name IN ('resolution_width', 'resolution_height', 'duration_seconds', 'file_size_bytes');
```

Should return 4 rows.

**Status**: ⚠️ TODO

---

### ⚠️ Step 3: Configure Supabase Storage (ACTION REQUIRED)

**What**: Increase file size limit to 2GB

**How**:
1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `ucbilksfpnmltrkwvzft`
3. Go to: **Storage** (left sidebar)
4. Click on: **videos** bucket
5. Click: **Settings** (gear icon)
6. Update: **File size limit** to `2147483648` (2GB in bytes)
7. Click: **Save**

**Alternative Method** (via SQL):
```sql
UPDATE storage.buckets 
SET file_size_limit = 2147483648 
WHERE name = 'videos';
```

**Verify**:
```sql
SELECT name, file_size_limit 
FROM storage.buckets 
WHERE name = 'videos';
```

Should show: `file_size_limit: 2147483648`

**Status**: ⚠️ TODO

---

### ⚠️ Step 4: Upgrade to Supabase Pro (ACTION REQUIRED)

**What**: Upgrade from Free to Pro tier

**Why**: Free tier limits:
- ❌ 1GB total storage (not enough for 6K videos)
- ❌ 50MB per file (way too small)
- ❌ 2GB bandwidth/month (insufficient)

Pro tier benefits:
- ✅ 100GB total storage
- ✅ 5GB per file
- ✅ 200GB bandwidth/month
- ✅ Better performance
- ✅ Priority support

**Cost**: $25/month

**How**:
1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `ucbilksfpnmltrkwvzft`
3. Go to: **Settings** → **Billing** (left sidebar)
4. Click: **Upgrade to Pro**
5. Enter payment information
6. Confirm upgrade

**Verify**:
- Dashboard shows "Pro" badge
- Storage limit shows 100GB
- File size limit shows 5GB

**Status**: ⚠️ TODO

---

### ✅ Step 5: Test the Implementation (RECOMMENDED)

**What**: Verify everything works end-to-end

**Preparation**:
1. Get a test 6K video:
   - Resolution: 6144x3160 or higher
   - Duration: Under 90 seconds
   - Size: Under 2GB
   - Format: MP4

2. Transfer to iPhone:
   - Save to Photos app
   - Ensure it's local (not iCloud)

**Testing Steps**:

#### Test 1: Valid 6K Video ✅
1. [ ] Open SurfVista app
2. [ ] Go to Admin Panel
3. [ ] Tap "Select Video"
4. [ ] Choose 6K test video
5. [ ] Wait for validation (5-10 seconds)
6. [ ] Verify: Green box with checkmark
7. [ ] Verify: Metadata shows correct resolution
8. [ ] Verify: Duration shows correct time
9. [ ] Verify: File size shows correct size
10. [ ] Enter title: "Test 6K Upload"
11. [ ] Tap "Upload 6K Video"
12. [ ] Wait for upload (5-15 minutes)
13. [ ] Verify: Success message appears
14. [ ] Verify: Video appears in app
15. [ ] Verify: Video plays correctly

**Expected**: ✅ All steps pass

#### Test 2: Invalid Resolution (4K) ❌
1. [ ] Select 4K video (3840x2160)
2. [ ] Wait for validation
3. [ ] Verify: Red box with X
4. [ ] Verify: Error message: "Resolution too low"
5. [ ] Verify: Upload button disabled

**Expected**: ❌ Validation fails correctly

#### Test 3: Invalid Duration (Over 90s) ❌
1. [ ] Select 6K video over 90 seconds
2. [ ] Wait for validation
3. [ ] Verify: Red box with X
4. [ ] Verify: Error message: "Duration too long"
5. [ ] Verify: Upload button disabled

**Expected**: ❌ Validation fails correctly

#### Test 4: Invalid File Size (Over 2GB) ❌
1. [ ] Select 6K video over 2GB
2. [ ] Wait for validation
3. [ ] Verify: Red box with X
4. [ ] Verify: Error message: "File too large"
5. [ ] Verify: Upload button disabled

**Expected**: ❌ Validation fails correctly

**Status**: ⚠️ TODO

---

## 📋 Quick Reference

### Video Requirements
```
✓ Resolution: Minimum 6K (6144x3160)
✓ Duration: Maximum 90 seconds
✓ File Size: Maximum 2GB
✓ Format: MP4 (H.264 or H.265)
```

### Database Columns Added
```
- resolution_width (INTEGER)
- resolution_height (INTEGER)
- duration_seconds (NUMERIC)
- file_size_bytes (BIGINT)
```

### Storage Configuration
```
- File size limit: 2GB (2147483648 bytes)
- Bucket: videos
- Public access: Yes
```

### Supabase Plan
```
- Tier: Pro
- Cost: $25/month
- Storage: 100GB
- File limit: 5GB
- Bandwidth: 200GB/month
```

---

## 🚨 Common Issues

### Issue: "Column does not exist"
**Cause**: Database migration not run
**Fix**: Complete Step 2

### Issue: "Payload too large" (413 error)
**Cause**: Storage not configured for 2GB
**Fix**: Complete Step 3

### Issue: Upload fails immediately
**Cause**: Not on Pro tier
**Fix**: Complete Step 4

### Issue: "Could not read video information"
**Cause**: Unsupported video format
**Fix**: Convert to MP4 (H.264)

---

## ✅ Completion Checklist

Before going live, verify:

### Database
- [ ] Migration executed successfully
- [ ] Columns exist in videos table
- [ ] Constraints are active
- [ ] Indexes are created

### Storage
- [ ] File size limit set to 2GB
- [ ] Bucket is public
- [ ] Bucket exists and is accessible

### Billing
- [ ] Upgraded to Pro tier
- [ ] Payment method added
- [ ] Billing confirmed

### Testing
- [ ] Valid 6K video uploads successfully
- [ ] Invalid resolution rejected
- [ ] Invalid duration rejected
- [ ] Invalid file size rejected
- [ ] Metadata stored correctly
- [ ] Video plays in app

### Documentation
- [ ] Admins trained on requirements
- [ ] Recording workflow documented
- [ ] Troubleshooting guide reviewed

---

## 📞 Need Help?

### Documentation
- Technical details: `6K_VIDEO_UPLOAD_IMPLEMENTATION.md`
- User guide: `6K_VIDEO_QUICK_START.md`
- This checklist: `SETUP_CHECKLIST_6K.md`
- SQL migration: `DATABASE_MIGRATION_6K.sql`

### Support
- Check console logs for errors
- Review validation error messages
- Test with smaller video first
- Verify all requirements met

---

## 🎉 You're Done When...

All checkboxes above are checked ✅

The system will then:
- Accept only 6K+ resolution videos
- Enforce 90-second maximum duration
- Support up to 2GB file uploads
- Store detailed metadata
- Provide excellent user experience

**Ready to start? Begin with Step 2!** 🚀
