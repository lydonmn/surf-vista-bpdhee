
# Superwall Setup Checklist

Use this checklist to track your progress setting up Superwall subscriptions.

## Phase 1: Initial Setup ⚙️

- [ ] Created Superwall account at https://superwall.com
- [ ] Created new app in Superwall dashboard
- [ ] Copied Public API Key (starts with `pk_`)
- [ ] Updated `SUPERWALL_API_KEY` in `utils/superwallConfig.ts`
- [ ] Restarted development server
- [ ] Verified configuration in console logs (should see ✅ Configured)

## Phase 2: Paywall Configuration 🎨

- [ ] Created paywall in Superwall dashboard
- [ ] Set Paywall ID to: `subscription_paywall`
- [ ] Customized paywall design and copy
- [ ] Added features list:
  - [ ] 6K resolution drone videos
  - [ ] Daily surf condition reports
  - [ ] 7-day weather forecasts
  - [ ] Exclusive Folly Beach content
- [ ] Set call-to-action button text
- [ ] Published paywall (not draft)

## Phase 3: Product Configuration 📦

### iOS (App Store Connect)

- [ ] Logged into App Store Connect
- [ ] Created subscription product
- [ ] Set Product ID: `com.surfvista.monthly`
- [ ] Set price: $4.99 USD
- [ ] Set duration: 1 month
- [ ] Added localized descriptions
- [ ] Submitted for review
- [ ] Product approved ✅

### Android (Google Play Console)

- [ ] Logged into Google Play Console
- [ ] Created subscription product
- [ ] Set Product ID: `com.surfvista.monthly`
- [ ] Set price: $4.99 USD
- [ ] Set billing period: 1 month
- [ ] Added description
- [ ] Activated product ✅

### Superwall Dashboard

- [ ] Added product in Superwall
- [ ] Product ID matches: `com.surfvista.monthly`
- [ ] Set display name: "SurfVista Monthly"
- [ ] Set price display: "$5/month"
- [ ] Added product to paywall
- [ ] Saved and published

## Phase 4: Sandbox Testing 🧪

### iOS Testing

- [ ] Created sandbox tester account in App Store Connect
- [ ] Signed out of production Apple ID on test device
- [ ] Installed app on test device
- [ ] Tested sign up flow
- [ ] Tested subscription purchase
- [ ] Verified subscription activated in app
- [ ] Tested content access after purchase
- [ ] Tested "Restore Purchases" button
- [ ] Tested subscription on second device
- [ ] Tested subscription renewal (wait 5 min in sandbox)

### Android Testing

- [ ] Added test account in Google Play Console
- [ ] Installed app via internal testing
- [ ] Tested sign up flow
- [ ] Tested subscription purchase
- [ ] Verified subscription activated
- [ ] Tested content access
- [ ] Tested "Restore Purchases"
- [ ] Tested on second device

## Phase 5: User Experience Testing 👥

- [ ] Tested login screen subscribe button
- [ ] Tested profile screen subscribe button
- [ ] Tested paywall appearance and design
- [ ] Tested purchase flow smoothness
- [ ] Tested error messages
- [ ] Tested "Manage Subscription" button
- [ ] Tested "Refresh Profile Data" button
- [ ] Tested subscription status display
- [ ] Tested content locking for non-subscribers
- [ ] Tested admin bypass (admin always has access)

## Phase 6: Edge Cases 🔍

- [ ] Tested with no internet connection
- [ ] Tested with poor internet connection
- [ ] Tested purchase cancellation
- [ ] Tested expired subscription
- [ ] Tested restore with no purchases
- [ ] Tested restore with expired subscription
- [ ] Tested multiple rapid purchase attempts
- [ ] Tested app restart after purchase
- [ ] Tested sign out and sign in after purchase

## Phase 7: Production Preparation 🚀

- [ ] All sandbox tests passing
- [ ] Products approved in both app stores
- [ ] Privacy policy includes subscription terms
- [ ] Terms of service updated
- [ ] Refund policy documented
- [ ] Support email configured
- [ ] Verified API key is production key (not test)
- [ ] Reviewed Superwall analytics setup
- [ ] Set up monitoring alerts

## Phase 8: Production Deployment 📱

- [ ] Built production iOS app
- [ ] Built production Android app
- [ ] Submitted iOS app to App Store
- [ ] Submitted Android app to Google Play
- [ ] iOS app approved and live
- [ ] Android app approved and live
- [ ] Tested production purchase on iOS
- [ ] Tested production purchase on Android
- [ ] Verified analytics in Superwall dashboard
- [ ] Verified revenue tracking

## Phase 9: Post-Launch Monitoring 📊

- [ ] Monitor Superwall dashboard daily (first week)
- [ ] Check conversion rates
- [ ] Review error logs
- [ ] Monitor customer support requests
- [ ] Track subscription renewals
- [ ] Track cancellation rates
- [ ] Analyze user feedback
- [ ] Optimize paywall based on data

## Phase 10: Optimization 📈

- [ ] A/B test different paywall designs
- [ ] Test different pricing points
- [ ] Optimize paywall copy
- [ ] Add promotional offers
- [ ] Implement free trial (optional)
- [ ] Add annual subscription option (optional)
- [ ] Improve onboarding flow
- [ ] Reduce friction in purchase flow

## Common Issues & Solutions 🔧

### Issue: Paywall doesn't appear
- [ ] Verified API key is correct
- [ ] Checked paywall ID matches `subscription_paywall`
- [ ] Confirmed paywall is published (not draft)
- [ ] Checked console logs for errors

### Issue: Purchase doesn't activate
- [ ] Checked console logs for purchase handler errors
- [ ] Verified Supabase connection
- [ ] Tried "Refresh Profile Data"
- [ ] Tried "Restore Purchases"

### Issue: Restore purchases fails
- [ ] Verified using same Apple ID/Google account
- [ ] Checked subscription status in device settings
- [ ] Confirmed subscription is still active
- [ ] Verified app bundle ID matches

## Resources 📚

- Superwall Dashboard: https://superwall.com/dashboard
- Superwall Docs: https://docs.superwall.com
- App Store Connect: https://appstoreconnect.apple.com
- Google Play Console: https://play.google.com/console
- Support Email: support@superwall.com

## Notes 📝

Use this space to track any issues, questions, or observations:

```
Date: ___________
Issue: 
Solution:

Date: ___________
Issue:
Solution:

Date: ___________
Issue:
Solution:
```

---

**Progress Tracker:**
- Phase 1: ⬜ Not Started | 🟡 In Progress | ✅ Complete
- Phase 2: ⬜ Not Started | 🟡 In Progress | ✅ Complete
- Phase 3: ⬜ Not Started | 🟡 In Progress | ✅ Complete
- Phase 4: ⬜ Not Started | 🟡 In Progress | ✅ Complete
- Phase 5: ⬜ Not Started | 🟡 In Progress | ✅ Complete
- Phase 6: ⬜ Not Started | 🟡 In Progress | ✅ Complete
- Phase 7: ⬜ Not Started | 🟡 In Progress | ✅ Complete
- Phase 8: ⬜ Not Started | 🟡 In Progress | ✅ Complete
- Phase 9: ⬜ Not Started | 🟡 In Progress | ✅ Complete
- Phase 10: ⬜ Not Started | 🟡 In Progress | ✅ Complete

**Overall Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete
