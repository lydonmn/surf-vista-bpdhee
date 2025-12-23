
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { router } from 'expo-router';
import { supabase } from './integrations/supabase/client';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { PredictionIndicator } from '@/components/PredictionIndicator';

interface Prediction {
  id: string;
  date: string;
  predicted_surf_min: number;
  predicted_surf_max: number;
  confidence: number;
  prediction_factors: any;
  created_at: string;
}

export default function AdminPredictionsScreen() {
  const theme = useTheme();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    try {
      setIsLoading(true);
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('surf_predictions')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error loading predictions:', error);
      } else {
        setPredictions(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runAnalysis = async () => {
    try {
      setIsAnalyzing(true);
      
      const { data, error } = await supabase.functions.invoke('analyze-surf-trends');
      
      if (error) {
        console.error('Analysis error:', error);
        alert('Failed to run analysis: ' + error.message);
      } else {
        console.log('Analysis result:', data);
        alert('Analysis completed successfully!');
        await loadPredictions();
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading predictions...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow_back"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          AI Predictions
        </Text>
      </View>

      <View style={styles.content}>
        {/* Stats Card */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <View style={styles.cardHeader}>
            <IconSymbol
              ios_icon_name="chart.bar.fill"
              android_material_icon_name="bar_chart"
              size={24}
              color={colors.accent}
            />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Statistics
            </Text>
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {predictions.length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Predictions
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.accent }]}>
                {predictions.length > 0 
                  ? `${(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length * 100).toFixed(0)}%`
                  : 'N/A'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Avg Confidence
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {predictions.length > 0
                  ? `${predictions[0].predicted_surf_min.toFixed(1)}-${predictions[0].predicted_surf_max.toFixed(1)} ft`
                  : 'N/A'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Tomorrow
              </Text>
            </View>
          </View>
        </View>

        {/* Run Analysis Button */}
        <TouchableOpacity
          style={[styles.analyzeButton, { backgroundColor: colors.accent }]}
          onPress={runAnalysis}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <IconSymbol
                ios_icon_name="brain"
                android_material_icon_name="psychology"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.analyzeButtonText}>
                Run AI Analysis Now
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Predictions List */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <View style={styles.cardHeader}>
            <IconSymbol
              ios_icon_name="list.bullet"
              android_material_icon_name="list"
              size={24}
              color={colors.primary}
            />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              7-Day Predictions
            </Text>
          </View>

          {predictions.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="exclamationmark.triangle"
                android_material_icon_name="warning"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No predictions available
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Run AI analysis to generate predictions
              </Text>
            </View>
          ) : (
            <View style={styles.predictionsList}>
              {predictions.map((prediction, index) => (
                <React.Fragment key={index}>
                  <View style={styles.predictionItem}>
                    <View style={styles.predictionHeader}>
                      <Text style={[styles.predictionDate, { color: theme.colors.text }]}>
                        {new Date(prediction.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </Text>
                      <PredictionIndicator 
                        source="ai_prediction"
                        confidence={prediction.confidence}
                        compact={true}
                      />
                    </View>
                    
                    <View style={styles.predictionDetails}>
                      <View style={styles.predictionSurf}>
                        <IconSymbol
                          ios_icon_name="water.waves"
                          android_material_icon_name="waves"
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={[styles.predictionValue, { color: theme.colors.text }]}>
                          {prediction.predicted_surf_min.toFixed(1)}-{prediction.predicted_surf_max.toFixed(1)} ft
                        </Text>
                      </View>
                      
                      {prediction.prediction_factors && (
                        <View style={styles.factorsGrid}>
                          <View style={styles.factorItem}>
                            <Text style={[styles.factorLabel, { color: colors.textSecondary }]}>
                              Trend:
                            </Text>
                            <Text style={[styles.factorValue, { color: theme.colors.text }]}>
                              {prediction.prediction_factors.trend > 0 ? '+' : ''}
                              {prediction.prediction_factors.trend.toFixed(2)}
                            </Text>
                          </View>
                          
                          <View style={styles.factorItem}>
                            <Text style={[styles.factorLabel, { color: colors.textSecondary }]}>
                              Volatility:
                            </Text>
                            <Text style={[styles.factorValue, { color: theme.colors.text }]}>
                              {prediction.prediction_factors.volatility.toFixed(2)}
                            </Text>
                          </View>
                          
                          <View style={styles.factorItem}>
                            <Text style={[styles.factorLabel, { color: colors.textSecondary }]}>
                              3-Day MA:
                            </Text>
                            <Text style={[styles.factorValue, { color: theme.colors.text }]}>
                              {prediction.prediction_factors.movingAvg3Day.toFixed(1)} ft
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  analyzeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  predictionsList: {
    gap: 12,
  },
  predictionItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.05)',
    gap: 8,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  predictionDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  predictionDetails: {
    gap: 8,
  },
  predictionSurf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  predictionValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  factorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  factorItem: {
    flexDirection: 'row',
    gap: 4,
  },
  factorLabel: {
    fontSize: 12,
  },
  factorValue: {
    fontSize: 12,
    fontWeight: '600',
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
