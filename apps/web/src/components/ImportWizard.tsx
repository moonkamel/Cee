'use client';

import {
  guessMapping,
  type ImportField,
  IMPORT_FIELDS,
  IMPORT_LABELS,
  mapRows,
  parseCsv,
} from '@preuvio/shared';
import { useActionState, useMemo, useState } from 'react';
import { importJobsites, type ImportState } from '@/app/exports-actions';

const field = 'min-h-12 rounded-lg border border-border bg-surface px-3';

/** Import CSV en trois temps : fichier, correspondance des colonnes, contrôle puis import. */
export function ImportWizard() {
  const [csv, setCsv] = useState('');
  const [mapping, setMapping] = useState<(ImportField | null)[]>([]);
  const [state, action, pending] = useActionState<ImportState, FormData>(importJobsites, null);
  const rows = useMemo(() => parseCsv(csv), [csv]);
  const header = rows[0] ?? [];
  const check = useMemo(
    () => (rows.length > 1 ? mapRows(rows.slice(1), mapping) : null),
    [rows, mapping],
  );

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="text-xl font-bold">1. Fichier CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="min-h-12"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            const text = file ? await file.text() : '';
            setCsv(text);
            setMapping(guessMapping(parseCsv(text)[0] ?? []));
          }}
        />
      </label>

      {header.length ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-xl font-bold">2. Correspondance des colonnes</legend>
          {header.map((h, i) => (
            <label key={i} className="flex flex-wrap items-center gap-3">
              <span className="min-w-48 font-bold">{h || `Colonne ${i + 1}`}</span>
              <select
                value={mapping[i] ?? ''}
                onChange={(e) => {
                  const next = [...mapping];
                  const value = (e.target.value || null) as ImportField | null;
                  // Un champ ne se relie qu'à une colonne.
                  next.forEach((m, j) => {
                    if (value && m === value) next[j] = null;
                  });
                  next[i] = value;
                  setMapping(next);
                }}
                className={field}
              >
                <option value="">Ne pas importer</option>
                {IMPORT_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {IMPORT_LABELS[f]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      ) : null}

      {check ? (
        <form action={action} className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">3. Contrôle</h2>
          <input type="hidden" name="csv" value={csv} />
          <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
          <p>
            <span className="font-bold text-ok">{check.rows.length} chantier(s) prêt(s)</span>
            {check.errors.length ? (
              <span className="font-bold text-ko">
                {' '}
                · {check.errors.length} ligne(s) écartée(s)
              </span>
            ) : null}
          </p>
          {!mapping.includes('adresse') ? (
            <p role="alert" className="font-bold text-ko">
              Reliez la colonne de l’adresse.
            </p>
          ) : null}
          <ul className="flex flex-col gap-1">
            {check.errors.map((e) => (
              <li key={e.line} className="text-ko">
                Ligne {e.line} : {e.message}
              </li>
            ))}
          </ul>
          <button
            disabled={pending || check.rows.length === 0 || !mapping.includes('adresse')}
            className="min-h-12 self-start rounded-xl bg-action px-4 text-lg font-bold text-on-action disabled:opacity-60"
          >
            {pending ? 'Import en cours…' : `Importer ${check.rows.length} chantier(s)`}
          </button>
        </form>
      ) : null}

      {state?.error ? (
        <p role="alert" className="font-bold text-ko">
          {state.error}
        </p>
      ) : null}
      {state?.created ? (
        <section role="status" className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-ok">{state.created.length} chantier(s) créé(s)</h2>
          <ul className="flex flex-col gap-1">
            {state.created.map((c) => (
              <li key={c.line}>
                {c.label} · {c.address}
                {c.located ? '' : ' · adresse non trouvée dans la BAN : à vérifier'}
              </li>
            ))}
            {state.rejected?.map((r) => (
              <li key={`r${r.line}`} className="text-ko">
                Ligne {r.line} : {r.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
