
# SurfVista Quick Launch Checklist ✅

Print this out and check off items as you complete them!

---

## ☑️ Phase 1: App Store Connect (30 min)

- [ ] Log in to https://appstoreconnect.apple.com/
- [ ] Create new app: "SurfVista"
- [ ] Bundle ID: com.anonymous.Natively
- [ ] Category: Sports
- [ ] Create monthly subscription:
  - [ ] Product ID: `surfvista_monthly`
  - [ ] Price: $10.99
  - [ ] Duration: 1 Month
- [ ] Create annual subscription (optional):
  - [ ] Product ID: `surfvista_annual`
  - [ ] Price: $100.99
  - [ ] Duration: 1 Year
- [ ] Submit subscriptions for review

---

## ☑️ Phase 2: RevenueCat (20 min)

- [ ] Sign up at https://app.revenuecat.com/
- [ ] Create project: "SurfVista"
- [ ] Generate App Store Connect API key
- [ ] Upload API key to RevenueCat
- [ ] Add products:
  - [ ] `surfvista_monthly`
  - [ ] `surfvista_annual`
- [ ] Create entitlement: `premium`
- [ ] Create offering: "default"
- [ ] Copy iOS API key
- [ ] Update `utils/superwallConfig.ts` with API key
- [ ] Restart app

---

## ☑️ Phase 3: Test Subscription (15 min)

- [ ] Create sandbox test account in App Store Connect
- [ ] Sign out of Apple ID on test device
- [ ] Run app: `npm run ios`
- [ ] Try to subscribe
- [ ] Sign in with sandbox account
- [ ] Complete test purchase
- [ ] Verify subscription activates
- [ ] Test "Restore Purchases"
- [ ] Check RevenueCat dashboard

---

## ☑️ Phase 4: App Store Assets (1-2 hours)

- [ ] Create app icon (1024x1024 PNG)
- [ ] Take 5 screenshots:
  - [ ] Home screen
  - [ ] Video player
  - [ ] Surf report
  - [ ] Videos library
  - [ ] Subscription screen
- [ ] Write app description
- [ ] Choose keywords
- [ ] Create privacy policy
- [ ] Set up support URL/email

---

## ☑️ Phase 5: Build & Submit (30 min)

- [ ] Install EAS CLI: `npm install -g eas-cli`
- [ ] Login: `eas login`
- [ ] Configure: `eas build:configure`
- [ ] Build: `eas build --platform ios --profile production`
- [ ] Wait for build (~20 min)
- [ ] Submit: `eas submit --platform ios`
- [ ] Upload screenshots to App Store Connect
- [ ] Add app description and keywords
- [ ] Add privacy policy URL
- [ ] Create demo account for Apple reviewers
- [ ] Submit for review

---

## ☑️ Phase 6: While Waiting (1-3 days)

- [ ] Record 5-10 drone videos
- [ ] Create Instagram account
- [ ] Create Facebook page
- [ ] Design promotional graphics
- [ ] Contact local surf shops
- [ ] Post in Folly Beach groups
- [ ] Monitor review status daily

---

## ☑️ Phase 7: Launch Day! 🚀

- [ ] Release app in App Store Connect
- [ ] Upload initial videos
- [ ] Test everything
- [ ] Announce on social media
- [ ] Email friends and family
- [ ] Post in local groups
- [ ] Monitor for issues
- [ ] Respond to reviews

---

## 📊 Success Metrics

**Week 1 Goals:**
- Downloads: 50-100
- Subscribers: 10-20
- Conversion: 15-20%

**Month 1 Goals:**
- Downloads: 200-500
- Subscribers: 50-100
- Revenue: $500-1000

---

## 🆘 Emergency Contacts

**RevenueCat Issues:**
- Dashboard: https://app.revenuecat.com/
- Support: support@revenuecat.com

**App Store Issues:**
- Connect: https://appstoreconnect.apple.com/
- Support: https://developer.apple.com/support/

**App Issues:**
- Check console logs
- Check Supabase dashboard
- Review docs in `docs/` folder

---

## ⏱️ Time Estimate

- **Configuration**: 3-4 hours
- **Apple Review**: 1-3 days
- **Total to Launch**: 2-4 days

---

## 🎯 Current Status

**Started**: ___/___/___

**Phases Complete**: ___ / 7

**Submitted to Apple**: ___/___/___

**Approved**: ___/___/___

**Launched**: ___/___/___

---

## 📝 Notes

Use this space for important info:

**RevenueCat API Key:**
```
appl_________________________________
```

**Demo Account for Apple:**
```
Email: _______________________________
Password: ____________________________
```

**Support Email:**
```
_____________________________________
```

**Privacy Policy URL:**
```
_____________________________________
```

---

**You've got this!** 🏄‍♂️🌊

*Keep this checklist handy and check off items as you go!*
