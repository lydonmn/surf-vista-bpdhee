
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { WeatherForecast } from '@/types';

interface WeeklyForecastProps {
  forecast: WeatherForecast[];
}

// Helper function to get appropriate weather icon based on conditions
const getWeatherIcon = (conditions: string | null) => {
  // Default fallback
  const defaultIcon = { ios: 'cloud.sun.fill', android: 'wb_cloudy' };
  
  if (!conditions) {
    console.log('[WeeklyForecast] No conditions provided, using default icon');
    return defaultIcon;
  }
  
  const lower = conditions.toLowerCase();
  console.log('[WeeklyForecast] Mapping icon for condition:', conditions);
  
  // Rain conditions - prioritize rain detection
  // Check for various rain-related keywords
  if (lower.includes('rain') || lower.includes('shower') || lower.includes('drizzle') || lower.includes('precipitation')) {
    console.log('[WeeklyForecast] Detected rain condition');
    return { ios: 'cloud.rain.fill', android: 'water_drop' };
  }
  
  // Storm conditions
  if (lower.includes('storm') || lower.includes('thunder') || lower.includes('lightning') || lower.includes('t-storm')) {
    console.log('[WeeklyForecast] Detected storm condition');
    return { ios: 'cloud.bolt.fill', android: 'flash_on' };
  }
  
  // Snow conditions
  if (lower.includes('snow') || lower.includes('sleet') || lower.includes('ice') || lower.includes('flurr') || lower.includes('wintry')) {
    console.log('[WeeklyForecast] Detected snow condition');
    return { ios: 'snowflake', android: 'ac_unit' };
  }
  
  // Fog/Mist conditions
  if (lower.includes('fog') || lower.includes('mist') || lower.includes('haze')) {
    console.log('[WeeklyForecast] Detected fog condition');
    return { ios: 'cloud.fog.fill', android: 'cloud' };
  }
  
  // Sunny conditions - check for "sunny" keyword first
  if (lower.includes('sunny')) {
    // Check if it's "mostly sunny" or "partly sunny"
    if (lower.includes('mostly') || lower.includes('partly')) {
      console.log('[WeeklyForecast] Detected mostly/partly sunny condition');
      return { ios: 'cloud.sun.fill', android: 'wb_cloudy' };
    }
    console.log('[WeeklyForecast] Detected sunny condition');
    return { ios: 'sun.max.fill', android: 'wb_sunny' };
  }
  
  // Clear conditions
  if (lower.includes('clear')) {
    // Check if it's "mostly clear" or "partly clear"
    if (lower.includes('mostly') || lower.includes('partly')) {
      console.log('[WeeklyForecast] Detected mostly/partly clear condition');
      return { ios: 'cloud.sun.fill', android: 'wb_cloudy' };
    }
    console.log('[WeeklyForecast] Detected clear condition');
    return { ios: 'sun.max.fill', android: 'wb_sunny' };
  }
  
  // Partly cloudy
  if (lower.includes('partly cloudy') || lower.includes('partial')) {
    console.log('[WeeklyForecast] Detected partly cloudy condition');
    return { ios: 'cloud.sun.fill', android: 'wb_cloudy' };
  }
  
  // Mostly cloudy
  if (lower.includes('mostly cloudy') || lower.includes('mostly overcast')) {
    console.log('[WeeklyForecast] Detected mostly cloudy condition');
    return { ios: 'cloud.fill', android: 'cloud' };
  }
  
  // Cloudy/Overcast (general)
  if (lower.includes('cloud') || lower.includes('overcast')) {
    console.log('[WeeklyForecast] Detected cloudy condition');
    return { ios: 'cloud.fill', android: 'cloud' };
  }
  
  // Windy
  if (lower.includes('wind') || lower.includes('breezy') || lower.includes('gust')) {
    console.log('[WeeklyForecast] Detected windy condition');
    return { ios: 'wind', android: 'air' };
  }
  
  // Default fallback
  console.log('[WeeklyForecast] No specific condition matched, using default icon');
  return defaultIcon;
};

export function WeeklyForecast({ forecast }: WeeklyForecastProps) {
  const theme = useTheme();

  console.log('[WeeklyForecast] Rendering with forecast data:', {
    count: forecast?.length || 0,
    hasData: !!forecast && forecast.length > 0,
    firstItem: forecast?.[0]
  });

  if (!forecast || forecast.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name="calendar"
            android_material_icon_name="event"
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            7-Day Forecast
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
            No forecast data available yet
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
          ios_icon_name="calendar"
          android_material_icon_name="event"
          size={24}
          color={colors.primary}
        />
        <Text style={[styles.title, { color: theme.colors.text }]}>
          7-Day Forecast
        </Text>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.forecastScroll}
      >
        {forecast.map((day, index) => {
          const icon = getWeatherIcon(day.conditions);
          const date = new Date(day.date);
          const dayName = day.day_name || date.toLocaleDateString('en-US', { weekday: 'short' });
          
          console.log('[WeeklyForecast] Rendering day card:', {
            index,
            date: day.date,
            conditions: day.conditions,
            icon: icon,
            dayName
          });
          
          return (
            <View 
              key={index}
              style={[
                styles.dayCard,
                { backgroundColor: colors.highlight }
              ]}
            >
              <Text style={[styles.dayName, { color: theme.colors.text }]}>
                {index === 0 ? 'Today' : dayName}
              </Text>
              
              <IconSymbol
                ios_icon_name={icon.ios}
                android_material_icon_name={icon.android}
                size={32}
                color={colors.primary}
              />
              
              <View style={styles.tempContainer}>
                <Text style={[styles.highTemp, { color: theme.colors.text }]}>
                  {day.high_temp ? `${Math.round(Number(day.high_temp))}°` : '--'}
                </Text>
                <Text style={[styles.lowTemp, { color: colors.textSecondary }]}>
                  {day.low_temp ? `${Math.round(Number(day.low_temp))}°` : '--'}
                </Text>
              </View>

              {day.precipitation_chance !== null && day.precipitation_chance > 0 && (
                <View style={styles.precipContainer}>
                  <IconSymbol
                    ios_icon_name="drop.fill"
                    android_material_icon_name="water_drop"
                    size={12}
                    color={colors.primary}
                  />
                  <Text style={[styles.precipText, { color: colors.textSecondary }]}>
                    {day.precipitation_chance}%
                  </Text>
                </View>
              )}

              {day.conditions && (
                <Text 
                  style={[styles.conditions, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {day.conditions}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
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
  forecastScroll: {
    gap: 12,
    paddingRight: 16,
  },
  dayCard: {
    width: 100,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  tempContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  highTemp: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  lowTemp: {
    fontSize: 16,
  },
  precipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  precipText: {
    fontSize: 12,
  },
  conditions: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
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
