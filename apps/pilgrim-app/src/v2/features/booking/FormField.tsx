import { StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { fontFamily } from '../../design/fonts';
import { useColors } from '../../design/theme';
import { radius, space } from '../../design/tokens';
import { Text } from '../../ui/Text';

export interface FormFieldProps extends Pick<
  TextInputProps,
  'autoCapitalize' | 'keyboardType' | 'maxLength' | 'multiline' | 'textContentType'
> {
  error?: string | null;
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}

export function FormField({ error, label, onChangeText, value, ...inputProps }: FormFieldProps) {
  const colors = useColors();

  return (
    <View style={styles.wrap}>
      <Text color="inkMuted" variant="label">
        {label}
      </Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        selectionColor={colors.primary}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.line,
            color: colors.ink,
            fontFamily: fontFamily.body,
            minHeight: inputProps.multiline ? 96 : 52,
            textAlignVertical: inputProps.multiline ? 'top' : 'center',
          },
        ]}
        value={value}
        onChangeText={onChangeText}
      />
      {error ? (
        <Text color="danger" variant="caption">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  wrap: { gap: space.xs },
});
