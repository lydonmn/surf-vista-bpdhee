
# Superwall Common Tasks

Quick reference for common subscription-related tasks.

## 🔧 Configuration Tasks

### Update API Key

**File**: `utils/superwallConfig.ts`

```typescript
export const SUPERWALL_API_KEY = 'pk_your_actual_key_here';
```

**After updating**: Restart development server

### Check Configuration Status

**In app**: Check console logs on startup

**Expected output**:
```
[Superwall] ✅ Configuration Check:
[Superwall] - API Key: Configured
[Superwall] - Status: Initialized
```

### Verify Superwall is Working

**In code**:
```typescript
import { isSuperwallAvailable, checkSuperwallConfiguration } from '@/utils/superwallConfig';

// Check if available
if (isSuperwallAvailable()) {
  console.log('Superwall is ready!');
}

// Check configuration
checkSuperwallConfiguration();
```

## 👤 User Management Tasks

### Manually Grant Subscription

**In Supabase Dashboard**:

1. Go to Table Editor → `profiles`
2. Find user by email
3. Update fields:
   - `is_subscribed`: `true`
   - `subscription_end_date`: Set future date (e.g., 1 month from now)
4. Save

**SQL Query**:
```sql
UPDATE profiles
SET 
  is_subscribed = true,
  subscription_end_date = NOW() + INTERVAL '1 month'
WHERE email = 'user@example.com';
```

### Check User Subscription Status

**In Supabase Dashboard**:

1. Go to Table Editor → `profiles`
2. Find user by email
3. Check `is_subscribed` and `subscription_end_date` fields

**SQL Query**:
```sql
SELECT 
  email,
  is_subscribed,
  subscription_end_date,
  CASE 
    WHEN subscription_end_date > NOW() THEN 'Active'
    ELSE 'Expired'
  END as status
FROM profiles
WHERE email = 'user@example.com';
```

### Revoke Subscription

**In Supabase Dashboard**:

1. Go to Table Editor → `profiles`
2. Find user by email
3. Update fields:
   - `is_subscribed`: `false`
   - `subscription_end_date`: `null` or past date
4. Save

**SQL Query**:
```sql
UPDATE profiles
SET 
  is_subscribed = false,
  subscription_end_date = NULL
WHERE email = 'user@example.com';
```

### List All Active Subscribers

**SQL Query**:
```sql
SELECT 
  email,
  subscription_end_date,
  created_at
FROM profiles
WHERE 
  is_subscribed = true 
  AND subscription_end_date > NOW()
ORDER BY subscription_end_date DESC;
```

### List Expired Subscriptions

**SQL Query**:
```sql
SELECT 
  email,
  subscription_end_date,
  created_at
FROM profiles
WHERE 
  is_subscribed = true 
  AND subscription_end_date < NOW()
ORDER BY subscription_end_date DESC;
```

## 🧪 Testing Tasks

### Test Purchase Flow (Sandbox)

**iOS**:
1. Create sandbox tester in App Store Connect
2. Sign out of Apple ID on device
3. Run app
4. Click "Subscribe Now"
5. Sign in with sandbox account when prompted
6. Complete purchase
7. Verify subscription activates

**Android**:
1. Add test account in Google Play Console
2. Install app via internal testing
3. Click "Subscribe Now"
4. Complete purchase
5. Verify subscription activates

### Test Restore Purchases

1. Subscribe on Device A
2. Install app on Device B
3. Sign in with same account
4. Go to Profile screen
5. Click "Restore Purchases"
6. Verify subscription restores

### Test Subscription Expiration

**In Sandbox** (iOS):
- Subscriptions renew every 5 minutes
- Wait 5 minutes to test renewal
- Cancel subscription to test expiration

**In Production**:
- Manually set `subscription_end_date` to past date in Supabase
- Refresh app
- Verify content is locked

### Reset Test User

**In Supabase**:
```sql
UPDATE profiles
SET 
  is_subscribed = false,
  subscription_end_date = NULL
WHERE email = 'test@example.com';
```

**On Device**:
- iOS: Settings → App Store → Sandbox Account → Manage → Cancel All
- Android: Play Store → Subscriptions → Cancel

## 📊 Analytics Tasks

### View Subscription Metrics

**Superwall Dashboard**:
1. Log in to https://superwall.com/dashboard
2. Select your app
3. View:
   - Paywall impressions
   - Conversion rate
   - Revenue
   - Active subscribers

**Supabase Dashboard**:
```sql
-- Total active subscribers
SELECT COUNT(*) as active_subscribers
FROM profiles
WHERE 
  is_subscribed = true 
  AND subscription_end_date > NOW();

-- Revenue estimate (assuming $5/month)
SELECT COUNT(*) * 5 as monthly_revenue
FROM profiles
WHERE 
  is_subscribed = true 
  AND subscription_end_date > NOW();

-- New subscribers this month
SELECT COUNT(*) as new_this_month
FROM profiles
WHERE 
  is_subscribed = true
  AND created_at >= DATE_TRUNC('month', NOW());
```

### Export Subscriber List

**SQL Query**:
```sql
SELECT 
  email,
  is_subscribed,
  subscription_end_date,
  created_at,
  CASE 
    WHEN subscription_end_date > NOW() THEN 'Active'
    WHEN subscription_end_date < NOW() THEN 'Expired'
    ELSE 'Never Subscribed'
  END as status
FROM profiles
ORDER BY created_at DESC;
```

**Export**: Copy results to CSV

## 🔍 Debugging Tasks

### Check Console Logs

**Look for**:
- `[Superwall]` - Superwall-related logs
- `[AuthContext]` - Authentication and subscription checks
- `[ProfileScreen]` - Profile and subscription management
- `[LoginScreen]` - Purchase flow

**Common log patterns**:
```
✅ Success
❌ Error
⚠️ Warning
🚀 Initialization
💳 Purchase
🔄 Restore
📊 Result
```

### Debug Purchase Not Activating

**Steps**:
1. Check console logs for purchase handler errors
2. Verify Supabase connection
3. Check `profiles` table in Supabase
4. Try "Refresh Profile Data" button
5. Try "Restore Purchases" button

**SQL to check**:
```sql
SELECT * FROM profiles WHERE email = 'user@example.com';
```

### Debug Restore Purchases Failing

**Steps**:
1. Verify user is signed in with correct account
2. Check subscription status in device settings:
   - iOS: Settings → [Name] → Subscriptions
   - Android: Play Store → Subscriptions
3. Check console logs for restore handler errors
4. Verify subscription hasn't expired

### Debug Paywall Not Appearing

**Steps**:
1. Check API key is configured
2. Verify paywall ID is `subscription_paywall`
3. Check paywall is published in dashboard
4. Check console logs for errors
5. Verify network connection

**Test configuration**:
```typescript
import { checkSuperwallConfiguration } from '@/utils/superwallConfig';
checkSuperwallConfiguration();
```

## 🛠️ Maintenance Tasks

### Update Subscription Price

**Steps**:
1. Update price in App Store Connect / Google Play Console
2. Update price in Superwall dashboard
3. Update price text in app:
   - `app/login.tsx` - "Subscribe Now - $X/month"
   - `app/(tabs)/profile.tsx` - "Subscribe Now - $X/month"
4. Submit app update

### Extend Subscription Duration

**Change from 1 month to 3 months**:

**File**: `utils/superwallConfig.ts`

```typescript
// Change this line:
subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

// To:
subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 3);
```

### Add Free Trial

**In Superwall Dashboard**:
1. Go to Products
2. Edit product
3. Enable free trial
4. Set trial duration (e.g., 7 days)
5. Save

**In App Store Connect / Google Play Console**:
1. Edit subscription
2. Add introductory offer
3. Set free trial duration
4. Save

### Handle Refund Requests

**Process**:
1. User requests refund via App Store / Play Store
2. Apple / Google processes refund
3. Webhook notifies Superwall (if configured)
4. Manually revoke subscription in Supabase:

```sql
UPDATE profiles
SET 
  is_subscribed = false,
  subscription_end_date = NULL
WHERE email = 'user@example.com';
```

## 📱 User Support Tasks

### Help User Restore Purchases

**Instructions to send**:
```
To restore your subscription:

1. Open the SurfVista app
2. Go to the Profile tab
3. Tap "Restore Purchases"
4. Wait for confirmation

Make sure you're signed in with the same Apple ID / Google account you used to purchase.

If you're still having issues, please reply with:
- Your email address
- The device you're using
- When you purchased the subscription
```

### Help User Cancel Subscription

**Instructions to send**:
```
To cancel your subscription:

iOS:
1. Open Settings on your iPhone
2. Tap your name at the top
3. Tap Subscriptions
4. Select SurfVista
5. Tap Cancel Subscription

Android:
1. Open Google Play Store
2. Tap Menu → Subscriptions
3. Select SurfVista
4. Tap Cancel Subscription

Your subscription will remain active until the end of the current billing period.
```

### Help User Change Payment Method

**Instructions to send**:
```
To update your payment method:

iOS:
1. Open Settings on your iPhone
2. Tap your name at the top
3. Tap Payment & Shipping
4. Update your payment method

Android:
1. Open Google Play Store
2. Tap Menu → Payment methods
3. Add or update payment method

Your subscription will automatically use the new payment method for the next billing cycle.
```

## 🔐 Security Tasks

### Verify Subscription Server-Side

**Create Edge Function** (optional):

```typescript
// supabase/functions/verify-subscription/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { userId } = await req.json()

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_subscribed, subscription_end_date')
    .eq('id', userId)
    .single()

  const isActive = profile?.is_subscribed && 
    new Date(profile.subscription_end_date) > new Date()

  return new Response(
    JSON.stringify({ isActive }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

## 📝 Quick Reference

### Important Files
- `utils/superwallConfig.ts` - Configuration
- `contexts/AuthContext.tsx` - Subscription logic
- `app/login.tsx` - Purchase flow
- `app/(tabs)/profile.tsx` - Management UI

### Important Functions
- `initializeSuperwall()` - Initialize SDK
- `presentPaywall()` - Show paywall
- `restorePurchases()` - Restore subscription
- `checkSubscription()` - Check if user has access

### Important Database Fields
- `profiles.is_subscribed` - Boolean status
- `profiles.subscription_end_date` - Expiration date
- `profiles.is_admin` - Admin bypass

### Important Links
- Superwall Dashboard: https://superwall.com/dashboard
- App Store Connect: https://appstoreconnect.apple.com
- Google Play Console: https://play.google.com/console
- Supabase Dashboard: https://supabase.com/dashboard

---

**Need more help?** Check the other documentation files:
- `SUPERWALL_QUICK_START.md` - Quick setup
- `SUPERWALL_SETUP_GUIDE.md` - Detailed guide
- `SUPERWALL_SETUP_CHECKLIST.md` - Progress tracking
- `SUPERWALL_IMPLEMENTATION_SUMMARY.md` - What's implemented
