
# RevenueCat Integration Guide for SurfVista

## 📋 Overview

This guide will walk you through setting up RevenueCat for your SurfVista app. RevenueCat handles all subscription management, including:

- ✅ Subscription purchases
- ✅ Subscription renewals
- ✅ Restore purchases
- ✅ Entitlement checking
- ✅ Customer Center (manage subscriptions)
- ✅ Cross-platform support (iOS & Android)

## 🔑 Current Configuration

**API Key (Test):** `test_pOgVpdWTwmnVyqwEJWiaLTwHZsD`

**Products:**
- Monthly: `monthly` - $5.00/month
- Yearly: `yearly` - $50.00/year (adjust as needed)

**Entitlement:** `SurfVista`

## 📱 Step-by-Step Setup

### STEP 1: Create Products in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app: **SurfVista**
3. Navigate to **Monetization** > **Subscriptions**
4. Create a subscription group (if you don't have one)
5. Add your subscriptions:

   **Monthly Subscription:**
   - Product ID: `monthly` (must match exactly - case sensitive!)
   - Price: $5.00/month
   - Subscription Duration: 1 month
   - Display Name: "SurfVista Monthly"
   - Description: "Access to exclusive surf reports and 6K drone videos"

   **Yearly Subscription:**
   - Product ID: `yearly` (must match exactly - case sensitive!)
   - Price: $50.00/year (or your preferred annual price)
   - Subscription Duration: 1 year
   - Display Name: "SurfVista Yearly"
   - Description: "Annual access to exclusive surf reports and 6K drone videos"

6. Fill in all required fields (localization, review information, etc.)
7. Submit for review
8. **Important:** Products must be in "Ready to Submit" or "Approved" status

### STEP 2: Add Products to RevenueCat

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Select your project: **SurfVista**
3. Click **Products** in the left sidebar
4. Click **+ New** button

   **For Monthly Product:**
   - Product Identifier: `monthly` (must match App Store Connect exactly!)
   - Store: iOS App Store
   - Click **Save**

   **For Yearly Product:**
   - Product Identifier: `yearly` (must match App Store Connect exactly!)
   - Store: iOS App Store
   - Click **Save**

5. Wait 5-10 minutes for RevenueCat to sync with App Store Connect

### STEP 3: Create an Offering

Offerings are how you group products together for display in your app.

1. In RevenueCat Dashboard, go to **Offerings**
2. Click **+ New Offering**
3. Give it an identifier: `default` (or any name you prefer)
4. Add packages to the offering:
   - Click **+ Add Package**
   - Select **monthly** product
   - Package Type: Choose "Monthly" or "Custom"
   - Click **Add Package**
   - Select **yearly** product
   - Package Type: Choose "Annual" or "Custom"
5. Click **Make Current** to set this as your default offering
6. Click **Save**

### STEP 4: Create Entitlement

Entitlements represent access levels in your app.

1. In RevenueCat Dashboard, go to **Entitlements**
2. Click **+ New Entitlement**
3. Identifier: `SurfVista` (must match the code exactly!)
4. Display Name: "SurfVista Premium"
5. Attach products:
   - Select both `monthly` and `yearly` products
6. Click **Save**

### STEP 5: Create and Publish Paywall

The paywall is the UI that users see when subscribing.

1. In RevenueCat Dashboard, go to **Paywalls**
2. Click **+ Create Paywall**
3. Choose a template or create custom:
   - **Recommended:** Use a pre-built template for faster setup
   - Customize colors to match your brand (ocean blue theme)
4. Link to your offering:
   - Select the offering you created in Step 3
5. Customize content:
   - Headline: "Unlock Premium Surf Reports"
   - Features:
     - "6K Drone Videos Daily"
     - "Exclusive Surf Forecasts"
     - "Real-time Conditions"
     - "Ad-Free Experience"
6. Set pricing display:
   - Show both monthly and yearly options
   - Highlight yearly as "Best Value" (if applicable)
7. Click **Publish**

### STEP 6: Configure Customer Center (Optional but Recommended)

The Customer Center allows users to manage their subscriptions.

1. In RevenueCat Dashboard, go to **Customer Center**
2. Click **Enable Customer Center**
3. Customize appearance:
   - Match your app's branding
   - Choose which options to show (cancel, pause, etc.)
4. Configure management options:
   - Allow users to cancel
   - Allow users to change plans
   - Show billing history
5. Click **Save**

### STEP 7: Test with Sandbox

Before going live, test your subscription flow.

1. **Create Sandbox Tester:**
   - Go to App Store Connect
   - Navigate to **Users and Access** > **Sandbox Testers**
   - Click **+** to create a new tester
   - Use a unique email (doesn't need to be real)
   - Remember the password

2. **Configure iOS Device:**
   - On your iPhone, go to **Settings** > **App Store**
   - Scroll down and tap **Sandbox Account**
   - Sign out of any existing sandbox account
   - Don't sign in yet (you'll be prompted when testing)

3. **Test the Flow:**
   - Run your app on the device (not simulator)
   - Navigate to Profile screen
   - Tap "Subscribe Now"
   - When prompted, sign in with your sandbox tester account
   - Complete the purchase (it's free in sandbox)
   - Verify subscription is active

4. **Test Restore Purchases:**
   - Delete the app
   - Reinstall and sign in
   - Tap "Restore Purchases"
   - Verify subscription is restored

5. **Test Customer Center:**
   - While subscribed, tap "Manage Subscription"
   - Verify Customer Center opens
   - Test cancellation (it won't actually cancel in sandbox)

## 🔧 Troubleshooting

### "No offerings found"
- **Cause:** Offering not created or not marked as "Current"
- **Solution:** Follow Step 3 above, ensure offering is marked as "Current"

### "No products in offering"
- **Cause:** Products not added to offering
- **Solution:** Edit your offering and add both monthly and yearly products

### "Product IDs don't match"
- **Cause:** Product IDs in App Store Connect don't match RevenueCat
- **Solution:** Verify product IDs are exactly the same (case-sensitive)
  - App Store Connect: `monthly` and `yearly`
  - RevenueCat: `monthly` and `yearly`
  - Code: `monthly` and `yearly`

### "Paywall not showing"
- **Cause:** Paywall not published
- **Solution:** Go to Paywalls in RevenueCat, ensure paywall is published

### "Sandbox purchases not working"
- **Cause:** Not signed in with sandbox tester account
- **Solution:** Sign out of App Store in Settings, test again, sign in when prompted

### "Products show as $0.00"
- **Cause:** Testing on simulator (StoreKit doesn't work on simulator)
- **Solution:** Test on a real device

## 📱 How It Works in Your App

### Initialization

The SDK is initialized in `app/_layout.tsx`:

```typescript
import { initializeRevenueCat } from '@/utils/superwallConfig';

useEffect(() => {
  initializeRevenueCat();
}, []);
```

### Presenting Paywall

Users can subscribe from the Profile screen:

```typescript
import { presentPaywall } from '@/utils/superwallConfig';

const handleSubscribe = async () => {
  const result = await presentPaywall(user?.id, user?.email);
  
  if (result.state === 'purchased') {
    // Subscription successful!
  }
};
```

### Checking Entitlements

Check if user has access:

```typescript
import { checkEntitlements } from '@/utils/superwallConfig';

const hasAccess = await checkEntitlements();
if (hasAccess) {
  // User has SurfVista entitlement
}
```

### Customer Center

Let users manage their subscription:

```typescript
import { presentCustomerCenter } from '@/utils/superwallConfig';

const handleManageSubscription = async () => {
  await presentCustomerCenter();
};
```

### Restore Purchases

Let users restore previous purchases:

```typescript
import { restorePurchases } from '@/utils/superwallConfig';

const handleRestore = async () => {
  const result = await restorePurchases();
  
  if (result.success) {
    // Purchases restored!
  }
};
```

## 🚀 Going to Production

When you're ready to launch:

1. **Update API Key:**
   - In RevenueCat Dashboard, go to **Settings** > **API Keys**
   - Copy your **Production** iOS API key (starts with `appl_`)
   - Update `utils/superwallConfig.ts`:
     ```typescript
     const REVENUECAT_API_KEY_IOS = 'appl_YOUR_PRODUCTION_KEY';
     ```

2. **Submit App for Review:**
   - Ensure products are approved in App Store Connect
   - Submit your app with subscription features
   - Include screenshots showing subscription flow

3. **Monitor Dashboard:**
   - Check RevenueCat Dashboard for real purchases
   - Monitor subscription metrics
   - Set up webhooks for subscription events (optional)

## 📊 Key Features Implemented

✅ **Subscription Purchase** - Users can subscribe via paywall
✅ **Restore Purchases** - Users can restore on new devices
✅ **Entitlement Checking** - App checks for "SurfVista" entitlement
✅ **Customer Center** - Users can manage subscriptions
✅ **Supabase Sync** - Subscription status synced to your database
✅ **User Identification** - Users linked to their RevenueCat profile
✅ **Cross-Platform** - Works on iOS (Android ready when you add Android key)

## 🔗 Useful Links

- [RevenueCat Dashboard](https://app.revenuecat.com)
- [App Store Connect](https://appstoreconnect.apple.com)
- [RevenueCat Documentation](https://docs.revenuecat.com)
- [RevenueCat React Native SDK](https://docs.revenuecat.com/docs/reactnative)

## 💡 Best Practices

1. **Always test in sandbox before production**
2. **Use meaningful product IDs** (monthly, yearly, not prod1, prod2)
3. **Keep entitlement names simple** (SurfVista, not surf_vista_premium_access)
4. **Monitor your dashboard regularly** for subscription metrics
5. **Set up webhooks** to get notified of subscription events
6. **Provide clear value proposition** in your paywall
7. **Make restore purchases easy to find** for users switching devices

## 🎯 Next Steps

1. ✅ Complete Steps 1-7 above
2. ✅ Test thoroughly in sandbox
3. ✅ Update to production API key
4. ✅ Submit app for review
5. ✅ Monitor first real subscriptions
6. ✅ Iterate based on user feedback

---

**Need Help?**
- RevenueCat Support: support@revenuecat.com
- RevenueCat Community: community.revenuecat.com
- Check console logs for detailed error messages
