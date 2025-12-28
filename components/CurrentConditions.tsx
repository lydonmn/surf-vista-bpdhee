
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { WeatherData, SurfReport } from '@/types';

interface CurrentConditionsProps {
  weather: WeatherData | null;
  surfReport: SurfReport | null;
}

export function CurrentConditions({ weather, surfReport }: CurrentConditionsProps) {
  const theme = useTheme();

  console.log('[CurrentConditions] Rendering with data:', {
    hasWeather: !!weather,
    hasSurfReport: !!surfReport,
    surfHeight: surfReport?.wave_height,
    temperature: weather?.temperature,
    reportDate: surfReport?.date,
    reportUpdatedAt: surfReport?.updated_at,
  });

  // Check if data is from today
  const isDataCurrent = () => {
    if (!surfReport?.date) return true;
    
    const now = new Date();
    const estDateString = now.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const [month, day, year] = estDateString.split('/');
    const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    return surfReport.date === today;
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
              Data from {surfReport.date}
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
                  {weather.temperature ? `${Math.round(Number(weather.temperature))}°F` : '--'}
                </Text>
                {weather.conditions && (
                  <Text style={[styles.weatherConditions, { color: colors.textSecondary }]}>
                    {weather.conditions}
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
                  {weather.wind_speed ? `${Math.round(Number(weather.wind_speed))} mph` : '--'} {weather.wind_direction || ''}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  Humidity:
                </Text>
                <Text style={[styles.detailText, { color: theme.colors.text }]}>
                  {weather.humidity ? `${weather.humidity}%` : '--'}
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
              <View style={styles.surfItem}>
                <Text style={[styles.surfLabel, { color: colors.textSecondary }]}>
                  Surf Height
                </Text>
                <Text style={[styles.surfValue, { color: theme.colors.text }]}>
                  {surfReport.wave_height || '--'}
                </Text>
              </View>

              <View style={styles.surfItem}>
                <Text style={[styles.surfLabel, { color: colors.textSecondary }]}>
                  Water
                </Text>
                <Text style={[styles.surfValue, { color: theme.colors.text }]}>
                  {surfReport.water_temp || '--'}
                </Text>
              </View>

              <View style={styles.surfItem}>
                <Text style={[styles.surfLabel, { color: colors.textSecondary }]}>Stoke Rating</Text>
                <Text style={[styles.surfValue, { color: colors.accent }]}>
                  {surfReport.rating || 5}/10
                </Text>
              </View>
            </View>

            {/* Additional surf details */}
            {(surfReport.wave_period || surfReport.swell_direction) && (
              <View style={styles.additionalDetails}>
                {surfReport.wave_period && (
                  <View style={styles.detailItem}>
                    <IconSymbol
                      ios_icon_name="timer"
                      android_material_icon_name="schedule"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={[styles.detailSmallText, { color: colors.textSecondary }]}>
                      Period: {surfReport.wave_period}
                    </Text>
                  </View>
                )}
                {surfReport.swell_direction && (
                  <View style={styles.detailItem}>
                    <IconSymbol
                      ios_icon_name="location.north.fill"
                      android_material_icon_name="navigation"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <Text style={[styles.detailSmallText, { color: colors.textSecondary }]}>
                      Swell: {surfReport.swell_direction}
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
