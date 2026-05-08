import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';

interface StokeSpeedometerProps {
  rating: number; // 1–10
  size?: number;  // diameter in px, default 44
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function getRatingColor(rating: number): string {
  if (rating >= 9) return '#22C55E';
  if (rating >= 7) return '#84CC16';
  if (rating >= 5) return '#EAB308';
  if (rating >= 3) return '#F97316';
  return '#EF4444';
}

export default function StokeSpeedometer({ rating, size = 44 }: StokeSpeedometerProps) {
  const clampedRating = Math.max(1, Math.min(10, rating));
  const needleRotation = useSharedValue(-120);

  const targetAngle = interpolate(clampedRating, [1, 10], [-120, 120]);

  useEffect(() => {
    needleRotation.value = withSpring(targetAngle, {
      damping: 12,
      stiffness: 90,
      mass: 0.8,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedRating]);

  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${needleRotation.value}deg` }],
  }));

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeW = size * 0.09;
  const color = getRatingColor(clampedRating);

  const trackPath = arcPath(cx, cy, r, 210, 330);
  const fillEndAngle = interpolate(clampedRating, [1, 10], [210, 330]);
  const fillPath = arcPath(cx, cy, r, 210, fillEndAngle);

  const needleLength = r * 0.85;

  const ratingFontSize = size * 0.22;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track (grey arc) */}
        <Path
          d={trackPath}
          stroke="rgba(128,128,128,0.25)"
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
        />
        {/* Filled arc (colored) */}
        <Path
          d={fillPath}
          stroke={color}
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
          opacity={0.85}
        />
        {/* Center dot */}
        <Circle cx={cx} cy={cy} r={strokeW * 0.45} fill={color} />
      </Svg>

      {/* Animated needle overlay */}
      <Animated.View
        style={[
          styles.needleWrapper,
          { width: size, height: size },
          needleStyle,
        ]}
      >
        <Svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={StyleSheet.absoluteFill}
        >
          <Path
            d={`M ${cx} ${cy} L ${cx} ${cy - needleLength}`}
            stroke={color}
            strokeWidth={strokeW * 0.35}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      {/* Rating number below center */}
      <View style={[styles.labelWrapper, { bottom: size * 0.06 }]}>
        <Text style={[styles.ratingText, { color, fontSize: ratingFontSize }]}>
          {clampedRating}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  needleWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingText: {
    fontWeight: '800',
  },
});
