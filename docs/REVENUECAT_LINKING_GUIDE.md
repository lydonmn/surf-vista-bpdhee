
# RevenueCat Product Linking Guide - SurfVista

This guide will walk you through linking your RevenueCat products to your SurfVista app using YOUR specific identifiers.

## 🎯 YOUR SURFVISTA IDENTIFIERS

**These are already configured in your app code:**

### Product Identifiers (In-App Purchase IDs)
- `surfvista_monthly` - Monthly Subscription
- `surfvista_annual` - Annual Subscription
- `monthly` - Alternative monthly ID
- `yearly` - Alternative annual ID

### Offering Identifier
- `ofrnge7bdc97106` - Your primary offering
- `default` - Fallback offering

### Entitlement Identifier
- `premium` - SurfVista Pro access

**⚠️ CRITICAL**: These identifiers MUST match exactly across all platforms!

---

## Overview

Your app is already set up to use RevenueCat for subscriptions. You just need to:
1. Get your RevenueCat API keys
2. Configure products in RevenueCat dashboard with YOUR identifiers
3. Update the API keys in your code
4. Test the integration

## Step-by-Step Setup

### 1. Create RevenueCat Account

1. Go to [https://www.revenuecat.com/](https://www.revenuecat.com/)
2. Sign up for a free account
3. Create a new project for your app

### 2. Add Your App to RevenueCat

1. In the RevenueCat dashboard, click **"Add App"**
2. Enter your app details:
   - **App Name**: SurfVista
   - **Bundle ID (iOS)**: `com.anonymous.Natively` (or your actual bundle ID)
   - **Package Name (Android)**: `com.anonymous.Natively` (or your actual package name)

### 3. Configure Products in RevenueCat

#### Step 3a: Add Products to App Store Connect (iOS)

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Select your app
3. Go to **Features** > **In-App Purchases**
4. Click **"+"** to add a new subscription
5. Create two auto-renewable subscriptions with YOUR EXACT PRODUCT IDs:

   **Monthly Subscription:**
   - **Product ID**: `surfvista_monthly` ⚠️ MUST MATCH EXACTLY
   - Reference Name: SurfVista Monthly Subscription
   - Subscription Group: Create new group "SurfVista Subscriptions"
   - Duration: 1 Month
   - Price: $5.00 (or your preferred price)

   **Annual Subscription:**
   - **Product ID**: `surfvista_annual` ⚠️ MUST MATCH EXACTLY
   - Reference Name: SurfVista Annual Subscription
   - Subscription Group: SurfVista Subscriptions
   - Duration: 1 Year
   - Price: $50.00 (or your preferred price)

6. Submit for review (required before testing)

#### Step 3b: Add Products to Google Play Console (Android)

1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app
3. Go to **Monetize** > **Subscriptions**
4. Click **"Create subscription"**
5. Create two subscriptions with YOUR EXACT PRODUCT IDs:

   **Monthly Subscription:**
   - **Product ID**: `surfvista_monthly` ⚠️ MUST MATCH EXACTLY
   - Name: SurfVista Monthly Subscription
   - Description: Monthly access to exclusive Folly Beach surf reports and 6K drone footage
   - Billing period: 1 Month
   - Price: $5.00 (or your preferred price)

   **Annual Subscription:**
   - **Product ID**: `surfvista_annual` ⚠️ MUST MATCH EXACTLY
   - Name: SurfVista Annual Subscription
   - Description: Annual access to exclusive Folly Beach surf reports and 6K drone footage
   - Billing period: 1 Year
   - Price: $50.00 (or your preferred price)

6. Activate the subscriptions

#### Step 3c: Link Products in RevenueCat

1. In RevenueCat dashboard, go to your app
2. Click **"Products"** in the left sidebar
3. Click **"+ New"** to add a product
4. For each product, use YOUR EXACT PRODUCT IDs:
   - Enter Product ID: `surfvista_monthly`
   - Select the store (iOS or Android)
   - Click **"Save"**
   - Repeat for `surfvista_annual`
5. Optionally add `monthly` and `yearly` if you created those

### 4. Create Entitlement in RevenueCat

1. In RevenueCat dashboard, go to **"Entitlements"**
2. Click **"+ New Entitlement"**
3. Use YOUR EXACT ENTITLEMENT ID:
   - **Identifier**: `premium` ⚠️ MUST MATCH EXACTLY
   - **Display Name**: SurfVista Pro
4. Attach your products:
   - Add `surfvista_monthly`
   - Add `surfvista_annual`
5. Click **"Save"**

### 5. Create an Offering in RevenueCat

1. In RevenueCat dashboard, go to **"Offerings"**
2. Click **"+ New Offering"**
3. Use YOUR EXACT OFFERING ID:
   - **Identifier**: `ofrnge7bdc97106` (if this is your existing offering)
   - OR create one called `default` (the app will use this as fallback)
4. Add packages:
   - Click **"+ Add Package"**
   - Select **"Monthly"** package type
   - Link to `surfvista_monthly` product
   - Click **"+ Add Package"** again
   - Select **"Annual"** package type
   - Link to `surfvista_annual` product
5. Make this offering **"Current"**
6. Click **"Save"**

**Note**: Your app looks for offering `ofrnge7bdc97106` first, then falls back to `default`. Make sure at least one exists!

### 6. Get Your API Keys

1. In RevenueCat dashboard, go to **Settings** > **API Keys**
2. You'll see two keys:
   - **iOS API Key** (starts with `appl_`)
   - **Android API Key** (starts with `goog_`)
3. Copy both keys

### 7. Update Your App Code

1. Open `utils/superwallConfig.ts` in your project
2. Find these lines near the top (around line 40):

```typescript
const REVENUECAT_API_KEY_IOS = 'test_pIbMwlfINrGOjQfGWYzmARWVOvg';
const REVENUECAT_API_KEY_ANDROID = 'test_pIbMwlfINrGOjQfGWYzmARWVOvg';
```

3. Replace with your actual API keys:

```typescript
const REVENUECAT_API_KEY_IOS = 'appl_xxxxxxxxxxxxxxxx';
const REVENUECAT_API_KEY_ANDROID = 'goog_xxxxxxxxxxxxxxxx';
```

4. Verify your product configuration (should already be correct):

```typescript
export const PAYMENT_CONFIG = {
  PRODUCTS: {
    MONTHLY_SUBSCRIPTION: 'surfvista_monthly',  // ✅ YOUR PRODUCT ID
    ANNUAL_SUBSCRIPTION: 'surfvista_annual',    // ✅ YOUR PRODUCT ID
    MONTHLY: 'monthly',                         // ✅ ALTERNATIVE ID
    YEARLY: 'yearly',                           // ✅ ALTERNATIVE ID
  },
  OFFERING_IDS: ['ofrnge7bdc97106', 'default'], // ✅ YOUR OFFERING IDs
  ENTITLEMENT_ID: 'premium',                    // ✅ YOUR ENTITLEMENT ID
};
```

5. Save the file

### 8. Restart Your App

1. Stop the development server (Ctrl+C)
2. Clear the cache: `npx expo start -c`
3. Restart the app

## Testing the Integration

### Test on iOS

1. Make sure you're signed in with a Sandbox Apple ID
   - Go to Settings > App Store > Sandbox Account
   - Sign in with a test account created in App Store Connect
2. Open your app
3. Go to the login screen
4. Try subscribing with the monthly or annual option
5. Complete the purchase flow
6. Verify the subscription is active in your profile

### Test on Android

1. Make sure you're using a test account
   - Add test users in Google Play Console > Setup > License testing
2. Open your app
3. Go to the login screen
4. Try subscribing with the monthly or annual option
5. Complete the purchase flow
6. Verify the subscription is active in your profile

### Test Restore Purchases

1. Subscribe on one device
2. Sign out
3. Sign in on another device (or same device)
4. Go to Profile screen
5. Tap **"Restore Purchases"**
6. Verify subscription is restored

## How It Works

### Purchase Flow

1. User taps "Subscribe" button on login screen
2. App calls `presentPaywall()` function
3. RevenueCat fetches available offerings (looks for `ofrnge7bdc97106` or `default`)
4. App displays the subscription options
5. User completes purchase through App Store/Play Store
6. RevenueCat validates the purchase
7. App checks for `premium` entitlement
8. App updates Supabase profile with subscription status
9. User gains access to exclusive content

### Subscription Check

The app checks subscription status in multiple ways:

1. **RevenueCat**: Primary source of truth
   - Checks for `premium` entitlement
   - Syncs across devices
   - Handles renewals automatically

2. **Supabase**: Backup/cache
   - Stores subscription status
   - Stores expiration date
   - Used when RevenueCat is unavailable

3. **Admin Override**: Manual grants
   - Admins can grant subscriptions manually
   - Useful for testing or customer support

### Key Functions

- `presentPaywall()`: Shows subscription options and handles purchase
- `restorePurchases()`: Restores previous purchases
- `checkSubscriptionStatus()`: Checks if user has active subscription
- `checkEntitlements()`: Checks for `premium` entitlement

## Troubleshooting

### "Payment system is not configured"

**Problem**: API keys are not set or incorrect

**Solution**:
1. Verify you've replaced the placeholder API keys in `utils/superwallConfig.ts`
2. Make sure the keys start with `appl_` (iOS) or `goog_` (Android)
3. Restart the app after updating keys

### "No subscription packages available"

**Problem**: Products not configured in RevenueCat

**Solution**:
1. Verify products are created in App Store Connect/Google Play Console with IDs: `surfvista_monthly`, `surfvista_annual`
2. Verify products are added to RevenueCat dashboard with same IDs
3. Verify offering `ofrnge7bdc97106` or `default` is created and set as "Current"
4. Verify products are added to the offering
5. Wait a few minutes for changes to propagate

### "Product not found"

**Problem**: Product IDs don't match

**Solution**:
1. Verify product IDs match exactly:
   - `surfvista_monthly`
   - `surfvista_annual`
2. Check spelling and capitalization
3. Make sure products are active in stores
4. Verify products are linked to offering

### "Entitlement not found"

**Problem**: Entitlement not configured correctly

**Solution**:
1. Verify entitlement is created with ID: `premium`
2. Verify products are attached to the entitlement
3. Check RevenueCat dashboard for entitlement configuration

### Purchase fails immediately

**Problem**: Not using sandbox/test account

**Solution**:
1. iOS: Sign in with Sandbox Apple ID in Settings
2. Android: Add your account to license testing in Play Console
3. Never use real payment methods during testing

### Subscription not showing in app

**Problem**: Profile not refreshed after purchase

**Solution**:
1. Tap "Refresh Profile Data" in Profile screen
2. Sign out and sign back in
3. Check console logs for errors
4. Verify entitlement ID is `premium`

## Console Logs

The payment system logs detailed information to help with debugging:

```
[RevenueCat] 🚀 Initializing RevenueCat...
[RevenueCat] ✅ RevenueCat initialized successfully
[RevenueCat] 📦 Using offering: ofrnge7bdc97106
[RevenueCat] 📦 Available packages: 2
[RevenueCat]   - surfvista_monthly: $5.00
[RevenueCat]   - surfvista_annual: $50.00
[RevenueCat] 🔐 Entitlement check: GRANTED (premium)
```

Look for these logs to verify:
- RevenueCat is initialized
- API keys are valid
- Products are loaded with correct IDs
- Offering is found (`ofrnge7bdc97106` or `default`)
- Entitlement `premium` is granted
- Purchases are successful

## Identifier Verification Checklist

Before testing, verify these identifiers match everywhere:

### Product IDs
- [ ] App Store Connect: `surfvista_monthly`, `surfvista_annual`
- [ ] Google Play Console: `surfvista_monthly`, `surfvista_annual`
- [ ] RevenueCat Products: `surfvista_monthly`, `surfvista_annual`
- [ ] App Code: `surfvista_monthly`, `surfvista_annual` ✅ (already configured)

### Offering ID
- [ ] RevenueCat Offering: `ofrnge7bdc97106` or `default`
- [ ] App Code: `ofrnge7bdc97106`, `default` ✅ (already configured)

### Entitlement ID
- [ ] RevenueCat Entitlement: `premium`
- [ ] App Code: `premium` ✅ (already configured)

## Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify all identifiers match exactly
3. Make sure you're using test accounts
4. Check RevenueCat dashboard for webhook events
5. Review the [RevenueCat documentation](https://docs.revenuecat.com/)

## Next Steps

Once subscriptions are working:

1. **Test thoroughly** on both iOS and Android
2. **Set up webhooks** in RevenueCat for real-time updates
3. **Configure entitlements** for different subscription tiers
4. **Add analytics** to track subscription metrics
5. **Implement promotional offers** for new users
6. **Set up customer support** for subscription issues

## Pricing Updates

To change subscription prices:

1. Update prices in App Store Connect/Google Play Console
2. Prices will automatically sync to RevenueCat
3. No code changes needed

Note: Price changes in stores may take 24-48 hours to propagate.
