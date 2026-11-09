import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/auth';
import { Icon, type IconName } from '@/components/ui';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';

// Trois onglets au maximum en mode Poseur (section 3) : Aujourd'hui, Chantiers, Moi.
export default function TabsLayout() {
  const { status } = useAuth();
  const { colors, fontFamily, sizes } = useTheme();
  const insets = useSafeAreaInsets();

  // Ouvrir l'appli, c'est être prêt (principe 3) : connecté, on arrive droit sur « Aujourd'hui ».
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/welcome" />;

  const icon = (name: IconName) =>
    function TabIcon({ focused }: { focused: boolean }) {
      return <Icon name={name} color={focused ? 'action' : 'text-muted'} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.action,
        tabBarInactiveTintColor: colors['text-muted'],
        tabBarLabelStyle: { fontFamily: fontFamily.bold, fontSize: 16 },
        tabBarStyle: {
          height: sizes.touchMin + 20 + insets.bottom,
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.today'), tabBarIcon: icon('calendar-today') }}
      />
      <Tabs.Screen
        name="jobsites"
        options={{ title: t('tabs.jobsites'), tabBarIcon: icon('home-city-outline') }}
      />
      <Tabs.Screen
        name="me"
        options={{ title: t('tabs.me'), tabBarIcon: icon('account-circle-outline') }}
      />
    </Tabs>
  );
}
