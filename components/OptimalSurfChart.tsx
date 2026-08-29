import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  PanResponder,
  Animated as RNAnimated,
  LayoutChangeEvent,
} from 'react-native';
import {
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { colors } from '@/styles/commonStyles';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const BAR_AREA_HEIGHT = 56;
const BAR_WIDTH = 32;
const GAP = 6;
const NUM_BARS = 16;
const TOTAL_CHART_WIDTH = NUM_BARS * BAR_WIDTH + (NUM_BARS - 1) * GAP;
const CHART_HEIGHT = BAR_AREA_HEIGHT + 24;
const TIDE_PADDING = 8;
const LOW_LABEL_ZONE_HEIGHT = 28;
const BADGE_HEIGHT = 34;
const CONNECTOR_LENGTH = 10;
const MIN_LABEL_SPACING = 40;
const FIGURE_CANVAS_HEIGHT = 80;

const HOUR_LABELS = ['5a', '6a', '7a', '8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p'];

const COLORS = {
  PRIME: '#22C55E',
  GOOD: '#3B82F6',
  FAIR: '#F59E0B',
  POOR: '#6B7280',
  GOLD: '#FFD700',
  TIDE: '#60A5FA',
  AMBER: 'rgba(251,191,36,0.5)',
};

type RatingKey = 'PRIME' | 'GOOD' | 'FAIR' | 'POOR';

// ─── Pure helpers (unchanged) ─────────────────────────────────────────────────

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
  if (score >= 7) return COLORS.PRIME;
  if (score >= 5) return COLORS.GOOD;
  if (score >= 3) return COLORS.FAIR;
  return COLORS.POOR;
}

function getRatingKey(score: number): RatingKey {
  if (score >= 7) return 'PRIME';
  if (score >= 5) return 'GOOD';
  if (score >= 3) return 'FAIR';
  return 'POOR';
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

// ─── Stick Figure Component ───────────────────────────────────────────────────

interface StickFigureProps {
  score: number;
  windSpeed: number;
  windDirection: string;
  waveHeight: number;
  wavePeriod: number;
  isScrubbing: boolean;
}

function StickFigure({ score, windSpeed, windDirection, waveHeight, wavePeriod, isScrubbing }: StickFigureProps) {
  const isOffshore = windDirection.toUpperCase().includes('W') || windDirection.toUpperCase().includes('N');

  // Pose parameters
  const lean = score >= 7 ? 20 : score >= 5 ? 8 : score >= 3 ? 4 : 0;
  const crouchFactor = score >= 7 ? 0.6 : score >= 5 ? 0.8 : score >= 3 ? 0.9 : 1.0;
  const armAngle = score >= 7 ? -30 : score >= 5 ? -15 : score >= 3 ? -5 : 20;
  const jitter = isOffshore ? 0 : windSpeed / 30;

  const bodyHeight = 20 * crouchFactor;
  const figureX = 40;
  const figureBaseY = 58;
  const headY = figureBaseY - bodyHeight - 10;

  // Wave segments
  const amplitude = clamp(waveHeight * 0.5 + (score / 10) * 0.3, 0.05, 0.4) * 12;
  const waveSegments = 8;
  const waveWidth = 80;
  const waveStartX = figureX - waveWidth / 2;
  const waveBaseY = figureBaseY + 4;

  const windArrowAngle = isOffshore ? 180 : 0;

  return (
    <View style={{ width: '100%', height: FIGURE_CANVAS_HEIGHT, position: 'relative' }}>
      {/* Wave segments under figure */}
      {Array.from({ length: waveSegments }).map((_, i) => {
        const t = i / (waveSegments - 1);
        const x = waveStartX + t * waveWidth;
        const y = waveBaseY + Math.sin(t * Math.PI * 2) * amplitude;
        const nextT = (i + 1) / (waveSegments - 1);
        const nextX = waveStartX + nextT * waveWidth;
        const nextY = waveBaseY + Math.sin(nextT * Math.PI * 2) * amplitude;
        const dx = nextX - x;
        const dy = nextY - y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={`wave-${i}`}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: len,
              height: 2,
              backgroundColor: 'rgba(96,165,250,0.5)',
              transformOrigin: '0 50%',
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}

      {/* Head */}
      <View
        style={{
          position: 'absolute',
          left: figureX - 5,
          top: headY,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: isScrubbing ? '#FFFFFF' : 'rgba(255,255,255,0.85)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.4)',
        }}
      />

      {/* Body */}
      <View
        style={{
          position: 'absolute',
          left: figureX - 1,
          top: headY + 10,
          width: 2,
          height: bodyHeight,
          backgroundColor: isScrubbing ? '#FFFFFF' : 'rgba(255,255,255,0.85)',
          transformOrigin: '50% 0%',
          transform: [{ rotate: `${lean}deg` }],
        }}
      />

      {/* Left arm */}
      <View
        style={{
          position: 'absolute',
          left: figureX - 1,
          top: headY + 12,
          width: 14,
          height: 2,
          backgroundColor: isScrubbing ? '#FFFFFF' : 'rgba(255,255,255,0.75)',
          transformOrigin: '0% 50%',
          transform: [{ rotate: `${armAngle + jitter * 15}deg` }],
        }}
      />

      {/* Right arm */}
      <View
        style={{
          position: 'absolute',
          left: figureX - 13,
          top: headY + 12,
          width: 14,
          height: 2,
          backgroundColor: isScrubbing ? '#FFFFFF' : 'rgba(255,255,255,0.75)',
          transformOrigin: '100% 50%',
          transform: [{ rotate: `${-(armAngle + jitter * 15)}deg` }],
        }}
      />

      {/* Left leg */}
      <View
        style={{
          position: 'absolute',
          left: figureX,
          top: headY + 10 + bodyHeight,
          width: 2,
          height: 14,
          backgroundColor: isScrubbing ? '#FFFFFF' : 'rgba(255,255,255,0.75)',
          transformOrigin: '50% 0%',
          transform: [{ rotate: `${score >= 7 ? 25 : score >= 5 ? 15 : 5}deg` }],
        }}
      />

      {/* Right leg */}
      <View
        style={{
          position: 'absolute',
          left: figureX - 2,
          top: headY + 10 + bodyHeight,
          width: 2,
          height: 14,
          backgroundColor: isScrubbing ? '#FFFFFF' : 'rgba(255,255,255,0.75)',
          transformOrigin: '50% 0%',
          transform: [{ rotate: `${score >= 7 ? -25 : score >= 5 ? -15 : -5}deg` }],
        }}
      />

      {/* Wind direction arrow */}
      <View
        style={{
          position: 'absolute',
          left: figureX + 20,
          top: headY + 5,
          width: 12,
          height: 2,
          backgroundColor: 'rgba(251,191,36,0.8)',
          transformOrigin: '50% 50%',
          transform: [{ rotate: `${windArrowAngle}deg` }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: isOffshore ? figureX + 20 : figureX + 28,
          top: headY + 2,
          width: 0,
          height: 0,
          borderTopWidth: 4,
          borderBottomWidth: 4,
          borderLeftWidth: 6,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: 'rgba(251,191,36,0.8)',
          transform: [{ rotate: `${isOffshore ? 180 : 0}deg` }],
        }}
      />

      {/* Pose label */}
      <View
        style={{
          position: 'absolute',
          right: 8,
          top: 8,
          backgroundColor: 'rgba(0,0,0,0.4)',
          borderRadius: 6,
          paddingHorizontal: 6,
          paddingVertical: 2,
        }}
      >
        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
          {score >= 7 ? 'CARVING' : score >= 5 ? 'STANDING' : score >= 3 ? 'CROUCHING' : 'PADDLING'}
        </Text>
      </View>
    </View>
  );
}

// ─── Scrub Readout Panel ──────────────────────────────────────────────────────

interface ReadoutPanelProps {
  hourIndex: number;
  score: number;
  waveHeight: number;
  wavePeriod: number;
  windSpeed: number;
  windDirection: string;
  tides: TideEntry[];
}

function ReadoutPanel({ hourIndex, score, waveHeight, wavePeriod, windSpeed, windDirection, tides }: ReadoutPanelProps) {
  const hour = HOURS[hourIndex] ?? 5;
  const displayHour = hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`;

  const waveEst = waveHeight * 0.8 + (score / 10) * 0.4;
  const waveEstStr = Number(waveEst).toFixed(1);

  // Tide state
  const tideNow = interpolateTideHeight(hour, tides);
  const tidePrev = interpolateTideHeight(hour - 0.5, tides);
  const tideNext = interpolateTideHeight(hour + 0.5, tides);
  let tideState = 'Steady';
  if (tideNow !== null && tidePrev !== null && tideNext !== null) {
    const slope = tideNext - tidePrev;
    if (slope > 0.05) tideState = 'Rising';
    else if (slope < -0.05) tideState = 'Falling';
    else if (tideNow > 3) tideState = 'High';
    else tideState = 'Low';
  }

  const barColor = getBarColor(score);

  return (
    <View style={readoutStyles.card}>
      {/* Left: hour */}
      <View style={readoutStyles.col}>
        <Text style={readoutStyles.hourText}>{displayHour}</Text>
        <View style={[readoutStyles.scorePill, { backgroundColor: barColor + '33', borderColor: barColor }]}>
          <Text style={[readoutStyles.scoreText, { color: barColor }]}>{score.toFixed(1)}/10</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={readoutStyles.divider} />

      {/* Center: wave */}
      <View style={readoutStyles.col}>
        <Text style={readoutStyles.dataLabel}>WAVE</Text>
        <Text style={readoutStyles.dataValue}>{waveEstStr} ft</Text>
        <Text style={readoutStyles.dataSub}>{wavePeriod}s period</Text>
      </View>

      {/* Divider */}
      <View style={readoutStyles.divider} />

      {/* Right: wind + tide */}
      <View style={readoutStyles.col}>
        <Text style={readoutStyles.dataLabel}>WIND</Text>
        <Text style={readoutStyles.dataValue}>{windSpeed} mph</Text>
        <Text style={readoutStyles.dataSub}>{windDirection}</Text>
        <View style={readoutStyles.tideStateRow}>
          <View style={[readoutStyles.tideStateDot, {
            backgroundColor: tideState === 'Rising' ? '#22C55E' : tideState === 'Falling' ? '#F59E0B' : '#60A5FA'
          }]} />
          <Text style={readoutStyles.tideStateText}>{tideState}</Text>
        </View>
      </View>
    </View>
  );
}

const readoutStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 4,
  },
  hourText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 26,
  },
  scorePill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dataLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dataSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 1,
  },
  tideStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 3,
  },
  tideStateDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  tideStateText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
});

// ─── Main Component ───────────────────────────────────────────────────────────

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

  // Default selected index
  const defaultIndex = nowBarIndex >= 0 ? nowBarIndex : bestWindowStart;
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [highlightRating, setHighlightRating] = useState<RatingKey | null>(null);

  // Legend animation values
  const legendScales = useRef(
    ['PRIME', 'GOOD', 'FAIR', 'POOR'].map(() => new RNAnimated.Value(1))
  ).current;

  // Chart container width for PanResponder mapping
  const chartContainerWidth = useRef(TOTAL_CHART_WIDTH);
  const scrollOffsetRef = useRef(0);

  // Reanimated shared values for figure
  const scrubProgress = useSharedValue(0);

  const updateSelectedIndex = useCallback((idx: number) => {
    const clamped = clamp(idx, 0, NUM_BARS - 1);
    setSelectedIndex(clamped);
  }, []);

  const startScrubbing = useCallback(() => {
    console.log('[OptimalSurfChart] Scrub started');
    setIsScrubbing(true);
    scrubProgress.value = withSpring(1);
  }, [scrubProgress]);

  const stopScrubbing = useCallback(() => {
    console.log('[OptimalSurfChart] Scrub ended, selected index:', selectedIndex);
    scrubProgress.value = withTiming(0, { duration: 600 });
    setTimeout(() => setIsScrubbing(false), 600);
  }, [scrubProgress, selectedIndex]);

  // PanResponder for scrubbing
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => {
        return Math.abs(gs.dx) > Math.abs(gs.dy) * 2 && Math.abs(gs.dx) > 4;
      },
      onPanResponderGrant: (evt) => {
        runOnJS(startScrubbing)();
        const x = evt.nativeEvent.locationX + scrollOffsetRef.current;
        const idx = Math.round(x / (BAR_WIDTH + GAP));
        runOnJS(updateSelectedIndex)(idx);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX + scrollOffsetRef.current;
        const idx = Math.round(x / (BAR_WIDTH + GAP));
        runOnJS(updateSelectedIndex)(idx);
      },
      onPanResponderRelease: () => {
        runOnJS(stopScrubbing)();
      },
      onPanResponderTerminate: () => {
        runOnJS(stopScrubbing)();
      },
    })
  ).current;

  // Tide curve points
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

  // Turning points
  const turningPoints = useMemo((): TideTurningPoint[] => {
    if (!tides || tides.length === 0) return [];
    const range = tideMax - tideMin || 1;
    const raw: TideTurningPoint[] = tides
      .map((entry) => {
        const decHour = tideTimeToDecimalHour(entry.time);
        if (decHour < 5 || decHour > 20) return null;
        const barIndex = decHour - 5;
        const x = barIndex * (BAR_WIDTH + GAP) + BAR_WIDTH / 2;
        const norm = (Number(entry.height) - tideMin) / range;
        const y = CHART_HEIGHT - TIDE_PADDING - norm * (CHART_HEIGHT - TIDE_PADDING * 2);
        return { x, y, type: entry.type, height: Number(entry.height) };
      })
      .filter((p): p is TideTurningPoint => p !== null);
    const result: TideTurningPoint[] = [];
    for (const pt of raw) {
      const isHigh = pt.type.toLowerCase().includes('high');
      const existing = result.findIndex(
        (r) => r.type.toLowerCase().includes('high') === isHigh && Math.abs(r.x - pt.x) < MIN_LABEL_SPACING
      );
      if (existing === -1) {
        result.push(pt);
      } else {
        const prev = result[existing];
        const keepNew = isHigh ? pt.height > prev.height : pt.height < prev.height;
        if (keepNew) result[existing] = pt;
      }
    }
    return result;
  }, [tides, tideMin, tideMax]);

  const highPoints = turningPoints.filter((pt) => pt.type.toLowerCase().includes('high'));
  const lowPoints = turningPoints.filter((pt) => !pt.type.toLowerCase().includes('high'));

  // Best score index
  const bestScoreIndex = useMemo(() => {
    let best = 0;
    scores.forEach((s, i) => { if (s > scores[best]) best = i; });
    return best;
  }, [scores]);

  // Swell trend line points
  const swellPoints = useMemo(() => {
    return scores.map((score, i) => {
      const h = waveHeight * (0.7 + (score / 10) * 0.3);
      const maxH = waveHeight * 1.0 || 1;
      const norm = clamp(h / maxH, 0, 1);
      const x = i * (BAR_WIDTH + GAP) + BAR_WIDTH / 2;
      const y = CHART_HEIGHT - TIDE_PADDING - norm * (CHART_HEIGHT - TIDE_PADDING * 2);
      return { x, y };
    });
  }, [scores, waveHeight]);

  const containerBg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,122,255,0.04)';
  const textSecondary = colors.textSecondary;
  const baselineColor = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';

  const bestWindowLabel = HOUR_LABELS[bestWindowStart] + '–' + HOUR_LABELS[bestWindowStart + 2];
  const bestWindowText = '⭐ Best Window · ' + bestWindowLabel;
  const tideSwing = tideMax - tideMin;
  const tideSwingText = tideSwing.toFixed(1) + ' ft swing';
  const showSwing = tideSwing > 0;

  const legendItems: { color: string; label: RatingKey }[] = [
    { color: COLORS.PRIME, label: 'PRIME' },
    { color: COLORS.GOOD, label: 'GOOD' },
    { color: COLORS.FAIR, label: 'FAIR' },
    { color: COLORS.POOR, label: 'POOR' },
  ];

  const handleLegendPress = (label: RatingKey, idx: number) => {
    console.log('[OptimalSurfChart] Legend tapped:', label);
    const next = highlightRating === label ? null : label;
    setHighlightRating(next);
    RNAnimated.sequence([
      RNAnimated.spring(legendScales[idx], { toValue: 1.15, useNativeDriver: true, speed: 20, bounciness: 8 }),
      RNAnimated.spring(legendScales[idx], { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }),
    ]).start();
  };

  const selectedScore = scores[selectedIndex] ?? 1;

  return (
    <View style={[styles.container, { backgroundColor: containerBg }]}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: '#FFFFFF' }]}>Best Time to Surf</Text>
        {showSwing && <Text style={styles.tideSwingText}>{tideSwingText}</Text>}
      </View>

      {/* Best window pill */}
      <View
        style={[
          styles.bestWindowPill,
          {
            backgroundColor: isDarkMode ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.12)',
            borderColor: COLORS.PRIME,
          },
        ]}
      >
        <Text style={styles.bestWindowText}>{bestWindowText}</Text>
      </View>

      {/* Scrub readout panel */}
      <ReadoutPanel
        hourIndex={selectedIndex}
        score={selectedScore}
        waveHeight={waveHeight}
        wavePeriod={wavePeriod}
        windSpeed={windSpeed}
        windDirection={windDirection}
        tides={tides}
      />

      {/* Stick figure canvas */}
      <View style={styles.figureCanvas}>
        <StickFigure
          score={selectedScore}
          windSpeed={windSpeed}
          windDirection={windDirection}
          waveHeight={waveHeight}
          wavePeriod={wavePeriod}
          isScrubbing={isScrubbing}
        />
      </View>

      {/* Scrollable chart */}
      <ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.x; }}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => console.log('[OptimalSurfChart] User started scrolling chart')}
      >
        <View
          style={{ width: TOTAL_CHART_WIDTH }}
          onLayout={(e: LayoutChangeEvent) => {
            chartContainerWidth.current = e.nativeEvent.layout.width;
          }}
        >
          {/* Scrub overlay */}
          <View
            style={[styles.scrubOverlay, { height: CHART_HEIGHT + LOW_LABEL_ZONE_HEIGHT + 24 }]}
            {...panResponder.panHandlers}
          />

          {/* Chart area */}
          <View style={[styles.chartArea, { height: CHART_HEIGHT }]}>

            {/* NOW indicator */}
            {nowBarIndex >= 0 && (
              <View
                style={[
                  styles.nowIndicator,
                  { left: nowBarIndex * (BAR_WIDTH + GAP) + BAR_WIDTH / 2 },
                ]}
              >
                {/* NOW dot */}
                <View style={[styles.nowDot, { backgroundColor: isDarkMode ? '#FFFFFF' : colors.primary }]} />
                <Text style={[styles.nowLabel, { color: isDarkMode ? '#FFFFFF' : colors.primary }]}>NOW</Text>
                <View style={[styles.nowLine, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.7)' : colors.primary }]} />
              </View>
            )}

            {/* Swell trend line (amber, behind tide curve) */}
            {swellPoints.length > 1 && (
              <View style={[styles.tideSvg, { zIndex: 1 }]} pointerEvents="none">
                {swellPoints.slice(0, -1).map((pt, i) => {
                  const next = swellPoints[i + 1];
                  const dx = next.x - pt.x;
                  const dy = next.y - pt.y;
                  const length = Math.sqrt(dx * dx + dy * dy);
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  return (
                    <View
                      key={`swell-${i}`}
                      style={{
                        position: 'absolute',
                        left: pt.x,
                        top: pt.y - 0.5,
                        width: length,
                        height: 1,
                        backgroundColor: COLORS.AMBER,
                        transformOrigin: '0 50%',
                        transform: [{ rotate: `${angle}deg` }],
                      }}
                    />
                  );
                })}
              </View>
            )}

            {/* Bars */}
            <View style={styles.barsRow}>
              {scores.map((score, idx) => {
                const barColor = getBarColor(score);
                const heightPct = 0.2 + (score / 10) * 0.8;
                const barH = BAR_AREA_HEIGHT * heightPct;
                const isSelected = idx === selectedIndex;
                const isInBestWindow = idx >= bestWindowStart && idx < bestWindowStart + 3;
                const isBestScore = idx === bestScoreIndex;
                const ratingKey = getRatingKey(score);
                const isDimmed = highlightRating !== null && ratingKey !== highlightRating;
                const barOpacity = isDimmed ? 0.25 : isSelected ? 1 : 0.7;

                // Lighter top color for gradient simulation
                const lighterColor = barColor + 'CC';

                return (
                  <View
                    key={idx}
                    style={[
                      styles.barWrapper,
                      { width: BAR_WIDTH, marginRight: idx < NUM_BARS - 1 ? GAP : 0 },
                      isInBestWindow && {
                        shadowColor: barColor,
                        shadowOpacity: 0.6,
                        shadowRadius: 8,
                        elevation: 6,
                      },
                    ]}
                  >
                    {/* Gold star for best hour */}
                    {isBestScore && (
                      <Text style={styles.goldStar}>★</Text>
                    )}

                    {/* Bar with gradient simulation */}
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barH,
                          opacity: barOpacity,
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                          borderWidth: isSelected ? 1.5 : 0,
                          borderColor: isSelected ? '#FFFFFF' : 'transparent',
                          overflow: 'hidden',
                        },
                      ]}
                    >
                      {/* Top lighter half */}
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: lighterColor,
                        }}
                      />
                      {/* Bottom base color half */}
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: barColor,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Tide curve overlay */}
            {tidePoints.length > 1 && (
              <View style={[styles.tideSvg, { zIndex: 5 }]} pointerEvents="none">
                {/* Tide fill strips */}
                {tidePoints.slice(0, -1).map((pt, i) => {
                  const next = tidePoints[i + 1];
                  const midY = (pt.y + next.y) / 2;
                  const stripCount = Math.floor((CHART_HEIGHT - midY) / 5);
                  return Array.from({ length: Math.min(stripCount, 12) }).map((_, si) => (
                    <View
                      key={`fill-${i}-${si}`}
                      style={{
                        position: 'absolute',
                        left: pt.x,
                        top: midY + si * 5,
                        width: next.x - pt.x,
                        height: 5,
                        backgroundColor: 'rgba(96,165,250,0.06)',
                      }}
                    />
                  ));
                })}

                {/* Tide line segments (2.5px) */}
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
                        top: pt.y - 1.25,
                        width: length,
                        height: 2.5,
                        backgroundColor: 'rgba(96,165,250,0.65)',
                        transformOrigin: '0 50%',
                        transform: [{ rotate: `${angle}deg` }],
                      }}
                    />
                  );
                })}

                {/* HIGH tide markers */}
                {highPoints.map((pt, i) => {
                  const badgeTop = pt.y - BADGE_HEIGHT - CONNECTOR_LENGTH;
                  const connectorTop = badgeTop + BADGE_HEIGHT;
                  const connectorHeight = pt.y - connectorTop;
                  const heightStr = pt.height.toFixed(1) + 'ft';
                  return (
                    <React.Fragment key={`high-${i}`}>
                      <View
                        style={{
                          position: 'absolute',
                          left: pt.x - 0.5,
                          top: connectorTop,
                          width: 1,
                          height: Math.max(connectorHeight, 0),
                          backgroundColor: 'rgba(96,165,250,0.5)',
                        }}
                      />
                      <View
                        style={{
                          position: 'absolute',
                          left: pt.x - 3.5,
                          top: pt.y - 3.5,
                          width: 7,
                          height: 7,
                          borderRadius: 3.5,
                          backgroundColor: 'white',
                          borderWidth: 1.5,
                          borderColor: COLORS.TIDE,
                        }}
                      />
                      <View
                        style={{
                          position: 'absolute',
                          left: pt.x - 18,
                          top: badgeTop,
                          width: 36,
                          borderRadius: 6,
                          backgroundColor: 'rgba(20,20,30,0.88)',
                          paddingHorizontal: 6,
                          paddingVertical: 3,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF', lineHeight: 13 }}>H</Text>
                        <Text style={{ fontSize: 9, color: COLORS.TIDE, lineHeight: 12 }}>{heightStr}</Text>
                      </View>
                    </React.Fragment>
                  );
                })}

                {/* LOW tide dots */}
                {lowPoints.map((pt, i) => {
                  const dashStartY = pt.y + 4;
                  const dashEndY = CHART_HEIGHT;
                  const dashTotalHeight = dashEndY - dashStartY;
                  const dashCount = Math.max(4, Math.floor(dashTotalHeight / 7));
                  const dashSpacing = dashTotalHeight / dashCount;
                  const dashes = Array.from({ length: dashCount });
                  return (
                    <React.Fragment key={`low-${i}`}>
                      <View
                        style={{
                          position: 'absolute',
                          left: pt.x - 3.5,
                          top: pt.y - 3.5,
                          width: 7,
                          height: 7,
                          borderRadius: 3.5,
                          backgroundColor: 'white',
                          borderWidth: 1.5,
                          borderColor: COLORS.TIDE,
                        }}
                      />
                      {dashes.map((_, di) => (
                        <View
                          key={`dash-${i}-${di}`}
                          style={{
                            position: 'absolute',
                            left: pt.x - 1,
                            top: dashStartY + di * dashSpacing,
                            width: 2,
                            height: 3,
                            backgroundColor: 'rgba(96,165,250,0.4)',
                          }}
                        />
                      ))}
                    </React.Fragment>
                  );
                })}
              </View>
            )}

            {/* Baseline */}
            <View style={[styles.baseline, { backgroundColor: baselineColor }]} />
          </View>

          {/* LOW LABEL ZONE */}
          <View style={{ height: LOW_LABEL_ZONE_HEIGHT, position: 'relative' }}>
            {lowPoints.map((pt, i) => {
              const heightStr = pt.height.toFixed(1) + 'ft';
              return (
                <View
                  key={`low-badge-${i}`}
                  style={{
                    position: 'absolute',
                    left: pt.x - 28,
                    top: (LOW_LABEL_ZONE_HEIGHT - BADGE_HEIGHT / 2) / 2 - 2,
                    width: 56,
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      borderRadius: 6,
                      backgroundColor: 'rgba(20,20,30,0.88)',
                      paddingHorizontal: 6,
                      paddingVertical: 3,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF', lineHeight: 13 }}>L</Text>
                    <Text style={{ fontSize: 9, color: COLORS.TIDE, lineHeight: 12 }}>{heightStr}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Time labels */}
          <View style={styles.labelsRow}>
            {HOUR_LABELS.map((label, idx) => (
              <View
                key={idx}
                style={[
                  styles.labelWrapper,
                  { width: BAR_WIDTH, marginRight: idx < NUM_BARS - 1 ? GAP : 0 },
                ]}
              >
                <Text
                  style={[
                    styles.hourLabel,
                    {
                      color: idx === selectedIndex ? '#FFFFFF' : textSecondary,
                      fontWeight: idx === selectedIndex ? '700' : '400',
                    },
                  ]}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Tappable Legend */}
      <View style={styles.legend}>
        {legendItems.map((item, idx) => {
          const isActive = highlightRating === item.label;
          return (
            <TouchableOpacity
              key={item.label}
              onPress={() => handleLegendPress(item.label, idx)}
              activeOpacity={0.7}
            >
              <RNAnimated.View
                style={[
                  styles.legendItem,
                  isActive && styles.legendItemActive,
                  { transform: [{ scale: legendScales[idx] }] },
                ]}
              >
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text
                  style={[
                    styles.legendText,
                    { color: isActive ? '#FFFFFF' : textSecondary },
                  ]}
                >
                  {item.label}
                </Text>
              </RNAnimated.View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Scroll hint */}
      <Text style={[styles.scrollHint, { color: textSecondary }]}>
        {'← swipe chart · tap legend to filter →'}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0,
  },
  tideSwingText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.TIDE,
  },
  bestWindowPill: {
    alignSelf: 'flex-start',
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 10,
    zIndex: 10,
  },
  bestWindowText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.PRIME,
    letterSpacing: 0.3,
  },
  figureCanvas: {
    height: FIGURE_CANVAS_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  scrollView: {
    marginHorizontal: -14,
  },
  scrollContent: {
    paddingHorizontal: 14,
  },
  scrubOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 30,
    backgroundColor: 'transparent',
  },
  chartArea: {
    position: 'relative',
  },
  nowIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  nowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 14,
    marginBottom: 1,
  },
  nowLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  nowLine: {
    width: 2,
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
    zIndex: 2,
  },
  barWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: BAR_AREA_HEIGHT,
  },
  goldStar: {
    fontSize: 10,
    color: COLORS.GOLD,
    marginBottom: 1,
    lineHeight: 12,
  },
  bar: {
    width: '100%',
  },
  tideSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    gap: 8,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  legendItemActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
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
