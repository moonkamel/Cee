import { Pressable, View } from 'react-native';
import { t } from '@/i18n/fr';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

type Props =
  | { label: string; type: 'yes_no'; value: boolean | null; onChange: (v: boolean) => void }
  | {
      label: string;
      type: 'number';
      value: number;
      min: number;
      max: number;
      onChange: (v: number) => void;
    };

/** Question rapide (section 7) : gros boutons « Oui / Non » ou « − 2 + », un tap suffit. */
export function QuestionCard(props: Props) {
  const { colors, spacing, sizes, radius } = useTheme();

  const choice = (label: string, selected: boolean, onPress: () => void, disabled = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={props.type === 'number' ? label : `${props.label} ${label}`}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => {
        void haptics.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        flex: props.type === 'yes_no' ? 1 : undefined,
        minWidth: sizes.touchMin + spacing.lg,
        minHeight: sizes.touchMin + spacing.sm,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: colors.brand,
        backgroundColor: selected ? colors.brand : colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      })}
    >
      <AppText variant="button" color={selected ? 'on-action' : 'brand'}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <View
      testID="question-card"
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="help-circle-outline" color="brand" />
        <AppText style={{ flex: 1 }}>{props.label}</AppText>
      </View>
      {props.type === 'yes_no' ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {choice(t('question.yes'), props.value === true, () => props.onChange(true))}
          {choice(t('question.no'), props.value === false, () => props.onChange(false))}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {choice(
            t('question.less'),
            false,
            () => props.onChange(props.value - 1),
            props.value <= props.min,
          )}
          <AppText
            variant="display"
            accessibilityLabel={`${props.label} : ${props.value}`}
            style={{ minWidth: sizes.touchMin, textAlign: 'center' }}
          >
            {String(props.value)}
          </AppText>
          {choice(
            t('question.more'),
            false,
            () => props.onChange(props.value + 1),
            props.value >= props.max,
          )}
        </View>
      )}
    </View>
  );
}
