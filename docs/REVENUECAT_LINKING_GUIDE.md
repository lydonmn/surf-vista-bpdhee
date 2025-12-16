
# RevenueCat Product Linking Guide

This guide will walk you through linking your RevenueCat products to your SurfVista app.

## Overview

Your app is already set up to use RevenueCat for subscriptions. You just need to:
1. Get your RevenueCat API keys
2. Configure products in RevenueCat dashboard
3. Update the API keys in your code
4. Test the integration

## Product Identifiers

Your app is configured to use these product identifiers:
- **Monthly Subscription**: `com.anonymous.Natively.monthly`
- **Annual Subscription**: `com.anonymous.Natively.annual`

These identifiers must match exactly across:
- App Store Connect (iOS)
- Google Play Console (Android)
- RevenueCat Dashboard

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
5. Create two auto-renewable subscriptions:

   **Monthly Subscription:**
   - Product ID: `com.anonymous.Natively.monthly`
   - Reference Name: SurfVista Monthly
   - Subscription Group: Create new group "SurfVista Subscriptions"
   - Duration: 1 Month
   - Price: $4.99

   **Annual Subscription:**
   - Product ID: `com.anonymous.Natively.annual`
   - Reference Name: SurfVista Annual
   - Subscription Group: SurfVista Subscriptions
   - Duration: 1 Year
   - Price: $49.99

6. Submit for review (required before testing)

#### Step 3b: Add Products to Google Play Console (Android)

1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app
3. Go to **Monetize** > **Subscriptions**
4. Click **"Create subscription"**
5. Create two subscriptions:

   **Monthly Subscription:**
   - Product ID: `com.anonymous.Natively.monthly`
   - Name: SurfVista Monthly
   - Description: Monthly access to exclusive surf reports
   - Billing period: 1 Month
   - Price: $4.99

   **Annual Subscription:**
   - Product ID: `com.anonymous.Natively.annual`
   - Name: SurfVista Annual
   - Description: Annual access to exclusive surf reports
   - Billing period: 1 Year
   - Price: $49.99

6. Activate the subscriptions

#### Step 3c: Link Products in RevenueCat

1. In RevenueCat dashboard, go to your app
2. Click **"Products"** in the left sidebar
3. Click **"+ New"** to add a product
4. For each product:
   - Enter the Product ID (e.g., `com.anonymous.Natively.monthly`)
   - Select the store (iOS or Android)
   - Click **"Save"**
5. Repeat for both monthly and annual products on both platforms

### 4. Create an Offering in RevenueCat

1. In RevenueCat dashboard, go to **"Offerings"**
2. Click **"+ New Offering"**
3. Set identifier to `default`
4. Add packages:
   - Click **"+ Add Package"**
   - Select **"Monthly"** package type
   - Link to `com.anonymous.Natively.monthly` product
   - Click **"+ Add Package"** again
   - Select **"Annual"** package type
   - Link to `com.anonymous.Natively.annual` product
5. Make this offering **"Current"**
6. Click **"Save"**

### 5. Get Your API Keys

1. In RevenueCat dashboard, go to **Settings** > **API Keys**
2. You'll see two keys:
   - **iOS API Key** (starts with `appl_`)
   - **Android API Key** (starts with `goog_`)
3. Copy both keys

### 6. Update Your App Code

1. Open `utils/superwallConfig.ts` in your project
2. Find these lines near the top:

```typescript
const REVENUECAT_API_KEY_IOS = 'YOUR_IOS_API_KEY_HERE';
const REVENUECAT_API_KEY_ANDROID = 'YOUR_ANDROID_API_KEY_HERE';
```

3. Replace with your actual API keys:

```typescript
const REVENUECAT_API_KEY_IOS = 'appl_xxxxxxxxxxxxxxxx';
const REVENUECAT_API_KEY_ANDROID = 'goog_xxxxxxxxxxxxxxxx';
```

4. Save the file

### 7. Restart Your App

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
3. RevenueCat fetches available offerings
4. App displays the selected subscription option
5. User completes purchase through App Store/Play Store
6. RevenueCat validates the purchase
7. App updates Supabase profile with subscription status
8. User gains access to exclusive content

### Subscription Check

The app checks subscription status in multiple ways:

1. **RevenueCat**: Primary source of truth
   - Checks active entitlements
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
- `grantSubscription()`: Admin function to manually grant access

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
1. Verify products are created in App Store Connect/Google Play Console
2. Verify products are added to RevenueCat dashboard
3. Verify offering is created and set as "Current"
4. Wait a few minutes for changes to propagate

### "Product not found"

**Problem**: Product IDs don't match

**Solution**:
1. Verify product IDs match exactly:
   - `com.anonymous.Natively.monthly`
   - `com.anonymous.Natively.annual`
2. Check spelling and capitalization
3. Make sure products are active in stores

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

## Console Logs

The payment system logs detailed information to help with debugging:

```
[Payment] 🚀 Initializing RevenueCat...
[Payment] ✅ RevenueCat initialized successfully
[Payment] 📦 Available offerings: default
[Payment] 📦 Available packages: 2
[Payment]   - monthly: $4.99
[Payment]   - annual: $49.99
```

Look for these logs to verify:
- RevenueCat is initialized
- API keys are valid
- Products are loaded
- Purchases are successful

## Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify all product IDs match exactly
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
2. Update `PAYMENT_CONFIG` in `utils/superwallConfig.ts`:
   ```typescript
   MONTHLY_PRICE: 5.99,  // New price
   ANNUAL_PRICE: 59.99,  // New price
   ```
3. Restart the app

Note: Price changes in stores may take 24-48 hours to propagate.
