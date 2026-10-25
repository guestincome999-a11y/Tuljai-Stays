import type { Amenity, PropertyType } from '@tuljai/types';
import { radius, spacing } from '@tuljai/ui';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  Divider,
  Modal,
  Portal,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';

import type { LodgeFilters, LodgeSortOption } from '../types/lodge-discovery';

interface LodgeFilterSheetProps {
  amenities: Amenity[];
  filters: LodgeFilters;
  onApply: (filters: LodgeFilters) => void;
  onDismiss: () => void;
  visible: boolean;
}

const propertyTypes: Array<{ label: string; value: PropertyType | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Lodge', value: 'LODGE' },
  { label: 'Bhakt Niwas', value: 'BHAKT_NIWAS' },
  { label: 'Hotel', value: 'HOTEL' },
  { label: 'Dharamshala', value: 'DHARAMSHALA' },
];

const distanceOptions = [
  { label: 'Any', value: undefined },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
];

const priceOptions = [
  { label: 'Any', max: undefined },
  { label: 'Under Rs. 1000', max: 1000 },
  { label: 'Under Rs. 2000', max: 2000 },
  { label: 'Under Rs. 3000', max: 3000 },
];

const sortButtons: Array<{ label: string; value: LodgeSortOption }> = [
  { label: 'Distance', value: 'distance' },
  { label: 'Price', value: 'price' },
  { label: 'Newest', value: 'newest' },
];

export function LodgeFilterSheet({
  amenities,
  filters,
  onApply,
  onDismiss,
  visible,
}: LodgeFilterSheetProps) {
  const [draft, setDraft] = useState<LodgeFilters>(filters);
  const theme = useTheme();

  useEffect(() => {
    if (visible) {
      setDraft(filters);
    }
  }, [filters, visible]);

  const selectedPropertyType = draft.propertyType ?? 'ALL';

  return (
    <Portal>
      <Modal
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        dismissable
        onDismiss={onDismiss}
        visible={visible}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text variant="titleLarge">Filters</Text>
            <Button onPress={() => setDraft({ amenitySlugs: [], sort: 'distance' })}>Reset</Button>
          </View>

          <View style={styles.section}>
            <Text variant="titleSmall">Property type</Text>
            <View style={styles.chipRow}>
              {propertyTypes.map((item) => (
                <Chip
                  key={item.value}
                  mode={selectedPropertyType === item.value ? 'flat' : 'outlined'}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      propertyType: item.value === 'ALL' ? undefined : item.value,
                    }))
                  }
                >
                  {item.label}
                </Chip>
              ))}
            </View>
          </View>

          <Divider />

          <View style={styles.section}>
            <Text variant="titleSmall">Distance from temple</Text>
            <View style={styles.chipRow}>
              {distanceOptions.map((item) => (
                <Chip
                  key={item.label}
                  mode={draft.distanceMaxMeters === item.value ? 'flat' : 'outlined'}
                  onPress={() =>
                    setDraft((current) => ({ ...current, distanceMaxMeters: item.value }))
                  }
                >
                  {item.label}
                </Chip>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="titleSmall">Price</Text>
            <View style={styles.chipRow}>
              {priceOptions.map((item) => (
                <Chip
                  key={item.label}
                  mode={draft.priceMax === item.max ? 'flat' : 'outlined'}
                  onPress={() => setDraft((current) => ({ ...current, priceMax: item.max }))}
                >
                  {item.label}
                </Chip>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="titleSmall">Amenities</Text>
            <View style={styles.chipRow}>
              {amenities.slice(0, 10).map((amenity) => {
                const selected = draft.amenitySlugs.includes(amenity.slug);

                return (
                  <Chip
                    key={amenity.id}
                    mode={selected ? 'flat' : 'outlined'}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        amenitySlugs: selected
                          ? current.amenitySlugs.filter((slug) => slug !== amenity.slug)
                          : [...current.amenitySlugs, amenity.slug],
                      }))
                    }
                  >
                    {amenity.name}
                  </Chip>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="titleSmall">Sort by</Text>
            <SegmentedButtons
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  sort: isLodgeSortOption(value) ? value : current.sort,
                }))
              }
              value={draft.sort}
              buttons={sortButtons}
            />
          </View>

          <Button mode="contained" onPress={() => onApply(draft)}>
            Apply Filters
          </Button>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

function isLodgeSortOption(value: string): value is LodgeSortOption {
  return value === 'distance' || value === 'price' || value === 'rating' || value === 'newest';
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modal: {
    alignSelf: 'center',
    borderRadius: radius.sm,
    maxHeight: '86%',
    width: '92%',
  },
  section: {
    gap: spacing.sm,
  },
});
