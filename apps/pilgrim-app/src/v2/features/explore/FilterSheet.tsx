import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ExploreFilterOptions } from '../../core/exploreFilters';
import { useColors } from '../../design/theme';
import { gutter, radius, space } from '../../design/tokens';
import { accountStrings } from '../../i18n/accountStrings';
import { useLang } from '../../i18n/language';
import { exploreStrings } from '../../i18n/strings';
import { Button } from '../../ui/Button';
import { FilterChip } from '../../ui/FilterChip';
import { Text } from '../../ui/Text';

export interface FilterValues {
  amenities: string[];
  priceId: string | null;
  propertyType: string | null;
  savedOnly: boolean;
  sort: string;
}

const COPY = {
  apply: { en: 'Show stays', mr: 'निवास दाखवा' },
  amenities: { en: 'Amenities', mr: 'सुविधा' },
  price: { en: 'Price per night', mr: 'प्रति रात्र किंमत' },
  sort: { en: 'Sort by', mr: 'क्रमवारी' },
  title: { en: 'Filters', mr: 'फिल्टर' },
  type: { en: 'Stay type', mr: 'निवासाचा प्रकार' },
} as const;

/** Every filter in one bottom sheet, so the Explore screen itself stays clean. */
export function FilterSheet({
  onApply,
  onClose,
  onReset,
  options,
  value,
  visible,
}: {
  onApply: (next: FilterValues) => void;
  onClose: () => void;
  onReset: () => void;
  options: ExploreFilterOptions;
  value: FilterValues;
  visible: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [draft, setDraft] = useState<FilterValues>(value);

  function toggleAmenity(id: string) {
    setDraft((current) => ({
      ...current,
      amenities: current.amenities.includes(id)
        ? current.amenities.filter((item) => item !== id)
        : [...current.amenities, id],
    }));
  }

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
      onShow={() => setDraft(value)}
    >
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.background, paddingBottom: insets.bottom + space.lg },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.line }]} />
        <Text style={styles.title} variant="title">
          {t(COPY.title)}
        </Text>
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <Group label={t(COPY.sort)}>
            {options.sorts.map((option) => (
              <FilterChip
                key={option.id}
                label={t(option.label)}
                selected={draft.sort === option.id}
                onPress={() => setDraft((current) => ({ ...current, sort: option.id }))}
              />
            ))}
          </Group>
          <Group label={t(COPY.type)}>
            {options.propertyTypes.map((option) => (
              <FilterChip
                key={option.id}
                label={t(option.label)}
                selected={draft.propertyType === option.id}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    propertyType: current.propertyType === option.id ? null : option.id,
                  }))
                }
              />
            ))}
          </Group>
          <Group label={t(COPY.price)}>
            {options.prices.map((option) => (
              <FilterChip
                key={option.id}
                label={t(option.label)}
                selected={draft.priceId === option.id}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    priceId: current.priceId === option.id ? null : option.id,
                  }))
                }
              />
            ))}
          </Group>
          <Group label={t(COPY.amenities)}>
            {options.amenities.map((option) => (
              <FilterChip
                key={option.id}
                label={t(option.label)}
                selected={draft.amenities.includes(option.id)}
                onPress={() => toggleAmenity(option.id)}
              />
            ))}
          </Group>
          <Group label={t(accountStrings.savedFilter)}>
            <FilterChip
              label={t(accountStrings.savedFilter)}
              selected={draft.savedOnly}
              onPress={() => setDraft((current) => ({ ...current, savedOnly: !current.savedOnly }))}
            />
          </Group>
        </ScrollView>
        <View style={styles.actions}>
          <Button
            label={t(exploreStrings.clearFilters)}
            style={styles.actionHalf}
            variant="secondary"
            onPress={() => {
              onReset();
              onClose();
            }}
          />
          <Button
            label={t(COPY.apply)}
            style={styles.actionHalf}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function Group({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.group}>
      <Text color="inkMuted" variant="label">
        {label}
      </Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionHalf: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg, paddingHorizontal: gutter },
  backdrop: { backgroundColor: 'rgba(30,14,8,0.5)', flex: 1 },
  body: { gap: space.xl, paddingBottom: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  grabber: {
    alignSelf: 'center',
    borderRadius: radius.pill,
    height: 4,
    marginBottom: space.lg,
    width: 40,
  },
  group: { gap: space.sm },
  scroll: { maxHeight: 520, paddingHorizontal: gutter },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.md,
  },
  title: { marginBottom: space.md, paddingHorizontal: gutter },
});
