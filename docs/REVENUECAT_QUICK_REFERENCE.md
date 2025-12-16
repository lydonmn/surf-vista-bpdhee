
# RevenueCat Quick Reference

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
// Returns: boolean
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

## Product IDs

Configure these in App Store Connect / Google Play Console:

- `surfvista_monthly` - Monthly Subscription
- `surfvista_annual` - Annual Subscription
- `monthly` - Monthly (alternative)
- `yearly` - Yearly (alternative)

## Entitlement ID

- **ID**: `premium`
- **Name**: "SurfVista Pro"

## API Keys

### Test Key (Current)
```
test_pIbMwlfINrGOjQfGWYzmARWVOvg
```

### Production Key
Get from: https://app.revenuecat.com/settings/api-keys

Replace in `utils/superwallConfig.ts`:
```typescript
const REVENUECAT_API_KEY = 'YOUR_PRODUCTION_KEY_HERE';
```

## Testing

### iOS Sandbox
1. Settings > App Store > Sandbox Account
2. Sign in with sandbox Apple ID
3. Test purchases are free

### Android Testing
1. Google Play Console > License Testing
2. Add test account
3. Test purchases are free

## Common Issues

### "No products available"
- Check products are created in App Store Connect / Google Play Console
- Verify products are linked in RevenueCat dashboard
- Wait a few minutes for sync

### "Payment system not initialized"
- Check console logs for initialization errors
- Verify API key is correct
- Restart the app

### "Restore purchases failed"
- Ensure user has made a purchase
- Check user is signed in with same account
- Verify subscription hasn't expired

## Dashboard Setup Steps

1. **Products**: Add your subscription products
2. **Entitlements**: Create "premium" entitlement
3. **Offerings**: Create offering with packages
4. **Paywalls**: Design your paywall
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

## Pricing

- **Monthly**: $5.00/month
- **Annual**: Configure in App Store Connect / Google Play Console

## Support

- **Email**: support@revenuecat.com
- **Community**: https://community.revenuecat.com/
- **Docs**: https://www.revenuecat.com/docs
