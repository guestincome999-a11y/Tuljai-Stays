import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchLodge } from '../../core/catalog';
import { useCachedFetch } from '../../core/useCachedFetch';
import { useColors } from '../../design/theme';
import { elevation, gutter, radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import {
  detailStrings,
  formatDistance,
  formatRupees,
  propertyTypeOptions,
  strings,
} from '../../i18n/strings';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';

import { PhotoGallery } from './PhotoGallery';
import { ReviewList } from './ReviewList';
import { RoomTypeRow } from './RoomTypeRow';

export interface LodgeDetailScreenProps {
  lodgeId: string;
  onBack: () => void;
  onCheckAvailability: (lodgeId: string) => void;
}

export function LodgeDetailScreen({
  lodgeId,
  onBack,
  onCheckAvailability,
}: LodgeDetailScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { lang, t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const { data, loading, refresh } = useCachedFetch(`lodge:${lodgeId}`, () => fetchLodge(lodgeId));

  const backButton = (
    <PressableScale
      accessibilityLabel="Back"
      pressedScale={0.92}
      style={[styles.back, { backgroundColor: colors.surface, top: insets.top + space.md }]}
      onPress={onBack}
    >
      <Icon name="arrow-left" size={20} />
    </PressableScale>
  );

  if (!data) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {loading ? (
          <View style={{ paddingTop: insets.top + space.huge }}>
            <Skeleton height={260} rounded={0} />
            <View style={styles.skeletonBody}>
              <Skeleton height={32} width="70%" />
              <Skeleton height={18} width="45%" />
              <Skeleton height={90} />
            </View>
          </View>
        ) : (
          <View style={[styles.errorBox, { paddingTop: insets.top + space.huge }]}>
            <Text align="center">{t(detailStrings.loadError)}</Text>
            <Button
              label={t(detailStrings.tryAgain)}
              variant="secondary"
              onPress={() => void refresh()}
            />
          </View>
        )}
        {backButton}
      </View>
    );
  }

  const { lodge, photos, roomTypes } = data;
  const typeLabel = propertyTypeOptions.find((option) => option.id === lodge.propertyType)?.label;
  const startingPrice = roomTypes[0]?.basePrice ?? null;
  const description = lodge.description?.trim() ?? '';
  const longDescription = description.length > 220;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <PhotoGallery photos={photos} topInset={insets.top} />

        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.block}>
            {typeLabel ? (
              <Text color="accent" variant="label">
                {t(typeLabel)}
              </Text>
            ) : null}
            <Text variant="title">{lodge.name}</Text>
            <View style={styles.metaRow}>
              {lodge.averageRating !== null ? (
                <View style={styles.meta}>
                  <Icon color="star" name="star" size={15} />
                  <Text variant="label">{lodge.averageRating.toFixed(1)}</Text>
                  <Text color="inkMuted" variant="caption">
                    ({lodge.reviewCount})
                  </Text>
                </View>
              ) : null}
              {lodge.distanceFromTempleMeters !== null ? (
                <View style={styles.meta}>
                  <Icon color="inkMuted" name="map-pin" size={15} />
                  <Text color="inkMuted" variant="label">
                    {formatDistance(lodge.distanceFromTempleMeters, lang)} {t(strings.fromTemple)}
                  </Text>
                </View>
              ) : null}
            </View>
            {lodge.address ? (
              <Text color="inkMuted">
                {[lodge.address.addressLine1, lodge.address.landmark].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            {lodge.googleMapsLink ? (
              <PressableScale
                accessibilityLabel={t(detailStrings.directions)}
                onPress={() => void Linking.openURL(lodge.googleMapsLink ?? '')}
              >
                <View style={styles.meta}>
                  <Icon color="primary" name="navigation" size={15} />
                  <Text color="primary" variant="label">
                    {t(detailStrings.directions)}
                  </Text>
                </View>
              </PressableScale>
            ) : null}
          </View>

          {description.length > 0 ? (
            <View style={styles.block}>
              <Text numberOfLines={expanded ? undefined : 4}>{description}</Text>
              {longDescription ? (
                <PressableScale onPress={() => setExpanded((value) => !value)}>
                  <Text color="primary" variant="label">
                    {t(expanded ? detailStrings.readLess : detailStrings.readMore)}
                  </Text>
                </PressableScale>
              ) : null}
            </View>
          ) : null}

          {roomTypes.length > 0 ? (
            <View style={styles.block}>
              <Text variant="heading">{t(detailStrings.rooms)}</Text>
              {roomTypes.map((room) => (
                <RoomTypeRow key={room.id} room={room} />
              ))}
            </View>
          ) : null}

          {lodge.amenities.length > 0 ? (
            <View style={styles.block}>
              <Text variant="heading">{t(detailStrings.amenities)}</Text>
              <View style={styles.amenities}>
                {lodge.amenities.map((amenity) => (
                  <View
                    key={amenity.id}
                    style={[styles.amenity, { backgroundColor: colors.primarySoft }]}
                  >
                    <Icon color="primary" name="check" size={14} />
                    <Text variant="label">{amenity.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {lodge.checkInTime || lodge.checkOutTime ? (
            <View style={[styles.times, { backgroundColor: colors.surface }]}>
              {lodge.checkInTime ? (
                <View style={styles.time}>
                  <Text color="inkMuted" variant="caption">
                    {t(detailStrings.checkIn)}
                  </Text>
                  <Text variant="heading">{lodge.checkInTime}</Text>
                </View>
              ) : null}
              {lodge.checkOutTime ? (
                <View style={styles.time}>
                  <Text color="inkMuted" variant="caption">
                    {t(detailStrings.checkOut)}
                  </Text>
                  <Text variant="heading">{lodge.checkOutTime}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {lodge.rules ? (
            <View style={styles.block}>
              <Text variant="heading">{t(detailStrings.rules)}</Text>
              <Text color="inkMuted">{lodge.rules}</Text>
            </View>
          ) : null}

          <View style={styles.block}>
            <Text variant="heading">{t(detailStrings.reviews)}</Text>
            <ReviewList lodgeId={lodgeId} />
          </View>
        </View>
      </ScrollView>

      {backButton}

      <View
        style={[
          styles.bar,
          elevation.raised,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.md },
        ]}
      >
        <View>
          {startingPrice !== null ? (
            <>
              <Text color="inkMuted" variant="caption">
                {t(strings.startingFrom)}
              </Text>
              <Text color="primary" variant="price">
                {formatRupees(startingPrice)}
              </Text>
            </>
          ) : null}
        </View>
        <Button
          label={t(detailStrings.checkAvailability)}
          style={styles.cta}
          onPress={() => onCheckAvailability(lodgeId)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  amenity: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  back: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    left: gutter,
    position: 'absolute',
    width: 44,
  },
  bar: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    paddingHorizontal: gutter,
    paddingTop: space.md,
    position: 'absolute',
    right: 0,
  },
  block: { gap: space.md },
  cta: { flex: 1, marginLeft: space.xl },
  errorBox: { alignItems: 'center', gap: space.lg, paddingHorizontal: gutter },
  meta: { alignItems: 'center', flexDirection: 'row', gap: space.xs },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  screen: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    gap: space.xxl,
    marginTop: -space.xxl,
    paddingHorizontal: gutter,
    paddingTop: space.xxl,
  },
  skeletonBody: { gap: space.lg, padding: gutter },
  time: { flex: 1, gap: 2 },
  times: { borderRadius: radius.lg, flexDirection: 'row', padding: space.lg },
});
