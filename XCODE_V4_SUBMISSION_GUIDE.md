
# 🚀 SurfVista Version 4.0 - Xcode Submission Guide

## ✅ Version Update Complete

**App Version:** 4.0.0  
**Build Number:** 4.0.0  
**Bundle ID:** Therealfollysurfreport.SurfVista

---

## 📦 Step 1: Generate iOS Build for Xcode

### Option A: Using EAS Build (Recommended)
```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Login to your Expo account
eas login

# Configure EAS Build (first time only)
eas build:configure

# Create iOS build for App Store
eas build --platform ios --profile production
```

### Option B: Using Expo Prebuild (Local Xcode)
```bash
# Generate native iOS project
npx expo prebuild --platform ios --clean

# This creates the ios/ folder with Xcode project
```

---

## 📥 Step 2: Download and Prepare for Xcode

### If using EAS Build:
1. Wait for build to complete (you'll get an email)
2. Download the `.tar.gz` file from the EAS dashboard
3. Extract the archive - you'll get an `ios/` folder
4. Open `ios/SurfVista.xcworkspace` in Xcode (NOT .xcodeproj)

### If using Local Prebuild:
1. Navigate to the `ios/` folder in your project
2. Open `SurfVista.xcworkspace` in Xcode

---

## 🔧 Step 3: Xcode Configuration Checklist

### In Xcode:
1. **Select Target:** Click on "SurfVista" in the left sidebar
2. **General Tab:**
   - ✅ Display Name: `SurfVista`
   - ✅ Bundle Identifier: `Therealfollysurfreport.SurfVista`
   - ✅ Version: `4.0.0`
   - ✅ Build: `4.0.0`
   - ✅ Deployment Target: iOS 15.0 or higher

3. **Signing & Capabilities:**
   - ✅ Team: Select your Apple Developer Team
   - ✅ Signing Certificate: Automatic or Manual
   - ✅ Provisioning Profile: App Store profile
   - ✅ Capabilities: In-App Purchase (if not already added)

4. **Build Settings:**
   - ✅ Code Signing Identity: iOS Distribution
   - ✅ Development Team: Your team ID

---

## 📱 Step 4: Archive and Upload

### Create Archive:
1. In Xcode menu: **Product → Archive**
2. Wait for archive to complete (5-15 minutes)
3. Organizer window will open automatically

### Upload to App Store Connect:
1. Select your archive
2. Click **Distribute App**
3. Choose **App Store Connect**
4. Click **Upload**
5. Select distribution options:
   - ✅ Include bitcode: NO (deprecated)
   - ✅ Upload symbols: YES
   - ✅ Manage Version and Build Number: Automatic
6. Click **Upload**

---

## 🌐 Step 5: App Store Connect Configuration

### Before Submission:
1. **Login to App Store Connect:** https://appstoreconnect.apple.com
2. **Select SurfVista app**
3. **Create New Version:** 4.0.0
4. **Fill Required Fields:**
   - ✅ What's New in This Version (Release Notes)
   - ✅ Screenshots (if updating)
   - ✅ App Preview (optional)

### Version 4.0 Release Notes (Suggested):
```
🌊 What's New in Version 4.0:

• Enhanced surf report accuracy with improved AI predictions
• Optimized video playback performance
• Updated privacy policy and terms of service
• Bug fixes and performance improvements
• Improved subscription management

Get the most accurate surf forecasts for Folly Beach with exclusive 6K drone footage!
```

### Critical Links (Must Be Public):
- ✅ Privacy Policy: https://doc-hosting.flycricket.io/surfvista-privacy-policy/11a49462-11bd-4fea-86f5-5d274b5b2ed8/privacy
- ✅ Terms of Service: (Your hosted URL)
- ✅ Support Email: lydon@entropyfinancialgroup.com

---

## 💳 Step 6: RevenueCat & Subscriptions

### Verify Configuration:
1. **RevenueCat Dashboard:**
   - ✅ Products linked: `surfvista_Monthly`, `surfvista_Annual`
   - ✅ Offering published: `ofrngf25b3975f3` 
   - ✅ Entitlement: `SurfVista`
   - ✅ API Key: Production key active

2. **App Store Connect:**
   - ✅ In-App Purchases: Monthly ($12.99), Annual ($99.99)
   - ✅ Status: Ready to Submit or Approved
   - ✅ Pricing: Verified

---

## 🧪 Step 7: TestFlight Testing (Optional but Recommended)

### Before Public Release:
1. Upload build to TestFlight (automatic after archive upload)
2. Add internal testers
3. Test key flows:
   - ✅ Login/Registration
   - ✅ Subscription purchase
   - ✅ Video playback
   - ✅ Surf report viewing
   - ✅ Location switching
4. Fix any critical issues
5. Upload new build if needed

---

## 📋 Step 8: Submit for Review

### In App Store Connect:
1. Select version 4.0.0
2. Choose the uploaded build
3. Fill out App Review Information:
   - ✅ Contact Information
   - ✅ Demo Account (if needed)
   - ✅ Notes for Reviewer
4. **Submit for Review**

### Review Notes (Suggested):
```
SurfVista Version 4.0

This update includes:
- Enhanced surf prediction algorithms
- Performance optimizations
- Updated legal documents

Subscription Testing:
- Monthly: $12.99/month (surfvista_Monthly)
- Annual: $99.99/year (surfvista_Annual)
- Managed via RevenueCat

Test Account (if needed):
Email: [provide test account]
Password: [provide test password]

Contact: lydon@entropyfinancialgroup.com
```

---

## ⏱️ Timeline

- **Archive Creation:** 5-15 minutes
- **Upload to App Store Connect:** 10-30 minutes
- **Processing:** 30-60 minutes
- **Review Time:** 1-3 days (typically 24-48 hours)

---

## 🆘 Troubleshooting

### Common Issues:

**"No signing identity found"**
- Solution: Add your Apple Developer account in Xcode Preferences → Accounts

**"Provisioning profile doesn't match"**
- Solution: Refresh profiles in Xcode or create new App Store profile in Developer Portal

**"Missing required icon"**
- Solution: Ensure app icon is 1024x1024 PNG without transparency

**"Invalid binary"**
- Solution: Check that all required capabilities are enabled (In-App Purchase)

**Build fails with "Command PhaseScriptExecution failed"**
- Solution: Clean build folder (Cmd+Shift+K) and rebuild

---

## 📞 Support

**Technical Issues:** lydon@entropyfinancialgroup.com  
**RevenueCat Dashboard:** https://app.revenuecat.com  
**App Store Connect:** https://appstoreconnect.apple.com

---

## ✅ Final Checklist Before Submission

- [ ] Version updated to 4.0.0 in app.json
- [ ] Build number updated to 4.0.0
- [ ] Xcode archive created successfully
- [ ] Build uploaded to App Store Connect
- [ ] Privacy Policy URL is public and accessible
- [ ] Terms of Service URL is public and accessible
- [ ] RevenueCat products are published and linked
- [ ] In-App Purchases are "Ready to Submit"
- [ ] Screenshots and metadata updated (if needed)
- [ ] Release notes written
- [ ] TestFlight testing completed (optional)
- [ ] App submitted for review

---

## 🎉 You're Ready!

Your app is now version 4.0.0 and ready for Xcode upload. Follow the steps above to archive, upload, and submit to the App Store.

**Good luck with your submission! 🏄‍♂️🌊**
