import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import goddess from '../../assets/splash-goddess-cutout.png';
import originalPhotograph from '../../assets/splash-screen.png';
import { useConnectivity } from '../connectivity/connectivity-context';
import tokens from '../pilgrim-ui/design-tokens.json';

export function AnimatedWelcomeSplash({
  onReady,
  onEntranceComplete,
}: {
  onReady: () => void;
  onEntranceComplete: () => void;
}) {
  const { isOffline } = useConnectivity();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!imageLoaded || !laidOut) return;
    onReady();
    const entrance = Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true });
    // Give the replacement a first frame after releasing the native splash.
    // The photograph stays opaque; only the small branding group is animated.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        entrance.start(({ finished }) => {
          if (finished) onEntranceComplete();
        });
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      entrance.stop();
    };
  }, [imageLoaded, laidOut, onEntranceComplete, onReady, opacity]);
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style={isOffline ? 'dark' : 'light'} />
      <View style={styles.content}>
        <Animated.Text style={[styles.devotion, { opacity }]}>
          श्री तुळजाभवानी प्रसन्न
        </Animated.Text>
        <View style={styles.arch}>
          <Image
            source={useOriginal ? originalPhotograph : goddess}
            onLayout={({ nativeEvent: { layout } }) => {
              setLaidOut(layout.width > 0 && layout.height > 0);
            }}
            onLoad={() => setImageLoaded(true)}
            onError={({ nativeEvent }) => {
              console.warn('Splash photograph decode failed:', nativeEvent.error);
              if (!useOriginal) setUseOriginal(true);
              // A corrupt install must not trap the user behind the native splash.
              else setImageLoaded(true);
            }}
            fadeDuration={0}
            resizeMode="contain"
            style={styles.art}
            accessibilityLabel="Shri Tulja Bhavani"
          />
        </View>
        <Animated.View style={[styles.branding, { opacity }]}>
          <MaterialCommunityIcons name="temple-hindu" size={30} color={tokens.colors.bell[500]} />
          <Text style={styles.brand}>Tuljai Stays</Text>
          <View style={styles.rule} />
          <Text style={styles.tagline}>Book Your Peaceful Stay</Text>
          <Text style={styles.place}>तुळजापूर · Tuljapur, Maharashtra</Text>
          <ActivityIndicator
            accessibilityLabel="Loading Tuljai Stays"
            color={tokens.colors.bell[500]}
            style={{ marginTop: 24 }}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.maroon[800] },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  branding: { alignItems: 'center', width: '100%' },
  devotion: { color: '#F1E1C2', fontSize: 15, marginBottom: 24 },
  arch: {
    width: '76%',
    maxWidth: 260,
    height: '42%',
    borderTopLeftRadius: 140,
    borderTopRightRadius: 140,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#C49A5066',
    backgroundColor: tokens.colors.maroon[700],
    marginBottom: 24,
  },
  art: { width: '100%', height: '100%' },
  brand: { color: '#FFFFFF', fontSize: 34, fontWeight: '700', marginTop: 8 },
  rule: { width: 48, height: 1, backgroundColor: tokens.colors.bell[500], marginVertical: 16 },
  tagline: { color: '#FFFFFF', fontSize: 17, textAlign: 'center' },
  place: { color: '#F1E1C2', fontSize: 12, marginTop: 10, textAlign: 'center' },
});
