import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../auth/auth-context';
import {
  AppScreen,
  Field,
  LanguageToggle,
  PrimaryButton,
  SecondaryButton,
  SettingRow,
  ui,
} from '../components';
import { usePilgrimApp } from '../PilgrimAppProvider';

export function PilgrimProfileScreen() {
  const router = useRouter();
  const auth = useAuth();
  const {
    bookingNotificationsEnabled,
    bookings,
    favoriteIds,
    language,
    setBookingNotificationsEnabled,
    setLanguage,
    t,
  } = usePilgrimApp();
  const [editOpen, setEditOpen] = useState(false);
  const [draftName, setDraftName] = useState(auth.user?.displayName?.trim() ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const confirmed = bookings.filter((item) => item.status === 'confirmed').length;
  const displayName = auth.user?.displayName?.trim() || t('Pilgrim', 'भाविक');
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  function askToLogout() {
    Alert.alert(
      t('Log out of Tuljai Stays?', 'तुळजाई स्टेजमधून लॉग आउट?'),
      t(
        'You can sign in again anytime with your mobile number.',
        'तुम्ही मोबाइल क्रमांकाने पुन्हा कधीही साइन इन करू शकता.',
      ),
      [
        { style: 'cancel', text: t('Stay signed in', 'साइन इन राहा') },
        { style: 'destructive', text: t('Log out', 'लॉग आउट'), onPress: () => void auth.logout() },
      ],
    );
  }

  function openProfileEditor() {
    setDraftName(auth.user?.displayName?.trim() ?? '');
    setEditOpen(true);
  }

  async function saveProfile() {
    const displayName = draftName.trim().replace(/\s+/gu, ' ');
    if (displayName.length < 2) {
      Alert.alert(
        t('Enter your full name', 'तुमचे पूर्ण नाव टाका'),
        t('Use at least 2 characters.', 'किमान २ अक्षरे वापरा.'),
      );
      return;
    }

    setSavingProfile(true);
    try {
      await auth.updateProfile(displayName);
      setEditOpen(false);
      Alert.alert(
        t('Profile updated', 'प्रोफाइल अपडेट झाले'),
        t('Your traveller name has been saved.', 'तुमचे प्रवासी नाव जतन झाले आहे.'),
      );
    } catch (error) {
      Alert.alert(
        t('Profile could not be updated', 'प्रोफाइल अपडेट झाले नाही'),
        error instanceof Error
          ? error.message
          : t('Please try again.', 'कृपया पुन्हा प्रयत्न करा.'),
      );
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <AppScreen className="gap-6 pt-2">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-extrabold tracking-tight text-warm-900">
            {t('Profile', 'प्रोफाइल')}
          </Text>
          <Text className="mt-1 text-sm text-warm-500">
            {t('Your travel details and preferences', 'तुमची प्रवास माहिती आणि पसंती')}
          </Text>
        </View>
        <LanguageToggle />
      </View>

      <View className="overflow-hidden rounded-3xl bg-maroon-700 p-5">
        <View className="absolute -right-9 -top-10 h-32 w-32 rounded-full bg-saffron-500/20" />
        <View className="flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-white/15">
            <Text className="text-xl font-extrabold text-white">{initials}</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-xl font-extrabold text-white">{displayName}</Text>
            <Text className="mt-1 text-sm text-orange-100">
              {auth.user?.phoneNumber ?? t('Verified mobile', 'सत्यापित मोबाइल')}
            </Text>
            <View className="mt-2 self-start rounded-full bg-white/10 px-3 py-1">
              <Text className="text-xs font-bold text-white">
                ✓ {t('Mobile verified', 'मोबाइल सत्यापित')}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityLabel={t('Edit traveller name', 'प्रवासी नाव संपादित करा')}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/10"
            onPress={openProfileEditor}
          >
            <MaterialCommunityIcons color="#FFFFFF" name="pencil-outline" size={20} />
          </Pressable>
        </View>
        <View className="mt-5 flex-row rounded-2xl bg-white/10 py-3">
          <View className="flex-1 items-center">
            <Text className="text-xl font-extrabold text-white">{bookings.length}</Text>
            <Text className="mt-1 text-xs text-orange-100">{t('Bookings', 'बुकिंग')}</Text>
          </View>
          <View className="w-px bg-white/15" />
          <View className="flex-1 items-center">
            <Text className="text-xl font-extrabold text-white">{confirmed}</Text>
            <Text className="mt-1 text-xs text-orange-100">{t('Upcoming', 'आगामी')}</Text>
          </View>
          <View className="w-px bg-white/15" />
          <View className="flex-1 items-center">
            <Text className="text-xl font-extrabold text-white">{favoriteIds.length}</Text>
            <Text className="mt-1 text-xs text-orange-100">{t('Saved', 'जतन')}</Text>
          </View>
        </View>
      </View>

      <ProfileSection title={t('Your yatra', 'तुमची यात्रा')}>
        <SettingRow
          icon="heart-outline"
          label={t('Saved stays', 'जतन केलेले निवास')}
          onPress={() => router.push({ pathname: '/(app)/lodges', params: { quick: 'saved' } })}
          subtitle={`${favoriteIds.length} ${t('places saved', 'निवास जतन')}`}
        />
        <SettingRow
          icon="account-details-outline"
          label={t('Traveller details', 'प्रवासी माहिती')}
          onPress={openProfileEditor}
          subtitle={t('Name, phone and photo ID', 'नाव, फोन आणि फोटो ओळखपत्र')}
        />
        <SettingRow
          icon="map-marker-radius-outline"
          label={t('Temple & travel updates', 'मंदिर आणि प्रवास अपडेट')}
          onPress={() => router.push('/(app)/announcements')}
          subtitle={t('Navratri guidance for Tuljapur', 'तुळजापूर नवरात्र मार्गदर्शन')}
        />
      </ProfileSection>

      <ProfileSection title={t('Preferences', 'पसंती')}>
        <SettingRow
          icon="translate"
          label={t('App language', 'ॲप भाषा')}
          right={
            <View className="flex-row gap-1 rounded-full bg-warm-100 p-1">
              <Pressable
                className={`rounded-full px-3 py-2 ${language === 'en' ? 'bg-white' : ''}`}
                onPress={() => setLanguage('en')}
              >
                <Text className="text-xs font-extrabold text-warm-700">English</Text>
              </Pressable>
              <Pressable
                className={`rounded-full px-3 py-2 ${language === 'mr' ? 'bg-white' : ''}`}
                onPress={() => setLanguage('mr')}
              >
                <Text className="text-xs font-extrabold text-warm-700">मराठी</Text>
              </Pressable>
            </View>
          }
        />
        <SettingRow
          icon="bell-outline"
          label={t('Booking notifications', 'बुकिंग सूचना')}
          right={
            <Switch
              onValueChange={setBookingNotificationsEnabled}
              thumbColor="#FFFFFF"
              trackColor={{ false: '#D7C8B8', true: ui.saffron }}
              value={bookingNotificationsEnabled}
            />
          }
          subtitle={t('Confirmation and check-in reminders', 'पुष्टीकरण आणि चेक-इन स्मरणपत्रे')}
        />
      </ProfileSection>

      <ProfileSection title={t('Help & safety', 'मदत आणि सुरक्षितता')}>
        <SettingRow
          icon="whatsapp"
          label={t('WhatsApp support', 'व्हॉट्सॲप सहाय्य')}
          onPress={() => void openExternalLink('https://wa.me/919876543210', t)}
          subtitle={t('Chat with our Tuljapur team', 'आमच्या तुळजापूर टीमशी बोला')}
        />
        <SettingRow
          icon="phone-in-talk-outline"
          label={t('Call support', 'सहाय्याला कॉल करा')}
          onPress={() => void openExternalLink('tel:+919876543210', t)}
          subtitle="+91 98765 43210 · 7 AM–11 PM"
        />
        <SettingRow
          icon="shield-check-outline"
          label={t('Safety & trust', 'सुरक्षितता आणि विश्वास')}
          onPress={() =>
            Alert.alert(
              t('Tuljai verified', 'तुळजाई सत्यापित'),
              t(
                'Properties are checked for owner identity, address and required documents.',
                'मालकाची ओळख, पत्ता आणि आवश्यक कागदपत्रे तपासली जातात.',
              ),
            )
          }
        />
      </ProfileSection>

      <View className="overflow-hidden rounded-3xl border border-warm-100 bg-white px-4">
        <SettingRow
          destructive
          icon="logout"
          label={t('Log out', 'लॉग आउट')}
          onPress={askToLogout}
        />
      </View>
      <View className="items-center gap-1">
        <Text className="text-xs font-bold text-maroon-700">Tuljai Stays v0.1.0</Text>
        <Text className="text-xs text-warm-500">
          {t('Made with seva in Tuljapur', 'तुळजापूरमध्ये सेवाभावाने बनवले')}
        </Text>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setEditOpen(false)}
        transparent
        visible={editOpen}
      >
        <Pressable className="flex-1 justify-end bg-black/35" onPress={() => setEditOpen(false)}>
          <Pressable
            className="rounded-t-3xl bg-warm-50 px-5 pb-5 pt-3"
            onPress={(event) => event.stopPropagation()}
          >
            <SafeAreaView edges={['bottom']}>
              <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-warm-300" />
              <Text className="text-2xl font-extrabold text-warm-900">
                {t('Traveller details', 'प्रवासी माहिती')}
              </Text>
              <Text className="mb-5 mt-1 text-sm text-warm-500">
                {t(
                  'Use the same name shown on your photo ID.',
                  'फोटो ओळखपत्रावर असलेलेच नाव वापरा.',
                )}
              </Text>
              <Field
                autoCapitalize="words"
                autoFocus
                icon="account-outline"
                label={t('Full name', 'पूर्ण नाव')}
                maxLength={120}
                onChangeText={setDraftName}
                placeholder={t('Enter your full name', 'तुमचे पूर्ण नाव टाका')}
                value={draftName}
              />
              <Field
                className="mt-4"
                editable={false}
                icon="phone-outline"
                label={t('Verified mobile number', 'सत्यापित मोबाइल क्रमांक')}
                value={auth.user?.phoneNumber ?? ''}
              />
              <View className="mt-6 flex-row gap-3">
                <SecondaryButton className="flex-1" onPress={() => setEditOpen(false)}>
                  {t('Cancel', 'रद्द करा')}
                </SecondaryButton>
                <PrimaryButton
                  className="flex-1"
                  loading={savingProfile}
                  onPress={() => void saveProfile()}
                >
                  {t('Save', 'जतन करा')}
                </PrimaryButton>
              </View>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

async function openExternalLink(
  url: string,
  t: (english: string, marathi: string) => string,
): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      t('Could not open this action', 'ही क्रिया उघडता आली नाही'),
      t('Please try again from your phone.', 'कृपया तुमच्या फोनवरून पुन्हा प्रयत्न करा.'),
    );
  }
}

function ProfileSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View>
      <Text className="mb-3 text-lg font-extrabold text-warm-900">{title}</Text>
      <View className="overflow-hidden rounded-3xl border border-warm-100 bg-white px-4">
        {children}
      </View>
    </View>
  );
}
