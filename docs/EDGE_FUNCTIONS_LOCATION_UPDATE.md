
# Edge Functions Location-Specific Update

## Overview
All Edge Functions have been updated to accept a `location` parameter and use location-specific data sources (NOAA buoys, tide stations, coordinates) based on the selected location.

## Updated Edge Functions

### 1. **fetch-weather-data**
- **Location Parameter**: Accepts `location` in request body (`'folly-beach'` or `'pawleys-island'`)
- **Location-Specific Data**:
  - Folly Beach: Coordinates (32.6552, -79.9403), Buoy 41004 (Edisto)
  - Pawleys Island: Coordinates (33.4318, -79.1192), Buoy 41013 (Frying Pan Shoals)
- **Database Updates**: Adds `location` column to `weather_data` and `weather_forecast` tables
- **Conflict Resolution**: Changed from `date` to `date,location` for upserts

### 2. **fetch-tide-data**
- **Location Parameter**: Accepts `location` in request body
- **Location-Specific Data**:
  - Folly Beach: Tide Station 8665530 (Charleston)
  - Pawleys Island: Tide Station 8661070 (Springmaid Pier, Myrtle Beach)
- **Database Updates**: Adds `location` column to `tide_data` table
- **Data Cleanup**: Deletes old tide data by location before inserting new data

### 3. **fetch-surf-reports**
- **Location Parameter**: Accepts `location` in request body
- **Location-Specific Data**:
  - Folly Beach: Buoy 41004 (Edisto)
  - Pawleys Island: Buoy 41013 (Frying Pan Shoals)
- **Database Updates**: Adds `location` column to `surf_conditions` table
- **Conflict Resolution**: Changed from `date` to `date,location` for upserts

### 4. **fetch-surf-forecast**
- **Location Parameter**: Accepts `location` in request body
- **Location-Specific Data**: Uses location-specific buoy IDs for current conditions
- **Database Updates**: Updates `weather_forecast` and `surf_reports` with location filter
- **Forecast Generation**: Generates 7-day forecasts based on location-specific buoy data

### 5. **generate-daily-report**
- **Location Parameter**: Accepts `location` in request body
- **Database Queries**: All queries now filter by location
- **Report Generation**: Creates location-specific surf reports with proper location tagging
- **Database Updates**: Adds `location` column to `surf_reports` table

### 6. **update-all-surf-data** (Orchestrator)
- **Location Parameter**: Accepts `location` in request body and passes it to all sub-functions
- **Function Calls**: Passes location parameter to:
  - `fetch-weather-data`
  - `fetch-tide-data`
  - `fetch-surf-reports`
  - `fetch-surf-forecast`
  - `generate-daily-report`
- **Response**: Returns location name and ID in response

## Location Configuration

Each function now includes a `LOCATION_CONFIG` object:

```typescript
const LOCATION_CONFIG = {
  'folly-beach': {
    name: 'Folly Beach, SC',
    lat: 32.6552,
    lon: -79.9403,
    buoyId: '41004', // Edisto, SC
    tideStationId: '8665530', // Charleston
  },
  'pawleys-island': {
    name: 'Pawleys Island, SC',
    lat: 33.4318,
    lon: -79.1192,
    buoyId: '41013', // Frying Pan Shoals
    tideStationId: '8661070', // Springmaid Pier, Myrtle Beach
  },
};
```

## Request Format

All Edge Functions now accept a JSON body with the location parameter:

```json
{
  "location": "folly-beach"
}
```

or

```json
{
  "location": "pawleys-island"
}
```

**Default**: If no location is provided, functions default to `'folly-beach'`.

## Response Format

All functions now return the location information in their response:

```json
{
  "success": true,
  "message": "Weather data updated successfully for Pawleys Island, SC",
  "location": "Pawleys Island, SC",
  "locationId": "pawleys-island",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Database Schema Changes Required

The following tables need a `location` column added (if not already present):

1. **weather_data**: `location TEXT DEFAULT 'folly-beach'`
2. **weather_forecast**: `location TEXT DEFAULT 'folly-beach'`
3. **tide_data**: `location TEXT DEFAULT 'folly-beach'`
4. **surf_conditions**: `location TEXT DEFAULT 'folly-beach'`
5. **surf_reports**: `location TEXT DEFAULT 'folly-beach'`

**Unique Constraints**: Update unique constraints to include location:
- `weather_data`: `(date, location)`
- `surf_conditions`: `(date, location)`
- `surf_reports`: `(date, location)`

## Frontend Integration

The frontend should pass the current location when calling these Edge Functions:

```typescript
// Example: Update all surf data for current location
const { currentLocation } = useLocation();

const response = await fetch(`${supabaseUrl}/functions/v1/update-all-surf-data`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ location: currentLocation }),
});
```

## Testing

To test the location-specific functionality:

1. **Folly Beach Data**:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/update-all-surf-data \
     -H "Authorization: Bearer YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"location": "folly-beach"}'
   ```

2. **Pawleys Island Data**:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/update-all-surf-data \
     -H "Authorization: Bearer YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"location": "pawleys-island"}'
   ```

## Error Handling

All functions now validate the location parameter and return an error if an invalid location is provided:

```json
{
  "success": false,
  "error": "Invalid location: invalid-location-id",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Benefits

1. **Scalability**: Easy to add new locations by updating the `LOCATION_CONFIG` object
2. **Data Isolation**: Each location's data is stored separately in the database
3. **Accurate Data**: Uses location-specific NOAA buoys and tide stations for accurate surf conditions
4. **Maintainability**: Centralized location configuration makes updates simple
5. **Backward Compatibility**: Defaults to Folly Beach if no location is provided

## Next Steps

1. Deploy the updated Edge Functions to Supabase
2. Ensure database schema includes `location` columns
3. Update frontend to pass location parameter when calling Edge Functions
4. Test both locations to verify data accuracy
5. Monitor logs to ensure location-specific data sources are being used correctly
