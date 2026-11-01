import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { LodgeDetails } from '@tuljai/types';
import { AppScreen } from '@tuljai/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Linking, StyleSheet, View } from 'react-native';
import { Button, Card, List, Text, useTheme } from 'react-native-paper';

import { useAuth } from '../../../auth/auth-context';
import { FormErrorBanner } from '../../../components/FormErrorBanner';
import { useOwnerApp } from '../../../owner-ui/OwnerAppProvider';
import { ownerColors } from '../../../owner-ui/theme';
import { radius, spacing } from '../../../owner-ui/theme';
import { getOwnerLodgeDetails } from '../../lodge-management/api/owner-amenities-api';
import { useAssignedLodges } from '../../lodges/hooks/useAssignedLodges';
import { listOwnerPhotos } from '../../rooms/api/owner-rooms-api';

const appVersion = '0.1.0';

export function ProfileScreen() {
  const auth = useAuth();
  const assignedLodges = useAssignedLodges();
  const router = useRouter();
  const theme = useTheme();
  const { tr } = useOwnerApp();
  const displayName = auth.user?.displayName ?? auth.user?.phoneNumber ?? 'Owner';
  const [details, setDetails] = useState<LodgeDetails | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const lodgeId = assignedLodges.selectedLodge?.id;
  useEffect(() => {
    let current = true;
    setDetails(null);
    setCover(null);
    setProfileError(null);
    if (!lodgeId) return;
    void getOwnerLodgeDetails(lodgeId)
      .then((data) => {
        if (current) setDetails(data);
      })
      .catch(() => {
        if (current) setProfileError('Some lodge information could not be loaded.');
      });
    void listOwnerPhotos(lodgeId)
      .then((photos) => {
        const image = photos.find((photo) => photo.isCover && photo.approvalStatus === 'APPROVED');
        if (current) setCover(image ? (image.thumbnailUrl ?? image.fileUrl) : null);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [lodgeId]);
  const address = details?.address;
  const selectedLodgeName =
    assignedLodges.selectedLodge?.name ??
    (assignedLodges.isLoading ? 'Loading lodge…' : 'No lodge selected');

  return (
    <AppScreen scrollable style={styles.screen}>
      <Text variant="headlineSmall">{tr('Profile & Settings')}</Text>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          {cover ? (
            <Image
              accessibilityLabel={selectedLodgeName}
              source={{ uri: cover }}
              style={{ width: 64, height: 64, borderRadius: 32 }}
              onError={() => setCover(null)}
            />
          ) : (
            <MaterialCommunityIcons
              color={ownerColors.primary}
              name="home-city-outline"
              size={32}
            />
          )}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text variant="titleMedium">{selectedLodgeName}</Text>
          <Text style={{ color: ownerColors.primary }} variant="labelSmall">
            {tr('Lodge Owner')}
          </Text>
          {address ? (
            <Text style={{ color: ownerColors.muted }} variant="bodySmall">
              {address.city}, {address.state}
            </Text>
          ) : null}
        </View>
      </View>
      <FormErrorBanner message={assignedLodges.errorMessage ?? profileError} />
      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">{tr('Lodge Information')}</Text>
          {[
            { label: 'Lodge Name', value: selectedLodgeName },
            { label: 'Owner Name', value: displayName },
            {
              label: 'Phone',
              value:
                auth.user?.phoneNumber ??
                assignedLodges.selectedLodge?.primaryPhone ??
                'Not provided',
            },
            ...(details?.email ? [{ label: 'Email', value: details.email }] : []),
            ...(address
              ? [
                  {
                    label: 'Address',
                    value: [
                      address.addressLine1,
                      address.addressLine2,
                      address.city,
                      address.state,
                      address.pincode,
                    ]
                      .filter(Boolean)
                      .join(', '),
                  },
                ]
              : []),
          ].map((field) => (
            <View key={field.label} style={styles.infoRow}>
              <Text style={{ color: ownerColors.muted, flex: 0.8 }} variant="bodySmall">
                {tr(field.label)}
              </Text>
              <Text style={{ flex: 1.2, textAlign: 'right' }} variant="bodySmall">
                {field.value}
              </Text>
            </View>
          ))}
          <Text style={{ color: ownerColors.muted }} variant="bodySmall">
            {tr('Contact Tuljai Stays admin to update lodge or account details.')}
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.card}>
        <List.Item
          title={tr('Bank Details')}
          description={tr('Managed securely by Tuljai Stays admin')}
          left={(props) => <List.Icon {...props} color={ownerColors.primary} icon="bank-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() =>
            Alert.alert(
              tr('Bank Details'),
              tr(
                'Bank details are managed by Tuljai Stays admin. Contact support to request an update.',
              ),
            )
          }
        />
        <List.Item
          title={tr('Commission & Settlements')}
          description={tr('View commission, ledger and settlements')}
          left={(props) => (
            <List.Icon {...props} color={ownerColors.primary} icon="cash-multiple" />
          )}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/(app)/reports')}
        />
        <List.Item
          title={tr('Support')}
          description="tuljaistays@gmail.com"
          left={(props) => <List.Icon {...props} color={ownerColors.primary} icon="lifebuoy" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => {
            void Linking.openURL('mailto:tuljaistays@gmail.com').catch(() =>
              Alert.alert('Support', 'Email tuljaistays@gmail.com'),
            );
          }}
        />
        <List.Item
          title={tr('Terms & Privacy')}
          description={tr('App terms and data policy')}
          left={(props) => (
            <List.Icon {...props} color={ownerColors.primary} icon="shield-check-outline" />
          )}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push({ pathname: '/(app)/settings', params: { legal: 'terms' } })}
        />
        <List.Item
          title={tr('About Tuljai Stays')}
          description={`Version ${appVersion}`}
          left={(props) => (
            <List.Icon {...props} color={ownerColors.primary} icon="information-outline" />
          )}
          onPress={() =>
            Alert.alert(
              'Tuljai Stays · तुळजाई',
              `${tr('Comfort for the pilgrims. Growth for your lodge.')}\n${tr('Version')} ${appVersion}`,
            )
          }
        />
      </Card>

      <Card mode="outlined" style={styles.card}>
        <Card.Title title={tr('Reception & tools')} />
        <List.Item
          title={tr('Scan QR')}
          left={(props) => <List.Icon {...props} icon="qrcode-scan" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/(app)/scan')}
        />
        <List.Item
          title={tr('Upcoming Stays')}
          left={(props) => <List.Icon {...props} icon="calendar-clock-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/(app)/upcoming')}
        />
        <List.Item
          title={tr('Lodge Management')}
          description={tr('Amenities, categories, photos and pricing')}
          left={(props) => <List.Icon {...props} icon="home-edit-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push({ pathname: '/(app)/lodge', params: { tab: 'AMENITIES' } })}
        />
        <List.Item
          title={tr('Register Dashboard')}
          left={(props) => <List.Icon {...props} icon="book-open-variant" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/(app)/register-dashboard')}
        />
        <List.Item
          title={tr('Guest Reviews')}
          left={(props) => <List.Icon {...props} icon="star-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/(app)/reviews')}
        />
        <List.Item
          description="Completed, checked-out, cancelled and expired stays"
          left={(props) => <List.Icon {...props} icon="history" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          title={tr('Previous Bookings')}
          onPress={() => router.push('/(app)/previous-bookings')}
        />
        <List.Item
          left={(props) => <List.Icon {...props} icon="qrcode-scan" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          title={tr('QR Scan History')}
          onPress={() => router.push('/(app)/scan-history')}
        />
        <List.Item
          left={(props) => <List.Icon {...props} icon="bell-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          title={tr('Notifications')}
          onPress={() => router.push('/(app)/notifications')}
        />
        <List.Item
          left={(props) => <List.Icon {...props} icon="bullhorn-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          title={tr('Announcements')}
          onPress={() => router.push('/(app)/announcements')}
        />
        <List.Item
          left={(props) => <List.Icon {...props} icon="chart-box-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          title={tr('Reports')}
          onPress={() => router.push('/(app)/reports')}
        />
        <List.Item
          left={(props) => <List.Icon {...props} icon="cog-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          title={tr('Settings')}
          onPress={() => router.push('/(app)/settings')}
        />
      </Card>

      <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
        Contact Tuljai Stays admin for lodge assignment changes. App version {appVersion}
      </Text>

      <Button
        accessibilityLabel="Logout from owner app"
        icon="logout"
        mode="outlined"
        style={{ borderColor: ownerColors.primary, borderRadius: 12 }}
        contentStyle={{ minHeight: 48 }}
        onPress={() => {
          void auth.logout();
        }}
      >
        {tr('Logout')}
      </Button>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ownerColors.blush,
  },
  infoRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  card: {
    borderRadius: radius.sm,
  },
  cardContent: {
    gap: spacing.md,
  },
  screen: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
});
