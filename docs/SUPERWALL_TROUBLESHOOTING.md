
# Superwall Troubleshooting Guide

Common issues and their solutions.

## 🚨 Configuration Issues

### Issue: "Superwall not configured" Error

**Symptoms**:
- Alert shows "Subscription features are currently being configured"
- Console shows: `[Superwall] ⚠️ API key not configured`

**Solution**:
1. Open `utils/superwallConfig.ts`
2. Replace `pk_YOUR_SUPERWALL_API_KEY_HERE` with your actual API key
3. Save the file
4. Restart the development server
5. Verify in console logs: `[Superwall] ✅ Initialized successfully`

**How to get API key**:
1. Go to https://superwall.com/dashboard
2. Select your app
3. Go to Settings → API Keys
4. Copy the **Public API Key** (starts with `pk_`)

---

### Issue: Paywall Doesn't Appear

**Symptoms**:
- Click "Subscribe Now" but nothing happens
- No paywall UI shows up
- Console shows errors

**Possible Causes & Solutions**:

**1. Paywall ID Mismatch**
- **Check**: Paywall ID in dashboard must be `subscription_paywall`
- **Fix**: Update paywall ID in Superwall dashboard to match

**2. Paywall Not Published**
- **Check**: Paywall status in dashboard
- **Fix**: Publish the paywall (not draft)

**3. Network Issues**
- **Check**: Internet connection
- **Fix**: Ensure device has internet access

**4. Superwall Not Initialized**
- **Check**: Console logs for initialization errors
- **Fix**: Verify API key is correct and restart app

**Debug Steps**:
```typescript
// Add this to test
import { isSuperwallAvailable } from '@/utils/superwallConfig';
console.log('Superwall available:', isSuperwallAvailable());
```

---

### Issue: Console Shows "Superwall Already Initialized"

**Symptoms**:
- Multiple initialization messages in console
- `[Superwall] Already initialized` appears repeatedly

**Cause**: Normal behavior - Superwall prevents double initialization

**Solution**: No action needed - this is expected and safe

---

## 💳 Purchase Issues

### Issue: Purchase Completes But Subscription Not Activated

**Symptoms**:
- Purchase goes through in App Store/Play Store
- Money charged
- But app still shows "No Active Subscription"
- Content remains locked

**Debug Steps**:

**1. Check Console Logs**
Look for purchase handler errors:
```
[Superwall] ❌ Error updating subscription: [error message]
```

**2. Check Supabase Connection**
```typescript
// Test Supabase connection
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .limit(1);
console.log('Supabase test:', { data, error });
```

**3. Check Profile in Database**
- Go to Supabase Dashboard
- Open Table Editor → `profiles`
- Find user by email
- Check `is_subscribed` and `subscription_end_date` fields

**Solutions**:

**Option 1: Refresh Profile**
1. Go to Profile screen in app
2. Tap "Refresh Profile Data"
3. Check if subscription activates

**Option 2: Restore Purchases**
1. Go to Profile screen
2. Tap "Restore Purchases"
3. Wait for confirmation

**Option 3: Manual Fix**
```sql
-- In Supabase SQL Editor
UPDATE profiles
SET 
  is_subscribed = true,
  subscription_end_date = NOW() + INTERVAL '1 month'
WHERE email = 'user@example.com';
```

---

### Issue: Purchase Handler Returns Error

**Symptoms**:
- Console shows: `[Superwall] ❌ Error updating subscription`
- Purchase completes but subscription not activated

**Common Errors**:

**1. "User not authenticated"**
- **Cause**: User not signed in
- **Fix**: Ensure user is signed in before purchasing

**2. "Could not update profile"**
- **Cause**: Supabase RLS policy blocking update
- **Fix**: Check RLS policies on `profiles` table

**3. "Network request failed"**
- **Cause**: No internet connection
- **Fix**: Check network connection

**Debug**:
```typescript
// Check current user
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);

// Check profile update permissions
const { data, error } = await supabase
  .from('profiles')
  .update({ is_subscribed: true })
  .eq('id', user.id);
console.log('Update test:', { data, error });
```

---

### Issue: Sandbox Purchase Not Working

**Symptoms**:
- Can't complete purchase in test mode
- "Cannot connect to iTunes Store" error
- Purchase fails immediately

**iOS Solutions**:

**1. Not Signed In with Sandbox Account**
- Sign out of production Apple ID
- Don't sign in to sandbox account in Settings
- App will prompt for sandbox account during purchase

**2. Sandbox Account Not Set Up**
- Go to App Store Connect
- Users and Access → Sandbox Testers
- Create new sandbox tester
- Use that account for testing

**3. Products Not Approved**
- Products must be approved before testing
- Can take 24 hours after submission
- Check status in App Store Connect

**4. Wrong Bundle ID**
- Ensure app bundle ID matches App Store Connect
- Check `app.json`: `expo.ios.bundleIdentifier`

**Android Solutions**:

**1. Not Using Test Account**
- Add email to license testing in Play Console
- Install app via internal testing track

**2. Products Not Active**
- Ensure subscription is active in Play Console
- Check Monetize → Subscriptions

---

## 🔄 Restore Purchases Issues

### Issue: "No Purchases Found" When Restoring

**Symptoms**:
- User has active subscription
- Restore purchases shows "No purchases found"

**Possible Causes**:

**1. Different Account**
- **Check**: Using same Apple ID / Google account?
- **Fix**: Sign in with account that made purchase

**2. Subscription Expired**
- **Check**: Subscription status in device settings
- **Fix**: Renew subscription if expired

**3. Different App Bundle ID**
- **Check**: App bundle ID matches purchase
- **Fix**: Ensure using same app that made purchase

**4. Subscription Cancelled**
- **Check**: Subscription status in App Store / Play Store
- **Fix**: Re-subscribe if cancelled

**Debug Steps**:

**Check Subscription in Device Settings**:

**iOS**:
1. Settings → [Your Name] → Subscriptions
2. Look for SurfVista
3. Check status and expiration

**Android**:
1. Play Store → Menu → Subscriptions
2. Look for SurfVista
3. Check status and expiration

**Check Database**:
```sql
SELECT 
  email,
  is_subscribed,
  subscription_end_date
FROM profiles
WHERE email = 'user@example.com';
```

---

### Issue: Restore Purchases Hangs/Freezes

**Symptoms**:
- Loading indicator shows indefinitely
- No error or success message
- App becomes unresponsive

**Solutions**:

**1. Network Timeout**
- Check internet connection
- Try again with better connection

**2. App Store / Play Store Not Responding**
- Restart device
- Try again

**3. App Bug**
- Force close app
- Reopen and try again

**Debug**:
```typescript
// Add timeout to restore
const restoreWithTimeout = async () => {
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), 30000)
  );
  
  try {
    await Promise.race([restorePurchases(), timeout]);
  } catch (error) {
    console.error('Restore timeout or error:', error);
  }
};
```

---

## 🔐 Access Control Issues

### Issue: Content Still Locked After Subscribing

**Symptoms**:
- Purchase successful
- Profile shows "Active Subscription"
- But content still locked

**Debug Steps**:

**1. Check Subscription Status**
```typescript
// In app, check this
const { checkSubscription } = useAuth();
console.log('Has subscription:', checkSubscription());
```

**2. Check Profile Data**
```typescript
const { profile } = useAuth();
console.log('Profile:', {
  is_subscribed: profile?.is_subscribed,
  subscription_end_date: profile?.subscription_end_date,
  is_admin: profile?.is_admin
});
```

**3. Check Date Comparison**
```typescript
const endDate = new Date(profile.subscription_end_date);
const now = new Date();
console.log('End date:', endDate);
console.log('Now:', now);
console.log('Is active:', endDate > now);
```

**Solutions**:

**Option 1: Refresh App**
- Close app completely
- Reopen app
- Check if content unlocks

**Option 2: Refresh Profile**
- Go to Profile screen
- Tap "Refresh Profile Data"
- Check if content unlocks

**Option 3: Check Date Format**
```sql
-- Ensure date is in future
UPDATE profiles
SET subscription_end_date = NOW() + INTERVAL '1 month'
WHERE email = 'user@example.com';
```

---

### Issue: Admin Can't Access Content

**Symptoms**:
- User has `is_admin = true` in database
- But content still locked

**Debug**:
```typescript
const { isAdmin, profile } = useAuth();
console.log('Is admin:', isAdmin());
console.log('Profile is_admin:', profile?.is_admin);
```

**Solution**:
```sql
-- Verify admin status
SELECT email, is_admin FROM profiles WHERE email = 'admin@example.com';

-- Set admin status
UPDATE profiles SET is_admin = true WHERE email = 'admin@example.com';
```

---

## 📱 Platform-Specific Issues

### iOS: "Cannot Connect to iTunes Store"

**Causes**:
- Not signed in with sandbox account
- Network issues
- iTunes Store down

**Solutions**:
1. Sign out of production Apple ID
2. Try purchase again (will prompt for sandbox account)
3. Check network connection
4. Check Apple System Status: https://www.apple.com/support/systemstatus/

---

### iOS: "This In-App Purchase Has Already Been Bought"

**Cause**: Trying to buy same subscription twice

**Solution**:
1. Use "Restore Purchases" instead
2. Or cancel existing subscription first

---

### Android: "Item Already Owned"

**Cause**: Already have active subscription

**Solution**:
1. Use "Restore Purchases" instead
2. Or cancel existing subscription in Play Store

---

### Android: "Authentication Required"

**Cause**: Not signed in to Google account

**Solution**:
1. Sign in to Google account on device
2. Try purchase again

---

## 🗄️ Database Issues

### Issue: RLS Policy Blocking Updates

**Symptoms**:
- Console shows: "new row violates row-level security policy"
- Profile updates fail

**Solution**:

**Check RLS Policies**:
```sql
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

**Fix RLS Policies**:
```sql
-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- Allow service role to update any profile (for purchase handler)
CREATE POLICY "Service role can update profiles"
ON profiles FOR UPDATE
USING (auth.role() = 'service_role');
```

---

### Issue: Profile Not Created on Sign Up

**Symptoms**:
- User signs up successfully
- But no profile in database
- App shows loading forever

**Solution**:

**Check Trigger**:
```sql
-- Create trigger to auto-create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin, is_subscribed)
  VALUES (new.id, new.email, false, false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 🔍 Debugging Tips

### Enable Verbose Logging

**In `utils/superwallConfig.ts`**:
```typescript
// Add more detailed logs
console.log('[Superwall] 🔍 Detailed state:', {
  isInitialized: isSuperwallInitialized,
  apiKey: SUPERWALL_API_KEY?.substring(0, 10) + '...',
  timestamp: new Date().toISOString()
});
```

### Test Subscription Check

```typescript
// Add to home screen or profile
const testSubscription = () => {
  const { profile, checkSubscription } = useAuth();
  console.log('=== SUBSCRIPTION TEST ===');
  console.log('Profile:', profile);
  console.log('Is subscribed:', profile?.is_subscribed);
  console.log('End date:', profile?.subscription_end_date);
  console.log('Check result:', checkSubscription());
  console.log('========================');
};
```

### Monitor Network Requests

**In Chrome DevTools** (for web):
1. Open DevTools
2. Go to Network tab
3. Filter by "superwall" or "supabase"
4. Watch for failed requests

---

## 📞 Getting Help

### Before Contacting Support

Gather this information:
- Console logs (copy full output)
- User email
- Device type (iOS/Android)
- App version
- Steps to reproduce
- Screenshots of error

### Superwall Support

- Email: support@superwall.com
- Docs: https://docs.superwall.com
- Dashboard: https://superwall.com/dashboard

### Supabase Support

- Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com
- Dashboard: https://supabase.com/dashboard

---

## ✅ Quick Fixes Checklist

When something goes wrong, try these in order:

- [ ] Check console logs for errors
- [ ] Verify API key is configured
- [ ] Restart development server
- [ ] Force close and reopen app
- [ ] Try "Refresh Profile Data"
- [ ] Try "Restore Purchases"
- [ ] Check internet connection
- [ ] Check Supabase dashboard
- [ ] Check Superwall dashboard
- [ ] Check device subscription settings
- [ ] Clear app data and reinstall

---

**Still having issues?** Check the other documentation files or contact support with the information gathered above.
