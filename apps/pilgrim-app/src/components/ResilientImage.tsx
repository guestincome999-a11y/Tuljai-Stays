import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing } from '@tuljai/ui';
import { useState } from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import { ActivityIndicator, useTheme } from 'react-native-paper';

interface ResilientImageProps {
  accessibilityLabel: string;
  sourceUrl: string | null;
  style: StyleProp<ImageStyle>;
}

export function ResilientImage({ accessibilityLabel, sourceUrl, style }: ResilientImageProps) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(sourceUrl));
  const theme = useTheme();

  if (!sourceUrl || failed) {
    return (
      <View
        accessibilityLabel={`${accessibilityLabel} placeholder`}
        style={[style, styles.placeholder, { backgroundColor: theme.colors.surfaceVariant }]}
      >
        <MaterialCommunityIcons color={theme.colors.primary} name="image-off-outline" size={36} />
      </View>
    );
  }

  return (
    <View style={style}>
      <Image
        accessibilityLabel={accessibilityLabel}
        onError={() => {
          setFailed(true);
          setLoading(false);
        }}
        onLoadEnd={() => setLoading(false)}
        source={{ uri: sourceUrl }}
        style={styles.image}
      />
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator animating />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    height: '100%',
    width: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: spacing.md,
  },
});
