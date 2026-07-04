import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useLocalSearchParams } from 'expo-router';
import { Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, Chip, Text, useTheme } from 'react-native-paper';

import { useLodgeDetails } from '../hooks/useLodgeDiscovery';

export function LodgeDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const lodgeId = typeof params.id === 'string' ? params.id : null;
  const lodgeDetails = useLodgeDetails(lodgeId);
  const theme = useTheme();
  const data = lodgeDetails.data;
  const coverPhoto = data?.photos.find((photo) => photo.isCover) ?? data?.photos[0] ?? null;

  if (lodgeDetails.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  if (lodgeDetails.errorMessage || !data) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Lodge unavailable"
          description={lodgeDetails.errorMessage ?? 'This lodge could not be opened.'}
          actionLabel="Retry"
          onActionPress={() => {
            void lodgeDetails.refresh();
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void lodgeDetails.refresh();
          }}
          refreshing={lodgeDetails.isRefreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      {coverPhoto ? (
        <Image source={{ uri: coverPhoto.fileUrl }} style={styles.heroImage} />
      ) : (
        <View style={[styles.heroPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
          <MaterialCommunityIcons color={theme.colors.primary} name="home-city-outline" size={48} />
        </View>
      )}

      <View style={styles.titleBlock}>
        <Chip icon="check-decagram" style={styles.verifiedChip}>
          Verified
        </Chip>
        <Text variant="headlineSmall">{data.details.name}</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
          {formatDistance(data.details.distanceFromTempleMeters)}
        </Text>
        {data.details.description ? (
          <Text variant="bodyMedium">{data.details.description}</Text>
        ) : null}
      </View>

      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Room Preview</Text>
          {data.roomTypes.length > 0 ? (
            data.roomTypes.slice(0, 3).map((roomType) => (
              <View key={roomType.id} style={styles.roomRow}>
                <View style={styles.roomText}>
                  <Text variant="titleSmall">{roomType.name}</Text>
                  <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
                    {roomType.capacityAdults} adults
                    {roomType.capacityChildren > 0 ? `, ${roomType.capacityChildren} children` : ''}
                  </Text>
                </View>
                <Text variant="titleSmall">Rs. {formatPrice(roomType.basePrice)}</Text>
              </View>
            ))
          ) : (
            <Text variant="bodyMedium">Room details will appear after owner updates.</Text>
          )}
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Amenities</Text>
          <View style={styles.chipRow}>
            {data.details.amenities.length > 0 ? (
              data.details.amenities.map((amenity) => <Chip key={amenity.id}>{amenity.name}</Chip>)
            ) : (
              <Text variant="bodyMedium">Amenities are not listed yet.</Text>
            )}
          </View>
        </Card.Content>
      </Card>

      {data.details.address ? (
        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Location</Text>
            <Text variant="bodyMedium">
              {[
                data.details.address.addressLine1,
                data.details.address.landmark,
                data.details.address.city,
                data.details.address.pincode,
              ]
                .filter(Boolean)
                .join(', ')}
            </Text>
          </Card.Content>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function formatDistance(distanceMeters: number | null): string {
  if (distanceMeters === null) {
    return 'Distance updating';
  }

  if (distanceMeters < 1000) {
    return `${distanceMeters} m from Tuljapur temple`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km from Tuljapur temple`;
}

function formatPrice(price: string): string {
  const parsed = Number(price);

  if (!Number.isFinite(parsed)) {
    return price;
  }

  return parsed.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
  },
  cardContent: {
    gap: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroImage: {
    aspectRatio: 16 / 10,
    borderRadius: radius.sm,
    width: '100%',
  },
  heroPlaceholder: {
    alignItems: 'center',
    aspectRatio: 16 / 10,
    borderRadius: radius.sm,
    justifyContent: 'center',
    width: '100%',
  },
  roomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  roomText: {
    flex: 1,
    gap: spacing.xs,
  },
  screen: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  verifiedChip: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
  },
});
