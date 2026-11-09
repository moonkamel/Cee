import Link from 'next/link';
import type { Tiles as TilesData } from '@/lib/dashboard';

/** Quatre tuiles (section 14) : un clic ouvre la liste filtrée. */
export function Tiles({ tiles }: { tiles: TilesData }) {
  const items = [
    {
      label: 'Chantiers en cours',
      value: tiles.inProgress,
      href: '/chantiers?filtre=en-cours',
      alert: false,
      tone: '',
    },
    {
      label: 'Chantiers à risque',
      value: tiles.atRisk,
      href: '/chantiers?filtre=a-risque',
      alert: tiles.atRisk > 0,
      tone: 'ko',
    },
    {
      label: 'Photos à trancher',
      value: tiles.orange,
      href: '/chantiers?filtre=photos-orange',
      alert: tiles.orange > 0,
      tone: 'warn',
    },
    {
      label: 'Lots près du seuil',
      value: tiles.batchesNear,
      href: '/lots',
      alert: tiles.batchesNear > 0,
      tone: 'ko',
    },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((t) => (
        <li key={t.label}>
          <Link
            href={t.href}
            className={`flex min-h-24 flex-col justify-center rounded-xl bg-surface p-4 no-underline ${
              t.alert
                ? t.tone === 'ko'
                  ? 'border-2 border-ko'
                  : 'border-2 border-warn'
                : 'border border-border'
            }`}
          >
            <span
              className={`text-[32px] font-bold ${t.alert ? (t.tone === 'ko' ? 'text-ko' : 'text-warn') : 'text-text'}`}
            >
              {t.value}
            </span>
            <span className="text-base text-text-muted">{t.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
