
# 🚨 CRITICAL: 6 AM Surf Report Cron Job Setup Guide

## ✅ What Was Fixed

### 1. **Weather Data Collection for ALL Locations**
- The `daily-6am-report-with-retry` Edge Function now calls `fetch-weather-data` for EVERY location
- Previously, weather data was only being updated for Folly Beach
- Now ALL locations (Folly Beach, Pawleys Island, Cisco Beach, Jupiter, Marshfield) get fresh weather data

### 2. **Robust Error Handling**
- If one location fails, the system continues processing other locations
- Detailed logging shows which locations succeeded and which failed
- Partial success is reported (e.g., "4 out of 5 locations succeeded")

### 3. **Automatic Data Updates**
- Each location gets:
  - ✅ Forecast data updated (`fetch-surf-forecast`)
  - ✅ Weather data updated (`fetch-weather-data`)
  - ✅ Surf report narrative generated
  - ✅ Push notifications sent (for scheduled runs only)

---

## 🔧 MANUAL SETUP REQUIRED: Supabase Cron Job

The Edge Function is now ready, but you **MUST** manually set up the cron job in Supabase Dashboard.

### Step 1: Go to Supabase Dashboard
1. Navigate to: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft
2. Click on **"Edge Functions"** in the left sidebar
3. Find the function: **`daily-6am-report-with-retry`**

### Step 2: Set Up Cron Schedule
1. Click on the **`daily-6am-report-with-retry`** function
2. Look for the **"Cron Jobs"** or **"Invocations"** tab
3. Click **"Add Cron Job"** or **"Schedule"**

### Step 3: Configure the Cron Job
Use these settings:

**Cron Expression:** `0 11 * * *`
- This runs at **11:00 AM UTC** = **6:00 AM EST**
- Runs every day

**HTTP Method:** `POST`

**Request Body:** (Leave empty or use `{}`)
```json
{}
```

**Headers:** (Usually not needed, but if required)
```json
{
  "Content-Type": "application/json"
}
```

### Step 4: Save and Enable
1. Click **"Save"** or **"Create"**
2. Make sure the cron job is **ENABLED** (toggle should be ON)

---

## 🧪 Testing the Function Manually

You can test the function right now to verify it works for all locations:

### Option 1: Test from Supabase Dashboard
1. Go to Edge Functions → `daily-6am-report-with-retry`
2. Click **"Invoke"** or **"Test"**
3. Use this request body:
```json
{}
```
4. Click **"Send"**
5. Check the logs - you should see reports generated for ALL 5 locations

### Option 2: Test from Admin Panel in App
1. Open the SurfVista app
2. Go to **Admin Data** screen
3. Click **"Pull and Generate All Locations"**
4. This will trigger the function manually for all locations

---

## 📊 Expected Behavior

When the cron job runs at 6 AM EST (11 AM UTC), it will:

1. **Fetch all active locations** from the database:
   - Folly Beach, SC
   - Pawleys Island, SC
   - Cisco Beach, ACK
   - Jupiter Inlet, FL
   - Marshfield, MA

2. **For EACH location**, it will:
   - ✅ Update forecast data (7-day forecast)
   - ✅ Update weather data (air temp, sky conditions)
   - ✅ Generate surf report narrative
   - ✅ Save report to `surf_reports` table
   - ✅ Send push notifications to subscribers

3. **Continue even if one location fails**
   - If Cisco Beach fails, it will still process Jupiter, Marshfield, etc.
   - Logs will show which locations succeeded and which failed

---

## 🔍 Monitoring & Debugging

### Check if Cron Job Ran
1. Go to Supabase Dashboard → Edge Functions → `daily-6am-report-with-retry`
2. Click on **"Logs"** tab
3. Look for entries around 11:00 AM UTC (6:00 AM EST)
4. You should see logs like:
   ```
   [Daily Report] 🌅 DAILY SURF REPORT GENERATION
   [Daily Report] Mode: SCHEDULED
   [Daily Report] 📍 Processing 5 location(s)
   [Daily Report] ✅ Folly Beach, SC: SUCCESS
   [Daily Report] ✅ Pawleys Island, SC: SUCCESS
   ...
   ```

### Check if Reports Were Generated
Run this SQL query in Supabase SQL Editor:
```sql
SELECT 
  location,
  date,
  rating,
  LENGTH(conditions) as narrative_length,
  updated_at
FROM surf_reports
WHERE date = CURRENT_DATE
ORDER BY location;
```

You should see 5 rows (one for each location) with today's date.

### Check if Weather Data Was Updated
Run this SQL query:
```sql
SELECT 
  location_id,
  air_temp,
  conditions,
  updated_at
FROM weather_data
WHERE updated_at > NOW() - INTERVAL '2 hours'
ORDER BY location_id;
```

You should see recent weather data for all 5 locations.

---

## 🚨 Troubleshooting

### Issue: Cron job didn't run at 6 AM
**Solution:**
1. Check if the cron job is **ENABLED** in Supabase Dashboard
2. Verify the cron expression is `0 11 * * *` (11 AM UTC = 6 AM EST)
3. Check Edge Function logs for errors

### Issue: Some locations failed
**Solution:**
1. Check Edge Function logs to see which locations failed
2. Look for error messages like "No surf data available" or "Weather data not available"
3. Manually trigger data update for failed locations using Admin Data screen

### Issue: Weather data still showing "N/A"
**Solution:**
1. The `fetch-weather-data` function might be failing for that location
2. Check Edge Function logs for `fetch-weather-data` errors
3. Verify the location has valid latitude/longitude in the `locations` table

### Issue: Manual trigger works but cron doesn't
**Solution:**
1. Cron jobs might be disabled in your Supabase plan
2. Check your Supabase plan limits (some plans have limited cron jobs)
3. Contact Supabase support if cron jobs are not available

---

## ✅ Verification Checklist

After setting up the cron job, verify:

- [ ] Cron job is created in Supabase Dashboard
- [ ] Cron expression is `0 11 * * *`
- [ ] Cron job is **ENABLED**
- [ ] Manual test generates reports for all 5 locations
- [ ] Weather data is updated for all locations
- [ ] Reports appear in the app for all locations
- [ ] Push notifications are sent (check notification logs)

---

## 📝 Summary

**What's Fixed:**
- ✅ Weather cron job now loops through ALL locations (not just Folly Beach)
- ✅ Manual report generator is more robust (continues even if one location fails)
- ✅ Weather data is automatically updated for every location
- ✅ Detailed logging for debugging

**What You Need to Do:**
1. Set up the cron job in Supabase Dashboard (see Step 1-4 above)
2. Test the function manually to verify it works
3. Wait until 6 AM EST tomorrow to verify automatic generation
4. Check logs and database to confirm all locations were processed

---

## 🎯 Next Steps

1. **Set up the cron job NOW** using the instructions above
2. **Test manually** to verify all locations work
3. **Monitor tomorrow morning** at 6 AM EST to confirm automatic generation
4. **Check the app** to see reports for all locations

If you encounter any issues, check the Edge Function logs in Supabase Dashboard for detailed error messages.
