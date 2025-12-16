
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

  if (!forecast || forecast.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name="calendar"
            android_material_icon_name="calendar_today"
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

  const getWeatherIcon = (conditions: string | null) => {
    if (!conditions) return { ios: 'cloud.fill', android: 'cloud' };
    
    const lower = conditions.toLowerCase();
    if (lower.includes('rain') || lower.includes('shower')) {
      return { ios: 'cloud.rain.fill', android: 'rainy' };
    } else if (lower.includes('storm') || lower.includes('thunder')) {
      return { ios: 'cloud.bolt.rain.fill', android: 'thunderstorm' };
    } else if (lower.includes('snow')) {
      return { ios: 'cloud.snow.fill', android: 'snowy' };
    } else if (lower.includes('clear') || lower.includes('sunny')) {
      return { ios: 'sun.max.fill', android: 'wb_sunny' };
    } else if (lower.includes('cloud') || lower.includes('overcast')) {
      return { ios: 'cloud.fill', android: 'cloud' };
    } else if (lower.includes('partly')) {
      return { ios: 'cloud.sun.fill', android: 'partly_cloudy_day' };
    }
    return { ios: 'cloud.fill', android: 'cloud' };
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <View style={styles.header}>
        <IconSymbol
          ios_icon_name="calendar"
          android_material_icon_name="calendar_today"
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
