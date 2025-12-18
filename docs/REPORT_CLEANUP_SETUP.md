
# Automatic Report Cleanup Setup

## Overview
The app now filters to show only today's reports (based on EST timezone) and automatically removes old reports after midnight EST.

## What's Implemented

### 1. Client-Side Filtering
- The report page (`app/(tabs)/report.tsx`) now filters reports to show only today's date in EST timezone
- Uses `toLocaleString` with `timeZone: 'America/New_York'` to ensure correct EST date calculation
- Previous reports are hidden from view immediately

### 2. Server-Side Cleanup
- Edge Function: `supabase/functions/cleanup-old-reports/index.ts`
- Deletes all surf reports where `date != today` (EST timezone)
- Can be triggered manually or scheduled via cron

## Setting Up Automatic Cleanup

### Option 1: Supabase Cron Jobs (Recommended)
Supabase supports pg_cron for scheduled tasks. To set this up:

1. Go to your Supabase Dashboard
2. Navigate to Database → Extensions
3. Enable the `pg_cron` extension
4. Run this SQL to schedule the cleanup:

```sql
-- Schedule cleanup to run at 12:05 AM EST every day
-- Note: Supabase runs in UTC, so 12:05 AM EST = 5:05 AM UTC (standard time) or 4:05 AM UTC (daylight time)
-- Using 5:05 AM UTC to be safe during standard time
SELECT cron.schedule(
  'cleanup-old-surf-reports',
  '5 5 * * *',  -- Run at 5:05 AM UTC (12:05 AM EST)
  $$
  SELECT
    net.http_post(
      url:='https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/cleanup-old-reports',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
```

2. Replace `YOUR_ANON_KEY` with your actual Supabase anon key

### Option 2: External Cron Service
Use a service like:
- **Cron-job.org** (free)
- **EasyCron** (free tier available)
- **GitHub Actions** (if you have a repo)

Set up a daily HTTP POST request to:
```
https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/cleanup-old-reports
```

Schedule it for 12:05 AM EST (5:05 AM UTC during standard time, 4:05 AM UTC during daylight time)

### Option 3: Manual Trigger
Admins can manually trigger cleanup by calling the edge function:

```bash
curl -X POST \
  https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/cleanup-old-reports \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

## How It Works

1. **Client-Side (Immediate)**:
   - When users open the report page, they only see today's report
   - The filtering happens in real-time using EST timezone
   - Old reports are not displayed even if they exist in the database

2. **Server-Side (Scheduled)**:
   - The cleanup function runs after midnight EST
   - It calculates today's date in EST timezone
   - Deletes all reports where `date != today`
   - This keeps the database clean and prevents old data accumulation

## Color Formatting Improvements

The report display has been enhanced with better color contrast:

- **Report Background**: Light blue-gray (`#E8F4F8`) for better readability
- **Report Text**: Darker blue-gray (`#1A3A4A`) for strong contrast
- **Bold Text**: Even darker (`#0D2838`) for emphasis
- **Condition Values**: Use `reportBoldText` color for better visibility
- **Increased Font Size**: 15px for report text (up from 14px)
- **Better Line Height**: 24px for comfortable reading
- **Increased Spacing**: More gap between sentences (10px)

## Testing

To test the cleanup function:

1. Create reports with different dates in your database
2. Call the edge function manually
3. Verify that only today's report remains
4. Check the function logs in Supabase Dashboard → Edge Functions → Logs

## Monitoring

Check the cleanup function logs regularly:
- Supabase Dashboard → Edge Functions → cleanup-old-reports → Logs
- Look for successful deletions and any errors
- The function returns the number of reports deleted

## Troubleshooting

**Reports not being deleted:**
- Check if the cron job is running (Supabase Dashboard → Database → Cron Jobs)
- Verify the edge function is deployed
- Check the function logs for errors
- Ensure the timezone calculation is correct

**Wrong reports being deleted:**
- The function uses EST timezone (`America/New_York`)
- Verify your server time is correct
- Check the date format in your database (should be YYYY-MM-DD)

**Cron job not triggering:**
- Verify pg_cron extension is enabled
- Check the cron schedule syntax
- Ensure the function URL and auth token are correct
- Look for errors in Supabase logs
