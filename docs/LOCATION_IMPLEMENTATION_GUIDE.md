
# Location-Specific Data Implementation Guide

## Overview
This guide explains the implementation of location-specific surf data for Folly Beach and Pawleys Island.

## Database Changes

### Migration Applied
Run the migration in `docs/ADD_LOCATION_COLUMN_MIGRATION.sql` to add the `location` column to all data tables:
- surf_reports
- weather_data
- weather_forecast
- tide_data
- videos

### Location Values
- `folly-beach` - Folly Beach, SC (32.6552, -79.9403)
- `pawleys-island` - Pawleys Island, SC (33.4318, -79.1192)

## Frontend Changes

### 1. LocationContext
- Already implemented with location switching
- Persists user's location preference
- Provides current location to all components

### 2. useSurfData Hook
- **Updated** to filter data by current location
- Fetches surf reports, weather, forecast, and tide data for selected location
- Real-time subscriptions filter by location
- Refetches data when location changes

### 3. useVideos Hook
- **Updated** to filter videos by current location
- Separate video library for each location
- Preloads videos with signed URLs for instant playback
- Refetches videos when location changes

## Backend Changes Needed

### Edge Functions to Update

#### 1. update-all-surf-data
- Accept `location` parameter in request body
- Pass location to all sub-functions
- Fetch data for specific location coordinates

#### 2. fetch-weather-data
- Accept `location` parameter
- Use location-specific coordinates for API calls
- Store data with location field

#### 3. fetch-tide-data
- Accept `location` parameter
- Use location-specific NOAA station IDs:
  - Folly Beach: Station 8665530 (Charleston)
  - Pawleys Island: Station 8662245 (Springmaid Pier)
- Store data with location field

#### 4. fetch-surf-reports
- Accept `location` parameter
- Use location-specific surf report sources
- Store data with location field

#### 5. generate-daily-report
- Accept `location` parameter
- Generate reports for specific location
- Store reports with location field

### NOAA Buoy Data

#### Folly Beach
- **Buoy ID**: 41004 (Edisto Buoy)
- **Coordinates**: 32.5°N, 79.1°W
- **Distance**: ~20 miles offshore

#### Pawleys Island
- **Buoy ID**: 41013 (Frying Pan Shoals Buoy)
- **Coordinates**: 33.4°N, 77.7°W
- **Distance**: ~50 miles offshore
- **Alternative**: 41029 (Cape Lookout Buoy) at 34.2°N, 76.9°W

### Weather API Coordinates

#### Folly Beach
- **Lat**: 32.6552
- **Lon**: -79.9403

#### Pawleys Island
- **Lat**: 33.4318
- **Lon**: -79.1192

## User Experience

### Location Switching
1. User taps location selector on home screen
2. Modal shows available locations
3. User selects new location
4. App refetches all data for new location
5. All screens update to show location-specific data

### Separate Video Libraries
- Videos are tagged with location
- Only videos for current location are shown
- Admin can upload videos for specific locations
- Each location has its own video library

## Testing Checklist

- [ ] Database migration applied successfully
- [ ] Location selector works on home screen
- [ ] Surf reports filter by location
- [ ] Weather data filters by location
- [ ] Forecast filters by location
- [ ] Tide data filters by location
- [ ] Videos filter by location
- [ ] Real-time updates work for each location
- [ ] Location preference persists across app restarts
- [ ] Backend functions accept location parameter
- [ ] Backend functions use correct coordinates/buoy IDs
- [ ] Admin can upload videos for specific locations

## Next Steps

1. **Apply Database Migration**: Run the SQL migration to add location columns
2. **Update Backend Functions**: Modify edge functions to accept and use location parameter
3. **Configure NOAA Data Sources**: Set up correct buoy IDs and station IDs for each location
4. **Test Data Fetching**: Verify data is fetched correctly for both locations
5. **Test Video Upload**: Ensure admin can upload videos for specific locations
6. **Test Location Switching**: Verify smooth switching between locations
