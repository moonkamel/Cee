import { palette } from '@preuvio/ui-tokens';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Écran provisoire : l'écran « Aujourd'hui » arrive en session S4,
// les composants du design system en session S2.
export default function Home() {
  const colors = palette(useColorScheme() === 'dark' ? 'dark' : 'light');

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.brand }]}>
          Preuvio
        </Text>
        <Text style={[styles.body, { color: colors.text }]}>
          La preuve de pose, sans taper un mot.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '700' },
  body: { fontSize: 18 },
});
