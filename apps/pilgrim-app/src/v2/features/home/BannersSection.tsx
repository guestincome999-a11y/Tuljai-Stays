import type { PromotionalBanner } from '@tuljai/types';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { gutter, radius, space } from '../../design/tokens';
import { Photo } from '../../ui/Photo';
import { Text } from '../../ui/Text';

function isBanner(value: unknown): value is PromotionalBanner {
  if (typeof value !== 'object' || value === null) return false;
  const banner = value as Partial<PromotionalBanner>;
  return (
    typeof banner.id === 'string' &&
    typeof banner.title === 'string' &&
    typeof banner.imageUrl === 'string' &&
    /^https:\/\//iu.test(banner.imageUrl) &&
    banner.isActive === true &&
    typeof banner.sortOrder === 'number'
  );
}

/** Festival and promotion banners come from the admin panel's promotional banner setting. */
export function BannersSection({ settings }: { settings: Record<string, unknown> }) {
  const { width } = useWindowDimensions();
  const banners = useMemo(() => {
    const raw = settings['promotional_banners'];
    if (!Array.isArray(raw)) return [];
    const now = Date.now();
    return raw
      .filter(isBanner)
      .filter((banner) => {
        const starts = banner.startsAt ? new Date(banner.startsAt).getTime() : null;
        const ends = banner.expiresAt ? new Date(banner.expiresAt).getTime() : null;
        return (starts === null || starts <= now) && (ends === null || ends > now);
      })
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }, [settings]);

  if (banners.length === 0) return null;

  const cardWidth = banners.length === 1 ? width - gutter * 2 : width - gutter * 2 - space.xl;

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={banners}
      decelerationRate="fast"
      horizontal
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      keyExtractor={(banner) => banner.id}
      renderItem={({ item }) => (
        <View style={[styles.card, { width: cardWidth }]}>
          <Photo scrim style={StyleSheet.absoluteFill} uri={item.imageUrl} />
          <Text color="onPrimary" numberOfLines={2} style={styles.title} variant="heading">
            {item.title}
          </Text>
        </View>
      )}
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + space.md}
    />
  );
}

const styles = StyleSheet.create({
  card: { aspectRatio: 16 / 8, borderRadius: radius.lg, overflow: 'hidden' },
  gap: { width: space.md },
  list: { paddingHorizontal: gutter },
  title: { bottom: space.lg, left: space.lg, position: 'absolute', right: space.lg },
});
