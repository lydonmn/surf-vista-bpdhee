
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from './IconSymbol';
import { colors } from '@/styles/commonStyles';
import { Database } from '@/app/integrations/supabase/types';

type TideData = Database['public']['Tables']['tide_data']['Row'];

interface TideCardProps {
  tides: TideData[];
  isLoading?: boolean;
}

export function TideCard({ tides, isLoading = false }: TideCardProps) {
  const theme = useTheme();

  console.log('[TideCard] Rendering with:', { 
    tidesCount: tides?.length || 0, 
    isLoading,
    tides: JSON.stringify(tides, null, 2)
  });

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name="arrow.up.arrow.down"
            android_material_icon_name="swap_vert"
            size={32}
            color={colors.primary}
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Tide Schedule
          </Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Loading tide data...
          </Text>
        </View>
      </View>
    );
  }

  if (!tides || tides.length === 0) {
    console.log('[TideCard] No tides available - showing empty state');
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name="arrow.up.arrow.down"
            android_material_icon_name="swap_vert"
            size={32}
            color={colors.primary}
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Tide Schedule
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
            No tide data available for today
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Pull down to refresh or check back later
          </Text>
        </View>
      </View>
    );
  }

  console.log('[TideCard] Rendering', tides.length, 'tide entries');

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <View style={styles.header}>
        <IconSymbol
          ios_icon_name="arrow.up.arrow.down"
          android_material_icon_name="swap_vert"
          size={32}
          color={colors.primary}
        />
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Tide Schedule
        </Text>
      </View>

      <View style={styles.tidesContainer}>
        {tides.map((tide, index) => {
          console.log('[TideCard] Rendering tide:', tide);
          
          // Parse the time string
          const time = new Date(`2000-01-01T${tide.time}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          return (
            <View key={index} style={styles.tideItem}>
              <View style={styles.tideIconContainer}>
                <IconSymbol
                  ios_icon_name={tide.type === 'high' ? 'arrow.up.circle.fill' : 'arrow.down.circle.fill'}
                  android_material_icon_name={tide.type === 'high' ? 'arrow_upward' : 'arrow_downward'}
                  size={24}
                  color={tide.type === 'high' ? '#2196F3' : '#FF9800'}
                />
              </View>
              <View style={styles.tideInfo}>
                <Text style={[styles.tideType, { color: theme.colors.text }]}>
                  {tide.type.charAt(0).toUpperCase() + tide.type.slice(1)} Tide
                </Text>
                <Text style={[styles.tideTime, { color: colors.textSecondary }]}>
                  {time}
                </Text>
              </View>
              <Text style={[styles.tideHeight, { color: theme.colors.text }]}>
                {Number(tide.height).toFixed(1)} ft
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
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
  tidesContainer: {
    gap: 12,
  },
  tideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  tideIconContainer: {
    width: 40,
    alignItems: 'center',
  },
  tideInfo: {
    flex: 1,
  },
  tideType: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  tideTime: {
    fontSize: 14,
  },
  tideHeight: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
