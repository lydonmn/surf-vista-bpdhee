
# SurfVista - One Page Launch Guide 📄

Everything you need to launch, on one page.

---

## ⚡ Quick Start (3 hours to submit)

### 1. App Store Connect (30 min)
```
→ https://appstoreconnect.apple.com/
→ Create app: "SurfVista"
→ Create subscription: surfvista_monthly ($10.99)
→ Submit for review
```

### 2. RevenueCat (20 min)
```
→ https://app.revenuecat.com/
→ Create project: "SurfVista"
→ Add product: surfvista_monthly
→ Create entitlement: premium
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
• Monthly: $10.99/month
• Annual: $100.99/year (save $30!)
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
const REVENUECAT_API_KEY_IOS = 'appl_YOUR_KEY_HERE'; // ← Update this!

PRODUCTS: {
  MONTHLY_SUBSCRIPTION: 'surfvista_monthly', // ← Must match App Store
},
ENTITLEMENT_ID: 'premium', // ← Must match RevenueCat
```

---

## ✅ Pre-Submit Checklist

- [ ] RevenueCat API key updated (production, not test)
- [ ] Products match: App Store ↔ RevenueCat ↔ Code
- [ ] Tested subscription with sandbox account
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
| Paywall not showing | Check API key is production (starts with `appl_`) |
| Purchase fails | Use sandbox test account, not real Apple ID |
| Build fails | Run: `eas build --clear-cache` |
| "Missing privacy policy" | Add URL in App Store Connect |
| "Demo account needed" | Create reviewer@surfvista.com with active sub |

---

## 📊 Success Metrics

**Week 1:** 50-100 downloads, 10-20 subscribers
**Month 1:** 200-500 downloads, 50-100 subscribers, $500-1000 revenue

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

**You're ready to launch!** 🏄‍♂️🌊

*Start with Step 1 (App Store Connect) - takes 30 minutes*

---

*Print this page and keep it handy during setup!*
