
# SurfVista 3.0 - Quick Submission Guide

## 🚀 5-Step Submission Process

### Step 1: Clean Up Assets (5 minutes)
```bash
cd assets/images

# Delete all UUID-named PNG files EXCEPT these 6:
# - 6c9e5721-4475-4d3a-bd06-7b3814dfb7c7.png (SurfVista logo - IN USE)
# - final_quest_240x240.png
# - final_quest_240x240__.png
# - natively-dark.png
# - 11315b0b-8f65-4b9f-a0bf-dea5762cae8d.jpeg
# - c36f9757-063c-4c3d-a829-a2b52440b7f8.jpeg

# Quick command (review before running):
find . -type f -name "*.png" \
  ! -name "6c9e5721-4475-4d3a-bd06-7b3814dfb7c7.png" \
  ! -name "final_quest_240x240.png" \
  ! -name "final_quest_240x240__.png" \
  ! -name "natively-dark.png" \
  -delete
```

### Step 2: Build for Production (15-20 minutes)
```bash
# From project root
eas build --platform ios --profile production
```

### Step 3: Download Build
1. Go to https://expo.dev
2. Find your SurfVista project
3. Download the `.ipa` file when build completes

### Step 4: Upload to App Store Connect
**Using Transporter (Easiest)**:
1. Open Transporter app on Mac
2. Drag `.ipa` file
3. Click "Deliver"

### Step 5: Configure & Submit
1. Go to https://appstoreconnect.apple.com
2. Select SurfVista (App ID: 6756734521)
3. Create version 3.0.0
4. Add "What's New" text (see below)
5. Select uploaded build
6. Submit for review

## 📝 What's New in Version 3.0

```
Version 3.0 - Major Update!

🌊 Multi-Location Support
• Now covering Folly Beach AND Pawleys Island
• Switch between locations instantly
• Location-specific surf reports and forecasts

📊 Enhanced Surf Reports
• More detailed narrative conditions
• Comprehensive weather and tide information
• Improved surf quality ratings

🎥 Video Improvements
• Faster video loading
• Better playback performance
• Optimized 6K drone footage streaming

⚡ Performance Enhancements
• Faster app startup
• Reduced app size
• Improved data fetching

🐛 Bug Fixes
• Fixed report generation issues
• Improved data accuracy
• Enhanced stability
```

## ✅ Pre-Flight Checklist

- [x] Version 3.0.0 set in app.json
- [x] iOS build number 3.0.0
- [x] Bundle ID: Therealfollysurfreport.SurfVista
- [ ] **Assets cleaned up (DELETE ~400 error screenshots)**
- [x] EAS configuration ready
- [x] Apple Developer account configured

## 🎯 Critical: Asset Cleanup

**MUST DO BEFORE BUILDING**: Delete ~400 UUID-named PNG error screenshots from `assets/images/`

**Why?**
- Reduces app size by 50-100 MB
- Faster downloads for users
- Meets Apple size guidelines
- Faster build times

**Keep Only These 6 Files**:
1. 6c9e5721-4475-4d3a-bd06-7b3814dfb7c7.png (logo - IN USE)
2. final_quest_240x240.png
3. final_quest_240x240__.png
4. natively-dark.png
5. 11315b0b-8f65-4b9f-a0bf-dea5762cae8d.jpeg
6. c36f9757-063c-4c3d-a829-a2b52440b7f8.jpeg

## 📱 App Info

- **Name**: SurfVista
- **Version**: 3.0.0
- **Build**: 3.0.0
- **Bundle ID**: Therealfollysurfreport.SurfVista
- **Apple ID**: lydonmn@aol.com
- **ASC App ID**: 6756734521
- **Team ID**: BC32GC8XTS

## ⏱️ Timeline

1. Asset cleanup: 5-10 minutes
2. EAS build: 15-20 minutes
3. Upload: 5-10 minutes
4. App Store config: 10-15 minutes
5. Apple review: 1-3 days

**Total prep time**: ~30-45 minutes

## 🆘 Troubleshooting

### Build fails?
```bash
# Clear cache and rebuild
eas build:cancel
eas build --platform ios --profile production --clear-cache
```

### Upload fails?
- Check file size (should be smaller after asset cleanup)
- Verify bundle identifier matches App Store Connect
- Ensure build number is higher than previous version

### Can't find build?
```bash
# List all builds
eas build:list
```

## 📚 Additional Resources

- Full details: `VERSION_3.0_SUBMISSION_READY.md`
- Asset cleanup: `ASSET_CLEANUP_GUIDE.md`
- RevenueCat setup: `REVENUECAT_PRODUCTION_READY.md`

---

**Ready to submit!** Just clean up assets and build. 🚀
