
# Cisco Beach Wind Data Fix

## Issue
Wind data is not populating for Cisco Beach on the home page, showing as "N/A" instead of valid wind speed and direction values.

## Root Cause
The backend Edge Functions (`fetch-surf-forecast` and `fetch-surf-reports`) have Open-Meteo fallback logic for Cisco Beach and Jupiter, but the wind data is still not being populated correctly in the `surf_conditions` table for Cisco Beach.

## Backend Fix Required
The backend needs to ensure that:
1. When NOAA buoy data returns invalid wind values (99.0, 999.0, "N/A", null, etc.) for Cisco Beach
2. The Open-Meteo API fallback is triggered correctly
3. The valid wind data from Open-Meteo is stored in the `surf_conditions` table
4. The location ID for Cisco Beach is correctly identified as `'cisco-beach-nantucket'`

## Frontend Status
✅ The frontend is correctly configured to display wind data from:
- `surfConditions.wind_speed` and `surfConditions.wind_direction` (priority 1)
- `weatherData.wind_speed` and `weatherData.wind_direction` (priority 2)  
- `todaysReport.wind_speed` and `todaysReport.wind_direction` (priority 3)

The frontend will automatically display the wind data once the backend populates it correctly.

## Next Steps
Backend team needs to:
1. Verify the Open-Meteo fallback is working for Cisco Beach location
2. Check that the correct latitude/longitude is being used for Cisco Beach
3. Ensure the wind data is being saved to the database after fetching from Open-Meteo
4. Test the daily 6 AM cron job for Cisco Beach specifically
