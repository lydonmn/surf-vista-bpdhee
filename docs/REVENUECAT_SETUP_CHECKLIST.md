
# RevenueCat Setup Checklist

Use this checklist to ensure your RevenueCat integration is properly configured.

## ✅ Pre-Setup

- [ ] RevenueCat account created
- [ ] App added to RevenueCat dashboard
- [ ] Bundle ID/Package Name configured

## ✅ Product Configuration

### App Store Connect (iOS)
- [ ] Monthly subscription created (`com.anonymous.Natively.monthly`)
- [ ] Annual subscription created (`com.anonymous.Natively.annual`)
- [ ] Subscription group created
- [ ] Prices set ($4.99/month, $49.99/year)
- [ ] Products submitted for review

### Google Play Console (Android)
- [ ] Monthly subscription created (`com.anonymous.Natively.monthly`)
- [ ] Annual subscription created (`com.anonymous.Natively.annual`)
- [ ] Prices set ($4.99/month, $49.99/year)
- [ ] Products activated

### RevenueCat Dashboard
- [ ] iOS monthly product added
- [ ] iOS annual product added
- [ ] Android monthly product added
- [ ] Android annual product added
- [ ] Default offering created
- [ ] Monthly package added to offering
- [ ] Annual package added to offering
- [ ] Offering set as "Current"

## ✅ API Keys

- [ ] iOS API key copied from RevenueCat
- [ ] Android API key copied from RevenueCat
- [ ] API keys updated in `utils/superwallConfig.ts`
- [ ] App restarted after updating keys

## ✅ Testing

### iOS Testing
- [ ] Sandbox Apple ID created in App Store Connect
- [ ] Signed in with sandbox account on device
- [ ] Monthly subscription purchase tested
- [ ] Annual subscription purchase tested
- [ ] Restore purchases tested
- [ ] Subscription shows in profile

### Android Testing
- [ ] Test account added to license testing
- [ ] Signed in with test account on device
- [ ] Monthly subscription purchase tested
- [ ] Annual subscription purchase tested
- [ ] Restore purchases tested
- [ ] Subscription shows in profile

## ✅ Verification

- [ ] Console logs show RevenueCat initialized
- [ ] Console logs show offerings loaded
- [ ] Console logs show packages available
- [ ] Purchase flow completes successfully
- [ ] Supabase profile updates with subscription
- [ ] User gains access to exclusive content
- [ ] Restore purchases works correctly

## ✅ Production Readiness

- [ ] All tests passing on iOS
- [ ] All tests passing on Android
- [ ] Subscription prices finalized
- [ ] Terms of service added
- [ ] Privacy policy updated
- [ ] App Store/Play Store listings updated
- [ ] Customer support process defined
- [ ] Refund policy documented

## Quick Reference

### Product IDs
```
Monthly: com.anonymous.Natively.monthly
Annual:  com.anonymous.Natively.annual
```

### Prices
```
Monthly: $4.99/month
Annual:  $49.99/year (save ~17%)
```

### API Key Locations
```
RevenueCat Dashboard: Settings > API Keys
Code: utils/superwallConfig.ts (lines 28-29)
```

### Test Accounts
```
iOS: Settings > App Store > Sandbox Account
Android: Play Console > Setup > License testing
```

## Common Issues

### ❌ "Payment system is not configured"
→ Update API keys in `utils/superwallConfig.ts`

### ❌ "No subscription packages available"
→ Create offering in RevenueCat dashboard

### ❌ "Product not found"
→ Verify product IDs match exactly

### ❌ Purchase fails
→ Use sandbox/test account

## Need Help?

1. Check console logs for detailed error messages
2. Review `docs/REVENUECAT_LINKING_GUIDE.md`
3. Visit [RevenueCat Documentation](https://docs.revenuecat.com/)
4. Check [RevenueCat Community](https://community.revenuecat.com/)
