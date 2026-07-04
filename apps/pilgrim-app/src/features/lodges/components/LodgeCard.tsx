import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radius, spacing } from '@tuljai/ui';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text, useTheme } from 'react-native-paper';

import { ResilientImage } from '../../../components/ResilientImage';
import type { LodgePreview } from '../types/lodge-discovery';

interface LodgeCardProps {
  lodgePreview: LodgePreview;
  onPress: () => void;
}

export function LodgeCard({ lodgePreview, onPress }: LodgeCardProps) {
  const theme = useTheme();
  const { amenities, coverPhotoUrl, lodge, roomTypePreview } = lodgePreview;
  const amenityPreview = amenities.slice(0, 3);

  return (
    <Card mode="outlined" onPress={onPress} style={styles.card}>
      {coverPhotoUrl ? (
        <ResilientImage
          accessibilityLabel={`${lodge.name} cover photo`}
          sourceUrl={coverPhotoUrl}
          style={styles.image}
        />
      ) : (
        <View style={[styles.placeholder, { backgroundColor: theme.colors.surfaceVariant }]}>
          <MaterialCommunityIcons color={theme.colors.primary} name="home-city-outline" size={40} />
        </View>
      )}
      <Card.Content style={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text numberOfLines={1} variant="titleMedium">
              {lodge.name}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
              {formatPropertyType(lodge.propertyType)}
            </Text>
          </View>
          <Chip compact icon="check-decagram" style={styles.verifiedChip}>
            Verified
          </Chip>
        </View>

        <View style={styles.metaRow}>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
            {formatDistance(lodge.distanceFromTempleMeters)}
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
            {roomTypePreview ? `From Rs. ${formatPrice(roomTypePreview.basePrice)}` : 'Price soon'}
          </Text>
        </View>

        {roomTypePreview ? (
          <Text variant="bodySmall">
            {roomTypePreview.name} · {roomTypePreview.capacityAdults} adults
            {roomTypePreview.capacityChildren > 0
              ? `, ${roomTypePreview.capacityChildren} children`
              : ''}
          </Text>
        ) : null}

        <View style={styles.amenities}>
          {amenityPreview.length > 0 ? (
            amenityPreview.map((amenity) => (
              <Chip compact key={amenity.id} style={styles.amenityChip}>
                {amenity.name}
              </Chip>
            ))
          ) : (
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
              Amenities will appear after owner updates.
            </Text>
          )}
        </View>

        <Button
          accessibilityLabel={`View details for ${lodge.name}`}
          accessibilityHint="Opens lodge photos, rooms, amenities, and booking options"
          mode="contained-tonal"
          onPress={onPress}
        >
          View Details
        </Button>
      </Card.Content>
    </Card>
  );
}

function formatDistance(distanceMeters: number | null): string {
  if (distanceMeters === null) {
    return 'Distance updating';
  }

  if (distanceMeters < 1000) {
    return `${distanceMeters} m from temple`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km from temple`;
}

function formatPrice(price: string): string {
  const parsed = Number(price);

  if (!Number.isFinite(parsed)) {
    return price;
  }

  return parsed.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatPropertyType(propertyType: string): string {
  return propertyType
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

const styles = StyleSheet.create({
  amenityChip: {
    borderRadius: radius.sm,
  },
  amenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  content: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  image: {
    aspectRatio: 16 / 9,
    width: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  placeholder: {
    alignItems: 'center',
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    width: '100%',
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  verifiedChip: {
    borderRadius: radius.sm,
  },
});
