
# 🌍 Dynamic Location Management System

## Overview
The admin can now add new surf locations dynamically. All existing features automatically work for new locations without any code changes.

## Features That Work Automatically for New Locations

When you add a new location, these features are automatically enabled:

✅ **Daily 5 AM Reports** - Automatic narrative generation every morning
✅ **15-Minute Buoy Updates** - Real-time surf data updates throughout the day
✅ **Video Uploads** - Upload location-specific surf videos
✅ **Weather Data** - Automatic weather forecasts and current conditions
✅ **Tide Data** - Tide schedules and predictions
✅ **Surf Forecasts** - 7-day surf predictions
✅ **Location Selector** - Users can switch between all active locations
✅ **Report Editing** - Edit narratives for any location

## How to Add a New Location

### Step 1: Navigate to Location Management
1. Go to Admin Panel
2. Tap "Manage Locations"

### Step 2: Add Location Details
Tap "Add New Location" and fill in:

**Location ID** (URL-friendly, lowercase with hyphens)
- Example: `myrtle-beach`, `charleston`, `hilton-head`
- This becomes the unique identifier in the database

**Location Name** (Short name)
- Example: `Myrtle Beach`, `Charleston`, `Hilton Head`

**Display Name** (Full name with state)
- Example: `Myrtle Beach, SC`, `Charleston, SC`, `Hilton Head, SC`

**Latitude & Longitude**
- Get from Google Maps by right-clicking the location
- Example: Myrtle Beach = 33.6891, -78.8867

**NOAA Buoy ID**
- Find at: https://www.ndbc.noaa.gov/
- Search for nearest buoy to your location
- Example: Station 41004 (Edisto)

**NOAA Tide Station ID**
- Find at: https://tidesandcurrents.noaa.gov/
- Search for nearest tide station
- Example: 8661070 (Springmaid Pier)

### Step 3: Save and Activate
- Tap "Save Location"
- The location is automatically activated
- All features are immediately available

## Finding NOAA Station IDs

### Buoy IDs (Wave Data)
1. Visit https://www.ndbc.noaa.gov/
2. Click "Map" to see all buoys
3. Find the nearest buoy to your location
4. Click on it to see the Station ID (e.g., 41004)

### Tide Station IDs
1. Visit https://tidesandcurrents.noaa.gov/
2. Search for your location
3. Find the nearest station
4. The Station ID is in the URL (e.g., 8661070)

## Managing Existing Locations

### Edit Location
- Tap "Edit" on any location card
- Update any details (except Location ID)
- Save changes

### Deactivate Location
- Tap "Deactivate" to hide from users
- Data is preserved but location won't appear in selectors
- Can be reactivated anytime

### Delete Location
- Tap "Delete" to remove permanently
- Associated data (reports, videos) is NOT deleted
- Location just won't be selectable anymore

## Technical Details

### Database Structure
New `locations` table stores:
- `id` - Unique identifier (e.g., "myrtle-beach")
- `name` - Short name (e.g., "Myrtle Beach")
- `display_name` - Full name (e.g., "Myrtle Beach, SC")
- `latitude` / `longitude` - GPS coordinates
- `buoy_id` - NOAA buoy station ID
- `tide_station_id` - NOAA tide station ID
- `is_active` - Whether location is visible to users

### Automatic Integration
All Edge Functions now:
1. Fetch active locations from database
2. Process each location independently
3. Store data with location identifier
4. Generate location-specific reports

### Backward Compatibility
- Existing Folly Beach and Pawleys Island data preserved
- Old hardcoded references updated to use database
- Default locations available as fallback

## Example: Adding Myrtle Beach

```
Location ID: myrtle-beach
Name: Myrtle Beach
Display Name: Myrtle Beach, SC
Latitude: 33.6891
Longitude: -78.8867
Buoy ID: 41004
Tide Station ID: 8661070
```

After saving, Myrtle Beach will:
- Appear in location selector for all users
- Get daily 5 AM reports automatically
- Receive 15-minute buoy updates
- Support video uploads
- Show weather and tide data
- Display in forecast screens

## Troubleshooting

**Location not appearing?**
- Check that `is_active` is true
- Verify Location ID is unique
- Refresh the app

**No data for new location?**
- Wait for next 5 AM report (automatic)
- Or manually trigger "5 AM Report" from Admin Data screen
- Or use "Pull New Surf Data" for immediate update

**Wrong buoy/tide data?**
- Edit the location
- Update Buoy ID or Tide Station ID
- Trigger new data fetch

## Best Practices

1. **Test with one location first** - Add one, verify it works, then add more
2. **Use nearby buoys** - Closer buoys = more accurate data
3. **Verify station IDs** - Check NOAA websites to ensure IDs are correct
4. **Descriptive names** - Use clear, recognizable location names
5. **Consistent formatting** - Keep display names consistent (e.g., "City, SC")

## Future Locations

The system is designed to scale to any number of locations. Simply add them through the admin panel and everything works automatically!
