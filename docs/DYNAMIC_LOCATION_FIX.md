
# Dynamic Location Support - Edge Functions Updated

## Problem
When adding new locations (like Holden Beach, NC), the Edge Functions were failing with "Invalid location: holden-beach-nc" errors because they had hardcoded location configurations that only included Folly Beach and Pawleys Island.

## Solution
Updated all Edge Functions to **dynamically fetch location configuration from the database** instead of using hardcoded values.

## Edge Functions Updated

### 1. fetch-surf-reports
- **Before**: Hardcoded `LOCATION_CONFIG` with only folly-beach and pawleys-island
- **After**: Queries `locations` table to get `buoy_id` for any active location
- **Query**: `SELECT id, name, display_name, buoy_id FROM locations WHERE id = ? AND is_active = true`

### 2. fetch-weather-data
- **Before**: Hardcoded `LOCATION_CONFIG` with coordinates and buoy IDs
- **After**: Queries `locations` table to get `latitude`, `longitude`, and `buoy_id`
- **Query**: `SELECT id, name, display_name, latitude, longitude, buoy_id FROM locations WHERE id = ? AND is_active = true`

### 3. fetch-tide-data
- **Before**: Hardcoded `LOCATION_CONFIG` with tide station IDs
- **After**: Queries `locations` table to get `tide_station_id`
- **Query**: `SELECT id, name, display_name, tide_station_id FROM locations WHERE id = ? AND is_active = true`

### 4. fetch-surf-forecast
- **Before**: Hardcoded `LOCATION_CONFIG` with buoy IDs
- **After**: Queries `locations` table to get `buoy_id`
- **Query**: `SELECT id, name, display_name, buoy_id FROM locations WHERE id = ? AND is_active = true`

### 5. generate-daily-report
- **Before**: Hardcoded location names
- **After**: Queries `locations` table to get `display_name`
- **Query**: `SELECT id, name, display_name FROM locations WHERE id = ? AND is_active = true`

### 6. daily-5am-report-with-retry
- **Already updated**: This function was already fetching locations dynamically from the database

## How It Works Now

1. **Admin adds a new location** via the Admin Locations screen
   - Enters: name, display_name, latitude, longitude, buoy_id, tide_station_id
   - Location is saved to the `locations` table with `is_active = true`

2. **Edge Functions automatically support the new location**
   - When called with `{ location: 'holden-beach-nc' }`, they query the database
   - Retrieve the buoy_id, tide_station_id, and coordinates for that location
   - Use those values to fetch data from NOAA APIs

3. **No code changes needed for new locations**
   - Just add the location to the database
   - All Edge Functions will automatically work with it

## Testing the Fix

To test with Holden Beach:

1. Go to Admin → Data Sources
2. Select "Holden Beach" from the location selector
3. Click "🏄 Fetch Surf Report" - should now work without errors
4. Click "🌤️ Fetch Weather & Forecast" - should fetch weather for Holden Beach coordinates
5. Click "🌊 Fetch Tide Data" - should fetch tides for station 8659414
6. Click "📝 Generate New Narrative Report" - should create a report for Holden Beach

## Database Schema

The `locations` table must have these columns for the Edge Functions to work:
- `id` (text, primary key) - e.g., 'holden-beach-nc'
- `name` (text) - e.g., 'Holden Beach'
- `display_name` (text) - e.g., 'Holden Beach, NC'
- `latitude` (numeric) - e.g., 33.9177
- `longitude` (numeric) - e.g., -78.3086
- `buoy_id` (text) - e.g., '41024'
- `tide_station_id` (text) - e.g., '8659414'
- `is_active` (boolean) - must be true for location to be used

## Error Handling

If a location is not found in the database, the Edge Functions will return:
```json
{
  "success": false,
  "error": "Location not found: <location-id>",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

This provides clear feedback when a location hasn't been properly configured.

## Benefits

✅ **Scalable**: Add unlimited locations without code changes
✅ **Maintainable**: All location data in one place (database)
✅ **Flexible**: Easy to update buoy IDs or coordinates for existing locations
✅ **Robust**: Clear error messages when locations are misconfigured
✅ **Automatic**: Daily 5 AM reports automatically process all active locations

## Next Steps

The system is now fully dynamic. To add more locations:

1. Go to Admin → Manage Locations
2. Click "Add New Location"
3. Fill in all required fields (name, coordinates, buoy ID, tide station ID)
4. Save and activate the location
5. The location will immediately work with all data fetching and report generation features
