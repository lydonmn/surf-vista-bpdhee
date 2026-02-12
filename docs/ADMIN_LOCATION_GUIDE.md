
# 🌊 Admin Location Management Guide

## Overview
The SurfVista app is fully dynamic and supports multiple surf locations. When you add a new location, it automatically integrates into all parts of the app with zero code changes required.

---

## ✨ What Happens When You Add a Location

When you add a new location through the Admin Locations screen, the following happens automatically:

### 1. **Location Selector** 🗺️
- New location appears in the dropdown on the homepage
- Users can switch between locations seamlessly
- Selection is saved and persists across app restarts

### 2. **Homepage Video Card** 🎥
- Large video card displays the **latest video** for the selected location
- Videos are filtered by location automatically
- Preloaded URLs ensure instant playback
- Each location has its own video library

### 3. **Surf Reports & Forecasts** 📊
- Daily reports are generated for each location at 5 AM EST
- Reports use location-specific NOAA data (buoy, weather, tides)
- Forecast page shows location-specific predictions
- Report page displays location-specific conditions

### 4. **Video Library** 📹
- Videos tab shows only videos for the current location
- Admin can upload videos and tag them to specific locations
- Each location maintains its own video library

### 5. **Push Notifications** 🔔
- Users can subscribe to daily reports for specific locations
- Notifications are sent at 5 AM EST for each location
- Users can choose which locations they want notifications for

### 6. **Admin Data Manager** 🔧
- Pull data and generate reports for individual locations
- Bulk operations work across all active locations
- Per-location status monitoring and controls

---

## 📋 Step-by-Step: Adding a New Location

### Step 1: Find NOAA Data Sources

#### A. Find the Nearest NOAA Buoy
1. Go to: **https://ndbc.noaa.gov**
2. Click "Station Map" or search by location
3. Find the nearest buoy to your surf spot
4. Note the **Buoy ID** (e.g., `41013` for Frying Pan Shoals)
5. Verify the buoy reports wave height, period, and water temperature

#### B. Find the Nearest Tide Station
1. Go to: **https://tidesandcurrents.noaa.gov**
2. Search for your location
3. Find the nearest tide station
4. Note the **Station ID** (e.g., `8659414` for Lockwoods Folly Inlet)

#### C. Get GPS Coordinates
1. Open Google Maps
2. Right-click on your surf spot
3. Copy the coordinates (e.g., `33.9140, -78.3070`)

### Step 2: Add Location in Admin Panel

1. Navigate to: **Admin Panel → Manage Locations**
2. Click **"+ Add New Location"**
3. Fill in the form:
   - **Location ID**: URL-friendly name (e.g., `myrtle-beach-sc`)
   - **Location Name**: Short name (e.g., `Myrtle Beach`)
   - **Display Name**: Full name (e.g., `Myrtle Beach, SC`)
   - **Latitude**: From Google Maps (e.g., `33.6891`)
   - **Longitude**: From Google Maps (e.g., `-78.8867`)
   - **NOAA Buoy ID**: From ndbc.noaa.gov (e.g., `41004`)
   - **NOAA Tide Station ID**: From tidesandcurrents.noaa.gov (e.g., `8661070`)
4. Click **"Save"**

### Step 3: Test Data Sources

1. Click **"Test Data"** on the newly added location
2. Verify all three data sources work:
   - ✅ Buoy data (wave height, period, water temp)
   - ✅ Weather data (air temp, wind, conditions)
   - ✅ Tide data (high/low tide times)
3. If any test fails, double-check the IDs

### Step 4: Activate the Location

1. If tests pass, the location is automatically active
2. If you need to deactivate temporarily, click **"Deactivate"**
3. Active locations appear in the location selector
4. Inactive locations are hidden from users but preserved in the database

### Step 5: Upload Videos for the Location

1. Go to: **Admin Panel → Upload Video**
2. Select a video from your camera roll
3. Enter title and description
4. **Select the new location** from the location buttons
5. Click **"Upload Video"**
6. The video will appear on the homepage when that location is selected

### Step 6: Generate Initial Report

1. Go to: **Admin Panel → Update Surf Data**
2. Find your new location in the list
3. Click **"Pull Data"** to fetch NOAA data
4. Click **"Generate Report"** to create the narrative
5. The report will appear on the homepage and report page

---

## 🎯 How the Homepage Video Card Works

The homepage video card is **location-aware** and works as follows:

### Video Filtering Logic
```typescript
// In useVideos hook:
const { data } = await supabase
  .from('videos')
  .select('*')
  .eq('location', currentLocation)  // ✅ Filters by current location
  .order('created_at', { ascending: false });

// Latest video for current location
const latestVideo = videos[0];
```

### Homepage Display
- When user selects a location, the homepage shows:
  - **Latest video** for that location (large card with thumbnail)
  - **Surf report** for that location
  - **Weather conditions** for that location
  - **Weekly forecast** for that location

### Video Library Association
- Each video is tagged with a `location` field
- Videos are uploaded through Admin Panel with location selection
- Homepage always shows the most recent video for the current location
- If no videos exist for a location, the video card is hidden

---

## 🔄 Automated Systems

### Daily 5 AM Report Generation
- Runs automatically at 5:00 AM EST every day
- Processes **all active locations** in parallel
- Generates narrative reports for each location
- Sends push notifications to subscribers

### 15-Minute Buoy Updates
- Runs every 15 minutes from 5 AM to 9 PM EST
- Updates wave data from NOAA buoys
- Preserves the morning narrative (doesn't regenerate)
- Keeps data fresh throughout the day

### Real-Time Video Updates
- Homepage and video library update instantly when new videos are uploaded
- Uses Supabase real-time subscriptions
- Preloads videos for instant playback

---

## 🛠️ Troubleshooting

### Location Not Appearing in Selector
- Check if location is marked as **Active** in Admin Locations
- Verify the location was saved successfully (check database)
- Try refreshing the app (pull down on homepage)

### No Videos Showing for Location
- Upload at least one video tagged to that location
- Verify the video upload completed successfully
- Check the Videos tab to confirm the video exists

### Data Sources Failing
- **Buoy Test Fails**: Verify buoy ID is correct and buoy is operational (check ndbc.noaa.gov)
- **Weather Test Fails**: Verify coordinates are correct
- **Tide Test Fails**: Verify tide station ID is correct and station is operational

### Reports Not Generating
- Ensure data sources pass the test
- Check Admin Data Manager for error logs
- Try manually pulling data and generating report
- Some buoys may have offline wave sensors (wind/temp data will still work)

---

## 📊 Database Schema

### Locations Table
```sql
CREATE TABLE locations (
  id TEXT PRIMARY KEY,                    -- URL-friendly ID (e.g., 'myrtle-beach-sc')
  name TEXT NOT NULL UNIQUE,              -- Short name (e.g., 'Myrtle Beach')
  display_name TEXT NOT NULL,             -- Full display name (e.g., 'Myrtle Beach, SC')
  latitude NUMERIC NOT NULL,              -- GPS latitude
  longitude NUMERIC NOT NULL,             -- GPS longitude
  buoy_id TEXT NOT NULL,                  -- NOAA buoy ID (e.g., '41004')
  tide_station_id TEXT NOT NULL,          -- NOAA tide station ID (e.g., '8661070')
  is_active BOOLEAN DEFAULT true,         -- Whether location is visible to users
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Videos Table (Location Field)
```sql
ALTER TABLE videos ADD COLUMN location TEXT DEFAULT 'folly-beach';
```

### All Data Tables Have Location Field
- `surf_reports.location`
- `surf_conditions.location`
- `weather_data.location`
- `weather_forecast.location`
- `tide_data.location`
- `external_surf_reports.location`

---

## 🚀 Best Practices

### Naming Conventions
- **ID**: Use lowercase with hyphens (e.g., `myrtle-beach-sc`, `ocean-isle-nc`)
- **Name**: Use proper capitalization (e.g., `Myrtle Beach`, `Ocean Isle`)
- **Display Name**: Include state/region (e.g., `Myrtle Beach, SC`, `Ocean Isle, NC`)

### Buoy Selection
- Choose the **nearest** buoy to your surf spot
- Verify the buoy reports wave data (some only report weather)
- Multiple locations can share the same buoy if they're in the same region

### Tide Station Selection
- Choose the **nearest** tide station
- Tide stations are less common than buoys
- It's okay if the tide station is 10-20 miles away

### Testing Before Activation
- **Always** run "Test Data" before activating a location
- Verify all three data sources (buoy, weather, tides) work
- If wave sensors are offline, the location will still work (wind/temp only)

### Video Organization
- Upload videos regularly for each location
- Use descriptive titles with dates
- The homepage will always show the latest video for the selected location

---

## 📱 User Experience

### For Subscribers
1. Open app → See location selector on homepage
2. Tap location selector → Choose from available locations
3. Homepage updates to show:
   - Latest video for that location
   - Current conditions for that location
   - Surf report for that location
4. All tabs (Videos, Report, Forecast, Weather) filter by selected location
5. Selection persists across app restarts

### For Admins
1. Add new locations through Admin Locations
2. Upload videos tagged to specific locations
3. Generate reports for individual locations or all at once
4. Monitor data quality and buoy status per location
5. Activate/deactivate locations as needed

---

## 🎯 Summary

The location system is **fully dynamic** and requires **zero code changes** to add new locations. Simply:

1. ✅ Add location in Admin Locations
2. ✅ Test data sources
3. ✅ Upload videos for that location
4. ✅ Generate initial report
5. ✅ Location is live!

The homepage video card, reports, forecasts, and all features automatically work for the new location. The system handles everything through the database and LocationContext.

---

## 🔗 Related Files

- `contexts/LocationContext.tsx` - Location state management
- `hooks/useVideos.ts` - Video filtering by location
- `hooks/useSurfData.ts` - Surf data filtering by location
- `app/admin-locations.tsx` - Location management UI
- `app/admin-data.tsx` - Data management per location
- `app/(tabs)/(home)/index.tsx` - Homepage with video card
- `components/LocationSelector.tsx` - Location dropdown

---

**Last Updated**: January 2025  
**Version**: 7.0
