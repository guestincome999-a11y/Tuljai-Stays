import { StyleSheet, View } from 'react-native';

import { useCachedFetch } from '../../core/useCachedFetch';
import { useCurrentPass } from '../../core/useCurrentPass';
import { radius, space } from '../../design/tokens';
import { bilingualProp, useLang } from '../../i18n/language';
import { useGo } from '../../shell/navigation';
import { Icon } from '../../ui/Icon';
import { PressableScale } from '../../ui/PressableScale';
import { Text } from '../../ui/Text';
import { fetchUnreadCount } from '../notifications/NotificationsScreen';

const GLASS = 'rgba(30,14,8,0.42)';

/**
 * Darshan Pass shortcut and notification bell, shown on the hero photo. Each can be switched off
 * or relabelled from the admin panel through the hero section's settings.
 */
export function HeaderActions({ props }: { props: Record<string, unknown> }) {
  const { t } = useLang();
  const { push } = useGo();
  const { currentPass, signedIn } = useCurrentPass();
  const { data: unread } = useCachedFetch(
    signedIn ? 'notifications:unread' : 'notifications:none',
    () => (signedIn ? fetchUnreadCount() : Promise.resolve({ unreadCount: 0 })),
  );
  const showPass = props['showPass'] !== false;
  const showBell = props['showBell'] !== false;
  const passLabel =
    t(bilingualProp(props, 'passLabel')) || t({ en: 'Darshan Pass', mr: 'दर्शन पास' });
  const hasUnread = (unread?.unreadCount ?? 0) > 0;

  return (
    <View style={styles.row}>
      {showPass ? (
        <PressableScale
          accessibilityLabel={passLabel}
          pressedScale={0.95}
          style={styles.pass}
          onPress={() => push(currentPass ? `/booking/${currentPass.id}` : '/bookings')}
        >
          <Icon color="onPrimary" name="grid" size={16} />
          <Text color="onPrimary" variant="label">
            {passLabel}
          </Text>
        </PressableScale>
      ) : null}
      {showBell ? (
        <PressableScale
          accessibilityLabel={t({ en: 'Notifications', mr: 'सूचना' })}
          pressedScale={0.92}
          style={styles.bell}
          onPress={() => push('/notifications')}
        >
          <Icon color="onPrimary" name="bell" size={20} />
          {hasUnread ? <View style={styles.dot} /> : null}
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bell: {
    alignItems: 'center',
    backgroundColor: GLASS,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  dot: {
    backgroundColor: '#F5A524',
    borderColor: GLASS,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    height: 10,
    position: 'absolute',
    right: 9,
    top: 9,
    width: 10,
  },
  pass: {
    alignItems: 'center',
    backgroundColor: GLASS,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: space.xs + 2,
    height: 40,
    paddingHorizontal: space.md + 2,
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: space.sm },
});
