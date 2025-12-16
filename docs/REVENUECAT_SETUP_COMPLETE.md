
# RevenueCat Setup Complete Guide

## ✅ What Has Been Fixed

### 1. **RevenueCat Plugin Configuration**
- Added `react-native-purchases` plugin to `app.json`
- Configured with your test API key
- This enables native module support for in-app purchases

### 2. **Sign-Up Flow Improvements**
- Added better error handling for email verification
- Clear messaging when email confirmation is required
- Improved validation for email and password
- Better user feedback throughout the process

### 3. **Subscription Integration**
- Properly configured product IDs
- Updated pricing display ($10.99/month, $100.99/year)
- Enhanced error handling for paywall access
- Better logging for debugging

## 🚀 Next Steps to Complete Setup

### Step 1: RevenueCat Dashboard Configuration

1. **Go to RevenueCat Dashboard**: https://app.revenuecat.com/

2. **Create/Select Your App**
   - If you haven't already, create a new app
   - Select iOS or Android (or both)

3. **Configure Products**
   - Go to **Products** section
   - Add your subscription products with these identifiers:
     - Monthly: `surfvista_monthly` or `monthly`
     - Annual: `surfvista_annual` or `yearly`

4. **Create Entitlement**
   - Go to **Entitlements** section
   - Create an entitlement called: `premium`
   - This is what the app checks to grant access

5. **Create Offering**
   - Go to **Offerings** section
   - Create a new offering (or use the default one)
   - Attach your monthly and annual products to this offering

6. **Configure Paywall**
   - Go to **Paywalls** section
   - Create a paywall with your branding
   - Add your monthly and annual subscription options
   - Set pricing: $10.99/month, $100.99/year

7. **Get Production API Key**
   - Go to **Settings** > **API Keys**
   - Copy your production API key
   - Replace the test key in `app.json` and `utils/superwallConfig.ts`

### Step 2: App Store Connect / Google Play Console

#### For iOS (App Store Connect):

1. **Create In-App Purchase Products**
   - Go to App Store Connect
   - Select your app
   - Go to **Features** > **In-App Purchases**
   - Create two auto-renewable subscriptions:
     - Product ID: `surfvista_monthly` (or `monthly`)
     - Product ID: `surfvista_annual` (or `yearly`)
   - Set pricing: $10.99/month, $100.99/year

2. **Link to RevenueCat**
   - In RevenueCat dashboard, go to your app settings
   - Add your App Store Connect credentials
   - RevenueCat will automatically sync your products

#### For Android (Google Play Console):

1. **Create Subscription Products**
   - Go to Google Play Console
   - Select your app
   - Go to **Monetize** > **Subscriptions**
   - Create two subscriptions:
     - Product ID: `surfvista_monthly` (or `monthly`)
     - Product ID: `surfvista_annual` (or `yearly`)
   - Set pricing: $10.99/month, $100.99/year

2. **Link to RevenueCat**
   - In RevenueCat dashboard, go to your app settings
   - Add your Google Play service account credentials
   - RevenueCat will automatically sync your products

### Step 3: Rebuild Your App

After configuring the plugin in `app.json`, you need to rebuild:

```bash
# Clean and rebuild
npx expo prebuild --clean

# For iOS
npx expo run:ios

# For Android
npx expo run:android
```

**Note**: The plugin changes won't work in Expo Go. You need to create a development build.

## 🔍 Testing Your Setup

### Test Sign-Up Flow:

1. **Create a new account**
   - Use a real email address
   - Password must be at least 6 characters
   - Check your email for verification link
   - Click the verification link
   - Return to app and sign in

2. **Verify Error Handling**
   - Try signing in before verifying email
   - Should see: "Please verify your email address before signing in"
   - Try invalid credentials
   - Should see: "Invalid email or password"

### Test Subscription Flow:

1. **Access Paywall**
   - Sign in to the app
   - Go to Profile tab
   - Tap "Subscribe Now" button
   - Should see RevenueCat paywall with your products

2. **Test Purchase** (Sandbox Mode)
   - Use a sandbox test account
   - Complete a test purchase
   - Verify subscription status updates in app
   - Check that content becomes accessible

3. **Test Restore Purchases**
   - Tap "Restore Purchases" button
   - Should restore any previous purchases
   - Subscription status should update

4. **Test Customer Center**
   - If subscribed, tap "Manage Subscription"
   - Should open RevenueCat Customer Center
   - Can view subscription details and manage

## 🐛 Troubleshooting

### Issue: "Payment system is not initialized"

**Solution:**
1. Check that `react-native-purchases` plugin is in `app.json`
2. Rebuild the app with `npx expo prebuild --clean`
3. Make sure you're not using Expo Go (requires development build)

### Issue: "No offerings found"

**Solution:**
1. Verify products are created in RevenueCat dashboard
2. Check that entitlement is created and named "premium"
3. Ensure offering is created and products are attached
4. Wait a few minutes for RevenueCat to sync
5. Restart the app

### Issue: "Email not confirmed" error

**Solution:**
1. Check your email inbox (and spam folder)
2. Click the verification link in the email
3. Wait a moment for verification to process
4. Try signing in again

### Issue: Products not showing in paywall

**Solution:**
1. Verify product IDs match in:
   - App Store Connect / Google Play Console
   - RevenueCat dashboard
   - Your app code (`utils/superwallConfig.ts`)
2. Check that products are attached to the offering
3. Ensure paywall is configured in RevenueCat dashboard

## 📊 Monitoring

### Check Logs:

The app logs detailed information about:
- RevenueCat initialization
- Product offerings
- Purchase attempts
- Subscription status
- Errors and issues

Look for logs starting with `[RevenueCat]` in your console.

### RevenueCat Dashboard:

Monitor your subscriptions in real-time:
- Go to **Dashboard** > **Overview**
- View active subscriptions
- Track revenue
- Monitor churn
- View customer details

## 🔐 Security Notes

1. **API Keys**
   - The test key is fine for development
   - Use production key for production builds
   - Never commit production keys to version control

2. **Email Verification**
   - Email verification is required by default
   - This prevents spam accounts
   - Users must verify before accessing content

3. **Subscription Validation**
   - RevenueCat handles receipt validation
   - Subscription status syncs with Supabase
   - Admin users always have access

## 📱 User Flow

### New User:
1. Opens app → sees login screen
2. Taps "Sign Up"
3. Enters email and password
4. Receives verification email
5. Clicks verification link
6. Returns to app and signs in
7. Sees paywall to subscribe
8. Completes purchase
9. Gets access to content

### Existing User:
1. Opens app → sees login screen
2. Signs in with credentials
3. If subscribed → access granted
4. If not subscribed → sees paywall
5. Can restore previous purchases

## 🎯 Success Criteria

Your setup is complete when:
- ✅ Users can sign up and receive verification emails
- ✅ Users can sign in after verifying email
- ✅ Paywall displays with correct products and pricing
- ✅ Users can purchase subscriptions
- ✅ Subscription status updates in app and database
- ✅ Users can restore purchases
- ✅ Customer Center works for managing subscriptions
- ✅ Content access is properly gated by subscription status

## 📞 Support

If you encounter issues:

1. **Check the logs** - Look for `[RevenueCat]` and `[AuthContext]` logs
2. **Review this guide** - Make sure all steps are completed
3. **RevenueCat Docs** - https://www.revenuecat.com/docs
4. **Supabase Docs** - https://supabase.com/docs/guides/auth

## 🎉 You're All Set!

Once you've completed the steps above, your subscription system will be fully functional. Users can sign up, subscribe, and access your exclusive surf reports and drone footage!
