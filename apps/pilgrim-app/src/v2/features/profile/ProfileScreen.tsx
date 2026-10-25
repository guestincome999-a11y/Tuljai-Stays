import Constants from 'expo-constants';
import { Alert, Linking, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../core/auth';
import { useRemoteConfig } from '../../core/config';
import { usePreferences } from '../../core/preferences';
import { enablePushNotifications } from '../../core/push';
import { useColors } from '../../design/theme';
import { elevation, gutter, radius, space } from '../../design/tokens';
import { SUPPORT_EMAIL, accountStrings } from '../../i18n/accountStrings';
import { useLang } from '../../i18n/language';
import type { Lang } from '../../i18n/language';
import { myBookingsStrings } from '../../i18n/strings';
import type { LegalDocumentKind } from '../../legal/legalDocuments';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';

function supportPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/gu, '');
  const national = digits.startsWith('91') ? digits.slice(2) : digits;
  const placeholder = /^0+$/u.test(national) || /^(\d)\1{9}$/u.test(national);
  return /^[6-9]\d{9}$/u.test(national) && !placeholder ? `+91${national}` : null;
}

function Row({
  icon,
  label,
  onPress,
  subtitle,
  trailing,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  const colors = useColors();
  const body = (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon color="primary" name={icon} size={18} />
      </View>
      <View style={styles.rowCopy}>
        <Text variant="label">{label}</Text>
        {subtitle ? (
          <Text color="inkMuted" variant="caption">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon color="inkFaint" name="chevron-right" size={18} /> : null)}
    </View>
  );
  return onPress ? (
    <PressableScale accessibilityLabel={label} pressedScale={0.99} onPress={onPress}>
      {body}
    </PressableScale>
  ) : (
    body
  );
}

export interface ProfileScreenProps {
  onOpenAnnouncements: () => void;
  onOpenLegal: (kind: LegalDocumentKind) => void;
  onOpenNotifications: () => void;
  onOpenSaved: () => void;
  onSignIn: () => void;
}

export function ProfileScreen({
  onOpenAnnouncements,
  onOpenLegal,
  onOpenNotifications,
  onOpenSaved,
  onSignIn,
}: ProfileScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { lang, setLang, t } = useLang();
  const auth = useAuth();
  const { config } = useRemoteConfig();
  const preferences = usePreferences();
  const phone = supportPhone(config.settings['support_phone']);
  const email =
    typeof config.settings['support_email'] === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(config.settings['support_email'])
      ? config.settings['support_email']
      : SUPPORT_EMAIL;
  const initial = (auth.user?.displayName ?? '?').trim().charAt(0).toUpperCase();

  function confirmLogout() {
    Alert.alert(t(accountStrings.logout), t(accountStrings.logoutBody), [
      { style: 'cancel', text: t(myBookingsStrings.cancelKeep) },
      { onPress: () => void auth.logout(), style: 'destructive', text: t(accountStrings.logout) },
    ]);
  }

  async function toggleNotifications(enabled: boolean) {
    preferences.setBookingNotificationsEnabled(enabled);
    if (!enabled) return;
    const result = await enablePushNotifications();
    if (!result.registered) {
      Alert.alert(t(accountStrings.enableNotifications), t(accountStrings.bookingAlertsBody), [
        { style: 'cancel', text: t(myBookingsStrings.cancelKeep) },
        { onPress: () => void Linking.openSettings(), text: t(accountStrings.openSettings) },
      ]);
    }
  }

  const languages: Array<{ id: Lang; label: string }> = [
    { id: 'en', label: 'English' },
    { id: 'mr', label: 'मराठी' },
  ];

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + space.huge * 2, paddingTop: insets.top + space.lg },
      ]}
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: colors.background }}
    >
      <View style={styles.header}>
        <Text variant="title">{t(accountStrings.profile)}</Text>
        <View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>
          {languages.map((option) => (
            <PressableScale
              accessibilityLabel={option.label}
              accessibilityState={{ selected: lang === option.id }}
              key={option.id}
              pressedScale={0.94}
              style={[
                styles.segmentOption,
                lang === option.id ? { backgroundColor: colors.primary } : null,
              ]}
              onPress={() => setLang(option.id)}
            >
              <Text color={lang === option.id ? 'onPrimary' : 'inkMuted'} variant="label">
                {option.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      </View>

      {auth.signedIn ? (
        <View
          style={[
            styles.card,
            elevation.card,
            styles.identity,
            { backgroundColor: colors.surface },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text color="onPrimary" variant="title">
              {initial}
            </Text>
          </View>
          <View style={styles.rowCopy}>
            <Text variant="heading">{auth.user?.displayName ?? ''}</Text>
            <Text color="inkMuted" variant="label">
              {auth.user?.phoneNumber ?? ''}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text color="inkMuted">{t(myBookingsStrings.signInBody)}</Text>
          <Button label={t(myBookingsStrings.signInAction)} onPress={onSignIn} />
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {auth.signedIn ? (
          <>
            <Row icon="heart" label={t(accountStrings.saved)} onPress={onOpenSaved} />
            <Row
              icon="bell"
              label={t(accountStrings.notifications)}
              onPress={onOpenNotifications}
            />
          </>
        ) : null}
        <Row
          icon="volume-2"
          label={t(accountStrings.announcements)}
          subtitle={t(accountStrings.announcementsBody)}
          onPress={onOpenAnnouncements}
        />
        {auth.signedIn ? (
          <Row
            icon="bell"
            label={t(accountStrings.bookingAlerts)}
            subtitle={t(accountStrings.bookingAlertsBody)}
            trailing={
              <Switch
                thumbColor={colors.surface}
                trackColor={{ false: colors.line, true: colors.primary }}
                value={preferences.bookingNotificationsEnabled}
                onValueChange={(value) => void toggleNotifications(value)}
              />
            }
          />
        ) : null}
      </View>

      <Text color="inkMuted" variant="label">
        {t(accountStrings.support)}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Row
          icon="mail"
          label={t(accountStrings.emailSupport)}
          subtitle={email}
          onPress={() => void Linking.openURL(`mailto:${email}`)}
        />
        {phone ? (
          <Row
            icon="phone"
            label={t(accountStrings.callSupport)}
            subtitle={phone}
            onPress={() => void Linking.openURL(`tel:${phone}`)}
          />
        ) : null}
        <Row
          icon="file-text"
          label={t(accountStrings.legalTerms)}
          onPress={() => onOpenLegal('terms')}
        />
        <Row
          icon="shield"
          label={t(accountStrings.legalPrivacy)}
          onPress={() => onOpenLegal('privacy')}
        />
      </View>

      {auth.signedIn ? (
        <Button label={t(accountStrings.logout)} variant="secondary" onPress={confirmLogout} />
      ) : null}
      <Text align="center" color="inkFaint" variant="caption">
        {t(accountStrings.appVersion)} {Constants.expoConfig?.version ?? ''}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  card: { borderRadius: radius.lg, gap: space.lg, padding: space.lg },
  content: { gap: space.xl, paddingHorizontal: gutter },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  identity: { alignItems: 'center', flexDirection: 'row' },
  row: { alignItems: 'center', flexDirection: 'row', gap: space.md },
  rowCopy: { flex: 1, gap: 2 },
  rowIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  segment: { borderRadius: radius.pill, flexDirection: 'row', padding: 3 },
  segmentOption: {
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
});
