import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';

interface StokeSpeedometerProps {
  rating: number; // 1–10
  size?: number;
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
  const color = getRatingColor(clampedRating);
  const needleRotation = useSharedValue(-180);

  // Map rating 1–10 to -180°..0° (top-half sweep: 9 o'clock → 12 o'clock → 3 o'clock)
  const targetAngle = interpolate(clampedRating, [1, 10], [-180, 0]);

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

  const halfSize = size / 2;
  const needleLength = halfSize * 0.72;
  const dotSize = size * 0.18;

  // Build tick marks for the arc (9 ticks across top half: 9 o'clock → 12 → 3 o'clock)
  const ticks = Array.from({ length: 9 }, (_, i) => {
    const angle = -180 + i * 22.5; // -180° to 0° in 22.5° steps
    const rad = (angle * Math.PI) / 180;
    const midR = halfSize * 0.80;
    const tickLen = size * 0.16;
    const tickWidth = size * 0.045;
    const cx = halfSize + midR * Math.cos(rad) - tickWidth / 2;
    const cy = halfSize + midR * Math.sin(rad) - tickLen / 2;
    const tickRating = Math.round(interpolate(i, [0, 8], [1, 10]));
    const tickColor = getRatingColor(tickRating);
    const isActive = tickRating <= clampedRating;
    return { cx, cy, tickColor, isActive, angle, tickLen, tickWidth };
  });

  const needleLeft = halfSize - size * 0.025;
  const needleTop = halfSize - needleLength;
  const needleWidth = size * 0.05;
  const needleBorderRadius = size * 0.025;
  const needleOriginX = size * 0.025;
  const dotLeft = halfSize - dotSize / 2;
  const dotTop = halfSize - dotSize / 2;
  const ratingFontSize = size * 0.22;
  const ratingBottom = size * 0.04;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Arc ticks rendered as thin rotated lines */}
      {ticks.map((tick, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: tick.cx,
            top: tick.cy,
            width: tick.tickWidth,
            height: tick.tickLen,
            borderRadius: tick.tickWidth / 2,
            backgroundColor: tick.isActive ? tick.tickColor : 'rgba(128,128,128,0.25)',
            transform: [{ rotate: `${tick.angle + 90}deg` }],
          }}
        />
      ))}

      {/* Needle — rotates from center */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: needleLeft,
            top: needleTop,
            width: needleWidth,
            height: needleLength,
            borderRadius: needleBorderRadius,
            backgroundColor: color,
            // @ts-expect-error — transformOrigin is valid in RN 0.73+ / Reanimated
            transformOrigin: `${needleOriginX}px ${needleLength}px`,
          },
          needleStyle,
        ]}
      />

      {/* Center dot */}
      <View
        style={{
          position: 'absolute',
          left: dotLeft,
          top: dotTop,
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: color,
        }}
      />

      {/* Rating number */}
      <Text
        style={{
          position: 'absolute',
          bottom: ratingBottom,
          alignSelf: 'center',
          color,
          fontSize: ratingFontSize,
          fontWeight: '800',
        }}
      >
        {clampedRating}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
