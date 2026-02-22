
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { WeatherData, SurfReport } from '@/types';
import { formatWaterTemp } from '@/utils/surfDataFormatter';

interface CurrentConditionsProps {
  weather: WeatherData | null;
  surfReport: SurfReport | null;
}

export function CurrentConditions({ weather, surfReport }: CurrentConditionsProps) {
  const theme = useTheme();

  const surfHeightDisplay = surfReport?.surf_height;
  
  console.log('[CurrentConditions] Wave data:', {
    surf_height: surfReport?.surf_height,
    wave_height: surfReport?.wave_height,
    displayValue: surfHeightDisplay,
    reportId: surfReport?.id,
    reportDate: surfReport?.date,
    rating: surfReport?.rating,
  });

  const waterTempFormatted = formatWaterTemp(surfReport?.water_temp);

  const isDataCurrent = () => {
    if (!surfReport?.date) return true;
    
    const now = new Date();
    const estDateString = now.toLocaleDateString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const [month, day, year] = estDateString.split('/');
    const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    const reportDate = surfReport.date.split('T')[0];
    return reportDate === today;
  };

  const dataIsCurrent = isDataCurrent();

  if (!weather && !surfReport) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Current Conditions
          </Text>
        </View>
        <View style={styles.emptyState}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="warning"
            size={48}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No data available yet
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Pull down to refresh
          </Text>
        </View>
      </View>
    );
  }

  // 🚨 CRITICAL FIX: Improved validation function that handles string numbers correctly
  const isValidValue = (val: any) => {
    // Null or undefined check
    if (val === null || val === undefined) {
      console.log('[CurrentConditions] isValidValue: null/undefined → false');
      return false;
    }
    
    // String handling
    if (typeof val === 'string') {
      const trimmed = val.trim();
      
      // Empty string check
      if (trimmed === '') {
        console.log('[CurrentConditions] isValidValue: empty string → false');
        return false;
      }
      
      // Case-insensitive "N/A" check
      if (trimmed.toLowerCase() === 'n/a') {
        console.log('[CurrentConditions] isValidValue: "N/A" string → false');
        return false;
      }
      
      // Valid string (including numeric strings like "17", "18", etc.)
      console.log('[CurrentConditions] isValidValue: valid string →', trimmed, '→ true');
      return true;
    }
    
    // Number handling (including 0)
    if (typeof val === 'number') {
      const isValid = !isNaN(val);
      console.log('[CurrentConditions] isValidValue: number →', val, '→', isValid);
      return isValid;
    }
    
    // Default: accept other types
    console.log('[CurrentConditions] isValidValue: other type →', typeof val, '→ true');
    return true;
  };

  const temperatureDisplay = weather?.temperature ? `${Math.round(Number(weather.temperature))}°F` : '--';
  const weatherConditionsDisplay = weather?.conditions || '';
  
  // 🚨 CRITICAL FIX: Prioritize weather_data for wind, handle string numbers correctly
  const windSpeedRaw = isValidValue(weather?.wind_speed) 
    ? weather.wind_speed 
    : (isValidValue(surfReport?.wind_speed) ? surfReport.wind_speed : null);
  
  const windDirectionRaw = isValidValue(weather?.wind_direction)
    ? weather.wind_direction
    : (isValidValue(surfReport?.wind_direction) ? surfReport.wind_direction : null);
  
  // Format wind speed (handle both string and number)
  const windSpeedDisplay = windSpeedRaw 
    ? (typeof windSpeedRaw === 'string' && windSpeedRaw.includes('mph') 
        ? windSpeedRaw  // Already formatted (e.g., "12 mph")
        : `${Math.round(Number(windSpeedRaw))} mph`)  // Format number or numeric string
    : '--';
  
  // Format wind direction (trim whitespace)
  const windDirectionDisplay = windDirectionRaw 
    ? String(windDirectionRaw).trim()
    : '';
  
  const humidityDisplay = weather?.humidity ? `${weather.humidity}%` : '--';
  
  console.log('[CurrentConditions] 🌬️ WIND DATA DEBUG:', {
    weather_wind_speed: weather?.wind_speed,
    weather_wind_speed_type: typeof weather?.wind_speed,
    weather_wind_direction: weather?.wind_direction,
    weather_wind_direction_type: typeof weather?.wind_direction,
    surfReport_wind_speed: surfReport?.wind_speed,
    surfReport_wind_speed_type: typeof surfReport?.wind_speed,
    surfReport_wind_direction: surfReport?.wind_direction,
    surfReport_wind_direction_type: typeof surfReport?.wind_direction,
    weather_wind_speed_valid: isValidValue(weather?.wind_speed),
    weather_wind_direction_valid: isValidValue(weather?.wind_direction),
    surfReport_wind_speed_valid: isValidValue(surfReport?.wind_speed),
    surfReport_wind_direction_valid: isValidValue(surfReport?.wind_direction),
    windSpeedRaw,
    windDirectionRaw,
    final_display: `${windSpeedDisplay} ${windDirectionDisplay}`,
  });
  
  const stokeRatingDisplay = surfReport?.rating ?? null;
  
  const wavePeriodDisplay = surfReport?.wave_period;
  const swellDirectionDisplay = surfReport?.swell_direction;

  console.log('[CurrentConditions] Displaying stoke rating:', stokeRatingDisplay, 'from report:', {
    reportId: surfReport?.id,
    reportDate: surfReport?.date,
    rating: surfReport?.rating,
    surf_height: surfReport?.surf_height
  });

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Current Conditions
        </Text>
        {!dataIsCurrent && surfReport?.date && (
          <View style={styles.dataBadge}>
            <IconSymbol
              ios_icon_name="clock"
              android_material_icon_name="schedule"
              size={12}
              color={colors.accent}
            />
            <Text style={[styles.dataBadgeText, { color: colors.accent }]}>
              Data from {surfReport.date.split('T')[0]}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {weather && (
          <View style={styles.section}>
            <View style={styles.mainWeather}>
              <View style={styles.temperatureSection}>
                <Text style={[styles.temperature, { color: theme.colors.text }]}>
                  {temperatureDisplay}
                </Text>
                {weatherConditionsDisplay && (
                  <Text style={[styles.weatherConditions, { color: colors.textSecondary }]}>
                    {weatherConditionsDisplay}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <IconSymbol
                  ios_icon_name="wind"
                  android_material_icon_name="air"
                  size={16}
                  color={colors.primary}
                />
                <Text style={[styles.detailText, { color: theme.colors.text }]}>
                  {windSpeedDisplay} {windDirectionDisplay}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Humidity:
                </Text>
                <Text style={[styles.detailText, { color: theme.colors.text }]}>
                  {humidityDisplay}
                </Text>
              </View>
            </View>
          </View>
        )}

        {surfReport && (
          <View style={[styles.section, styles.surfSection]}>
            <View style={styles.surfHeader}>
              <IconSymbol
                ios_icon_name="water.waves"
                android_material_icon_name="waves"
                size={20}
                color={colors.primary}
              />
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Surf Conditions
              </Text>
            </View>

            <View style={styles.surfGrid}>
              {surfHeightDisplay && (
                <View style={styles.surfItem}>
                  <Text style={[styles.surfLabel, { color: colors.textSecondary }]}>
                    Surf Height
                  </Text>
                  <Text style={[styles.surfValue, { color: theme.colors.text }]}>
                    {surfHeightDisplay}
                  </Text>
                </View>
              )}

              {waterTempFormatted && (
                <View style={styles.surfItem}>
                  <Text style={[styles.surfLabel, { color: colors.textSecondary }]}>
                    Water Temp
                  </Text>
                  <Text style={[styles.surfValue, { color: theme.colors.text }]}>
                    {waterTempFormatted}
                  </Text>
                </View>
              )}

              {stokeRatingDisplay !== null && (
                <View style={styles.surfItem}>
                  <Text style={[styles.surfLabel, { color: colors.textSecondary }]}>Stoke Rating</Text>
                  <Text style={[styles.surfValue, { color: colors.accent }]}>
                    {stokeRatingDisplay}/10
                  </Text>
                </View>
              )}
            </View>

            {(wavePeriodDisplay || swellDirectionDisplay) && (
              <View style={styles.additionalDetails}>
                {wavePeriodDisplay && (
                  <View style={styles.detailItem}>
                    <IconSymbol
                      ios_icon_name="timer"
                      android_material_icon_name="schedule"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={[styles.detailSmallText, { color: colors.textSecondary }]}>
                      Period: {wavePeriodDisplay}
                    </Text>
                  </View>
                )}
                {swellDirectionDisplay && (
                  <View style={styles.detailItem}>
                    <IconSymbol
                      ios_icon_name="location.north.fill"
                      android_material_icon_name="navigation"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={[styles.detailSmallText, { color: colors.textSecondary }]}>
                      Swell: {swellDirectionDisplay}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  dataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dataBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    gap: 16,
  },
  section: {
    gap: 12,
  },
  mainWeather: {
    marginBottom: 8,
  },
  temperatureSection: {
    gap: 4,
  },
  temperature: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  weatherConditions: {
    fontSize: 16,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailText: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailSmallText: {
    fontSize: 12,
  },
  surfSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  surfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  surfGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  surfItem: {
    alignItems: 'center',
    gap: 4,
  },
  surfLabel: {
    fontSize: 12,
  },
  surfValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  additionalDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.1)',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
  },
});
