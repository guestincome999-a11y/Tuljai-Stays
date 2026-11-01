import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import templeArtwork from '../../assets/owner-temple-login.png';
import { ownerColors } from '../owner-ui/theme';

export function OwnerSplashScreen() {
  return (
    <ImageBackground
      accessibilityLabel="Tuljai Stays Owner"
      source={templeArtwork}
      resizeMode="cover"
      style={styles.screen}
    >
      <StatusBar style="light" />
      <SafeAreaView edges={['top', 'bottom']} style={styles.content}>
        <View style={styles.brand}>
          <MaterialCommunityIcons color="#F4D9B6" name="temple-hindu" size={48} />
          <Text style={styles.name}>Tuljai Stays</Text>
          <Text style={styles.caption}>तुळजाई · Lodge Owner</Text>
          <ActivityIndicator color="#F4D9B6" style={{ marginTop: 24 }} />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ownerColors.deep },
  content: { flex: 1, justifyContent: 'flex-end', padding: 28 },
  brand: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  name: { color: '#FFFFFF', fontSize: 30, fontWeight: '700' },
  caption: { color: '#F4D9B6', fontSize: 16 },
});
