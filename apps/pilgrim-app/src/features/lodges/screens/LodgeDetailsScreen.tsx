import { MaterialCommunityIcons } from '@expo/vector-icons';
import { EmptyState, radius, spacing } from '@tuljai/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, useTheme } from 'react-native-paper';

import { ResilientImage } from '../../../components/ResilientImage';
import { useLodgeDetails } from '../hooks/useLodgeDiscovery';
import { saveRecentlyViewedLodge } from '../storage/recently-viewed-lodges';

export function LodgeDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const lodgeId = typeof params.id === 'string' ? params.id : null;
  const lodgeDetails = useLodgeDetails(lodgeId);
  const router = useRouter();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [fullScreenPhotoUrl, setFullScreenPhotoUrl] = useState<string | null>(null);
  const theme = useTheme();
  const window = useWindowDimensions();
  const data = lodgeDetails.data;
  const formattedAddress = data?.details.address ? formatAddress(data.details.address) : null;

  useEffect(() => {
    if (lodgeId) {
      void saveRecentlyViewedLodge(lodgeId);
    }
  }, [lodgeId]);

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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.screen}
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
        {data.photos.length > 0 ? (
          <View style={styles.galleryWrap}>
            <ScrollView
              horizontal
              onMomentumScrollEnd={(event) => {
                setActivePhotoIndex(Math.round(event.nativeEvent.contentOffset.x / window.width));
              }}
              pagingEnabled
              showsHorizontalScrollIndicator={false}
            >
              {data.photos.map((photo) => (
                <Button
                  contentStyle={styles.photoButtonContent}
                  key={photo.id}
                  onPress={() => setFullScreenPhotoUrl(photo.fileUrl)}
                  style={[styles.photoButton, { width: window.width - spacing.lg * 2 }]}
                >
                  <ResilientImage
                    accessibilityLabel={`${data.details.name} photo`}
                    sourceUrl={photo.fileUrl}
                    style={styles.heroImage}
                  />
                </Button>
              ))}
            </ScrollView>
            <Text style={styles.photoCounter} variant="labelMedium">
              {activePhotoIndex + 1}/{data.photos.length}
            </Text>
          </View>
        ) : (
          <View style={[styles.heroPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
            <MaterialCommunityIcons
              color={theme.colors.primary}
              name="home-city-outline"
              size={48}
            />
          </View>
        )}

        <View style={styles.titleBlock}>
          <View style={styles.chipRow}>
            <Chip icon="check-decagram" style={styles.verifiedChip}>
              Verified
            </Chip>
            <Chip>{formatPropertyType(data.details.propertyType)}</Chip>
          </View>
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
            <Text variant="titleMedium">Room Types</Text>
            {data.roomTypes.length > 0 ? (
              data.roomTypes.map((roomType) => (
                <View key={roomType.id} style={styles.roomRow}>
                  <View style={styles.roomText}>
                    <Text variant="titleSmall">{roomType.name}</Text>
                    <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
                      {roomType.capacityAdults} adults
                      {roomType.capacityChildren > 0
                        ? `, ${roomType.capacityChildren} children`
                        : ''}
                    </Text>
                  </View>
                  <Button
                    mode="contained-tonal"
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/bookings/new',
                        params: { lodgeId: data.details.id, roomTypeId: roomType.id },
                      })
                    }
                  >
                    Rs. {formatPrice(roomType.basePrice)}
                  </Button>
                </View>
              ))
            ) : (
              <Text variant="bodyMedium">Room details will appear after owner updates.</Text>
            )}
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Temple Darshan Information</Text>
            <Text variant="bodyMedium">Tulja Bhavani Temple</Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
              {formatDistance(data.details.distanceFromTempleMeters)}
            </Text>
            <Text variant="bodySmall">Please confirm timings locally during festival rush.</Text>
            <Button
              icon="directions"
              mode="contained-tonal"
              onPress={() => {
                void openDirections(data.details.name);
              }}
            >
              Open Directions
            </Button>
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Amenities</Text>
            <View style={styles.chipRow}>
              {data.details.amenities.length > 0 ? (
                data.details.amenities.map((amenity) => (
                  <Chip key={amenity.id}>{amenity.name}</Chip>
                ))
              ) : (
                <Text variant="bodyMedium">Amenities are not listed yet.</Text>
              )}
            </View>
          </Card.Content>
        </Card>

        {formattedAddress ? (
          <Card mode="outlined" style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium">Location</Text>
              <Text variant="bodyMedium">{formattedAddress}</Text>
              <Button
                mode="contained-tonal"
                onPress={() => {
                  void openDirections(formattedAddress);
                }}
              >
                Open in Maps
              </Button>
            </Card.Content>
          </Card>
        ) : null}

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Stay Rules</Text>
            <Text variant="bodyMedium">
              {data.details.rules ?? 'Rules will be confirmed by the lodge.'}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
              Check-in {data.details.checkInTime ?? 'as confirmed'} · Check-out{' '}
              {data.details.checkOutTime ?? 'as confirmed'}
            </Text>
          </Card.Content>
        </Card>

        <Card mode="outlined" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">Emergency Help</Text>
            <Text variant="bodyMedium">
              Police, ambulance, and temple help desk contacts are available soon.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: theme.colors.surface }]}>
        <Button
          disabled={data.roomTypes.length === 0}
          mode="contained"
          onPress={() =>
            router.push({ pathname: '/(app)/bookings/new', params: { lodgeId: data.details.id } })
          }
        >
          Check Availability
        </Button>
      </View>

      <Modal animationType="fade" visible={Boolean(fullScreenPhotoUrl)}>
        <View style={[styles.modal, { backgroundColor: theme.colors.background }]}>
          {fullScreenPhotoUrl ? (
            <ResilientImage
              accessibilityLabel={`${data.details.name} full screen photo`}
              sourceUrl={fullScreenPhotoUrl}
              style={styles.modalImage}
            />
          ) : null}
          <Button
            accessibilityLabel="Close full screen photo"
            mode="contained"
            onPress={() => setFullScreenPhotoUrl(null)}
          >
            Close
          </Button>
        </View>
      </Modal>
    </View>
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

function formatPropertyType(propertyType: string): string {
  return propertyType
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function formatAddress(address: {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  landmark: string | null;
  pincode: string;
}): string {
  return [
    address.addressLine1,
    address.addressLine2,
    address.landmark,
    address.city,
    address.pincode,
  ]
    .filter(Boolean)
    .join(', ');
}

async function openDirections(query: string): Promise<void> {
  const encodedQuery = encodeURIComponent(`${query} Tuljapur`);
  await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedQuery}`);
}

const styles = StyleSheet.create({
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
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
  container: {
    flex: 1,
  },
  galleryWrap: {
    position: 'relative',
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
  modal: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalImage: {
    aspectRatio: 3 / 4,
    borderRadius: radius.sm,
    width: '100%',
  },
  photoButton: {
    borderRadius: radius.sm,
  },
  photoButtonContent: {
    height: 'auto',
  },
  photoCounter: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: radius.full,
    bottom: spacing.sm,
    color: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    position: 'absolute',
    right: spacing.sm,
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
