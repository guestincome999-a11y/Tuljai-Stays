import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Announcement } from '@tuljai/types';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { listAnnouncements } from '../../features/announcements/api/announcements-api';
import { useRealtime } from '../../realtime/realtime-provider';
import { AppScreen, TopBar, ui } from '../components';
import { usePilgrimApp } from '../PilgrimAppProvider';

export function PilgrimAnnouncementsScreen() {
  const router = useRouter();
  const realtime = useRealtime();
  const { t } = usePilgrimApp();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    void listAnnouncements()
      .then((response) => setAnnouncements(response.items))
      .catch(() => undefined);
  }, [realtime.lastEvent]);

  return (
    <AppScreen className="gap-5 pt-1">
      <TopBar
        onBack={() => router.back()}
        subtitle={t('Official local travel guidance', 'अधिकृत स्थानिक प्रवास मार्गदर्शन')}
        title={t('Temple & travel updates', 'मंदिर आणि प्रवास अपडेट')}
      />
      {announcements.length > 0 ? (
        announcements.map((announcement) => (
          <Notice
            body={announcement.body}
            color={announcement.priority === 'CRITICAL' ? 'maroon' : 'gold'}
            date={new Date(announcement.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            icon={announcement.category === 'TEMPLE_NOTICE' ? 'temple-hindu' : 'bus'}
            key={announcement.id}
            title={announcement.title}
          />
        ))
      ) : (
        <>
          <Notice
            color="maroon"
            date="12 Jul 2026"
            icon="temple-hindu"
            title={t('Navratri darshan arrangements', 'नवरात्र दर्शन व्यवस्था')}
            body={t(
              'Special queue entrances will operate from 4:00 AM during peak festival days. Keep your photo ID and booking confirmation ready.',
              'उत्सवाच्या गर्दीच्या दिवसांत पहाटे ४ वाजल्यापासून विशेष रांगा सुरू राहतील. फोटो ओळखपत्र आणि बुकिंग पुष्टी तयार ठेवा.',
            )}
          />
          <Notice
            color="gold"
            date="10 Jul 2026"
            icon="bus"
            title={t('Shuttle service from parking areas', 'पार्किंगमधून शटल सेवा')}
            body={t(
              'Free festival shuttle buses will connect designated parking areas with the temple approach road every 20 minutes.',
              'नियोजित पार्किंग क्षेत्रातून मंदिर मार्गापर्यंत दर २० मिनिटांनी मोफत शटल बस उपलब्ध असेल.',
            )}
          />
          <Notice
            color="green"
            date="8 Jul 2026"
            icon="shield-check-outline"
            title={t('Book only verified stays', 'फक्त सत्यापित निवास बुक करा')}
            body={t(
              'Tuljai verified properties have completed owner, address and document checks. Avoid paying unknown agents outside the app.',
              'तुळजाई सत्यापित निवासांनी मालक, पत्ता आणि कागदपत्र पडताळणी पूर्ण केली आहे. ॲपबाहेरील अनोळखी एजंटांना पैसे देऊ नका.',
            )}
          />
        </>
      )}
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
    </AppScreen>
  );
}

function Notice({
  color,
  date,
  icon,
  title,
  body,
}: {
  body: string;
  color: 'maroon' | 'gold' | 'green';
  date: string;
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
    <View className="rounded-3xl border border-warm-100 bg-white p-5">
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
