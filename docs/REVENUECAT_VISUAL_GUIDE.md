
# RevenueCat Visual Setup Guide

This guide shows you exactly where to find and configure everything for RevenueCat integration.

## 1. RevenueCat Dashboard Setup

### Creating Your App

```
RevenueCat Dashboard
└── Projects
    └── [+ New App]
        ├── App Name: SurfVista
        ├── Bundle ID (iOS): com.anonymous.Natively
        └── Package Name (Android): com.anonymous.Natively
```

### Adding Products

```
RevenueCat Dashboard
└── Your App
    └── Products
        └── [+ New]
            ├── Product ID: com.anonymous.Natively.monthly
            ├── Store: iOS App Store
            └── [Save]
        └── [+ New]
            ├── Product ID: com.anonymous.Natively.annual
            ├── Store: iOS App Store
            └── [Save]
        └── [+ New]
            ├── Product ID: com.anonymous.Natively.monthly
            ├── Store: Google Play Store
            └── [Save]
        └── [+ New]
            ├── Product ID: com.anonymous.Natively.annual
            ├── Store: Google Play Store
            └── [Save]
```

### Creating Offering

```
RevenueCat Dashboard
└── Your App
    └── Offerings
        └── [+ New Offering]
            ├── Identifier: default
            ├── Description: Default offering
            └── Packages:
                ├── [+ Add Package]
                │   ├── Type: Monthly
                │   └── Product: com.anonymous.Natively.monthly
                └── [+ Add Package]
                    ├── Type: Annual
                    └── Product: com.anonymous.Natively.annual
            └── [Make Current]
```

### Getting API Keys

```
RevenueCat Dashboard
└── Settings
    └── API Keys
        ├── iOS API Key: appl_xxxxxxxxxxxxxxxx
        └── Android API Key: goog_xxxxxxxxxxxxxxxx
```

## 2. App Store Connect Setup (iOS)

### Creating Subscriptions

```
App Store Connect
└── My Apps
    └── [Your App]
        └── Features
            └── In-App Purchases
                └── [+] Add Subscription
                    ├── Type: Auto-Renewable Subscription
                    └── Subscription Group: [Create New]
                        └── Name: SurfVista Subscriptions
                
                └── Monthly Subscription
                    ├── Product ID: com.anonymous.Natively.monthly
                    ├── Reference Name: SurfVista Monthly
                    ├── Subscription Duration: 1 Month
                    ├── Price: $4.99
                    └── [Submit for Review]
                
                └── Annual Subscription
                    ├── Product ID: com.anonymous.Natively.annual
                    ├── Reference Name: SurfVista Annual
                    ├── Subscription Duration: 1 Year
                    ├── Price: $49.99
                    └── [Submit for Review]
```

### Creating Sandbox Testers

```
App Store Connect
└── Users and Access
    └── Sandbox
        └── Testers
            └── [+] Add Tester
                ├── First Name: Test
                ├── Last Name: User
                ├── Email: test@example.com
                └── Password: [Create Password]
```

## 3. Google Play Console Setup (Android)

### Creating Subscriptions

```
Google Play Console
└── All Apps
    └── [Your App]
        └── Monetize
            └── Subscriptions
                └── [Create subscription]
                    
                    └── Monthly Subscription
                        ├── Product ID: com.anonymous.Natively.monthly
                        ├── Name: SurfVista Monthly
                        ├── Description: Monthly access to exclusive surf reports
                        ├── Billing period: 1 Month
                        ├── Price: $4.99 USD
                        └── [Activate]
                    
                    └── Annual Subscription
                        ├── Product ID: com.anonymous.Natively.annual
                        ├── Name: SurfVista Annual
                        ├── Description: Annual access to exclusive surf reports
                        ├── Billing period: 1 Year
                        ├── Price: $49.99 USD
                        └── [Activate]
```

### Adding License Testers

```
Google Play Console
└── All Apps
    └── [Your App]
        └── Setup
            └── License testing
                └── License testers
                    └── [Add email addresses]
                        └── test@example.com
```

## 4. Code Configuration

### File: `utils/superwallConfig.ts`

```typescript
// Line 28-29: Replace these with your actual API keys
const REVENUECAT_API_KEY_IOS = 'appl_xxxxxxxxxxxxxxxx';     // ← Paste iOS key here
const REVENUECAT_API_KEY_ANDROID = 'goog_xxxxxxxxxxxxxxxx'; // ← Paste Android key here

// Lines 37-38: Product IDs (already configured)
MONTHLY_PRODUCT_ID: 'com.anonymous.Natively.monthly',  // ✓ Matches stores
ANNUAL_PRODUCT_ID: 'com.anonymous.Natively.annual',    // ✓ Matches stores
```

## 5. Testing Flow

### iOS Testing Setup

```
iPhone/iPad
└── Settings
    └── App Store
        └── Sandbox Account
            └── [Sign In]
                ├── Apple ID: test@example.com
                └── Password: [Your sandbox password]
```

### Android Testing Setup

```
Android Device
└── Google Play Store
    └── [Menu]
        └── Settings
            └── Account
                └── [Sign in with test account]
```

### In-App Testing

```
Your App
└── Login Screen
    └── [Subscribe Monthly] or [Subscribe Annual]
        └── App Store/Play Store Payment Sheet
            └── [Confirm Purchase]
                └── Success! ✓
                    └── Profile Screen
                        └── Subscription Status: Active ✓
```

## 6. Verification Checklist

### Console Logs to Look For

```
✓ [Payment] 🚀 Initializing RevenueCat...
✓ [Payment] ✅ RevenueCat initialized successfully
✓ [Payment] 📦 Available offerings: default
✓ [Payment] 📦 Available packages: 2
✓ [Payment]   - monthly: $4.99
✓ [Payment]   - annual: $49.99
✓ [Payment] 🛒 Starting purchase...
✓ [Payment] ✅ Purchase successful!
✓ [Payment] 💾 Updating Supabase profile...
✓ [Payment] ✅ Supabase profile updated
```

### Profile Screen Verification

```
Profile Screen
└── Subscription Status
    ├── Status: Active ✓
    ├── Renews: [Date]
    └── [Manage Subscription] button visible
```

## 7. File Structure

```
your-app/
├── utils/
│   └── superwallConfig.ts          ← Update API keys here
├── contexts/
│   └── AuthContext.tsx             ← Handles subscription state
├── app/
│   ├── login.tsx                   ← Subscribe buttons
│   └── (tabs)/
│       └── profile.tsx             ← Subscription status
└── docs/
    ├── REVENUECAT_LINKING_GUIDE.md      ← Detailed guide
    ├── REVENUECAT_SETUP_CHECKLIST.md    ← Quick checklist
    └── REVENUECAT_VISUAL_GUIDE.md       ← This file
```

## 8. Quick Start Commands

```bash
# 1. Update API keys in utils/superwallConfig.ts
# 2. Restart the app with cache clear
npx expo start -c

# 3. Test on iOS
npx expo start --ios

# 4. Test on Android
npx expo start --android
```

## 9. Troubleshooting Map

```
Issue: "Payment system is not configured"
└── Solution Path:
    ├── Open: utils/superwallConfig.ts
    ├── Find: Lines 28-29
    ├── Replace: 'YOUR_IOS_API_KEY_HERE' with actual key
    └── Restart: npx expo start -c

Issue: "No subscription packages available"
└── Solution Path:
    ├── Open: RevenueCat Dashboard
    ├── Go to: Offerings
    ├── Verify: Default offering exists
    ├── Verify: Packages are added
    └── Set: Offering as "Current"

Issue: "Product not found"
└── Solution Path:
    ├── Verify: App Store Connect product ID
    ├── Verify: Google Play Console product ID
    ├── Verify: RevenueCat product ID
    └── Ensure: All match exactly
```

## 10. Support Resources

```
Documentation:
├── RevenueCat Docs: https://docs.revenuecat.com/
├── Apple Docs: https://developer.apple.com/in-app-purchase/
└── Google Docs: https://developer.android.com/google/play/billing

Community:
├── RevenueCat Community: https://community.revenuecat.com/
├── Stack Overflow: [revenuecat] tag
└── GitHub Issues: https://github.com/RevenueCat/react-native-purchases

Your Project Docs:
├── REVENUECAT_LINKING_GUIDE.md      ← Detailed setup guide
├── REVENUECAT_SETUP_CHECKLIST.md    ← Step-by-step checklist
└── REVENUECAT_VISUAL_GUIDE.md       ← This visual guide
```

## Summary

Your app is **already configured** to work with RevenueCat. You just need to:

1. ✅ Create products in App Store Connect/Google Play Console
2. ✅ Add products to RevenueCat dashboard
3. ✅ Create an offering in RevenueCat
4. ✅ Copy API keys from RevenueCat
5. ✅ Paste API keys into `utils/superwallConfig.ts` (lines 28-29)
6. ✅ Restart the app
7. ✅ Test with sandbox accounts

The purchase flow, subscription checking, and UI are all ready to go!
