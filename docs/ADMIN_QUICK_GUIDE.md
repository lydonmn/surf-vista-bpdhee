
# Admin Quick Reference Guide

## Editing Surf Reports

### Quick Steps
1. **View Reports**: Go to Report tab
2. **Click Edit**: Tap the "Edit" button on any report
3. **Write Your Report**: Add detailed surf conditions
4. **Save**: Click "Save Changes"

### What to Include in Reports

#### Wave Description
- Size (use body references: knee-high, waist-high, chest-high, overhead)
- Quality (clean, choppy, mushy, hollow)
- Consistency (sets every X minutes)
- Shape (peaky, walled up, sectiony)

#### Swell Information
- Direction (SE, S, SW, etc.)
- Period (short period wind swell vs long period ground swell)
- How it's hitting the beach

#### Wind Conditions
- Speed and direction
- Effect on waves (offshore = clean, onshore = choppy)
- Expected changes throughout the day

#### Tide Information
- Current tide and next tide
- Best tide for surfing today
- How tide affects the sandbars

#### Water Conditions
- Temperature
- Clarity
- Currents or rips

#### Recommendations
- Best spots on the beach
- Skill level suitability
- Best time of day to surf
- Equipment suggestions (board type, wetsuit)

### Example Report

**Good Example:**
"Waist to chest high waves are breaking consistently at Folly Beach this morning. Clean SE swell at 8-10 seconds is producing well-formed waves with good shape. Light offshore winds at 5-8 mph are grooming the faces nicely. The Washout is showing the best shape with peaky lefts and rights. Mid to low tide is optimal today. Water temp is 68°F - bring a spring suit. Great conditions for intermediate to advanced surfers. Sets are coming through every 8-10 minutes. Get out there early before the wind picks up this afternoon!"

**Avoid:**
"Waves are okay. Go surf."

## Data Management

### Updating All Data
1. Go to Admin Data screen
2. Click "Update All Data"
3. Wait for completion (usually 30-60 seconds)

### Individual Updates
- **Weather**: Updates current conditions and 7-day forecast
- **Tides**: Fetches today's tide schedule
- **Surf Reports**: Gets latest buoy data
- **Generate Report**: Combines all data into daily report

### Troubleshooting

#### No Data Showing
1. Check data counts in Admin Data screen
2. Click "Update All Data"
3. Check Activity Log for errors

#### Tide Data Missing
1. Click "Fetch Tide Data" individually
2. Check if NOAA API is responding
3. Verify date is correct

#### Surf Report Not Generating
1. Ensure weather data exists (fetch weather first)
2. Ensure surf data exists (fetch surf reports)
3. Then click "Generate Daily Report"

## Best Practices

### Daily Routine
1. **Morning** (6-7 AM):
   - Update all data
   - Review auto-generated report
   - Edit report with local observations
   - Add any special conditions or warnings

2. **Midday** (12-1 PM):
   - Check if conditions changed
   - Update report if needed
   - Note any wind changes

3. **Evening** (5-6 PM):
   - Update for evening session
   - Note sunset conditions
   - Preview tomorrow's forecast

### Report Quality Tips
- Be specific with measurements
- Use local spot names
- Include safety warnings when needed
- Mention crowds if relevant
- Update if conditions change significantly
- Add personality but stay informative

### What Makes a Great Report
✅ Detailed wave descriptions
✅ Specific locations on the beach
✅ Time-sensitive information
✅ Skill level guidance
✅ Equipment recommendations
✅ Safety notes

❌ Vague descriptions
❌ Just repeating auto-generated text
❌ Missing key information
❌ Outdated information

## Keyboard Shortcuts (Web)
- **Ctrl/Cmd + S**: Save report (when in edit screen)
- **Esc**: Cancel/Go back

## Mobile Tips
- Use voice-to-text for faster report writing
- Take photos at the beach for reference
- Save common phrases in your notes app
- Edit reports right from the beach

## Support
If you encounter issues:
1. Check Activity Log in Admin Data screen
2. Try refreshing data
3. Check NOAA website directly to verify data availability
4. Contact support with specific error messages
