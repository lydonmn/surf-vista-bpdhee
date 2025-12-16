
# RevenueCat + Superwall Integration Guide

This guide will help you set up RevenueCat for subscription management in your SurfVista app. RevenueCat works seamlessly with Expo and can integrate with Superwall paywalls.

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
5. Create two auto-renewable subscriptions:

**Monthly Subscription:**
- Product ID: `monthly_subscription` (or your custom ID)
- Reference Name: Monthly Subscription
- Subscription Group: Create a new group (e.g., "SurfVista Subscriptions")
- Subscription Duration: 1 Month
- Price: $10.99

**Annual Subscription:**
- Product ID: `annual_subscription` (or your custom ID)
- Reference Name: Annual Subscription
- Subscription Group: Same as monthly
- Subscription Duration: 1 Year
- Price: $100.99

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
5. Create two subscriptions:

**Monthly Subscription:**
- Product ID: `monthly_subscription`
- Name: Monthly Subscription
- Billing period: 1 Month
- Price: $10.99

**Annual Subscription:**
- Product ID: `annual_subscription`
- Name: Annual Subscription
- Billing period: 1 Year
- Price: $100.99

### Connect Google Play to RevenueCat

1. In RevenueCat dashboard, go to your app
2. Click "Google Play" under Android
3. Follow the instructions to create a service account and upload the JSON key
4. Grant the service account the necessary permissions in Google Play Console

## Step 5: Create Products in RevenueCat

1. In RevenueCat dashboard, go to your app
2. Click "Products" in the left sidebar
3. Click "Add Product"
4. For each subscription:
   - Enter the Product ID (must match App Store Connect / Google Play)
   - Select the product type (Subscription)
   - Click "Save"

## Step 6: Create an Offering

1. In RevenueCat dashboard, go to "Offerings"
2. Click "Create Offering"
3. Name it "default" (or your custom name)
4. Add both products (monthly and annual) to the offering
5. Set the monthly subscription as "Monthly" package type
6. Set the annual subscription as "Annual" package type
7. Click "Save"

## Step 7: Get Your API Keys

1. In RevenueCat dashboard, go to "Settings" > "API Keys"
2. Copy your API keys:
   - **iOS API Key**: Starts with `appl_`
   - **Android API Key**: Starts with `goog_`

## Step 8: Update Your App Configuration

Open `utils/superwallConfig.ts` and replace the placeholder API keys:

```typescript
const REVENUECAT_API_KEY_IOS = 'appl_YOUR_IOS_KEY_HERE';
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_ANDROID_KEY_HERE';
```

Also update the product IDs if you used different ones:

```typescript
export const PAYMENT_CONFIG = {
  MONTHLY_PRICE: 10.99,
  ANNUAL_PRICE: 100.99,
  MONTHLY_PRODUCT_ID: 'monthly_subscription', // Your product ID
  ANNUAL_PRODUCT_ID: 'annual_subscription',   // Your product ID
  OFFERING_ID: 'default', // Your offering ID
};
```

## Step 9: Test Your Integration

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

## Step 10: (Optional) Integrate Superwall Paywalls

If you want to use custom Superwall paywalls instead of the default purchase flow:

1. Create a Superwall account at [https://superwall.com/](https://superwall.com/)
2. Connect Superwall to RevenueCat:
   - In Superwall dashboard, go to Settings > Integrations
   - Connect RevenueCat
   - Enter your RevenueCat API keys
3. Design your paywalls in the Superwall dashboard
4. Update your app to use Superwall's SDK (requires additional setup)

## Troubleshooting

### "No offerings found"
- Verify products are created in App Store Connect / Google Play
- Verify products are added to RevenueCat
- Verify offering is created and contains the products
- Wait a few minutes for changes to sync

### "Purchase failed"
- Verify you're using a sandbox/test account
- Verify the product IDs match exactly
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

## Production Checklist

Before releasing to production:

- [ ] Products created in App Store Connect
- [ ] Products created in Google Play Console
- [ ] Products added to RevenueCat
- [ ] Offering created with all products
- [ ] API keys updated in app
- [ ] Tested subscription flow on iOS
- [ ] Tested subscription flow on Android
- [ ] Tested restore purchases
- [ ] Verified subscription status syncs to Supabase
- [ ] Updated bundle ID and package name
- [ ] Submitted app for review with in-app purchases

## Support

- **RevenueCat Docs**: [https://docs.revenuecat.com/](https://docs.revenuecat.com/)
- **RevenueCat Support**: [https://community.revenuecat.com/](https://community.revenuecat.com/)
- **App Store Connect**: [https://developer.apple.com/support/](https://developer.apple.com/support/)
- **Google Play Console**: [https://support.google.com/googleplay/android-developer/](https://support.google.com/googleplay/android-developer/)

## Next Steps

1. Follow this guide to set up RevenueCat
2. Test the subscription flow thoroughly
3. (Optional) Integrate Superwall for custom paywalls
4. Submit your app for review
5. Launch! 🚀
