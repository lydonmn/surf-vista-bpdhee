
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { WeatherForecast } from '@/types';

interface WeeklyForecastProps {
  forecast: WeatherForecast[];
}

// Helper function to parse date string as local date (not UTC)
function parseLocalDate(dateStr: string): Date {
  // Parse YYYY-MM-DD as local date, not UTC
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Helper function to get today's date in YYYY-MM-DD format
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to get day name from date string
function getDayName(dateStr: string): string {
  const today = getTodayDateString();
  if (dateStr === today) return 'Today';
  
  const date = parseLocalDate(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  
  if (dateStr === tomorrowStr) return 'Tomorrow';
  
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function WeeklyForecast({ forecast }: WeeklyForecastProps) {
  const theme = useTheme();
  const today = getTodayDateString();

  console.log('[WeeklyForecast] Rendering with forecast data:', {
    count: forecast?.length || 0,
    hasData: !!forecast && forecast.length > 0,
    firstItem: forecast?.[0],
    today
  });

  // Filter to only show entries with aggregated data (high_temp and low_temp present)
  // ONLY show today and future dates, and remove duplicates by date
  const filteredForecast = forecast
    ?.filter(day => {
      const hasData = day.high_temp !== null && day.low_temp !== null;
      const isTodayOrFuture = day.date >= today;
      return hasData && isTodayOrFuture;
    })
    .reduce((acc, current) => {
      // Only add if we don't already have this date
      if (!acc.find(item => item.date === current.date)) {
        acc.push(current);
      }
      return acc;
    }, [] as WeatherForecast[])
    .slice(0, 7); // Limit to 7 days

  console.log('[WeeklyForecast] Filtered forecast:', {
    originalCount: forecast?.length || 0,
    filteredCount: filteredForecast?.length || 0,
    dates: filteredForecast?.map(d => d.date)
  });

  if (!filteredForecast || filteredForecast.length === 0) {
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
        {filteredForecast.map((day, index) => {
          const dayName = getDayName(day.date);
          
          // Get swell size range or use default
          const swellRange = day.swell_height_range || '1-2 ft';
          
          console.log('[WeeklyForecast] Rendering day card:', {
            index,
            date: day.date,
            conditions: day.conditions,
            swellRange,
            dayName,
            highTemp: day.high_temp,
            lowTemp: day.low_temp,
            precipChance: day.precipitation_chance
          });
          
          return (
            <React.Fragment key={index}>
              <View 
                style={[
                  styles.dayCard,
                  { backgroundColor: colors.highlight }
                ]}
              >
                <Text style={[styles.dayName, { color: theme.colors.text }]}>
                  {dayName}
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
            </React.Fragment>
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
