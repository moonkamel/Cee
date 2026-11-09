import type { JobsiteState } from '@preuvio/shared';
import { CheckCircle2, CircleAlert, CircleDashed } from 'lucide-react';

const STATES: Record<JobsiteState, { word: string; className: string; Icon: typeof CheckCircle2 }> =
  {
    complete: { word: 'Complet', className: 'border-ok text-ok', Icon: CheckCircle2 },
    to_complete: {
      word: 'À compléter',
      className: 'border-border text-text-muted',
      Icon: CircleDashed,
    },
    at_risk: { word: 'À risque', className: 'border-ko text-ko', Icon: CircleAlert },
  };

/** État d'un chantier : toujours icône, mot et couleur, jamais la couleur seule (section 3). */
export function StatePill({ state }: { state: JobsiteState }) {
  const { word, className, Icon } = STATES[state];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 text-base font-bold ${className}`}
    >
      <Icon aria-hidden className="size-4" />
      {word}
    </span>
  );
}
