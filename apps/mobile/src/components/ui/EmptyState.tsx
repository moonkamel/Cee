import { View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { BigButton } from './BigButton';
import { Icon, type IconName } from './Icon';

type Props = { icon: IconName; title: string; actionLabel: string; onAction: () => void };

/** Illustration simple et une seule action proposée. */
export function EmptyState({ icon, title, actionLabel, onAction }: Props) {
  const { spacing } = useTheme();
  return (
    <View
      testID="empty-state"
      style={{ alignItems: 'center', gap: spacing.xl, padding: spacing.xl }}
    >
      <Icon name={icon} color="brand" size={96} />
      <AppText variant="title" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      <BigButton label={actionLabel} onPress={onAction} />
    </View>
  );
}
