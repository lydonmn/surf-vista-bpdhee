
# 🚨 CRITICAL BACKEND FIX: Folly Beach Buoy Data Separation

## Problem
The backend is displaying wave data from buoy 41076 (water temperature station) instead of buoy 41004 (wave data station) for Folly Beach. This causes "N/A" wave values to appear on the home page and report page when buoy 41076 updates on its schedule.

## Root Cause
The backend Edge Functions (`fetch-surf-reports`, `fetch-buoy-data-hourly`, `daily-6am-report-with-retry`) are not properly separating data sources. When buoy 41076 updates, its data (which includes N/A for wave measurements) overwrites the valid wave data from buoy 41004.

## Required Fix

### Database Schema Update
First, ensure the `locations` table has a `water_temp_station_id` column:

```sql
-- Check if column exists, if not add it
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS water_temp_station_id TEXT;

-- Update Folly Beach to use separate buoys
UPDATE locations 
SET 
  buoy_id = '41004',  -- Primary buoy for wave data
  water_temp_station_id = '41076'  -- Dedicated water temp station
WHERE id = 'folly-beach';
```

### Edge Function Logic Update

All Edge Functions that fetch buoy data need to implement this logic:

```typescript
// CRITICAL: Data Source Separation for Folly Beach
async function fetchBuoyDataForLocation(location: Location) {
  const primaryBuoyId = location.buoy_id; // e.g., '41004' for Folly Beach
  const waterTempStationId = location.water_temp_station_id; // e.g., '41076' for Folly Beach
  
  console.log(`[${location.name}] Primary buoy: ${primaryBuoyId}`);
  console.log(`[${location.name}] Water temp station: ${waterTempStationId || 'None (using primary)'}`);
  
  // Step 1: Fetch ALL data from primary buoy (wave, wind, default water temp)
  const primaryBuoyData = await fetchBuoyData(primaryBuoyId);
  console.log(`[${location.name}] Primary buoy data:`, {
    wave_height: primaryBuoyData.wave_height,
    wave_period: primaryBuoyData.wave_period,
    wind_speed: primaryBuoyData.wind_speed,
    water_temp: primaryBuoyData.water_temp
  });
  
  // Step 2: Start with primary buoy data
  let finalData = {
    ...primaryBuoyData,
    buoy_id: primaryBuoyId, // CRITICAL: Always store primary buoy ID
    location: location.id
  };
  
  // Step 3: If dedicated water temp station exists, fetch water temp from there
  if (waterTempStationId && waterTempStationId !== primaryBuoyId) {
    console.log(`[${location.name}] Fetching water temp from dedicated station: ${waterTempStationId}`);
    
    try {
      const waterTempStationData = await fetchBuoyData(waterTempStationId);
      console.log(`[${location.name}] Water temp station data:`, {
        water_temp: waterTempStationData.water_temp,
        wave_height: waterTempStationData.wave_height // Should be N/A
      });
      
      // CRITICAL: Only use water_temp from this station, NEVER wave data
      if (isValidValue(waterTempStationData.water_temp)) {
        console.log(`[${location.name}] ✅ Using water temp from ${waterTempStationId}: ${waterTempStationData.water_temp}`);
        finalData.water_temp = waterTempStationData.water_temp;
      } else {
        console.log(`[${location.name}] ⚠️ Water temp from ${waterTempStationId} is invalid, keeping primary buoy water temp`);
      }
      
      // CRITICAL: Explicitly ignore wave data from water temp station
      console.log(`[${location.name}] 🚫 Ignoring wave data from ${waterTempStationId} (water temp station only)`);
      
    } catch (error) {
      console.error(`[${location.name}] Error fetching water temp from ${waterTempStationId}:`, error);
      console.log(`[${location.name}] Falling back to primary buoy water temp`);
    }
  }
  
  // Step 4: Calculate surf height from wave data
  finalData.surf_height = calculateSurfHeight(finalData.wave_height, finalData.wave_period);
  
  console.log(`[${location.name}] ✅ Final merged data:`, {
    buoy_id: finalData.buoy_id,
    wave_height: finalData.wave_height,
    surf_height: finalData.surf_height,
    wave_period: finalData.wave_period,
    wind_speed: finalData.wind_speed,
    water_temp: finalData.water_temp,
    source: waterTempStationId ? `Wave: ${primaryBuoyId}, Water Temp: ${waterTempStationId}` : `All: ${primaryBuoyId}`
  });
  
  return finalData;
}

// Helper function to validate data
function isValidValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === '' || trimmed === 'n/a' || trimmed === 'null') return false;
  }
  if (typeof value === 'number' && isNaN(value)) return false;
  return true;
}

// Helper function to calculate surf height
function calculateSurfHeight(waveHeight: any, wavePeriod: any): number | null {
  if (!isValidValue(waveHeight) || !isValidValue(wavePeriod)) return null;
  
  const height = parseFloat(String(waveHeight));
  const period = parseFloat(String(wavePeriod));
  
  if (isNaN(height) || isNaN(period)) return null;
  
  // Surf height calculation based on period
  let multiplier = 0.5; // Default for short period
  if (period >= 12) multiplier = 0.7; // Long period groundswell
  else if (period >= 8) multiplier = 0.6; // Moderate period
  
  return parseFloat((height * multiplier).toFixed(1));
}
```

### Edge Functions to Update

1. **fetch-surf-reports** (Manual data pull)
   - Location: `supabase/functions/fetch-surf-reports/index.ts`
   - Update: Implement the data separation logic above

2. **fetch-buoy-data-hourly** (Scheduled hourly updates)
   - Location: `supabase/functions/fetch-buoy-data-hourly/index.ts`
   - Update: Implement the data separation logic above
   - **CRITICAL**: This is the most important one as it runs automatically

3. **daily-6am-report-with-retry** (Daily report generation)
   - Location: `supabase/functions/daily-6am-report-with-retry/index.ts`
   - Update: When fetching data for report generation, use the same logic

### Database Storage Rules

When storing data in `surf_conditions` table:

```typescript
// CRITICAL: Always store with primary buoy_id
const surfConditionsData = {
  location: location.id,
  buoy_id: location.buoy_id, // ALWAYS use primary buoy ID (41004 for Folly Beach)
  date: todayDate,
  wave_height: finalData.wave_height, // From primary buoy (41004)
  surf_height: finalData.surf_height, // Calculated from primary buoy data
  wave_period: finalData.wave_period, // From primary buoy (41004)
  swell_direction: finalData.swell_direction, // From primary buoy (41004)
  wind_speed: finalData.wind_speed, // From primary buoy (41004)
  wind_direction: finalData.wind_direction, // From primary buoy (41004)
  water_temp: finalData.water_temp, // From water temp station (41076) if available, else primary (41004)
  updated_at: new Date().toISOString()
};

// Use upsert to avoid duplicates
const { error } = await supabase
  .from('surf_conditions')
  .upsert(surfConditionsData, {
    onConflict: 'date,location',
    ignoreDuplicates: false
  });
```

## Verification Steps

After implementing the fix:

1. **Check Database**:
   ```sql
   SELECT 
     location,
     buoy_id,
     wave_height,
     surf_height,
     water_temp,
     updated_at
   FROM surf_conditions
   WHERE location = 'folly-beach'
   ORDER BY updated_at DESC
   LIMIT 5;
   ```
   - `buoy_id` should ALWAYS be '41004'
   - `wave_height` and `surf_height` should have valid values (not N/A)
   - `water_temp` should be from 41076 if available

2. **Check Edge Function Logs**:
   - Look for: "Primary buoy: 41004"
   - Look for: "Water temp station: 41076"
   - Look for: "✅ Using water temp from 41076"
   - Look for: "🚫 Ignoring wave data from 41076"

3. **Check Frontend Display**:
   - Home page should show valid wave heights (not N/A)
   - Report page should show valid wave heights (not N/A)
   - Water temperature should be from 41076 (most accurate)
   - All data should be consistent between home and report pages

## Expected Behavior After Fix

### When Buoy 41004 Updates (every 20-50 minutes):
- Wave data updates: wave_height, surf_height, wave_period, swell_direction
- Wind data updates: wind_speed, wind_direction
- Water temp updates (as fallback)
- Frontend displays all valid data

### When Buoy 41076 Updates (on its schedule):
- ONLY water_temp updates
- Wave data remains unchanged (still from 41004)
- Frontend continues to display valid wave data
- Water temp shows most recent value from 41076

### Result:
- Users ALWAYS see valid wave data from 41004
- Users ALWAYS see most accurate water temp from 41076
- No more "N/A" wave values appearing when 41076 updates
- Consistent data display across home page and report page

## Testing Checklist

- [ ] Database has `water_temp_station_id` column
- [ ] Folly Beach location has `buoy_id='41004'` and `water_temp_station_id='41076'`
- [ ] Edge Functions implement data separation logic
- [ ] Edge Function logs show correct buoy usage
- [ ] `surf_conditions` table always has `buoy_id='41004'` for Folly Beach
- [ ] Wave data is never N/A when 41076 updates
- [ ] Water temp updates from 41076 when available
- [ ] Frontend displays consistent data on home and report pages
- [ ] Manual "Update Data" button works correctly
- [ ] Scheduled hourly updates work correctly
- [ ] Daily 6 AM report generation works correctly

## Priority

🚨 **CRITICAL** - This fix is essential for data accuracy and user experience. Without it, users see "N/A" wave values intermittently, making the app unreliable.

## Implementation Order

1. Update database schema (add `water_temp_station_id` column)
2. Update Folly Beach location record
3. Update `fetch-buoy-data-hourly` Edge Function (most critical)
4. Update `fetch-surf-reports` Edge Function
5. Update `daily-6am-report-with-retry` Edge Function
6. Test and verify all scenarios
7. Monitor logs for 24 hours to ensure correct behavior
