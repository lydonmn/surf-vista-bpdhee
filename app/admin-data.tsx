
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from './integrations/supabase/client';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useLocation } from '@/contexts/LocationContext';

interface DataCounts {
  tides: number;
  weather: number;
  forecast: number;
  surf: number;
  external: number;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface LocationReport {
  location: string;
  locationId: string;
  date: string;
  hasReport: boolean;
  hasNarrative: boolean;
  narrativeLength: number;
  waveHeight: string;
  lastUpdated: string;
}

export default function AdminDataScreen() {
  const router = useRouter();
  const { currentLocation, locationData, locations } = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [dataCounts, setDataCounts] = useState<DataCounts>({
    tides: 0,
    weather: 0,
    forecast: 0,
    surf: 0,
    external: 0,
  });
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [locationReports, setLocationReports] = useState<LocationReport[]>([]);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    console.log(`[AdminDataScreen] ${type.toUpperCase()}: ${message}`);
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const id = `${Date.now()}-${Math.random()}`;
    setActivityLog(prev => [{ id, timestamp, message, type }, ...prev].slice(0, 50));
  }, []);

  const loadLocationReports = useCallback(async (today: string) => {
    try {
      const reports: LocationReport[] = [];

      for (const loc of locations) {
        const { data: report } = await supabase
          .from('surf_reports')
          .select('*')
          .eq('date', today)
          .eq('location', loc.id)
          .maybeSingle();

        reports.push({
          location: loc.displayName,
          locationId: loc.id,
          date: today,
          hasReport: !!report,
          hasNarrative: !!(report?.conditions && report.conditions.length > 100),
          narrativeLength: report?.conditions?.length || 0,
          waveHeight: report?.wave_height || 'N/A',
          lastUpdated: report?.updated_at || 'Never',
        });
      }

      setLocationReports(reports);
    } catch (error) {
      console.error('Error loading location reports:', error);
    }
  }, [locations]);

  const loadDataCounts = useCallback(async () => {
    try {
      addLog(`Loading data counts for ${locationData.displayName}...`);
      
      // Get current date in EST
      const now = new Date();
      const estDateString = now.toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const [month, day, year] = estDateString.split('/');
      const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      const [tidesResult, weatherResult, forecastResult, surfResult, externalResult] = await Promise.all([
        supabase.from('tide_data').select('id', { count: 'exact', head: true }).eq('date', today).eq('location', currentLocation),
        supabase.from('weather_data').select('id', { count: 'exact', head: true }).eq('date', today).eq('location', currentLocation),
        supabase.from('weather_forecast').select('id', { count: 'exact', head: true }).eq('location', currentLocation),
        supabase.from('surf_conditions').select('id', { count: 'exact', head: true }).eq('date', today).eq('location', currentLocation),
        supabase.from('external_surf_reports').select('id', { count: 'exact', head: true }).eq('date', today).eq('location', currentLocation),
      ]);

      setDataCounts({
        tides: tidesResult.count || 0,
        weather: weatherResult.count || 0,
        forecast: forecastResult.count || 0,
        surf: surfResult.count || 0,
        external: externalResult.count || 0,
      });

      addLog(`Data counts loaded for ${locationData.displayName}: Tides=${tidesResult.count}, Weather=${weatherResult.count}, Forecast=${forecastResult.count}, Surf=${surfResult.count}, External=${externalResult.count}`, 'success');
      
      // Also load report status for both locations
      await loadLocationReports(today);
    } catch (error) {
      console.error('Error loading data counts:', error);
      addLog(`Error loading data counts: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [addLog, currentLocation, locationData, loadLocationReports]);

  useEffect(() => {
    console.log('[AdminDataScreen] Component mounted, loading data counts');
    loadDataCounts();
  }, [loadDataCounts]);

  const handleTriggerDailyUpdate = async () => {
    setIsLoading(true);
    addLog(`Manually triggering 5 AM daily report for BOTH locations...`);
    addLog(`⏳ This may take 60-90 seconds due to NOAA server response times...`, 'warning');
    addLog(`📍 Processing: Folly Beach, SC AND Pawleys Island, SC`, 'info');

    try {
      const response = await supabase.functions.invoke('daily-5am-report-with-retry', {
        body: {}
      });
      
      console.log('Daily update response:', response);
      addLog(`Daily update response: ${JSON.stringify(response.data).substring(0, 100)}...`);

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        
        // Check for timeout errors
        if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('AbortError')) {
          addLog(`⏱️ Request timed out - NOAA servers are responding slowly`, 'warning');
          addLog(`💡 Tip: Try again in a few minutes. NOAA servers can be slow during peak hours.`, 'info');
          Alert.alert(
            'Request Timed Out',
            'NOAA servers are responding slowly. This is normal during peak hours.\n\nThe data update may still complete in the background. Try refreshing in a few minutes.',
            [{ text: 'OK' }]
          );
        } else {
          addLog(`❌ Daily report error: ${errorMsg}`, 'error');
          Alert.alert('Error', errorMsg);
        }
      } else if (response.data?.success) {
        const results = response.data.results || [];
        const successCount = results.filter((r: any) => r.success).length;
        const totalCount = results.length;
        
        addLog(`✅ Daily 5 AM report completed: ${successCount}/${totalCount} locations successful`, 'success');
        
        // Log each location result
        results.forEach((result: any) => {
          if (result.success) {
            if (result.skipped) {
              addLog(`  ✅ ${result.location}: Report already exists`, 'info');
            } else {
              addLog(`  ✅ ${result.location}: Report generated successfully`, 'success');
            }
          } else {
            addLog(`  ❌ ${result.location}: ${result.error}`, 'error');
          }
        });
        
        Alert.alert('Success', `Daily reports generated for ${successCount}/${totalCount} locations!\n\n${results.map((r: any) => `${r.location}: ${r.success ? '✅' : '❌'}`).join('\\n')}`);
        
        // Wait for database to update, then reload counts
        await new Promise(resolve => setTimeout(resolve, 2000));
        await loadDataCounts();
      } else {
        const errorMsg = response.data?.error || 'Daily report failed';
        const results = response.data?.results || [];
        
        // Check for timeout in response data
        if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('slow')) {
          addLog(`⏱️ ${errorMsg}`, 'warning');
          addLog(`💡 Tip: NOAA servers can be slow. The update may complete in the background.`, 'info');
          Alert.alert(
            'Request Timed Out',
            `${errorMsg}\n\nThe data update may still complete in the background. Try refreshing in a few minutes.`,
            [{ text: 'OK' }]
          );
        } else {
          addLog(`❌ Daily report failed: ${errorMsg}`, 'error');
          
          // Log individual location failures
          results.forEach((result: any) => {
            if (!result.success) {
              addLog(`  ❌ ${result.location}: ${result.error}`, 'error');
            }
          });
          
          Alert.alert('Error', errorMsg);
        }
      }
    } catch (error) {
      console.error('Error triggering daily update:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Check for timeout errors
      if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('AbortError')) {
        addLog(`⏱️ Request timed out - NOAA servers are responding slowly`, 'warning');
        addLog(`💡 Tip: Try again in a few minutes. The update may complete in the background.`, 'info');
        Alert.alert(
          'Request Timed Out',
          'NOAA servers are responding slowly. This is normal during peak hours.\n\nThe data update may still complete in the background. Try refreshing in a few minutes.',
          [{ text: 'OK' }]
        );
      } else {
        addLog(`❌ Daily update exception: ${errorMsg}`, 'error');
        Alert.alert('Error', `Failed to trigger daily update: ${errorMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsLoading(true);
    addLog(`Generating new surf report for ${locationData.displayName}...`);
    addLog(`📍 Location: ${currentLocation}`, 'info');

    try {
      const response = await supabase.functions.invoke('generate-daily-report', {
        body: { location: currentLocation }
      });
      
      console.log('Generate report response:', response);
      addLog(`Generate report response: ${JSON.stringify(response.data).substring(0, 200)}...`);

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        addLog(`❌ Report generation error: ${errorMsg}`, 'error');
        Alert.alert('Error', errorMsg);
      } else if (response.data?.success) {
        addLog(`✅ Report generated successfully for ${locationData.displayName}`, 'success');
        
        // Show data age warning if applicable
        if (response.data.dataAge && response.data.dataAge !== 'Using current data') {
          addLog(`⚠️ ${response.data.dataAge}`, 'info');
          Alert.alert('Success', `${response.data.message}\n\n${response.data.dataAge}`);
        } else {
          Alert.alert('Success', response.data.message || 'Surf report generated successfully');
        }
        
        // Wait for database to update, then reload counts
        await new Promise(resolve => setTimeout(resolve, 2000));
        await loadDataCounts();
      } else {
        const errorMsg = response.data?.error || 'Failed to generate report';
        const suggestion = response.data?.suggestion || '';
        const missingData = response.data?.missingData || [];
        
        let fullMessage = errorMsg;
        if (missingData.length > 0) {
          fullMessage += `\n\nMissing: ${missingData.join(', ')}`;
        }
        if (suggestion) {
          fullMessage += `\n\n${suggestion}`;
        }
        
        addLog(`❌ Report generation failed: ${errorMsg}`, 'error');
        Alert.alert('Cannot Generate Report', fullMessage);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Report generation exception: ${errorMsg}`, 'error');
      Alert.alert('Error', `Failed to generate report: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchWeather = async () => {
    setIsLoading(true);
    addLog(`Fetching weather data for ${locationData.displayName}...`);
    addLog(`📍 Location: ${currentLocation}`, 'info');
    addLog(`⏳ This may take 30-60 seconds due to NOAA server response times...`, 'warning');

    try {
      const response = await supabase.functions.invoke('fetch-weather-data', {
        body: { location: currentLocation }
      });
      
      console.log('Weather response:', response);
      addLog(`Weather response: ${JSON.stringify(response.data).substring(0, 200)}...`);

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        
        // Check for timeout errors
        if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('AbortError')) {
          addLog(`⏱️ Weather fetch timed out - NOAA servers are responding slowly`, 'warning');
          addLog(`💡 Tip: Try again in a few minutes. NOAA servers can be slow during peak hours.`, 'info');
          Alert.alert(
            'Request Timed Out',
            'NOAA weather servers are responding slowly. This is normal during peak hours.\n\nTry again in a few minutes.',
            [{ text: 'OK' }]
          );
        } else {
          addLog(`❌ Weather error: ${errorMsg}`, 'error');
          Alert.alert('Error', errorMsg);
        }
      } else if (response.data?.success) {
        addLog(`✅ Weather fetch successful for ${locationData.displayName}: ${response.data.forecast_periods || 0} forecast periods`, 'success');
        Alert.alert('Success', response.data.message || `Weather data fetched successfully for ${locationData.displayName}`);
        
        // Wait for database to update, then reload counts
        await new Promise(resolve => setTimeout(resolve, 2000));
        await loadDataCounts();
      } else {
        const errorMsg = response.data?.error || 'Failed to fetch weather data';
        
        // Check for timeout in response data
        if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('slow')) {
          addLog(`⏱️ Weather fetch timed out: ${errorMsg}`, 'warning');
          addLog(`💡 Tip: NOAA servers can be slow. Try again in a few minutes.`, 'info');
          Alert.alert(
            'Request Timed Out',
            `${errorMsg}\n\nNOAA weather servers are responding slowly. Try again in a few minutes.`,
            [{ text: 'OK' }]
          );
        } else {
          addLog(`❌ Weather failed: ${errorMsg}`, 'error');
          Alert.alert('Error', errorMsg);
        }
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Check for timeout errors
      if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('AbortError')) {
        addLog(`⏱️ Weather fetch timed out - NOAA servers are responding slowly`, 'warning');
        addLog(`💡 Tip: Try again in a few minutes.`, 'info');
        Alert.alert(
          'Request Timed Out',
          'NOAA weather servers are responding slowly. This is normal during peak hours.\n\nTry again in a few minutes.',
          [{ text: 'OK' }]
        );
      } else {
        addLog(`❌ Weather exception: ${errorMsg}`, 'error');
        Alert.alert('Error', `Failed to fetch weather: ${errorMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchTides = async () => {
    setIsLoading(true);
    addLog(`Fetching tide data for ${locationData.displayName}...`);
    addLog(`📍 Location: ${currentLocation}`, 'info');
    addLog(`⏳ This may take 30-60 seconds due to NOAA server response times...`, 'warning');

    try {
      const response = await supabase.functions.invoke('fetch-tide-data', {
        body: { location: currentLocation }
      });
      
      console.log('Tide response:', response);
      addLog(`Tide response: ${JSON.stringify(response.data).substring(0, 200)}...`);

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        
        // Check for timeout errors
        if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('AbortError')) {
          addLog(`⏱️ Tide fetch timed out - NOAA servers are responding slowly`, 'warning');
          addLog(`💡 Tip: Try again in a few minutes.`, 'info');
          Alert.alert(
            'Request Timed Out',
            'NOAA tide servers are responding slowly. This is normal during peak hours.\n\nTry again in a few minutes.',
            [{ text: 'OK' }]
          );
        } else {
          addLog(`❌ Tide error: ${errorMsg}`, 'error');
          Alert.alert('Error', errorMsg);
        }
      } else if (response.data?.success) {
        addLog(`✅ Tide fetch successful for ${locationData.displayName}: ${response.data.count || 0} records`, 'success');
        Alert.alert('Success', response.data.message || `Tide data fetched successfully for ${locationData.displayName}`);
        
        // Wait for database to update, then reload counts
        await new Promise(resolve => setTimeout(resolve, 2000));
        await loadDataCounts();
      } else {
        const errorMsg = response.data?.error || 'Failed to fetch tide data';
        
        // Check for timeout in response data
        if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('slow')) {
          addLog(`⏱️ Tide fetch timed out: ${errorMsg}`, 'warning');
          addLog(`💡 Tip: NOAA servers can be slow. Try again in a few minutes.`, 'info');
          Alert.alert(
            'Request Timed Out',
            `${errorMsg}\n\nNOAA tide servers are responding slowly. Try again in a few minutes.`,
            [{ text: 'OK' }]
          );
        } else {
          addLog(`❌ Tide failed: ${errorMsg}`, 'error');
          Alert.alert('Error', errorMsg);
        }
      }
    } catch (error) {
      console.error('Error fetching tides:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Check for timeout errors
      if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('AbortError')) {
        addLog(`⏱️ Tide fetch timed out - NOAA servers are responding slowly`, 'warning');
        addLog(`💡 Tip: Try again in a few minutes.`, 'info');
        Alert.alert(
          'Request Timed Out',
          'NOAA tide servers are responding slowly. This is normal during peak hours.\n\nTry again in a few minutes.',
          [{ text: 'OK' }]
        );
      } else {
        addLog(`❌ Tide exception: ${errorMsg}`, 'error');
        Alert.alert('Error', `Failed to fetch tides: ${errorMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchSurf = async () => {
    setIsLoading(true);
    addLog(`Fetching surf report data for ${locationData.displayName}...`);
    addLog(`📍 Location: ${currentLocation}`, 'info');
    addLog(`⏳ This may take 30-60 seconds due to NOAA server response times...`, 'warning');

    try {
      const response = await supabase.functions.invoke('fetch-surf-reports', {
        body: { location: currentLocation }
      });
      
      console.log('Surf response:', response);
      addLog(`Surf response: ${JSON.stringify(response.data).substring(0, 200)}...`);

      if (response.error) {
        const errorMsg = response.error.message || JSON.stringify(response.error);
        
        // Check for timeout errors
        if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('AbortError')) {
          addLog(`⏱️ Surf fetch timed out - NOAA servers are responding slowly`, 'warning');
          addLog(`💡 Tip: Try again in a few minutes.`, 'info');
          Alert.alert(
            'Request Timed Out',
            'NOAA buoy servers are responding slowly. This is normal during peak hours.\n\nTry again in a few minutes.',
            [{ text: 'OK' }]
          );
        } else {
          addLog(`❌ Surf error: ${errorMsg}`, 'error');
          Alert.alert('Error', `Edge Function returned a non-2xx status code: ${errorMsg}`);
        }
      } else if (response.data?.success) {
        addLog(`✅ Surf fetch successful for ${locationData.displayName}: Found ${response.data.data?.wave_height || 'N/A'}`, 'success');
        Alert.alert('Success', response.data.message || `Surf data fetched successfully for ${locationData.displayName}`);
        
        // Wait for database to update, then reload counts
        await new Promise(resolve => setTimeout(resolve, 2000));
        await loadDataCounts();
      } else {
        const errorMsg = response.data?.error || 'Failed to fetch surf data';
        const details = response.data?.details ? `\n\nDetails: ${response.data.details}` : '';
        
        // Check for timeout in response data
        if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('slow')) {
          addLog(`⏱️ Surf fetch timed out: ${errorMsg}`, 'warning');
          addLog(`💡 Tip: NOAA servers can be slow. Try again in a few minutes.`, 'info');
          Alert.alert(
            'Request Timed Out',
            `${errorMsg}\n\nNOAA buoy servers are responding slowly. Try again in a few minutes.`,
            [{ text: 'OK' }]
          );
        } else {
          addLog(`❌ Surf failed: ${errorMsg}${details}`, 'error');
          Alert.alert('Error', `Edge Function returned a non-2xx status code\n\n${errorMsg}${details}`);
        }
      }
    } catch (error) {
      console.error('Error fetching surf:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Check for timeout errors
      if (errorMsg.includes('timeout') || errorMsg.includes('timed out') || errorMsg.includes('AbortError')) {
        addLog(`⏱️ Surf fetch timed out - NOAA servers are responding slowly`, 'warning');
        addLog(`💡 Tip: Try again in a few minutes.`, 'info');
        Alert.alert(
          'Request Timed Out',
          'NOAA buoy servers are responding slowly. This is normal during peak hours.\n\nTry again in a few minutes.',
          [{ text: 'OK' }]
        );
      } else {
        addLog(`❌ Surf exception: ${errorMsg}`, 'error');
        Alert.alert('Error', `Edge Function returned a non-2xx status code: ${errorMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLog = () => {
    console.log('[AdminDataScreen] Clearing activity log');
    setActivityLog([]);
    addLog('Activity log cleared');
  };

  const handleGoBack = () => {
    console.log('[AdminDataScreen] Navigating back...');
    if (router.canGoBack()) {
      router.back();
    } else {
      // If can't go back, navigate to home
      router.replace('/(tabs)/(home)');
    }
  };

  const backIconName = 'chevron.left';
  const backMaterialIconName = 'arrow_back';
  const backButtonTextContent = 'Back';
  const headerTitleText = 'Data Sources';
  const sectionTitleText1 = `Current Data (Today)`;
  const countLabelTides = 'Tides';
  const countLabelWeather = 'Weather';
  const countLabelForecast = 'Forecast';
  const countLabelSurf = 'Surf';
  const infoTitleText = '⏰ Automated Update Schedule';
  const locationListText = locations.map(loc => `  - ${loc.displayName}`).join('\n');
  const infoTextContent = `✅ ACTIVE - Automated updates are running!

• 5:00 AM EST: Generate initial conditions narrative for ALL locations
${locationListText}
• Every 15 min (5 AM - 9 PM): Update buoy data only (narrative preserved)
• Failed fetches preserve existing data

The system automatically generates separate reports for each location every morning at 5 AM EST. The initial narrative is retained all day while buoy data updates every 15 minutes.`;
  const locationCountText = locations.length === 1 ? '1 Location' : `${locations.length} Locations`;
  const buttonText1 = `🌅 Trigger 5 AM Report (${locationCountText})`;
  const buttonText2 = '🌊 Pull New Surf Data';
  const buttonText3 = '📝 Generate New Narrative Report';
  const sectionTitleText2 = 'Individual Data Sources';
  const buttonText4 = '🌤️ Fetch Weather & Forecast';
  const buttonText5 = '🌊 Fetch Tide Data';
  const buttonText6 = '🏄 Fetch Surf Report';
  const sectionTitleText3 = 'Activity Log';
  const clearButtonText = 'Clear';
  const logEmptyText = 'No activity yet';
  const locationStatusTitle = '📍 Today\'s Report Status (Both Locations)';

  return (
    <View style={styles.container}>
      {/* Custom Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
        >
          <IconSymbol
            ios_icon_name={backIconName}
            android_material_icon_name={backMaterialIconName}
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.backButtonText, { color: colors.primary }]}>
            {backButtonTextContent}
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitleText}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Location Selector */}
        <View style={styles.locationSelectorCard}>
          <Text style={styles.locationSelectorTitle}>📍 Select Location</Text>
          <View style={styles.locationButtons}>
            {locations.map((loc) => {
              const isActive = currentLocation === loc.id;
              return (
                <TouchableOpacity
                  key={loc.id}
                  style={[
                    styles.locationButton,
                    isActive && styles.locationButtonActive
                  ]}
                  onPress={() => {
                    console.log('[AdminDataScreen] Switching to', loc.name);
                    router.setParams({ location: loc.id });
                  }}
                >
                  <Text style={[
                    styles.locationButtonText,
                    isActive && styles.locationButtonTextActive
                  ]}>
                    {loc.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.locationSelectorSubtitle}>
            Currently viewing: {locationData.displayName}
          </Text>
        </View>

        {/* Data Counts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{sectionTitleText1}</Text>
          <View style={styles.countsGrid}>
            <View style={styles.countCard} key="tides-count">
              <Text style={styles.countValue}>{dataCounts.tides}</Text>
              <Text style={styles.countLabel}>{countLabelTides}</Text>
            </View>
            <View style={styles.countCard} key="weather-count">
              <Text style={styles.countValue}>{dataCounts.weather}</Text>
              <Text style={styles.countLabel}>{countLabelWeather}</Text>
            </View>
            <View style={styles.countCard} key="forecast-count">
              <Text style={styles.countValue}>{dataCounts.forecast}</Text>
              <Text style={styles.countLabel}>{countLabelForecast}</Text>
            </View>
            <View style={styles.countCard} key="surf-count">
              <Text style={styles.countValue}>{dataCounts.surf}</Text>
              <Text style={styles.countLabel}>{countLabelSurf}</Text>
            </View>
          </View>
        </View>

        {/* Location Report Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{locationStatusTitle}</Text>
          {locationReports.map((report) => {
            const statusIcon = report.hasReport && report.hasNarrative ? '✅' : report.hasReport ? '⚠️' : '❌';
            const statusText = report.hasReport && report.hasNarrative 
              ? 'Report with narrative' 
              : report.hasReport 
                ? 'Report without narrative' 
                : 'No report';
            const lastUpdatedText = report.lastUpdated !== 'Never' 
              ? new Date(report.lastUpdated).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
              : 'Never';
            
            return (
              <View style={styles.locationCard} key={report.locationId}>
                <View style={styles.locationHeader}>
                  <Text style={styles.locationName}>{report.location}</Text>
                  <Text style={styles.locationStatus}>{statusIcon}</Text>
                </View>
                <View style={styles.locationDetails}>
                  <Text style={styles.locationDetailText}>Status: {statusText}</Text>
                  <Text style={styles.locationDetailText}>Wave Height: {report.waveHeight}</Text>
                  <Text style={styles.locationDetailText}>Narrative: {report.narrativeLength} chars</Text>
                  <Text style={styles.locationDetailText}>Last Updated: {lastUpdatedText}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Automated Update Schedule Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{infoTitleText}</Text>
          <Text style={styles.infoText}>
            {infoTextContent}
          </Text>
        </View>

        {/* Quick Actions for Current Location */}
        <View style={styles.quickActionsCard}>
          <Text style={styles.quickActionsTitle}>⚡ Quick Actions for {locationData.name}</Text>
          
          {/* Pull New Surf Data Button */}
          <TouchableOpacity
            style={[styles.button, styles.dataButton, isLoading && styles.buttonDisabled]}
            onPress={handleFetchSurf}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="arrow.down.circle.fill"
                  android_material_icon_name="download"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.buttonText}>{buttonText2}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Generate New Narrative Report Button */}
          <TouchableOpacity
            style={[styles.button, styles.narrativeButton, isLoading && styles.buttonDisabled]}
            onPress={handleGenerateReport}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="doc.text.fill"
                  android_material_icon_name="description"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.buttonText}>{buttonText3}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Manual Daily Update Button (simulates 5 AM automatic update) */}
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleTriggerDailyUpdate}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{buttonText1}</Text>
          )}
        </TouchableOpacity>

        {/* Individual Updates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{sectionTitleText2}</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleFetchWeather}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>{buttonText4}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleFetchTides}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>{buttonText5}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleFetchSurf}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>{buttonText6}</Text>
          </TouchableOpacity>
        </View>

        {/* Activity Log */}
        <View style={styles.section}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>{sectionTitleText3}</Text>
            <TouchableOpacity onPress={handleClearLog}>
              <Text style={styles.clearButton}>{clearButtonText}</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.logContainer}>
            {activityLog.length === 0 ? (
              <Text style={styles.logEmpty}>{logEmptyText}</Text>
            ) : (
              <>
                {activityLog.map((log) => {
                  const logTimestampText = `[${log.timestamp}]`;
                  return (
                    <View key={log.id} style={styles.logEntry}>
                      <Text style={styles.logTimestamp}>{logTimestampText}</Text>
                      <Text style={[
                        styles.logMessage,
                        log.type === 'error' && styles.logError,
                        log.type === 'success' && styles.logSuccess,
                        log.type === 'warning' && styles.logWarning,
                      ]}>
                        {log.message}
                      </Text>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingRight: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  countsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  countCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  countValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  countLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  accentButton: {
    backgroundColor: colors.accent,
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  logContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    maxHeight: 400,
  },
  logEmpty: {
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  logEntry: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  logTimestamp: {
    color: colors.textSecondary,
    fontSize: 12,
    marginRight: 8,
    fontFamily: 'monospace',
  },
  logMessage: {
    color: colors.text,
    fontSize: 12,
    flex: 1,
    fontFamily: 'monospace',
  },
  logError: {
    color: '#ff4444',
  },
  logSuccess: {
    color: '#44ff44',
  },
  logWarning: {
    color: '#ffaa00',
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  locationCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  locationStatus: {
    fontSize: 24,
  },
  locationDetails: {
    gap: 4,
  },
  locationDetailText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  locationSelectorCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  locationSelectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  locationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  locationButton: {
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  locationButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  locationButtonTextActive: {
    color: '#FFFFFF',
  },
  locationSelectorSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  quickActionsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  dataButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  narrativeButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
