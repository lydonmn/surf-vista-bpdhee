
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

interface DayForecast {
  date: string;
  dayName: string;
  surfReport: SurfReport | null;
  weatherForecast: WeatherForecast | null;
  tides: TideData[];
}

// Helper function to get today's date in YYYY-MM-DD format (EST timezone)
function getTodayDateString(): string {
  return getESTDate();
}

// Helper function to get date N days from now (EST timezone)
function getDateNDaysFromNow(days: number): string {
  return getESTDateOffset(days);
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
  
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

// Helper function to format date
function formatDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// 🚨 CRITICAL FIX: More conservative stoke meter calculation matching backend and home screen
function calculateSurfRating(surfData: any): number {
  if (!surfData) return 5;
  
  const surfHeightStr = surfData.surf_height || surfData.wave_height || '0';
  const periodStr = surfData.wave_period || '0';
  const windSpeedStr = surfData.wind_speed || '0';
  const windDirStr = surfData.wind_direction || '';
  
  if (surfHeightStr === 'N/A' || surfHeightStr === '' || surfHeightStr === 'null') {
    return 5;
  }
  
  // Parse wave height - handle ranges like "1.0-1.5 ft"
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
  const isSubscribed = checkSubscription();
  const { surfReports, weatherForecast, tideData, refreshData, isLoading, error } = useSurfData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleRefresh = useCallback(async () => {
    console.log('[ForecastScreen] 🔄 Manual refresh triggered');
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  }, [refreshData]);

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

  // Combine all data by date - ONLY INCLUDE TODAY AND FUTURE DATES
  const combinedForecast: DayForecast[] = React.useMemo(() => {
    const forecastMap = new Map<string, DayForecast>();
    const today = getTodayDateString();

    console.log('[ForecastScreen] 📊 Building forecast, today:', today);
    console.log('[ForecastScreen] 📊 Raw weatherForecast data:', weatherForecast.map(f => ({
      date: f.date,
      swell_height_range: f.swell_height_range,
      prediction_source: f.prediction_source,
      prediction_confidence: f.prediction_confidence,
    })));

    // Add surf reports (only today and future)
    surfReports.forEach(report => {
      if (report.date >= today) {
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

    // Add weather forecasts (only today and future)
    weatherForecast.forEach(forecast => {
      if (forecast.date >= today) {
        console.log(`[ForecastScreen] 📊 Adding forecast for ${forecast.date}:`, {
          swell_height_range: forecast.swell_height_range,
          source: forecast.prediction_source,
          confidence: forecast.prediction_confidence,
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

    // Add tides (only today and future)
    tideData.forEach(tide => {
      if (tide.date >= today && forecastMap.has(tide.date)) {
        const existing = forecastMap.get(tide.date)!;
        existing.tides.push(tide);
      }
    });

    // If we don't have enough data, generate placeholder entries for the next 7 days
    const existingDates = Array.from(forecastMap.keys());
    console.log('[ForecastScreen] 📊 Existing forecast dates:', existingDates);

    // Generate dates for the next 7 days starting from today
    for (let i = 0; i < 7; i++) {
      const date = getDateNDaysFromNow(i);
      if (!forecastMap.has(date)) {
        console.log(`[ForecastScreen] ⚠️ Missing forecast data for ${date}, adding placeholder`);
        forecastMap.set(date, {
          date,
          dayName: getDayName(date),
          surfReport: null,
          weatherForecast: null,
          tides: [],
        });
      }
    }

    // Convert to array and sort by date
    const result = Array.from(forecastMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7); // Limit to 7 days

    console.log('[ForecastScreen] 📊 Final forecast summary:');
    result.forEach(f => {
      console.log(`  ${f.date} (${f.dayName}): ${f.weatherForecast?.swell_height_range || 'No data'} - Source: ${f.weatherForecast?.prediction_source || 'N/A'}`);
    });

    return result;
  }, [surfReports, weatherForecast, tideData]);

  const toggleDay = (date: string) => {
    console.log('[ForecastScreen] 🔽 Toggling day:', date);
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

  const formatTemp = (temp: any): string => {
    if (temp === null || temp === undefined) return 'N/A';
    const numTemp = Number(temp);
    if (isNaN(numTemp)) return 'N/A';
    return `${Math.round(numTemp)}°`;
  };

  const getConfidenceBadge = (confidence: number | null, source: string | null) => {
    if (!confidence || !source) return null;
    
    let badgeColor = '#4CAF50';
    let badgeText = 'High Confidence';
    
    if (source === 'actual') {
      badgeColor = '#2196F3';
      badgeText = 'Live Data';
    } else if (confidence >= 0.8) {
      badgeColor = '#4CAF50';
      badgeText = 'High Confidence';
    } else if (confidence >= 0.5) {
      badgeColor = '#FFC107';
      badgeText = 'Medium Confidence';
    } else {
      badgeColor = '#FF9800';
      badgeText = 'Low Confidence';
    }
    
    return { color: badgeColor, text: badgeText };
  };

  // ✅ V6.0.2 FIX: Show loading only during initial auth check
  if (!isInitialized || authLoading) {
    const loadingText = 'Loading...';
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
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
            {loadingText}
          </Text>
        </View>
      </View>
    );
  }

  // ✅ V6.0.2 FIX: Check subscription status
  if (!user || !isSubscribed) {
    const subscriberOnlyText = 'Subscriber Only Content';
    const subscribeDescText = 'Subscribe to access 7-day surf forecasts';
    const buttonText = user ? 'Subscribe Now' : 'Sign In / Subscribe';
    
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
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
          <IconSymbol
            ios_icon_name="lock.fill"
            android_material_icon_name="lock"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyText, { color: theme.colors.text }]}>
            {subscriberOnlyText}
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            {subscribeDescText}
          </Text>
          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: colors.accent }]}
            onPress={handleSubscribeNow}
            disabled={isSubscribing}
          >
            {isSubscribing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.subscribeButtonText}>
                {buttonText}
              </Text>
            )}
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
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
            {loadingForecastText}
          </Text>
        </View>
      </View>
    );
  }

  const noForecastText = 'No forecast data available';
  const pullToRefreshText = 'Pull down to refresh';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back"
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
              {noForecastText}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              {pullToRefreshText}
            </Text>
          </View>
        ) : (
          combinedForecast.map((day) => {
            const isExpanded = expandedDay === day.date;
            const hasSurfData = day.weatherForecast?.swell_height_range;
            const confidenceBadge = getConfidenceBadge(
              day.weatherForecast?.prediction_confidence || null,
              day.weatherForecast?.prediction_source || null
            );
            
            // 🚨 CRITICAL FIX: Calculate rating using the same logic as home screen
            const dayRating = day.surfReport ? calculateSurfRating(day.surfReport) : (day.surfReport?.rating || null);
            const ratingColor = getStokeColor(dayRating);

            const surfForecastTitle = 'Surf Forecast';
            const predictedSurfHeightLabel = 'Predicted Surf Height';
            const sourcePrefix = 'Source: ';
            const liveDataText = 'Live Buoy Data';
            const buoyEstimationText = 'Buoy Estimation';
            const aiPredictionText = 'AI Prediction';
            const baselineText = 'Baseline';
            const waveHeightLabel = 'Wave Height';
            const wavePeriodLabel = 'Wave Period';
            const windLabel = 'Wind';
            const stokeRatingLabel = 'Stoke Rating';
            const surfForecastSoonText = 'Surf forecast data will be available soon';
            const weatherTitle = 'Weather';
            const highLowLabel = 'High / Low';
            const humidityLabel = 'Humidity';
            const rainChanceLabel = 'Rain Chance';
            const noWeatherText = 'No weather data available for this day';
            const tideScheduleTitle = 'Tide Schedule';
            const highTideText = 'High';
            const lowTideText = 'Low';
            const tideText = 'Tide';
            const noTideText = 'No tide data available for this day';

            return (
              <View
                key={day.date}
                style={[styles.dayCard, { 
                  backgroundColor: theme.colors.card,
                  borderWidth: 1,
                  borderColor: theme.dark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)'
                }]}
              >
                <TouchableOpacity
                  style={styles.dayHeader}
                  onPress={() => toggleDay(day.date)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dayHeaderLeft}>
                    <Text style={[styles.dayName, { color: theme.colors.text }]}>
                      {day.dayName}
                    </Text>
                    <Text style={[styles.dayDate, { color: colors.textSecondary }]}>
                      {formatDate(day.date)}
                    </Text>
                    {hasSurfData && (
                      <View style={styles.surfPreview}>
                        <IconSymbol
                          ios_icon_name="water.waves"
                          android_material_icon_name="waves"
                          size={16}
                          color={colors.primary}
                        />
                        <Text style={[styles.surfPreviewText, { color: colors.primary }]}>
                          {day.weatherForecast?.swell_height_range}
                        </Text>
                      </View>
                    )}
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
                      android_material_icon_name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                      size={24}
                      color={colors.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.dayDetails}>
                    {/* Surf Forecast Section - ENHANCED WITH HOME SCREEN IMPROVEMENTS */}
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <IconSymbol
                          ios_icon_name="water.waves"
                          android_material_icon_name="waves"
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                          {surfForecastTitle}
                        </Text>
                        {confidenceBadge && (
                          <View style={[styles.confidenceBadge, { backgroundColor: confidenceBadge.color }]}>
                            <Text style={styles.confidenceBadgeText}>
                              {confidenceBadge.text}
                            </Text>
                          </View>
                        )}
                      </View>

                      {hasSurfData ? (
                        <React.Fragment>
                          <View style={styles.surfHeightDisplay}>
                            <Text style={[styles.surfHeightLabel, { color: colors.textSecondary }]}>
                              {predictedSurfHeightLabel}
                            </Text>
                            <Text style={[styles.surfHeightValue, { color: colors.primary }]}>
                              {day.weatherForecast?.swell_height_range}
                            </Text>
                            {day.weatherForecast?.prediction_source && (
                              <Text style={[styles.surfSource, { color: colors.textSecondary }]}>
                                {sourcePrefix}{day.weatherForecast.prediction_source === 'actual' ? liveDataText : 
                                         day.weatherForecast.prediction_source === 'buoy_estimation' ? buoyEstimationText : 
                                         day.weatherForecast.prediction_source === 'ai_prediction' ? aiPredictionText : baselineText}
                              </Text>
                            )}
                          </View>

                          {day.surfReport && (
                            <View style={styles.detailsGrid}>
                              <View style={styles.detailItem}>
                                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                  {waveHeightLabel}
                                </Text>
                                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                  {day.surfReport.wave_height || 'N/A'}
                                </Text>
                              </View>

                              <View style={styles.detailItem}>
                                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                  {wavePeriodLabel}
                                </Text>
                                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                  {day.surfReport.wave_period || 'N/A'}
                                </Text>
                              </View>

                              <View style={styles.detailItem}>
                                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                  {windLabel}
                                </Text>
                                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                  {day.surfReport.wind_speed || 'N/A'}
                                </Text>
                                <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                  {day.surfReport.wind_direction || ''}
                                </Text>
                              </View>

                              <View style={styles.detailItem}>
                                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                  {stokeRatingLabel}
                                </Text>
                                <Text style={[styles.detailValue, { color: ratingColor }]}>
                                  {dayRating || 'N/A'}
                                </Text>
                                <Text style={[styles.ratingOutOf, { color: colors.textSecondary }]}>
                                  / 10
                                </Text>
                              </View>
                            </View>
                          )}
                        </React.Fragment>
                      ) : (
                        <View style={styles.noDataContainer}>
                          <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
                            {surfForecastSoonText}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Weather Section */}
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <IconSymbol
                          ios_icon_name="cloud.sun.fill"
                          android_material_icon_name="wb-sunny"
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                          {weatherTitle}
                        </Text>
                      </View>

                      {day.weatherForecast ? (
                        <React.Fragment>
                          <View style={styles.detailsGrid}>
                            <View style={styles.detailItem}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                {highLowLabel}
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                {formatTemp(day.weatherForecast.high_temp)}
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                /
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                {formatTemp(day.weatherForecast.low_temp)}
                              </Text>
                            </View>

                            <View style={styles.detailItem}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                {windLabel}
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                {day.weatherForecast.wind_speed ? `${day.weatherForecast.wind_speed} mph` : 'N/A'}
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                {day.weatherForecast.wind_direction || ''}
                              </Text>
                            </View>

                            <View style={styles.detailItem}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                {humidityLabel}
                              </Text>
                              <Text style={[styles.detailValue, { color: theme.colors.text }]}>
                                {day.weatherForecast.humidity ? `${day.weatherForecast.humidity}%` : 'N/A'}
                              </Text>
                            </View>

                            <View style={styles.detailItem}>
                              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                                {rainChanceLabel}
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
                            {noWeatherText}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Tides Section */}
                    <View style={styles.section}>
                      <View style={styles.sectionHeader}>
                        <IconSymbol
                          ios_icon_name="arrow.up.arrow.down"
                          android_material_icon_name="swap-vert"
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                          {tideScheduleTitle}
                        </Text>
                      </View>

                      {day.tides.length > 0 ? (
                        <View style={styles.tidesContainer}>
                          {day.tides.map((tide, tideIndex) => {
                            const isHighTide = tide.type === 'high' || tide.type === 'High';
                            const iconColor = isHighTide ? '#2196F3' : '#FF9800';
                            const tideTypeText = isHighTide ? highTideText : lowTideText;

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
                                    {tideTypeText}
                                  </Text>
                                  <Text style={[styles.tideTypeLabel, { color: theme.colors.text }]}>
                                    {tideText}
                                  </Text>
                                  <Text style={[styles.tideTime, { color: colors.textSecondary }]}>
                                    {formatTime(tide.time)}
                                  </Text>
                                </View>
                                <Text style={[styles.tideHeight, { color: theme.colors.text }]}>
                                  {Number(tide.height).toFixed(1)}
                                </Text>
                                <Text style={[styles.tideHeightUnit, { color: theme.colors.text }]}>
                                  ft
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <View style={styles.noDataContainer}>
                          <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
                            {noTideText}
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
    marginBottom: 4,
  },
  surfPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  surfPreviewText: {
    fontSize: 14,
    fontWeight: '600',
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
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  surfHeightDisplay: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  surfHeightLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  surfHeightValue: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  surfSource: {
    fontSize: 11,
    fontStyle: 'italic',
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
  ratingOutOf: {
    fontSize: 13,
    fontWeight: '500',
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
  tideTypeLabel: {
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
  tideHeightUnit: {
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
