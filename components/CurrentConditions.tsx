
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

// Helper function to get appropriate weather icon based on conditions
const getWeatherIcon = (conditions: string | null) => {
  if (!conditions) return { ios: 'cloud.fill', android: 'cloud' };
  
  const lower = conditions.toLowerCase();
  
  // Rain conditions
  if (lower.includes('rain') || lower.includes('shower') || lower.includes('drizzle')) {
    return { ios: 'cloud.rain.fill', android: 'rainy' };
  }
  
  // Storm conditions
  if (lower.includes('storm') || lower.includes('thunder')) {
    return { ios: 'cloud.bolt.rain.fill', android: 'thunderstorm' };
  }
  
  // Snow conditions
  if (lower.includes('snow') || lower.includes('sleet') || lower.includes('ice')) {
    return { ios: 'cloud.snow.fill', android: 'ac_unit' };
  }
  
  // Fog/Mist conditions
  if (lower.includes('fog') || lower.includes('mist') || lower.includes('haze')) {
    return { ios: 'cloud.fog.fill', android: 'foggy' };
  }
  
  // Clear/Sunny conditions
  if (lower.includes('clear') || lower.includes('sunny')) {
    return { ios: 'sun.max.fill', android: 'wb_sunny' };
  }
  
  // Partly cloudy
  if (lower.includes('partly') || lower.includes('partial')) {
    return { ios: 'cloud.sun.fill', android: 'wb_cloudy' };
  }
  
  // Cloudy/Overcast
  if (lower.includes('cloud') || lower.includes('overcast')) {
    return { ios: 'cloud.fill', android: 'cloud' };
  }
  
  // Windy
  if (lower.includes('wind') || lower.includes('breezy')) {
    return { ios: 'wind', android: 'air' };
  }
  
  // Default fallback
  return { ios: 'cloud.sun.fill', android: 'wb_cloudy' };
};

export function CurrentConditions({ weather, surfReport }: CurrentConditionsProps) {
  const theme = useTheme();

  // Get dynamic icon based on current weather conditions
  const weatherIcon = getWeatherIcon(weather?.conditions || null);

  if (!weather && !surfReport) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name={weatherIcon.ios}
            android_material_icon_name={weatherIcon.android}
            size={24}
            color={colors.primary}
          />
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
            Data will be updated automatically
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <View style={styles.header}>
        <IconSymbol
          ios_icon_name={weatherIcon.ios}
          android_material_icon_name={weatherIcon.android}
          size={24}
          color={colors.primary}
        />
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Current Conditions
        </Text>
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
                <IconSymbol
                  ios_icon_name="humidity.fill"
                  android_material_icon_name="water_drop"
                  size={16}
                  color={colors.primary}
                />
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
                  Waves
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
                <Text style={[styles.surfLabel, { color: colors.textSecondary }]}>
                  Rating
                </Text>
                <Text style={[styles.surfValue, { color: colors.accent }]}>
                  {surfReport.rating || 5}/10
                </Text>
              </View>
            </View>
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
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
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
  detailText: {
    fontSize: 14,
    fontWeight: '500',
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
