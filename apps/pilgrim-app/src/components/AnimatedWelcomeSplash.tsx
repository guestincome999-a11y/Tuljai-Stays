import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import splashArtwork from '../../assets/splash-screen.png';

export function AnimatedWelcomeSplash() {
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeTranslateY = useRef(new Animated.Value(18)).current;
  const handsOpacity = useRef(new Animated.Value(0)).current;
  const handsScale = useRef(new Animated.Value(0.72)).current;
  const handsTranslateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    let prayerPulse: Animated.CompositeAnimation | undefined;
    const entrance = Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(welcomeOpacity, {
          duration: 430,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(welcomeTranslateY, {
          duration: 430,
          easing: Easing.out(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(handsOpacity, {
          duration: 320,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(handsScale, {
          damping: 9,
          mass: 0.7,
          stiffness: 150,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(handsTranslateY, {
          duration: 360,
          easing: Easing.out(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    ]);

    entrance.start(({ finished }) => {
      if (!finished) {
        return;
      }

      prayerPulse = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(handsScale, {
              duration: 430,
              easing: Easing.inOut(Easing.sin),
              toValue: 1.08,
              useNativeDriver: true,
            }),
            Animated.timing(handsTranslateY, {
              duration: 430,
              easing: Easing.inOut(Easing.sin),
              toValue: -4,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(handsScale, {
              duration: 430,
              easing: Easing.inOut(Easing.sin),
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.timing(handsTranslateY, {
              duration: 430,
              easing: Easing.inOut(Easing.sin),
              toValue: 0,
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
      prayerPulse.start();
    });

    return () => {
      entrance.stop();
      prayerPulse?.stop();
    };
  }, [handsOpacity, handsScale, handsTranslateY, welcomeOpacity, welcomeTranslateY]);

  return (
    <View
      accessibilityLabel="Tuljai Stays splash screen"
      accessible
      pointerEvents="none"
      style={styles.container}
    >
      <StatusBar hidden />
      <Image resizeMode="cover" source={splashArtwork} style={styles.artwork} />

      <View style={styles.welcomeStage}>
        <Animated.View
          style={{
            opacity: welcomeOpacity,
            transform: [{ translateY: welcomeTranslateY }],
          }}
        >
          <Text style={styles.welcome}>Welcome</Text>
          <Text style={styles.brand}>Tuljai Stays</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.prayerBadge,
            {
              opacity: handsOpacity,
              transform: [{ translateY: handsTranslateY }, { scale: handsScale }],
            },
          ]}
        >
          <MaterialCommunityIcons color="#FFFFFF" name="hands-pray" size={39} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  artwork: {
    height: '100%',
    width: '100%',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 38,
    textAlign: 'center',
    textShadowColor: 'rgba(91, 14, 0, 0.9)',
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 6,
  },
  container: {
    backgroundColor: '#F24A00',
    flex: 1,
    overflow: 'hidden',
  },
  prayerBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(116, 24, 0, 0.58)',
    borderColor: 'rgba(255, 229, 169, 0.8)',
    borderRadius: 22,
    borderWidth: 1,
    height: 62,
    justifyContent: 'center',
    marginTop: 12,
    width: 62,
  },
  welcome: {
    color: '#FFE1A0',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 3.2,
    lineHeight: 21,
    textAlign: 'center',
    textShadowColor: 'rgba(91, 14, 0, 0.95)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 5,
    textTransform: 'uppercase',
  },
  welcomeStage: {
    alignItems: 'center',
    bottom: 44,
    left: 24,
    position: 'absolute',
    right: 24,
  },
});
