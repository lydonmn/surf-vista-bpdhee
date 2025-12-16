
# Superwall Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Get Your API Key (2 minutes)

1. Go to https://superwall.com
2. Sign up or log in
3. Create a new app
4. Copy your **Public API Key** (starts with `pk_`)

### 2. Update Your Code (1 minute)

Open `utils/superwallConfig.ts` and replace:

```typescript
export const SUPERWALL_API_KEY = 'pk_YOUR_ACTUAL_API_KEY_HERE';
```

With your actual key:

```typescript
export const SUPERWALL_API_KEY = 'pk_abc123...';
```

### 3. Create a Paywall (2 minutes)

In Superwall dashboard:

1. Go to **Paywalls** → **Create Paywall**
2. Set **Paywall ID** to: `subscription_paywall`
3. Choose a template
4. Add your product (you'll create this next)
5. Publish

### 4. Configure Products (Later)

You'll need to set up products in:
- **iOS**: App Store Connect
- **Android**: Google Play Console

Product ID must be: `com.surfvista.monthly`

See full guide in `SUPERWALL_SETUP_GUIDE.md` for detailed instructions.

## ✅ Testing

Once configured, test by:

1. Run the app
2. Sign in or create account
3. Click "Subscribe Now - $5/month"
4. Complete purchase (use sandbox account)
5. Verify content unlocks

## 🔍 Verify Configuration

Check the console logs when app starts:

**✅ Configured correctly:**
```
[Superwall] ✅ Configuration Check:
[Superwall] - API Key: Configured
[Superwall] - Status: Initialized
```

**❌ Not configured:**
```
[Superwall] ⚠️ Configuration Check:
[Superwall] - API Key: NOT CONFIGURED
[Superwall] - Status: Disabled
```

## 🎯 Key Features Implemented

- ✅ Subscription paywall
- ✅ Purchase handling
- ✅ Restore purchases
- ✅ Subscription status checking
- ✅ Profile integration
- ✅ Admin bypass
- ✅ Error handling

## 📱 User Features

### Subscribe
- Login screen: "Subscribe Now - $5/month" button
- Profile screen: "Subscribe Now" button (if not subscribed)

### Restore Purchases
- Profile screen: "Restore Purchases" button
- Useful when switching devices or reinstalling app

### Manage Subscription
- Profile screen: "Manage Subscription" button
- Links to iOS Settings or Google Play

## 🐛 Troubleshooting

### Paywall doesn't show
- Check API key is set correctly
- Verify paywall ID is `subscription_paywall`
- Check console logs for errors

### Purchase doesn't activate subscription
- Try "Refresh Profile Data" button
- Try "Restore Purchases" button
- Check console logs for errors

### "Superwall not configured" message
- Update API key in `utils/superwallConfig.ts`
- Restart development server

## 📚 Full Documentation

For complete setup instructions, see:
- `SUPERWALL_SETUP_GUIDE.md` - Complete setup guide
- `TESTING_GUIDE.md` - Testing procedures
- Superwall docs: https://docs.superwall.com

## 💡 Tips

1. **Start with sandbox testing** - Don't use real money until fully tested
2. **Check console logs** - They have detailed emoji-coded messages
3. **Test restore purchases** - Important for user experience
4. **Monitor Superwall dashboard** - Track conversions and revenue

## 🎉 You're Ready!

Once you've updated the API key and created a paywall, your subscription system is ready to go!

Test it thoroughly in sandbox mode before going live.
