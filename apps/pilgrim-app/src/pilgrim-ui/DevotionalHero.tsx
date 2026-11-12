import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Text, View } from 'react-native';

import goddess from '../../assets/splash-goddess-cutout.png';

import { ui } from './components';
import { usePilgrimApp } from './PilgrimAppProvider';

/** Existing devotional artwork, bundled locally so the welcome works offline. */
export function DevotionalHero({ compact = false }: { compact?: boolean }) {
  const { t, language } = usePilgrimApp();
  return (
    <View className="overflow-hidden rounded-3xl bg-maroon-800">
      <View className="absolute bottom-0 right-2 top-4 w-[43%] rounded-t-full border border-bell-500/40 bg-maroon-700" />
      <Image
        accessibilityLabel="Shri Tulja Bhavani"
        resizeMode="contain"
        source={goddess}
        style={{ position: 'absolute', right: -12, bottom: -12, width: '48%', height: '100%' }}
      />
      <View className={`w-[62%] px-5 ${compact ? 'py-6' : 'py-9'}`}>
        <View className="mb-3 flex-row items-center gap-2">
          <MaterialCommunityIcons color={ui.bell} name="temple-hindu" size={18} />
          <Text className="flex-1 text-xs font-bold text-bell-100">श्री तुळजाभवानी प्रसन्न</Text>
        </View>
        <Text
          className={`${compact ? 'text-2xl leading-8' : 'text-3xl leading-10'} font-bold text-white ${language === 'en' ? 'font-heading' : ''}`}
        >
          {t('Book Your Peaceful Stay', 'तुमचा शांत निवास बुक करा')}
        </Text>
        <View className="mb-3 mt-4 h-px w-12 bg-bell-500" />
        <Text className="text-sm leading-5 text-bell-100">
          {t('A little comfort. A sacred journey.', 'आरामदायी निवास. पवित्र यात्रा.')}
        </Text>
      </View>
    </View>
  );
}
