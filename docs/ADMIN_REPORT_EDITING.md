
# Admin Report Editing Feature

## Overview
The SurfVista app now includes comprehensive admin capabilities to manually edit surf report text and improved automatic report generation with detailed wave descriptions.

## Features Added

### 1. Manual Report Editing
- **Edit Screen**: New `/edit-report` screen allows admins to customize surf report text
- **Database Schema**: Added `report_text`, `edited_by`, and `edited_at` columns to `surf_reports` table
- **Preservation**: Custom text is preserved when auto-reports regenerate
- **Reset Option**: Admins can reset to auto-generated text at any time

### 2. Improved Report Generation

#### Enhanced Wave Analysis
The `fetch-surf-reports` Edge Function now provides:
- **Detailed wave descriptions**: Size descriptions (knee-high, waist-high, chest-high, etc.)
- **Wave period analysis**: Long period vs short period swell quality assessment
- **Swell direction analysis**: Optimal angles for Folly Beach
- **Wind impact**: Offshore/onshore wind effects on wave quality
- **Skill level recommendations**: Beginner-friendly vs advanced conditions

#### Comprehensive Rating System
Improved 0-10 rating based on:
- Wave height (ideal: 3-6 ft)
- Wave period (ideal: 8+ seconds)
- Wind speed and direction
- Overall surfability

#### Detailed Conditions Text
Auto-generated reports now include:
- Wave size with body-part references (waist-high, chest-high, etc.)
- Wave period quality (clean vs choppy)
- Swell direction and beach angle analysis
- Wind conditions and effects
- Water temperature and wetsuit recommendations
- Tide information and timing
- Time-of-day recommendations
- Skill level suitability

### 3. UI Enhancements

#### Report Screen
- **Edit Button**: Admins see "Edit" button on each report
- **Custom Text Display**: Shows `report_text` if available, otherwise auto-generated `conditions`
- **Edit Indicator**: Shows "Edited [date]" when custom text is active

#### Admin Data Screen
- **Quick Edit Access**: Direct link to edit today's report
- **Custom Text Badge**: Visual indicator when custom text is active
- **Report Preview**: Shows current report data with all metrics

#### Edit Report Screen
- **Full Report Context**: Displays all wave metrics (height, period, wind, etc.)
- **Text Editor**: Large text input for detailed report writing
- **Character Counter**: Helps track report length
- **Auto-Generated Reference**: Shows original auto-generated text for reference
- **Save/Reset Options**: Save custom text or reset to auto-generated

## Usage

### For Admins

#### Editing a Report
1. Navigate to the Report tab
2. Click "Edit" button on any report card
3. Modify the report text in the editor
4. Click "Save Changes"

#### Resetting to Auto-Generated
1. Open the edit screen for a report
2. Click "Reset to Auto-Generated"
3. Confirm the action

#### Quick Edit from Admin Panel
1. Go to Admin Data screen
2. Click "Edit Report" button in the Surf Report Data card
3. Make your changes

### For Developers

#### Database Schema
```sql
-- New columns in surf_reports table
report_text TEXT -- Custom admin-edited text
edited_by UUID REFERENCES auth.users(id) -- Who edited it
edited_at TIMESTAMP WITH TIME ZONE -- When it was edited
```

#### Display Logic
```typescript
// In report display components
const displayText = report.report_text || report.conditions;
```

#### Preservation Logic
The `generate-daily-report` Edge Function checks for existing custom text:
```typescript
const { data: existingReport } = await supabase
  .from('surf_reports')
  .select('report_text, edited_by, edited_at')
  .eq('date', today)
  .maybeSingle();

if (existingReport?.report_text) {
  surfReport.report_text = existingReport.report_text;
  surfReport.edited_by = existingReport.edited_by;
  surfReport.edited_at = existingReport.edited_at;
}
```

## Data Sources

### NOAA Buoy 41004 (Edisto, SC)
The improved report generation uses comprehensive buoy data:
- **WVHT**: Significant wave height (meters)
- **DPD**: Dominant wave period (seconds)
- **APD**: Average wave period (seconds)
- **MWD**: Mean wave direction (degrees)
- **WSPD**: Wind speed (m/s)
- **WDIR**: Wind direction (degrees)
- **WTMP**: Water temperature (Celsius)
- **ATMP**: Air temperature (Celsius)

### Report Accuracy
The system now provides:
- Real-time buoy data from NOAA
- Detailed wave quality analysis
- Location-specific recommendations for Folly Beach
- Skill-level appropriate guidance
- Tide timing and effects
- Weather context integration

## Benefits

1. **Flexibility**: Admins can add local knowledge and observations
2. **Accuracy**: Improved auto-generation provides detailed, reliable reports
3. **Consistency**: Auto-reports maintain quality when admin editing isn't needed
4. **Transparency**: Clear indication when reports are manually edited
5. **Preservation**: Custom edits aren't lost during auto-updates

## Future Enhancements

Potential improvements:
- Bulk editing for multiple days
- Report templates for common conditions
- Photo/video attachments to reports
- User feedback integration
- Historical report comparison
- AI-assisted report suggestions based on patterns
