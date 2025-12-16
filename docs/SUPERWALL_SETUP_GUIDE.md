
# Superwall Integration Setup Guide

## Overview
This guide explains how to complete the Superwall integration for subscription payments in the SurfVista app.

## Prerequisites
1. A Superwall account (sign up at https://superwall.com)
2. Your app configured in the Superwall dashboard
3. Products configured in App Store Connect (iOS) and/or Google Play Console (Android)

## Setup Steps

### 1. Create Superwall Account
1. Go to https://superwall.com and create an account
2. Create a new app in the Superwall dashboard
3. Note your API key (starts with `pk_`)

### 2. Configure Products
1. In App Store Connect (iOS):
   - Create a subscription product with ID: `com.surfvista.monthly`
   - Set price to $5/month
   - Configure subscription duration and renewal settings

2. In Google Play Console (Android):
   - Create a subscription product with ID: `com.surfvista.monthly`
   - Set price to $5/month
   - Configure subscription settings

### 3. Configure Superwall Dashboard
1. Log into Superwall dashboard
2. Go to Products section
3. Add your subscription product:
   - Product ID: `com.surfvista.monthly`
   - Display name: "SurfVista Monthly"
   - Price: $5/month

4. Create a paywall:
   - Name: `subscription_paywall`
   - Design your paywall UI
   - Add your product to the paywall
   - Configure copy and images

### 4. Update App Configuration
1. Open `utils/superwallConfig.ts`
2. Replace `pk_YOUR_SUPERWALL_API_KEY_HERE` with your actual Superwall API key
3. Save the file

### 5. Test the Integration

#### Test Mode (Sandbox)
1. In Superwall dashboard, enable test mode
2. Use a sandbox Apple ID or Google test account
3. Test the subscription flow:
   - Open the app
   - Go to login/signup screen
   - Click "Subscribe Now - $5/month"
   - Complete the purchase flow
   - Verify subscription is activated in the app

#### Production Testing
1. Disable test mode in Superwall dashboard
2. Use TestFlight (iOS) or internal testing (Android)
3. Test with real payment methods
4. Verify subscription status updates correctly

## How It Works

### Purchase Flow
1. User clicks "Subscribe Now" button
2. App calls `Superwall.presentPaywall('subscription_paywall')`
3. Superwall displays the paywall UI
4. User completes purchase through App Store/Play Store
5. Superwall calls the purchase handler
6. App updates user's subscription status in Supabase
7. User gains access to premium content

### Subscription Status
The app checks subscription status in multiple places:
- `AuthContext.checkSubscription()` - Main subscription check
- Home screen - Shows/hides content based on subscription
- Videos screen - Locks content for non-subscribers
- Profile screen - Displays subscription status

### Database Updates
When a purchase is completed:
```typescript
await supabase
  .from('profiles')
  .update({
    is_subscribed: true,
    subscription_end_date: subscriptionEndDate.toISOString(),
  })
  .eq('id', user.id);
```

## Troubleshooting

### Issue: Paywall doesn't appear
- Check that Superwall API key is correct
- Verify paywall name matches: `subscription_paywall`
- Check console logs for initialization errors

### Issue: Purchase doesn't update subscription
- Verify purchase handler is set up correctly
- Check Supabase connection
- Review console logs for database errors

### Issue: Subscription status not updating
- Call `refreshProfile()` after purchase
- Check that subscription_end_date is set correctly
- Verify RLS policies allow profile updates

## Important Notes

1. **Admin Access**: Admin users always have access regardless of subscription status
2. **Email Verification**: New users must verify their email before accessing content
3. **Subscription Duration**: Currently set to 1 month, can be adjusted in `superwallConfig.ts`
4. **Price Changes**: Update price in both App Store/Play Store AND Superwall dashboard

## Support
- Superwall Documentation: https://docs.superwall.com
- Superwall Support: support@superwall.com
- App Issues: Check console logs and Supabase dashboard

## Next Steps
1. Complete Superwall account setup
2. Configure products in app stores
3. Update API key in `utils/superwallConfig.ts`
4. Test thoroughly in sandbox mode
5. Deploy to production
