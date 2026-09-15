import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated as RNAnimated,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Animated, {
  useSharedValue,
  withTiming,
  withRepeat,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TideEntry {
  time: string;
  type: string;
  height: number;
}

export interface LiveSurfSceneProps {
  waveHeight: number;
  wavePeriod: number;
  windSpeed: number;
  windDirection: string;
  condition: string;
  tides: TideEntry[];
  updatedAt?: string;
  isDarkMode?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCENE_PANEL_HEIGHT = 160;
const PANEL_W = 300;



// ─── Parse helpers ────────────────────────────────────────────────────────────

export function parseNumeric(str: string): number {
  if (!str) return 0;
  const s = String(str).trim();
  if (s.includes('-')) {
    const parts = s.split('-');
    const lo = parseFloat(parts[0].replace(/[^0-9.]/g, ''));
    const hi = parseFloat(parts[1].replace(/[^0-9.]/g, ''));
    return isNaN(lo) || isNaN(hi) ? 0 : (lo + hi) / 2;
  }
  const v = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(v) ? 0 : v;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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

function waveHeightToFraction(h: number): number {
  if (h <= 1) return 0.25 + (h / 1) * 0.10;
  if (h <= 2.5) return 0.35 + ((h - 1) / 1.5) * 0.10;
  if (h <= 3.5) return 0.45 + ((h - 2.5) / 1.0) * 0.10;
  if (h <= 4.5) return 0.55 + ((h - 3.5) / 1.0) * 0.10;
  return Math.min(0.65 + ((h - 4.5) / 2.0) * 0.05, 0.70);
}

// ─── Wave SVG builder ─────────────────────────────────────────────────────────

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
  const backX = Math.max(peakX - waveHeight_px * 0.55, 4);
  const backY = waveBaseY;

  const curlX = peakX + waveHeight_px * 0.18;
  const curlY = peakY + waveHeight_px * 0.08;

  const faceCP1x = peakX + (toeX - peakX) * 0.25;
  const faceCP1y = peakY + waveHeight_px * 0.15;
  const faceCP2x = peakX + (toeX - peakX) * 0.65;
  const faceCP2y = waveBaseY - waveHeight_px * 0.12;

  const foamCount = 5;
  const foamW = (toeX - backX) / foamCount;
  const foamH = Math.min(7, waveHeight_px * 0.10);
  const foamScallops = Array.from({ length: foamCount }, (_, i) => {
    const fx0 = toeX - i * foamW;
    const fx1 = toeX - (i + 1) * foamW;
    const fmid = (fx0 + fx1) / 2;
    return `Q ${fmid} ${waveBaseY + foamH} ${fx1} ${waveBaseY}`;
  }).join(' ');

  const wavePath = [
    `M ${backX} ${backY}`,
    `C ${backX + 4} ${backY - waveHeight_px * 0.4} ${peakX - waveHeight_px * 0.12} ${peakY + waveHeight_px * 0.18} ${peakX} ${peakY}`,
    `Q ${peakX + waveHeight_px * 0.10} ${peakY - waveHeight_px * 0.12} ${curlX} ${curlY}`,
    `C ${faceCP1x} ${faceCP1y} ${faceCP2x} ${faceCP2y} ${toeX} ${waveBaseY}`,
    foamScallops,
    `L ${backX} ${backY}`,
    'Z',
  ].join(' ');

  const highlightPath = [
    `M ${curlX - 4} ${curlY + 4}`,
    `C ${faceCP1x - 4} ${faceCP1y + 6} ${faceCP2x - 8} ${faceCP2y + 4} ${toeX - 18} ${waveBaseY - 5}`,
    `C ${faceCP2x - 12} ${faceCP2y} ${faceCP1x - 2} ${faceCP1y + 2} ${curlX - 6} ${curlY + 8}`,
    'Z',
  ].join(' ');

  const sheenPath = isGlassy
    ? `<path d="M ${curlX} ${curlY + 3} C ${faceCP1x} ${faceCP1y + 4} ${faceCP2x - 10} ${faceCP2y + 2} ${toeX - 25} ${waveBaseY - 6}" stroke="rgba(255,255,255,0.20)" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
    : '';

  const choppyLines = isChoppy
    ? [
        { x1: faceCP1x, y1: faceCP1y + 8, x2: faceCP1x + 14, y2: faceCP1y + 6 },
        { x1: faceCP1x + 22, y1: faceCP1y + 18, x2: faceCP1x + 36, y2: faceCP1y + 15 },
        { x1: faceCP2x - 20, y1: faceCP2y + 4, x2: faceCP2x - 6, y2: faceCP2y + 2 },
      ]
        .map(l => `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="rgba(255,255,255,0.16)" stroke-width="1.5" stroke-linecap="round"/>`)
        .join('')
    : '';

  const ripple = `<path d="M ${toeX + 6} ${waveBaseY - 1} Q ${toeX + 22} ${waveBaseY - 4} ${toeX + 44} ${waveBaseY - 1} Q ${toeX + 66} ${waveBaseY + 2} ${W} ${waveBaseY - 1}" stroke="rgba(96,165,250,0.22)" stroke-width="1.5" fill="none"/>`;

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
  <path d="${highlightPath}" fill="rgba(30,120,180,0.40)"/>
  ${sheenPath}
  ${choppyLines}
  ${ripple}
</svg>
</body>
</html>`;
}

// ─── Weather Icon ─────────────────────────────────────────────────────────────

interface WeatherIconProps {
  windSpeed: number;
  isOffshore: boolean;
  condition?: string;
}

function WeatherIcon({ windSpeed, isOffshore, condition }: WeatherIconProps) {
  const condLower = (condition || '').toLowerCase();

  const isSunny = condLower.includes('clear') || condLower.includes('sunny') || condLower.includes('fair')
    ? true
    : condLower === '' && windSpeed < 8 && isOffshore;

  const isRainy = condLower.includes('rain') || condLower.includes('storm') || condLower.includes('thunder') || condLower.includes('shower')
    ? true
    : condLower === '' && windSpeed >= 15 && !isOffshore;

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
        <View style={{
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: '#FFD700',
          position: 'absolute',
        }} />
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

// ─── Format updatedAt timestamp → "Updated HH:MM AM/PM" ──────────────────────

function formatUpdatedAt(updatedAt: string | undefined): string {
  if (!updatedAt) return '';
  try {
    const d = new Date(updatedAt);
    const timeStr = d.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `Updated ${timeStr}`;
  } catch {
    return '';
  }
}

// ─── LiveSurfScene Component ──────────────────────────────────────────────────

export default function LiveSurfScene({
  waveHeight,
  wavePeriod,
  windSpeed,
  windDirection,
  condition,
  tides,
  updatedAt,
  isDarkMode = false,
}: LiveSurfSceneProps) {
  const isOffshore = windDirection.toUpperCase().includes('W') || windDirection.toUpperCase().includes('N');

  // Current EST hour for "now" display
  const currentHour = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }),
    10
  );
  const displayHour = currentHour > 12
    ? `${currentHour - 12} PM`
    : currentHour === 12
    ? '12 PM'
    : `${currentHour} AM`;

  const waveEstStr = Number(waveHeight).toFixed(1);

  const tideNow = interpolateTideHeight(currentHour, tides);
  const tidePrev = interpolateTideHeight(currentHour - 0.5, tides);
  const tideNext = interpolateTideHeight(currentHour + 0.5, tides);
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

  // Panel / wave geometry
  const panelH = SCENE_PANEL_HEIGHT;
  const waveBaseY = panelH * 0.58;

  // Clamp waveHeight for stance/geometry (min 0.5 ft)
  const clampedWH = Math.max(waveHeight, 0.5);
  const rawWaveH = waveHeightToFraction(clampedWH) * panelH * 0.72;
  const waveHeight_px = clamp(rawWaveH, 14, 100);

  // Animated wave height for smooth transitions
  const animatedWaveHeightPx = useSharedValue(waveHeight_px);
  useEffect(() => {
    animatedWaveHeightPx.value = withTiming(waveHeight_px, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [waveHeight_px, animatedWaveHeightPx]);

  // Wave face endpoints
  const toeX = PANEL_W * 0.82;
  const peakX = PANEL_W * 0.38;
  const peakY = waveBaseY - waveHeight_px;

  // Surfer position on the asymmetric concave face
  const curlX_s = peakX + waveHeight_px * 0.18;
  const curlY_s = peakY + waveHeight_px * 0.08;
  const faceCP1x_s = peakX + (toeX - peakX) * 0.25;
  const faceCP1y_s = peakY + waveHeight_px * 0.15;
  const faceCP2x_s = peakX + (toeX - peakX) * 0.65;
  const faceCP2y_s = waveBaseY - waveHeight_px * 0.12;

  const surferT = 0.38;
  const mt = 1 - surferT;
  const surferX =
    mt * mt * mt * curlX_s +
    3 * mt * mt * surferT * faceCP1x_s +
    3 * mt * surferT * surferT * faceCP2x_s +
    surferT * surferT * surferT * toeX;
  const surferFeetY =
    mt * mt * mt * curlY_s +
    3 * mt * mt * surferT * faceCP1y_s +
    3 * mt * surferT * surferT * faceCP2y_s +
    surferT * surferT * surferT * waveBaseY;

  // Tangent for board/figure lean
  const dt = 0.01;
  const mt2 = 1 - (surferT + dt);
  const tx2 =
    mt2 * mt2 * mt2 * curlX_s +
    3 * mt2 * mt2 * (surferT + dt) * faceCP1x_s +
    3 * mt2 * (surferT + dt) * (surferT + dt) * faceCP2x_s +
    (surferT + dt) * (surferT + dt) * (surferT + dt) * toeX;
  const ty2 =
    mt2 * mt2 * mt2 * curlY_s +
    3 * mt2 * mt2 * (surferT + dt) * faceCP1y_s +
    3 * mt2 * (surferT + dt) * (surferT + dt) * faceCP2y_s +
    (surferT + dt) * (surferT + dt) * (surferT + dt) * waveBaseY;
  const faceAngleDeg = Math.atan2(ty2 - surferFeetY, tx2 - surferX) * (180 / Math.PI);

  // Stance from wave height (clamped min 0.5)
  const stanceH = lerp(1.0, 0.62, clamp((clampedWH - 1) / 4, 0, 1));
  const bodyH = 20 * stanceH;
  const legH = 14 * stanceH;
  const headSize = 10;

  const baseLean = 8; // observational — no score-based lean
  const totalBodyLean = baseLean + faceAngleDeg * 0.5;
  const boardTilt = faceAngleDeg * 0.7;
  const figureLean = -(faceAngleDeg * 0.6);

  // Ride loop animation
  const rideProgress = useSharedValue(0);
  const rideDuration = 1200 + wavePeriod * 120;

  useEffect(() => {
    rideProgress.value = withRepeat(
      withTiming(1, { duration: rideDuration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [rideDuration, rideProgress]);

  // Animated surfer position (smooth on data update)
  const surferAnimStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: withTiming(0, { duration: 600 }) },
      ],
    };
  });

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

  // Time-of-day sky tint
  const dawnOverlay = currentHour >= 5 && currentHour <= 7;
  const duskOverlay = currentHour >= 17 && currentHour <= 18;

  // Surface conditions
  const choppy = !isOffshore && windSpeed >= 12;
  const glassy = isOffshore && wavePeriod >= 10;

  // Height ruler ticks
  const rulerLabels = ['knee', 'waist', 'chest', 'head', 'OH'];
  const rulerTop = Math.max(waveBaseY - 100, 52);
  const rulerHeight = waveBaseY - rulerTop - 4;

  // Wind arrow position
  const windArrowFacingRight = isOffshore;
  const windArrowLeft = surferX + 18;
  const windArrowTop = surferFeetY - legH - bodyH - headSize - 16;

  // Updated timestamp
  const updatedLabel = formatUpdatedAt(updatedAt);

  const containerBg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,122,255,0.04)';

  return (
    <View style={[sceneStyles.card, { backgroundColor: containerBg }]}>
      {/* Card header */}
      <View style={sceneStyles.cardHeader}>
        <Text style={sceneStyles.cardTitle}>Right Now</Text>
        {updatedLabel !== '' && (
          <Text style={sceneStyles.updatedText}>{updatedLabel}</Text>
        )}
      </View>

      {/* Scene panel */}
      <View style={sceneStyles.panel}>
        {/* Base sky: zinc-900 */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#18181b' }]} />

        {/* Sky gradient */}
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

        {/* Dawn tint */}
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

        {/* Dusk tint */}
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

        {/* Ocean body */}
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

        {/* Wave SVG */}
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

        {/* Height ruler */}
        <View
          style={{
            position: 'absolute',
            left: 6,
            top: rulerTop,
            height: rulerHeight,
            width: 32,
            overflow: 'hidden',
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

        {/* Wind arrow */}
        <View
          style={{
            position: 'absolute',
            left: windArrowLeft,
            top: windArrowTop,
            width: 18,
            height: 8,
          }}
        >
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

        {/* Stick figure */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: surferX - 20,
              top: surferFeetY - legH - bodyH - headSize - 2,
              width: 40,
              height: legH + bodyH + headSize + 4,
              opacity: 0.92,
              transform: [{ rotate: `${figureLean}deg` }],
            },
            surferAnimStyle,
          ]}
        >
          {/* Head */}
          <View
            style={{
              position: 'absolute',
              left: 20 - headSize / 2,
              top: 0,
              width: headSize,
              height: headSize,
              borderRadius: headSize / 2,
              backgroundColor: '#FFFFFF',
            }}
          />

          {/* Torso */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 19,
                top: headSize,
                width: 2,
                height: bodyH,
                backgroundColor: '#FFFFFF',
                transformOrigin: '50% 0%',
              },
              bodyAnimStyle,
            ]}
          />

          {/* Front arm */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 20,
                top: headSize + 3,
                width: 11,
                height: 2,
                backgroundColor: 'rgba(255,255,255,0.88)',
                transformOrigin: '0% 50%',
              },
              frontArmAnimStyle,
            ]}
          />

          {/* Back arm */}
          <View
            style={{
              position: 'absolute',
              left: 9,
              top: headSize + 3,
              width: 11,
              height: 2,
              backgroundColor: 'rgba(255,255,255,0.88)',
              transformOrigin: '100% 50%',
              transform: [{ rotate: '25deg' }],
            }}
          />

          {/* Front leg */}
          <View
            style={{
              position: 'absolute',
              left: 21,
              top: headSize + bodyH,
              width: 2,
              height: legH,
              backgroundColor: 'rgba(255,255,255,0.88)',
              transformOrigin: '50% 0%',
              transform: [{ rotate: '18deg' }],
            }}
          />

          {/* Back leg */}
          <View
            style={{
              position: 'absolute',
              left: 17,
              top: headSize + bodyH,
              width: 2,
              height: legH,
              backgroundColor: 'rgba(255,255,255,0.88)',
              transformOrigin: '50% 0%',
              transform: [{ rotate: '-12deg' }],
            }}
          />

          {/* Surfboard */}
          <View
            style={{
              position: 'absolute',
              left: 2,
              top: headSize + bodyH + legH - 1,
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(200,230,255,0.92)',
              transformOrigin: '50% 50%',
              transform: [{ rotate: `${boardTilt}deg` }],
            }}
          />
        </Animated.View>

        {/* Weather icon */}
        <View style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28 }}>
          <WeatherIcon windSpeed={windSpeed} isOffshore={isOffshore} condition={condition} />
        </View>

        {/* Top-left: current time */}
        <View style={sceneStyles.topLeft}>
          <Text style={sceneStyles.hourText}>{displayHour}</Text>
        </View>

        {/* Top-right: wave / wind / tide stats */}
        <View style={sceneStyles.topRight}>
          <Text style={sceneStyles.statLine}>{waveEstStr} ft</Text>
          <Text style={sceneStyles.statLine}>{windSpeed} mph {windDirection}</Text>
          <Text style={sceneStyles.statLine}>{tideLabel}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sceneStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0,
  },
  updatedText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  panel: {
    height: SCENE_PANEL_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
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
