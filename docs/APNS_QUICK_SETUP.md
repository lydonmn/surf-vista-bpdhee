
# APNs Quick Setup - 3 Steps

## Your Credentials
- **Key ID:** 7NNU2C52MT
- **Team ID:** BC32GC8XT5
- **Bundle ID:** Therealfollysurfreport.SurfVista

## Step 1: Save P8 Key File
Create `AuthKey_7NNU2C52MT.p8` with your private key content.

## Step 2: Upload to EAS Dashboard
1. Go to [expo.dev](https://expo.dev)
2. Open your SurfVista project
3. Navigate to **Credentials** → **iOS**
4. Click **Configure Push Notifications**
5. Upload:
   - Key ID: 7NNU2C52MT
   - Team ID: BC32GC8XT5
   - P8 File: AuthKey_7NNU2C52MT.p8

## Step 3: Build & Test
1. Create new iOS build in EAS Dashboard
2. Install on physical iOS device
3. Enable notifications in Profile screen
4. Test! 🎉

**Note:** Push notifications only work on physical devices, not in simulator.

---

Need help? See `APNS_CONFIGURATION_GUIDE.md` for detailed instructions.
