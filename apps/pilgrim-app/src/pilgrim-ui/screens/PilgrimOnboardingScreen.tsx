import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useAuth } from '../../auth/auth-context';
import { AppScreen, Field, PrimaryButton, ui } from '../components';
import { usePilgrimApp } from '../PilgrimAppProvider';

export function PilgrimOnboardingScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { t } = usePilgrimApp();
  const [name, setName] = useState(auth.user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function finish() { const normalized = name.trim().replace(/\s+/gu, ' '); if (normalized.length < 2) { setError(t('Enter your name (at least 2 characters).', 'तुमचे नाव टाका (किमान २ अक्षरे).')); return; } setError(''); setSaving(true); try { await auth.updateProfile(normalized); router.replace('/(app)/home'); } catch { setError(t('Could not save your details. Please try again.', 'माहिती जतन करता आली नाही. पुन्हा प्रयत्न करा.')); } finally { setSaving(false); } }
  return <AppScreen className="gap-7 pt-3"><View className="h-16 w-16 items-center justify-center rounded-3xl bg-saffron-100"><MaterialCommunityIcons color={ui.saffronDeep} name="account-check-outline" size={34} /></View><View><Text className="text-3xl font-extrabold tracking-tight text-warm-900">{t('Welcome to Tuljai Stays', 'तुळजाई स्टेजमध्ये स्वागत')}</Text><Text className="mt-2 text-sm leading-6 text-warm-500">{t('Tell us your name so we can personalize your bookings and stay information.', 'तुमच्या बुकिंग आणि निवास माहितीसाठी तुमचे नाव सांगा.')}</Text></View><Field autoCapitalize="words" icon="account-outline" label={t('Your name', 'तुमचे नाव')} onChangeText={(value) => { setName(value); setError(''); }} placeholder={t('Enter your full name', 'तुमचे पूर्ण नाव टाका')} value={name} />{error ? <View className="rounded-2xl bg-danger-50 p-3"><Text className="text-sm font-semibold text-danger-700">{error}</Text></View> : null}<View className="flex-row items-start gap-3 rounded-2xl bg-saffron-50 p-4"><MaterialCommunityIcons color={ui.saffronDeep} name="shield-check-outline" size={22} /><Text className="flex-1 text-sm leading-5 text-warm-600">{t('Only the information you provide is saved to your Tuljai Stays account.', 'तुम्ही दिलेली माहितीच तुमच्या तुळजाई स्टेज खात्यात जतन केली जाते.')}</Text></View><PrimaryButton icon="arrow-right" loading={saving} onPress={() => void finish()}>{t('Continue to Tuljai Stays', 'तुळजाई स्टेजमध्ये पुढे चला')}</PrimaryButton></AppScreen>;
}
