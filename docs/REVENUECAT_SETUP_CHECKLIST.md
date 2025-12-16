
# RevenueCat Setup Checklist

Use this checklist to complete your RevenueCat integration setup.

## ✅ Pre-Launch Checklist

### 1. RevenueCat Dashboard Setup

#### Products Configuration
- [ ] Log in to https://app.revenuecat.com/
- [ ] Select your SurfVista app
- [ ] Navigate to **Products** section
- [ ] Add product: `surfvista_monthly`
- [ ] Add product: `surfvista_annual`
- [ ] Add product: `monthly` (if using)
- [ ] Add product: `yearly` (if using)
- [ ] Verify all products are active

#### Entitlement Configuration
- [ ] Navigate to **Entitlements** section
- [ ] Create new entitlement with identifier: `premium`
- [ ] Set display name: "SurfVista Pro"
- [ ] Attach all products to this entitlement
- [ ] Save and verify entitlement is active

#### Offering Configuration
- [ ] Navigate to **Offerings** section
- [ ] Create new offering (or use default)
- [ ] Add monthly package with `surfvista_monthly` product
- [ ] Add annual package with `surfvista_annual` product
- [ ] Set offering as current/default
- [ ] Save and verify offering is active

#### Paywall Design
- [ ] Navigate to **Paywalls** section
- [ ] Create new paywall or customize default
- [ ] Add your app branding (logo, colors)
- [ ] Configure pricing display format
- [ ] Add features list (what users get)
- [ ] Set call-to-action button text
- [ ] Preview paywall on different devices
- [ ] Link paywall to your offering
- [ ] Save and publish paywall

#### Customer Center Configuration
- [ ] Navigate to **Customer Center** section
- [ ] Enable Customer Center
- [ ] Set support email address
- [ ] Add privacy policy URL
- [ ] Add terms of service URL
- [ ] Customize appearance/branding
- [ ] Test Customer Center preview
- [ ] Save configuration

### 2. App Store Connect Setup (iOS)

#### Create Subscription Products
- [ ] Log in to https://appstoreconnect.apple.com/
- [ ] Select your SurfVista app
- [ ] Navigate to **Features** > **In-App Purchases**
- [ ] Click **+** to create new subscription
- [ ] Create Monthly Subscription:
  - [ ] Product ID: `surfvista_monthly`
  - [ ] Reference Name: "SurfVista Monthly"
  - [ ] Subscription Group: Create or select group
  - [ ] Price: $4.99/month (or your price)
  - [ ] Add localized description
  - [ ] Add promotional image (optional)
  - [ ] Submit for review
- [ ] Create Annual Subscription:
  - [ ] Product ID: `surfvista_annual`
  - [ ] Reference Name: "SurfVista Annual"
  - [ ] Same subscription group
  - [ ] Price: $49.99/year (or your price)
  - [ ] Add localized description
  - [ ] Add promotional image (optional)
  - [ ] Submit for review
- [ ] Wait for Apple approval (usually 24-48 hours)

#### Link to RevenueCat
- [ ] In RevenueCat dashboard, go to **App Settings**
- [ ] Navigate to **Service Credentials**
- [ ] Click **Add Credentials** for iOS
- [ ] Follow instructions to add App Store Connect API key
- [ ] Verify connection is successful
- [ ] Wait for products to sync (5-10 minutes)

### 3. Google Play Console Setup (Android)

#### Create Subscription Products
- [ ] Log in to https://play.google.com/console/
- [ ] Select your SurfVista app
- [ ] Navigate to **Monetize** > **Subscriptions**
- [ ] Click **Create subscription**
- [ ] Create Monthly Subscription:
  - [ ] Product ID: `surfvista_monthly`
  - [ ] Name: "SurfVista Monthly"
  - [ ] Description: Add description
  - [ ] Price: $4.99/month (or your price)
  - [ ] Billing period: 1 month
  - [ ] Free trial: Optional
  - [ ] Save and activate
- [ ] Create Annual Subscription:
  - [ ] Product ID: `surfvista_annual`
  - [ ] Name: "SurfVista Annual"
  - [ ] Description: Add description
  - [ ] Price: $49.99/year (or your price)
  - [ ] Billing period: 1 year
  - [ ] Free trial: Optional
  - [ ] Save and activate

#### Link to RevenueCat
- [ ] In RevenueCat dashboard, go to **App Settings**
- [ ] Navigate to **Service Credentials**
- [ ] Click **Add Credentials** for Android
- [ ] Follow instructions to add Google Play service account
- [ ] Verify connection is successful
- [ ] Wait for products to sync (5-10 minutes)

### 4. Testing

#### Sandbox Testing (iOS)
- [ ] Create sandbox Apple ID in App Store Connect
- [ ] Sign out of App Store on test device
- [ ] Sign in with sandbox Apple ID in Settings > App Store
- [ ] Launch SurfVista app
- [ ] Test sign up flow
- [ ] Test paywall presentation
- [ ] Complete test purchase (free in sandbox)
- [ ] Verify subscription status updates
- [ ] Test restore purchases
- [ ] Test Customer Center
- [ ] Verify all features work

#### Test Account Testing (Android)
- [ ] Add test account in Google Play Console
- [ ] Sign in with test account on test device
- [ ] Launch SurfVista app
- [ ] Test sign up flow
- [ ] Test paywall presentation
- [ ] Complete test purchase (free for test accounts)
- [ ] Verify subscription status updates
- [ ] Test restore purchases
- [ ] Test Customer Center
- [ ] Verify all features work

#### Cross-Device Testing
- [ ] Test on multiple iOS devices
- [ ] Test on multiple Android devices
- [ ] Test on different screen sizes
- [ ] Test in light and dark mode
- [ ] Test with poor network connection
- [ ] Test restore purchases across devices

### 5. Production Preparation

#### API Key Update
- [ ] Get production API key from RevenueCat dashboard
- [ ] Open `utils/superwallConfig.ts`
- [ ] Replace test key with production key:
  ```typescript
  const REVENUECAT_API_KEY = 'YOUR_PRODUCTION_KEY_HERE';
  ```
- [ ] Save file
- [ ] Rebuild app

#### Final Testing
- [ ] Test with real purchase (you can refund)
- [ ] Verify purchase completes successfully
- [ ] Verify subscription status updates
- [ ] Verify Supabase sync works
- [ ] Test restore purchases
- [ ] Test Customer Center
- [ ] Verify admin bypass works
- [ ] Check all console logs for errors

#### App Store Submission
- [ ] Update app version number
- [ ] Build production app
- [ ] Submit to App Store Connect
- [ ] Submit to Google Play Console
- [ ] Include in-app purchase information
- [ ] Wait for review approval

### 6. Post-Launch

#### Monitoring
- [ ] Monitor RevenueCat dashboard for purchases
- [ ] Check for any errors in logs
- [ ] Monitor user feedback
- [ ] Track subscription metrics
- [ ] Set up RevenueCat webhooks (optional)

#### Optimization
- [ ] A/B test different paywall designs
- [ ] Analyze conversion rates
- [ ] Optimize pricing if needed
- [ ] Add promotional offers (optional)
- [ ] Implement win-back campaigns (optional)

## 📋 Quick Reference

### Important URLs
- **RevenueCat Dashboard**: https://app.revenuecat.com/
- **App Store Connect**: https://appstoreconnect.apple.com/
- **Google Play Console**: https://play.google.com/console/
- **RevenueCat Docs**: https://www.revenuecat.com/docs

### Product IDs
- Monthly: `surfvista_monthly`
- Annual: `surfvista_annual`
- Alternative Monthly: `monthly`
- Alternative Yearly: `yearly`

### Entitlement
- ID: `premium`
- Name: "SurfVista Pro"

### Current API Key
- Test: `test_pIbMwlfINrGOjQfGWYzmARWVOvg`
- Production: (Get from RevenueCat dashboard)

## ❓ Need Help?

### RevenueCat Support
- Email: support@revenuecat.com
- Community: https://community.revenuecat.com/
- Docs: https://www.revenuecat.com/docs

### Common Issues
- **No products showing**: Wait 5-10 minutes for sync
- **Purchase fails**: Check sandbox/test account setup
- **Restore fails**: Verify user has made a purchase

## 🎉 Launch Ready!

Once all items are checked, you're ready to launch! 🚀

---

**Last Updated**: January 2025
**App**: SurfVista
**Platform**: Expo 54 + React Native
