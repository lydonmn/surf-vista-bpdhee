# SurfVista

This app was built using [Natively.dev](https://natively.dev) - a platform for creating mobile apps.

Made with 💙 for creativity.

---

## Recent Fix: 7-Day Forecast Auto-Update (Feb 19, 2025)

**Issue:** The 7-day forecast was not updating to include new future days as time moved forward. For example, if the forecast was generated on Feb 19 showing days through Feb 25, on Feb 20 it would still only show through Feb 25 instead of Feb 26.

**Root Cause:** The `daily-6am-report-with-retry` Edge Function (which runs daily at 6 AM EST) was only generating the daily surf report narrative but was NOT regenerating the 7-day forecast. This meant the forecast data became stale.

**Solution:** Updated the `daily-6am-report-with-retry` function to also call `fetch-surf-forecast` for each location after generating the daily report. Now every day at 6 AM EST, the system:
1. Generates the daily surf report narrative
2. Generates a fresh 7-day forecast (which includes new future days)

**Result:** The forecast now automatically updates daily to always show the next 7 days ahead, ensuring users always see current and future forecast data.
