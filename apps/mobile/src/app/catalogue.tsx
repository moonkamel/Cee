import { COLOR_SCHEMES, type ColorScheme } from '@preuvio/ui-tokens';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppText,
  BigButton,
  ChecklistRow,
  EmptyState,
  ProgressRing,
  ProofCard,
  ShutterButton,
  StatusPill,
  Toast,
  VoiceButton,
} from '@/components/ui';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';

// Écran caché (mode développeur) : tous les composants, en clair, sombre et contraste maximal.
export default function Catalogue() {
  if (!__DEV__) return <Redirect href="/" />;
  return <CatalogueContent />;
}

function CatalogueContent() {
  const { colors, spacing, scheme, setSchemeOverride } = useTheme();
  const [recording, setRecording] = useState(false);
  const [toast, setToast] = useState(false);
  const [done, setDone] = useState(7);
  const noop = () => undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 }}
      >
        <AppText variant="title" accessibilityRole="header">
          {t('catalogue.title')}
        </AppText>

        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: spacing.sm }}>
          {COLOR_SCHEMES.map((s: ColorScheme) => (
            <Pressable
              key={s}
              accessibilityRole="radio"
              accessibilityState={{ checked: scheme === s }}
              onPress={() => setSchemeOverride(s)}
              style={{
                flex: 1,
                minHeight: 56,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 12,
                borderWidth: 2,
                borderColor: scheme === s ? colors.action : colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <AppText variant="caption">{t(`scheme.${s}`)}</AppText>
            </Pressable>
          ))}
        </View>

        <Section title="BigButton">
          <BigButton label="Commencer" icon="play" onPress={() => setToast(true)} />
          <BigButton label="Nouveau chantier" variant="secondary" icon="plus" onPress={noop} />
        </Section>

        <Section title="ShutterButton">
          <View style={{ alignItems: 'center' }}>
            <ShutterButton onPress={() => setDone((d) => (d >= 9 ? 0 : d + 1))} />
          </View>
        </Section>

        <Section title="StatusPill">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <StatusPill tone="ok" />
            <StatusPill tone="warn" />
            <StatusPill tone="ko" />
            <StatusPill tone="pending" />
            <StatusPill tone="waived" />
          </View>
        </Section>

        <Section title="ProofCard">
          <ProofCard instruction="Chaudière existante avant dépose" tone="ok" />
          <ProofCard instruction="Plaque de l'unité extérieure" tone="warn" />
          <ProofCard instruction="Raccordement hydraulique" tone="ko" />
        </Section>

        <Section title="ChecklistRow">
          <ChecklistRow
            label="Unité extérieure posée"
            icon="heat-pump-outline"
            tone="ko"
            onPress={noop}
          />
          <ChecklistRow
            label="Plaque signalétique"
            icon="card-text-outline"
            tone="pending"
            onPress={noop}
          />
        </Section>

        <Section title="VoiceButton">
          <VoiceButton
            recording={recording}
            onRecordStart={() => setRecording(true)}
            onRecordEnd={() => setRecording(false)}
            levels={[0.2, 0.5, 0.9, 0.4, 0.7, 0.3, 0.8, 0.6, 0.2, 0.5, 0.9, 0.4]}
          />
        </Section>

        <Section title="ProgressRing">
          <ProgressRing done={done} total={9} />
        </Section>

        <Section title="EmptyState">
          <EmptyState
            icon="calendar-blank-outline"
            title="Aucun chantier aujourd'hui"
            actionLabel="Nouveau chantier"
            onAction={noop}
          />
        </Section>
      </ScrollView>

      <Toast
        visible={toast}
        message="Photo supprimée"
        onUndo={noop}
        onDismiss={() => setToast(false)}
      />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="caption" color="text-muted">
        {title}
      </AppText>
      {children}
    </View>
  );
}
