
# Payment Integration Guide for SurfVista

## Current Status

⚠️ **Payment system is currently not configured.** The app has placeholder code that prevents crashes but doesn't process actual payments.

## Why the Error Occurred

The error "superwallexpo cannot find native module" happened because:

1. **`expo-superwall` doesn't exist** - This package was incorrectly added to package.json
2. **Superwall requires native code** - The official `@superwall/react-native` package requires native modules that aren't compatible with Expo's managed workflow
3. **No config plugin available** - Superwall doesn't provide an Expo config plugin for easy integration

## Integration Options

You have **3 main options** to add payment functionality to your app:

---

## Option 1: RevenueCat (⭐ RECOMMENDED)

RevenueCat is the easiest solution for Expo apps and provides similar features to Superwall.

### Why RevenueCat?

- ✅ Better Expo support with `react-native-purchases`
- ✅ Handles App Store and Google Play subscriptions
- ✅ Built-in paywall templates
- ✅ Analytics and subscription management
- ✅ Free tier available

### Installation Steps

1. **Create a RevenueCat account**
   - Go to https://www.revenuecat.com/
   - Sign up for a free account
   - Create a new project

2. **Configure your app in RevenueCat**
   - Add your iOS Bundle ID: `com.anonymous.Natively`
   - Add your Android Package Name: `com.anonymous.Natively`
   - Upload your App Store Connect API key (iOS)
   - Upload your Google Play Service Account key (Android)

3. **Create products in RevenueCat**
   - Create a monthly subscription product ($10.99/month)
   - Create an annual subscription product ($100.99/year)
   - Note the product identifiers

4. **Install the package**
   ```bash
   npx expo install react-native-purchases
   ```

5. **Update `utils/superwallConfig.ts`**
   ```typescript
   import Purchases from 'react-native-purchases';
   
   const REVENUECAT_API_KEY = 'your_api_key_here';
   
   export const initializePaymentSystem = async () => {
     try {
       await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
       console.log('[Payment] RevenueCat initialized');
       return true;
     } catch (error) {
       console.error('[Payment] RevenueCat init error:', error);
       return false;
     }
   };
   
   export const presentPaywall = async (productType: 'monthly' | 'annual') => {
     try {
       const offerings = await Purchases.getOfferings();
       const productId = productType === 'monthly' 
         ? 'monthly_subscription' 
         : 'annual_subscription';
       
       const purchaseResult = await Purchases.purchaseProduct(productId);
       
       if (purchaseResult.customerInfo.entitlements.active['premium']) {
         return { state: 'purchased' };
       }
       return { state: 'declined' };
     } catch (error) {
       console.error('[Payment] Purchase error:', error);
       throw error;
     }
   };
   ```

6. **Build and test**
   ```bash
   eas build --profile development --platform ios
   ```

### Resources

- [RevenueCat Documentation](https://www.revenuecat.com/docs/getting-started)
- [React Native Purchases SDK](https://www.revenuecat.com/docs/getting-started/installation/reactnative)
- [RevenueCat Dashboard](https://app.revenuecat.com/)

---

## Option 2: EAS Development Build with Superwall

If you specifically want to use Superwall, you need to create a custom native build.

### Installation Steps

1. **Install Superwall**
   ```bash
   npm install @superwall/react-native
   ```

2. **Create EAS configuration**
   
   Update `eas.json`:
   ```json
   {
     "build": {
       "development": {
         "developmentClient": true,
         "distribution": "internal",
         "ios": {
           "simulator": true
         }
       },
       "preview": {
         "distribution": "internal"
       },
       "production": {}
     }
   }
   ```

3. **Update `utils/superwallConfig.ts`**
   
   Replace the placeholder code with actual Superwall implementation:
   ```typescript
   import Superwall from '@superwall/react-native';
   
   export const SUPERWALL_API_KEY = 'pk_gHLCe_Tlt8M5kFpi5dBHW';
   
   export const initializePaymentSystem = async () => {
     try {
       await Superwall.configure(SUPERWALL_API_KEY);
       console.log('[Payment] Superwall initialized');
       return true;
     } catch (error) {
       console.error('[Payment] Superwall init error:', error);
       return false;
     }
   };
   ```

4. **Build with EAS**
   ```bash
   # Install EAS CLI
   npm install -g eas-cli
   
   # Login to Expo
   eas login
   
   # Build for iOS
   eas build --profile development --platform ios
   
   # Build for Android
   eas build --profile development --platform android
   ```

5. **Install and test the build**
   - Download the build from EAS
   - Install on your device
   - Test the subscription flow

### Resources

- [Superwall Documentation](https://docs.superwall.com/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)

---

## Option 3: Web-Based Payments (Stripe)

Use Stripe Checkout with a WebView for a web-based payment flow.

### Installation Steps

1. **Create a Stripe account**
   - Go to https://stripe.com/
   - Create an account
   - Get your API keys

2. **Create a Supabase Edge Function for checkout**
   
   Create `supabase/functions/create-checkout/index.ts`:
   ```typescript
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
   import Stripe from 'https://esm.sh/stripe@12.0.0';
   
   const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
     apiVersion: '2023-10-16',
   });
   
   serve(async (req) => {
     const { priceId, userId } = await req.json();
     
     const session = await stripe.checkout.sessions.create({
       mode: 'subscription',
       line_items: [{ price: priceId, quantity: 1 }],
       success_url: 'surfvista://payment-success',
       cancel_url: 'surfvista://payment-cancel',
       client_reference_id: userId,
     });
     
     return new Response(JSON.stringify({ url: session.url }), {
       headers: { 'Content-Type': 'application/json' },
     });
   });
   ```

3. **Update `utils/superwallConfig.ts`**
   ```typescript
   import * as WebBrowser from 'expo-web-browser';
   import { supabase } from '@/app/integrations/supabase/client';
   
   export const presentPaywall = async (productType: 'monthly' | 'annual', userId: string) => {
     try {
       const priceId = productType === 'monthly' 
         ? 'price_monthly_id' 
         : 'price_annual_id';
       
       const { data, error } = await supabase.functions.invoke('create-checkout', {
         body: { priceId, userId }
       });
       
       if (error) throw error;
       
       const result = await WebBrowser.openBrowserAsync(data.url);
       
       if (result.type === 'cancel') {
         return { state: 'declined' };
       }
       
       return { state: 'purchased' };
     } catch (error) {
       console.error('[Payment] Stripe error:', error);
       throw error;
     }
   };
   ```

4. **Set up Stripe webhook**
   - Create a webhook endpoint in Stripe Dashboard
   - Point it to your Supabase Edge Function
   - Handle `checkout.session.completed` events
   - Update user subscription status in Supabase

### Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

## Testing Subscriptions

### For Development

1. **Use Sandbox/Test Mode**
   - RevenueCat: Use sandbox mode
   - Superwall: Use test mode
   - Stripe: Use test mode with test cards

2. **Manual Subscription Grant**
   
   For testing, you can manually grant subscriptions using the helper function:
   ```typescript
   import { grantSubscription } from '@/utils/superwallConfig';
   
   // Grant a monthly subscription
   await grantSubscription(userId, 'monthly');
   
   // Grant an annual subscription
   await grantSubscription(userId, 'annual');
   ```

3. **Admin Panel**
   
   Use the admin panel to manually update subscription status in the database.

---

## Next Steps

1. **Choose your integration option** (RevenueCat recommended)
2. **Follow the installation steps** for your chosen option
3. **Update `utils/superwallConfig.ts`** with actual implementation
4. **Test thoroughly** in sandbox/test mode
5. **Submit to App Store/Google Play** with in-app purchases configured

---

## Need Help?

- **RevenueCat Support**: https://community.revenuecat.com/
- **Superwall Support**: https://docs.superwall.com/
- **Stripe Support**: https://support.stripe.com/
- **Expo Forums**: https://forums.expo.dev/

---

## Important Notes

⚠️ **App Store Requirements**
- You must have a paid Apple Developer account ($99/year)
- Configure in-app purchases in App Store Connect
- Submit app for review with subscription features

⚠️ **Google Play Requirements**
- You must have a Google Play Developer account ($25 one-time)
- Configure in-app products in Google Play Console
- Submit app for review with subscription features

⚠️ **Testing**
- Always test subscriptions in sandbox mode first
- Test purchase, restore, and cancellation flows
- Verify subscription status updates correctly in your database

⚠️ **Legal**
- Add Terms of Service and Privacy Policy
- Include subscription terms (auto-renewal, cancellation, etc.)
- Comply with App Store and Google Play policies
