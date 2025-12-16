
# Superwall Integration Setup Guide

## Overview
This guide explains how to complete the Superwall integration for subscription payments in the SurfVista app.

## Quick Start Checklist

- [ ] Create Superwall account at https://superwall.com
- [ ] Configure products in App Store Connect (iOS) and/or Google Play Console (Android)
- [ ] Set up paywall in Superwall dashboard
- [ ] Update API key in `utils/superwallConfig.ts`
- [ ] Test subscription flow in sandbox mode
- [ ] Deploy to production

## Step 1: Create Superwall Account

1. Go to https://superwall.com and sign up
2. Create a new app in the Superwall dashboard
3. Note your API key (starts with `pk_`)
   - Find it in: Dashboard → Settings → API Keys
   - Copy the **Public API Key** (not the secret key)

## Step 2: Configure Products in App Stores

### iOS (App Store Connect)

1. Log into [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app (Bundle ID: `com.anonymous.Natively`)
3. Go to **Features** → **In-App Purchases**
4. Click **+** to create a new subscription
5. Configure:
   - **Product ID**: `com.surfvista.monthly`
   - **Reference Name**: SurfVista Monthly Subscription
   - **Subscription Group**: Create new group "SurfVista Subscriptions"
   - **Subscription Duration**: 1 month
   - **Price**: $4.99 USD (App Store takes 30%, so set to $4.99 to net ~$3.50)
6. Add localized descriptions and screenshots
7. Submit for review

### Android (Google Play Console)

1. Log into [Google Play Console](https://play.google.com/console)
2. Select your app
3. Go to **Monetize** → **Subscriptions**
4. Click **Create subscription**
5. Configure:
   - **Product ID**: `com.surfvista.monthly`
   - **Name**: SurfVista Monthly
   - **Description**: Access exclusive drone footage and surf reports
   - **Billing period**: 1 month
   - **Price**: $4.99 USD
6. Save and activate

## Step 3: Configure Superwall Dashboard

1. Log into [Superwall Dashboard](https://superwall.com/dashboard)
2. Select your app

### Add Products

1. Go to **Products** section
2. Click **Add Product**
3. Configure:
   - **Product ID**: `com.surfvista.monthly` (must match App Store/Play Store)
   - **Display Name**: SurfVista Monthly
   - **Price**: $5/month
   - **Description**: Exclusive drone footage and daily surf reports

### Create Paywall

1. Go to **Paywalls** section
2. Click **Create Paywall**
3. Configure:
   - **Paywall ID**: `subscription_paywall` (must match code)
   - **Template**: Choose a template or create custom
   - **Title**: "Get Exclusive Access"
   - **Subtitle**: "Daily 6K drone footage and surf reports from Folly Beach"
   - **Features**:
     - ✓ 6K resolution drone videos
     - ✓ Daily surf condition reports
     - ✓ 7-day weather forecasts
     - ✓ Exclusive content from Folly Beach, SC
   - **Call to Action**: "Start Subscription - $5/month"
4. Add your product to the paywall
5. Customize colors and images to match your brand
6. Save and publish

### Configure Events (Optional)

1. Go to **Events** section
2. Create trigger events:
   - `subscription_required` - Show paywall when user tries to access locked content
   - `profile_subscribe` - Show paywall from profile screen

## Step 4: Update App Configuration

1. Open `utils/superwallConfig.ts` in your code editor
2. Replace the placeholder API key:

```typescript
export const SUPERWALL_API_KEY = 'pk_YOUR_ACTUAL_API_KEY_HERE';
```

3. Save the file
4. Restart your development server

## Step 5: Test the Integration

### Sandbox Testing (iOS)

1. Create a sandbox test account in App Store Connect:
   - Go to **Users and Access** → **Sandbox Testers**
   - Click **+** to add a tester
   - Use a unique email (doesn't need to be real)
2. On your test device:
   - Sign out of your Apple ID in Settings
   - Run the app
   - When prompted for Apple ID, use your sandbox account
3. Test the flow:
   - Sign up/sign in to the app
   - Click "Subscribe Now"
   - Complete the purchase with sandbox account
   - Verify subscription is activated
   - Test "Restore Purchases" button

### Sandbox Testing (Android)

1. Add test accounts in Google Play Console:
   - Go to **Setup** → **License testing**
   - Add email addresses for testers
2. Install the app via internal testing track
3. Test the subscription flow
4. Verify subscription activation

### What to Test

- [ ] Paywall displays correctly
- [ ] Purchase flow completes successfully
- [ ] Subscription status updates in app
- [ ] Content becomes accessible after purchase
- [ ] "Restore Purchases" works on new device
- [ ] Subscription renewal works (wait 5 minutes in sandbox)
- [ ] Cancellation works properly

## Step 6: Production Deployment

### Pre-Launch Checklist

- [ ] All sandbox tests passing
- [ ] Products approved in App Store Connect
- [ ] Products active in Google Play Console
- [ ] Paywall published in Superwall dashboard
- [ ] API key is production key (not test key)
- [ ] Privacy policy includes subscription terms
- [ ] Terms of service updated

### Deploy

1. Build production app:
   ```bash
   # iOS
   eas build --platform ios --profile production
   
   # Android
   eas build --platform android --profile production
   ```

2. Submit to app stores
3. Monitor Superwall dashboard for:
   - Paywall impressions
   - Conversion rates
   - Revenue
   - Errors

## How It Works

### Purchase Flow

1. User clicks "Subscribe Now" button
2. App calls `presentPaywall('subscription_paywall')`
3. Superwall displays the paywall UI
4. User selects product and confirms purchase
5. App Store/Play Store processes payment
6. Superwall calls the purchase handler
7. App updates user's subscription in Supabase:
   ```typescript
   {
     is_subscribed: true,
     subscription_end_date: '2024-02-15T00:00:00Z'
   }
   ```
8. User gains immediate access to content

### Restore Purchases Flow

1. User clicks "Restore Purchases" button
2. App calls `restorePurchases()`
3. Superwall checks with App Store/Play Store
4. If active subscription found:
   - Restore handler updates Supabase
   - User regains access
5. If no subscription found:
   - User sees "No purchases found" message

### Subscription Check

The app checks subscription status in multiple places:

```typescript
// In AuthContext
checkSubscription(): boolean {
  // Admin users always have access
  if (profile.is_admin) return true;
  
  // Check if subscribed and not expired
  if (profile.is_subscribed && profile.subscription_end_date) {
    return new Date(profile.subscription_end_date) > new Date();
  }
  
  return false;
}
```

## Troubleshooting

### Issue: "Superwall not configured" error

**Solution**: 
- Check that `SUPERWALL_API_KEY` is set in `utils/superwallConfig.ts`
- Verify the API key starts with `pk_`
- Restart the development server

### Issue: Paywall doesn't appear

**Possible causes**:
- Paywall ID mismatch (must be `subscription_paywall`)
- Paywall not published in dashboard
- Network connectivity issues

**Solution**:
- Check console logs for errors
- Verify paywall ID in dashboard matches code
- Ensure paywall is published (not draft)

### Issue: Purchase completes but subscription not activated

**Possible causes**:
- Purchase handler error
- Supabase connection issue
- Profile update failed

**Solution**:
- Check console logs for purchase handler errors
- Verify Supabase connection
- Try "Refresh Profile Data" button
- Use "Restore Purchases" to re-sync

### Issue: "No purchases found" when restoring

**Possible causes**:
- Using different Apple ID/Google account
- Subscription expired or cancelled
- Not using same app bundle ID

**Solution**:
- Verify using same account that made purchase
- Check subscription status in App Store/Play Store settings
- Ensure app bundle ID matches

### Issue: Sandbox purchases not working

**Possible causes**:
- Not signed in with sandbox account
- Sandbox account not set up correctly
- Products not approved for testing

**Solution**:
- Sign out of production Apple ID
- Create new sandbox tester in App Store Connect
- Wait for products to be approved (can take 24 hours)

## Subscription Management

### For Users

Users can manage their subscriptions through:

**iOS**:
1. Open Settings app
2. Tap [Your Name] at top
3. Tap Subscriptions
4. Select SurfVista
5. Cancel or modify subscription

**Android**:
1. Open Google Play Store
2. Tap Menu → Subscriptions
3. Select SurfVista
4. Cancel or modify subscription

### For Admins

Monitor subscriptions in:
- **Superwall Dashboard**: Real-time analytics, conversion rates
- **App Store Connect**: iOS subscription reports
- **Google Play Console**: Android subscription reports
- **Supabase Dashboard**: User subscription status in `profiles` table

## Pricing Considerations

- **App Store/Play Store Fee**: 30% (15% after first year)
- **Superwall Fee**: Check current pricing at superwall.com/pricing
- **Net Revenue**: ~$3.50 per $5 subscription (first year)

To adjust pricing:
1. Update price in App Store Connect / Google Play Console
2. Update price display in Superwall dashboard
3. Update price text in app UI (`app/login.tsx`, `app/(tabs)/profile.tsx`)

## Support Resources

- **Superwall Docs**: https://docs.superwall.com
- **Superwall Support**: support@superwall.com
- **App Store Connect Help**: https://developer.apple.com/support/app-store-connect/
- **Google Play Console Help**: https://support.google.com/googleplay/android-developer

## Next Steps

1. ✅ Complete Superwall account setup
2. ✅ Configure products in app stores
3. ✅ Update API key in code
4. ✅ Test thoroughly in sandbox
5. ✅ Deploy to production
6. 📊 Monitor analytics and optimize conversion

---

**Need Help?** Check the console logs - they include detailed emoji-coded messages:
- 🚀 Initialization
- ✅ Success
- ❌ Error
- ⚠️ Warning
- 💳 Purchase
- 🔄 Restore
- 📊 Result
- 📝 Configuration
