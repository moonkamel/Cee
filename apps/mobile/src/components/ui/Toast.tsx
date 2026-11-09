import { durations } from '@preuvio/ui-tokens';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';

type Props = {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  /** Bouton « Annuler » pendant 5 secondes : remplace les boîtes « Êtes-vous sûr ? ». */
  onUndo?: () => void;
  durationMs?: number;
};

/** Message non bloquant en bas d'écran. */
export function Toast({
  message,
  visible,
  onDismiss,
  onUndo,
  durationMs = durations.undoMs,
}: Props) {
  const { colors, spacing, radius, sizes } = useTheme();

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs, onDismiss]);

  if (!visible) return null;
  return (
    <View
      testID="toast"
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingLeft: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: colors.text,
      }}
    >
      <AppText color="bg" style={{ flex: 1, paddingVertical: spacing.md }}>
        {message}
      </AppText>
      {onUndo ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('toast.undo')}
          onPress={() => {
            onUndo();
            onDismiss();
          }}
          style={{
            minHeight: sizes.touchMin,
            justifyContent: 'center',
            paddingHorizontal: spacing.lg,
          }}
        >
          <AppText variant="button" color="bg" style={{ textDecorationLine: 'underline' }}>
            {t('toast.undo')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
