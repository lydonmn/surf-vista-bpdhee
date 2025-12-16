
# Payment Integration Quick Start

This guide will help you get the payment system working as quickly as possible.

## Current Status

✅ **RevenueCat SDK Installed**: The `react-native-purchases` package is installed and configured.

⚠️ **API Keys Required**: You need to add your RevenueCat API keys to make it work.

## Quick Setup (5 Minutes)

### Option 1: Use RevenueCat (Recommended)

This is the easiest and most reliable option for Expo apps.

1. **Create RevenueCat Account** (2 minutes)
   - Go to [https://www.revenuecat.com/](https://www.revenuecat.com/)
   - Sign up for a free account
   - Create a new app

2. **Get API Keys** (1 minute)
   - In RevenueCat dashboard, go to Settings > API Keys
   - Copy your iOS API key (starts with `appl_`)
   - Copy your Android API key (starts with `goog_`)

3. **Update Configuration** (1 minute)
   - Open `utils/superwallConfig.ts`
   - Replace these lines:
     ```typescript
     const REVENUECAT_API_KEY_IOS = 'YOUR_IOS_API_KEY_HERE';
     const REVENUECAT_API_KEY_ANDROID = 'YOUR_ANDROID_API_KEY_HERE';
     ```
   - With your actual keys:
     ```typescript
     const REVENUECAT_API_KEY_IOS = 'appl_AbCdEfGhIjKlMnOp';
     const REVENUECAT_API_KEY_ANDROID = 'goog_XyZaBcDeFgHiJkLm';
     ```

4. **Restart Your App** (1 minute)
   - Stop the development server
   - Run `npm run ios` or `npm run android`
   - The payment system should now initialize successfully!

### Option 2: Test Without Payment System

If you want to test the app without setting up payments:

1. **Grant Manual Subscription** (Admin Only)
   - Sign in as an admin user
   - Go to Admin Panel
   - Use the "Grant Subscription" feature to manually give users access

2. **Modify Database Directly**
   - Go to your Supabase dashboard
   - Open the `profiles` table
   - Set `is_subscribed` to `true` for test users
   - Set `subscription_end_date` to a future date

## Testing the Payment Flow

Once you've added your API keys:

1. **Sign Out** (if signed in)
2. **Go to Login Screen**
3. **Try Subscribing**:
   - Click "Monthly" or "Annual" subscription button
   - Complete the purchase flow
   - Verify subscription is active in Profile tab

## What Happens When You Subscribe?

1. **RevenueCat** handles the purchase with Apple/Google
2. **App receives** confirmation of successful purchase
3. **Supabase profile** is updated with subscription status
4. **User gets access** to exclusive content immediately

## Troubleshooting

### "Payment system is not configured"

**Solution**: You haven't added your RevenueCat API keys yet.
- Follow Option 1 above to add your keys
- Make sure to restart the app after adding keys

### "No offerings found"

**Solution**: You need to configure products in RevenueCat.
- See `docs/REVENUECAT_SETUP_GUIDE.md` for detailed instructions
- Create products in App Store Connect / Google Play
- Add products to RevenueCat dashboard
- Create an offering with your products

### App crashes when clicking subscribe

**Solution**: Check the console logs for specific errors.
- Verify API keys are correct (no typos)
- Verify you're using the correct keys for your platform
- Check RevenueCat dashboard for error logs

### Subscription not showing after purchase

**Solution**: Try these steps:
1. Pull down to refresh on the Profile screen
2. Click "Refresh Profile Data"
3. Click "Restore Purchases"
4. Sign out and sign back in

## Next Steps

1. ✅ Add RevenueCat API keys (5 minutes)
2. ✅ Test subscription flow (5 minutes)
3. 📖 Read full setup guide: `docs/REVENUECAT_SETUP_GUIDE.md`
4. 🎨 (Optional) Customize paywalls
5. 🚀 Deploy to production

## Need Help?

- **Full Setup Guide**: See `docs/REVENUECAT_SETUP_GUIDE.md`
- **RevenueCat Docs**: [https://docs.revenuecat.com/](https://docs.revenuecat.com/)
- **RevenueCat Community**: [https://community.revenuecat.com/](https://community.revenuecat.com/)

## Important Notes

- 🔑 **Never commit API keys** to version control
- 🧪 **Use sandbox accounts** for testing
- 💰 **Test both monthly and annual** subscriptions
- 🔄 **Test restore purchases** functionality
- ✅ **Verify in RevenueCat dashboard** after each test

---

**Ready to go?** Just add your API keys and restart the app! 🚀
