import { View } from 'react-native';
import { AppText, Icon } from '@/components/ui';
import type { VoiceNote } from '@/data/types';
import { t } from '@/i18n/fr';
import { formatTime } from '@/lib/format';
import { useTheme } from '@/theme/theme';

/** Notes du chantier : texte transcrit, ou « Transcription en attente » hors ligne. */
export function VoiceNotesList({ notes }: { notes: VoiceNote[] }) {
  const { colors, spacing, radius } = useTheme();
  if (notes.length === 0) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="button" accessibilityRole="header">
        {t('voice.notes')}
      </AppText>
      {notes.map((n) => (
        <View
          key={n.id}
          testID="voice-note"
          style={{
            gap: spacing.xs,
            padding: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="microphone-outline" color="text-muted" />
            <AppText variant="caption" color="text-muted">
              {[
                n.createdAt ? formatTime(n.createdAt) : null,
                t('voice.duration', { s: Math.round(n.durationS) }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </View>
          {n.text ? (
            <AppText>{n.text}</AppText>
          ) : (
            <AppText color="text-muted">
              {n.status === 'failed' ? t('voice.failed') : t('voice.pending')}
            </AppText>
          )}
          {n.items.map((i, k) => (
            <AppText key={k} variant="caption" color={i.kind === 'problem' ? 'warn' : 'text-muted'}>
              {i.kind === 'problem'
                ? t('voice.problem', { summary: i.summary })
                : t('voice.material', {
                    summary: [i.quantity, i.unit, i.summary]
                      .filter((v) => v !== null && v !== '')
                      .join(' '),
                  })}
            </AppText>
          ))}
        </View>
      ))}
    </View>
  );
}
