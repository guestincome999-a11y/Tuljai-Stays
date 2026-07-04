import { EmptyState, spacing } from '@tuljai/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Text, useTheme } from 'react-native-paper';

import { LodgeCard } from '../components/LodgeCard';
import { LodgeFilterSheet } from '../components/LodgeFilterSheet';
import { LodgeSearchBar } from '../components/LodgeSearchBar';
import { useLodgeList } from '../hooks/useLodgeDiscovery';
import type { LodgeFilters } from '../types/lodge-discovery';

export function LodgeListScreen() {
  const params = useLocalSearchParams<{ quick?: string; search?: string }>();
  const initialFilters = useMemo(() => filtersFromQuickParam(params.quick), [params.quick]);
  const initialSearch = typeof params.search === 'string' ? params.search : '';
  const lodges = useLodgeList(initialFilters, initialSearch);
  const router = useRouter();
  const [filterVisible, setFilterVisible] = useState(false);
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={lodges.data}
        keyExtractor={(item) => item.lodge.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="headlineSmall">Find a Stay</Text>
            <LodgeSearchBar onChangeSearch={lodges.setSearch} value={lodges.search} />
            <View style={styles.toolbar}>
              <Button
                icon="filter-variant"
                mode="contained-tonal"
                onPress={() => setFilterVisible(true)}
              >
                Filters
              </Button>
              <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
                Verified lodges only
              </Text>
            </View>
            {lodges.errorMessage ? (
              <Card mode="outlined" style={styles.statusCard}>
                <Card.Content style={styles.statusContent}>
                  <Text variant="titleMedium">Unable to load lodges</Text>
                  <Text variant="bodyMedium">{lodges.errorMessage}</Text>
                  <Button
                    mode="contained-tonal"
                    onPress={() => {
                      void lodges.refresh();
                    }}
                  >
                    Try Again
                  </Button>
                </Card.Content>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          lodges.isLoading ? (
            <ActivityIndicator animating size="large" />
          ) : (
            <EmptyState
              title="No lodges found"
              description="Try a different search or remove a few filters."
              actionLabel="Reset Filters"
              onActionPress={() => lodges.setFilters({ amenitySlugs: [], sort: 'distance' })}
            />
          )
        }
        ListFooterComponent={
          lodges.isLoadingMore ? <ActivityIndicator animating style={styles.footerLoader} /> : null
        }
        onEndReached={lodges.loadMore}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void lodges.refresh();
            }}
            refreshing={lodges.isRefreshing}
            tintColor={theme.colors.primary}
          />
        }
        renderItem={({ item }) => (
          <LodgeCard
            lodgePreview={item}
            onPress={() =>
              router.push({ pathname: '/(app)/lodges/[id]', params: { id: item.lodge.id } })
            }
          />
        )}
      />

      <LodgeFilterSheet
        amenities={lodges.amenities}
        filters={lodges.filters}
        onApply={(nextFilters) => {
          lodges.setFilters(nextFilters);
          setFilterVisible(false);
        }}
        onDismiss={() => setFilterVisible(false)}
        visible={filterVisible}
      />
    </View>
  );
}

function filtersFromQuickParam(quick: string | string[] | undefined): Partial<LodgeFilters> {
  const quickValue = Array.isArray(quick) ? quick[0] : quick;

  if (quickValue === 'near-temple') {
    return { distanceMaxMeters: 1000, sort: 'distance' };
  }

  if (quickValue === 'parking') {
    return { amenitySlugs: ['parking'], sort: 'distance' };
  }

  if (quickValue === 'ac') {
    return { amenitySlugs: ['ac'], sort: 'distance' };
  }

  if (quickValue === 'family') {
    return { amenitySlugs: ['family'], sort: 'distance' };
  }

  if (quickValue === 'budget') {
    return { priceMax: 1000, sort: 'price' };
  }

  if (quickValue === 'bhakt-niwas') {
    return { propertyType: 'BHAKT_NIWAS', sort: 'distance' };
  }

  return {};
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  footerLoader: {
    paddingVertical: spacing.lg,
  },
  header: {
    gap: spacing.md,
  },
  listContent: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  statusCard: {
    borderRadius: 8,
  },
  statusContent: {
    gap: spacing.sm,
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
});
