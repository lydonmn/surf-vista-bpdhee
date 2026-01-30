
# Asset Cleanup Guide

## Problem
The `assets/images/` folder contains approximately **400+ UUID-named PNG files** that are error screenshots and temporary files from development. These files:
- Bloat the app size unnecessarily
- Slow down build times
- Clutter the project structure

## Files to KEEP (Essential Assets)

### App Icons & Branding
- ✅ `6c9e5721-4475-4d3a-bd06-7b3814dfb7c7.png` - **NEW SurfVista logo (IN USE)**
- ✅ `final_quest_240x240.png` - App icon
- ✅ `final_quest_240x240__.png` - App icon variant
- ✅ `natively-dark.png` - Dark mode branding

### Other Essential Images
- ✅ `11315b0b-8f65-4b9f-a0bf-dea5762cae8d.jpeg`
- ✅ `c36f9757-063c-4c3d-a829-a2b52440b7f8.jpeg`

## Files to DELETE (Error Screenshots)

All other files with UUID naming pattern should be deleted:
- `00f19cea-6f4c-49bb-8021-07d62fa2633f.png` ❌
- `018699f4-22a4-48e9-aff2-c75025514406.png` ❌
- `02fcf874-fe3c-4b53-ae2c-85018994d7ee.png` ❌
- ... (approximately 400+ more files)

## How to Clean Up

### Option 1: Manual Deletion (Safest)
1. Navigate to `assets/images/` folder
2. Sort files by name
3. Delete all UUID-named PNG files EXCEPT the 6 files listed above

### Option 2: Command Line (Advanced)
```bash
cd assets/images

# Create backup first
mkdir ../images_backup
cp *.png ../images_backup/

# Keep only essential files (adjust pattern as needed)
# This is a template - review before running
find . -type f -name "*.png" \
  ! -name "6c9e5721-4475-4d3a-bd06-7b3814dfb7c7.png" \
  ! -name "final_quest_240x240.png" \
  ! -name "final_quest_240x240__.png" \
  ! -name "natively-dark.png" \
  -delete
```

### Option 3: Use File Manager
1. Open `assets/images/` in Finder (Mac) or Explorer (Windows)
2. Sort by name
3. Select all UUID-named files (they'll be grouped together)
4. Keep only the 6 essential files listed above
5. Delete the rest

## Expected Results

**Before Cleanup:**
- ~400+ PNG files
- Large app bundle size
- Slow builds

**After Cleanup:**
- 6 essential PNG files + 2 JPEG files
- Significantly smaller app bundle
- Faster builds
- Cleaner project structure

## Verification

After cleanup, verify these files still exist:
```bash
ls -la assets/images/
```

Should show:
- 6c9e5721-4475-4d3a-bd06-7b3814dfb7c7.png ✅
- final_quest_240x240.png ✅
- final_quest_240x240__.png ✅
- natively-dark.png ✅
- 11315b0b-8f65-4b9f-a0bf-dea5762cae8d.jpeg ✅
- c36f9757-063c-4c3d-a829-a2b52440b7f8.jpeg ✅

## Impact on App

✅ **Safe to delete** - These UUID-named files are NOT referenced in the code
✅ **No functionality loss** - They are error screenshots, not app assets
✅ **Recommended** - Will improve build performance and reduce app size

---

**Note**: Always create a backup before mass deletion. The UUID-named files are development artifacts and safe to remove.
