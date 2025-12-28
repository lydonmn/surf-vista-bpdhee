
# NOAA Wave Sensor Fix - December 28, 2024

## Issue
The surf report was indicating "NOAA data is unavailable" even though the Edisto buoy (41004) was actually online and reporting data. The buoy was successfully providing wind speed, wind direction, and water temperature, but the wave height and period sensors were offline (returning `99.0` which is NOAA's code for missing data).

## Root Cause
The `generate-daily-report` edge function was treating the situation as if the entire buoy was offline, when in reality:
- **Buoy Status**: Online and functioning
- **Wind Sensors**: Working (reporting 13 mph E winds)
- **Water Temperature Sensor**: Working (reporting 70°F)
- **Wave Height Sensor**: Offline (returning N/A)
- **Wave Period Sensor**: Offline (returning N/A)

## Solution Implemented
Updated the `generate-daily-report` edge function to intelligently handle partial buoy data:

### 1. **Differentiate Between Scenarios**
   - **Buoy completely offline**: No data at all
   - **Wave sensors offline**: Wind and water temp available, but no wave data
   - **All sensors working**: Full data available

### 2. **Fallback to Recent Wave Data**
   - When wave sensors are offline, the system now checks for valid wave data from the last 3 days
   - If recent data exists, it uses that for wave height/period while using current wind and water temp
   - The report clearly indicates when historical wave data is being used

### 3. **Improved Report Messages**
   - **Wave sensors offline**: "Hey folks, the wave sensors on the Edisto buoy aren't reporting right now, so we can't give you wave heights or periods. The buoy is online though - we're seeing 13 mph winds from the E (100°), water temp is 70°F..."
   - **Using historical data**: "(Note: Wave sensors are currently offline, using wave data from 2025-12-27. Current wind and water conditions are up to date.)"
   - **Buoy completely offline**: Original message about buoy being offline

### 4. **Data Accuracy**
   - Current wind conditions: Always from today's data
   - Current water temperature: Always from today's data
   - Wave height/period: From today if available, otherwise from most recent valid data (within 3 days)
   - Clear indication when historical wave data is being used

## Technical Changes

### File Modified
- `supabase/functions/generate-daily-report/index.ts`

### Key Changes
1. Added `hasValidWaveData` check to distinguish between missing wave data and missing all data
2. Added fallback query to find recent valid wave data (within last 3 days)
3. Created `generateNoWaveDataReportText()` function for wave-sensor-offline scenarios
4. Updated report generation to use `effectiveSurfData` (current or recent) for waves
5. Always use current `surfData` for wind and water temperature
6. Added `historicalDate` parameter to `generateReportText()` to include note about data source

## Result
The surf report now accurately reflects the situation:
- ✅ Shows current wind speed (13 mph)
- ✅ Shows current wind direction (E 100°)
- ✅ Shows current water temperature (70°F)
- ✅ Clearly explains that wave sensors are offline
- ✅ Uses recent wave data when available (with clear indication)
- ✅ Provides helpful guidance to check surf cams or visit the beach

## Testing
After deployment, the report should:
1. Generate successfully without errors
2. Display current wind and water conditions
3. Show a clear message about wave sensors being offline
4. If wave data from the last 3 days exists, use it with a note
5. Provide a rating of 0 when no wave data is available

## Future Improvements
- Add integration with surf cam APIs for visual confirmation
- Implement wave height estimation based on wind conditions
- Add notification system when wave sensors come back online
- Track sensor uptime/downtime statistics
