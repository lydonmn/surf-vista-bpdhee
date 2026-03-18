
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useSurfData } from '@/hooks/useSurfData';
import { SurfReport, WeatherForecast, TideData } from '@/types';
import { getESTDate, getESTDateOffset, parseLocalDate } from '@/utils/surfDataFormatter';
import { openPaywall } from '@/utils/paywallHelper';
import { useLocation } from '@/contexts/LocationContext';

interface DayForecast {
  date: string;
  dayName: string;
  surfReport: SurfReport | null;
  weatherForecast: WeatherForecast | null;
  tides: TideData[];
}

function getTodayDateString(): string {
  return getESTDate();
}

function getDateNDaysFromNow(days: number): string {
  return getESTDateOffset(days);
}

function getDayName(dateStr: string): string {
  const today = getTodayDateString();
  if (dateStr === today) return 'Today';
  
  const date = parseLocalDate(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  
  if (dateStr === tomorrowStr) return 'Tomorrow';
  
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function formatDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function calculateSurfRating(surfData: any): number {
  if (!surfData) return 5;
  
  const surfHeightStr = surfData.surf_height || surfData.wave_height || '0';
  const periodStr = surfData.wave_period || '0';
  const windSpeedStr = surfData.wind_speed || '0';
  const windDirStr = surfData.wind_direction || '';
  
  if (surfHeightStr === 'N/A' || surfHeightStr === '' || surfHeightStr === 'null') {
    return 5;
  }
  
  const parseValue = (str: string): number => {
    const cleaned = String(str).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  let surfHeight = 0;
  const cleanedStr = String(surfHeightStr).trim();
  
  if (cleanedStr.includes('-')) {
    const parts = cleanedStr.split('-');
    const low = parseValue(parts[0]);
    const high = parseValue(parts[1]);
    surfHeight = (low + high) / 2;
  } else {
    surfHeight = parseValue(cleanedStr);
  }
  
  const period = parseValue(periodStr);
  const windSpeed = parseValue(windSpeedStr);
  const windDir = windDirStr.toLowerCase();
  const isOffshore = windDir.includes('w') || windDir.includes('n');

  let rating = 3;

  if (surfHeight >= 6) rating += 5;
  else if (surfHeight >= 4) rating += 4;
  else if (surfHeight >= 3) rating += 3;
  else if (surfHeight >= 2) rating += 2;
  else if (surfHeight >= 1.5) rating += 1;
  else if (surfHeight >= 1) rating += 0;
  else rating -= 1;

  if (period >= 12) rating += 2;
  else if (period >= 10) rating += 1;
  else if (period >= 8) rating += 0;
  else if (period >= 6) rating -= 1;
  else if (period > 0) rating -= 2;

  if (isOffshore) {
    if (windSpeed < 5) rating += 1;
    else if (windSpeed < 10) rating += 1;
    else if (windSpeed < 15) rating += 0;
    else rating -= 1;
  } else {
    if (windSpeed < 5) rating += 0;
    else if (windSpeed < 10) rating -= 1;
    else if (windSpeed < 15) rating -= 2;
    else rating -= 3;
  }

  return Math.max(1, Math.min(10, Math.round(rating)));
}

export default function ForecastScreen() {
  const theme = useTheme();
  const { user, checkSubscription, isLoading: authLoading, isInitialized, refreshProfile } = useAuth();
  const { currentLocation, locationData } = useLocation();
  const isSubscribed = checkSubscription();
  const { surfReports, weatherForecast, tideData, refreshData, isLoading, error } = useSurfData(currentLocation);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleRefresh = useCallback(async () => {
    console.log('[ForecastScreen] 🔄 Manual refresh triggered for location:', currentLocation);
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  }, [refreshData, currentLocation]);

  const handleSubscribeNow = async () => {
    console.log('[ForecastScreen] 🔘 Subscribe button pressed');
    
    if (!user) {
      console.log('[ForecastScreen] No user, redirecting to login');
      router.push('/login');
      return;
    }
    
    setIsSubscribing(true);
    
    await openPaywall(user.id, user.email || undefined, async () => {
      console.log('[ForecastScreen] ✅ Subscription successful, refreshing profile');
      await refreshProfile();
    });
    
    setIsSubscribing(false);
  };

  const combinedForecast: DayForecast[] = React.useMemo(() => {
    console.log('[ForecastScreen] 🔍 Building combined forecast for location:', currentLocation);
    console.log('[ForecastScreen] Surf reports count:', surfReports.length);
    console.log('[ForecastScreen] Weather forecast count:', weatherForecast.length);
    console.log('[ForecastScreen] Tide data count:', tideData.length);
    
    const forecastMap = new Map<string, DayForecast>();
    const today = getTodayDateString();

    // Add surf reports
    surfReports.forEach(report => {
      if (report.date >= today) {
        console.log(`[ForecastScreen] Adding surf report for ${report.date}:`, {
          surf_height: report.surf_height,
          wave_height: report.wave_height,
          wind_speed: report.wind_speed,
        });
        
        if (!forecastMap.has(report.date)) {
          forecastMap.set(report.date, {
            date: report.date,
            dayName: getDayName(report.date),
            surfReport: report,
            weatherForecast: null,
            tides: [],
          });
        } else {
          const existing = forecastMap.get(report.date)!;
          existing.surfReport = report;
        }
      }
    });

    // Add weather forecasts
    weatherForecast.forEach(forecast => {
      if (forecast.date >= today) {
        console.log(`[ForecastScreen] Adding weather forecast for ${forecast.date}:`, {
          high_temp: forecast.high_temp,
          low_temp: forecast.low_temp,
          conditions: forecast.conditions,
          prediction_confidence: forecast.prediction_confidence,
          swell_height_range: forecast.swell_height_range,
        });
        
        if (!forecastMap.has(forecast.date)) {
          forecastMap.set(forecast.date, {
            date: forecast.date,
            dayName: getDayName(forecast.date),
            surfReport: null,
            weatherForecast: forecast,
            tides: [],
          });
        } else {
          const existing = forecastMap.get(forecast.date)!;
          existing.weatherForecast = forecast;
        }
      }
    });

    // Add tide data
    tideData.forEach(tide => {
      if (tide.date >= today && forecastMap.has(tide.date)) {
        const existing = forecastMap.get(tide.date)!;
        existing.tides.push(tide);
      }
    });

    // Ensure we have entries for all 7 days
    for (let i = 0; i < 7; i++) {
      const date = getDateNDaysFromNow(i);
      if (!forecastMap.has(date)) {
        console.log(`[ForecastScreen] ⚠️ No data for ${date}, creating placeholder`);
        forecastMap.set(date, {
          date,
          dayName: getDayName(date),
          surfReport: null,
          weatherForecast: null,
          tides: [],
        });
      }
    }

    const result = Array.from(forecastMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7);
    
    console.log('[ForecastScreen] 📊 Final combined forecast:', result.map(d => ({
      date: d.date,
      dayName: d.dayName,
      hasSurfReport: !!d.surfReport,
      hasWeatherForecast: !!d.weatherForecast,
      swellHeight: d.weatherForecast?.swell_height_range || 'N/A',
      confidence: d.weatherForecast?.prediction_confidence,
      highTemp: d.weatherForecast?.high_temp,
      lowTemp: d.weatherForecast?.low_temp,
    })));
    
    return result;
  }, [surfReports, weatherForecast, tideData, currentLocation]);

  const toggleDay = (date: string) => {
    console.log('[ForecastScreen] Toggling day:', date);
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
    if (rating >= 8) return '#22C55E';
    if (rating >= 6) return '#FFC107';
    if (rating >= 4) return '#FF9800';
    return '#F44336';
  };

  const getConfidenceColor = (confidence: number | null) => {
    if (!confidence) return colors.textSecondary;
    if (confidence >= 80) return '#22C55E';
    if (confidence >= 60) return '#FFC107';
    return '#FF9800';
  };

  const formatTemp = (temp: any): string => {
    console.log('[ForecastScreen] formatTemp called with:', {
      value: temp,
      type: typeof temp,
      isNull: temp === null,
      isUndefined: temp === undefined,
    });
    
    if (temp === null || temp === undefined) {
      console.log('[ForecastScreen] ⚠️ Temperature is null/undefined, returning N/A');
      return 'N/A';
    }
    
    const numTemp = Number(temp);
    if (isNaN(numTemp)) {
      console.log('[ForecastScreen] ⚠️ Temperature is NaN, returning N/A');
      return 'N/A';
    }
    
    const displayValue = Math.round(numTemp);
    console.log('[ForecastScreen] ✅ Displaying temperature as:', displayValue + '°');
    return `${displayValue}°`;
  };

  const formatConfidence = (confidence: number | null | undefined): string => {
    console.log('[ForecastScreen] formatConfidence called with:', {
      value: confidence,
      type: typeof confidence,
      isNull: confidence === null,
      isUndefined: confidence === undefined,
    });
    
    if (confidence === null || confidence === undefined) {
      console.log('[ForecastScreen] ⚠️ Confidence is null/undefined, returning N/A');
      return 'N/A';
    }
    
    const numConfidence = Number(confidence);
    if (isNaN(numConfidence)) {
      console.log('[ForecastScreen] ⚠️ Confidence is NaN, returning N/A');
      return 'N/A';
    }
    
    const displayValue = Math.round(numConfidence);
    console.log('[ForecastScreen] ✅ Displaying confidence as:', displayValue + '%');
    return `${displayValue}%`;
  };

  if (!isInitialized || authLoading) {
    const loadingText = 'Loading...';
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>7-Day Forecast</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{loadingText}</Text>
        </View>
      </View>
    );
  }

  if (!user || !isSubscribed) {
    const subscriberOnlyText = 'Subscriber Only Content';
    const subscribeDescText = 'Subscribe to access 7-day surf forecasts';
    const buttonText = user ? 'Subscribe Now' : 'Sign In / Subscribe';
    
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>7-Day Forecast</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centerContent}>
          <IconSymbol ios_icon_name="lock.fill" android_material_icon_name="lock" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.colors.text }]}>{subscriberOnlyText}</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>{subscribeDescText}</Text>
          <TouchableOpacity style={[styles.subscribeButton, { backgroundColor: colors.accent }]} onPress={handleSubscribeNow} disabled={isSubscribing}>
            {isSubscribing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.subscribeButtonText}>{buttonText}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading && combinedForecast.length === 0) {
    const loadingForecastText = 'Loading forecast data...';
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>7-Day Forecast</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{loadingForecastText}</Text>
        </View>
      </View>
    );
  }

  const noForecastText = 'No forecast data available';
  const pullToRefreshText = 'Pull down to refresh';
  const locationNameText = locationData?.displayName || currentLocation;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>7-Day Forecast</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{locationNameText}</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh} disabled={isRefreshing}>
          <IconSymbol ios_icon_name="arrow.clockwise" android_material_icon_name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
          <IconSymbol ios_icon_name="exclamationmark.triangle.fill" android_material_icon_name="warning" size={16} color="#FF3B30" />
          <Text style={[styles.errorText, { color: '#FF3B30' }]}>{error}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {combinedForecast.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol ios_icon_name="exclamationmark.triangle" android_material_icon_name="warning" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{noForecastText}</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>{pullToRefreshText}</Text>
          </View>
        ) : (
          combinedForecast.map((day) => {
            const isExpanded = expandedDay === day.date;
            
            // Use weatherForecast.swell_height_range for ALL days (including today)
            const forecastSwellHeight = day.weatherForecast?.swell_height_range;
            
            // Only use surfReport data as fallback for today if forecast is missing
            const isToday = day.date === getTodayDateString();
            const surfHeightValue = isToday ? ((day.surfReport as any)?.surf_height || day.surfReport?.wave_height) : null;
            
            // Display forecast first, then fall back to today's actual data
            const displayHeight = forecastSwellHeight || surfHeightValue || 'N/A';
            
            console.log(`[ForecastScreen] Rendering ${day.date}:`, {
              isToday,
              forecastSwellHeight,
              surfHeightValue,
              displayHeight,
              confidence: day.weatherForecast?.prediction_confidence,
              confidenceType: typeof day.weatherForecast?.prediction_confidence,
              hasWeatherForecast: !!day.weatherForecast,
              highTemp: day.weatherForecast?.high_temp,
              lowTemp: day.weatherForecast?.low_temp,
            });
            
            const hasSurfData = displayHeight !== 'N/A';
            const dayRating = day.surfReport ? calculateSurfRating(day.surfReport) : null;
            const ratingColor = getStokeColor(dayRating);
            
            const confidenceValue = day.weatherForecast?.prediction_confidence;
            const confidenceColor = getConfidenceColor(confidenceValue);
            const confidenceText = formatConfidence(confidenceValue);

            const highTempText = formatTemp(day.weatherForecast?.high_temp);
            const lowTempText = formatTemp(day.weatherForecast?.low_temp);

            return (
              <View key={day.date} style={[styles.dayCard, { backgroundColor: theme.colors.card }]}>
                <TouchableOpacity style={styles.dayHeader} onPress={() => toggleDay(day.date)} activeOpacity={0.7}>
                  <View style={styles.dayHeaderLeft}>
                    <Text style={[styles.dayName, { color: theme.colors.text }]}>{day.dayName}</Text>
                    <Text style={[styles.dayDate, { color: colors.textSecondary }]}>{formatDate(day.date)}</Text>
                  </View>

                  <View style={styles.dayHeaderRight}>
                    {hasSurfData && (
                      <View style={styles.surfBadge}>
                        <IconSymbol ios_icon_name="water.waves" android_material_icon_name="waves" size={14} color={colors.primary} />
                        <Text style={[styles.surfBadgeText, { color: colors.primary }]}>{displayHeight}</Text>
                      </View>
                    )}
                    <View style={styles.tempContainer}>
                      <Text style={[styles.highTemp, { color: theme.colors.text }]}>{highTempText}</Text>
                      <Text style={[styles.tempSlash, { color: colors.textSecondary }]}>/</Text>
                      <Text style={[styles.lowTemp, { color: colors.textSecondary }]}>{lowTempText}</Text>
                    </View>
                    <IconSymbol
                      ios_icon_name={isExpanded ? 'chevron.up' : 'chevron.down'}
                      android_material_icon_name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.dayDetails}>
                    {hasSurfData && day.surfReport && (
                      <View style={styles.detailSection}>
                        <View style={styles.detailRow}>
                          <View style={styles.detailItem}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>SURF HEIGHT</Text>
                            <Text style={[styles.detailValue, { color: theme.colors.text }]}>{displayHeight}</Text>
                          </View>
                          <View style={styles.detailItem}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>PERIOD</Text>
                            <Text style={[styles.detailValue, { color: theme.colors.text }]}>{day.surfReport.wave_period || 'N/A'}</Text>
                          </View>
                        </View>
                        <View style={styles.detailRow}>
                          <View style={styles.detailItem}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>WIND</Text>
                            <Text style={[styles.detailValue, { color: theme.colors.text }]}>{day.surfReport.wind_speed || 'N/A'}</Text>
                            <Text style={[styles.detailSubvalue, { color: colors.textSecondary }]}>{day.surfReport.wind_direction || ''}</Text>
                          </View>
                          {dayRating && (
                            <View style={styles.detailItem}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>STOKE</Text>
                              <View style={styles.ratingContainer}>
                                <Text style={[styles.detailValue, { color: ratingColor }]}>{dayRating}</Text>
                                <Text style={[styles.ratingOutOf, { color: colors.textSecondary }]}>/10</Text>
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                    )}
                    
                    {day.weatherForecast && (
                      <View style={[styles.confidenceBadge, { backgroundColor: confidenceValue ? (theme.dark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)') : (theme.dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)') }]}>
                        <IconSymbol ios_icon_name="chart.bar.fill" android_material_icon_name="bar-chart" size={18} color={confidenceColor} />
                        <Text style={[styles.confidenceLabel, { color: theme.colors.text }]}>Forecast Confidence:</Text>
                        <Text style={[styles.confidenceValue, { color: confidenceColor }]}>{confidenceText}</Text>
                      </View>
                    )}

                    {day.weatherForecast && (
                      <View style={styles.detailSection}>
                        <View style={styles.detailRow}>
                          <View style={styles.detailItem}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>WIND</Text>
                            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                              {day.weatherForecast.wind_speed ? `${day.weatherForecast.wind_speed} mph` : 'N/A'}
                            </Text>
                            <Text style={[styles.detailSubvalue, { color: colors.textSecondary }]}>{day.weatherForecast.wind_direction || ''}</Text>
                          </View>
                          <View style={styles.detailItem}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>RAIN</Text>
                            <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                              {day.weatherForecast.precipitation_chance !== null ? `${day.weatherForecast.precipitation_chance}%` : 'N/A'}
                            </Text>
                          </View>
                        </View>
                        {day.weatherForecast.conditions && (
                          <View style={[styles.conditionsBox, { backgroundColor: theme.dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 122, 255, 0.08)' }]}>
                            <Text style={[styles.conditionsText, { color: theme.dark ? '#FFFFFF' : '#1A1A1A' }]}>{day.weatherForecast.conditions}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {day.tides.length > 0 && (
                      <View style={styles.tidesSection}>
                        <View style={styles.tidesHeader}>
                          <IconSymbol ios_icon_name="arrow.up.arrow.down" android_material_icon_name="swap-vert" size={16} color={colors.primary} />
                          <Text style={[styles.tidesTitle, { color: theme.colors.text }]}>TIDES</Text>
                        </View>
                        <View style={styles.tidesGrid}>
                          {day.tides.map((tide, tideIndex) => {
                            const isHighTide = tide.type === 'high' || tide.type === 'High';
                            const iconColor = isHighTide ? '#2196F3' : '#FF9800';
                            const tideTypeText = isHighTide ? 'High' : 'Low';
                            const tideHeightText = Number(tide.height).toFixed(1);
                            const tideTimeText = formatTime(tide.time);

                            return (
                              <View key={tideIndex} style={styles.tideItem}>
                                <IconSymbol
                                  ios_icon_name={isHighTide ? 'arrow.up' : 'arrow.down'}
                                  android_material_icon_name={isHighTide ? 'north' : 'south'}
                                  size={14}
                                  color={iconColor}
                                />
                                <Text style={[styles.tideType, { color: theme.colors.text }]}>{tideTypeText}</Text>
                                <Text style={[styles.tideTime, { color: colors.textSecondary }]}>{tideTimeText}</Text>
                                <Text style={[styles.tideHeight, { color: theme.colors.text }]}>{tideHeightText}</Text>
                                <Text style={[styles.tideUnit, { color: colors.textSecondary }]}>ft</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
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
    paddingHorizontal: 32,
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
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  subscribeButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dayCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    boxShadow: '0px 2px 12px rgba(0, 0, 0, 0.08)',
    elevation: 4,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  dayHeaderLeft: {
    flex: 1,
  },
  dayName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dayDate: {
    fontSize: 14,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  surfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    borderRadius: 10,
  },
  surfBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tempContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  highTemp: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tempSlash: {
    fontSize: 18,
  },
  lowTemp: {
    fontSize: 18,
  },
  dayDetails: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 12,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.15)',
  },
  detailSection: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 14,
  },
  detailItem: {
    flex: 1,
    backgroundColor: 'rgba(0, 122, 255, 0.06)',
    padding: 12,
    borderRadius: 10,
  },
  detailLabel: {
    fontSize: 11,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  detailSubvalue: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  ratingOutOf: {
    fontSize: 13,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  confidenceLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  confidenceValue: {
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 'auto',
  },
  conditionsBox: {
    padding: 14,
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.15)',
  },
  conditionsText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  tidesSection: {
    gap: 10,
    marginTop: 4,
  },
  tidesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tidesTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tidesGrid: {
    gap: 8,
  },
  tideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.06)',
    borderRadius: 8,
  },
  tideType: {
    fontSize: 14,
    fontWeight: '700',
    width: 45,
  },
  tideTime: {
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  tideHeight: {
    fontSize: 14,
    fontWeight: '700',
  },
  tideUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
});
