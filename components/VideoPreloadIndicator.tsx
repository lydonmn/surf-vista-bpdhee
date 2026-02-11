
import { View, Text, StyleSheet } from 'react-native';
import { IconSymbol } from './IconSymbol';

interface VideoPreloadIndicatorProps {
  isPreloaded: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function VideoPreloadIndicator({ isPreloaded, size = 'small' }: VideoPreloadIndicatorProps) {
  const iconSize = size === 'small' ? 12 : size === 'medium' ? 16 : 20;
  const fontSize = size === 'small' ? 10 : size === 'medium' ? 12 : 14;
  
  if (!isPreloaded) {
    return null;
  }

  const indicatorText = '⚡ Ready';

  return (
    <View style={[styles.container, styles[`container_${size}`]]}>
      <IconSymbol
        ios_icon_name="bolt.fill"
        android_material_icon_name="flash-on"
        size={iconSize}
        color="#FFD700"
      />
      <Text style={[styles.text, { fontSize }]}>
        {indicatorText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  container_small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  container_medium: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  container_large: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
});
