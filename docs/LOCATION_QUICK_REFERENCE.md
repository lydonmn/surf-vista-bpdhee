
# 🚀 Quick Reference: Adding New Locations

## ⚡ 5-Minute Setup

### 1. Add Location (2 min)
```
Admin Panel → Manage Locations → + Add New Location

Required Info:
- ID: myrtle-beach-sc (lowercase, hyphens)
- Name: Myrtle Beach
- Display: Myrtle Beach, SC
- Lat/Lon: From Google Maps
- Buoy ID: From ndbc.noaa.gov
- Tide Station: From tidesandcurrents.noaa.gov
```

### 2. Test Data Sources (1 min)
```
Click "Test Data" button
Verify: ✅ Buoy, ✅ Weather, ✅ Tides
```

### 3. Upload First Video (2 min)
```
Admin Panel → Upload Video
Select location → Upload drone footage
```

### 4. Generate Report (30 sec)
```
Admin Panel → Update Surf Data
Click "Generate Report" for new location
```

### ✅ Done! Location is Live

---

## 🎯 What Works Automatically

| Feature | Status | Notes |
|---------|--------|-------|
| Location Selector | ✅ Auto | Appears in dropdown immediately |
| Homepage Video Card | ✅ Auto | Shows latest video for location |
| Video Library | ✅ Auto | Filters videos by location |
| Surf Reports | ✅ Auto | Location-specific reports |
| Weather Forecast | ✅ Auto | Location-specific forecasts |
| Daily 5 AM Reports | ✅ Auto | Generates for all active locations |
| Push Notifications | ✅ Auto | Users can subscribe per location |
| Admin Data Manager | ✅ Auto | Per-location controls |

---

## 🔍 Find NOAA IDs

### Buoy ID (ndbc.noaa.gov)
1. Click "Station Map"
2. Find nearest buoy to your surf spot
3. Click buoy → Note the ID (e.g., `41013`)
4. Verify it reports: Wave Height, Period, Water Temp

### Tide Station ID (tidesandcurrents.noaa.gov)
1. Search for your location
2. Find nearest station
3. Note the Station ID (e.g., `8659414`)
4. Verify it reports tide predictions

### Coordinates (Google Maps)
1. Right-click on surf spot
2. Copy coordinates
3. Format: `33.9140, -78.3070`

---

## 📊 Example Locations

### Folly Beach, SC
```
ID: folly-beach
Name: Folly Beach
Display: Folly Beach, SC
Buoy: 41004 (Edisto)
Tide Station: 8665530 (Charleston)
Coordinates: 32.6552, -79.9403
```

### Pawleys Island, SC
```
ID: pawleys-island
Name: Pawleys Island
Display: Pawleys Island, SC
Buoy: 41004 (Edisto)
Tide Station: 8662245 (Springmaid Pier)
Coordinates: 33.4318, -79.1192
```

### Holden Beach, NC
```
ID: holden-beach-nc
Name: Holden Beach
Display: Holden Beach, NC
Buoy: 41013 (Frying Pan Shoals)
Tide Station: 8659414 (Lockwoods Folly)
Coordinates: 33.9140, -78.3070
```

---

## 🎥 Homepage Video Card Flow

```
User opens app
  ↓
Selects location (e.g., "Holden Beach")
  ↓
Homepage queries: SELECT * FROM videos WHERE location = 'holden-beach-nc' ORDER BY created_at DESC LIMIT 1
  ↓
Displays latest video in large card
  ↓
User taps video → Opens fullscreen player with preloaded URL
```

**Key Points:**
- Each location has its own video library
- Homepage shows the **most recent** video for selected location
- Videos are preloaded for instant playback
- If no videos exist for a location, card is hidden

---

## 🔧 Troubleshooting

### Location Not Showing
- ✅ Check: Is location marked as "Active"?
- ✅ Check: Did you refresh the app?
- ✅ Fix: Toggle active status or restart app

### No Videos for Location
- ✅ Check: Have you uploaded videos for this location?
- ✅ Check: Are videos tagged to the correct location?
- ✅ Fix: Upload videos through Admin Panel

### Data Test Fails
- ✅ Buoy Fail: Verify buoy ID is correct
- ✅ Weather Fail: Verify coordinates are correct
- ✅ Tide Fail: Verify tide station ID is correct
- ✅ Note: Some buoys have offline wave sensors (wind/temp still work)

---

## 📱 User Experience

### Switching Locations
1. User taps location selector on homepage
2. Modal shows all active locations
3. User selects new location
4. Homepage updates:
   - Video card shows latest video for new location
   - Surf report shows conditions for new location
   - All tabs filter by new location
5. Selection is saved and persists

### Video Library
- Videos tab shows only videos for current location
- Each location maintains separate video library
- Users can switch locations to see different videos

---

## 🎯 Best Practices

### Location IDs
- Use lowercase with hyphens
- Include state/region for clarity
- Examples: `myrtle-beach-sc`, `ocean-isle-nc`, `topsail-beach-nc`

### Display Names
- Use proper capitalization
- Include state/region
- Examples: `Myrtle Beach, SC`, `Ocean Isle, NC`, `Topsail Beach, NC`

### Buoy Selection
- Choose nearest buoy (within 50 miles is fine)
- Multiple locations can share same buoy
- Verify buoy reports wave data

### Video Uploads
- Upload regularly for each location
- Use descriptive titles with dates
- Tag to correct location

---

## 🚀 Quick Commands

### Add Location
```
Admin → Manage Locations → + Add New Location
```

### Upload Video
```
Admin → Upload Video → Select Location → Upload
```

### Generate Report
```
Admin → Update Surf Data → [Location] → Generate Report
```

### Test Data
```
Admin → Manage Locations → [Location] → Test Data
```

---

**System Version**: 7.0  
**Last Updated**: January 2025  
**Status**: ✅ Fully Functional
