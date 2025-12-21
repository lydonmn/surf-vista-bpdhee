
# Quick Fix Steps - Visual Guide

## 🚨 Current Problem
Your app shows: **"Edge Function returned a non-2xx status code"**

## ✅ Solution (5 Minutes)

### Step 1: Open Terminal
Open your terminal/command prompt in the project directory.

### Step 2: Deploy Edge Functions
Copy and paste these commands one at a time:

```bash
supabase functions deploy fetch-surf-reports
```
Wait for: ✅ **Deployed successfully**

```bash
supabase functions deploy fetch-weather-data
```
Wait for: ✅ **Deployed successfully**

```bash
supabase functions deploy fetch-tide-data
```
Wait for: ✅ **Deployed successfully**

```bash
supabase functions deploy generate-daily-report
```
Wait for: ✅ **Deployed successfully**

```bash
supabase functions deploy update-all-surf-data
```
Wait for: ✅ **Deployed successfully**

### Step 3: Test in App
1. Open SurfVista app
2. Go to **Report** tab
3. Tap **"Update All Data from NOAA"**
4. Wait 30-60 seconds
5. Pull down to refresh

### Step 4: Verify Success
You should see:
- ✅ No error message
- ✅ Today's surf report
- ✅ Wave height, wind, tide data
- ✅ Surf rating (1-10)

## 🎉 Done!

If you still see errors:
1. Wait 10 minutes (NOAA APIs may be slow)
2. Try "Update All Data" again
3. Check `docs/NOAA_DATA_ERROR_FIX.md` for detailed troubleshooting

## 📊 What Was Fixed

| Before | After |
|--------|-------|
| ❌ Functions hang forever | ✅ Timeout after 15 seconds |
| ❌ Generic error messages | ✅ Detailed error info |
| ❌ No retry logic | ✅ Automatic retries |
| ❌ Hard to debug | ✅ Detailed logging |

## 🔍 Need More Help?

- **Detailed Guide**: `docs/EDGE_FUNCTION_DEPLOYMENT_GUIDE.md`
- **Troubleshooting**: `docs/NOAA_DATA_ERROR_FIX.md`
- **Full Summary**: `docs/ERROR_FIX_SUMMARY.md`

## ⏰ Timeline

- **Now**: Deploy functions (5 min)
- **+5 min**: Test in app (2 min)
- **+7 min**: Verify success (1 min)
- **Total**: ~8 minutes

## 💡 Pro Tips

- Don't spam the update button (wait 30 seconds between clicks)
- NOAA APIs can be slow during peak hours
- Automatic updates happen every 15 minutes
- Check the debug page for detailed diagnostics

---

**Last Updated**: January 21, 2025
**Status**: Ready to deploy
**Estimated Fix Time**: 5-10 minutes
