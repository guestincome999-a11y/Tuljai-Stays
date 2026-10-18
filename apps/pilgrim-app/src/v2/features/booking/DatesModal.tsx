import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '../../design/theme';
import { gutter, radius, space } from '../../design/tokens';
import { useLang } from '../../i18n/language';
import { bookingStrings } from '../../i18n/strings';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';

import { DateRangeCalendar } from './DateRangeCalendar';

export function DatesModal({
  checkIn,
  checkOut,
  onApply,
  onClose,
  visible,
}: {
  checkIn: string;
  checkOut: string;
  onApply: (checkIn: string, checkOut: string) => void;
  onClose: () => void;
  visible: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [draftIn, setDraftIn] = useState<string | null>(checkIn);
  const [draftOut, setDraftOut] = useState<string | null>(checkOut);

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
      onShow={() => {
        setDraftIn(checkIn);
        setDraftOut(checkOut);
      }}
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
          {t(bookingStrings.checkInOut)}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          <DateRangeCalendar
            checkIn={draftIn}
            checkOut={draftOut}
            onSelect={(start, end) => {
              setDraftIn(start);
              setDraftOut(end);
            }}
          />
        </ScrollView>
        <Button
          disabled={draftIn === null || draftOut === null}
          label={t(bookingStrings.apply)}
          style={styles.apply}
          onPress={() => {
            if (draftIn && draftOut) onApply(draftIn, draftOut);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  apply: { marginHorizontal: gutter, marginTop: space.lg },
  backdrop: { backgroundColor: 'rgba(30,14,8,0.5)', flex: 1 },
  grabber: {
    alignSelf: 'center',
    borderRadius: radius.pill,
    height: 4,
    marginBottom: space.lg,
    width: 40,
  },
  scroll: { maxHeight: 460, paddingHorizontal: gutter },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.md,
  },
  title: { marginBottom: space.sm, paddingHorizontal: gutter },
});
