
# SurfVista Launch Checklist 📋

Print this out and check off items as you complete them!

---

## Phase 1: Final Testing ✅
**Time: 30 minutes**

- [ ] Test admin video upload
  - [ ] Upload a test video
  - [ ] Verify it appears in Videos tab
  - [ ] Verify video plays correctly
  
- [ ] Test surf report generation
  - [ ] Go to Admin Panel → Data Management
  - [ ] Click "Update All Data"
  - [ ] Verify report appears in Report tab
  
- [ ] Test subscription flow
  - [ ] Create test user account
  - [ ] Verify Videos/Reports are locked
  - [ ] Test subscription button (will fail until RevenueCat is set up)
  
- [ ] Test admin features
  - [ ] User management
  - [ ] Report editing
  - [ ] Data updates

---

## Phase 2: RevenueCat Setup ⚙️
**Time: 30 minutes**

- [ ] Create RevenueCat account
  - [ ] Go to https://www.revenuecat.com/
  - [ ] Sign up for free account
  - [ ] Verify email
  
- [ ] Create project
  - [ ] Project name: "SurfVista"
  - [ ] Platform: iOS
  
- [ ] Create products
  - [ ] Monthly: `com.anonymous.Natively.monthly` - $10.99
  - [ ] Annual: `com.anonymous.Natively.annual` - $100.99
  
- [ ] Create entitlement
  - [ ] Name: "premium"
  - [ ] Attach both products
  
- [ ] Get API key
  - [ ] Copy iOS API key
  - [ ] Update `utils/superwallConfig.ts`
  - [ ] Restart app
  
- [ ] Test subscription
  - [ ] Try to subscribe in app
  - [ ] Verify paywall appears
  - [ ] Test with sandbox account

---

## Phase 3: Apple Developer Setup 🍎
**Time: 1 hour**

- [ ] Join Apple Developer Program
  - [ ] Go to https://developer.apple.com/
  - [ ] Enroll ($99/year)
  - [ ] Wait for approval (usually instant)
  
- [ ] Create App Store Connect app
  - [ ] Go to https://appstoreconnect.apple.com/
  - [ ] Click "My Apps" → "+"
  - [ ] App name: "SurfVista"
  - [ ] Bundle ID: `com.anonymous.Natively` (or your custom domain)
  - [ ] SKU: "surfvista-001"
  
- [ ] Configure in-app purchases
  - [ ] Go to "Features" → "In-App Purchases"
  - [ ] Create monthly subscription
    - [ ] Product ID: `com.anonymous.Natively.monthly`
    - [ ] Price: $10.99
  - [ ] Create annual subscription
    - [ ] Product ID: `com.anonymous.Natively.annual`
    - [ ] Price: $100.99
  - [ ] Submit for review

---

## Phase 4: App Store Assets 🎨
**Time: 2 hours**

- [ ] App icon
  - [ ] Create 1024x1024px icon
  - [ ] Upload to App Store Connect
  
- [ ] Screenshots
  - [ ] iPhone 6.7" (Pro Max): 5 screenshots
  - [ ] iPhone 6.5" (Plus): 5 screenshots
  - [ ] iPhone 5.5": 5 screenshots
  - [ ] Recommended: Home, Videos, Report, Login, Video Player
  
- [ ] App description
  - [ ] Write compelling description
  - [ ] Include key features
  - [ ] Mention Folly Beach, SC
  - [ ] Highlight 6K drone footage
  
- [ ] Keywords
  - [ ] surf, folly beach, surf report, waves, surfing, drone, beach, ocean
  
- [ ] Privacy policy
  - [ ] Create privacy policy page
  - [ ] Host on website or use generator
  - [ ] Add URL to App Store Connect
  
- [ ] Support URL
  - [ ] Create support email: support@surfvista.com
  - [ ] Or use contact form on website

---

## Phase 5: Build & Submit 🚀
**Time: 1 hour**

- [ ] Install EAS CLI
  ```bash
  npm install -g eas-cli
  ```
  
- [ ] Login to Expo
  ```bash
  eas login
  ```
  
- [ ] Configure build
  ```bash
  eas build:configure
  ```
  
- [ ] Build for iOS
  ```bash
  eas build --platform ios
  ```
  - [ ] Wait for build to complete (~20 minutes)
  
- [ ] Submit to App Store
  ```bash
  eas submit --platform ios
  ```
  
- [ ] Fill out App Store information
  - [ ] Age rating: 4+
  - [ ] Category: Sports
  - [ ] Copyright: Your name/company
  
- [ ] Submit for review
  - [ ] Click "Submit for Review"
  - [ ] Wait for Apple review (1-3 days)

---

## Phase 6: Pre-Launch Prep 📱
**Time: Ongoing**

- [ ] Content preparation
  - [ ] Record 5-10 drone videos
  - [ ] Upload to app
  - [ ] Test playback
  
- [ ] Marketing materials
  - [ ] Create Instagram account
  - [ ] Create TikTok account
  - [ ] Create Facebook page
  - [ ] Design promotional graphics
  
- [ ] Local outreach
  - [ ] Contact local surf shops
  - [ ] Reach out to local surfers
  - [ ] Post in Folly Beach community groups
  
- [ ] Pricing strategy
  - [ ] Decide on launch pricing
  - [ ] Consider promotional discount
  - [ ] Plan free trial period (optional)

---

## Phase 7: Launch Day 🎉
**Time: 1 day**

- [ ] App goes live
  - [ ] Verify app is available in App Store
  - [ ] Test download and installation
  - [ ] Test all features with real account
  
- [ ] Announce launch
  - [ ] Post on social media
  - [ ] Email friends and family
  - [ ] Post in local groups
  - [ ] Contact local news (optional)
  
- [ ] Monitor
  - [ ] Watch for crash reports
  - [ ] Respond to reviews
  - [ ] Track subscription metrics
  - [ ] Fix any critical issues

---

## Phase 8: Post-Launch 📈
**Time: Ongoing**

### Week 1:
- [ ] Upload 2-3 new videos
- [ ] Respond to all reviews
- [ ] Monitor analytics
- [ ] Fix any bugs reported

### Week 2-4:
- [ ] Continue regular video uploads
- [ ] Engage with subscribers
- [ ] Gather feedback
- [ ] Plan feature updates

### Month 2+:
- [ ] Analyze subscription metrics
- [ ] Adjust pricing if needed
- [ ] Add requested features
- [ ] Expand marketing efforts

---

## Success Metrics 📊

Track these numbers:

- [ ] Downloads: _____ (Goal: 100 in first month)
- [ ] Subscribers: _____ (Goal: 20 in first month)
- [ ] Conversion rate: _____% (Goal: 20%)
- [ ] Retention rate: _____% (Goal: 80%)
- [ ] Monthly revenue: $_____ (Goal: $200)

---

## Emergency Contacts 🆘

**If something goes wrong:**

1. **App crashes**: Check Supabase logs
2. **Payments not working**: Check RevenueCat dashboard
3. **Videos not uploading**: Check Supabase Storage
4. **Reports not generating**: Check Edge Function logs

**Support Resources:**
- RevenueCat Support: support@revenuecat.com
- Expo Support: https://expo.dev/support
- Supabase Support: https://supabase.com/support

---

## Notes & Reminders 📝

- Apple review typically takes 1-3 days
- First review may take longer
- Be prepared to respond to review questions
- Have test account ready for Apple reviewers
- Keep app updated with fresh content
- Respond to user reviews within 24 hours

---

## Celebration Time! 🎊

When you complete this checklist, you'll have:
- ✅ A fully functional surf report app
- ✅ Live in the App Store
- ✅ Accepting real subscriptions
- ✅ Generating revenue
- ✅ Serving the Folly Beach surf community

**You did it!** 🏄‍♂️🌊

---

**Started**: ___/___/___
**Completed**: ___/___/___
**Launch Date**: ___/___/___

---

*Keep this checklist handy and check off items as you go. You're closer than you think!*
