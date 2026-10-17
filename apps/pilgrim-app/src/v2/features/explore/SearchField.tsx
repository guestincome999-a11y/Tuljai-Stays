import { StyleSheet, TextInput, View } from 'react-native';

import { fontFamily } from '../../design/fonts';
import { useColors } from '../../design/theme';
import { radius, space } from '../../design/tokens';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';

export function SearchField({
  onChangeText,
  placeholder,
  value,
}: {
  onChangeText: (text: string) => void;
  placeholder: string;
  value: string;
}) {
  const colors = useColors();

  return (
    <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Icon color="primary" name="search" size={20} />
      <TextInput
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        returnKeyType="search"
        selectionColor={colors.primary}
        style={[styles.input, { color: colors.ink, fontFamily: fontFamily.body }]}
        value={value}
        onChangeText={onChangeText}
      />
      {value.length > 0 ? (
        <PressableScale
          accessibilityLabel="Clear"
          hitSlop={space.md}
          pressedScale={0.9}
          onPress={() => onChangeText('')}
        >
          <Icon color="inkMuted" name="x" size={18} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: space.md,
    minHeight: 52,
    paddingHorizontal: space.lg,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: space.md },
});
