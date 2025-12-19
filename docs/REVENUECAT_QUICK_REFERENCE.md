
# RevenueCat Quick Reference - SurfVista

## 🎯 YOUR SURFVISTA IDENTIFIERS

**These are YOUR specific RevenueCat identifiers already configured in the app:**

### Product IDs (In-App Purchase IDs)
```
surfvista_monthly    - Monthly Subscription ($5/month)
surfvista_annual     - Annual Subscription ($50/year)
monthly              - Alternative monthly ID
yearly               - Alternative annual ID
```

### Offering ID
```
ofrnge7bdc97106      - Your primary offering ID
default              - Fallback offering ID
```

### Entitlement ID
```
premium              - SurfVista Pro access
```

**⚠️ CRITICAL**: These identifiers MUST match exactly in:
- ✅ App Store Connect (iOS)
- ✅ Google Play Console (Android)
- ✅ RevenueCat Dashboard
- ✅ Your app code (already configured)

---

## Quick Links

- **RevenueCat Dashboard**: https://app.revenuecat.com/
- **Documentation**: https://www.revenuecat.com/docs
- **Expo Guide**: https://www.revenuecat.com/docs/getting-started/installation/expo

## Configuration File

All RevenueCat configuration is in: `utils/superwallConfig.ts`

## Key Functions

### Initialize RevenueCat
```typescript
import { initializeRevenueCat } from '@/utils/superwallConfig';

await initializeRevenueCat();
```

### Present Paywall
```typescript
import { presentPaywall } from '@/utils/superwallConfig';

const result = await presentPaywall(userId, userEmail);
// result.state: 'purchased' | 'restored' | 'declined' | 'error'
```

### Present Customer Center
```typescript
import { presentCustomerCenter } from '@/utils/superwallConfig';

await presentCustomerCenter();
```

### Restore Purchases
```typescript
import { restorePurchases } from '@/utils/superwallConfig';

const result = await restorePurchases();
// result.success: boolean
// result.state: 'restored' | 'none'
```

### Check Entitlements
```typescript
import { checkEntitlements } from '@/utils/superwallConfig';

const hasAccess = await checkEntitlements();
// Returns: boolean (checks for 'premium' entitlement)
```

### Get Customer Info
```typescript
import { getCustomerInfo } from '@/utils/superwallConfig';

const customerInfo = await getCustomerInfo();
// Returns: CustomerInfo | null
```

### Check Subscription Status
```typescript
import { checkSubscriptionStatus } from '@/utils/superwallConfig';

const status = await checkSubscriptionStatus(userId);
// Returns: { isActive: boolean, endDate: string | null }
```

## Setup Checklist

### 1. App Store Connect (iOS)
- [ ] Create product: `surfvista_monthly`
- [ ] Create product: `surfvista_annual`
- [ ] Set pricing: $5/month, $50/year
- [ ] Submit for review

### 2. Google Play Console (Android)
- [ ] Create subscription: `surfvista_monthly`
- [ ] Create subscription: `surfvista_annual`
- [ ] Set pricing: $5/month, $50/year
- [ ] Activate subscriptions

### 3. RevenueCat Dashboard
- [ ] Add products: `surfvista_monthly`, `surfvista_annual`
- [ ] Create entitlement: `premium`
- [ ] Create offering: `ofrnge7bdc97106` or `default`
- [ ] Attach products to entitlement
- [ ] Add products to offering
- [ ] Configure paywall (optional)

### 4. App Configuration
- [ ] Update API keys in `utils/superwallConfig.ts`
- [ ] Verify product IDs match
- [ ] Verify offering ID matches
- [ ] Verify entitlement ID matches
- [ ] Test in sandbox mode

## API Keys

### Current (Test Key)
```
test_pIbMwlfINrGOjQfGWYzmARWVOvg
```

⚠️ **This is a TEST key - paywalls will NOT present!**

### Production Keys
Get from: https://app.revenuecat.com/settings/api-keys

Replace in `utils/superwallConfig.ts`:
```typescript
const REVENUECAT_API_KEY_IOS = 'appl_YOUR_IOS_KEY_HERE';
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_ANDROID_KEY_HERE';
```

## Testing

### iOS Sandbox
1. Settings > App Store > Sandbox Account
2. Sign in with sandbox Apple ID
3. Test purchases are free
4. Use product IDs: `surfvista_monthly`, `surfvista_annual`

### Android Testing
1. Google Play Console > License Testing
2. Add test account
3. Test purchases are free
4. Use product IDs: `surfvista_monthly`, `surfvista_annual`

## Common Issues

### "No products available"
**Cause**: Products not configured or not synced
**Solution**:
1. Verify products exist in App Store Connect/Google Play with IDs: `surfvista_monthly`, `surfvista_annual`
2. Verify products added to RevenueCat with same IDs
3. Verify products linked to offering `ofrnge7bdc97106` or `default`
4. Wait a few minutes for sync

### "Payment system not initialized"
**Cause**: RevenueCat not initialized or API key invalid
**Solution**:
1. Check console logs for initialization errors
2. Verify API key is correct (production key, not test)
3. Restart the app

### "No offerings found"
**Cause**: Offering not configured
**Solution**:
1. Create offering with ID: `ofrnge7bdc97106` or `default`
2. Add products to offering
3. Set offering as "Current"
4. Wait for sync

### "Entitlement not found"
**Cause**: Entitlement not configured or wrong ID
**Solution**:
1. Create entitlement with ID: `premium`
2. Attach products to entitlement
3. Verify entitlement ID in code matches

### "Restore purchases failed"
**Cause**: No previous purchases or wrong account
**Solution**:
1. Ensure user has made a purchase
2. Check user is signed in with same account
3. Verify subscription hasn't expired

## Dashboard Setup Steps

1. **Products**: Add `surfvista_monthly` and `surfvista_annual`
2. **Entitlements**: Create `premium` entitlement
3. **Offerings**: Create `ofrnge7bdc97106` or `default` offering
4. **Paywalls**: Design your paywall (optional)
5. **Customer Center**: Configure support info

## Where Features Are Used

### Paywall
- Profile screen: "Subscribe Now" button
- Login screen: After successful login (optional)

### Customer Center
- Profile screen: "Manage Subscription" button

### Restore Purchases
- Profile screen: "Restore Purchases" button

### Entitlement Check
- AuthContext: `checkSubscription()` function
- Used throughout app to gate premium content
- Checks for `premium` entitlement

## Pricing

- **Monthly**: $5.00/month (`surfvista_monthly`)
- **Annual**: $50.00/year (`surfvista_annual`)

Configure in App Store Connect / Google Play Console

## Configuration Summary

```typescript
// utils/superwallConfig.ts

PRODUCTS: {
  MONTHLY_SUBSCRIPTION: 'surfvista_monthly',  // ← YOUR PRODUCT ID
  ANNUAL_SUBSCRIPTION: 'surfvista_annual',    // ← YOUR PRODUCT ID
  MONTHLY: 'monthly',                         // ← ALTERNATIVE ID
  YEARLY: 'yearly',                           // ← ALTERNATIVE ID
}

OFFERING_IDS: ['ofrnge7bdc97106', 'default'], // ← YOUR OFFERING IDs

ENTITLEMENT_ID: 'premium',                    // ← YOUR ENTITLEMENT ID
```

## Print-Friendly Cheat Sheet

```
═══════════════════════════════════════════════
  SURFVISTA REVENUECAT CONFIGURATION
═══════════════════════════════════════════════

PRODUCT IDs (In-App Purchases):
  • surfvista_monthly
  • surfvista_annual
  • monthly (alternative)
  • yearly (alternative)

OFFERING ID:
  • ofrnge7bdc97106 (primary)
  • default (fallback)

ENTITLEMENT ID:
  • premium

MUST MATCH IN:
  ✓ App Store Connect
  ✓ Google Play Console
  ✓ RevenueCat Dashboard
  ✓ App Code (utils/superwallConfig.ts)

PRICING:
  • Monthly: $5.00/month
  • Annual: $50.00/year

API KEYS LOCATION:
  • utils/superwallConfig.ts
  • Lines 40-41

DASHBOARD:
  • https://app.revenuecat.com/

═══════════════════════════════════════════════
```

## Support

- **Email**: support@revenuecat.com
- **Community**: https://community.revenuecat.com/
- **Docs**: https://www.revenuecat.com/docs
