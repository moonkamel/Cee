import { arrowHead, bounds, parseAnnotations } from '@preuvio/shared';

/** Photo avec son calque d'annotations (jamais fusionné avec l'original). */
export function AnnotatedPhoto({
  src,
  alt,
  annotations,
}: {
  src: string;
  alt: string;
  annotations: unknown;
}) {
  const shapes = parseAnnotations(annotations);
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-border">
      {/* eslint-disable-next-line @next/next/no-img-element -- lien signé de 5 minutes, pas d'optimisation */}
      <img src={src} alt={alt} className="block w-full" />
      {shapes.length > 0 ? (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full text-warn"
          aria-hidden
        >
          {shapes.map((a, i) => {
            if (a.type === 'text') {
              return (
                <text
                  key={i}
                  x={a.at.x * 100}
                  y={a.at.y * 100}
                  fill="currentColor"
                  fontSize="5"
                  fontWeight="bold"
                >
                  {a.text}
                </text>
              );
            }
            if (a.type === 'arrow') {
              const [l, r] = arrowHead(a.from, a.to);
              const p = (q: { x: number; y: number }) => `${q.x * 100},${q.y * 100}`;
              return (
                <polyline
                  key={i}
                  points={`${p(a.from)} ${p(a.to)} ${p(l)} ${p(a.to)} ${p(r)}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            const b = bounds(a.from, a.to);
            return a.type === 'rect' ? (
              <rect
                key={i}
                x={b.x * 100}
                y={b.y * 100}
                width={b.width * 100}
                height={b.height * 100}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <ellipse
                key={i}
                cx={(b.x + b.width / 2) * 100}
                cy={(b.y + b.height / 2) * 100}
                rx={(b.width / 2) * 100}
                ry={(b.height / 2) * 100}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}
