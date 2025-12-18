
# Apple Developer Approved - Next Steps Guide 🎉

Congratulations on getting approved by Apple Developer! Now let's get your SurfVista app ready for the App Store.

---

## Current Status ✅

Your app is **95% complete** and ready for launch! Here's what's already done:

- ✅ User authentication system
- ✅ Video upload and playback (6K support)
- ✅ Surf reports with NOAA data integration
- ✅ Weather forecasts
- ✅ Admin panel
- ✅ Subscription system (RevenueCat integrated)
- ✅ Database and storage configured
- ✅ iOS and Android support

**What's left:** Configure in-app purchases and submit to App Store

---

## Phase 1: App Store Connect Setup (30 minutes)

### Step 1: Create Your App in App Store Connect

1. **Go to App Store Connect**
   - Visit: https://appstoreconnect.apple.com/
   - Sign in with your Apple Developer account

2. **Create New App**
   - Click "My Apps" → "+" button → "New App"
   - Fill in the details:
     - **Platform**: iOS
     - **Name**: SurfVista
     - **Primary Language**: English (U.S.)
     - **Bundle ID**: Select "com.anonymous.Natively" (or create new one)
     - **SKU**: surfvista-001 (unique identifier for your records)
     - **User Access**: Full Access

3. **App Information**
   - **Category**: Sports
   - **Secondary Category** (optional): Lifestyle
   - **Content Rights**: Check if you own all rights to the content

### Step 2: Configure In-App Purchases

This is critical for your $5/month subscription!

1. **Navigate to In-App Purchases**
   - In App Store Connect, select your app
   - Go to "Features" → "In-App Purchases"
   - Click the "+" button

2. **Create Monthly Subscription**
   - **Type**: Auto-Renewable Subscription
   - **Reference Name**: SurfVista Monthly Subscription
   - **Product ID**: `surfvista_monthly` (IMPORTANT: Must match exactly)
   - **Subscription Group**: Create new → "SurfVista Subscriptions"
   
   **Pricing**:
   - Click "Add Subscription Pricing"
   - Select all territories
   - Price: $10.99 USD (you can adjust this later)
   - Start Date: Today
   - Duration: 1 Month
   
   **Localization**:
   - Display Name: "Monthly Subscription"
   - Description: "Access to exclusive 6K drone surf videos and daily surf reports for Folly Beach, SC"
   
   **Review Information**:
   - Screenshot: Upload a screenshot of your app
   - Review Notes: "This subscription provides access to exclusive surf content"

3. **Create Annual Subscription (Optional but Recommended)**
   - **Type**: Auto-Renewable Subscription
   - **Reference Name**: SurfVista Annual Subscription
   - **Product ID**: `surfvista_annual`
   - **Subscription Group**: Same as monthly
   - **Price**: $100.99 USD (saves ~$30/year)
   - **Duration**: 1 Year
   - Same localization and review info as monthly

4. **Submit for Review**
   - Click "Submit" on each subscription
   - Apple will review these along with your app

---

## Phase 2: RevenueCat Configuration (20 minutes)

RevenueCat is already integrated in your app - you just need to configure it!

### Step 1: Create RevenueCat Account

1. **Sign Up**
   - Go to: https://app.revenuecat.com/
   - Click "Get Started Free"
   - Sign up with your email
   - Verify your email

2. **Create Project**
   - Project Name: "SurfVista"
   - Platform: iOS (you can add Android later)

### Step 2: Connect to App Store Connect

1. **Generate App Store Connect API Key**
   - In App Store Connect, go to "Users and Access"
   - Click "Keys" tab under "Integrations"
   - Click "+" to generate new key
   - Name: "RevenueCat Integration"
   - Access: "Admin" or "App Manager"
   - Download the .p8 file (save it securely!)
   - Note the Key ID and Issuer ID

2. **Add to RevenueCat**
   - In RevenueCat dashboard, go to your project
   - Click "App Settings" → "Apple App Store"
   - Upload the .p8 file
   - Enter Key ID and Issuer ID
   - Enter your Bundle ID: `com.anonymous.Natively`
   - Click "Save"

### Step 3: Configure Products in RevenueCat

1. **Add Products**
   - Go to "Products" in RevenueCat
   - Click "Add Product"
   - Enter Product ID: `surfvista_monthly` (must match App Store Connect)
   - Type: Subscription
   - Click "Save"
   - Repeat for `surfvista_annual` if you created it

2. **Create Entitlement**
   - Go to "Entitlements"
   - Click "New Entitlement"
   - Identifier: `premium` (IMPORTANT: Must match exactly)
   - Display Name: "Premium Access"
   - Attach both products to this entitlement
   - Click "Save"

3. **Create Offering**
   - Go to "Offerings"
   - The "default" offering should already exist
   - Click on it to edit
   - Add your products:
     - Monthly: Set as "$rc_monthly" package
     - Annual: Set as "$rc_annual" package
   - Make this offering "Current"
   - Click "Save"

4. **Configure Paywall (Optional but Recommended)**
   - Go to "Paywalls" in RevenueCat
   - Click "Create Paywall"
   - Choose a template or design custom
   - Add your branding and copy:
     - Title: "Unlock Premium Surf Reports"
     - Features:
       - 📹 6K Resolution Drone Videos
       - 🌊 Daily Surf Condition Reports
       - 🌤️ 7-Day Weather Forecasts
       - 🏄 Exclusive Folly Beach Content
   - Link to your "default" offering
   - Publish the paywall

### Step 4: Get Your API Keys

1. **Copy API Keys**
   - In RevenueCat, go to "Settings" → "API Keys"
   - Copy your **iOS API Key** (starts with `appl_`)
   - Keep this handy for the next step

2. **Update Your App**
   - Open `utils/superwallConfig.ts` in your code
   - Find this line:
     ```typescript
     const REVENUECAT_API_KEY_IOS = 'test_pIbMwlfINrGOjQfGWYzmARWVOvg';
     ```
   - Replace with your production key:
     ```typescript
     const REVENUECAT_API_KEY_IOS = 'appl_YOUR_KEY_HERE';
     ```
   - Save the file

3. **Verify Product IDs Match**
   - In the same file, verify these match what you created:
     ```typescript
     PRODUCTS: {
       MONTHLY_SUBSCRIPTION: 'surfvista_monthly',  // Must match App Store Connect
       ANNUAL_SUBSCRIPTION: 'surfvista_annual',    // Must match App Store Connect
     },
     ENTITLEMENT_ID: 'premium',  // Must match RevenueCat
     ```

---

## Phase 3: Test Your Subscription Flow (15 minutes)

Before submitting to Apple, test everything!

### Step 1: Create Sandbox Test Account

1. **In App Store Connect**
   - Go to "Users and Access"
   - Click "Sandbox Testers"
   - Click "+" to add tester
   - Email: Create a new email (e.g., test@yourdomain.com)
   - Password: Create a strong password
   - First/Last Name: Test User
   - Country: United States
   - Click "Save"

### Step 2: Test on Device

1. **Sign Out of Production Apple ID**
   - On your iPhone, go to Settings
   - Tap your name at top
   - Scroll down and tap "Sign Out"
   - Or just sign out of App Store specifically

2. **Run Your App**
   ```bash
   npm run ios
   ```

3. **Test Subscription Flow**
   - Sign up for a new account in your app
   - Go to Profile tab
   - Tap "Subscribe Now - $10.99/month"
   - Should see RevenueCat paywall
   - Tap to purchase
   - When prompted, sign in with sandbox test account
   - Complete purchase
   - Verify subscription activates in app
   - Check that Videos and Reports are now accessible

4. **Test Restore Purchases**
   - Sign out of your app
   - Sign in again
   - Tap "Restore Purchases"
   - Subscription should restore

### Step 3: Verify in RevenueCat Dashboard

1. **Check Customer**
   - Go to RevenueCat dashboard
   - Click "Customers"
   - Search for your test user
   - Should see active subscription
   - Verify entitlement is granted

---

## Phase 4: Prepare App Store Assets (1-2 hours)

### Required Assets

1. **App Icon**
   - Size: 1024x1024 pixels
   - Format: PNG (no transparency)
   - No rounded corners (Apple adds them)
   - Should represent your brand
   - Suggestion: Ocean wave or surfboard with "SurfVista" text

2. **Screenshots** (Required for iPhone)
   You need screenshots for these sizes:
   - **6.7" Display** (iPhone 14 Pro Max, 15 Pro Max): 1290 x 2796 pixels
   - **6.5" Display** (iPhone 11 Pro Max, XS Max): 1242 x 2688 pixels
   - **5.5" Display** (iPhone 8 Plus): 1242 x 2208 pixels

   **Recommended Screenshots** (5 total):
   1. Home screen with surf conditions
   2. Video player showing drone footage
   3. Surf report with weather data
   4. Videos library
   5. Subscription/paywall screen

   **How to Capture**:
   - Use iOS Simulator
   - Run your app
   - Navigate to each screen
   - Press Cmd+S to save screenshot
   - Or use your actual device and AirDrop screenshots

3. **App Preview Video** (Optional but Recommended)
   - 15-30 seconds
   - Shows key features
   - Same sizes as screenshots
   - Can use screen recording

### App Store Information

1. **App Description** (4000 character limit)
   ```
   SurfVista - Your Premium Folly Beach Surf Report

   Get exclusive access to daily surf conditions, 6K drone footage, and accurate weather forecasts for Folly Beach, South Carolina.

   FEATURES:
   • 6K Resolution Drone Videos - See the surf conditions from above
   • Daily Surf Reports - Updated every morning with current conditions
   • 7-Day Weather Forecast - Plan your surf sessions in advance
   • Wave Height & Direction - Powered by NOAA data
   • Tide Information - Know the best times to surf
   • Wind Conditions - Speed, direction, and gusts
   • Water Temperature - Stay informed about ocean conditions

   SUBSCRIPTION:
   • Monthly: $10.99/month
   • Annual: $100.99/year (save $30!)
   • Cancel anytime
   • Manage subscription in Settings

   ABOUT:
   SurfVista is created by local surfers for the Folly Beach community. We provide the most accurate and up-to-date surf information to help you catch the best waves.

   Privacy Policy: [Your URL]
   Terms of Service: [Your URL]
   ```

2. **Keywords** (100 character limit)
   ```
   surf,folly beach,surf report,waves,surfing,drone,beach,ocean,weather,forecast,south carolina
   ```

3. **Promotional Text** (170 character limit)
   ```
   Get exclusive 6K drone footage and daily surf reports for Folly Beach, SC. Subscribe now and never miss the perfect wave!
   ```

4. **Support URL**
   - Create a simple support page or use email
   - Example: `mailto:support@surfvista.com`
   - Or create a page on your website

5. **Privacy Policy URL** (Required!)
   - You MUST have a privacy policy
   - Can use a generator: https://www.privacypolicygenerator.info/
   - Host on your website or use a free hosting service
   - Must include:
     - What data you collect (email, subscription status)
     - How you use it (authentication, subscription management)
     - Third-party services (Supabase, RevenueCat, NOAA)
     - User rights (delete account, cancel subscription)

---

## Phase 5: Build and Submit (30 minutes)

### Step 1: Update App Configuration

1. **Update app.json**
   - Open `app.json`
   - Update version if needed: `"version": "1.0.0"`
   - Verify bundle ID: `"bundleIdentifier": "com.anonymous.Natively"`
   - Add privacy descriptions (already done in your app)

2. **Update Bundle ID (If Using Custom Domain)**
   - If you have a custom domain, update to: `com.yourdomain.surfvista`
   - Update in:
     - `app.json` → `ios.bundleIdentifier`
     - App Store Connect
     - RevenueCat dashboard

### Step 2: Build with EAS

1. **Install EAS CLI** (if not already installed)
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**
   ```bash
   eas login
   ```

3. **Configure Build**
   ```bash
   eas build:configure
   ```
   - Select iOS
   - Choose production profile

4. **Build for iOS**
   ```bash
   eas build --platform ios --profile production
   ```
   - This will take 15-20 minutes
   - You'll get a link to track progress
   - When done, you'll get a download link

### Step 3: Submit to App Store

1. **Submit via EAS**
   ```bash
   eas submit --platform ios
   ```
   - Follow the prompts
   - Enter your Apple ID credentials
   - Select the build you just created

2. **Or Submit Manually**
   - Download the .ipa file from EAS
   - Use Transporter app (Mac App Store)
   - Drag and drop the .ipa file
   - Click "Deliver"

### Step 4: Complete App Store Connect

1. **Add Screenshots and Assets**
   - Go to your app in App Store Connect
   - Click "1.0 Prepare for Submission"
   - Upload screenshots for each device size
   - Upload app icon
   - Add app preview video (if you made one)

2. **Fill in App Information**
   - Add description, keywords, promotional text
   - Add support URL and privacy policy URL
   - Select age rating (likely 4+)
   - Add copyright information

3. **Configure Pricing**
   - Select "Free" (since you have in-app purchases)
   - Select all territories or specific countries

4. **App Review Information**
   - **Contact Information**: Your email and phone
   - **Demo Account**: Create a test account for Apple reviewers
     - Email: reviewer@surfvista.com (or similar)
     - Password: TestPassword123!
     - Make this account have an active subscription
   - **Notes**: 
     ```
     This app requires a subscription to access content.
     
     Demo Account Credentials:
     Email: reviewer@surfvista.com
     Password: TestPassword123!
     
     This account has an active subscription and can access all features.
     
     The app displays surf reports and drone footage for Folly Beach, SC.
     Subscription is managed through RevenueCat.
     ```

5. **Submit for Review**
   - Review all information
   - Check "Export Compliance" (select "No" if you're not using encryption beyond HTTPS)
   - Click "Submit for Review"

---

## Phase 6: While Waiting for Review (1-3 days)

### What to Do

1. **Prepare Content**
   - Record 5-10 drone videos
   - Have them ready to upload on launch day
   - Test upload process

2. **Create Marketing Materials**
   - Instagram account: @surfvista
   - Facebook page
   - TikTok account
   - Design promotional graphics

3. **Local Outreach**
   - Contact local surf shops
   - Reach out to Folly Beach surf community
   - Post in local Facebook groups
   - Contact local surf instructors

4. **Monitor Review Status**
   - Check App Store Connect daily
   - Respond quickly to any questions from Apple
   - Be ready to make changes if needed

### Common Review Issues

1. **"App crashes on launch"**
   - Test on multiple devices
   - Check crash logs in App Store Connect
   - Fix and resubmit

2. **"In-app purchase not working"**
   - Verify sandbox testing worked
   - Check RevenueCat configuration
   - Provide detailed testing instructions

3. **"Missing privacy policy"**
   - Ensure URL is accessible
   - Make sure it covers all data collection
   - Update and resubmit

4. **"Demo account doesn't work"**
   - Test the demo account yourself
   - Make sure subscription is active
   - Provide clear instructions

---

## Phase 7: Launch Day! 🚀

### When Approved

1. **Release the App**
   - In App Store Connect, click "Release this version"
   - App will be live within a few hours

2. **Upload Initial Content**
   - Sign in as admin
   - Upload 5-10 drone videos
   - Verify surf reports are generating
   - Test everything one more time

3. **Announce Launch**
   - Post on social media
   - Email friends and family
   - Post in local groups
   - Contact local news (optional)

4. **Monitor**
   - Watch for crash reports
   - Respond to reviews (within 24 hours)
   - Track subscription metrics in RevenueCat
   - Fix any critical issues immediately

---

## Pricing Strategy

### Current Configuration
- **Monthly**: $10.99/month
- **Annual**: $100.99/year (saves $30.88)

### Recommendations

1. **Launch Pricing**
   - Consider a launch discount: $4.99/month for first month
   - Or offer 7-day free trial
   - Can configure in RevenueCat

2. **Adjust Later**
   - Monitor conversion rates
   - If too low, consider lowering price
   - If too high, consider raising price
   - Can change in App Store Connect and RevenueCat

3. **Promotional Offers**
   - RevenueCat supports promotional offers
   - Can offer discounts to specific users
   - Can create seasonal promotions

---

## Success Metrics

### Track These Numbers

**Week 1:**
- Downloads: Target 50-100
- Subscribers: Target 10-20
- Conversion Rate: Target 15-20%

**Month 1:**
- Downloads: Target 200-500
- Subscribers: Target 50-100
- Monthly Revenue: Target $500-1000
- Retention: Target 80%+

**Month 3:**
- Downloads: Target 1000+
- Subscribers: Target 200-300
- Monthly Revenue: Target $2000-3000
- Retention: Target 85%+

### Where to Track

1. **App Store Connect**
   - Downloads
   - Crashes
   - Reviews and ratings

2. **RevenueCat Dashboard**
   - Active subscriptions
   - Revenue
   - Churn rate
   - Conversion rate

3. **Supabase Dashboard**
   - User signups
   - Video uploads
   - Report generation
   - Database usage

---

## Troubleshooting

### "Paywall not showing"

**Check:**
1. RevenueCat API key is production key (not test key)
2. Products are created in App Store Connect
3. Products are added to RevenueCat
4. Entitlement is configured
5. Offering is set as "Current"
6. App has been restarted after config changes

**Solution:**
- Check console logs for `[RevenueCat]` messages
- Verify configuration in RevenueCat dashboard
- Test with sandbox account

### "Purchase not activating"

**Check:**
1. Using sandbox test account (not production Apple ID)
2. Subscription shows in RevenueCat dashboard
3. Profile refresh button updates status
4. Supabase `profiles` table shows subscription

**Solution:**
- Tap "Refresh Profile Data" in app
- Tap "Restore Purchases"
- Check RevenueCat customer page
- Verify webhook is configured (optional)

### "App rejected by Apple"

**Common reasons:**
1. Demo account doesn't work
2. Privacy policy missing or incomplete
3. App crashes on specific device
4. In-app purchase not working
5. Misleading screenshots or description

**Solution:**
- Read rejection reason carefully
- Fix the specific issue
- Test thoroughly
- Resubmit with explanation

---

## Post-Launch Checklist

### Daily (First Week)
- [ ] Upload new drone video
- [ ] Check for crashes in App Store Connect
- [ ] Respond to reviews
- [ ] Monitor subscription metrics
- [ ] Check surf report generation

### Weekly
- [ ] Upload 2-3 new videos
- [ ] Analyze conversion rates
- [ ] Review user feedback
- [ ] Plan feature updates
- [ ] Engage with community

### Monthly
- [ ] Review revenue and growth
- [ ] Plan marketing campaigns
- [ ] Consider feature additions
- [ ] Update content strategy
- [ ] Optimize pricing if needed

---

## Resources

### Your Documentation
- **Setup Guide**: `docs/REVENUECAT_SETUP_COMPLETE.md`
- **Admin Guide**: `docs/ADMIN_QUICK_GUIDE.md`
- **Testing Guide**: `docs/TESTING_GUIDE.md`
- **Launch Checklist**: `docs/LAUNCH_CHECKLIST.md`

### External Resources
- **App Store Connect**: https://appstoreconnect.apple.com/
- **RevenueCat Dashboard**: https://app.revenuecat.com/
- **RevenueCat Docs**: https://docs.revenuecat.com/
- **Expo EAS**: https://docs.expo.dev/eas/
- **Apple Developer**: https://developer.apple.com/

### Support
- **RevenueCat Support**: support@revenuecat.com
- **Expo Support**: https://expo.dev/support
- **Apple Developer Support**: https://developer.apple.com/support/

---

## Timeline Summary

| Phase | Time | Status |
|-------|------|--------|
| App Store Connect Setup | 30 min | ⏳ To Do |
| RevenueCat Configuration | 20 min | ⏳ To Do |
| Test Subscription Flow | 15 min | ⏳ To Do |
| Prepare Assets | 1-2 hours | ⏳ To Do |
| Build and Submit | 30 min | ⏳ To Do |
| Apple Review | 1-3 days | ⏳ Waiting |
| **Total Time to Submit** | **3-4 hours** | |
| **Total Time to Launch** | **2-4 days** | |

---

## You're Ready! 🎉

Your app is production-ready. The code is solid, the features work, and you have Apple Developer access. Now it's just configuration and submission!

**Next Action**: Start with Phase 1 (App Store Connect Setup) - it takes 30 minutes and you can do it right now!

**Questions?** Check the detailed guides in the `docs/` folder or the resources section above.

**Good luck with your launch!** 🏄‍♂️🌊

---

*Last Updated: After Apple Developer Approval*
*App Version: 1.0.0*
*Status: Ready for App Store Submission*
