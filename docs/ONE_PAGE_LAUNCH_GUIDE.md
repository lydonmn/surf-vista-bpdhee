
# SurfVista - One Page Launch Guide 📄

Everything you need to launch, on one page.

---

## 🎯 YOUR SURFVISTA REVENUECAT IDENTIFIERS

**Use these EXACT identifiers everywhere:**

```
Product IDs:
  • surfvista_monthly
  • surfvista_annual

Offering ID:
  • ofrnge7bdc97106 (or "default")

Entitlement ID:
  • premium
```

---

## ⚡ Quick Start (3 hours to submit)

### 1. App Store Connect (30 min)
```
→ https://appstoreconnect.apple.com/Q
→ Create app: "SurfVista"
→ Create subscription: surfvista_monthly ($5.00/month)
→ Create subscription: surfvista_annual ($50.00/year)
→ Submit for review
```

### 2. RevenueCat (20 min)
```
→ https://app.revenuecat.com/
→ Create project: "SurfVista"
→ Add product: surfvista_monthly
→ Add product: surfvista_annual
→ Create entitlement: premium
→ Create offering: ofrnge7bdc97106 (or default)
→ Copy API key → Update utils/superwallConfig.ts
```

### 3. Test (15 min)
```
→ Create sandbox test account
→ npm run ios
→ Test subscription purchase
→ Verify it works
```

### 4. Assets (1-2 hours)
```
→ App icon: 1024x1024 PNG
→ 5 screenshots (home, videos, report, library, paywall)
→ App description (see below)
→ Privacy policy URL
```

### 5. Submit (30 min)
```
→ eas build --platform ios --profile production
→ eas submit --platform ios
→ Upload assets to App Store Connect
→ Create demo account: reviewer@surfvista.com
→ Submit for review
```

---

## 📝 Copy & Paste

### App Description
```
SurfVista - Your Premium Folly Beach Surf Report

Get exclusive access to daily surf conditions, 6K drone footage, 
and accurate weather forecasts for Folly Beach, South Carolina.

FEATURES:
• 6K Resolution Drone Videos
• Daily Surf Reports
• 7-Day Weather Forecast
• Wave Height & Direction (NOAA data)
• Tide Information
• Wind Conditions
• Water Temperature

SUBSCRIPTION:
• Monthly: $5.00/month
• Annual: $50.00/year (save $10!)
• Cancel anytime

Created by local surfers for the Folly Beach community.
```

### Keywords
```
surf,folly beach,surf report,waves,surfing,drone,beach,ocean,weather,forecast,south carolina
```

### Review Notes
```
This app requires a subscription to access content.

Demo Account:
Email: reviewer@surfvista.com
Password: TestPassword123!

This account has an active subscription and can access all features.
The app displays surf reports and drone footage for Folly Beach, SC.
```

---

## 🎯 Critical Settings

### app.json
```json
{
  "expo": {
    "name": "SurfVista",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.anonymous.Natively"
    }
  }
}
```

### utils/superwallConfig.ts
```typescript
// ⚠️ REPLACE WITH YOUR PRODUCTION API KEYS
const REVENUECAT_API_KEY_IOS = 'appl_YOUR_KEY_HERE';
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_KEY_HERE';

// ✅ YOUR IDENTIFIERS (already configured)
PRODUCTS: {
  MONTHLY_SUBSCRIPTION: 'surfvista_monthly',  // ← YOUR PRODUCT ID
  ANNUAL_SUBSCRIPTION: 'surfvista_annual',    // ← YOUR PRODUCT ID
},
OFFERING_IDS: ['ofrnge7bdc97106', 'default'], // ← YOUR OFFERING IDs
ENTITLEMENT_ID: 'premium',                    // ← YOUR ENTITLEMENT ID
```

---

## ✅ Pre-Submit Checklist

### RevenueCat Configuration
- [ ] API key updated (production, not test)
- [ ] Products created with IDs: `surfvista_monthly`, `surfvista_annual`
- [ ] Entitlement created with ID: `premium`
- [ ] Offering created with ID: `ofrnge7bdc97106` or `default`
- [ ] Products attached to entitlement
- [ ] Products added to offering

### App Store Connect
- [ ] Products created: `surfvista_monthly`, `surfvista_annual`
- [ ] Pricing set: $5.00/month, $50.00/year
- [ ] Products submitted for review

### Testing
- [ ] Tested subscription with sandbox account
- [ ] Verified products load correctly
- [ ] Tested purchase flow
- [ ] Tested restore purchases
- [ ] Verified entitlement `premium` is granted

### App Store Submission
- [ ] Demo account created and works
- [ ] Privacy policy URL added
- [ ] 5 screenshots uploaded
- [ ] App description added
- [ ] Support email set
- [ ] Age rating: 4+
- [ ] Export compliance: No

---

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| Paywall not showing | Check API key is production (starts with `appl_` or `goog_`) |
| "No offerings found" | Verify offering `ofrnge7bdc97106` or `default` exists |
| "Product not found" | Verify product IDs: `surfvista_monthly`, `surfvista_annual` |
| "Entitlement not found" | Verify entitlement ID: `premium` |
| Purchase fails | Use sandbox test account, not real Apple ID |
| Build fails | Run: `eas build --clear-cache` |
| "Missing privacy policy" | Add URL in App Store Connect |
| "Demo account needed" | Create reviewer@surfvista.com with active sub |

---

## 📊 Success Metrics

**Week 1:** 50-100 downloads, 10-20 subscribers
**Month 1:** 200-500 downloads, 50-100 subscribers, $250-500 revenue

---

## 🔗 Important Links

- **App Store Connect**: https://appstoreconnect.apple.com/
- **RevenueCat**: https://app.revenuecat.com/
- **Supabase**: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft
- **Build Status**: Check EAS CLI output for link

---

## 📞 Support

- **RevenueCat**: support@revenuecat.com
- **Apple**: 1-800-633-2152
- **Expo**: https://expo.dev/support

---

## ⏱️ Timeline

- **Configuration**: 3-4 hours (today)
- **Apple Review**: 1-3 days
- **Launch**: 2-4 days from now

---

## 🚀 Launch Day

1. Release app in App Store Connect
2. Upload 5-10 drone videos
3. Post on social media
4. Contact local surf shops
5. Monitor reviews and respond

---

## 🎯 Quick Identifier Reference

**Print this and keep it visible:**

```
═══════════════════════════════════════════════
  SURFVISTA REVENUECAT IDENTIFIERS
═══════════════════════════════════════════════

PRODUCT IDs (In-App Purchases):
  App Store Connect:  surfvista_monthly
  App Store Connect:  surfvista_annual
  RevenueCat:         surfvista_monthly
  RevenueCat:         surfvista_annual
  App Code:           surfvista_monthly ✅
  App Code:           surfvista_annual ✅

OFFERING ID:
  RevenueCat:         ofrnge7bdc97106 or default
  App Code:           ofrnge7bdc97106, default ✅

ENTITLEMENT ID:
  RevenueCat:         premium
  App Code:           premium ✅

PRICING:
  Monthly:            $5.00/month
  Annual:             $50.00/year

MUST MATCH EVERYWHERE!
═══════════════════════════════════════════════
```

---

**You're ready to launch!** 🏄‍♂️🌊

*Start with Step 1 (App Store Connect) - takes 30 minutes*

---

*Print this page and keep it handy during setup!*
