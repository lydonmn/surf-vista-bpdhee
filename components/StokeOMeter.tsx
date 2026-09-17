import { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

// ─── Props ────────────────────────────────────────────────────────────────────

export type StokeOMeterSize = 'normal' | 'compact' | 'badge';

interface StokeOMeterProps {
  score: number;   // 0–10 float, clamped to 1–11 internally
  isDarkMode?: boolean;
  size?: StokeOMeterSize;
}

// ─── Size constant sets ───────────────────────────────────────────────────────

interface SizeConfig {
  CARD_WIDTH: number;
  CX: number;
  CY: number;
  RADIUS: number;
  NEEDLE_LENGTH: number;
  HUB_SIZE: number;
  labelR: number;
  canvasHeight: number;
  readoutWidth: number;
  readoutFontSize: number;
  cardPadding: number;
  showHeader: boolean;
  cardBgTransparent: boolean;
}

const NORMAL_CONFIG: SizeConfig = {
  CARD_WIDTH: 180,
  CX: 90,
  CY: 82,
  RADIUS: 48,
  NEEDLE_LENGTH: 48 * 0.85,
  HUB_SIZE: 11,
  labelR: 48 - 16,
  canvasHeight: 95,
  readoutWidth: 64,
  readoutFontSize: 13,
  cardPadding: 12,
  showHeader: true,
  cardBgTransparent: false,
};

const COMPACT_CONFIG: SizeConfig = {
  CARD_WIDTH: 120,
  CX: 60,
  CY: 52,
  RADIUS: 32,
  NEEDLE_LENGTH: 32 * 0.85,
  HUB_SIZE: 8,
  labelR: 32 - 11,
  canvasHeight: 70,
  readoutWidth: 48,
  readoutFontSize: 10,
  cardPadding: 8,
  showHeader: false,
  cardBgTransparent: false,
};

const BADGE_CONFIG: SizeConfig = {
  CARD_WIDTH: 106,
  CX: 53,
  CY: 47,
  RADIUS: 28,
  NEEDLE_LENGTH: 28 * 0.85,
  HUB_SIZE: 7,
  labelR: 28 - 10,
  canvasHeight: 64,
  readoutWidth: 42,
  readoutFontSize: 9,
  cardPadding: 6,
  showHeader: false,
  cardBgTransparent: true,
};

function getSizeConfig(size: StokeOMeterSize): SizeConfig {
  if (size === 'compact') return COMPACT_CONFIG;
  if (size === 'badge') return BADGE_CONFIG;
  return NORMAL_CONFIG;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ARC_START_DEG = -110;
const NUM_SEGMENTS = 120;
const NEEDLE_WIDTH = 3;

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

// ─── Arc segments (parameterized) ─────────────────────────────────────────────

function buildArcSegments(cfg: SizeConfig) {
  const segments: { x: number; y: number; score: number; index: number }[] = [];
  for (let i = 0; i < NUM_SEGMENTS; i++) {
    const segFraction = i / NUM_SEGMENTS;
    const segScore = 1 + segFraction * 10;
    const segAngleDeg = ARC_START_DEG + segFraction * 220;
    const segAngleRad = ((segAngleDeg - 90) * Math.PI) / 180;
    const x = cfg.CX + cfg.RADIUS * Math.cos(segAngleRad);
    const y = cfg.CY + cfg.RADIUS * Math.sin(segAngleRad);
    segments.push({ x, y, score: segScore, index: i });
  }
  return segments;
}

// ─── Tick marks (parameterized) ───────────────────────────────────────────────

function buildTicks(cfg: SizeConfig) {
  const ticks: { n: number; x: number; y: number; labelX: number; labelY: number; angleDeg: number }[] = [];
  for (let n = 1; n <= 11; n++) {
    const tickFraction = (n - 1) / 10;
    const tickAngleDeg = ARC_START_DEG + tickFraction * 220;
    const tickAngleRad = ((tickAngleDeg - 90) * Math.PI) / 180;
    const outerR = cfg.RADIUS + 4;
    const x = cfg.CX + outerR * Math.cos(tickAngleRad);
    const y = cfg.CY + outerR * Math.sin(tickAngleRad);
    const labelX = cfg.CX + cfg.labelR * Math.cos(tickAngleRad);
    const labelY = cfg.CY + cfg.labelR * Math.sin(tickAngleRad);
    ticks.push({ n, x, y, labelX, labelY, angleDeg: tickAngleDeg });
  }
  return ticks;
}

function buildMinorTicks(cfg: SizeConfig) {
  const ticks: { x: number; y: number; angleDeg: number }[] = [];
  for (let n = 1; n < 11; n++) {
    for (let m = 1; m <= 2; m++) {
      const fraction = ((n - 1) + m / 3) / 10;
      const angleDeg = ARC_START_DEG + fraction * 220;
      const angleRad = ((angleDeg - 90) * Math.PI) / 180;
      const outerR = cfg.RADIUS + 4;
      const x = cfg.CX + outerR * Math.cos(angleRad);
      const y = cfg.CY + outerR * Math.sin(angleRad);
      ticks.push({ x, y, angleDeg });
    }
  }
  return ticks;
}

// ─── Pre-built normal-size data (module-level for perf) ───────────────────────

const NORMAL_ARC = buildArcSegments(NORMAL_CONFIG);
const NORMAL_MAJOR = buildTicks(NORMAL_CONFIG);
const NORMAL_MINOR = buildMinorTicks(NORMAL_CONFIG);

const COMPACT_ARC = buildArcSegments(COMPACT_CONFIG);
const COMPACT_MAJOR = buildTicks(COMPACT_CONFIG);
const COMPACT_MINOR = buildMinorTicks(COMPACT_CONFIG);

const BADGE_ARC = buildArcSegments(BADGE_CONFIG);
const BADGE_MAJOR = buildTicks(BADGE_CONFIG);
const BADGE_MINOR = buildMinorTicks(BADGE_CONFIG);

function getPrebuilt(size: StokeOMeterSize) {
  if (size === 'compact') return { arc: COMPACT_ARC, major: COMPACT_MAJOR, minor: COMPACT_MINOR };
  if (size === 'badge') return { arc: BADGE_ARC, major: BADGE_MAJOR, minor: BADGE_MINOR };
  return { arc: NORMAL_ARC, major: NORMAL_MAJOR, minor: NORMAL_MINOR };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StokeOMeter({ score, isDarkMode = false, size = 'normal' }: StokeOMeterProps) {
  const cfg = getSizeConfig(size);
  const { arc, major, minor } = getPrebuilt(size);

  const clamped = clampScore(score);
  const targetAngle = scoreToAngle(clamped);
  const needleAngle = useSharedValue(targetAngle);

  useEffect(() => {
    console.log('[StokeOMeter] score changed:', clamped, '→ angle:', targetAngle, 'size:', size);
    needleAngle.value = withSpring(targetAngle, {
      damping: 12,
      stiffness: 90,
      mass: 0.8,
    });
  }, [targetAngle, needleAngle, clamped, size]);

  const needleColor = getNeedleColor(clamped);
  const readoutColor = getReadoutColor(clamped);
  const scoreDisplay = clamped.toFixed(1);
  const cardBg = cfg.cardBgTransparent
    ? 'transparent'
    : isDarkMode ? '#1E293B' : '#F8FAFC';
  const monoFont = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

  const needleAnimStyle = useAnimatedStyle(() => {
    const angleDeg = needleAngle.value;
    return {
      transform: [
        { translateY: cfg.NEEDLE_LENGTH / 2 },
        { rotate: `${angleDeg}deg` },
        { translateY: -cfg.NEEDLE_LENGTH / 2 },
      ],
    };
  });

  const dotSize = size === 'badge' ? 4 : size === 'compact' ? 5 : 6;
  const labelFontSize = size === 'badge' ? 7 : size === 'compact' ? 8 : 9;

  return (
    <View style={[
      gaugeStyles.card,
      {
        backgroundColor: cardBg,
        padding: cfg.cardPadding,
        marginBottom: cfg.cardBgTransparent ? 0 : 12,
      },
    ]}>
      {/* Header — only shown in normal size */}
      {cfg.showHeader && (
        <Text style={gaugeStyles.header}>Stoke-O-Meter</Text>
      )}

      {/* Gauge canvas */}
      <View style={[gaugeStyles.canvas, { width: cfg.CARD_WIDTH, height: cfg.canvasHeight }]}>

        {/* Arc segments */}
        {arc.map((seg) => {
          const color = getBandColor(seg.score, seg.index);
          return (
            <View
              key={`seg-${seg.index}`}
              style={{
                position: 'absolute',
                left: seg.x - dotSize / 2,
                top: seg.y - dotSize / 2,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: color,
                opacity: 0.9,
              }}
            />
          );
        })}

        {/* Minor tick marks */}
        {minor.map((tick, i) => {
          const angleRad = ((tick.angleDeg - 90) * Math.PI) / 180;
          const innerR = cfg.RADIUS - 5;
          const ix = cfg.CX + innerR * Math.cos(angleRad);
          const iy = cfg.CY + innerR * Math.sin(angleRad);
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
        {major.map((tick) => {
          const angleRad = ((tick.angleDeg - 90) * Math.PI) / 180;
          const innerR = cfg.RADIUS - 8;
          const ix = cfg.CX + innerR * Math.cos(angleRad);
          const iy = cfg.CY + innerR * Math.sin(angleRad);
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
        {major.map((tick) => {
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
                fontSize: labelFontSize,
                fontWeight: '700',
                color: labelColor,
                opacity: 0.9,
              }}
            >
              {tick.n}
            </Text>
          );
        })}

        {/* Pivot hub — outer ring (rendered before needle so needle draws on top) */}
        <View
          style={{
            position: 'absolute',
            left: cfg.CX - cfg.HUB_SIZE / 2,
            top: cfg.CY - cfg.HUB_SIZE / 2,
            width: cfg.HUB_SIZE,
            height: cfg.HUB_SIZE,
            borderRadius: cfg.HUB_SIZE / 2,
            borderWidth: 2,
            borderColor: needleColor,
            backgroundColor: cardBg,
          }}
        />

        {/* Needle */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: cfg.CX - NEEDLE_WIDTH / 2,
              top: cfg.CY - cfg.NEEDLE_LENGTH,
              width: NEEDLE_WIDTH,
              height: cfg.NEEDLE_LENGTH,
              borderRadius: NEEDLE_WIDTH / 2,
              backgroundColor: needleColor,
              transformOrigin: `${NEEDLE_WIDTH / 2}px ${cfg.NEEDLE_LENGTH}px`,
            },
            needleAnimStyle,
          ]}
        />

        {/* Pivot center dot — drawn on top of needle base */}
        <View
          style={{
            position: 'absolute',
            left: cfg.CX - 3,
            top: cfg.CY - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: needleColor,
          }}
        />

        {/* Digital readout box */}
        <View
          style={{
            position: 'absolute',
            left: cfg.CX - cfg.readoutWidth / 2,
            top: cfg.CY + cfg.HUB_SIZE / 2 + 6,
            width: cfg.readoutWidth,
            paddingVertical: 3,
            paddingHorizontal: 4,
            backgroundColor: '#0F172A',
            borderRadius: 5,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: cfg.readoutFontSize,
              fontWeight: '700',
              color: readoutColor,
              fontFamily: monoFont,
            }}
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
    position: 'relative',
    alignSelf: 'center',
  },
});
