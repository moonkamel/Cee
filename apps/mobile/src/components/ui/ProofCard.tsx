import type { ProofTone } from '@preuvio/shared';
import { Image, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { StatusPill } from './StatusPill';

type Props = { instruction: string; tone: ProofTone; thumbnailUri?: string };

/** Vignette de la photo, consigne et statut d'une preuve. */
export function ProofCard({ instruction, tone, thumbnailUri }: Props) {
  const { colors, radius, spacing, sizes } = useTheme();
  const thumb = { width: sizes.thumbnail, height: sizes.thumbnail, borderRadius: radius.sm };
  return (
    <View
      testID="proof-card"
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {thumbnailUri ? (
        <Image source={{ uri: thumbnailUri }} style={thumb} accessibilityIgnoresInvertColors />
      ) : (
        <View
          style={[
            thumb,
            { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
          ]}
        >
          <Icon name="camera-outline" color="text-muted" />
        </View>
      )}
      <View style={{ flex: 1, gap: spacing.sm }}>
        <AppText>{instruction}</AppText>
        <StatusPill tone={tone} />
      </View>
    </View>
  );
}
