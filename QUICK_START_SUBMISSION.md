
# 🚀 SurfVista - Quick Start Submission Guide

## ⚡ 5 CRITICAL STEPS TO APP STORE

### 1️⃣ UPDATE CONTACT EMAIL (5 minutes)
```bash
# Edit these files and replace support@surfvista.com with your real email:
# - app/privacy-policy.tsx
# - app/terms-of-service.tsx
```

### 2️⃣ SETUP EAS BUILD (15 minutes)
```bash
# Install and configure EAS
npm install -g eas-cli
eas login
eas build:configure

# Get your project ID
eas project:info

# Update app.json with:
# - "owner": "your-expo-username"
# - "extra.eas.projectId": "your-project-id"
```

### 3️⃣ APPLE DEVELOPER ACCOUNT (1-2 hours + wait time)
1. Enroll at https://developer.apple.com/programs/ ($99/year)
2. Create App ID with bundle: `com.surfvista.app`
3. Create app in App Store Connect
4. Get Team ID from https://developer.apple.com/account
5. Update `eas.json` with Apple IDs

### 4️⃣ CREATE SUBSCRIPTION PRODUCTS (30 minutes)
1. In App Store Connect → Subscriptions
2. Create product: `surfvista_monthly` at $5/month
3. Verify in RevenueCat dashboard at https://app.revenuecat.com

### 5️⃣ BUILD & SUBMIT (1 hour)
```bash
# Test build first
eas build --platform ios --profile preview

# Test on TestFlight thoroughly

# Production build
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --profile production
```

---

## 📋 WHAT YOU NEED READY

### Before Building:
- ✅ Real support email address
- ✅ Apple Developer account ($99/year)
- ✅ EAS CLI installed and configured
- ✅ Subscription products created

### For App Store Connect:
- ✅ 5-10 screenshots (different iPhone sizes)
- ✅ App description (see FINAL_SUBMISSION_CHECKLIST.md)
- ✅ Keywords for search
- ✅ Demo account credentials for reviewers
- ✅ Support URL or email

---

## 🎯 CURRENT STATUS

### ✅ COMPLETED (95% Ready!)
- App fully functional
- RevenueCat integrated
- Privacy Policy & Terms implemented
- Backend configured
- Daily updates scheduled
- Video upload working

### 🚨 TODO (Complete These!)
1. Update support email
2. Configure EAS build
3. Set up Apple Developer account
4. Create subscription products
5. Prepare screenshots
6. Submit to App Store

---

## ⏱️ TIMELINE

- **Day 1:** Complete steps 1-3 (EAS + Apple setup)
- **Day 2:** Complete step 4 (Products) + prepare screenshots
- **Day 3:** Build and test on TestFlight
- **Day 4:** Submit to App Store
- **Day 5-7:** Apple review (typically 24-48 hours)
- **Day 7:** 🎉 LIVE ON APP STORE!

---

## 🆘 NEED HELP?

See **FINAL_SUBMISSION_CHECKLIST.md** for detailed step-by-step instructions.

**Quick Links:**
- EAS Docs: https://docs.expo.dev/build/introduction/
- Apple Developer: https://developer.apple.com
- App Store Connect: https://appstoreconnect.apple.com
- RevenueCat: https://app.revenuecat.com

---

**You're almost there! 🏄‍♂️🌊**
