import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedResultBadge } from '../components';

export function BookingOutcomeScreen({
  success,
  title,
  message,
  busy = false,
  onContinue,
  onBack,
}: {
  success: boolean;
  title: string;
  message: string;
  busy?: boolean;
  onContinue: () => void;
  onBack?: () => void;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFCF7', padding: 28 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <AnimatedResultBadge
          key={success ? 'success' : 'failure'}
          tone={success ? 'success' : 'danger'}
        />
        <Text
          accessibilityRole="header"
          style={{ fontSize: 30, fontWeight: '800', textAlign: 'center', color: '#292018' }}
        >
          {title}
        </Text>
        <Text
          accessibilityLiveRegion="polite"
          style={{ fontSize: 16, lineHeight: 26, textAlign: 'center', color: '#71665A' }}
        >
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onContinue}
          style={{
            marginTop: 16,
            minHeight: 56,
            width: '100%',
            borderRadius: 20,
            backgroundColor: success ? '#16804A' : '#A73535',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '800' }}>
              {success ? 'View booking' : 'Retry / check payment'}
            </Text>
          )}
        </Pressable>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onBack}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Text style={{ color: '#71665A', fontWeight: '700' }}>Back to payment details</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
