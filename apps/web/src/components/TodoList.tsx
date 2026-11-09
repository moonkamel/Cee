import type { TodoItem } from '@preuvio/shared';
import { Camera, ClipboardCheck, Package, TriangleAlert, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { markItemDone, validateWaiver } from '@/app/actions';

const KIND = {
  orange_photo: { word: 'Photo à trancher', Icon: Camera, tone: 'text-warn' },
  finished_incomplete: { word: 'Terminé avec des manques', Icon: TriangleAlert, tone: 'text-ko' },
  waiver: { word: 'Dispense à valider', Icon: ClipboardCheck, tone: 'text-warn' },
  problem: { word: 'Problème signalé', Icon: TriangleAlert, tone: 'text-ko' },
  material: { word: 'À commander', Icon: Package, tone: 'text-text-muted' },
} as const;

const button =
  'inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-brand px-4 font-bold text-brand';

/** Liste « À traiter » (section 14), triée par gravité, avec l'action directe de chaque ligne. */
export function TodoList({ items, canDecide }: { items: TodoItem[]; canDecide: boolean }) {
  if (items.length === 0) return <p className="text-text-muted">Rien à traiter pour le moment.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const { word, Icon, tone } = KIND[item.kind];
        return (
          <li
            key={`${item.kind}-${item.id}`}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center"
          >
            <div className="flex flex-1 flex-col gap-1">
              <span className={`inline-flex items-center gap-1 text-base font-bold ${tone}`}>
                <Icon aria-hidden className="size-4" />
                {word}
                {item.keptByInstaller ? (
                  <span className="font-normal text-text-muted"> · gardée par le poseur</span>
                ) : null}
              </span>
              <span className="text-lg font-bold">{item.title}</span>
              <Link href={`/chantiers/${item.jobsiteId}`} className="text-base">
                {item.jobsiteLabel}
              </Link>
              {item.detail ? (
                <span className="text-base text-text-muted">{item.detail}</span>
              ) : null}
            </div>
            {item.kind === 'orange_photo' && canDecide ? (
              <Link
                href={`/preuves/${item.id}`}
                className={`${button} bg-action text-on-action border-action no-underline`}
              >
                Trancher
              </Link>
            ) : null}
            {item.kind === 'waiver' && canDecide ? (
              <form action={validateWaiver}>
                <input type="hidden" name="slotId" value={item.id} />
                <button className={button}>Valider la dispense</button>
              </form>
            ) : null}
            {(item.kind === 'problem' || item.kind === 'material') && canDecide ? (
              <form action={markItemDone}>
                <input type="hidden" name="itemId" value={item.id} />
                <button className={button}>
                  {item.kind === 'material' ? 'Commandé' : 'Traité'}
                </button>
              </form>
            ) : null}
            {item.kind === 'finished_incomplete' ? (
              <Link href={`/chantiers/${item.jobsiteId}`} className={`${button} no-underline`}>
                <Undo2 aria-hidden className="mr-1 size-4" /> Voir les manques
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
