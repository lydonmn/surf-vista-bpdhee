
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';

interface PredictionIndicatorProps {
  source: 'actual' | 'ai_prediction' | 'buoy_estimation' | 'baseline';
  confidence?: number | null;
  compact?: boolean;
}

export function PredictionIndicator({ source, confidence, compact = false }: PredictionIndicatorProps) {
  const theme = useTheme();

  const getSourceInfo = () => {
    switch (source) {
      case 'actual':
        return {
          label: 'Live Data',
          icon: 'checkmark.circle.fill' as const,
          androidIcon: 'check_circle' as const,
          color: '#34C759',
          description: 'Real-time buoy measurements'
        };
      case 'ai_prediction':
        return {
          label: 'AI Forecast',
          icon: 'brain' as const,
          androidIcon: 'psychology' as const,
          color: colors.accent,
          description: 'Statistical prediction based on historical trends'
        };
      case 'buoy_estimation':
        return {
          label: 'Estimated',
          icon: 'chart.line.uptrend.xyaxis' as const,
          androidIcon: 'trending_up' as const,
          color: colors.primary,
          description: 'Estimated from current buoy data'
        };
      case 'baseline':
      default:
        return {
          label: 'Baseline',
          icon: 'waveform' as const,
          androidIcon: 'waves' as const,
          color: colors.textSecondary,
          description: 'Historical average'
        };
    }
  };

  const sourceInfo = getSourceInfo();

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <IconSymbol
          ios_icon_name={sourceInfo.icon}
          android_material_icon_name={sourceInfo.androidIcon}
          size={12}
          color={sourceInfo.color}
        />
        <Text style={[styles.compactLabel, { color: sourceInfo.color }]}>
          {sourceInfo.label}
        </Text>
        {confidence !== null && confidence !== undefined && source === 'ai_prediction' && (
          <Text style={[styles.confidenceText, { color: colors.textSecondary }]}>
            {(confidence * 100).toFixed(0)}%
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: `${sourceInfo.color}15` }]}>
      <View style={styles.header}>
        <IconSymbol
          ios_icon_name={sourceInfo.icon}
          android_material_icon_name={sourceInfo.androidIcon}
          size={16}
          color={sourceInfo.color}
        />
        <Text style={[styles.label, { color: sourceInfo.color }]}>
          {sourceInfo.label}
        </Text>
      </View>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {sourceInfo.description}
      </Text>
      {confidence !== null && confidence !== undefined && source === 'ai_prediction' && (
        <View style={styles.confidenceContainer}>
          <Text style={[styles.confidenceLabel, { color: colors.textSecondary }]}>
            Confidence:
          </Text>
          <View style={styles.confidenceBar}>
            <View 
              style={[
                styles.confidenceFill, 
                { 
                  width: `${confidence * 100}%`,
                  backgroundColor: sourceInfo.color 
                }
              ]} 
            />
          </View>
          <Text style={[styles.confidenceValue, { color: theme.colors.text }]}>
            {(confidence * 100).toFixed(0)}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  description: {
    fontSize: 11,
    lineHeight: 14,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  confidenceLabel: {
    fontSize: 11,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceValue: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'right',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  confidenceText: {
    fontSize: 9,
  },
});
