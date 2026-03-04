
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
}

export default function AdminCronSetupScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [serviceRoleKey, setServiceRoleKey] = useState('');

  const loadCronJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cron.job')
        .select('*');

      if (error) {
        console.error('Error loading cron jobs:', error);
        Alert.alert('Error', 'Failed to load cron jobs. Make sure pg_cron extension is enabled.');
      } else {
        setCronJobs(data || []);
      }
    } catch (e) {
      console.error('Error:', e);
      Alert.alert('Error', 'Failed to load cron jobs');
    } finally {
      setLoading(false);
    }
  };

  const createCronJobs = async () => {
    if (!serviceRoleKey.trim()) {
      Alert.alert('Error', 'Please enter your service role key');
      return;
    }

    setLoading(true);
    try {
      // Create background data collection job
      const backgroundJobSQL = `
        SELECT cron.schedule(
          'background-445am-data-collection',
          '45 9 * * *',
          $$
          SELECT
            net.http_post(
              url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/background-445am-data-collection',
              headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${serviceRoleKey}"}'::jsonb,
              body := '{}'::jsonb
            ) as request_id;
          $$
        );
      `;

      const { error: error1 } = await supabase.rpc('exec_sql', { sql: backgroundJobSQL });
      
      if (error1) {
        console.error('Error creating background job:', error1);
        Alert.alert('Error', `Failed to create background job: ${error1.message}`);
        setLoading(false);
        return;
      }

      // Create daily report job
      const reportJobSQL = `
        SELECT cron.schedule(
          'daily-6am-report-with-retry',
          '0 11 * * *',
          $$
          SELECT
            net.http_post(
              url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-6am-report-with-retry',
              headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${serviceRoleKey}"}'::jsonb,
              body := '{}'::jsonb
            ) as request_id;
          $$
        );
      `;

      const { error: error2 } = await supabase.rpc('exec_sql', { sql: reportJobSQL });
      
      if (error2) {
        console.error('Error creating report job:', error2);
        Alert.alert('Error', `Failed to create report job: ${error2.message}`);
        setLoading(false);
        return;
      }

      Alert.alert('Success', 'Cron jobs created successfully!');
      loadCronJobs();
    } catch (e) {
      console.error('Error:', e);
      Alert.alert('Error', 'Failed to create cron jobs');
    } finally {
      setLoading(false);
    }
  };

  const deleteCronJob = async (jobName: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete the cron job "${jobName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase.rpc('exec_sql', {
                sql: `SELECT cron.unschedule('${jobName}');`
              });

              if (error) {
                Alert.alert('Error', `Failed to delete job: ${error.message}`);
              } else {
                Alert.alert('Success', 'Cron job deleted');
                loadCronJobs();
              }
            } catch (e) {
              Alert.alert('Error', 'Failed to delete cron job');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (profile?.is_admin) {
      loadCronJobs();
    }
  }, [profile]);

  if (!profile?.is_admin) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="lock.fill"
            android_material_icon_name="lock"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            Admin access required
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Cron Job Setup
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Instructions
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            1. Get your service role key from Supabase Dashboard → Settings → API
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            2. Paste it below (it will not be saved)
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            3. Click "Create Cron Jobs" to schedule automated tasks
          </Text>
          <Text style={[styles.warningText, { color: colors.warning }]}>
            ⚠️ The service role key is sensitive. Never share it or commit it to git.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Service Role Key
          </Text>
          <TextInput
            style={[styles.input, { color: theme.colors.text, borderColor: colors.border }]}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            placeholderTextColor={colors.textSecondary}
            value={serviceRoleKey}
            onChangeText={setServiceRoleKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={createCronJobs}
            disabled={loading || !serviceRoleKey.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Create Cron Jobs</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Existing Cron Jobs
            </Text>
            <TouchableOpacity onPress={loadCronJobs} disabled={loading}>
              <IconSymbol
                ios_icon_name="arrow.clockwise"
                android_material_icon_name="refresh"
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          {loading && cronJobs.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
          ) : cronJobs.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No cron jobs found. Create them using the form above.
            </Text>
          ) : (
            cronJobs.map((job) => (
              <View key={job.jobid} style={styles.jobCard}>
                <View style={styles.jobHeader}>
                  <Text style={[styles.jobName, { color: theme.colors.text }]}>
                    {job.jobname}
                  </Text>
                  <TouchableOpacity onPress={() => deleteCronJob(job.jobname)}>
                    <IconSymbol
                      ios_icon_name="trash.fill"
                      android_material_icon_name="delete"
                      size={20}
                      color={colors.error}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.jobSchedule, { color: colors.textSecondary }]}>
                  Schedule: {job.schedule}
                </Text>
                <Text style={[styles.jobStatus, { color: job.active ? colors.success : colors.error }]}>
                  {job.active ? '✓ Active' : '✗ Inactive'}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Expected Schedule
          </Text>
          <View style={styles.scheduleItem}>
            <Text style={[styles.scheduleName, { color: theme.colors.text }]}>
              background-445am-data-collection
            </Text>
            <Text style={[styles.scheduleTime, { color: colors.textSecondary }]}>
              4:45 AM EST (9:45 AM UTC)
            </Text>
            <Text style={[styles.scheduleCron, { color: colors.textSecondary }]}>
              Cron: 45 9 * * *
            </Text>
          </View>
          <View style={styles.scheduleItem}>
            <Text style={[styles.scheduleName, { color: theme.colors.text }]}>
              daily-6am-report-with-retry
            </Text>
            <Text style={[styles.scheduleTime, { color: colors.textSecondary }]}>
              6:00 AM EST (11:00 AM UTC)
            </Text>
            <Text style={[styles.scheduleCron, { color: colors.textSecondary }]}>
              Cron: 0 11 * * *
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  warningText: {
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  jobCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobName: {
    fontSize: 16,
    fontWeight: '600',
  },
  jobSchedule: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  jobStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scheduleName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  scheduleTime: {
    fontSize: 14,
    marginBottom: 2,
  },
  scheduleCron: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
  },
});
