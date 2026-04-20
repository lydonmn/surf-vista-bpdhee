
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/integrations/supabase/client';

interface HowFoundItem {
  answer: string;
  count: number;
}

interface RawResponse {
  id: string;
  created_at: string;
  how_found: string;
  surf_location: string;
  improvement: string;
}

interface SurveyResults {
  total: number;
  how_found: HowFoundItem[];
  surf_locations: string[];
  improvements: string[];
  responses: RawResponse[];
}

export default function AdminSurveyScreen() {
  const router = useRouter();
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    console.log('[AdminSurvey] Fetching survey results directly from survey_responses table');
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('survey_responses')
        .select('id, how_found, surf_location, improvement, created_at')
        .order('created_at', { ascending: false });

      if (queryError) {
        console.error('[AdminSurvey] Supabase query error:', queryError);
        throw new Error(queryError.message || 'Failed to query survey_responses');
      }

      const rows = data ?? [];
      console.log('[AdminSurvey] Survey results loaded — total responses:', rows.length);

      // Aggregate how_found counts
      const howFoundMap: Record<string, number> = {};
      for (const row of rows) {
        if (row.how_found) {
          howFoundMap[row.how_found] = (howFoundMap[row.how_found] ?? 0) + 1;
        }
      }
      const how_found: HowFoundItem[] = Object.entries(howFoundMap)
        .map(([answer, count]) => ({ answer, count }))
        .sort((a, b) => b.count - a.count);

      const surf_locations = rows
        .map(r => r.surf_location)
        .filter((v): v is string => !!v);

      const improvements = rows
        .map(r => r.improvement)
        .filter((v): v is string => !!v);

      setResults({
        total: rows.length,
        how_found,
        surf_locations,
        improvements,
        responses: rows as RawResponse[],
      });
    } catch (err: any) {
      console.error('[AdminSurvey] Failed to fetch survey results:', err);
      setError(err.message || 'Failed to load survey results');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const maxCount = results?.how_found?.length
    ? Math.max(...results.how_found.map(item => item.count), 1)
    : 1;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            console.log('[AdminSurvey] Back button pressed');
            router.back();
          }}
          style={styles.backButton}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Survey Results</Text>
          {results && (
            <Text style={styles.headerSubtitle}>
              {results.total}
              {' '}
              {results.total === 1 ? 'Response' : 'Responses'}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => {
            console.log('[AdminSurvey] Refresh button pressed');
            fetchResults();
          }}
          style={styles.refreshButton}
          disabled={isLoading}
        >
          <IconSymbol
            ios_icon_name="arrow.clockwise"
            android_material_icon_name="refresh"
            size={22}
            color={isLoading ? '#9CA3AF' : colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerStateText}>Loading survey results...</Text>
        </View>
      )}

      {/* Error */}
      {!isLoading && error && (
        <View style={styles.centerState}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={40}
            color="#EF4444"
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              console.log('[AdminSurvey] Retry button pressed');
              fetchResults();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* No data */}
      {!isLoading && !error && results && results.total === 0 && (
        <View style={styles.centerState}>
          <IconSymbol
            ios_icon_name="doc.text"
            android_material_icon_name="description"
            size={40}
            color="#9CA3AF"
          />
          <Text style={styles.emptyText}>No responses yet</Text>
          <Text style={styles.emptySubtext}>Survey responses will appear here once users submit them.</Text>
        </View>
      )}

      {/* Results */}
      {!isLoading && !error && results && results.total > 0 && (
        <>
          {/* How did you find us */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconSymbol
                ios_icon_name="chart.bar.fill"
                android_material_icon_name="bar_chart"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.sectionTitle}>How did you find us?</Text>
            </View>
            {results.how_found.length === 0 ? (
              <Text style={styles.emptySection}>No data</Text>
            ) : (
              results.how_found.map((item, index) => {
                const pct = Math.round((item.count / maxCount) * 100);
                const pctOfTotal = results.total > 0
                  ? Math.round((item.count / results.total) * 100)
                  : 0;
                return (
                  <View key={index} style={styles.barRow}>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barLabel}>{item.answer}</Text>
                      <Text style={styles.barCount}>
                        {item.count}
                        <Text style={styles.barPct}>
                          {' '}
                          ({pctOfTotal}%)
                        </Text>
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${pct}%` }]} />
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Where do you surf */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconSymbol
                ios_icon_name="map.fill"
                android_material_icon_name="place"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.sectionTitle}>Where do you surf?</Text>
              <Text style={styles.sectionCount}>{results.surf_locations.length}</Text>
            </View>
            {results.surf_locations.length === 0 ? (
              <Text style={styles.emptySection}>No responses</Text>
            ) : (
              results.surf_locations.map((loc, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={styles.listDot} />
                  <Text style={styles.listItemText}>{loc}</Text>
                </View>
              ))
            )}
          </View>

          {/* How can we improve */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconSymbol
                ios_icon_name="lightbulb.fill"
                android_material_icon_name="lightbulb"
                size={20}
                color="#F59E0B"
              />
              <Text style={styles.sectionTitle}>How can we improve?</Text>
              <Text style={styles.sectionCount}>{results.improvements.length}</Text>
            </View>
            {results.improvements.length === 0 ? (
              <Text style={styles.emptySection}>No suggestions yet</Text>
            ) : (
              results.improvements.map((item, index) => (
                <View key={index} style={styles.suggestionItem}>
                  <Text style={styles.suggestionIndex}>{index + 1}</Text>
                  <Text style={styles.suggestionText}>{item}</Text>
                </View>
              ))
            )}
          </View>

          {/* Raw Responses */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconSymbol
                ios_icon_name="list.bullet.rectangle"
                android_material_icon_name="list_alt"
                size={20}
                color="#6B7280"
              />
              <Text style={styles.sectionTitle}>Raw Responses</Text>
              <Text style={styles.sectionCount}>{results.responses.length}</Text>
            </View>
            {results.responses.length === 0 ? (
              <Text style={styles.emptySection}>No raw responses</Text>
            ) : (
              results.responses.map((resp, index) => {
                const dateDisplay = formatDate(resp.created_at);
                return (
                  <View key={index} style={styles.rawResponseCard}>
                    <Text style={styles.rawDate}>{dateDisplay}</Text>
                    {!!resp.how_found && (
                      <View style={styles.rawField}>
                        <Text style={styles.rawFieldLabel}>Found via</Text>
                        <Text style={styles.rawFieldValue}>{resp.how_found}</Text>
                      </View>
                    )}
                    {!!resp.surf_location && (
                      <View style={styles.rawField}>
                        <Text style={styles.rawFieldLabel}>Surfs at</Text>
                        <Text style={styles.rawFieldValue}>{resp.surf_location}</Text>
                      </View>
                    )}
                    {!!resp.improvement && (
                      <View style={styles.rawField}>
                        <Text style={styles.rawFieldLabel}>Improvement</Text>
                        <Text style={styles.rawFieldValue}>{resp.improvement}</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  centerStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  emptySection: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 12,
  },
  // Bar chart
  barRow: {
    marginBottom: 14,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  barLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  barCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  barPct: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
  },
  barTrack: {
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 5,
    minWidth: 4,
  },
  // List items
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  listDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  listItemText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  // Suggestions
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  suggestionIndex: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    minWidth: 20,
    textAlign: 'center',
    marginTop: 1,
  },
  suggestionText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    lineHeight: 20,
  },
  // Raw responses
  rawResponseCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  rawDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
    fontWeight: '500',
  },
  rawField: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  rawFieldLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    minWidth: 80,
  },
  rawFieldValue: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
    lineHeight: 18,
  },
});
