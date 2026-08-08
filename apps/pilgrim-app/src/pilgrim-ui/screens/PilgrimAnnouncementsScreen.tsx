import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAnnouncements } from '../../features/announcements/hooks/useAnnouncements';
import { AppScreen, EmptyState, TopBar, ui } from '../components';
import { usePilgrimApp } from '../PilgrimAppProvider';

export function PilgrimAnnouncementsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ announcementId?: string }>();
  const { t } = usePilgrimApp();
  const announcements = useAnnouncements();
  const markedAnnouncementIdRef = useRef<string | null>(null);
  const focusedAnnouncementId =
    typeof params.announcementId === 'string' ? params.announcementId : null;
  const displayedAnnouncements = useMemo(
    () =>
      focusedAnnouncementId
        ? [...announcements.data].sort((left, right) => {
            if (left.id === focusedAnnouncementId) return -1;
            if (right.id === focusedAnnouncementId) return 1;
            return 0;
          })
        : announcements.data,
    [announcements.data, focusedAnnouncementId],
  );
  const focusedAnnouncement = useMemo(
    () =>
      announcements.data.find(
        (announcement) => announcement.id === focusedAnnouncementId,
      ),
    [announcements.data, focusedAnnouncementId],
  );

  useEffect(() => {
    if (
      focusedAnnouncement &&
      !focusedAnnouncement.readAt &&
      markedAnnouncementIdRef.current !== focusedAnnouncement.id
    ) {
      markedAnnouncementIdRef.current = focusedAnnouncement.id;
      void announcements.markRead(focusedAnnouncement.id);
    }
  }, [announcements, focusedAnnouncement]);

  return (
    <AppScreen className="gap-5 pt-1">
      <TopBar
        onBack={() => router.back()}
        subtitle={t('Official local travel guidance', 'अधिकृत स्थानिक प्रवास मार्गदर्शन')}
        title={t('Temple & travel updates', 'मंदिर आणि प्रवास अपडेट')}
      />
      {announcements.isLoading ? (
        <View className="items-center rounded-3xl border border-warm-100 bg-white py-16">
          <ActivityIndicator color={ui.saffronDeep} size="large" />
          <Text className="mt-4 text-sm font-bold text-warm-500">
            {t('Loading official updates…', 'अधिकृत अपडेट लोड होत आहेत…')}
          </Text>
        </View>
      ) : announcements.errorMessage ? (
        <EmptyState
          action={t('Try again', 'पुन्हा प्रयत्न करा')}
          body={t(
            'Official updates could not be loaded. Check your connection and try again.',
            'अधिकृत अपडेट लोड झाली नाहीत. इंटरनेट तपासून पुन्हा प्रयत्न करा.',
          )}
          icon="cloud-alert-outline"
          onAction={() => void announcements.refresh()}
          title={t('Updates unavailable', 'अपडेट उपलब्ध नाहीत')}
        />
      ) : displayedAnnouncements.length > 0 ? (
        displayedAnnouncements.map((announcement) => (
          <Notice
            body={announcement.body}
            color={announcement.priority === 'CRITICAL' ? 'maroon' : 'gold'}
            date={new Date(announcement.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            focused={announcement.id === focusedAnnouncementId}
            icon={announcement.category === 'TEMPLE_NOTICE' ? 'temple-hindu' : 'bus'}
            key={announcement.id}
            title={announcement.title}
          />
        ))
      ) : (
        <EmptyState
          body={t(
            'There are no official temple or travel notices right now.',
            'सध्या मंदिर किंवा प्रवासाबद्दल कोणतीही अधिकृत सूचना नाही.',
          )}
          icon="bell-check-outline"
          title={t('No new updates', 'नवीन अपडेट नाहीत')}
        />
      )}
      {announcements.data.length > 0 && !announcements.errorMessage ? (
        <View className="items-center rounded-3xl bg-warm-100 p-6">
          <MaterialCommunityIcons color={ui.saffronDeep} name="bell-outline" size={30} />
          <Text className="mt-3 text-center text-base font-extrabold text-warm-900">
            {t('You are up to date', 'तुम्ही अद्ययावत आहात')}
          </Text>
          <Text className="mt-1 text-center text-sm text-warm-500">
            {t(
              'Important changes will also appear in Notifications.',
              'महत्त्वाचे बदल सूचनांमध्येही दिसतील.',
            )}
          </Text>
        </View>
      ) : null}
    </AppScreen>
  );
}

function Notice({
  color,
  date,
  icon,
  title,
  body,
  focused,
}: {
  body: string;
  color: 'maroon' | 'gold' | 'green';
  date: string;
  focused: boolean;
  icon: 'bus' | 'shield-check-outline' | 'temple-hindu';
  title: string;
}) {
  const colors =
    color === 'maroon'
      ? { bg: 'bg-maroon-50', icon: ui.maroon }
      : color === 'green'
        ? { bg: 'bg-templeGreen-50', icon: ui.green }
        : { bg: 'bg-bell-50', icon: ui.bell };
  return (
    <View
      className={`rounded-3xl border bg-white p-5 ${
        focused ? 'border-2 border-saffron-500' : 'border-warm-100'
      }`}
    >
      <View className="flex-row items-start gap-3">
        <View className={`h-12 w-12 items-center justify-center rounded-2xl ${colors.bg}`}>
          <MaterialCommunityIcons color={colors.icon} name={icon} size={25} />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-bold text-warm-500">{date}</Text>
          <Text className="mt-1 text-lg font-extrabold text-warm-900">{title}</Text>
        </View>
      </View>
      <Text className="mt-4 text-sm leading-6 text-warm-600">{body}</Text>
    </View>
  );
}
