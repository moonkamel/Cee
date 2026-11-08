import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { t } from '@/i18n/fr';
import { useTheme } from '@/theme/theme';
import { AppText } from './AppText';

/** « 7 sur 9 preuves », visible en permanence en mode guidé. */
export function ProgressRing({
  done,
  total,
  size = 96,
}: {
  done: number;
  total: number;
  size?: number;
}) {
  const { colors } = useTheme();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const complete = total > 0 && done >= total;
  const label = t('progress.label', { done, total });

  return (
    <View
      testID="progress-ring"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: done }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={complete ? colors.ok : colors.action}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <AppText variant="title">{`${done}/${total}`}</AppText>
    </View>
  );
}
