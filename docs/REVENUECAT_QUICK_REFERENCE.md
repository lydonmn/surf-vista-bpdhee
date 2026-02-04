
# RevenueCat Quick Reference

## 🔑 Configuration

**API Key (Test):** `test_pOgVpdWTwmnVyqwEJWiaLTwHZsD`
**Products:** `monthly`, `yearly`
**Entitlement:** `SurfVista`

## 📱 Common Code Snippets

### Initialize SDK
```typescript
import { initializeRevenueCat } from '@/utils/superwallConfig';

// In app/_layout.tsx
useEffect(() => {
  initializeRevenueCat();
}, []);
```

### Show Paywall
```typescript
import { presentPaywall } from '@/utils/superwallConfig';

const result = await presentPaywall(userId, userEmail);
if (result.state === 'purchased') {
  console.log('Subscription successful!');
}
```

### Check Entitlement
```typescript
import { checkEntitlements } from '@/utils/superwallConfig';

const hasAccess = await checkEntitlements();
if (hasAccess) {
  // User has SurfVista entitlement
}
```

### Restore Purchases
```typescript
import { restorePurchases } from '@/utils/superwallConfig';

const result = await restorePurchases();
if (result.success) {
  console.log('Purchases restored!');
}
```

### Customer Center
```typescript
import { presentCustomerCenter } from '@/utils/superwallConfig';

await presentCustomerCenter();
```

### Get Customer Info
```typescript
import { getCustomerInfo } from '@/utils/superwallConfig';

const customerInfo = await getCustomerInfo();
console.log('Active entitlements:', customerInfo?.entitlements.active);
```

## 🔍 Debugging

### Check Configuration
```typescript
import { checkPaymentConfiguration } from '@/utils/superwallConfig';

const isConfigured = checkPaymentConfiguration();
// Check console for detailed status
```

### Check Initialization
```typescript
import { isPaymentSystemAvailable, getInitializationError } from '@/utils/superwallConfig';

if (!isPaymentSystemAvailable()) {
  const error = getInitializationError();
  console.log('Error:', error);
}
```

## 🚨 Common Issues

### "No offerings found"
```bash
# Check RevenueCat Dashboard:
1. Go to Offerings
2. Ensure offering exists
3. Click "Make Current"
4. Wait 5-10 minutes
5. Restart app
```

### "No products in offering"
```bash
# Check RevenueCat Dashboard:
1. Go to Products
2. Add products: monthly, yearly
3. Go to Offerings
4. Edit offering
5. Add both products
6. Save
```

### "Product IDs don't match"
```bash
# Verify all three match exactly:
App Store Connect: monthly, yearly
RevenueCat: monthly, yearly
Code: monthly, yearly
```

## 📊 Testing Checklist

- [ ] Products created in App Store Connect
- [ ] Products added to RevenueCat
- [ ] Offering created with both products
- [ ] Offering marked as "Current"
- [ ] Entitlement created (SurfVista)
- [ ] Paywall created and published
- [ ] Sandbox tester account created
- [ ] Test purchase on real device
- [ ] Test restore purchases
- [ ] Test Customer Center
- [ ] Verify entitlement checking works

## 🔗 Quick Links

- [RevenueCat Dashboard](https://app.revenuecat.com)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Full Setup Guide](./REVENUECAT_SETUP_GUIDE.md)

## 💡 Pro Tips

1. **Always test on real device** (not simulator)
2. **Use sandbox tester account** for testing
3. **Check console logs** for detailed errors
4. **Wait 5-10 minutes** after making changes in RevenueCat
5. **Restart app** after configuration changes
6. **Product IDs are case-sensitive** - use exact match
7. **Test restore purchases** on fresh install

## 🎯 Production Checklist

- [ ] Update to production API key
- [ ] Test with real Apple ID (not sandbox)
- [ ] Verify products are approved
- [ ] Test full purchase flow
- [ ] Test restore purchases
- [ ] Monitor RevenueCat Dashboard
- [ ] Set up webhooks (optional)
- [ ] Submit app for review
