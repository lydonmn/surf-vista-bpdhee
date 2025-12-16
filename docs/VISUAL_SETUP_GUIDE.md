
# Visual Setup Guide

## 🎯 Quick Visual Reference

This guide shows you exactly where to click and what to configure.

---

## 1️⃣ RevenueCat Dashboard Setup

### Products Page
```
RevenueCat Dashboard
├── Products (left sidebar)
│   ├── Click "+ Add Product"
│   ├── Add: surfvista_monthly
│   ├── Add: surfvista_annual
│   ├── Add: monthly
│   └── Add: yearly
```

### Entitlements Page
```
RevenueCat Dashboard
├── Entitlements (left sidebar)
│   ├── Click "+ Create Entitlement"
│   ├── Identifier: premium
│   ├── Display Name: SurfVista Pro
│   └── Attach all products
```

### Offerings Page
```
RevenueCat Dashboard
├── Offerings (left sidebar)
│   ├── Click "+ Create Offering" or use default
│   ├── Add Monthly Package
│   │   └── Select: surfvista_monthly
│   ├── Add Annual Package
│   │   └── Select: surfvista_annual
│   └── Set as current offering
```

### Paywalls Page
```
RevenueCat Dashboard
├── Paywalls (left sidebar)
│   ├── Click "+ Create Paywall"
│   ├── Design Tab
│   │   ├── Add logo
│   │   ├── Set colors
│   │   ├── Add features list
│   │   └── Configure pricing display
│   ├── Link to offering
│   └── Publish
```

### Customer Center Page
```
RevenueCat Dashboard
├── Customer Center (left sidebar)
│   ├── Enable Customer Center
│   ├── Support Email: your@email.com
│   ├── Privacy Policy URL: (optional)
│   ├── Terms of Service URL: (optional)
│   └── Save
```

---

## 2️⃣ App Store Connect Setup (iOS)

### Navigation Path
```
App Store Connect
├── My Apps
│   ├── Select: SurfVista
│   ├── Features Tab
│   │   └── In-App Purchases
│   │       ├── Click "+"
│   │       ├── Select: Auto-Renewable Subscription
│   │       └── Create subscriptions
```

### Monthly Subscription Form
```
Create Subscription
├── Product ID: surfvista_monthly
├── Reference Name: SurfVista Monthly
├── Subscription Group: (create or select)
├── Subscription Duration: 1 month
├── Price: $4.99
├── Localization
│   ├── Display Name: SurfVista Monthly
│   └── Description: Access to exclusive surf reports
└── Submit for Review
```

### Annual Subscription Form
```
Create Subscription
├── Product ID: surfvista_annual
├── Reference Name: SurfVista Annual
├── Subscription Group: (same as monthly)
├── Subscription Duration: 1 year
├── Price: $49.99
├── Localization
│   ├── Display Name: SurfVista Annual
│   └── Description: Access to exclusive surf reports
└── Submit for Review
```

---

## 3️⃣ Google Play Console Setup (Android)

### Navigation Path
```
Google Play Console
├── All Apps
│   ├── Select: SurfVista
│   ├── Monetize (left sidebar)
│   │   └── Subscriptions
│   │       ├── Click "Create subscription"
│   │       └── Fill in details
```

### Monthly Subscription Form
```
Create Subscription
├── Product ID: surfvista_monthly
├── Name: SurfVista Monthly
├── Description: Access to exclusive surf reports
├── Billing Period: 1 month
├── Price: $4.99
├── Free Trial: (optional)
│   ├── Duration: 7 days (if offering)
│   └── Enable/Disable
└── Activate
```

### Annual Subscription Form
```
Create Subscription
├── Product ID: surfvista_annual
├── Name: SurfVista Annual
├── Description: Access to exclusive surf reports
├── Billing Period: 1 year
├── Price: $49.99
├── Free Trial: (optional)
│   ├── Duration: 7 days (if offering)
│   └── Enable/Disable
└── Activate
```

---

## 4️⃣ Linking Stores to RevenueCat

### iOS (App Store Connect)
```
RevenueCat Dashboard
├── App Settings (gear icon)
│   ├── Service Credentials
│   │   ├── iOS
│   │   │   ├── Click "Add Credentials"
│   │   │   ├── Follow wizard:
│   │   │   │   ├── Generate API Key in App Store Connect
│   │   │   │   ├── Copy Issuer ID
│   │   │   │   ├── Copy Key ID
│   │   │   │   ├── Upload .p8 file
│   │   │   │   └── Save
│   │   │   └── Wait for sync (5-10 min)
```

### Android (Google Play Console)
```
RevenueCat Dashboard
├── App Settings (gear icon)
│   ├── Service Credentials
│   │   ├── Android
│   │   │   ├── Click "Add Credentials"
│   │   │   ├── Follow wizard:
│   │   │   │   ├── Create Service Account in Google Cloud
│   │   │   │   ├── Grant permissions
│   │   │   │   ├── Download JSON key
│   │   │   │   ├── Upload JSON to RevenueCat
│   │   │   │   └── Save
│   │   │   └── Wait for sync (5-10 min)
```

---

## 5️⃣ Testing Setup

### iOS Sandbox Testing
```
iOS Device
├── Settings
│   ├── App Store
│   │   ├── Sign Out (if signed in)
│   │   ├── Sandbox Account
│   │   │   └── Sign in with sandbox Apple ID
│   │   └── (created in App Store Connect)
```

### Android Test Account
```
Google Play Console
├── Setup (left sidebar)
│   ├── License Testing
│   │   ├── Add test account email
│   │   ├── Save
│   │   └── Sign in with this account on device
```

---

## 6️⃣ App Code Structure

### File Organization
```
SurfVista App
├── utils/
│   └── superwallConfig.ts ← RevenueCat configuration
├── contexts/
│   └── AuthContext.tsx ← User authentication + RevenueCat init
├── app/
│   ├── (tabs)/
│   │   └── profile.tsx ← Subscription management UI
│   └── login.tsx ← Login + optional paywall
└── docs/
    ├── REVENUECAT_INTEGRATION_COMPLETE.md
    ├── REVENUECAT_QUICK_REFERENCE.md
    ├── REVENUECAT_SETUP_CHECKLIST.md
    ├── NEXT_STEPS_NOW.md
    └── VISUAL_SETUP_GUIDE.md ← You are here
```

---

## 7️⃣ User Flow Diagram

### New User Journey
```
User Opens App
    ↓
Sign Up Screen
    ↓
Login Successful
    ↓
(Optional) Paywall Shown
    ↓
User Subscribes or Dismisses
    ↓
Home Screen
    ↓
Content Access Based on Subscription
```

### Subscription Management
```
User in App
    ↓
Profile Screen
    ↓
Tap "Manage Subscription"
    ↓
Customer Center Opens
    ↓
User Can:
├── View Details
├── Cancel
├── Change Plan
└── Contact Support
```

### Restore Purchases
```
User on New Device
    ↓
Sign In
    ↓
Profile Screen
    ↓
Tap "Restore Purchases"
    ↓
RevenueCat Checks App Store/Play Store
    ↓
Subscription Restored
    ↓
Access Granted
```

---

## 8️⃣ Configuration Checklist

### ✅ RevenueCat Dashboard
- [ ] Products added
- [ ] Entitlement created
- [ ] Offering configured
- [ ] Paywall designed
- [ ] Customer Center enabled

### ✅ App Store Connect
- [ ] Monthly subscription created
- [ ] Annual subscription created
- [ ] Subscriptions submitted for review
- [ ] Credentials linked to RevenueCat

### ✅ Google Play Console
- [ ] Monthly subscription created
- [ ] Annual subscription created
- [ ] Subscriptions activated
- [ ] Credentials linked to RevenueCat

### ✅ Testing
- [ ] iOS sandbox testing complete
- [ ] Android test account testing complete
- [ ] Paywall displays correctly
- [ ] Purchase flow works
- [ ] Restore purchases works
- [ ] Customer Center works

### ✅ Production
- [ ] Production API key updated in code
- [ ] App rebuilt with production key
- [ ] Final testing with real purchase
- [ ] App submitted to stores

---

## 9️⃣ Quick Reference URLs

### RevenueCat
- Dashboard: https://app.revenuecat.com/
- Docs: https://www.revenuecat.com/docs
- Support: support@revenuecat.com

### Apple
- App Store Connect: https://appstoreconnect.apple.com/
- Sandbox Accounts: App Store Connect > Users and Access > Sandbox Testers

### Google
- Play Console: https://play.google.com/console/
- Test Accounts: Play Console > Setup > License Testing

---

## 🎉 You're All Set!

Follow this guide step by step, and you'll have RevenueCat fully configured in about 1.5 hours!

**Remember**: The code is already done. You just need to configure the dashboards! 💪

---

**Last Updated**: January 2025
**App**: SurfVista
**Platform**: Expo 54 + React Native
