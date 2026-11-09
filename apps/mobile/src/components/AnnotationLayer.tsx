import { arrowHead, bounds, type Annotation } from '@preuvio/shared';
import Svg, { Ellipse, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/theme';

/** Calque d'annotations dessiné par-dessus la photo (jamais fusionné avec elle). */
export function AnnotationLayer({
  annotations,
  width,
  height,
}: {
  annotations: Annotation[];
  width: number;
  height: number;
}) {
  const { colors } = useTheme();
  const stroke = colors.warn;
  const sw = Math.max(3, width / 120);
  const px = (p: { x: number; y: number }) => ({ x: p.x * width, y: p.y * height });
  return (
    <Svg
      testID="annotation-layer"
      width={width}
      height={height}
      style={{ position: 'absolute', left: 0, top: 0 }}
      pointerEvents="none"
    >
      {annotations.map((a, i) => {
        if (a.type === 'text') {
          const at = px(a.at);
          return (
            <SvgText
              key={i}
              x={at.x}
              y={at.y}
              fill={stroke}
              stroke={colors.surface}
              strokeWidth={1}
              fontSize={Math.max(18, width / 18)}
              fontWeight="bold"
            >
              {a.text}
            </SvgText>
          );
        }
        if (a.type === 'arrow') {
          const [l, r] = arrowHead(a.from, a.to).map(px);
          const from = px(a.from);
          const to = px(a.to);
          return [
            <Line
              key={`${i}a`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={stroke}
              strokeWidth={sw}
            />,
            <Line
              key={`${i}b`}
              x1={to.x}
              y1={to.y}
              x2={l!.x}
              y2={l!.y}
              stroke={stroke}
              strokeWidth={sw}
            />,
            <Line
              key={`${i}c`}
              x1={to.x}
              y1={to.y}
              x2={r!.x}
              y2={r!.y}
              stroke={stroke}
              strokeWidth={sw}
            />,
          ];
        }
        const b = bounds(a.from, a.to);
        return a.type === 'rect' ? (
          <Rect
            key={i}
            x={b.x * width}
            y={b.y * height}
            width={b.width * width}
            height={b.height * height}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
        ) : (
          <Ellipse
            key={i}
            cx={(b.x + b.width / 2) * width}
            cy={(b.y + b.height / 2) * height}
            rx={(b.width / 2) * width}
            ry={(b.height / 2) * height}
            stroke={stroke}
            strokeWidth={sw}
            fill="none"
          />
        );
      })}
    </Svg>
  );
}
