
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/app/integrations/supabase/client';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from '@/components/IconSymbol';
import { router } from 'expo-router';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  statusGood: {
    color: '#4ade80',
  },
  statusBad: {
    color: '#f87171',
  },
  statusWarning: {
    color: '#fbbf24',
  },
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonTextSecondary: {
    color: colors.text,
  },
  logEntry: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  logTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  logMessage: {
    fontSize: 14,
    color: colors.text,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

interface ReportStatus {
  todayDate: string;
  hasReport: boolean;
  reportCreatedAt: string | null;
  hasNarrative: boolean;
  narrativeLength: number;
  lastUpdateTime: string | null;
  waveHeight: string | null;
  hasValidWaveData: boolean;
}

interface BuoyStatus {
  latestDate: string | null;
  waveHeight: string | null;
  surfHeight: string | null;
  windSpeed: string | null;
  waterTemp: string | null;
  lastUpdated: string | null;
}

export default function AdminCronLogsScreen() {
  const { colors: themeColors } = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportStatus, setReportStatus] = useState<ReportStatus | null>(null);
  const [buoyStatus, setBuoyStatus] = useState<BuoyStatus | null>(null);
  const [testingFunction, setTestingFunction] = useState(false);

  useEffect(() => {
    if (profile && !profile.is_admin) {
      console.log('User is not admin, redirecting to home');
      router.replace('/');
      return;
    }
    
    if (profile?.is_admin) {
      loadDiagnostics();
    }
  }, [profile, loadDiagnostics]);

  const getESTDate = (): string => {
    const now = new Date();
    const estDateString = now.toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const [month, day, year] = estDateString.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const loadDiagnostics = async () => {
    console.log('Admin Cron Logs: Loading diagnostics');
    setLoading(true);
    
    try {
      const today = getESTDate();
      console.log('Admin Cron Logs: Today date (EST):', today);

      // Check today's report
      const { data: reportData, error: reportError } = await supabase
        .from('surf_reports')
        .select('*')
        .eq('date', today)
        .maybeSingle();

      if (reportError) {
        console.error('Admin Cron Logs: Error fetching report:', reportError);
      }

      const hasNarrative = reportData?.conditions && reportData.conditions.length > 50;
      const hasValidWaveData = reportData?.wave_height && reportData.wave_height !== 'N/A';

      setReportStatus({
        todayDate: today,
        hasReport: !!reportData,
        reportCreatedAt: reportData?.updated_at || null,
        hasNarrative: hasNarrative,
        narrativeLength: reportData?.conditions?.length || 0,
        lastUpdateTime: reportData?.updated_at || null,
        waveHeight: reportData?.wave_height || null,
        hasValidWaveData: hasValidWaveData,
      });

      // Check buoy data
      const { data: buoyData, error: buoyError } = await supabase
        .from('surf_conditions')
        .select('*')
        .eq('date', today)
        .maybeSingle();

      if (buoyError) {
        console.error('Admin Cron Logs: Error fetching buoy data:', buoyError);
      }

      setBuoyStatus({
        latestDate: buoyData?.date || null,
        waveHeight: buoyData?.wave_height || null,
        surfHeight: buoyData?.surf_height || null,
        windSpeed: buoyData?.wind_speed || null,
        waterTemp: buoyData?.water_temp || null,
        lastUpdated: buoyData?.updated_at || null,
      });

      console.log('Admin Cron Logs: Diagnostics loaded', {
        hasReport: !!reportData,
        hasNarrative,
        hasBuoyData: !!buoyData,
      });
    } catch (error) {
      console.error('Admin Cron Logs: Error loading diagnostics:', error);
      Alert.alert('Error', 'Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  };

  const testDailyReport = async () => {
    console.log('Admin Cron Logs: Testing daily report generation');
    setTestingFunction(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/daily-5am-report-with-retry`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      console.log('Admin Cron Logs: Daily report test result:', result);

      if (result.success) {
        Alert.alert(
          'Success',
          `Report generated successfully!\nAttempts: ${result.attempts || 1}\nWave data: ${result.dataStatus?.surf ? 'Available' : 'Unavailable'}`,
          [{ text: 'OK', onPress: loadDiagnostics }]
        );
      } else {
        Alert.alert(
          'Failed',
          `Error: ${result.error}\n\nData Status:\nWeather: ${result.dataStatus?.weather ? '✅' : '❌'}\nTide: ${result.dataStatus?.tide ? '✅' : '❌'}\nSurf: ${result.dataStatus?.surf ? '✅' : '❌'}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Admin Cron Logs: Error testing daily report:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setTestingFunction(false);
    }
  };

  const testBuoyUpdate = async () => {
    console.log('Admin Cron Logs: Testing buoy data update');
    setTestingFunction(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/update-buoy-data-15min`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      console.log('Admin Cron Logs: Buoy update test result:', result);

      if (result.success) {
        Alert.alert(
          'Success',
          'Buoy data updated successfully!',
          [{ text: 'OK', onPress: loadDiagnostics }]
        );
      } else {
        Alert.alert('Failed', `Error: ${result.error}`, [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Admin Cron Logs: Error testing buoy update:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setTestingFunction(false);
    }
  };

  const formatTime = (timestamp: string | null): string => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTimeSince = (timestamp: string | null): string => {
    if (!timestamp) return 'Never';
    
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 60) {
      const minsText = `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
      return `${minsText} ago`;
    }
    const hoursText = `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    return `${hoursText} ago`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cron Job Diagnostics</Text>
        </View>
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center', flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const todayDateText = reportStatus?.todayDate || 'Unknown';
  const hasReportText = reportStatus?.hasReport ? 'Yes' : 'No';
  const hasNarrativeText = reportStatus?.hasNarrative ? 'Yes' : 'No';
  const narrativeLengthText = `${reportStatus?.narrativeLength || 0} characters`;
  const reportTimeText = formatTime(reportStatus?.reportCreatedAt);
  const reportAgoText = getTimeSince(reportStatus?.reportCreatedAt);
  const waveHeightText = reportStatus?.waveHeight || 'N/A';
  const hasValidWaveText = reportStatus?.hasValidWaveData ? 'Yes' : 'No';

  const buoyDateText = buoyStatus?.latestDate || 'No data';
  const buoyWaveText = buoyStatus?.waveHeight || 'N/A';
  const buoySurfText = buoyStatus?.surfHeight || 'N/A';
  const buoyWindText = buoyStatus?.windSpeed || 'N/A';
  const buoyTempText = buoyStatus?.waterTemp || 'N/A';
  const buoyTimeText = formatTime(buoyStatus?.lastUpdated);
  const buoyAgoText = getTimeSince(buoyStatus?.lastUpdated);

  const reportStatusStyle = reportStatus?.hasReport && reportStatus?.hasNarrative ? styles.statusGood : styles.statusBad;
  const narrativeStatusStyle = reportStatus?.hasNarrative ? styles.statusGood : styles.statusBad;
  const waveDataStatusStyle = reportStatus?.hasValidWaveData ? styles.statusGood : styles.statusWarning;
  const buoyStatusStyle = buoyStatus?.latestDate === reportStatus?.todayDate ? styles.statusGood : styles.statusWarning;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cron Job Diagnostics</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today&apos;s Report Status</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Today&apos;s Date (EST)</Text>
            <Text style={styles.infoValue}>{todayDateText}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Report Exists</Text>
            <Text style={[styles.infoValue, reportStatusStyle]}>{hasReportText}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Has Narrative</Text>
            <Text style={[styles.infoValue, narrativeStatusStyle]}>{hasNarrativeText}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Narrative Length</Text>
            <Text style={styles.infoValue}>{narrativeLengthText}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last Updated</Text>
            <Text style={styles.infoValue}>{reportTimeText}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Time Since Update</Text>
            <Text style={styles.infoValue}>{reportAgoText}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Wave Height</Text>
            <Text style={[styles.infoValue, waveDataStatusStyle]}>{waveHeightText}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Valid Wave Data</Text>
            <Text style={[styles.infoValue, waveDataStatusStyle]}>{hasValidWaveText}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buoy Data Status</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Latest Buoy Date</Text>
            <Text style={[styles.infoValue, buoyStatusStyle]}>{buoyDateText}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Wave Height</Text>
            <Text style={styles.infoValue}>{buoyWaveText}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Surf Height</Text>
            <Text style={styles.infoValue}>{buoySurfText}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Wind Speed</Text>
            <Text style={styles.infoValue}>{buoyWindText}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Water Temp</Text>
            <Text style={styles.infoValue}>{buoyTempText}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last Updated</Text>
            <Text style={styles.infoValue}>{buoyTimeText}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Time Since Update</Text>
            <Text style={styles.infoValue}>{buoyAgoText}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Possible Issues</Text>
          
          {!reportStatus?.hasReport && (
            <View style={styles.logEntry}>
              <Text style={[styles.logMessage, styles.statusBad]}>
                ❌ No report exists for today. The 5 AM cron job may not have run.
              </Text>
            </View>
          )}

          {reportStatus?.hasReport && !reportStatus?.hasNarrative && (
            <View style={styles.logEntry}>
              <Text style={[styles.logMessage, styles.statusBad]}>
                ❌ Report exists but has no narrative. The 5 AM report generation failed.
              </Text>
            </View>
          )}

          {!reportStatus?.hasValidWaveData && (
            <View style={styles.logEntry}>
              <Text style={[styles.logMessage, styles.statusWarning]}>
                ⚠️ No valid wave data available. Buoy sensors may be offline.
              </Text>
            </View>
          )}

          {buoyStatus?.latestDate !== reportStatus?.todayDate && (
            <View style={styles.logEntry}>
              <Text style={[styles.logMessage, styles.statusWarning]}>
                ⚠️ Buoy data is not from today. NOAA API may be delayed or offline.
              </Text>
            </View>
          )}

          {reportStatus?.hasReport && reportStatus?.hasNarrative && reportStatus?.hasValidWaveData && buoyStatus?.latestDate === reportStatus?.todayDate && (
            <View style={styles.logEntry}>
              <Text style={[styles.logMessage, styles.statusGood]}>
                ✅ All systems operational. Report and buoy data are current.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manual Tests</Text>
          
          <TouchableOpacity 
            style={styles.button}
            onPress={testDailyReport}
            disabled={testingFunction}
          >
            {testingFunction ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Test 5 AM Report Generation</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonSecondary]}
            onPress={testBuoyUpdate}
            disabled={testingFunction}
          >
            {testingFunction ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Test 15-Min Buoy Update</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonSecondary]}
            onPress={loadDiagnostics}
            disabled={loading}
          >
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Refresh Diagnostics</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cron Job Schedule</Text>
          
          <View style={styles.logEntry}>
            <Text style={styles.logMessage}>
              <Text style={{ fontWeight: 'bold' }}>5:00 AM EST:</Text> Generate first daily report with narrative (with 60-minute retry)
            </Text>
          </View>

          <View style={styles.logEntry}>
            <Text style={styles.logMessage}>
              <Text style={{ fontWeight: 'bold' }}>Every 15 minutes (5 AM - 9 PM):</Text> Update buoy data only, preserve narrative
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
