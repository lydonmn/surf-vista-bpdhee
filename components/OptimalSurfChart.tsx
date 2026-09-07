import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
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
import { WebView } from 'react-native-webview';
import Animated, {
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  runOnJS,
  useAnimatedStyle,
  Easing,
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
const SCENE_PANEL_HEIGHT = 160;

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

// ─── Wave height → fraction helper ───────────────────────────────────────────

function waveHeightToFraction(h: number): number {
  if (h <= 1) return 0.25 + (h / 1) * 0.10;
  if (h <= 2.5) return 0.35 + ((h - 1) / 1.5) * 0.10;
  if (h <= 3.5) return 0.45 + ((h - 2.5) / 1.0) * 0.10;
  if (h <= 4.5) return 0.55 + ((h - 3.5) / 1.0) * 0.10;
  return Math.min(0.65 + ((h - 4.5) / 2.0) * 0.05, 0.70);
}

// ─── Weather Icon ─────────────────────────────────────────────────────────────

interface WeatherIconProps {
  windSpeed: number;
  isOffshore: boolean;
}

function WeatherIcon({ windSpeed, isOffshore }: WeatherIconProps) {
  const isSunny = windSpeed < 8 && isOffshore;
  const isRainy = windSpeed >= 15 && !isOffshore;

  // Rain animation
  const rain1 = useRef(new RNAnimated.Value(0)).current;
  const rain2 = useRef(new RNAnimated.Value(0)).current;
  const rain3 = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (isRainy) {
      const makeLoop = (val: RNAnimated.Value, delay: number) =>
        RNAnimated.loop(
          RNAnimated.sequence([
            RNAnimated.delay(delay),
            RNAnimated.timing(val, { toValue: 12, duration: 600, useNativeDriver: true }),
            RNAnimated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        );
      const a1 = makeLoop(rain1, 0);
      const a2 = makeLoop(rain2, 200);
      const a3 = makeLoop(rain3, 400);
      a1.start();
      a2.start();
      a3.start();
      return () => { a1.stop(); a2.stop(); a3.stop(); };
    }
  }, [isRainy, rain1, rain2, rain3]);

  if (isSunny) {
    return (
      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
        {/* Sun circle */}
        <View style={{
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: '#FFD700',
          position: 'absolute',
        }} />
        {/* Rays */}
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <View
            key={angle}
            style={{
              position: 'absolute',
              width: 4,
              height: 1.5,
              backgroundColor: '#FFD700',
              left: 10,
              top: 11.25,
              transformOrigin: '0 50%',
              transform: [{ rotate: `${angle}deg` }, { translateX: 6 }],
            }}
          />
        ))}
      </View>
    );
  }

  if (isRainy) {
    return (
      <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
        {/* Cloud body */}
        <View style={{
          width: 18, height: 9, borderRadius: 4.5,
          backgroundColor: '#9CA3AF',
          position: 'absolute', top: 2, left: 5,
        }} />
        <View style={{
          width: 12, height: 8, borderRadius: 4,
          backgroundColor: '#9CA3AF',
          position: 'absolute', top: 0, left: 3,
        }} />
        {/* Rain drops */}
        {[{ x: 8, anim: rain1 }, { x: 14, anim: rain2 }, { x: 20, anim: rain3 }].map((drop, i) => (
          <RNAnimated.View
            key={i}
            style={{
              position: 'absolute',
              left: drop.x,
              top: 13,
              width: 1.5,
              height: 5,
              backgroundColor: '#60A5FA',
              borderRadius: 1,
              transform: [{ translateY: drop.anim }],
            }}
          />
        ))}
      </View>
    );
  }

  // Cloudy
  return (
    <View style={{ width: 24, height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 16, height: 9, borderRadius: 4.5,
        backgroundColor: 'rgba(255,255,255,0.55)',
        position: 'absolute', top: 5, left: 4,
      }} />
      <View style={{
        width: 12, height: 8, borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.45)',
        position: 'absolute', top: 2, left: 2,
      }} />
    </View>
  );
}

// ─── SurfScene Component ──────────────────────────────────────────────────────

interface SurfSceneProps {
  hourIndex: number;
  score: number;
  waveHeight: number;
  wavePeriod: number;
  windSpeed: number;
  windDirection: string;
  tides: TideEntry[];
  isScrubbing: boolean;
}

// lerp helper
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function buildWaveSvgHtml(
  W: number,
  H: number,
  peakX: number,
  peakY: number,
  toeX: number,
  waveBaseY: number,
  waveHeight_px: number,
  isGlassy: boolean,
  isChoppy: boolean,
): string {
  const baseY = waveBaseY;
  const lipX  = peakX - 10;
  const lipY  = peakY - 8;
  const backX = peakX - 40;
  const backY = baseY - waveHeight_px * 0.35;

  const foamCount = 5;
  const foamStep = (toeX - peakX) / foamCount;
  const foamAmplitude = Math.min(8, waveHeight_px * 0.12);

  const wavePath = [
    `M 0 ${baseY}`,
    `C ${backX - 20} ${baseY} ${backX} ${backY} ${lipX} ${lipY}`,
    `Q ${lipX + 14} ${lipY - 10} ${peakX + 18} ${peakY - 2}`,
    `C ${peakX + 30} ${peakY + waveHeight_px * 0.25} ${toeX - 20} ${baseY - waveHeight_px * 0.15} ${toeX} ${baseY}`,
    `L ${toeX} ${baseY + foamAmplitude}`,
    ...Array.from({ length: foamCount }, (_, i) => {
      const fi = foamCount - i;
      const fx = peakX + fi * foamStep;
      const fx_prev = peakX + (fi - 1) * foamStep;
      const fy = baseY + foamAmplitude * (fi % 2 === 0 ? 1 : 0.3);
      const fy_prev = baseY + foamAmplitude * ((fi - 1) % 2 === 0 ? 1 : 0.3);
      return `Q ${(fx + fx_prev) / 2} ${Math.max(fy, fy_prev) + 3} ${fx_prev} ${fy_prev}`;
    }),
    `L 0 ${baseY}`,
    'Z',
  ].join(' ');

  const highlightPath = [
    `M ${lipX + 5} ${lipY + 4}`,
    `C ${peakX + 20} ${peakY + waveHeight_px * 0.15} ${toeX - 40} ${baseY - waveHeight_px * 0.2} ${toeX - 20} ${baseY - 4}`,
    `C ${toeX - 35} ${baseY - waveHeight_px * 0.1} ${peakX + 15} ${peakY + waveHeight_px * 0.3} ${lipX + 2} ${lipY + 10}`,
    'Z',
  ].join(' ');

  const sheenPath = isGlassy
    ? `<path d="M ${lipX + 8} ${lipY + 6} C ${peakX + 15} ${peakY + waveHeight_px * 0.1} ${toeX - 50} ${baseY - waveHeight_px * 0.25} ${toeX - 30} ${baseY - 8}" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
    : '';

  const choppyLines = isChoppy
    ? [
        { x1: peakX + 20, y1: peakY + waveHeight_px * 0.3, x2: peakX + 32, y2: peakY + waveHeight_px * 0.28 },
        { x1: peakX + 40, y1: peakY + waveHeight_px * 0.5, x2: peakX + 54, y2: peakY + waveHeight_px * 0.47 },
        { x1: peakX + 60, y1: peakY + waveHeight_px * 0.62, x2: peakX + 70, y2: peakY + waveHeight_px * 0.60 },
      ]
        .map(l => `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-linecap="round"/>`)
        .join('')
    : '';

  const lipFoam = `<ellipse cx="${lipX + 6}" cy="${lipY - 2}" rx="10" ry="5" fill="rgba(255,255,255,0.82)"/>`;

  const ripple = `<path d="M ${toeX + 5} ${baseY} Q ${toeX + 20} ${baseY - 3} ${toeX + 40} ${baseY} Q ${toeX + 60} ${baseY + 3} ${W} ${baseY}" stroke="rgba(96,165,250,0.25)" stroke-width="1.5" fill="none"/>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: transparent; overflow: hidden; }
  svg { display: block; }
</style>
</head>
<body>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <path d="${wavePath}" fill="#0e4d6e"/>
  <path d="${highlightPath}" fill="rgba(30,120,180,0.45)"/>
  ${sheenPath}
  ${choppyLines}
  ${lipFoam}
  ${ripple}
</svg>
</body>
</html>`;
}

function SurfScene({
  hourIndex,
  score,
  waveHeight,
  wavePeriod,
  windSpeed,
  windDirection,
  tides,
  isScrubbing,
}: SurfSceneProps) {
  const isOffshore = windDirection.toUpperCase().includes('W') || windDirection.toUpperCase().includes('N');

  // ── Derived display values ──
  const hour = HOURS[hourIndex] ?? 5;
  const displayHour = hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`;
  const ratingKey = getRatingKey(score);
  const ratingColor = COLORS[ratingKey];

  const waveEst = waveHeight * 0.8 + (score / 10) * 0.4;
  const waveEstStr = Number(waveEst).toFixed(1);

  const tideNow = interpolateTideHeight(hour, tides);
  const tidePrev = interpolateTideHeight(hour - 0.5, tides);
  const tideNext = interpolateTideHeight(hour + 0.5, tides);
  let tideState = 'Steady';
  let tideArrow = '→';
  if (tideNow !== null && tidePrev !== null && tideNext !== null) {
    const slope = tideNext - tidePrev;
    if (slope > 0.05) { tideState = 'Rising'; tideArrow = '↑'; }
    else if (slope < -0.05) { tideState = 'Falling'; tideArrow = '↓'; }
    else if (tideNow > 3) { tideState = 'High'; tideArrow = '—'; }
    else { tideState = 'Low'; tideArrow = '—'; }
  }
  const tideLabel = `${tideState} ${tideArrow}`;

  // ── Panel / wave geometry ──
  const panelH = SCENE_PANEL_HEIGHT;
  const PANEL_W = 300;

  const waveBaseY = panelH * 0.58;
  const rawWaveH = waveHeightToFraction(waveHeight) * panelH * 0.72;
  const waveHeight_px = clamp(rawWaveH, 18, 100);

  // Wave face endpoints
  const toeX = PANEL_W * 0.82;
  const peakX = PANEL_W * 0.38;
  const peakY = waveBaseY - waveHeight_px;

  // ── Surfer position on wave face (curved face, not linear) ──
  const surferFaceT = 0.45;
  const surferX = peakX + (toeX - peakX) * surferFaceT;
  const surferFeetY = peakY + (waveBaseY - peakY) * Math.pow(surferFaceT, 0.7);

  // Face angle at surfer position (tangent of curved face)
  const t1 = 0.35;
  const t2 = 0.55;
  const y1 = peakY + (waveBaseY - peakY) * Math.pow(t1, 0.7);
  const y2 = peakY + (waveBaseY - peakY) * Math.pow(t2, 0.7);
  const faceAngleDeg = Math.atan2(y2 - y1, (toeX - peakX) * (t2 - t1)) * (180 / Math.PI);

  // ── Stance from wave height ──
  const stanceH = lerp(1.0, 0.62, clamp((waveHeight - 1) / 4, 0, 1));
  const bodyH = 20 * stanceH;
  const legH = 14 * stanceH;
  const headSize = 10;

  // Body lean: score-based + face angle contribution
  const baseLean = score >= 7 ? 15 : score >= 5 ? 10 : 5;
  const totalBodyLean = baseLean + faceAngleDeg * 0.5;
  // Board tilt follows wave face
  const boardTilt = faceAngleDeg * 0.7;
  // Surfer leans into wave face
  const figureLean = -(faceAngleDeg * 0.6);

  // ── Reanimated ride loop ──
  const rideProgress = useSharedValue(0);
  const rideDuration = 1200 + wavePeriod * 120;

  useEffect(() => {
    rideProgress.value = withRepeat(
      withTiming(1, { duration: rideDuration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [rideDuration, rideProgress]);

  const bodyAnimStyle = useAnimatedStyle(() => {
    const leanOscillation = (rideProgress.value - 0.5) * 6;
    const xShift = (rideProgress.value - 0.5) * 8;
    return {
      transform: [
        { translateX: xShift },
        { rotate: `${totalBodyLean + leanOscillation}deg` },
      ],
    };
  });

  const frontArmAnimStyle = useAnimatedStyle(() => {
    const armOscillation = (rideProgress.value - 0.5) * 10;
    return {
      transform: [{ rotate: `${-30 + armOscillation}deg` }],
    };
  });

  const figureOpacity = isScrubbing ? 1.0 : 0.92;

  // ── Time-of-day sky tint (subtle overlays only, zinc-900 base) ──
  const dawnOverlay = hour >= 5 && hour <= 7;
  const duskOverlay = hour >= 17 && hour <= 18;

  // ── Surface conditions ──
  const choppy = !isOffshore && windSpeed >= 12;
  const glassy = isOffshore && wavePeriod >= 10;

  // ── Height ruler ticks ──
  const rulerLabels = ['knee', 'waist', 'chest', 'head', 'OH'];
  const rulerTop = waveBaseY - 100;
  const rulerHeight = 100;

  // Wind arrow position (outside figure container)
  const windArrowFacingRight = isOffshore;
  const windArrowLeft = surferX + 18;
  const windArrowTop = surferFeetY - legH - bodyH - headSize - 16;

  return (
    <View style={sceneStyles.panel}>
      {/* ── Base sky: zinc-900 ── */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#18181b' }]} />

      {/* ── Sky gradient: slightly blue-tinted dark at top, fades to zinc at horizon ── */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: panelH * 0.45,
          backgroundColor: '#1c2333',
          opacity: 0.7,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: panelH * 0.25,
          height: panelH * 0.2,
          backgroundColor: '#18181b',
          opacity: 0.8,
        }}
      />

      {/* ── Dawn tint (faint warm overlay) ── */}
      {dawnOverlay && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: panelH * 0.45,
            backgroundColor: 'rgba(180,80,20,0.15)',
          }}
        />
      )}

      {/* ── Dusk tint (faint warm overlay) ── */}
      {duskOverlay && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: panelH * 0.45,
            backgroundColor: 'rgba(120,60,20,0.12)',
          }}
        />
      )}

      {/* ── Ocean body (below waterline) ── */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: waveBaseY,
          bottom: 0,
          backgroundColor: '#0f1f2e',
        }}
      />

      {/* ── Wave SVG (single continuous path via WebView) ── */}
      <WebView
        source={{ html: buildWaveSvgHtml(PANEL_W, panelH, peakX, peakY, toeX, waveBaseY, waveHeight_px, glassy, choppy) }}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: PANEL_W,
          height: panelH,
          backgroundColor: 'transparent',
        }}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        androidLayerType="hardware"
        originWhitelist={['*']}
      />

      {/* ── Height ruler (LEFT edge, clear of weather icon) ── */}
      <View
        style={{
          position: 'absolute',
          left: 6,
          top: rulerTop,
          height: rulerHeight,
          width: 32,
        }}
      >
        {rulerLabels.map((label, i) => {
          const pct = i / (rulerLabels.length - 1);
          const tickY = rulerHeight - pct * rulerHeight;
          const isHighlighted = Math.abs(waveHeight_px - pct * 100) < 15;
          return (
            <View
              key={`tick-${i}`}
              style={{
                position: 'absolute',
                left: 0,
                top: tickY - 0.5,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 1,
                  backgroundColor: isHighlighted ? '#FFD700' : 'rgba(255,255,255,0.55)',
                  opacity: isHighlighted ? 1.0 : 0.4,
                  marginRight: 2,
                }}
              />
              <Text
                style={{
                  fontSize: 7,
                  color: isHighlighted ? '#FFD700' : 'rgba(255,255,255,0.55)',
                  opacity: isHighlighted ? 1.0 : 0.4,
                }}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── Wind arrow (absolutely positioned, outside figure) ── */}
      <View
        style={{
          position: 'absolute',
          left: windArrowLeft,
          top: windArrowTop,
          width: 18,
          height: 8,
        }}
      >
        {/* Shaft */}
        <View
          style={{
            position: 'absolute',
            left: windArrowFacingRight ? 0 : 6,
            top: 3,
            width: 12,
            height: 2,
            backgroundColor: 'rgba(251,191,36,0.9)',
          }}
        />
        {/* Arrowhead */}
        <View
          style={{
            position: 'absolute',
            left: windArrowFacingRight ? 12 : 0,
            top: 0,
            width: 0,
            height: 0,
            borderTopWidth: 4,
            borderBottomWidth: 4,
            borderLeftWidth: windArrowFacingRight ? 6 : 0,
            borderRightWidth: windArrowFacingRight ? 0 : 6,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: windArrowFacingRight ? 'rgba(251,191,36,0.9)' : 'transparent',
            borderRightColor: windArrowFacingRight ? 'transparent' : 'rgba(251,191,36,0.9)',
          }}
        />
      </View>

      {/* ── Stick figure — feet sit on wave face surface ── */}
      <View
        style={{
          position: 'absolute',
          left: surferX - 20,
          top: surferFeetY - legH - bodyH - headSize - 2,
          width: 44,
          height: legH + bodyH + headSize + 4,
          opacity: figureOpacity,
          transform: [{ rotate: `${figureLean}deg` }],
        }}
      >
        {/* Head */}
        <View
          style={{
            position: 'absolute',
            left: 17,
            top: 0,
            width: headSize,
            height: headSize,
            borderRadius: headSize / 2,
            backgroundColor: '#FFFFFF',
          }}
        />

        {/* Body (animated lean) */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 21,
              top: headSize + 1,
              width: 2,
              height: bodyH,
              backgroundColor: '#FFFFFF',
              transformOrigin: '50% 0%',
            },
            bodyAnimStyle,
          ]}
        />

        {/* Front arm (toward wave, animated) */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 22,
              top: headSize + 5,
              width: 12,
              height: 2,
              backgroundColor: 'rgba(255,255,255,0.85)',
              transformOrigin: '0% 50%',
            },
            frontArmAnimStyle,
          ]}
        />

        {/* Back arm (balance) */}
        <View
          style={{
            position: 'absolute',
            left: 10,
            top: headSize + 5,
            width: 12,
            height: 2,
            backgroundColor: 'rgba(255,255,255,0.85)',
            transformOrigin: '100% 50%',
            transform: [{ rotate: '20deg' }],
          }}
        />

        {/* Front leg */}
        <View
          style={{
            position: 'absolute',
            left: 23,
            top: headSize + bodyH + 1,
            width: 2,
            height: legH,
            backgroundColor: 'rgba(255,255,255,0.85)',
            transformOrigin: '50% 0%',
            transform: [{ rotate: '20deg' }],
          }}
        />

        {/* Back leg */}
        <View
          style={{
            position: 'absolute',
            left: 19,
            top: headSize + bodyH + 1,
            width: 2,
            height: legH,
            backgroundColor: 'rgba(255,255,255,0.85)',
            transformOrigin: '50% 0%',
            transform: [{ rotate: '-15deg' }],
          }}
        />

        {/* Surfboard — bottom edge aligns with surferFeetY, tilts with face */}
        <View
          style={{
            position: 'absolute',
            left: 2,
            top: headSize + bodyH + legH - 2,
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: 'rgba(200,230,255,0.9)',
            transformOrigin: '50% 50%',
            transform: [{ rotate: `${boardTilt}deg` }],
          }}
        />
      </View>

      {/* ── Weather icon (top-right corner) ── */}
      <View style={{ position: 'absolute', top: 10, right: 10, width: 24, height: 24 }}>
        <WeatherIcon windSpeed={windSpeed} isOffshore={isOffshore} />
      </View>

      {/* ── Top-left overlay: hour + rating ── */}
      <View style={sceneStyles.topLeft}>
        <Text style={sceneStyles.hourText}>{displayHour}</Text>
        <View style={[sceneStyles.ratingPill, { backgroundColor: ratingColor + '33', borderColor: ratingColor }]}>
          <Text style={[sceneStyles.ratingText, { color: ratingColor }]}>{ratingKey}</Text>
        </View>
      </View>

      {/* ── Top-right overlay: wave / wind / tide ── */}
      <View style={sceneStyles.topRight}>
        <Text style={sceneStyles.statLine}>{waveEstStr} ft</Text>
        <Text style={sceneStyles.statLine}>{windSpeed} mph {windDirection}</Text>
        <Text style={sceneStyles.statLine}>{tideLabel}</Text>
      </View>
    </View>
  );
}

const sceneStyles = StyleSheet.create({
  panel: {
    height: SCENE_PANEL_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    position: 'relative',
    backgroundColor: '#18181b',
  },
  topLeft: {
    position: 'absolute',
    top: 8,
    left: 10,
    zIndex: 20,
  },
  hourText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ratingPill: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  ratingText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  topRight: {
    position: 'absolute',
    top: 8,
    right: 36,
    alignItems: 'flex-end',
    zIndex: 20,
  },
  statLine: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 15,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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

  // Reanimated shared values
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

      {/* Unified scene panel */}
      <SurfScene
        hourIndex={selectedIndex}
        score={selectedScore}
        waveHeight={waveHeight}
        wavePeriod={wavePeriod}
        windSpeed={windSpeed}
        windDirection={windDirection}
        tides={tides}
        isScrubbing={isScrubbing}
      />

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

            {/* Best window green band — single rounded rect spanning all 3 columns */}
            {(() => {
              const bandLeft = bestWindowStart * (BAR_WIDTH + GAP);
              const bandRight = (bestWindowStart + 2) * (BAR_WIDTH + GAP) + BAR_WIDTH;
              return (
                <View
                  style={{
                    position: 'absolute',
                    left: bandLeft,
                    top: 4,
                    width: bandRight - bandLeft,
                    bottom: 4,
                    backgroundColor: 'rgba(34,197,94,0.08)',
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: 'rgba(34,197,94,0.28)',
                    zIndex: 0,
                  }}
                />
              );
            })()}

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
                        <Text style={{ fontSize: 8, fontWeight: '700', color: COLORS.TIDE, lineHeight: 11 }}>High</Text>
                        <Text style={{ fontSize: 9, fontWeight: '600', color: '#FFFFFF', lineHeight: 12 }}>{heightStr}</Text>
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
                    <Text style={{ fontSize: 8, fontWeight: '700', color: COLORS.TIDE, lineHeight: 11 }}>Low</Text>
                    <Text style={{ fontSize: 9, fontWeight: '600', color: '#FFFFFF', lineHeight: 12 }}>{heightStr}</Text>
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
