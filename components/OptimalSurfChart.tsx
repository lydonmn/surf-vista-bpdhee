import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '@/styles/commonStyles';

interface TideEntry {
  time: string;
  type: string;
  height: number;
}

interface OptimalSurfChartProps {
  waveHeight: number;
  wavePeriod: number;
  windSpeed: number;
  windDirection: string;
  tides: TideEntry[];
  isDarkMode?: boolean;
}

const HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const BAR_AREA_HEIGHT = 56;
const BAR_WIDTH = 32;
const GAP = 6;
const NUM_BARS = 16;
const TOTAL_CHART_WIDTH = NUM_BARS * BAR_WIDTH + (NUM_BARS - 1) * GAP; // 602px
const CHART_HEIGHT = BAR_AREA_HEIGHT + 24;
const TIDE_PADDING = 8;

const HOUR_LABELS = ['5a', '6a', '7a', '8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p'];

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function tideTimeToDecimalHour(timeStr: string): number {
  const parts = timeStr.split(':');
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h + m / 60;
}

function interpolateTideHeight(hour: number, tides: TideEntry[]): number | null {
  if (!tides || tides.length === 0) return null;

  const parsed = tides
    .map((t) => ({ decHour: tideTimeToDecimalHour(t.time), height: Number(t.height) }))
    .sort((a, b) => a.decHour - b.decHour);

  if (parsed.length === 1) return parsed[0].height;

  if (hour <= parsed[0].decHour) return parsed[0].height;
  if (hour >= parsed[parsed.length - 1].decHour) return parsed[parsed.length - 1].height;

  for (let i = 0; i < parsed.length - 1; i++) {
    const a = parsed[i];
    const b = parsed[i + 1];
    if (hour >= a.decHour && hour <= b.decHour) {
      const t = (hour - a.decHour) / (b.decHour - a.decHour);
      return a.height + t * (b.height - a.height);
    }
  }
  return null;
}

function getBarColor(score: number): string {
  if (score >= 7) return '#22C55E';
  if (score >= 5) return '#3B82F6';
  if (score >= 3) return '#F59E0B';
  return '#6B7280';
}

function computeScores(
  waveHeight: number,
  wavePeriod: number,
  windSpeed: number,
  windDirection: string,
  tides: TideEntry[]
): number[] {
  const isOffshore = windDirection.toUpperCase().includes('W') || windDirection.toUpperCase().includes('N');

  let tideMin = Infinity;
  let tideMax = -Infinity;
  const tideHeights = HOURS.map((h) => interpolateTideHeight(h, tides));
  tideHeights.forEach((th) => {
    if (th !== null) {
      if (th < tideMin) tideMin = th;
      if (th > tideMax) tideMax = th;
    }
  });
  const tideRange = tideMax - tideMin;

  return HOURS.map((H, idx) => {
    const base = clamp(waveHeight * 1.5 + (wavePeriod - 6) * 0.3, 1, 8);

    let windPenalty = 0;
    if (isOffshore) {
      if (windSpeed < 10) windPenalty = 0;
      else if (windSpeed < 15) windPenalty = -1;
      else windPenalty = -2;
    } else {
      if (windSpeed < 5) windPenalty = 0;
      else if (windSpeed < 10) windPenalty = -1;
      else if (windSpeed < 15) windPenalty = -2;
      else windPenalty = -3;
    }

    const morningBonus = H <= 9 ? 0.5 : 0;

    let tideBonus = 0;
    const tideH = tideHeights[idx];
    if (tideH !== null && tideRange > 0) {
      const normalized = (tideH - tideMin) / tideRange;
      const tideScore = clamp(1 - Math.abs(normalized - 0.5) * 1.5, 0, 1);
      tideBonus = tideScore * 1.5;
    }

    return clamp(base + windPenalty + morningBonus + tideBonus, 1, 10);
  });
}

function findBestWindow(scores: number[]): number {
  let bestAvg = -1;
  let bestStart = 0;
  const windowSize = 3;
  for (let i = 0; i <= scores.length - windowSize; i++) {
    const avg = (scores[i] + scores[i + 1] + scores[i + 2]) / windowSize;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestStart = i;
    }
  }
  return bestStart;
}

interface TidePoint {
  x: number;
  y: number;
}

interface TideTurningPoint {
  x: number;
  y: number;
  type: string;
  height: number;
}



export default function OptimalSurfChart({
  waveHeight,
  wavePeriod,
  windSpeed,
  windDirection,
  tides,
  isDarkMode = false,
}: OptimalSurfChartProps) {
  const scores = useMemo(
    () => computeScores(waveHeight, wavePeriod, windSpeed, windDirection, tides),
    [waveHeight, wavePeriod, windSpeed, windDirection, tides]
  );

  const bestWindowStart = useMemo(() => findBestWindow(scores), [scores]);

  const currentHour = new Date().getHours();
  const nowBarIndex = currentHour >= 5 && currentHour <= 20 ? currentHour - 5 : -1;

  // Compute tide curve points
  const { tidePoints, tideMin, tideMax } = useMemo(() => {
    const heights = HOURS.map((h) => interpolateTideHeight(h, tides));
    const vals = heights.filter((v) => v !== null) as number[];
    const min = vals.length > 0 ? Math.min(...vals) : 0;
    const max = vals.length > 0 ? Math.max(...vals) : 1;
    const range = max - min || 1;

    const points: TidePoint[] = heights.map((h, i) => {
      const norm = h !== null ? (h - min) / range : 0.5;
      const x = i * (BAR_WIDTH + GAP) + BAR_WIDTH / 2;
      const y = CHART_HEIGHT - TIDE_PADDING - norm * (CHART_HEIGHT - TIDE_PADDING * 2);
      return { x, y };
    });

    return { tidePoints: points, tideMin: min, tideMax: max };
  }, [tides]);

  // Find turning points (highs and lows) within 5am–8pm window
  const turningPoints = useMemo((): TideTurningPoint[] => {
    if (!tides || tides.length === 0) return [];
    const range = tideMax - tideMin || 1;
    return tides
      .map((entry) => {
        const decHour = tideTimeToDecimalHour(entry.time);
        if (decHour < 5 || decHour > 20) return null;
        const barIndex = decHour - 5; // fractional index into HOURS array
        const x = barIndex * (BAR_WIDTH + GAP) + BAR_WIDTH / 2;
        const norm = (Number(entry.height) - tideMin) / range;
        const y = CHART_HEIGHT - TIDE_PADDING - norm * (CHART_HEIGHT - TIDE_PADDING * 2);
        return { x, y, type: entry.type, height: Number(entry.height) };
      })
      .filter((p): p is TideTurningPoint => p !== null);
  }, [tides, tideMin, tideMax]);

  const containerBg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,122,255,0.04)';
  const textSecondary = colors.textSecondary;
  const baselineColor = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';

  const bestWindowLeft = bestWindowStart * (BAR_WIDTH + GAP);
  const bestWindowWidth = 3 * BAR_WIDTH + 2 * GAP;

  const legendItems = [
    { color: '#22C55E', label: 'PRIME' },
    { color: '#3B82F6', label: 'GOOD' },
    { color: '#F59E0B', label: 'FAIR' },
    { color: '#6B7280', label: 'POOR' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: containerBg }]}>
      <Text style={[styles.title, { color: textSecondary }]}>BEST TIME TO SURF</Text>

      {/* Horizontally scrollable chart area */}
      <ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScrollBeginDrag={() => console.log('[OptimalSurfChart] User started scrolling chart')}
      >
        <View style={{ width: TOTAL_CHART_WIDTH }}>
          {/* Chart area */}
          <View style={styles.chartArea}>
            {/* Best window pill */}
            <View
              style={[
                styles.bestWindowPill,
                {
                  left: bestWindowLeft,
                  width: bestWindowWidth,
                  backgroundColor: isDarkMode ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.12)',
                  borderColor: '#22C55E',
                },
              ]}
            >
              <Text style={styles.bestWindowText}>⭐ Best Window</Text>
            </View>

            {/* NOW indicator */}
            {nowBarIndex >= 0 && (
              <View
                style={[
                  styles.nowIndicator,
                  { left: nowBarIndex * (BAR_WIDTH + GAP) + BAR_WIDTH / 2 },
                ]}
              >
                <Text style={[styles.nowLabel, { color: isDarkMode ? '#FFFFFF' : colors.primary }]}>NOW</Text>
                <View style={[styles.nowLine, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.7)' : colors.primary }]} />
              </View>
            )}

            {/* Bars */}
            <View style={styles.barsRow}>
              {scores.map((score, idx) => {
                const barColor = getBarColor(score);
                const heightPct = 0.2 + (score / 10) * 0.8;
                const barH = BAR_AREA_HEIGHT * heightPct;
                const isNow = idx === nowBarIndex;

                return (
                  <View
                    key={idx}
                    style={[
                      styles.barWrapper,
                      { width: BAR_WIDTH, marginRight: idx < NUM_BARS - 1 ? GAP : 0 },
                    ]}
                  >
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barH,
                          backgroundColor: barColor,
                          opacity: isNow ? 1 : 0.82,
                          borderTopLeftRadius: 3,
                          borderTopRightRadius: 3,
                          shadowColor: isNow ? barColor : 'transparent',
                          shadowOpacity: isNow ? 0.5 : 0,
                          shadowRadius: isNow ? 4 : 0,
                          elevation: isNow ? 3 : 0,
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>

            {/* Tide curve overlay — pure RN Views */}
            {tidePoints.length > 1 && (
              <View style={styles.tideSvg} pointerEvents="none">
                {/* Connecting line segments between tide points */}
                {tidePoints.slice(0, -1).map((pt, i) => {
                  const next = tidePoints[i + 1];
                  const dx = next.x - pt.x;
                  const dy = next.y - pt.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  return (
                    <View
                      key={`seg-${i}`}
                      style={{
                        position: 'absolute',
                        left: pt.x,
                        top: pt.y - 1,
                        width: length,
                        height: 2,
                        backgroundColor: 'rgba(96,165,250,0.7)',
                        transformOrigin: '0 50%',
                        transform: [{ rotate: `${angle}deg` }],
                      }}
                    />
                  );
                })}

                {/* Turning point markers */}
                {turningPoints.map((pt, i) => {
                  const isHigh = pt.type.toLowerCase().includes('high');
                  const label = isHigh ? 'H' : 'L';
                  const heightStr = `${pt.height.toFixed(1)}ft`;
                  const labelTop = isHigh ? pt.y - 18 : pt.y + 6;
                  return (
                    <React.Fragment key={`tp-${i}`}>
                      {/* Dot */}
                      <View
                        style={{
                          position: 'absolute',
                          left: pt.x - 3,
                          top: pt.y - 3,
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: 'white',
                          borderWidth: 1.5,
                          borderColor: '#60A5FA',
                        }}
                      />
                      {/* Label */}
                      <Text
                        style={{
                          position: 'absolute',
                          left: pt.x - 10,
                          top: labelTop,
                          width: 20,
                          textAlign: 'center',
                          fontSize: 8,
                          fontWeight: '700',
                          color: '#60A5FA',
                        }}
                      >
                        {label}
                      </Text>
                      <Text
                        style={{
                          position: 'absolute',
                          left: pt.x - 12,
                          top: labelTop + 9,
                          width: 24,
                          textAlign: 'center',
                          fontSize: 7,
                          color: '#60A5FA',
                          opacity: 0.8,
                        }}
                      >
                        {heightStr}
                      </Text>
                    </React.Fragment>
                  );
                })}
              </View>
            )}

            {/* Baseline */}
            <View style={[styles.baseline, { backgroundColor: baselineColor }]} />
          </View>

          {/* Time labels */}
          <View style={styles.labelsRow}>
            {HOUR_LABELS.map((label, idx) => (
              <View key={idx} style={[styles.labelWrapper, { width: BAR_WIDTH, marginRight: idx < NUM_BARS - 1 ? GAP : 0 }]}>
                <Text style={[styles.hourLabel, { color: textSecondary }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        {legendItems.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[styles.legendText, { color: textSecondary }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Scroll hint */}
      <Text style={[styles.scrollHint, { color: textSecondary }]}>{'← swipe to see full day →'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  scrollView: {
    marginHorizontal: -14,
  },
  scrollContent: {
    paddingHorizontal: 14,
  },
  chartArea: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  bestWindowPill: {
    position: 'absolute',
    top: 0,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  bestWindowText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#22C55E',
    letterSpacing: 0.3,
  },
  nowIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  nowLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
    marginTop: 20,
  },
  nowLine: {
    width: 1.5,
    flex: 1,
    opacity: 0.7,
  },
  barsRow: {
    position: 'absolute',
    bottom: 1,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: BAR_AREA_HEIGHT,
  },
  barWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: BAR_AREA_HEIGHT,
  },
  bar: {
    width: '100%',
  },
  tideSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  baseline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  labelWrapper: {
    alignItems: 'center',
  },
  hourLabel: {
    fontSize: 9,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  scrollHint: {
    fontSize: 10,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 4,
  },
});
