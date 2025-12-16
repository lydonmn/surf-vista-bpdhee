
# RevenueCat API Key Setup - CRITICAL FIX

## 🚨 PROBLEM: Paywall Not Presenting

The paywall is not showing because you're using a **TEST API key** which puts RevenueCat in "Preview API mode". This mode doesn't actually present paywalls.

## ✅ SOLUTION: Replace with Production API Key

### Step 1: Get Your Production API Key

1. Go to https://app.revenuecat.com/
2. Click on your **SurfVista** project
3. In the left sidebar, click **Settings** (gear icon)
4. Click **API Keys**
5. You'll see two sections:
   - **Apple App Store** (for iOS)
   - **Google Play Store** (for Android)

### Step 2: Copy the Correct Key

**For iOS:**
- Copy the key under "Apple App Store"
- It will look like: `appl_xxxxxxxxxxxxxxxxx`

**For Android:**
- Copy the key under "Google Play Store"
- It will look like: `goog_xxxxxxxxxxxxxxxxx`

### Step 3: Update the Code

Open `utils/superwallConfig.ts` and replace these lines:

```typescript
// BEFORE (current - using test key):
const REVENUECAT_API_KEY_IOS = 'test_pIbMwlfINrGOjQfGWYzmARWVOvg';
const REVENUECAT_API_KEY_ANDROID = 'test_pIbMwlfINrGOjQfGWYzmARWVOvg';

// AFTER (replace with your production keys):
const REVENUECAT_API_KEY_IOS = 'appl_YOUR_IOS_KEY_HERE';
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_ANDROID_KEY_HERE';
```

### Step 4: Restart the App

After updating the keys:
1. Stop the Expo dev server
2. Clear the cache: `npx expo start -c`
3. Rebuild the app on your device

## 🔍 How to Verify It's Working

After updating the keys, check the console logs when you press the Subscribe button:

**BEFORE (test key):**
```
[RevenueCat] ⚠️⚠️⚠️ WARNING: Using TEST API key! ⚠️⚠️⚠️
[RevenueCatUI] [presentPaywall] This method is available but has no effect in Preview API mode.
```

**AFTER (production key):**
```
[RevenueCat] ✅ RevenueCat SDK initialized successfully
[RevenueCat] 🎨 Presenting paywall...
[RevenueCat] 📊 Paywall presented successfully
```

## 📝 Important Notes

- **Test keys** are only for testing SDK integration, not for actual paywall presentation
- **Production keys** are required to show paywalls and process real purchases
- You need separate keys for iOS and Android
- Keep your production keys secure - don't commit them to public repositories

## 🆘 Still Having Issues?

If the paywall still doesn't show after updating to production keys:

1. **Verify the paywall is published:**
   - Go to RevenueCat Dashboard → Paywalls
   - Make sure your paywall has a green "Published" badge

2. **Check the offering link:**
   - Go to RevenueCat Dashboard → Offerings
   - Click on your "default" offering
   - Verify it has a paywall attached (should show paywall name)

3. **Verify products are configured:**
   - Go to RevenueCat Dashboard → Products
   - Make sure your products are listed and active
   - Verify they're added to your offering

4. **Check console logs:**
   - Look for any error messages in the console
   - Share them if you need help debugging

## 📚 Additional Resources

- RevenueCat Dashboard: https://app.revenuecat.com/
- RevenueCat API Keys Documentation: https://www.revenuecat.com/docs/authentication
- RevenueCat Paywalls Guide: https://www.revenuecat.com/docs/displaying-products
