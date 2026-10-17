import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useColors } from '../design/theme';

export interface PhotoProps {
  /** Darkens the bottom so text laid over the photo stays readable. */
  scrim?: boolean;
  style?: StyleProp<ViewStyle>;
  uri: string | null;
}

/** Cached, fading-in remote photo. A flat warm tile shows while loading or when there is no image. */
export function Photo({ scrim = false, style, uri }: PhotoProps) {
  const colors = useColors();

  return (
    <View style={[{ backgroundColor: colors.line, overflow: 'hidden' }, style]}>
      {uri ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          recyclingKey={uri}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          transition={220}
        />
      ) : null}
      {scrim ? (
        <LinearGradient
          colors={['rgba(30,14,8,0)', 'rgba(30,14,8,0.62)']}
          locations={[0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}
