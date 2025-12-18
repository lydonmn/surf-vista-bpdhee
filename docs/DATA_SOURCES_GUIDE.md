
# SurfVista Data Sources Guide

## Overview

SurfVista uses **NOAA (National Oceanic and Atmospheric Administration)** as the primary data source for all surf, weather, and tide information. NOAA is the most reliable and accurate source for US coastal data, providing real-time measurements and forecasts.

## Data Sources

### 1. NOAA Weather Service API
**Purpose:** Weather forecasts and current conditions

**Endpoint:** `https://api.weather.gov/`

**Location:** Folly Beach, SC (32.6552°N, 79.9403°W)

**Data Provided:**
- Current temperature and conditions
- 7-day weather forecast
- Wind speed and direction
- Detailed weather descriptions
- Weather icons

**Update Frequency:** Every 15 minutes

**Reliability:** ⭐⭐⭐⭐⭐ (Official US government weather service)

### 2. NOAA Buoy Station 41004
**Purpose:** Real-time ocean conditions

**Station:** Edisto, SC (32.501°N, 79.099°W) - Closest buoy to Folly Beach

**Data Provided:**
- Significant wave height (meters, converted to feet)
- Dominant wave period (seconds)
- Mean wave direction (degrees, converted to compass direction)
- Wind speed and direction
- Water temperature (Celsius, converted to Fahrenheit)

**Update Frequency:** Every hour

**Reliability:** ⭐⭐⭐⭐⭐ (Direct ocean measurements from NOAA buoy)

**Buoy Location:** Approximately 30 miles offshore from Folly Beach

### 3. NOAA Tides & Currents API
**Purpose:** Tide predictions

**Station:** 8665530 - Charleston, Cooper River Entrance

**Data Provided:**
- High and low tide times
- Tide heights (feet)
- Tide type (High/Low)

**Update Frequency:** Daily predictions

**Reliability:** ⭐⭐⭐⭐⭐ (Official NOAA tide predictions)

## Edge Functions

### fetch-weather-data
Fetches weather data from NOAA Weather Service API and stores it in the `weather_data` and `weather_forecast` tables.

**Invocation:**
```typescript
await supabase.functions.invoke('fetch-weather-data');
```

### fetch-tide-data
Fetches tide predictions from NOAA Tides & Currents API and stores them in the `tide_data` table.

**Invocation:**
```typescript
await supabase.functions.invoke('fetch-tide-data');
```

### fetch-surf-reports
Fetches real-time ocean conditions from NOAA Buoy 41004 and stores them in the `surf_conditions` table.

**Invocation:**
```typescript
await supabase.functions.invoke('fetch-surf-reports');
```

### generate-daily-report
Combines data from all sources to generate a comprehensive surf report with a 1-10 rating.

**Invocation:**
```typescript
await supabase.functions.invoke('generate-daily-report');
```

## Database Tables

### surf_conditions
Stores raw NOAA buoy data before processing.

**Columns:**
- `date`: Report date
- `wave_height`: Significant wave height (e.g., "3.5 ft")
- `wave_period`: Dominant wave period (e.g., "8 sec")
- `swell_direction`: Mean wave direction (e.g., "SE (135°)")
- `wind_speed`: Wind speed (e.g., "12 mph")
- `wind_direction`: Wind direction (e.g., "NE (45°)")
- `water_temp`: Water temperature (e.g., "68°F")
- `buoy_id`: NOAA buoy station ID

### surf_reports
Stores processed surf reports with ratings and descriptions.

**Columns:**
- `date`: Report date
- `wave_height`: Wave height summary
- `wave_period`: Wave period
- `swell_direction`: Swell direction
- `wind_speed`: Wind speed
- `wind_direction`: Wind direction
- `water_temp`: Water temperature
- `tide`: Tide summary
- `conditions`: Generated report text
- `rating`: Surf quality rating (1-10)

### weather_data
Stores current weather conditions from NOAA.

**Columns:**
- `date`: Weather date
- `temperature`: Current temperature
- `temperature_unit`: Temperature unit (F/C)
- `wind_speed`: Wind speed
- `wind_direction`: Wind direction
- `short_forecast`: Brief forecast
- `detailed_forecast`: Detailed forecast
- `icon`: Weather icon URL

### weather_forecast
Stores 7-day weather forecast from NOAA.

**Columns:**
- `date`: Forecast date
- `period_name`: Period name (e.g., "Tonight", "Monday")
- `temperature`: Temperature
- `wind_speed`: Wind speed
- `wind_direction`: Wind direction
- `short_forecast`: Brief forecast
- `detailed_forecast`: Detailed forecast
- `is_daytime`: Whether it's a daytime period

### tide_data
Stores tide predictions from NOAA.

**Columns:**
- `date`: Tide date
- `time`: Tide time (HH:MM format)
- `type`: Tide type ("High" or "Low")
- `height`: Tide height in feet
- `height_unit`: Height unit (ft)

## Surf Rating Algorithm

The surf rating (1-10) is calculated based on:

### Wave Height (0-10 ft range)
- **3-6 ft:** +2 points (ideal range)
- **2-3 ft:** +1 point (decent)
- **6-8 ft:** +1 point (big but manageable)
- **< 2 ft:** -2 points (too small)
- **> 8 ft:** -1 point (too big for most)

### Wind Conditions
**Offshore winds (W, NW, N):**
- **< 15 mph:** +2 points (light offshore - best)
- **15-20 mph:** +1 point (moderate offshore)

**Onshore winds (E, SE, S):**
- **> 15 mph:** -2 points (strong onshore - choppy)
- **< 15 mph:** -1 point (light onshore)

### Wave Period
- **≥ 10 seconds:** +1 point (long period = better waves)
- **< 6 seconds:** -1 point (short period = choppy)

**Base Rating:** 5 (middle)
**Final Rating:** Clamped between 1 and 10

## Data Update Schedule

### Automatic Updates
The app automatically refreshes data:
- **Every 15 minutes** when the app is active
- **When app comes to foreground** from background
- **Real-time updates** via Supabase subscriptions when data changes

### Manual Updates
Admins can manually trigger data updates:
1. Navigate to the Report screen
2. Tap "Update All Data from NOAA" button
3. This will:
   - Fetch latest weather data
   - Fetch latest tide predictions
   - Fetch latest buoy readings
   - Generate a new surf report

## Data Accuracy

### Why NOAA?
- **Official US Government Source:** Most authoritative weather and ocean data
- **Real-time Measurements:** Direct buoy readings, not estimates
- **Proven Reliability:** Used by professional forecasters and mariners
- **Free and Public:** No API keys or rate limits for basic usage
- **Comprehensive Coverage:** Weather, ocean, and tide data from one source

### Limitations
- **Buoy Location:** Station 41004 is ~30 miles offshore, conditions at the beach may vary
- **Update Frequency:** Buoy data updates hourly, not real-time
- **Weather Forecast:** General area forecast, not beach-specific
- **Tide Station:** Charleston Harbor, ~10 miles from Folly Beach

### Accuracy Ratings
- **Wave Height:** ⭐⭐⭐⭐⭐ (Direct buoy measurement)
- **Wave Period:** ⭐⭐⭐⭐⭐ (Direct buoy measurement)
- **Water Temperature:** ⭐⭐⭐⭐⭐ (Direct buoy measurement)
- **Wind Conditions:** ⭐⭐⭐⭐ (Buoy measurement, may differ at beach)
- **Weather Forecast:** ⭐⭐⭐⭐⭐ (Official NOAA forecast)
- **Tide Predictions:** ⭐⭐⭐⭐⭐ (Official NOAA predictions)

## Troubleshooting

### No Data Available
1. Check NOAA service status: https://www.weather.gov/
2. Verify buoy is operational: https://www.ndbc.noaa.gov/station_page.php?station=41004
3. Check edge function logs in Supabase dashboard

### Inaccurate Data
1. Verify buoy location matches your surf spot
2. Check buoy maintenance schedule
3. Compare with other local surf reports
4. Consider local conditions (sandbars, jetties, etc.)

### Data Not Updating
1. Check edge function execution logs
2. Verify Supabase service role key is set
3. Check network connectivity
4. Manually trigger update from admin panel

## Future Enhancements

Potential improvements to data accuracy:
1. **Multiple Buoy Sources:** Combine data from multiple nearby buoys
2. **Beach Cameras:** Integrate live beach camera feeds
3. **Local Observations:** Allow users to submit real-time conditions
4. **Machine Learning:** Train models on historical data for better predictions
5. **Surfline Integration:** Add professional surf forecast data (paid API)
6. **Wind Stations:** Add local wind station data for beach-specific conditions

## API Documentation

### NOAA Weather Service
- **Docs:** https://www.weather.gov/documentation/services-web-api
- **Status:** https://api.weather.gov/

### NOAA Buoy Data
- **Docs:** https://www.ndbc.noaa.gov/docs/ndbc_web_data_guide.pdf
- **Station 41004:** https://www.ndbc.noaa.gov/station_page.php?station=41004

### NOAA Tides & Currents
- **Docs:** https://api.tidesandcurrents.noaa.gov/api/prod/
- **Station 8665530:** https://tidesandcurrents.noaa.gov/stationhome.html?id=8665530

## Contact

For questions about data sources or accuracy:
- **NOAA Support:** https://www.weather.gov/contact
- **Buoy Issues:** https://www.ndbc.noaa.gov/contact_us.shtml
- **Tide Issues:** https://tidesandcurrents.noaa.gov/contact.html
