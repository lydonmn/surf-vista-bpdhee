
# Quick Setup Checklist - Automatic Date System

## ✅ What's Already Done

- [x] Edge functions updated with dynamic date calculation
- [x] All functions use `getESTDate()` for current EST date
- [x] UI components parse dates correctly
- [x] Automatic refresh every 15 minutes in app
- [x] Real-time database subscriptions
- [x] Pull-to-refresh functionality
- [x] Edge functions deployed to Supabase
- [x] Documentation created

## ⚠️ What You Need to Do (One-Time Setup)

### Step 1: Get Your Supabase Anon Key

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `ucbilksfpnmltrkwvzft`
3. Go to Settings → API
4. Copy the `anon` / `public` key
5. Save it for the next step

### Step 2: Schedule Cron Jobs

**Option A: Using Supabase pg_cron (Recommended)**

1. Go to Supabase Dashboard → SQL Editor
2. Run this SQL (replace `YOUR_ANON_KEY` with your actual key):

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily update at 6:00 AM EST (11:00 UTC)
SELECT cron.schedule(
  'daily-surf-data-update',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-update-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    )
  ) AS request_id;
  $$
);

-- Schedule cleanup at 2:00 AM EST (7:00 UTC)
SELECT cron.schedule(
  'cleanup-old-reports',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/cleanup-old-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_KEY'
    )
  ) AS request_id;
  $$
);
```

3. Verify cron jobs are scheduled:

```sql
SELECT * FROM cron.job;
```

**Option B: Using Cron-job.org (If pg_cron not available)**

1. Go to https://cron-job.org and create free account
2. Create first cron job:
   - **Title:** SurfVista Daily Update
   - **URL:** `https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-update-cron`
   - **Schedule:** Every day at 6:00 AM EST
   - **Method:** POST
   - **Headers:** 
     ```
     Content-Type: application/json
     Authorization: Bearer YOUR_ANON_KEY
     ```
3. Create second cron job:
   - **Title:** SurfVista Cleanup
   - **URL:** `https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/cleanup-old-reports`
   - **Schedule:** Every day at 2:00 AM EST
   - **Method:** POST
   - **Headers:** Same as above
4. Enable both jobs

### Step 3: Test the System

1. **Test manual update:**
   ```bash
   curl -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-update-cron
   ```

2. **Check Supabase logs:**
   - Go to Dashboard → Edge Functions → daily-update-cron → Logs
   - Look for "DAILY UPDATE CRON COMPLETED"

3. **Check database:**
   ```sql
   SELECT date, updated_at FROM surf_reports ORDER BY date DESC LIMIT 1;
   ```
   Should show today's date.

4. **Check app:**
   - Open SurfVista app
   - Go to Forecast tab
   - Should show "Today" for current day
   - Pull to refresh should work

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Cron jobs are scheduled (check `SELECT * FROM cron.job;`)
- [ ] Manual test update works (check logs)
- [ ] Database has today's date (check surf_reports table)
- [ ] App shows "Today" correctly (check Forecast tab)
- [ ] Pull to refresh works (try it in app)
- [ ] Edge functions show "ACTIVE" status (check Dashboard)

## 🎉 You're Done!

Once the cron jobs are scheduled, your app will:

- ✅ Update automatically every day at 6:00 AM EST
- ✅ Clean up old data every day at 2:00 AM EST
- ✅ Refresh data every 15 minutes in the app
- ✅ Show current dates in the UI
- ✅ Work indefinitely without maintenance

## 📚 Additional Resources

- **AUTOMATIC_DATE_SYSTEM.md** - Complete system documentation
- **CRON_SETUP_GUIDE.md** - Detailed cron setup instructions
- **DATE_SYSTEM_SUMMARY.md** - System overview and summary

## 🆘 Need Help?

### Common Issues:

**Cron job not running:**
- Check cron schedule is correct (use UTC time)
- Verify anon key is correct
- Check edge function logs for errors

**Data not updating:**
- Check cron jobs are scheduled
- Verify edge functions are deployed
- Test manual update

**Wrong dates in UI:**
- Pull to refresh in app
- Check database has correct dates
- Verify getESTDate() is being used

### Get Support:

1. Check Supabase logs for errors
2. Review documentation files
3. Test manual update to isolate issue

## 🚀 Next Steps

After completing this checklist:

1. Monitor the system for a few days
2. Check logs to ensure cron jobs run successfully
3. Verify data stays current
4. Enjoy automatic updates! 🎉

**That's it! Your SurfVista app will now update automatically forever!**
