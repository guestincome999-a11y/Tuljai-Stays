import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useColors } from '../../design/theme';
import { radius, space } from '../../design/tokens';
import { Text } from '../../ui/Text';

export const OTP_LENGTH = 6;

/** Six boxes backed by one hidden input, so paste and SMS autofill both work. */
export function OtpInput({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const colors = useColors();
  const input = useRef<TextInput>(null);

  return (
    <Pressable accessibilityLabel="Enter code" onPress={() => input.current?.focus()}>
      <View style={styles.row}>
        {Array.from({ length: OTP_LENGTH }, (_, index) => {
          const active = value.length === index;
          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  backgroundColor: colors.surface,
                  borderColor: active ? colors.primary : value[index] ? colors.ink : colors.line,
                },
              ]}
            >
              <Text variant="title">{value[index] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        autoComplete="sms-otp"
        autoFocus
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        ref={input}
        style={styles.hidden}
        textContentType="oneTimeCode"
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/gu, ''))}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    flex: 1,
    height: 60,
    justifyContent: 'center',
  },
  hidden: { height: 1, opacity: 0, position: 'absolute', width: 1 },
  row: { flexDirection: 'row', gap: space.sm },
});
