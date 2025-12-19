
# RevenueCat + SurfVista Integration Guide

This guide will help you set up RevenueCat for subscription management in your SurfVista app. RevenueCat works seamlessly with Expo and can integrate with Superwall paywalls.

## 🎯 YOUR SURFVISTA REVENUECAT CONFIGURATION

**These are the specific identifiers already configured in your SurfVista app:**

### Product Identifiers (In-App Purchase IDs)
- **Monthly Subscription**: `surfvista_monthly`
- **Annual Subscription**: `surfvista_annual`
- **Alternative Monthly**: `monthly`
- **Alternative Annual**: `yearly`

### Offering Identifier
- **Primary Offering**: `ofrnge7bdc97106`
- **Fallback Offering**: `default`

### Entitlement Identifier
- **Entitlement ID**: `premium`
- **Display Name**: "SurfVista Pro"

**⚠️ IMPORTANT**: These identifiers MUST match exactly across:
- App Store Connect (iOS)
- Google Play Console (Android)
- RevenueCat Dashboard
- Your app code (already configured in `utils/superwallConfig.ts`)

---

## Why RevenueCat?

- ✅ **Expo Compatible**: Works with Expo Go and development builds
- ✅ **Cross-Platform**: Single codebase for iOS and Android
- ✅ **Superwall Integration**: Can display Superwall paywalls
- ✅ **Easy Setup**: No complex native configuration required
- ✅ **Analytics**: Built-in subscription analytics and insights
- ✅ **Server-Side**: Handles receipt validation server-side

## Step 1: Create RevenueCat Account

1. Go to [https://www.revenuecat.com/](https://www.revenuecat.com/)
2. Click "Sign Up" and create a free account
3. Verify your email address

## Step 2: Create Your App in RevenueCat

1. Log in to the RevenueCat dashboard
2. Click "Create New App"
3. Enter your app details:
   - **App Name**: SurfVista
   - **Bundle ID (iOS)**: com.anonymous.Natively (or your custom bundle ID)
   - **Package Name (Android)**: com.anonymous.Natively (or your custom package name)

## Step 3: Configure App Store Connect (iOS)

### Create In-App Purchases in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Select your app (or create a new app)
3. Go to "Features" > "In-App Purchases"
4. Click the "+" button to create a new subscription
5. Create auto-renewable subscriptions with YOUR EXACT PRODUCT IDs:

**Monthly Subscription:**
- **Product ID**: `surfvista_monthly` ⚠️ MUST MATCH EXACTLY
- Reference Name: SurfVista Monthly Subscription
- Subscription Group: Create a new group (e.g., "SurfVista Subscriptions")
- Subscription Duration: 1 Month
- Price: $5.00 (or your preferred price)

**Annual Subscription:**
- **Product ID**: `surfvista_annual` ⚠️ MUST MATCH EXACTLY
- Reference Name: SurfVista Annual Subscription
- Subscription Group: Same as monthly (SurfVista Subscriptions)
- Subscription Duration: 1 Year
- Price: $50.00 (or your preferred price)

**Alternative Product IDs (Optional):**
If you want to use the alternative IDs:
- **Product ID**: `monthly` for monthly subscription
- **Product ID**: `yearly` for annual subscription

### Connect App Store Connect to RevenueCat

1. In RevenueCat dashboard, go to your app
2. Click "App Store Connect" under iOS
3. Follow the instructions to generate and upload an App Store Connect API Key
4. Enter your Shared Secret (from App Store Connect > App Information > App-Specific Shared Secret)

## Step 4: Configure Google Play Console (Android)

### Create In-App Products in Google Play Console

1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app (or create a new app)
3. Go to "Monetize" > "Products" > "Subscriptions"
4. Click "Create subscription"
5. Create subscriptions with YOUR EXACT PRODUCT IDs:

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

### Connect Google Play to RevenueCat

1. In RevenueCat dashboard, go to your app
2. Click "Google Play" under Android
3. Follow the instructions to create a service account and upload the JSON key
4. Grant the service account the necessary permissions in Google Play Console

## Step 5: Create Products in RevenueCat

1. In RevenueCat dashboard, go to your app
2. Click "Products" in the left sidebar
3. Click "Add Product"
4. Add each product with YOUR EXACT PRODUCT IDs:
   - **Product ID**: `surfvista_monthly` (iOS and Android)
   - **Product ID**: `surfvista_annual` (iOS and Android)
   - Optionally: `monthly` and `yearly` if you created those
5. Select the product type (Subscription)
6. Click "Save" for each

## Step 6: Create Entitlement in RevenueCat

1. In RevenueCat dashboard, go to "Entitlements"
2. Click "Create Entitlement"
3. Use YOUR EXACT ENTITLEMENT ID:
   - **Identifier**: `premium` ⚠️ MUST MATCH EXACTLY
   - **Display Name**: SurfVista Pro
4. Attach your products to this entitlement:
   - Add `surfvista_monthly`
   - Add `surfvista_annual`
5. Click "Save"

## Step 7: Create Offering in RevenueCat

1. In RevenueCat dashboard, go to "Offerings"
2. Click "Create Offering"
3. Use YOUR EXACT OFFERING ID:
   - **Identifier**: `ofrnge7bdc97106` ⚠️ (if this is your existing offering ID)
   - OR create a new one called `default`
4. Add packages:
   - Click "Add Package"
   - Select "Monthly" package type
   - Link to `surfvista_monthly` product
   - Click "Add Package" again
   - Select "Annual" package type
   - Link to `surfvista_annual` product
5. Make this offering "Current"
6. Click "Save"

**Note**: Your app is configured to look for offering `ofrnge7bdc97106` first, then fall back to `default`. Make sure at least one of these exists.

## Step 8: Get Your API Keys

1. In RevenueCat dashboard, go to "Settings" > "API Keys"
2. Copy your API keys:
   - **iOS API Key**: Starts with `appl_`
   - **Android API Key**: Starts with `goog_`

## Step 9: Update Your App Configuration

Open `utils/superwallConfig.ts` and replace the placeholder API keys:

```typescript
const REVENUECAT_API_KEY_IOS = 'appl_YOUR_IOS_KEY_HERE';
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_ANDROID_KEY_HERE';
```

**Your product configuration is already set up correctly:**

```typescript
export const PAYMENT_CONFIG = {
  PRODUCTS: {
    MONTHLY_SUBSCRIPTION: 'surfvista_monthly',  // ✅ Already configured
    ANNUAL_SUBSCRIPTION: 'surfvista_annual',    // ✅ Already configured
    MONTHLY: 'monthly',                         // ✅ Already configured
    YEARLY: 'yearly',                           // ✅ Already configured
  },
  OFFERING_IDS: ['ofrnge7bdc97106', 'default'], // ✅ Already configured
  ENTITLEMENT_ID: 'premium',                    // ✅ Already configured
};
```

## Step 10: Test Your Integration

### Testing in Development

1. **iOS**: Use a Sandbox Test Account
   - Create a sandbox tester in App Store Connect
   - Sign out of your Apple ID in Settings
   - When prompted during purchase, sign in with sandbox account

2. **Android**: Use a Test Account
   - Add test accounts in Google Play Console
   - Sign in with a test account on your device

### Test the Flow

1. Run your app: `npm run ios` or `npm run android`
2. Navigate to the login screen
3. Try subscribing to the monthly or annual plan
4. Complete the purchase flow
5. Verify the subscription is active in your profile

### Verify in RevenueCat Dashboard

1. Go to "Customers" in RevenueCat dashboard
2. Search for your test user
3. Verify the subscription is showing as active

## Troubleshooting

### "No offerings found"
- Verify products are created in App Store Connect / Google Play with IDs: `surfvista_monthly` and `surfvista_annual`
- Verify products are added to RevenueCat with the same IDs
- Verify offering `ofrnge7bdc97106` or `default` is created and contains the products
- Wait a few minutes for changes to sync

### "Purchase failed"
- Verify you're using a sandbox/test account
- Verify the product IDs match exactly: `surfvista_monthly` and `surfvista_annual`
- Check RevenueCat logs in the dashboard
- Ensure your app's bundle ID matches RevenueCat configuration

### "API key not configured"
- Verify you've updated the API keys in `utils/superwallConfig.ts`
- Restart your app after updating the keys
- Check for typos in the API keys

### "Subscription not showing in app"
- Verify the subscription is active in RevenueCat dashboard
- Try refreshing the profile in the app
- Check the Supabase `profiles` table for subscription status
- Use "Restore Purchases" to sync subscription status

### "Entitlement not found"
- Verify entitlement is created with ID: `premium`
- Verify products are attached to the entitlement
- Check RevenueCat dashboard for entitlement configuration

## Production Checklist

Before releasing to production:

- [ ] Products created in App Store Connect with IDs: `surfvista_monthly`, `surfvista_annual`
- [ ] Products created in Google Play Console with IDs: `surfvista_monthly`, `surfvista_annual`
- [ ] Products added to RevenueCat with matching IDs
- [ ] Entitlement created with ID: `premium`
- [ ] Offering created with ID: `ofrnge7bdc97106` or `default`
- [ ] Products attached to entitlement
- [ ] Products added to offering
- [ ] API keys updated in app (production keys, not test)
- [ ] Tested subscription flow on iOS
- [ ] Tested subscription flow on Android
- [ ] Tested restore purchases
- [ ] Verified subscription status syncs to Supabase
- [ ] Updated bundle ID and package name
- [ ] Submitted app for review with in-app purchases

## Quick Reference Card

**Print this and keep it handy:**

```
SURFVISTA REVENUECAT IDENTIFIERS
================================

Products (In-App Purchase IDs):
- surfvista_monthly
- surfvista_annual
- monthly (alternative)
- yearly (alternative)

Offering ID:
- ofrnge7bdc97106 (primary)
- default (fallback)

Entitlement ID:
- premium

These MUST match exactly in:
✓ App Store Connect
✓ Google Play Console
✓ RevenueCat Dashboard
✓ Your app code
```

## Support

- **RevenueCat Docs**: [https://docs.revenuecat.com/](https://docs.revenuecat.com/)
- **RevenueCat Support**: [https://community.revenuecat.com/](https://community.revenuecat.com/)
- **App Store Connect**: [https://developer.apple.com/support/](https://developer.apple.com/support/)
- **Google Play Console**: [https://support.google.com/googleplay/android-developer/](https://support.google.com/googleplay/android-developer/)

## Next Steps

1. Follow this guide to set up RevenueCat with YOUR specific identifiers
2. Test the subscription flow thoroughly
3. (Optional) Integrate Superwall for custom paywalls
4. Submit your app for review
5. Launch! 🚀
