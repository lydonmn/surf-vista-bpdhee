
# Surf Report Generation Algorithm

## Overview
The SurfVista app uses a sophisticated algorithm to generate accurate, detailed surf reports from NOAA buoy data. This document explains how the system analyzes wave conditions and produces human-readable reports.

## Data Sources

### NOAA Buoy 41004 (Edisto, SC)
- **Location**: 32.5°N 79.1°W (approximately 40 miles offshore from Folly Beach)
- **Update Frequency**: Hourly
- **Data Points Used**:
  - WVHT: Significant wave height (meters)
  - DPD: Dominant wave period (seconds)
  - APD: Average wave period (seconds)
  - MWD: Mean wave direction (degrees)
  - WSPD: Wind speed (m/s)
  - WDIR: Wind direction (degrees)
  - WTMP: Water temperature (°C)
  - ATMP: Air temperature (°C)

## Rating Algorithm (0-10 Scale)

### Base Rating Calculation

```typescript
let rating = 5; // Default starting point

// Wave height and period analysis
if (waveHeight && period) {
  // Ideal conditions: 3-6 ft (0.9-1.8m) with 8+ second period
  if (waveHeight >= 0.9 && waveHeight <= 1.8 && period >= 8) {
    rating = 9; // Excellent
  } 
  else if (waveHeight >= 0.6 && waveHeight <= 0.9 && period >= 7) {
    rating = 7; // Good
  } 
  else if (waveHeight >= 0.4 && waveHeight <= 0.6) {
    rating = 5; // Fair
  } 
  else if (waveHeight < 0.4) {
    rating = 3; // Small/flat
  } 
  else if (waveHeight > 2.5) {
    rating = 6; // Big but challenging
  }
}
```

### Period Adjustments

```typescript
// Short period reduces quality (wind swell)
if (period < 6) {
  rating = Math.max(1, rating - 2);
}

// Long period improves quality (ground swell)
if (period >= 10) {
  rating = Math.min(10, rating + 1);
}
```

### Wind Adjustments

```typescript
// Strong winds significantly reduce quality
if (windSpeed > 15) {
  rating = Math.max(1, rating - 3);
}
// Moderate winds reduce quality
else if (windSpeed > 10) {
  rating = Math.max(1, rating - 1);
}
// Light winds improve quality
else if (windSpeed < 5) {
  rating = Math.min(10, rating + 1);
}
```

## Wave Description Generation

### Size Categories

| Wave Height (ft) | Description | Body Reference |
|-----------------|-------------|----------------|
| < 2 | Small waves | 1-2 foot range |
| 2-3 | Knee to waist high | 2-3 feet |
| 3-4 | Waist to chest high | 3-4 feet |
| 4-5 | Chest to head high | 4-5 feet |
| 5-6 | Head high to overhead | 5-6 feet |
| 6+ | Overhead | [X] feet |

### Period Quality Analysis

| Period (seconds) | Quality | Description |
|-----------------|---------|-------------|
| < 6 | Poor | Very short period, choppy wind swell |
| 6-8 | Fair | Short to moderate period, less organized |
| 8-10 | Good | Moderate period, consistent waves |
| 10+ | Excellent | Long period, clean well-formed waves |

### Swell Direction Analysis (Folly Beach Specific)

Folly Beach faces Southeast (SE), making certain swell directions more favorable:

| Direction | Angle | Quality | Description |
|-----------|-------|---------|-------------|
| SE-S | 135-180° | Ideal | Direct hit, favorable angle |
| E-ESE | 90-135° | Good | Decent with side-shore influence |
| S-SSW | 180-225° | Good | Good angle with wrap |
| Other | - | Variable | Less optimal angles |

### Wind Analysis

#### Wind Speed Effects

| Speed (mph) | Effect | Description |
|------------|--------|-------------|
| < 5 | Excellent | Glassy, clean conditions |
| 5-10 | Good | Gentle winds, relatively clean |
| 10-15 | Fair | Moderate winds, some texture |
| 15-20 | Poor | Strong winds, choppy/blown-out |
| 20+ | Very Poor | Very strong winds, challenging |

#### Wind Direction Effects (Folly Beach)

- **Offshore (W-NW, 270-45°)**: Grooms waves, improves shape ⭐
- **Cross-shore (N-NE, E-SE, 45-135°)**: Neutral effect
- **Onshore (SE-S, 135-225°)**: Degrades quality, creates chop ❌

## Skill Level Recommendations

```typescript
if (waveHeightFt < 2) {
  recommendation = "Ideal for beginners and longboarders";
}
else if (waveHeightFt < 4) {
  recommendation = "Good for all skill levels";
}
else if (waveHeightFt < 6) {
  recommendation = "Best for intermediate to advanced";
}
else {
  recommendation = "Experienced surfers only";
}
```

## Water Temperature Recommendations

| Temp (°F) | Wetsuit | Description |
|-----------|---------|-------------|
| < 60 | Full 4/3mm | Cold - full wetsuit required |
| 60-68 | 3/2mm | Cool - wetsuit recommended |
| 68-75 | Spring suit | Comfortable - spring suit or shorts |
| 75+ | Boardshorts | Warm - boardshorts weather |

## Tide Analysis

### Tide Timing
- Calculates time until next tide
- Provides countdown in minutes
- Explains tide effects on surf quality

### Tide Height Analysis
```typescript
const avgHeight = tides.reduce((sum, t) => sum + t.height, 0) / tides.length;

if (avgHeight > 5.5) {
  analysis = "Higher than average tides today";
}
else if (avgHeight < 4.5) {
  analysis = "Lower than average tides today";
}
```

### Tide Recommendations
- **Low Tide**: Better wave shape, exposed sandbars
- **High Tide**: Deeper water, may cover sandbars
- **Mid Tide**: Often optimal for most conditions

## Time-of-Day Recommendations

```typescript
const hour = new Date().getHours();

if (hour < 10) {
  recommendation = "Early morning sessions offer cleanest conditions";
}
else if (hour > 16) {
  recommendation = "Evening sessions as winds calm down";
}
```

## Example Report Generation

### Input Data
```
Wave Height: 1.2m (3.9 ft)
Period: 9 seconds
Direction: 150° (SSE)
Wind: 7 mph from W
Water Temp: 68°F
```

### Generated Report
```
"Waist to chest high waves around 3-4 feet are currently breaking at 
Folly Beach. Moderate period swell at 9 seconds is generating consistent 
waves with decent shape. Swell is coming from the SSE. This is an ideal 
swell direction for Folly Beach, hitting the beach at a favorable angle. 
Gentle W winds at 7 mph are maintaining relatively clean wave faces. 
Offshore winds are grooming the waves and improving shape. Water 
temperature is comfortable - spring suit or boardshorts. Good for all 
skill levels from beginners to advanced."

Rating: 8/10
```

## Accuracy Considerations

### Strengths
- ✅ Real-time NOAA data
- ✅ Location-specific analysis
- ✅ Multiple data points considered
- ✅ Detailed wave quality assessment
- ✅ Skill-level appropriate guidance

### Limitations
- ⚠️ Buoy is 40 miles offshore (conditions may vary at beach)
- ⚠️ Local factors (sandbars, crowds) not captured
- ⚠️ Weather can change rapidly
- ⚠️ Buoy data may have gaps or errors

### Best Practices
1. **Combine with local observation**: Admin edits add on-the-ground intel
2. **Update regularly**: Conditions change throughout the day
3. **Consider forecast**: Look at upcoming weather patterns
4. **Know your spots**: Different beach locations have different characteristics
5. **Safety first**: Always err on the side of caution in recommendations

## Future Improvements

### Potential Enhancements
1. **Multiple buoys**: Combine data from several sources
2. **Historical patterns**: Learn from past conditions
3. **Machine learning**: Improve accuracy over time
4. **Webcam integration**: Visual confirmation of conditions
5. **User feedback**: Incorporate surfer reports
6. **Spot-specific models**: Different algorithms for different breaks
7. **Swell forecasting**: Predict conditions days in advance

### Data Quality Improvements
1. **Outlier detection**: Filter bad data points
2. **Interpolation**: Fill gaps in buoy data
3. **Validation**: Cross-reference multiple sources
4. **Confidence scores**: Indicate data reliability

---

**Algorithm Version**: 2.0
**Last Updated**: January 2025
**Maintained By**: SurfVista Development Team
