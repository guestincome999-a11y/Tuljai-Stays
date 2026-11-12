import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import goddess from '../../../assets/splash-goddess-cutout.png';
import { useConnectivity } from '../../connectivity/connectivity-context';
import { BrandMark, LanguageToggle, PrimaryButton } from '../components';
import { usePilgrimApp } from '../PilgrimAppProvider';

export function PilgrimWelcomeScreen() {
  const router = useRouter();
  const { isOffline } = useConnectivity();
  const { t, language } = usePilgrimApp();
  return (
    <SafeAreaView className="flex-1 bg-maroon-800">
      <StatusBar style={isOffline ? 'dark' : 'light'} />
      <Image
        accessibilityLabel="Shri Tulja Bhavani"
        source={goddess}
        resizeMode="contain"
        style={{ position: 'absolute', top: 72, bottom: 100, width: '100%', height: '72%' }}
      />
      <View className="absolute inset-0 bg-black/25" />
      <View className="flex-1 justify-between px-6 pb-6 pt-3">
        <View className="flex-row items-center justify-between">
          <BrandMark compact inverse />
          <LanguageToggle inverse />
        </View>
        <View className="gap-5">
          <View className="items-center gap-3 rounded-3xl bg-maroon-800/90 px-4 py-5">
            <Text className="text-center text-sm font-bold text-bell-100">
              श्री तुळजाभवानी प्रसन्न
            </Text>
            <Text
              className={`text-center text-4xl font-bold text-white ${language === 'en' ? 'font-heading' : ''}`}
            >
              Tuljai Stays
            </Text>
            <Text className="text-center text-lg text-white">
              {t('Book Your Peaceful Stay', 'तुमचा शांत निवास बुक करा')}
            </Text>
            <View className="my-1 h-px w-12 bg-bell-500" />
            <Text className="text-center text-sm leading-6 text-bell-100">
              {t(
                'A comfortable stay for your sacred journey',
                'तुमच्या पवित्र यात्रेसाठी आरामदायी निवास',
              )}
            </Text>
            <Text className="text-center text-xs text-bell-100">
              {t('Tuljapur, Maharashtra', 'तुळजापूर, महाराष्ट्र')}
            </Text>
          </View>
          <PrimaryButton
            className="border border-bell-500"
            icon="arrow-right"
            onPress={() => router.replace('/(auth)/login')}
          >
            {t('Get Started', 'सुरुवात करा')}
          </PrimaryButton>
          <Text className="text-center text-xs text-bell-100">
            {t('Your stay, our devotion', 'तुमचा निवास, आमची सेवा')}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
