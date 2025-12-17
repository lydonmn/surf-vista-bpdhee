
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { WeatherForecast } from '@/types';

interface WeeklyForecastProps {
  forecast: WeatherForecast[];
}

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
          const date = new Date(day.date);
          const dayName = day.day_name || date.toLocaleDateString('en-US', { weekday: 'short' });
          
          // Get swell size range or use default
          const swellRange = day.swell_height_range || '1-2 ft';
          
          console.log('[WeeklyForecast] Rendering day card:', {
            index,
            date: day.date,
            conditions: day.conditions,
            swellRange,
            dayName,
            precipChance: day.precipitation_chance
          });
          
          // Create a truly unique key by combining date and index - USING BACKTICKS!
          const uniqueKey = `forecast-${day.date || 'unknown'}-${index}`;
          
          return (
            <View 
              key={uniqueKey}
              style={[
                styles.dayCard,
                { backgroundColor: colors.highlight }
              ]}
            >
              <Text style={[styles.dayName, { color: theme.colors.text }]}>
                {index === 0 ? 'Today' : dayName}
              </Text>
              
              {/* Display swell size instead of weather icon */}
              <View style={styles.swellContainer}>
                <Text style={[styles.swellSize, { color: colors.primary }]}>
                  {swellRange}
                </Text>
                <Text style={[styles.swellLabel, { color: colors.textSecondary }]}>
                  swell
                </Text>
              </View>
              
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
                    ios_icon_name="cloud.rain.fill"
                    android_material_icon_name="umbrella"
                    size={14}
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
  swellContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  swellSize: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  swellLabel: {
    fontSize: 11,
    marginTop: 2,
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
