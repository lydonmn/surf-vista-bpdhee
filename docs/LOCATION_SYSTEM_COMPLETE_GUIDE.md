
# 🌍 SurfVista Location System - Complete Guide

## ✅ FULLY FUNCTIONAL - NO CODE CHANGES NEEDED

The location system is **100% dynamic and fully functional**. When you add a new location through the Admin Locations screen, it automatically integrates into every part of the app.

---

## 🎯 What Happens When You Add a New Location

When you add a location (e.g., "Myrtle Beach, SC"), the system **automatically**:

### 1. **Homepage Video Card** 🎥
- Shows the latest video for the selected location
- Displays location-specific thumbnail
- Passes preloaded URL for instant playback
- Updates when user switches locations

### 2. **Location Selector** 📍
- New location appears in dropdown
- User can switch between all active locations
- Selection persists across app restarts
- Syncs across all screens

### 3. **Video Library** 📚
- Filters videos by selected location
- Shows only videos tagged to that location
- Admin can upload videos for specific locations
- Preloads all videos for instant playback

### 4. **Surf Reports & Forecasts** 🌊
- Generates daily 5 AM reports for each location
- Uses location-specific NOAA data sources:
  - Buoy ID for wave data
  - Coordinates for weather
  - Tide Station ID for tide predictions
- Displays location-specific conditions

### 5. **Push Notifications** 🔔
- Users can subscribe to specific locations
- Receives daily reports for selected locations only
- Notifications sent at 5 AM EST per location

### 6. **Admin Data Manager** ⚙️
- Pull data for individual locations
- Generate reports for specific locations
- Bulk operations for all locations
- Test data sources per location

---

## 📋 How to Add a New Location (Step-by-Step)

### Step 1: Navigate to Admin Locations
1. Open the app as an admin
2. Go to **Admin** → **Manage Locations**

### Step 2: Click "Add New Location"
Fill in the form with:

#### **Location ID** (URL-friendly)
- Example: `myrtle-beach-sc`
- Must be lowercase with hyphens
- Cannot be changed after creation

#### **Location Name** (Short name)
- Example: `Myrtle Beach`
- Used in dropdowns and selectors

#### **Display Name** (Full name)
- Example: `Myrtle Beach, SC`
- Shown in UI headers and cards

#### **Latitude & Longitude**
- Get from Google Maps
- Example: `33.6891, -78.8867`
- Used for NOAA weather API

#### **NOAA Buoy ID**
- Find at: https://www.ndbc.noaa.gov/
- Search for nearest buoy to your location
- Example: `41013` (Frying Pan Shoals)
- Provides wave height, period, direction

#### **NOAA Tide Station ID**
- Find at: https://tidesandcurrents.noaa.gov/
- Search for nearest tide station
- Example: `8658163` (Wrightsville Beach)
- Provides tide predictions

### Step 3: Save and Test
1. Click **Save**
2. Location appears in the list
3. Click **Test Data** to verify NOAA sources
4. If all tests pass ✅, you're ready!

### Step 4: Activate and Use
1. Click **Activate** to make it visible to users
2. Upload videos tagged to this location
3. Generate daily reports in Admin Data Manager
4. Users can now select this location!

---

## 🔧 Technical Implementation

### Database Schema
```sql
CREATE TABLE locations (
  id TEXT PRIMARY KEY,                    -- e.g., "myrtle-beach-sc"
  name TEXT NOT NULL,                     -- e.g., "Myrtle Beach"
  display_name TEXT NOT NULL,             -- e.g., "Myrtle Beach, SC"
  latitude NUMERIC NOT NULL,              -- e.g., 33.6891
  longitude NUMERIC NOT NULL,             -- e.g., -78.8867
  buoy_id TEXT NOT NULL,                  -- e.g., "41013"
  tide_station_id TEXT NOT NULL,          -- e.g., "8658163"
  is_active BOOLEAN DEFAULT true,         -- Show/hide from users
  created_at TIMESTAMP DEFAULT NOW()
);
```

### How It Works

#### **LocationContext** (`contexts/LocationContext.tsx`)
- Fetches all active locations from database on app start
- Provides `currentLocation` (selected location ID)
- Provides `locationData` (full location details)
- Provides `locations` (array of all active locations)
- Provides `setLocation()` to switch locations
- Provides `refreshLocations()` to reload from database

#### **useVideos Hook** (`hooks/useVideos.ts`)
- Automatically filters videos by `currentLocation`
- Generates signed URLs for all videos
- Preloads videos for instant playback
- Updates when location changes

#### **useSurfData Hook** (`hooks/useSurfData.ts`)
- Fetches surf reports for `currentLocation`
- Fetches weather data for `currentLocation`
- Fetches tide data for `currentLocation`
- Updates when location changes

#### **Homepage** (`app/(tabs)/(home)/index.tsx`)
```typescript
const { videos } = useVideos();  // Filtered by currentLocation
const latestVideo = videos[0];   // Latest video for this location

// Video card automatically shows location-specific video
<TouchableOpacity onPress={() => handleVideoPress(latestVideo.id, latestVideo.signed_url)}>
  <ImageBackground source={latestVideo.thumbnail_url}>
    {/* Large video card with play button */}
  </ImageBackground>
</TouchableOpacity>
```

#### **Admin Data Manager** (`app/admin-data.tsx`)
- Loops through all locations
- Shows status for each location
- Provides individual "Pull Data" and "Generate Report" buttons
- Bulk action processes all locations

---

## 🎬 Video Library Integration

### How Videos Work with Locations

1. **Upload Video** (Admin)
   - Admin uploads video through Admin screen
   - Selects location from dropdown
   - Video is tagged with `location` field in database

2. **Homepage Video Card**
   - `useVideos()` fetches videos for `currentLocation`
   - Homepage displays `videos[0]` (latest video)
   - Thumbnail and signed URL are preloaded
   - Clicking opens fullscreen video player

3. **Videos Tab**
   - Shows all videos for `currentLocation`
   - Filtered automatically by location
   - Each video has thumbnail preview
   - Admin can delete videos

4. **Location Switching**
   - User selects different location
   - `useVideos()` refetches videos for new location
   - Homepage video card updates automatically
   - Videos tab updates automatically

### Example Flow
```
User selects "Holden Beach, NC"
  ↓
LocationContext updates currentLocation = "holden-beach-nc"
  ↓
useVideos() refetches: SELECT * FROM videos WHERE location = 'holden-beach-nc'
  ↓
Homepage shows latest Holden Beach video
Videos tab shows all Holden Beach videos
```

---

## 🔄 Daily Report Generation

### Automated 5 AM Process

Every day at 5:00 AM EST, the system:

1. **Fetches Fresh Data** (for each location)
   - NOAA Buoy data (wave height, period, direction)
   - NOAA Weather data (temperature, wind, conditions)
   - NOAA Tide data (high/low tide times)

2. **Generates Narrative** (for each location)
   - Analyzes surf conditions
   - Creates human-readable report
   - Calculates stoke rating (1-10)
   - Stores in `surf_reports` table with `location` field

3. **Sends Notifications** (per location)
   - Finds users subscribed to this location
   - Sends push notification with report summary
   - Only sends to users with notifications enabled

### Manual Generation (Admin)

Admins can manually trigger:
- **Individual Location**: "Pull Data" + "Generate Report" buttons
- **All Locations**: "Pull Data & Generate Reports (All Locations)" button

---

## 📊 Data Sources Per Location

Each location has its own NOAA data sources:

| Location | Buoy ID | Tide Station | Coordinates |
|----------|---------|--------------|-------------|
| Folly Beach, SC | 41004 | 8665530 | 32.6552, -79.9403 |
| Pawleys Island, SC | 41004 | 8662245 | 33.4318, -79.1192 |
| Holden Beach, NC | 41013 | 8659414 | 33.9140, -78.3070 |

When you add a new location, you specify these IDs, and the system automatically uses them for data fetching.

---

## 🧪 Testing a New Location

After adding a location, click **Test Data** to verify:

1. **Buoy Test** ✅
   - Fetches wave data from NOAA buoy
   - Verifies buoy is online and responding
   - Shows wave height, period, direction

2. **Weather Test** ✅
   - Fetches weather from NOAA using coordinates
   - Verifies weather API is responding
   - Shows temperature, wind, conditions

3. **Tide Test** ✅
   - Fetches tide data from NOAA tide station
   - Verifies station is online
   - Shows high/low tide times

If all tests pass, the location is ready to use!

---

## 🚀 Zero Code Changes Required

The system is **fully dynamic**. You can:
- Add unlimited locations
- Edit location details
- Activate/deactivate locations
- Delete locations

**No code changes needed!** Everything updates automatically through the database.

---

## 🎨 UI Components That Adapt

### LocationSelector Component
```typescript
// Automatically shows all active locations
const { locations, currentLocation, setLocation } = useLocation();

<Picker selectedValue={currentLocation} onValueChange={setLocation}>
  {locations.map(loc => (
    <Picker.Item key={loc.id} label={loc.displayName} value={loc.id} />
  ))}
</Picker>
```

### Homepage Video Card
```typescript
// Automatically shows latest video for current location
const { videos } = useVideos();  // Filtered by currentLocation
const latestVideo = videos[0];

{latestVideo && (
  <TouchableOpacity onPress={() => handleVideoPress(latestVideo.id, latestVideo.signed_url)}>
    <ImageBackground source={latestVideo.thumbnail_url}>
      <Text>SurfVista</Text>
      <PlayButton />
    </ImageBackground>
  </TouchableOpacity>
)}
```

### Report Screen
```typescript
// Automatically shows reports for current location
const { surfReports } = useSurfData();  // Filtered by currentLocation
const todayReport = surfReports.find(r => r.date === today);

<Text>{selectNarrativeText(todayReport)}</Text>
```

---

## 📱 User Experience

### For Regular Users:
1. Open app
2. See location selector at top
3. Select desired location
4. Homepage video card updates to show that location's latest video
5. All reports, forecasts, and videos update automatically

### For Admins:
1. Add new location through Admin Locations
2. Test data sources
3. Upload videos for that location
4. Generate daily reports
5. Location is now live for all users!

---

## 🔐 Security & Permissions

- Only **admins** can add/edit/delete locations
- Only **admins** can upload videos
- Only **admins** can generate reports manually
- Regular users can only view and switch locations

---

## 🎉 Summary

The SurfVista location system is **production-ready** and **fully functional**:

✅ Dynamic location management (no code changes)
✅ Homepage video card adapts to selected location
✅ Video library filters by location
✅ Reports and forecasts are location-specific
✅ Push notifications are location-specific
✅ Admin can test data sources before activating
✅ Unlimited locations supported
✅ Zero downtime when adding locations

**You can add new locations right now and they will work immediately!**
