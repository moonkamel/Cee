import { Pressable, View } from 'react-native';
import { t } from '@/i18n/fr';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = {
  recording: boolean;
  onRecordStart: () => void;
  onRecordEnd: () => void;
  /** Niveaux sonores récents, de 0 à 1, pour l'onde visible. */
  levels?: number[];
};

/** Appui long pour enregistrer, vibration au début et à la fin, onde sonore visible. */
export function VoiceButton({ recording, onRecordStart, onRecordEnd, levels = [] }: Props) {
  const { colors, sizes, spacing, radius } = useTheme();
  return (
    <Pressable
      testID="voice-button"
      accessibilityRole="button"
      accessibilityLabel={recording ? t('voice.recording') : t('voice.hold')}
      accessibilityState={{ busy: recording }}
      delayLongPress={250}
      onLongPress={() => {
        void haptics.recordEdge();
        onRecordStart();
      }}
      onPressOut={() => {
        if (!recording) return;
        void haptics.recordEdge();
        onRecordEnd();
      }}
      style={{
        minHeight: sizes.bigButton,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: recording ? colors.ko : colors.brand,
        backgroundColor: colors.surface,
      }}
    >
      <Icon
        name={recording ? 'microphone' : 'microphone-outline'}
        color={recording ? 'ko' : 'brand'}
      />
      {recording ? (
        <View
          testID="voice-wave"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, height: 32 }}
        >
          {levels.slice(-24).map((level, i) => (
            <View
              key={i}
              style={{
                width: 4,
                height: Math.max(4, Math.min(1, level) * 32),
                borderRadius: 2,
                backgroundColor: colors.ko,
              }}
            />
          ))}
        </View>
      ) : (
        <AppText variant="button" color="brand" style={{ flex: 1 }}>
          {t('voice.hold')}
        </AppText>
      )}
    </Pressable>
  );
}
