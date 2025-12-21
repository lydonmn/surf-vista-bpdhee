
# Quick Fix Guide - Surf Data Errors

## The Problem
You're seeing errors: "Edge Function returned a non-2xx status code" when the app tries to update surf data.

## The Solution (3 Steps)

### Step 1: Create the Missing Table

1. Go to your Supabase project: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste this SQL:

```sql
-- Create surf_conditions table
CREATE TABLE IF NOT EXISTS public.surf_conditions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  wave_height text,
  wave_period text,
  swell_direction text,
  wind_speed text,
  wind_direction text,
  water_temp text,
  buoy_id text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.surf_conditions ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Allow public read access to surf_conditions" ON public.surf_conditions;
CREATE POLICY "Allow public read access to surf_conditions"
  ON public.surf_conditions
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Allow service role full access to surf_conditions" ON public.surf_conditions;
CREATE POLICY "Allow service role full access to surf_conditions"
  ON public.surf_conditions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create index
CREATE INDEX IF NOT EXISTS idx_surf_conditions_date ON public.surf_conditions(date DESC);

-- Grant permissions
GRANT SELECT ON public.surf_conditions TO anon, authenticated;
GRANT ALL ON public.surf_conditions TO service_role;
```

5. Click "Run" (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned"

### Step 2: Redeploy Edge Functions

Open your terminal and run these commands:

```bash
# Make sure you're in the project directory
cd /path/to/your/project

# Deploy all edge functions
npx supabase functions deploy fetch-weather-data
npx supabase functions deploy fetch-tide-data
npx supabase functions deploy fetch-surf-reports
npx supabase functions deploy generate-daily-report
npx supabase functions deploy update-all-surf-data
```

### Step 3: Test the Fix

1. Open your app
2. Navigate to the Admin Debug page (you should see it in the profile tab if you're an admin)
3. Click "Update All" button
4. Wait for the results
5. Check if all functions succeed

## What Changed?

### Files Updated:
1. **hooks/useSurfData.ts** - Better error handling
2. **supabase/functions/update-all-surf-data/index.ts** - Enhanced logging and error reporting
3. **supabase/functions/fetch-surf-reports/index.ts** - Added table existence check
4. **app/admin-debug.tsx** - Added individual function testing buttons

### New Files:
1. **docs/CREATE_SURF_CONDITIONS_TABLE.sql** - SQL to create the missing table
2. **docs/SURF_DATA_ERROR_FIX.md** - Detailed troubleshooting guide
3. **docs/QUICK_FIX_GUIDE.md** - This file

## Troubleshooting

### If Step 1 Fails
- Make sure you're logged into the correct Supabase project
- Check that you have admin access to the project
- Try refreshing the Supabase dashboard

### If Step 2 Fails
- Make sure you have the Supabase CLI installed: `npm install -g supabase`
- Make sure you're logged in: `npx supabase login`
- Make sure you're linked to the project: `npx supabase link --project-ref ucbilksfpnmltrkwvzft`

### If Step 3 Fails
- Check the error messages in the Admin Debug page
- Look at the Supabase Edge Function logs
- Verify NOAA APIs are accessible:
  - Weather: https://api.weather.gov/points/32.6552,-79.9403
  - Buoy: https://www.ndbc.noaa.gov/data/realtime2/41004.txt
  - Tides: https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&station=8665530&format=json

## Still Having Issues?

1. Check the Supabase Edge Function logs:
   - Go to Supabase Dashboard
   - Click "Edge Functions" in the left sidebar
   - Click on a function name
   - Click "Logs" tab

2. Use the Admin Debug page to test individual functions

3. Check that all environment variables are set in Supabase:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - SUPABASE_ANON_KEY

## Success Indicators

You'll know it's working when:
- ✓ All tables show "Exists" in Admin Debug
- ✓ All edge functions return "Success"
- ✓ Today's data appears in the tables
- ✓ The surf report page shows current conditions
- ✓ No more "non-2xx status code" errors

## Next Steps

Once everything is working:
1. Set up automatic data updates (cron job)
2. Monitor the Edge Function logs for any issues
3. Check data freshness daily
4. Consider adding alerts for failed updates
