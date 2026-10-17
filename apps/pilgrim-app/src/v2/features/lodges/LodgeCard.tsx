import { StyleSheet, View } from 'react-native';

import type { CatalogLodgeCard } from '../../core/catalog';
import { useColors } from '../../design/theme';
import { elevation, radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { formatDistance, formatRupees, strings } from '../../i18n/strings';
import { Icon } from '../../ui/Icon';
import { Photo } from '../../ui/Photo';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';

export interface LodgeCardProps {
  card: CatalogLodgeCard;
  onPress: (lodgeId: string) => void;
  /** Fixed width for horizontal rails; omit to fill the parent (vertical lists). */
  width?: number;
}

export function LodgeCard({ card, onPress, width }: LodgeCardProps) {
  const colors = useColors();
  const { lang, t } = useLang();

  return (
    <PressableScale
      accessibilityLabel={card.name}
      style={[
        styles.card,
        elevation.card,
        { backgroundColor: colors.surface, width: width ?? '100%' },
      ]}
      onPress={() => onPress(card.id)}
    >
      <View>
        <Photo style={styles.photo} uri={card.coverUrl} />
        {card.averageRating !== null ? (
          <View style={[styles.rating, { backgroundColor: colors.surface }]}>
            <Icon color="star" name="star" size={13} />
            <Text variant="label">{card.averageRating.toFixed(1)}</Text>
            <Text color="inkMuted" variant="caption">
              ({card.reviewCount})
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} variant="heading">
          {card.name}
        </Text>
        {card.distanceFromTempleMeters !== null ? (
          <View style={styles.meta}>
            <Icon color="inkMuted" name="map-pin" size={14} />
            <Text color="inkMuted" variant="caption">
              {formatDistance(card.distanceFromTempleMeters, lang)} {t(strings.fromTemple)}
            </Text>
          </View>
        ) : null}
        {card.startingPrice !== null ? (
          <View style={styles.priceRow}>
            <Text color="inkMuted" variant="caption">
              {t(strings.startingFrom)}
            </Text>
            <Text color="primary" variant="price">
              {formatRupees(card.startingPrice)}
            </Text>
            <Text color="inkMuted" variant="caption">
              {t(strings.perNight)}
            </Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xs, padding: space.lg },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  meta: { alignItems: 'center', flexDirection: 'row', gap: space.xs },
  photo: { aspectRatio: 4 / 3, width: '100%' },
  priceRow: { alignItems: 'baseline', flexDirection: 'row', gap: space.xs, marginTop: space.xs },
  rating: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: space.xs,
    left: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    position: 'absolute',
    top: space.md,
  },
});
