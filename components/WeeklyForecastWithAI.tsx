
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from './IconSymbol';
import { PredictionIndicator } from './PredictionIndicator';
import { colors } from '@/styles/commonStyles';
import { WeatherForecast } from '@/types';

interface WeeklyForecastWithAIProps {
  forecast: WeatherForecast[];
}

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

export function WeeklyForecastWithAI({ forecast }: WeeklyForecastWithAIProps) {
  const theme = useTheme();
  const today = getTodayDateString();

  console.log('[WeeklyForecastWithAI] Rendering with forecast data:', {
    count: forecast?.length || 0,
    hasData: !!forecast && forecast.length > 0,
    firstItem: forecast?.[0],
    today
  });

  const filteredForecast = forecast
    ?.filter(day => {
      const hasData = day.high_temp !== null && day.low_temp !== null;
      const isTodayOrFuture = day.date >= today;
      return hasData && isTodayOrFuture;
    })
    .reduce((acc, current) => {
      if (!acc.find(item => item.date === current.date)) {
        acc.push(current);
      }
      return acc;
    }, [] as WeatherForecast[])
    .slice(0, 7);

  console.log('[WeeklyForecastWithAI] Filtered forecast:', {
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
            7-Day AI Forecast
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
          ios_icon_name="brain"
          android_material_icon_name="psychology"
          size={24}
          color={colors.accent}
        />
        <Text style={[styles.title, { color: theme.colors.text }]}>
          7-Day AI Forecast
        </Text>
      </View>

      <View style={styles.forecastStack}>
        {filteredForecast.map((day, index) => {
          const dayName = getDayName(day.date);
          const swellRange = day.swell_height_range || '1-2 ft';
          const predictionSource = (day as any).prediction_source || 'baseline';
          const predictionConfidence = (day as any).prediction_confidence;
          const highTempDisplay = day.high_temp ? `${Math.round(Number(day.high_temp))}°` : '--';
          const lowTempDisplay = day.low_temp ? `${Math.round(Number(day.low_temp))}°` : '--';
          const narrativeText = day.daily_narrative || day.conditions || null;
          const hasPrecip = day.precipitation_chance !== null && (day.precipitation_chance ?? 0) > 0;

          console.log('[WeeklyForecastWithAI] Rendering day card:', {
            index,
            date: day.date,
            swellRange,
            predictionSource,
            confidence: predictionConfidence,
            dayName,
            hasNarrative: !!day.daily_narrative,
            hasFallbackConditions: !!day.conditions,
          });

          return (
            <View
              key={index}
              style={[styles.dayCard, { backgroundColor: colors.highlight }]}
            >
              {/* Top row: left = day name + badge, right = swell + temps + precip */}
              <View style={styles.topRow}>
                {/* Left side */}
                <View style={styles.leftSide}>
                  <Text style={[styles.dayName, { color: theme.colors.text }]}>
                    {dayName}
                  </Text>
                  <View style={styles.predictionBadge}>
                    <PredictionIndicator
                      source={predictionSource}
                      confidence={predictionConfidence}
                      compact={true}
                    />
                  </View>
                </View>

                {/* Right side */}
                <View style={styles.rightSide}>
                  <View style={styles.swellContainer}>
                    <Text style={[styles.swellSize, { color: colors.primary }]}>
                      {swellRange}
                    </Text>
                    <Text style={[styles.swellLabel, { color: colors.textSecondary }]}>
                      swell
                    </Text>
                  </View>
                  <View style={styles.tempPrecipRow}>
                    <Text style={[styles.highTemp, { color: theme.colors.text }]}>
                      {highTempDisplay}
                    </Text>
                    <Text style={[styles.tempSeparator, { color: colors.textSecondary }]}>
                      /
                    </Text>
                    <Text style={[styles.lowTemp, { color: colors.textSecondary }]}>
                      {lowTempDisplay}
                    </Text>
                    {hasPrecip && (
                      <View style={styles.precipContainer}>
                        <IconSymbol
                          ios_icon_name="cloud.rain.fill"
                          android_material_icon_name="umbrella"
                          size={13}
                          color={colors.primary}
                        />
                        <Text style={[styles.precipText, { color: colors.textSecondary }]}>
                          {day.precipitation_chance}%
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Narrative / conditions row */}
              {narrativeText ? (
                <View style={styles.narrativeSeparator}>
                  <Text style={[styles.narrativeText, { color: theme.colors.text }]}>
                    {narrativeText}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* AI Info Footer */}
      <View style={styles.aiInfoFooter}>
        <IconSymbol
          ios_icon_name="info.circle"
          android_material_icon_name="info"
          size={14}
          color={colors.textSecondary}
        />
        <Text style={[styles.aiInfoText, { color: colors.textSecondary }]}>
          Predictions use historical data, trends, and statistical analysis
        </Text>
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
  forecastStack: {
    gap: 10,
  },
  dayCard: {
    borderRadius: 12,
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSide: {
    flexDirection: 'column',
    gap: 4,
  },
  dayName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  predictionBadge: {},
  rightSide: {
    alignItems: 'flex-end',
    gap: 4,
  },
  swellContainer: {
    alignItems: 'flex-end',
  },
  swellSize: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  swellLabel: {
    fontSize: 11,
    marginTop: 1,
  },
  tempPrecipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  highTemp: {
    fontSize: 14,
    fontWeight: '600',
  },
  tempSeparator: {
    fontSize: 14,
  },
  lowTemp: {
    fontSize: 14,
  },
  precipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 4,
  },
  precipText: {
    fontSize: 12,
  },
  narrativeSeparator: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.15)',
    paddingTop: 10,
    marginTop: 8,
  },
  narrativeText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },
  aiInfoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  aiInfoText: {
    fontSize: 11,
    flex: 1,
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
