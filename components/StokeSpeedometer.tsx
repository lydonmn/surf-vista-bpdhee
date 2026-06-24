import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
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

// Tighter sweep: 10 o'clock → 12 → 2 o'clock (140° span).
// Keeps all ticks well above the rating number, no extreme horizontal ticks.
const ARC_START = -160; // degrees (just past 10 o'clock)
const ARC_END = -20;    // degrees (just past 2 o'clock)
const TICK_COUNT = 8;
const ARC_SPAN = ARC_END - ARC_START; // 140°

export default function StokeSpeedometer({ rating, size = 44 }: StokeSpeedometerProps) {
  const clampedRating = Math.max(1, Math.min(10, rating));
  const color = getRatingColor(clampedRating);

  // Map rating 1–10 to ARC_START..ARC_END
  const targetAngle = ARC_START + ((clampedRating - 1) / 9) * ARC_SPAN;
  const needleRotation = useSharedValue(ARC_START);

  useEffect(() => {
    needleRotation.value = withSpring(targetAngle, {
      damping: 14,
      stiffness: 110,
      mass: 0.7,
    });
    console.log('[StokeSpeedometer] rating changed', { rating: clampedRating, targetAngle });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedRating]);

  const halfSize = size / 2;
  const needleLength = halfSize * 0.62;
  const needleWidth = size * 0.06;
  const dotSize = size * 0.16;
  const arcRadius = halfSize * 0.78;
  const tickLen = size * 0.14;
  const tickWidth = size * 0.04;

  // The needle is a bar whose BOTTOM sits at the gauge center.
  // Rotate around its bottom edge using the translateY sandwich trick:
  //   1. translate up by needleLength/2 (moves rotation origin to bottom of bar)
  //   2. rotate
  //   3. translate back down by needleLength/2
  const needleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: needleLength / 2 },
      { rotate: `${needleRotation.value}deg` },
      { translateY: -needleLength / 2 },
    ],
  }));

  // Build tick marks
  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const t = i / (TICK_COUNT - 1); // 0..1
    const angle = ARC_START + t * ARC_SPAN;
    const rad = (angle * Math.PI) / 180;
    const cx = halfSize + arcRadius * Math.cos(rad) - tickWidth / 2;
    const cy = halfSize + arcRadius * Math.sin(rad) - tickLen / 2;
    const tickRating = 1 + t * 9; // 1..10
    const tickColor = getRatingColor(Math.round(tickRating));
    const isActive = tickRating <= clampedRating + 0.5;
    return { cx, cy, tickColor, isActive, angle };
  });

  const ratingFontSize = size * 0.26;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Tick marks across the top arc */}
      {ticks.map((tick, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: tick.cx,
            top: tick.cy,
            width: tickWidth,
            height: tickLen,
            borderRadius: tickWidth / 2,
            backgroundColor: tick.isActive ? tick.tickColor : 'rgba(128,128,128,0.22)',
            transform: [{ rotate: `${tick.angle + 90}deg` }],
          }}
        />
      ))}

      {/* Needle bar — bottom edge sits at gauge center, rotates around that point */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: halfSize - needleWidth / 2,
            top: halfSize - needleLength,
            width: needleWidth,
            height: needleLength,
            borderRadius: needleWidth / 2,
            backgroundColor: color,
          },
          needleStyle,
        ]}
      />

      {/* Center dot — sits on top of the needle base */}
      <View
        style={{
          position: 'absolute',
          left: halfSize - dotSize / 2,
          top: halfSize - dotSize / 2,
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: color,
        }}
      />

      {/* Rating number — anchored well below center, outside the arc footprint */}
      <Text
        style={{
          position: 'absolute',
          bottom: -size * 0.04,
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
    overflow: 'visible',
  },
});
