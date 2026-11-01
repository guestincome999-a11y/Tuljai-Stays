import { useMemo, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Button, Card, RadioButton, Text, TextInput, useTheme } from 'react-native-paper';

import { radius, spacing } from '../../../owner-ui/theme';

const rejectionReasons = [
  'Room not available',
  'Price changed',
  'Lodge full',
  'Invalid request',
  'Other',
];

interface RejectBookingModalProps {
  bookingCode: string | null;
  errorMessage?: string | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  visible: boolean;
}

export function RejectBookingModal({
  bookingCode,
  errorMessage,
  isSubmitting,
  onCancel,
  onConfirm,
  visible,
}: RejectBookingModalProps) {
  const [reason, setReason] = useState(rejectionReasons[0]);
  const [customNote, setCustomNote] = useState('');
  const theme = useTheme();
  const finalReason = useMemo(
    () => (reason === 'Other' ? customNote.trim() : reason),
    [customNote, reason],
  );

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!isSubmitting) onCancel();
      }}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.content}>
            <Text variant="titleLarge">Reject booking</Text>
            {bookingCode ? (
              <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodyMedium">
                {bookingCode}
              </Text>
            ) : null}

            <RadioButton.Group value={reason} onValueChange={setReason}>
              {rejectionReasons.map((item) => (
                <RadioButton.Item key={item} label={item} value={item} />
              ))}
            </RadioButton.Group>

            {reason === 'Other' ? (
              <TextInput
                accessibilityLabel="Reason"
                outlineStyle={{ borderRadius: radius.md }}
                label="Reason"
                mode="outlined"
                value={customNote}
                onChangeText={setCustomNote}
              />
            ) : null}

            {errorMessage ? (
              <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>
                {errorMessage}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button disabled={isSubmitting} mode="outlined" onPress={onCancel}>
                Cancel
              </Button>
              <Button
                disabled={!finalReason || isSubmitting}
                loading={isSubmitting}
                mode="contained"
                onPress={() => onConfirm(finalReason)}
              >
                Reject
              </Button>
            </View>
          </Card.Content>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  card: {
    borderRadius: radius.sm,
  },
  content: {
    gap: spacing.md,
  },
});
