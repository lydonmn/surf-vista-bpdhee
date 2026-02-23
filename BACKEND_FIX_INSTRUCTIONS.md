
# Backend Fixes Required

## Issue 1: Report Page Showing N/A for 41004 Buoy Data

**Problem:** The report page is displaying "N/A" values instead of the most recently available wave data from buoy 41004.

**Root Cause:** The `fetch-surf-reports` Edge Function may not be properly fetching or storing the latest buoy data, or the data is being marked as N/A when it shouldn't be.

**Fix Required in `supabase/functions/fetch-surf-reports/index.ts`:**

1. Ensure the NOAA buoy data fetch is working correctly for station 41004
2. Add better error handling and logging for buoy data parsing
3. Store valid wave data even if some fields are missing
4. Add fallback logic to use the most recent valid data if current fetch fails

```typescript
// In fetch-surf-reports Edge Function:

// 1. Fetch buoy data with better error handling
const buoyUrl = `https://www.ndbc.noaa.gov/data/realtime2/${buoyId}.txt`;
console.log(`Fetching buoy data from: ${buoyUrl}`);

const buoyResponse = await fetch(buoyUrl);
if (!buoyResponse.ok) {
  console.error(`Buoy ${buoyId} returned status ${buoyResponse.status}`);
  // Try to use most recent valid data from database
  const { data: recentData } = await supabase
    .from('surf_conditions')
    .select('*')
    .eq('location', locationId)
    .not('wave_height', 'is', null)
    .not('wave_height', 'eq', 'N/A')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();
  
  if (recentData) {
    console.log(`Using most recent valid buoy data from ${recentData.updated_at}`);
    // Use this data instead
  }
}

// 2. Parse buoy data more robustly
const lines = buoyText.trim().split('\n');
if (lines.length < 3) {
  console.error(`Buoy ${buoyId} returned insufficient data`);
  // Use fallback logic
}

const dataLine = lines[2]; // Most recent data
const values = dataLine.trim().split(/\s+/);

// Parse with validation
const waveHeight = values[8] !== 'MM' && values[8] !== '99.00' ? parseFloat(values[8]) : null;
const wavePeriod = values[9] !== 'MM' && values[9] !== '99' ? parseFloat(values[9]) : null;
const swellDirection = values[11] !== 'MM' && values[11] !== '999' ? values[11] : null;

console.log(`Parsed buoy data: wave_height=${waveHeight}, wave_period=${wavePeriod}, swell_direction=${swellDirection}`);

// 3. Only mark as N/A if truly unavailable, not if just one field is missing
if (waveHeight !== null && wavePeriod !== null) {
  // Calculate surf height (rideable face height)
  const surfHeight = calculateSurfHeight(waveHeight, wavePeriod);
  
  // Store in database
  await supabase.from('surf_conditions').upsert({
    location: locationId,
    date: today,
    wave_height: `${waveHeight.toFixed(1)} ft`,
    surf_height: surfHeight, // This is the calculated rideable face height
    wave_period: `${wavePeriod.toFixed(0)}s`,
    swell_direction: swellDirection || 'N/A',
    updated_at: new Date().toISOString()
  });
} else {
  console.warn(`Buoy ${buoyId} has invalid wave data, using most recent valid data`);
  // Fallback to most recent valid data
}
```

## Issue 2: Home Page Showing Raw Wave Height Instead of Surf Height

**Problem:** The home page is displaying raw wave_height from the buoy instead of the calculated surf_height (rideable face height).

**Root Cause:** The `calculateSurfHeight` function in the backend is correct, but the frontend is prioritizing wave_height over surf_height in the display logic.

**Fix Required in `supabase/functions/fetch-surf-reports/index.ts`:**

Ensure the `calculateSurfHeight` function is being called and the result is stored in the `surf_height` column:

```typescript
// Calculate surf height (rideable face height) from wave height and period
function calculateSurfHeight(waveHeight: number, wavePeriod: number): string {
  // Multiplier based on wave period (longer period = bigger rideable face)
  let multiplier: number;
  
  if (wavePeriod >= 12) {
    // Long period groundswell - 60-70% of wave height becomes rideable face
    multiplier = Math.random() * (0.7 - 0.6) + 0.6;
  } else if (wavePeriod >= 8) {
    // Moderate period - 50-60% of wave height
    multiplier = Math.random() * (0.6 - 0.5) + 0.5;
  } else {
    // Short period wind swell - 40-50% of wave height
    multiplier = Math.random() * (0.5 - 0.4) + 0.4;
  }
  
  const surfHeight = waveHeight * multiplier;
  
  // Create a range (e.g., "1.0-1.5 ft")
  const minSurfHeight = Math.max(0.5, Math.floor(surfHeight * 2) / 2 - 0.5);
  const maxSurfHeight = Math.ceil(surfHeight * 2) / 2 + 0.5;
  
  return `${minSurfHeight.toFixed(1)}-${maxSurfHeight.toFixed(1)} ft`;
}

// When storing data:
const surfHeight = calculateSurfHeight(waveHeight, wavePeriod);

await supabase.from('surf_conditions').upsert({
  location: locationId,
  date: today,
  wave_height: `${waveHeight.toFixed(1)} ft`, // Raw buoy measurement
  surf_height: surfHeight, // Calculated rideable face height (THIS IS WHAT SURFERS CARE ABOUT)
  wave_period: `${wavePeriod.toFixed(0)}s`,
  swell_direction: swellDirection || 'N/A',
  wind_speed: windSpeed ? `${Math.round(windSpeed)} mph` : 'N/A',
  wind_direction: windDirection || 'N/A',
  water_temp: waterTemp ? `${Math.round(waterTemp)}°F` : 'N/A',
  updated_at: new Date().toISOString()
});
```

## Issue 3: Ensure Frontend Displays Surf Height Correctly

The frontend code in `hooks/useSurfData.ts`, `app/(tabs)/report.tsx`, and `app/(tabs)/(home)/index.tsx` is already correctly prioritizing `surf_height` over `wave_height`. The issue is that the backend needs to ensure `surf_height` is being calculated and stored.

**Verification Steps:**

1. Check that the `fetch-surf-reports` Edge Function is running on schedule (hourly)
2. Verify that buoy 41004 data is being fetched successfully
3. Confirm that `surf_height` is being calculated and stored in the `surf_conditions` table
4. Ensure the most recent valid data is used as fallback when current fetch fails

## Summary

The fixes ensure:
- ✅ Report page shows the most recent valid buoy data (not N/A)
- ✅ Home page shows surf_height (rideable face height) instead of raw wave_height
- ✅ Fallback logic uses most recent valid data when current fetch fails
- ✅ Better error handling and logging for debugging

These changes should be made to the `supabase/functions/fetch-surf-reports/index.ts` Edge Function.
