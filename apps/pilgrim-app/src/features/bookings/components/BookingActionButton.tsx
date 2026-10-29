import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export function BookingActionButton({
  icon,
  label,
  compact = false,
  onPress,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  compact?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      style={compact ? styles.compact : styles.button}
      onPress={onPress}
    >
      <LinearGradient
        colors={['#FFF1DF', '#FFD3A0']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.gradient}
      >
        <MaterialCommunityIcons color="#A94D12" name={icon} size={23} />
        {!compact ? <Text style={styles.label}>{label}</Text> : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1, minWidth: 48 },
  compact: { width: 48 },
  gradient: {
    alignItems: 'center',
    borderColor: '#F6C58E',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 10,
  },
  label: { color: '#8C3F10', flexShrink: 1, fontSize: 14, fontWeight: '700' },
});
