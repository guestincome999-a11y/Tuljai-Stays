import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../core/auth';
import { useColors } from '../../design/theme';
import { gutter, space } from '../../design/tokens';
import { authStrings } from '../../i18n/authStrings';
import { useLang } from '../../i18n/language';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { FormField } from '../booking/FormField';

/** Asked once, right after first sign-in, so bookings carry the guest's real name. */
export function NameScreen({ onDone }: { onDone: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const auth = useAuth();
  const [name, setName] = useState(auth.user?.displayName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const normalized = name.trim().replace(/\s+/gu, ' ');
    if (normalized.length < 2) {
      setError(t(authStrings.nameInvalid));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await auth.updateName(normalized);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(authStrings.nameInvalid));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top + space.huge },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.copy}>
          <Text variant="title">{t(authStrings.nameTitle)}</Text>
          <Text color="inkMuted">{t(authStrings.nameBody)}</Text>
        </View>
        <FormField
          autoCapitalize="words"
          error={error}
          label={t(authStrings.nameLabel)}
          textContentType="name"
          value={name}
          onChangeText={setName}
        />
        <Button label={t(authStrings.nameSave)} loading={saving} onPress={() => void save()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl, padding: gutter },
  copy: { gap: space.sm },
  screen: { flex: 1 },
});
