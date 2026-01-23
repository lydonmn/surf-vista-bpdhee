
# 🚀 SurfVista - Final App Store Submission Checklist

## ✅ COMPLETED ITEMS

### App Configuration
- ✅ App name: "SurfVista"
- ✅ Version: 1.0.0
- ✅ Bundle identifier: `com.surfvista.app`
- ✅ App icon and splash screen configured
- ✅ Privacy permissions properly described
- ✅ Encryption declaration set (ITSAppUsesNonExemptEncryption = false)

### Features
- ✅ User authentication (email/password)
- ✅ Subscription system (RevenueCat integrated)
- ✅ 6K video upload and playback
- ✅ Daily surf reports with AI-generated narratives
- ✅ 7-day forecast
- ✅ Real-time NOAA buoy data
- ✅ Tide schedules
- ✅ Weather forecasts
- ✅ Admin panel for content management

### Legal & Compliance
- ✅ Privacy Policy screen implemented
- ✅ Terms of Service screen implemented
- ✅ Both accessible from Profile screen
- ✅ Subscription terms clearly stated

### Backend
- ✅ Supabase database configured
- ✅ Edge Functions deployed for data updates
- ✅ Cron jobs scheduled (5 AM daily report, 15-min updates)
- ✅ Video storage configured
- ✅ Authentication system active

### Payment Integration
- ✅ RevenueCat SDK integrated (v9.6.10)
- ✅ Production API key configured
- ✅ Paywall implemented
- ✅ Customer Center for subscription management
- ✅ Restore purchases functionality
- ✅ Subscription status syncing with Supabase

---

## 🚨 CRITICAL: ITEMS YOU MUST COMPLETE

### 1. Update Contact Email (REQUIRED)
**Current Status:** Using placeholder `support@surfvista.com`

**Action Required:**
1. Set up a real email address for support (e.g., support@yourdomain.com)
2. Update in these files:
   - `app/privacy-policy.tsx` (line with "support@surfvista.com")
   - `app/terms-of-service.tsx` (line with "support@surfvista.com")

**Why:** Apple requires a valid, monitored support email. They may test it during review.

---

### 2. Configure EAS Build (REQUIRED)
**Current Status:** Placeholder values in `app.json` and `eas.json`

**Action Required:**

#### Step A: Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

#### Step B: Initialize EAS Project
```bash
cd /path/to/your/project
eas build:configure
```

#### Step C: Get Your Project ID
```bash
eas project:info
```
Copy the Project ID and update `app.json`:
```json
"extra": {
  "eas": {
    "projectId": "YOUR_PROJECT_ID_FROM_COMMAND_ABOVE"
  }
}
```

#### Step D: Update Your Expo Username
In `app.json`, replace:
```json
"owner": "YOUR_EXPO_USERNAME_HERE"
```
With your actual Expo username (from `eas whoami`)

---

### 3. Apple Developer Account Setup (REQUIRED)
**Current Status:** Not configured

**Action Required:**

#### Step A: Enroll in Apple Developer Program
1. Visit: https://developer.apple.com/programs/
2. Cost: $99/year
3. Complete enrollment (can take 24-48 hours)

#### Step B: Create App ID
1. Go to: https://developer.apple.com/account/resources/identifiers/list
2. Click "+" to create new App ID
3. Select "App IDs" → "App"
4. Description: "SurfVista"
5. Bundle ID: `com.surfvista.app` (MUST MATCH app.json)
6. Capabilities: Enable "In-App Purchase"
7. Click "Continue" → "Register"

#### Step C: Create App in App Store Connect
1. Go to: https://appstoreconnect.apple.com
2. Click "My Apps" → "+" → "New App"
3. Platform: iOS
4. Name: SurfVista
5. Primary Language: English (U.S.)
6. Bundle ID: Select `com.surfvista.app`
7. SKU: surfvista-ios (or any unique identifier)
8. User Access: Full Access
9. Click "Create"
10. **IMPORTANT:** Copy the App Store Connect App ID (numeric, like 1234567890)

#### Step D: Get Your Apple Team ID
1. Go to: https://developer.apple.com/account
2. Click "Membership" in sidebar
3. Copy your "Team ID" (10-character code like ABC123DEFG)

#### Step E: Update eas.json
Replace placeholders in `eas.json`:
```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your-actual-email@example.com",
      "ascAppId": "1234567890",
      "appleTeamId": "ABC123DEFG"
    }
  }
}
```

---

### 4. RevenueCat Products Setup (REQUIRED)
**Current Status:** API key configured, but products need verification

**Action Required:**

#### Step A: Create Products in App Store Connect
1. Go to: https://appstoreconnect.apple.com
2. Select your SurfVista app
3. Go to "Subscriptions" tab
4. Click "+" to create Subscription Group
5. Name: "SurfVista Premium"
6. Click "Create"

7. Click "+" to add subscription
8. Reference Name: "SurfVista Monthly"
9. Product ID: `surfvista_monthly` (MUST MATCH RevenueCat)
10. Subscription Duration: 1 Month
11. Click "Create"

12. Add Subscription Pricing:
    - Select countries/regions
    - Price: $5.00 USD (or your preferred price)
    - Click "Next" → "Create"

13. Add Subscription Information:
    - Display Name: "SurfVista Monthly"
    - Description: "Monthly access to exclusive Folly Beach surf reports"
    - Click "Save"

14. Submit for Review:
    - Add screenshot of subscription benefits
    - Click "Submit for Review"

#### Step B: Link to RevenueCat
1. Go to: https://app.revenuecat.com
2. Select your SurfVista project
3. Go to "Products" tab
4. Verify `surfvista_monthly` is listed
5. Go to "Offerings" tab
6. Verify offering `ofrnge7bdc97106` exists and is set as "Current"
7. Verify the offering contains `surfvista_monthly` product

---

### 5. Prepare App Store Assets (REQUIRED)

#### Screenshots Needed
You need screenshots for these device sizes:
- **6.7" iPhone (iPhone 15 Pro Max):** 1290 x 2796 pixels
- **6.5" iPhone (iPhone 14 Plus):** 1284 x 2778 pixels
- **5.5" iPhone (iPhone 8 Plus):** 1242 x 2208 pixels

**Recommended Screenshots:**
1. Home screen with current surf conditions
2. Surf report with video player
3. 7-day forecast view
4. Video library
5. Profile/subscription screen

**How to Capture:**
1. Build app for TestFlight (see step 7)
2. Install on physical device or simulator
3. Use iOS screenshot tool (Cmd+S in simulator)
4. Or use: `xcrun simctl io booted screenshot screenshot.png`

#### App Description
Prepare this for App Store Connect:

**Title:** SurfVista - Folly Beach Surf Reports

**Subtitle:** Exclusive Daily Surf Forecasts

**Description:**
```
Get exclusive, daily surf reports for Folly Beach, South Carolina!

SurfVista provides:
• 6K drone footage of current surf conditions
• AI-powered surf forecasts updated daily at 5 AM EST
• Real-time NOAA buoy data and wave heights
• Tide schedules and weather forecasts
• Expert surf ratings and recommendations

Perfect for surfers who want the most accurate, up-to-date information about Folly Beach conditions before heading out.

Subscription: $5/month
• Cancel anytime through your Apple ID settings
• Automatic daily updates at 5 AM EST
• Exclusive access to premium 6K drone videos
• Real-time surf conditions and forecasts

Terms of Service: Available in app
Privacy Policy: Available in app
```

#### Keywords
```
surf, surfing, folly beach, surf report, surf forecast, waves, ocean, beach, south carolina, charleston, surf conditions, tide, swell, drone, 6k video
```

#### App Category
- **Primary:** Sports
- **Secondary:** Weather

#### Age Rating
- 4+ (No objectionable content)

---

### 6. App Privacy Details (REQUIRED)
In App Store Connect, you'll need to declare:

**Data Types Collected:**
- ✅ Email Address
  - Used for: Account creation, customer support
  - Linked to user: Yes
  - Used for tracking: No

- ✅ User ID
  - Used for: App functionality, analytics
  - Linked to user: Yes
  - Used for tracking: No

- ✅ Purchase History
  - Used for: App functionality
  - Linked to user: Yes
  - Used for tracking: No

**Data Not Collected:**
- Location data
- Browsing history
- Search history
- Contacts
- Photos (only uploaded by admin)

---

## 🏗️ BUILD & SUBMIT PROCESS

### 7. Build for TestFlight (RECOMMENDED FIRST)

#### Step A: Build Preview Version
```bash
# Make sure you're in project directory
cd /path/to/surfvista

# Build for TestFlight
eas build --platform ios --profile preview
```

This will:
- Upload your code to EAS servers
- Build the app in the cloud
- Generate an IPA file
- Automatically upload to TestFlight

#### Step B: Test on TestFlight
1. Go to: https://appstoreconnect.apple.com
2. Select your app → TestFlight tab
3. Add internal testers (yourself, team members)
4. Install TestFlight app on iPhone
5. Accept invitation and install SurfVista
6. **Test thoroughly:**
   - ✅ Login/signup
   - ✅ Subscribe to premium ($5/month)
   - ✅ View surf reports
   - ✅ Watch 6K videos
   - ✅ Check 7-day forecast
   - ✅ Restore purchases
   - ✅ Manage subscription
   - ✅ Admin video upload (if admin)

---

### 8. Build for Production (FINAL STEP)

Once TestFlight testing is complete:

```bash
# Build production version
eas build --platform ios --profile production
```

This will:
- Create optimized production build
- Auto-increment build number
- Generate IPA for App Store

---

### 9. Submit to App Store

#### Option A: Automatic Submission (Recommended)
```bash
eas submit --platform ios --profile production
```

#### Option B: Manual Submission
1. Download IPA from EAS dashboard
2. Open Transporter app (Mac App Store)
3. Drag IPA file into Transporter
4. Click "Deliver"

---

### 10. Complete App Store Connect Listing

1. Go to: https://appstoreconnect.apple.com
2. Select SurfVista
3. Click "1.0 Prepare for Submission"

**Fill out all sections:**

#### App Information
- Name: SurfVista
- Subtitle: Exclusive Daily Surf Forecasts
- Privacy Policy URL: (You'll need to host this online)
- Category: Sports
- Secondary Category: Weather

#### Pricing and Availability
- Price: Free (with in-app purchases)
- Availability: All countries
- Pre-order: No

#### App Privacy
- Complete the privacy questionnaire (see step 6)

#### Version Information
- Screenshots: Upload all required sizes
- Description: Use description from step 5
- Keywords: Use keywords from step 5
- Support URL: Your website or support page
- Marketing URL: (Optional)

#### Build
- Select the build you uploaded
- Export Compliance: No (already declared in app.json)

#### General App Information
- App Icon: Already included in build
- Version: 1.0.0
- Copyright: © 2025 Your Name/Company
- Age Rating: 4+
- Contact Information: Your email and phone

#### App Review Information
- Sign-In Required: Yes
- Demo Account:
  - Username: Create a test account
  - Password: Provide password
  - Notes: "This is a subscriber-only app. Test account has active subscription."

- Contact Information:
  - First Name: Your name
  - Last Name: Your name
  - Phone: Your phone
  - Email: Your support email

- Notes:
  ```
  SurfVista provides exclusive surf reports for Folly Beach, SC.
  
  To test subscription:
  - Use the provided test account (already subscribed)
  - Or use Sandbox testing with test Apple ID
  
  Key features:
  - Daily surf reports updated at 5 AM EST
  - 6K drone videos of surf conditions
  - Real-time NOAA buoy data
  - 7-day forecasts
  
  Admin features (not needed for review):
  - Video upload requires admin privileges
  - Test account is a regular subscriber
  ```

#### Version Release
- Automatically release this version
- Or: Manually release this version

---

### 11. Submit for Review

1. Review all information
2. Click "Add for Review"
3. Click "Submit to App Store Review"

**Review Timeline:**
- Typically 24-48 hours
- Can take up to 7 days
- You'll receive email updates

---

## 🐛 COMMON REJECTION REASONS & HOW TO AVOID

### 1. Guideline 2.1 - App Completeness
**Issue:** App crashes or has broken features
**Prevention:** Test thoroughly on TestFlight before submitting

### 2. Guideline 3.1.1 - In-App Purchase
**Issue:** Subscription not clear or using non-Apple payment
**Prevention:** ✅ Already using Apple In-App Purchase via RevenueCat

### 3. Guideline 5.1.1 - Privacy Policy
**Issue:** Missing or inaccessible privacy policy
**Prevention:** ✅ Already implemented in app

### 4. Guideline 2.3.1 - Accurate Metadata
**Issue:** Screenshots don't match app or misleading description
**Prevention:** Use actual app screenshots, accurate description

### 5. Guideline 4.0 - Design
**Issue:** App looks unfinished or has poor UI
**Prevention:** ✅ App has polished UI with proper navigation

---

## 📊 POST-SUBMISSION

### If Approved ✅
1. App goes live on App Store
2. Monitor reviews and ratings
3. Respond to user feedback
4. Plan updates based on user requests

### If Rejected ❌
1. Read rejection reason carefully in Resolution Center
2. Fix the specific issue mentioned
3. Respond to reviewer with explanation of fix
4. Resubmit (no need to rebuild if just metadata changes)

---

## 🎯 FINAL CHECKLIST BEFORE SUBMITTING

- [ ] Updated support email in Privacy Policy and Terms
- [ ] Configured EAS with project ID and username
- [ ] Enrolled in Apple Developer Program ($99/year)
- [ ] Created App ID in Apple Developer Portal
- [ ] Created app in App Store Connect
- [ ] Updated eas.json with Apple IDs
- [ ] Created subscription products in App Store Connect
- [ ] Verified RevenueCat products are linked
- [ ] Prepared all required screenshots
- [ ] Written app description and keywords
- [ ] Tested thoroughly on TestFlight
- [ ] Completed App Privacy questionnaire
- [ ] Provided demo account credentials
- [ ] Built production version with `eas build`
- [ ] Submitted to App Store
- [ ] Completed all App Store Connect fields

---

## 📞 SUPPORT RESOURCES

- **Expo Documentation:** https://docs.expo.dev
- **EAS Build Guide:** https://docs.expo.dev/build/introduction/
- **EAS Submit Guide:** https://docs.expo.dev/submit/introduction/
- **App Store Review Guidelines:** https://developer.apple.com/app-store/review/guidelines/
- **RevenueCat Documentation:** https://docs.revenuecat.com
- **App Store Connect:** https://appstoreconnect.apple.com
- **Apple Developer Portal:** https://developer.apple.com/account

---

## 🎉 YOU'RE ALMOST READY!

Your app is **95% ready** for submission! Complete the items in the "CRITICAL" section above, and you'll be ready to submit to Apple.

**Estimated Time to Complete:**
- EAS setup: 15 minutes
- Apple Developer setup: 1-2 hours (including enrollment wait time)
- RevenueCat products: 30 minutes
- Screenshots and metadata: 1-2 hours
- TestFlight testing: 1-2 days
- **Total: 2-3 days** (including Apple enrollment processing)

Good luck with your launch! 🏄‍♂️🌊

---

*Last Updated: January 2025*
*App Version: 1.0.0*
*Checklist Version: 1.0*
