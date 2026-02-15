
# SurfVista Data Flow Architecture

## 🎯 Core Principle
**The report generator NEVER pulls fresh data from the buoy. It ONLY uses existing data from the database that was already fetched by scheduled updates.**

## 📊 Complete Data Flow

### 1. Scheduled Data Updates (Automatic)
```
CRON Job (6 AM EST daily)
    ↓
Calls: daily-6am-report-with-retry Edge Function
    ↓
Fetches fresh data from external APIs:
    • NOAA Buoy (wave height, period, swell direction, wind, water temp)
    • NOAA Weather Service (air temp, conditions, forecast)
    • NOAA Tides & Currents (tide times and heights)
    ↓
Stores in database tables:
    • surf_conditions (buoy data)
    • weather_data (weather data)
    • tide_data (tide schedules)
    • weather_forecast (7-day forecast)
    ↓
Generates narrative using this fresh data
    ↓
Stores in surf_reports table
    ↓
Sends push notifications to subscribers
```

### 2. Report Page Display (Real-time)
```
User opens Report page
    ↓
Queries database tables:
    • surf_conditions (most recent entry for today)
    • weather_data (today's weather)
    • tide_data (today's tides)
    • surf_reports (today's narrative)
    ↓
Displays all data to user
    ↓
Calculates Stoke Rating from surf_conditions data
```

### 3. Manual Report Generation (Admin Only)
```
Admin clicks "Regenerate Text" button
    ↓
Calls: daily-6am-report-with-retry Edge Function
    WITH: isManualTrigger = true
    ↓
Edge Function queries database ONLY (NO API CALLS):
    • surf_conditions (most recent for today)
    • weather_data (today's weather)
    • tide_data (today's tides)
    ↓
Uses this EXISTING data to regenerate narrative
    ↓
Updates surf_reports.conditions with new narrative
    ↓
Report page displays updated narrative
```

## 🔑 Key Points

### ✅ What Manual Report Generator DOES:
- Pulls data from `surf_conditions`, `weather_data`, `tide_data` tables
- Uses the SAME data that's already displayed on the report page
- Regenerates the narrative text using this existing data
- Updates the `surf_reports.conditions` field with new narrative
- Fast and reliable (no external API dependencies)

### ❌ What Manual Report Generator DOES NOT DO:
- Does NOT fetch fresh data from NOAA buoy
- Does NOT call external weather APIs
- Does NOT call external tide APIs
- Does NOT update surf_conditions, weather_data, or tide_data tables
- Does NOT send push notifications

### 🎯 Why This Architecture?
1. **Consistency**: Report generator uses the exact same data users see on the report page
2. **Reliability**: No dependency on external API availability during manual generation
3. **Speed**: Database queries are instant vs. waiting for external APIs
4. **Separation of Concerns**: 
   - Scheduled jobs handle data fetching
   - Manual generator handles narrative regeneration only
5. **Data Freshness**: Report page always shows the most recent data from scheduled updates

## 🔄 Data Update Schedule

### Automatic Updates:
- **6:00 AM EST Daily**: Full data pull + narrative generation + push notifications
- **Buoy Updates**: Every 20-50 minutes (varies by buoy)
- **Weather Updates**: Every 1-3 hours (NOAA schedule)

### Manual Updates (Admin Panel):
- **"Update Data" button**: Pulls fresh data from all external APIs
- **"Update Forecast" button**: Regenerates 7-day forecast using trend analysis
- **"Regenerate Text" button**: Regenerates narrative using existing database data

## 📱 Frontend Data Sources

### Home Page:
- Primary: `surf_conditions` table (most recent)
- Fallback: `surf_reports` table (if no surf_conditions)
- Weather: `weather_data` table
- Forecast: `weather_forecast` table

### Report Page:
- Primary: `surf_conditions` table (most recent)
- Fallback: `surf_reports` table (if no surf_conditions)
- Weather: `weather_data` table
- Tides: `tide_data` table
- Narrative: `surf_reports.conditions` or `surf_reports.report_text` (if edited)

### Forecast Page:
- Primary: `weather_forecast` table (7 days)
- Fallback: `surf_reports` table (historical data)

## 🛠️ Admin Tools

### Update Data (Pull Fresh Data):
```typescript
// Calls: update-all-surf-data Edge Function
// Fetches: Fresh data from NOAA APIs
// Updates: surf_conditions, weather_data, tide_data tables
```

### Update Forecast (Regenerate 7-Day):
```typescript
// Calls: fetch-surf-forecast Edge Function
// Uses: Historical data + trend analysis
// Updates: weather_forecast table
```

### Regenerate Text (Narrative Only):
```typescript
// Calls: daily-6am-report-with-retry Edge Function
// WITH: isManualTrigger = true
// Uses: Existing data from surf_conditions, weather_data, tide_data
// Updates: surf_reports.conditions field ONLY
```

## 🔍 Debugging

### If narrative is not updating:
1. Check `surf_conditions` table has data for today
2. Check `weather_data` table has data for today
3. Check `tide_data` table has data for today
4. If any are missing, use "Update Data" button first
5. Then use "Regenerate Text" button

### If data is stale:
1. Use "Update Data" button to pull fresh data from buoy
2. Wait for scheduled 6 AM update
3. Or manually trigger data pull from admin panel

### If forecast is wrong:
1. Use "Update Forecast" button to regenerate 7-day forecast
2. Check if historical data exists for trend analysis
3. Forecast uses trend-based predictions, not random variations

## 📝 Code Locations

### Edge Functions:
- `supabase/functions/daily-6am-report-with-retry/index.ts` - Report generation
- `supabase/functions/fetch-surf-reports/index.ts` - Buoy data fetching
- `supabase/functions/fetch-weather-data/index.ts` - Weather data fetching
- `supabase/functions/fetch-tide-data/index.ts` - Tide data fetching
- `supabase/functions/fetch-surf-forecast/index.ts` - 7-day forecast generation

### Frontend:
- `app/(tabs)/(home)/index.tsx` - Home page (displays surf_conditions)
- `app/(tabs)/report.tsx` - Report page (displays surf_conditions + narrative)
- `app/(tabs)/forecast.tsx` - Forecast page (displays weather_forecast)
- `app/admin-data.tsx` - Admin data management panel

### Hooks:
- `hooks/useSurfData.ts` - Fetches and manages surf data from database

### Utils:
- `utils/surfDataFormatter.ts` - Date formatting and data parsing
- `utils/reportNarrativeSelector.ts` - Selects correct narrative (edited vs auto)

## ✅ Verification Checklist

When testing manual report generation:
- [ ] Check admin panel logs show "Using EXISTING data from database"
- [ ] Check admin panel logs show "NOT pulling fresh data from buoy"
- [ ] Check Edge Function logs show "MANUAL TRIGGER MODE ACTIVATED"
- [ ] Check Edge Function logs show "Using database data ONLY, no fresh API calls"
- [ ] Verify narrative updates on report page after generation
- [ ] Verify narrative updates on home page after generation
- [ ] Verify Stoke Rating matches the data shown on report page
- [ ] Verify no external API calls are made during manual generation

## 🎉 Success Indicators

Manual report generation is working correctly when:
1. Admin panel shows "Used existing data from database (no fresh buoy pull)"
2. Edge Function logs show "MANUAL TRIGGER MODE ACTIVATED"
3. Narrative appears on report page within 2-3 seconds
4. Narrative appears on home page within 2-3 seconds
5. Stoke Rating matches the wave height/period/wind shown on page
6. No "Failed to fetch" errors in logs
7. Activity log shows "Generated X character narrative"
