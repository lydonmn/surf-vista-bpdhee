import { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StokeOMeterProps {
  score: number;   // 0–10 float, clamped to 1–11 internally
  isDarkMode?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_WIDTH = 180;
const CX = CARD_WIDTH / 2;
const CY = 82;
const RADIUS = 48;
const ARC_START_DEG = -110;
const NUM_SEGMENTS = 120;
const NEEDLE_LENGTH = RADIUS * 0.85;
const NEEDLE_WIDTH = 3;
const HUB_SIZE = 11;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampScore(s: number): number {
  return Math.max(1, Math.min(11, s));
}

function scoreToAngle(score: number): number {
  const s = clampScore(score);
  return ARC_START_DEG + ((s - 1) / 10) * 220;
}

function getBandColor(score: number, segmentIndex?: number): string {
  if (score <= 2) return '#EF4444';
  if (score <= 3) return '#EAB308';
  if (score <= 7) return '#22C55E';
  const goldColors = ['#F59E0B', '#FBBF24', '#FCD34D', '#FBBF24'];
  return goldColors[(segmentIndex ?? 0) % goldColors.length];
}

function getNeedleColor(score: number): string {
  if (score <= 2) return '#EF4444';
  if (score <= 3) return '#EAB308';
  if (score <= 7) return '#22C55E';
  return '#F59E0B';
}

function getReadoutColor(score: number): string {
  if (score <= 2) return '#EF4444';
  if (score <= 3) return '#EAB308';
  return '#22C55E';
}

// ─── Arc segments ─────────────────────────────────────────────────────────────

function buildArcSegments() {
  const segments: { x: number; y: number; score: number; index: number }[] = [];
  for (let i = 0; i < NUM_SEGMENTS; i++) {
    const segFraction = i / NUM_SEGMENTS;
    const segScore = 1 + segFraction * 10;
    const segAngleDeg = ARC_START_DEG + segFraction * 220;
    const segAngleRad = ((segAngleDeg - 90) * Math.PI) / 180;
    const x = CX + RADIUS * Math.cos(segAngleRad);
    const y = CY + RADIUS * Math.sin(segAngleRad);
    segments.push({ x, y, score: segScore, index: i });
  }
  return segments;
}

const ARC_SEGMENTS = buildArcSegments();

// ─── Tick marks and labels ────────────────────────────────────────────────────

function buildTicks() {
  const ticks: { n: number; x: number; y: number; labelX: number; labelY: number; angleDeg: number }[] = [];
  for (let n = 1; n <= 11; n++) {
    const tickFraction = (n - 1) / 10;
    const tickAngleDeg = ARC_START_DEG + tickFraction * 220;
    const tickAngleRad = ((tickAngleDeg - 90) * Math.PI) / 180;
    const outerR = RADIUS + 4;
    const labelR = RADIUS - 16;
    const x = CX + outerR * Math.cos(tickAngleRad);
    const y = CY + outerR * Math.sin(tickAngleRad);
    const labelX = CX + labelR * Math.cos(tickAngleRad);
    const labelY = CY + labelR * Math.sin(tickAngleRad);
    ticks.push({ n, x, y, labelX, labelY, angleDeg: tickAngleDeg });
  }
  return ticks;
}

function buildMinorTicks() {
  const ticks: { x: number; y: number; angleDeg: number }[] = [];
  for (let n = 1; n < 11; n++) {
    for (let m = 1; m <= 2; m++) {
      const fraction = ((n - 1) + m / 3) / 10;
      const angleDeg = ARC_START_DEG + fraction * 220;
      const angleRad = ((angleDeg - 90) * Math.PI) / 180;
      const outerR = RADIUS + 4;
      const x = CX + outerR * Math.cos(angleRad);
      const y = CY + outerR * Math.sin(angleRad);
      ticks.push({ x, y, angleDeg });
    }
  }
  return ticks;
}

const MAJOR_TICKS = buildTicks();
const MINOR_TICKS = buildMinorTicks();

// ─── Component ────────────────────────────────────────────────────────────────

export default function StokeOMeter({ score, isDarkMode = false }: StokeOMeterProps) {
  const clamped = clampScore(score);
  const targetAngle = scoreToAngle(clamped);
  const needleAngle = useSharedValue(targetAngle);

  useEffect(() => {
    console.log('[StokeOMeter] score changed:', clamped, '→ angle:', targetAngle);
    needleAngle.value = withSpring(targetAngle, {
      damping: 12,
      stiffness: 90,
      mass: 0.8,
    });
  }, [targetAngle, needleAngle, clamped]);

  const needleColor = getNeedleColor(clamped);
  const readoutColor = getReadoutColor(clamped);
  const scoreDisplay = clamped.toFixed(1);
  const cardBg = isDarkMode ? '#1E293B' : '#F8FAFC';
  const monoFont = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

  const needleAnimStyle = useAnimatedStyle(() => {
    const angleDeg = needleAngle.value;
    // Needle pivot is at bottom center. We position the needle so its bottom
    // center sits at (CX, CY), then rotate around that point.
    return {
      transform: [
        { translateY: NEEDLE_LENGTH / 2 },
        { rotate: `${angleDeg}deg` },
        { translateY: -NEEDLE_LENGTH / 2 },
      ],
    };
  });

  return (
    <View style={[gaugeStyles.card, { backgroundColor: cardBg }]}>
      {/* Header */}
      <Text style={gaugeStyles.header}>Stoke-O-Meter</Text>

      {/* Gauge canvas */}
      <View style={gaugeStyles.canvas}>

        {/* Arc segments */}
        {ARC_SEGMENTS.map((seg) => {
          const color = getBandColor(seg.score, seg.index);
          return (
            <View
              key={`seg-${seg.index}`}
              style={{
                position: 'absolute',
                left: seg.x - 3,
                top: seg.y - 3,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: color,
                opacity: 0.9,
              }}
            />
          );
        })}

        {/* Minor tick marks */}
        {MINOR_TICKS.map((tick, i) => {
          const angleRad = ((tick.angleDeg - 90) * Math.PI) / 180;
          const innerR = RADIUS - 5;
          const ix = CX + innerR * Math.cos(angleRad);
          const iy = CY + innerR * Math.sin(angleRad);
          const dx = tick.x - ix;
          const dy = tick.y - iy;
          const len = Math.sqrt(dx * dx + dy * dy);
          const rotDeg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
          return (
            <View
              key={`minor-${i}`}
              style={{
                position: 'absolute',
                left: ix + dx / 2 - 1,
                top: iy + dy / 2 - len / 2,
                width: 2,
                height: len,
                backgroundColor: isDarkMode ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.35)',
                transform: [{ rotate: `${rotDeg}deg` }],
              }}
            />
          );
        })}

        {/* Major tick marks */}
        {MAJOR_TICKS.map((tick) => {
          const angleRad = ((tick.angleDeg - 90) * Math.PI) / 180;
          const innerR = RADIUS - 8;
          const ix = CX + innerR * Math.cos(angleRad);
          const iy = CY + innerR * Math.sin(angleRad);
          const dx = tick.x - ix;
          const dy = tick.y - iy;
          const len = Math.sqrt(dx * dx + dy * dy);
          const rotDeg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
          const tickColor = getBandColor(tick.n, tick.n);
          return (
            <View
              key={`major-${tick.n}`}
              style={{
                position: 'absolute',
                left: ix + dx / 2 - 1.5,
                top: iy + dy / 2 - len / 2,
                width: 3,
                height: len,
                backgroundColor: tickColor,
                opacity: 0.85,
                transform: [{ rotate: `${rotDeg}deg` }],
              }}
            />
          );
        })}

        {/* Number labels */}
        {MAJOR_TICKS.map((tick) => {
          const labelColor = getBandColor(tick.n, tick.n);
          return (
            <Text
              key={`label-${tick.n}`}
              style={{
                position: 'absolute',
                left: tick.labelX - 8,
                top: tick.labelY - 7,
                width: 16,
                height: 14,
                textAlign: 'center',
                fontSize: 9,
                fontWeight: '700',
                color: labelColor,
                opacity: 0.9,
              }}
            >
              {tick.n}
            </Text>
          );
        })}

        {/* Needle */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: CX - NEEDLE_WIDTH / 2,
              top: CY - NEEDLE_LENGTH,
              width: NEEDLE_WIDTH,
              height: NEEDLE_LENGTH,
              borderRadius: NEEDLE_WIDTH / 2,
              backgroundColor: needleColor,
              transformOrigin: `${NEEDLE_WIDTH / 2}px ${NEEDLE_LENGTH}px`,
            },
            needleAnimStyle,
          ]}
        />

        {/* Pivot hub — outer ring */}
        <View
          style={{
            position: 'absolute',
            left: CX - HUB_SIZE / 2,
            top: CY - HUB_SIZE / 2,
            width: HUB_SIZE,
            height: HUB_SIZE,
            borderRadius: HUB_SIZE / 2,
            borderWidth: 2.5,
            borderColor: needleColor,
            backgroundColor: cardBg,
          }}
        />

        {/* Digital readout box */}
        <View
          style={[
            gaugeStyles.readout,
            { top: CY + HUB_SIZE / 2 + 8 },
          ]}
        >
          <Text
            style={[
              gaugeStyles.readoutText,
              { color: readoutColor, fontFamily: monoFont },
            ]}
          >
            {scoreDisplay}
          </Text>
        </View>

      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const gaugeStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  header: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#94A3B8',
    marginBottom: 4,
  },
  canvas: {
    width: CARD_WIDTH,
    height: 95,
    position: 'relative',
    alignSelf: 'center',
  },
  readout: {
    position: 'absolute',
    left: CX - 32,
    width: 64,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    alignItems: 'center',
  },
  readoutText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
