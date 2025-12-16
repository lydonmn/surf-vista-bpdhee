
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { Database } from '@/app/integrations/supabase/types';

type WeatherData = Database['public']['Tables']['weather_data']['Row'];

interface WeatherCardProps {
  weather: WeatherData;
}

export function WeatherCard({ weather }: WeatherCardProps) {
  const theme = useTheme();

  const getWeatherIcon = (conditions: string | null) => {
    if (!conditions) return { ios: 'cloud.fill', android: 'cloud' };
    
    const lower = conditions.toLowerCase();
    if (lower.includes('rain') || lower.includes('shower')) {
      return { ios: 'cloud.rain.fill', android: 'grain' };
    } else if (lower.includes('storm') || lower.includes('thunder')) {
      return { ios: 'cloud.bolt.rain.fill', android: 'thunderstorm' };
    } else if (lower.includes('snow')) {
      return { ios: 'cloud.snow.fill', android: 'ac_unit' };
    } else if (lower.includes('clear') || lower.includes('sunny')) {
      return { ios: 'sun.max.fill', android: 'wb_sunny' };
    } else if (lower.includes('cloud') || lower.includes('overcast')) {
      return { ios: 'cloud.fill', android: 'cloud' };
    } else if (lower.includes('partly')) {
      return { ios: 'cloud.sun.fill', android: 'wb_cloudy' };
    }
    return { ios: 'cloud.fill', android: 'cloud' };
  };

  const weatherIcon = getWeatherIcon(weather.conditions);

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <View style={styles.header}>
        <IconSymbol
          ios_icon_name={weatherIcon.ios}
          android_material_icon_name={weatherIcon.android}
          size={32}
          color={colors.primary}
        />
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Weather Conditions
        </Text>
      </View>

      <View style={styles.mainInfo}>
        <View style={styles.temperatureContainer}>
          <Text style={[styles.temperature, { color: theme.colors.text }]}>
            {weather.temperature}°F
          </Text>
          <Text style={[styles.feelsLike, { color: colors.textSecondary }]}>
            Feels like {weather.feels_like}°F
          </Text>
        </View>
        <Text style={[styles.conditions, { color: theme.colors.text }]}>
          {weather.conditions}
        </Text>
      </View>

      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <IconSymbol
            ios_icon_name="wind"
            android_material_icon_name="air"
            size={20}
            color={colors.primary}
          />
          <View style={styles.detailText}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Wind
            </Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
              {weather.wind_speed} mph {weather.wind_direction}
            </Text>
          </View>
        </View>

        <View style={styles.detailItem}>
          <IconSymbol
            ios_icon_name="humidity.fill"
            android_material_icon_name="water_drop"
            size={20}
            color={colors.primary}
          />
          <View style={styles.detailText}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Humidity
            </Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
              {weather.humidity}%
            </Text>
          </View>
        </View>

        {weather.wind_gust && weather.wind_gust > 0 && (
          <View style={styles.detailItem}>
            <IconSymbol
              ios_icon_name="wind.snow"
              android_material_icon_name="air"
              size={20}
              color={colors.primary}
            />
            <View style={styles.detailText}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Gusts
              </Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                {weather.wind_gust} mph
              </Text>
            </View>
          </View>
        )}

        {weather.visibility && (
          <View style={styles.detailItem}>
            <IconSymbol
              ios_icon_name="eye.fill"
              android_material_icon_name="visibility"
              size={20}
              color={colors.primary}
            />
            <View style={styles.detailText}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                Visibility
              </Text>
              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                {weather.visibility} mi
              </Text>
            </View>
          </View>
        )}
      </View>

      {weather.forecast && (
        <View style={[styles.forecastBox, { backgroundColor: colors.highlight }]}>
          <Text style={[styles.forecastTitle, { color: theme.colors.text }]}>
            Forecast
          </Text>
          <Text style={[styles.forecastText, { color: theme.colors.text }]}>
            {weather.forecast}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
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
  mainInfo: {
    marginBottom: 16,
  },
  temperatureContainer: {
    marginBottom: 8,
  },
  temperature: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  feelsLike: {
    fontSize: 14,
    marginTop: 4,
  },
  conditions: {
    fontSize: 18,
    fontWeight: '600',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '45%',
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  forecastBox: {
    padding: 12,
    borderRadius: 8,
  },
  forecastTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  forecastText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
