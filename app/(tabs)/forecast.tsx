
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useSurfData } from '@/hooks/useSurfData';
import { SurfReport, WeatherForecast, TideData } from '@/types';
import { supabase } from '@/app/integrations/supabase/client';

interface DayForecast {
  date: string;
  dayName: string;
  surfReport: SurfReport | null;
  weatherForecast: WeatherForecast | null;
  tides: TideData[];
}

// Helper function to parse date string as local date (not UTC)
function parseLocalDate(dateStr: string): Date {
  // Parse YYYY-MM-DD as local date, not UTC
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Helper function to get day name from date string
function getDayName(dateStr: string, index: number): string {
  if (index === 0) return 'Today';
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

// Helper function to format date
function formatDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ForecastScreen() {
  const theme = useTheme();
  const { surfReports, weatherForecast, tideData, refreshData, isLoading, error } = useSurfData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  }, [refreshData]);

  // Combine all data by date
  const combinedForecast: DayForecast[] = React.useMemo(() => {
    const forecastMap = new Map<string, DayForecast>();

    // Add surf reports
    surfReports.forEach(report => {
      if (!forecastMap.has(report.date)) {
        forecastMap.set(report.date, {
          date: report.date,
          dayName: getDayName(report.date, 0),
          surfReport: report,
          weatherForecast: null,
          tides: [],
        });
      } else {
        const existing = forecastMap.get(report.date)!;
        existing.surfReport = report;
      }
    });

    // Add weather forecasts
    weatherForecast.forEach(forecast => {
      if (!forecastMap.has(forecast.date)) {
        forecastMap.set(forecast.date, {
          date: forecast.date,
          dayName: getDayName(forecast.date, 0),
          surfReport: null,
          weatherForecast: forecast,
          tides: [],
        });
      } else {
        const existing = forecastMap.get(forecast.date)!;
        existing.weatherForecast = forecast;
      }
    });

    // Add tides
    tideData.forEach(tide => {
      if (forecastMap.has(tide.date)) {
        const existing = forecastMap.get(tide.date)!;
        existing.tides.push(tide);
      }
    });

    // Convert to array and sort by date
    return Array.from(forecastMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7); // Limit to 7 days
  }, [surfReports, weatherForecast, tideData]);

  const toggleDay = (date: string) => {
    setExpandedDay(expandedDay === date ? null : date);
  };

  const formatTime = (timeStr: string) => {
    const time = new Date(`2000-01-01T${timeStr}`);
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStokeColor = (rating: number | null) => {
    if (!rating) return colors.textSecondary;
    if (rating >= 8) return '#4CAF50'; // Green
    if (rating >= 6) return '#8BC34A'; // Light green
    if (rating >= 4) return '#FFC107'; // Yellow
    if (rating >= 2) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const formatTemp = (temp: any): string => {
    if (temp === null || temp === undefined) return 'N/A';
    const numTemp = Number(temp);
    if (isNaN(numTemp)) return 'N/A';
    return `${Math.round(numTemp)}°`;
  };

  if (isLoading && combinedForecast.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow_back"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            7-Day Forecast
          </Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading forecast data...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow_back"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          7-Day Forecast
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <IconSymbol
            ios_icon_name="arrow.clockwise"
            android_material_icon_name="refresh"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={16}
            color="#FF3B30"
          />
          <Text style={[styles.errorText, { color: '#FF3B30' }]}>
            {error}
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {combinedForecast.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle"
              android_material_icon_name="warning"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No forecast data available
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Pull down to refresh
            </Text>
          </View>
        ) : (
          combinedForecast.map((day, index) => {
            const isExpanded = expandedDay === day.date;
            const dayName = getDayName(day.date, index);

            return (
              <View
                key={day.date}
                style={[styles.dayCard, { backgroundColor: theme.colors.card }]}
              >
                <TouchableOpacity
                  style={styles.dayHeader}
                  onPress={() => toggleDay(day.date)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dayHeaderLeft}>
                    <Text style={[styles.dayName, { color: theme.colors.text }]}>
                      {dayName}
                    </Text>
                    <Text style={[styles.dayDate, { color: colors.textSecondary }]}>
                      {formatDate(day.date)}
                    </Text>
                  </View>

                  <View style={styles.dayHeaderRight}>
                    {day.weatherForecast ? (
                      <View style={styles.tempRange}>
                        <Text style={[styles.highTemp, { color: theme.colors.text }]}>
                          {formatTemp(day.weatherForecast.high_temp)}
                        </Text>
                        <Text style={[styles.lowTemp, { color: colors.textSecondary }]}>
                          {formatTemp(day.weatherForecast.low_temp)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.tempRange}>
                        <Text style={[styles.highTemp, { color: colors.textSecondary }]}>
                          N/A
                        </Text>
                      </View>
                    )}
                    <IconSymbol
                      ios_icon_name={isExpanded ? 'chevron.up' : 'chevron.down'}
                      android_material_icon_name={isExpanded ? 'expand_less' : 'expand_more'}
                      size={24}
                      color={colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.dayDetails}>
                    {/* Surf Report Section - Always show */}
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
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

                      {day.surfReport ? (
                        <React.Fragment>
                          <View style={styles.stokeRating}>
                            <Text style={[styles.stokeLabel, { color: colors.textSecondary }]}>
                              Stoke Rating
                            </Text>
                            <View style={styles.stokeValue}>
                              <Text style={[styles.stokeNumber, { color: getStokeColor(day.surfReport.rating) }]}>
                                {day.surfReport.rating || 'N/A'}
                              </Text>
                              <Text style={[styles.stokeMax, { color: colors.textSecondary }]}>
                                / 10
                              </Text>
                            </View>
                          </View>

                          <View style={styles.detailsGrid}>
                            <View style={styles.detailItem}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                Wave Height
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                {day.surfReport.wave_height || 'N/A'}
                              </Text>
                            </View>

                            <View style={styles.detailItem}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                Wave Period
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                {day.surfReport.wave_period || 'N/A'}
                              </Text>
                            </View>

                            <View style={styles.detailItem}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                Wind
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                {day.surfReport.wind_speed || 'N/A'} {day.surfReport.wind_direction || ''}
                              </Text>
                            </View>

                            <View style={styles.detailItem}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                Water Temp
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                {day.surfReport.water_temp || 'N/A'}
                              </Text>
                            </View>

                            {day.surfReport.swell_direction && (
                              <View style={styles.detailItem}>
                                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                  Swell Direction
                                </Text>
                                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                  {day.surfReport.swell_direction}
                                </Text>
                              </View>
                            )}
                          </View>

                          {day.surfReport.report_text && (
                            <View style={[styles.reportTextBox, { backgroundColor: colors.highlight }]}>
                              <Text style={[styles.reportText, { color: theme.colors.text }]}>
                                {day.surfReport.report_text}
                              </Text>
                            </View>
                          )}
                        </React.Fragment>
                      ) : (
                        <View style={styles.noDataContainer}>
                          <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
                            No surf data available for this day
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Weather Section - Always show */}
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <IconSymbol
                          ios_icon_name="cloud.sun.fill"
                          android_material_icon_name="wb_sunny"
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                          Weather
                        </Text>
                      </View>

                      {day.weatherForecast ? (
                        <React.Fragment>
                          <View style={styles.detailsGrid}>
                            <View style={styles.detailItem}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                High / Low
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                {formatTemp(day.weatherForecast.high_temp)} / {formatTemp(day.weatherForecast.low_temp)}
                              </Text>
                            </View>

                            <View style={styles.detailItem}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                Wind
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                {day.weatherForecast.wind_speed ? `${day.weatherForecast.wind_speed} mph` : 'N/A'} {day.weatherForecast.wind_direction || ''}
                              </Text>
                            </View>

                            <View style={styles.detailItem}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                Humidity
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                {day.weatherForecast.humidity ? `${day.weatherForecast.humidity}%` : 'N/A'}
                              </Text>
                            </View>

                            <View style={styles.detailItem}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                Rain Chance
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                {day.weatherForecast.precipitation_chance !== null && day.weatherForecast.precipitation_chance !== undefined ? `${day.weatherForecast.precipitation_chance}%` : 'N/A'}
                              </Text>
                            </View>
                          </View>

                          {day.weatherForecast.conditions && (
                            <View style={[styles.conditionsBox, { backgroundColor: colors.highlight }]}>
                              <Text style={[styles.conditionsText, { color: theme.colors.text }]}>
                                {day.weatherForecast.conditions}
                              </Text>
                            </View>
                          )}
                        </React.Fragment>
                      ) : (
                        <View style={styles.noDataContainer}>
                          <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
                            No weather data available for this day
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Tides Section - Always show */}
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <IconSymbol
                          ios_icon_name="arrow.up.arrow.down"
                          android_material_icon_name="swap_vert"
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                          Tide Schedule
                        </Text>
                      </View>

                      {day.tides.length > 0 ? (
                        <View style={styles.tidesContainer}>
                          {day.tides.map((tide, tideIndex) => {
                            const isHighTide = tide.type === 'high';
                            const iconColor = isHighTide ? '#2196F3' : '#FF9800';

                            return (
                              <View key={tideIndex} style={styles.tideItem}>
                                <IconSymbol
                                  ios_icon_name={isHighTide ? 'arrow.up' : 'arrow.down'}
                                  android_material_icon_name={isHighTide ? 'north' : 'south'}
                                  size={20}
                                  color={iconColor}
                                />
                                <View style={styles.tideInfo}>
                                  <Text style={[styles.tideType, { color: theme.colors.text }]}>
                                    {tide.type.charAt(0).toUpperCase() + tide.type.slice(1)} Tide
                                  </Text>
                                  <Text style={[styles.tideTime, { color: colors.textSecondary }]}>
                                    {formatTime(tide.time)}
                                  </Text>
                                </View>
                                <Text style={[styles.tideHeight, { color: theme.colors.text }]}>
                                  {Number(tide.height).toFixed(1)} ft
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <View style={styles.noDataContainer}>
                          <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
                            No tide data available for this day
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
  },
  dayCard: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  dayHeaderLeft: {
    flex: 1,
  },
  dayName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dayDate: {
    fontSize: 14,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tempRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  highTemp: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  lowTemp: {
    fontSize: 18,
  },
  dayDetails: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  stokeRating: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  stokeLabel: {
    fontSize: 14,
  },
  stokeValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  stokeNumber: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  stokeMax: {
    fontSize: 18,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    width: '47%',
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  reportTextBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  reportText: {
    fontSize: 14,
    lineHeight: 20,
  },
  conditionsBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  conditionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  tidesContainer: {
    gap: 12,
  },
  tideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tideInfo: {
    flex: 1,
  },
  tideType: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  tideTime: {
    fontSize: 12,
  },
  tideHeight: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  noDataContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});
