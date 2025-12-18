
# SurfVista Quick Reference Card 🎯

Keep this handy during setup!

---

## 🔑 Critical Information

### Product IDs (Must Match Everywhere)
```
Monthly: surfvista_monthly
Annual: surfvista_annual
Entitlement: premium
```

### Bundle ID
```
com.anonymous.Natively
```

### Pricing
```
Monthly: $10.99/month
Annual: $100.99/year
```

---

## 🔗 Important URLs

```
App Store Connect:
https://appstoreconnect.apple.com/

RevenueCat Dashboard:
https://app.revenuecat.com/

Supabase Dashboard:
https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft

Privacy Policy Generator:
https://www.privacypolicygenerator.info/
```

---

## 📝 Demo Account

```
Email: reviewer@surfvista.com
Password: TestPassword123!
Status: Active subscription
Purpose: For Apple reviewers
```

---

## ⚡ Quick Commands

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios

# Run locally
npm run ios
```

---

## 🔧 Configuration File

**File**: `utils/superwallConfig.ts`

**Update this line**:
```typescript
const REVENUECAT_API_KEY_IOS = 'appl_YOUR_KEY_HERE';
```

**Verify these match**:
```typescript
PRODUCTS: {
  MONTHLY_SUBSCRIPTION: 'surfvista_monthly',
  ANNUAL_SUBSCRIPTION: 'surfvista_annual',
},
ENTITLEMENT_ID: 'premium',
```

---

## ✅ Pre-Submit Checklist

```
□ RevenueCat API key updated
□ Products match everywhere
□ Tested with sandbox account
□ Demo account created
□ Privacy policy URL added
□ Screenshots uploaded (5)
□ App description added
□ Support email set
□ Age rating: 4+
□ Export compliance: No
```

---

## 🆘 Emergency Fixes

### Paywall Not Showing
```
1. Check API key starts with "appl_"
2. Restart app completely
3. Check console for [RevenueCat] logs
```

### Purchase Fails
```
1. Use sandbox test account
2. Sign out of real Apple ID
3. Check product IDs match
```

### Build Fails
```
1. Run: eas build --clear-cache
2. Check bundle ID matches
3. Verify version number
```

---

## 📊 Success Metrics

```
Week 1:  50-100 downloads, 10-20 subs
Month 1: 200-500 downloads, 50-100 subs
Month 3: 1000+ downloads, 200-300 subs
```

---

## 📞 Support Contacts

```
RevenueCat: support@revenuecat.com
Apple: 1-800-633-2152
Expo: https://expo.dev/support
```

---

## ⏱️ Time Estimates

```
Configuration: 3-4 hours
Apple Review: 1-3 days
Total Launch: 2-4 days
```

---

## 📚 Documentation

```
Quick Start:
→ ONE_PAGE_LAUNCH_GUIDE.md

Detailed Guide:
→ APPLE_DEVELOPER_NEXT_STEPS.md

Troubleshooting:
→ APP_STORE_TROUBLESHOOTING.md

Checklist:
→ QUICK_LAUNCH_CHECKLIST.md
```

---

**Print this card and keep it visible during setup!**

*Everything you need at a glance* 👀
