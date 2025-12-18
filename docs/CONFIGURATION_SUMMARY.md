
# SurfVista Configuration Summary 📋

Current configuration status and what needs to be updated for launch.

---

## ✅ Already Configured (No Action Needed)

### App Configuration
- **App Name**: SurfVista
- **Bundle ID**: com.anonymous.Natively
- **Version**: 1.0.0
- **Platform**: iOS (Android ready)

### Features Implemented
- ✅ User authentication (Supabase Auth)
- ✅ Video upload and playback (6K support)
- ✅ Surf reports (NOAA integration)
- ✅ Weather forecasts
- ✅ Admin panel
- ✅ Subscription system (RevenueCat)
- ✅ Database (Supabase)
- ✅ Storage (Supabase Storage)

### Code Configuration
- ✅ RevenueCat SDK integrated
- ✅ Subscription logic implemented
- ✅ Paywall UI ready
- ✅ Error handling
- ✅ Loading states
- ✅ Admin controls

---

## ⚠️ Needs Configuration (Before Launch)

### 1. RevenueCat API Key
**File**: `utils/superwallConfig.ts`

**Current**:
```typescript
const REVENUECAT_API_KEY_IOS = 'test_pIbMwlfINrGOjQfGWYzmARWVOvg';
```

**Update to**:
```typescript
const REVENUECAT_API_KEY_IOS = 'appl_YOUR_PRODUCTION_KEY_HERE';
```

**Where to get it**:
1. Go to https://app.revenuecat.com/
2. Settings → API Keys
3. Copy iOS API key (starts with `appl_`)

---

### 2. Product IDs
**File**: `utils/superwallConfig.ts`

**Current**:
```typescript
PRODUCTS: {
  MONTHLY_SUBSCRIPTION: 'surfvista_monthly',
  ANNUAL_SUBSCRIPTION: 'surfvista_annual',
}
```

**Action**: Verify these match your App Store Connect product IDs exactly

**Where to check**:
1. App Store Connect
2. Your app → Features → In-App Purchases
3. Product IDs must match exactly (case-sensitive)

---

### 3. Entitlement ID
**File**: `utils/superwallConfig.ts`

**Current**:
```typescript
ENTITLEMENT_ID: 'premium',
```

**Action**: Verify this matches your RevenueCat entitlement

**Where to check**:
1. RevenueCat dashboard
2. Entitlements section
3. Must be exactly: `premium`

---

### 4. Pricing Display
**File**: `utils/superwallConfig.ts`

**Current**:
```typescript
PRICING: {
  MONTHLY: '$10.99',
  ANNUAL: '$99.99',
}
```

**Action**: Update if you change prices in App Store Connect

---

## 🔧 Optional Configuration

### 1. Bundle ID (If Using Custom Domain)
**File**: `app.json`

**Current**:
```json
"bundleIdentifier": "com.anonymous.Natively"
```

**Update to** (if you have a domain):
```json
"bundleIdentifier": "com.yourdomain.surfvista"
```

**Also update in**:
- App Store Connect
- RevenueCat dashboard
- Provisioning profiles

---

### 2. App Name (If Changing)
**File**: `app.json`

**Current**:
```json
"name": "SurfVista"
```

**Keep as is** unless you want a different name

---

### 3. Pricing (If Adjusting)
**Where to update**:
1. App Store Connect (primary source)
2. RevenueCat dashboard (for display)
3. `utils/superwallConfig.ts` (for app display)
4. App description (mention pricing)

**Current pricing**:
- Monthly: $10.99/month
- Annual: $100.99/year

---

## 📊 Configuration Checklist

Before submitting to App Store:

- [ ] RevenueCat production API key set
- [ ] Product IDs match App Store Connect
- [ ] Entitlement ID matches RevenueCat
- [ ] Pricing is correct in all places
- [ ] Bundle ID is correct
- [ ] App name is correct
- [ ] Version number is set (1.0.0)

---

## 🔍 How to Verify Configuration

### Test RevenueCat Connection
```bash
# Run app
npm run ios

# Check console for:
[RevenueCat] ✅ RevenueCat SDK initialized successfully
[RevenueCat] 📦 Current offering: default
[RevenueCat] 📦 Available packages: 2
```

### Test Subscription Flow
1. Sign in to app
2. Go to Profile tab
3. Tap "Subscribe Now"
4. Should see paywall with correct pricing
5. Use sandbox account to test purchase

### Verify Product IDs
```bash
# In console, look for:
[RevenueCat] - surfvista_monthly: $10.99
[RevenueCat] - surfvista_annual: $100.99
```

---

## 🚨 Critical: Don't Forget!

### Before Building for Production
1. **Update API key** from test to production
2. **Verify product IDs** match exactly
3. **Test subscription** with sandbox account
4. **Check console logs** for errors

### After Updating Configuration
1. **Restart app** completely
2. **Clear cache** if needed
3. **Test again** to verify changes

---

## 📝 Configuration Files Reference

| File | What It Configures | When to Update |
|------|-------------------|----------------|
| `app.json` | App metadata, bundle ID | Before first build |
| `utils/superwallConfig.ts` | RevenueCat, products, pricing | Before production |
| `eas.json` | Build configuration | Rarely |
| `package.json` | Dependencies | When adding features |

---

## 🔐 Security Notes

### API Keys
- ✅ Test key: Safe to commit (already in code)
- ❌ Production key: Never commit to git
- ✅ Use environment variables for production

### Sensitive Data
- Never commit:
  - Production API keys
  - Database passwords
  - Private keys
  - Certificates

---

## 📞 Need Help?

### Configuration Issues
1. Check this document first
2. Review `docs/APPLE_DEVELOPER_NEXT_STEPS.md`
3. Check RevenueCat docs: https://docs.revenuecat.com/
4. Contact support: support@revenuecat.com

### Build Issues
1. Check `docs/APP_STORE_TROUBLESHOOTING.md`
2. Review EAS docs: https://docs.expo.dev/eas/
3. Check build logs for errors

---

## ✨ Quick Commands

### Update Configuration
```bash
# Edit configuration
code utils/superwallConfig.ts

# Restart app
npm run ios
```

### Verify Configuration
```bash
# Check console logs
# Look for [RevenueCat] messages
# Should see ✅ for successful initialization
```

### Build for Production
```bash
# After updating configuration
eas build --platform ios --profile production
```

---

## 🎯 Configuration Status

**Current Status**: ⚠️ Test Configuration

**Production Ready**: ❌ No (needs production API key)

**After Updating**: ✅ Yes (ready to submit)

---

**Next Step**: Update RevenueCat API key in `utils/superwallConfig.ts`

**Time Required**: 5 minutes

**Then**: Ready to build and submit! 🚀

---

*Last Updated: After Apple Developer Approval*
*Configuration Version: 1.0.0*
*Status: Awaiting Production API Key*
