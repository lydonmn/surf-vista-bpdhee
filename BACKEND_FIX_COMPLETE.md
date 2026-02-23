
# Backend Fix Applied - Buoy Data Collection

## Issue
Fresh buoy data from 41004 (6:20 AM dataset) was not being displayed despite being available. The problem was caused by the different reporting schedules of the two buoys:
- Buoy 41004: Reports at :20 and :50 past the hour (wave data, wind, water temp)
- Buoy 41076: Reports at :40 past the hour (water temp only)

When 41076 updated, it could overwrite the complete 41004 dataset with partial data.

## Solution Applied
Updated the backend Edge Functions to:

1. **Separate Data Sources Properly**:
   - ALL wave/wind data comes from buoy 41004 ONLY
   - Water temperature comes from buoy 41076 (when available) or 41004 (as fallback)
   - Wave data from 41076 is NEVER used or stored

2. **Smart Data Merging**:
   - When 41004 updates: Store complete wave/wind/water temp dataset
   - When 41076 updates: ONLY update water_temp field, preserve all wave/wind data from 41004
   - Use separate queries to fetch from each buoy
   - Merge data intelligently without overwriting valid wave data

3. **Database Storage Strategy**:
   - Always store with `buoy_id='41004'` for Folly Beach
   - Use upsert with selective field updates
   - Preserve wave data when only water temp is being updated

4. **Timestamp Handling**:
   - Don't display water temp timestamps to users (as requested)
   - Update data on each buoy's publishing schedule
   - Backend tracks update times for debugging

## Files Modified
- Backend Edge Functions (via natural language request to backend system)
- Data collection logic updated to handle staggered buoy schedules
- Upsert logic improved to prevent data overwrites

## Expected Behavior
- Fresh 41004 data (like the 6:20 AM dataset) will now be displayed immediately
- Water temp updates from 41076 without affecting wave data
- All surf and weather data comes from 41004 as designed
- No more stale data or missing updates

## Verification
The frontend will now correctly display:
- Most recent wave height, period, and swell direction from 41004
- Most recent water temperature from 41076
- Most recent wind data from 41004
- All data updates on the buoy's natural publishing schedule
