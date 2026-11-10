'use client';

import { type RgeRow, WORK_TYPES, type WorkType } from '@preuvio/shared';
import { palette } from '@preuvio/ui-tokens';
import Link from 'next/link';
import { useActionState, useState, useTransition } from 'react';
import {
  createCompany,
  inviteTeam,
  type InviteState,
  lookupSiret,
  sendSignupCode,
  type SignupState,
  verifySignupCode,
} from '@/app/signup-actions';

const field = 'min-h-12 rounded-lg border border-border bg-surface px-3 text-lg';
const big = 'min-h-16 rounded-xl border-2 border-brand bg-surface px-4 text-[24px] font-bold';
const primary =
  'min-h-14 rounded-xl bg-action px-5 text-xl font-bold text-on-action disabled:opacity-60';
const secondary = 'min-h-14 rounded-xl border border-border px-5 text-lg font-bold';

const WORK_LABELS: Record<WorkType, string> = {
  pac_air_eau: 'PAC air/eau',
  combles: 'Isolation des combles',
  murs: 'Isolation des murs',
  vmc: 'VMC',
  biomasse: 'Chaudière biomasse',
  menuiseries: 'Menuiseries',
  photovoltaique: 'Photovoltaïque',
};

function Alert({ text }: { text?: string }) {
  return text ? (
    <p role="alert" className="font-bold text-ko">
      {text}
    </p>
  ) : null;
}

/** Étape 1 : téléphone ou e-mail, puis code de confirmation. */
export function SignupCodeForm() {
  const [sent, send, sending] = useActionState<SignupState, FormData>(sendSignupCode, null);
  const [checked, verify, checking] = useActionState<SignupState, FormData>(verifySignupCode, null);
  if (!sent?.sent) {
    return (
      <form action={send} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-base text-text-muted">Portable ou adresse e-mail</span>
          <input name="contact" required defaultValue={sent?.target} className={big} />
        </label>
        <button disabled={sending} className={primary}>
          Recevoir le code
        </button>
        <Alert text={sent?.error} />
      </form>
    );
  }
  return (
    <form action={verify} className="flex flex-col gap-4">
      <input type="hidden" name="channel" value={sent.channel} />
      <input type="hidden" name="target" value={sent.target} />
      <label className="flex flex-col gap-2">
        <span className="text-base text-text-muted">
          Code reçu {sent.channel === 'email' ? 'par e-mail' : 'par SMS'} ({sent.target})
        </span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          className={`${big} text-center tracking-[12px]`}
        />
      </label>
      <button disabled={checking} className={primary}>
        Confirmer
      </button>
      <Alert text={checked?.error} />
    </form>
  );
}

type Rge = { organisme: string; numero: string; domaines: string[]; date_fin?: string | null };

/** Étapes 2 à 5 : SIRET, qualifications RGE, métiers, logo et couleur, puis votre nom. */
export function CompanyWizard() {
  const [state, action, pending] = useActionState<SignupState, FormData>(createCompany, null);
  const [step, setStep] = useState(1);
  const [siret, setSiret] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [ademe, setAdeme] = useState<RgeRow[] | null>(null);
  const [rge, setRge] = useState<Rge[]>([{ organisme: '', numero: '', domaines: [] }]);
  const [work, setWork] = useState<WorkType[]>([]);
  const [looking, startLookup] = useTransition();

  const lookup = () =>
    startLookup(async () => {
      const found = await lookupSiret(siret);
      if (found.error) {
        setLookupError(found.error);
        return;
      }
      setLookupError(found.identity ? null : 'Entreprise non trouvée : saisissez son nom');
      if (found.identity) {
        setName(found.identity.name);
        setAddress(found.identity.address ?? '');
      }
      setAdeme(found.rge ?? []);
      if (found.rge?.length) {
        setRge(
          found.rge.map((r) => ({
            organisme: r.organisme,
            numero: r.numero ?? '',
            domaines: [r.domaine],
            date_fin: r.dateFin,
          })),
        );
      }
      setStep(2);
    });

  const kept = rge.filter((r) => r.organisme.trim());
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="siret" value={siret} />
      <input type="hidden" name="rge" value={JSON.stringify(kept)} />
      {work.map((w) => (
        <input key={w} type="hidden" name="workType" value={w} />
      ))}
      <p className="text-base text-text-muted">Étape {step} sur 5</p>

      <section hidden={step !== 1} className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Votre entreprise</h2>
        <label className="flex flex-col gap-1">
          <span className="font-bold">SIRET</span>
          <input
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            inputMode="numeric"
            className={field}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={lookup} disabled={looking} className={primary}>
            Rechercher
          </button>
          <button type="button" onClick={() => setStep(2)} className={secondary}>
            Pas de SIRET pour l’instant
          </button>
        </div>
        <Alert text={lookupError ?? undefined} />
      </section>

      <section hidden={step !== 2} className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Nom et qualifications RGE</h2>
        <label className="flex flex-col gap-1">
          <span className="font-bold">Nom de l’entreprise</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">Adresse</span>
          <input
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={field}
          />
        </label>
        {ademe ? (
          <p className={ademe.length ? 'font-bold text-ok' : 'text-text-muted'}>
            {ademe.length
              ? `✓ ${ademe.length} qualification(s) trouvée(s) dans la liste RGE de l’ADEME`
              : 'Aucune qualification trouvée dans la liste ADEME : saisissez-les.'}
          </p>
        ) : null}
        {rge.map((r, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <input
              aria-label="Organisme"
              placeholder="Organisme (Qualibat…)"
              value={r.organisme}
              onChange={(e) =>
                setRge(rge.map((x, j) => (j === i ? { ...x, organisme: e.target.value } : x)))
              }
              className={`${field} flex-1`}
            />
            <input
              aria-label="Numéro"
              placeholder="Numéro"
              value={r.numero}
              onChange={(e) =>
                setRge(rge.map((x, j) => (j === i ? { ...x, numero: e.target.value } : x)))
              }
              className={`${field} flex-1`}
            />
          </div>
        ))}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setRge([...rge, { organisme: '', numero: '', domaines: [] }])}
            className={secondary}
          >
            Ajouter une qualification
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => setStep(3)}
            className={primary}
          >
            Continuer
          </button>
        </div>
      </section>

      <section hidden={step !== 3} className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Vos métiers</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {WORK_TYPES.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={work.includes(w)}
              onClick={() => setWork(work.includes(w) ? work.filter((x) => x !== w) : [...work, w])}
              className={`min-h-20 rounded-xl border-2 px-3 text-lg font-bold ${
                work.includes(w) ? 'border-brand bg-brand text-surface' : 'border-border bg-surface'
              }`}
            >
              {work.includes(w) ? '✓ ' : ''}
              {WORK_LABELS[w]}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setStep(4)} className={primary}>
          Continuer
        </button>
      </section>

      <section hidden={step !== 4} className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Logo et couleur (facultatif)</h2>
        <label className="flex flex-col gap-1">
          <span className="font-bold">Logo (PNG ou JPEG, 2 Mo au plus)</span>
          <input name="logo" type="file" accept="image/png,image/jpeg" className="min-h-12" />
        </label>
        <label className="flex items-center gap-3">
          <span className="font-bold">Couleur de l’entreprise</span>
          <input
            name="color"
            type="color"
            defaultValue={palette('light').brand}
            className="h-12 w-20"
          />
        </label>
        <button type="button" onClick={() => setStep(5)} className={primary}>
          Continuer
        </button>
      </section>

      <section hidden={step !== 5} className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Vous</h2>
        <label className="flex flex-col gap-1">
          <span className="font-bold">Votre nom</span>
          <input name="fullName" autoComplete="name" className={field} />
        </label>
        <p className="text-text-muted">
          Essai gratuit de 30 jours ou 10 chantiers, sans carte bancaire. Un chantier de
          démonstration vous attend.
        </p>
        <button disabled={pending} className={primary}>
          {pending ? 'Création…' : 'Créer mon entreprise'}
        </button>
      </section>

      {step > 1 ? (
        <button type="button" onClick={() => setStep(step - 1)} className="self-start underline">
          ← Étape précédente
        </button>
      ) : null}
      <Alert text={state?.error} />
    </form>
  );
}

/** Étape 6 : invitation des poseurs par SMS. */
export function TeamInviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteTeam, null);
  const [rows, setRows] = useState(3);
  if (state?.results) {
    return (
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {state.results.map((r, i) => (
            <li key={i} className={`font-bold ${r.ok ? 'text-ok' : 'text-ko'}`}>
              {r.phone} : {r.message}
            </li>
          ))}
        </ul>
        <Link href="/" className={`${primary} flex items-center justify-center no-underline`}>
          Ouvrir le tableau de bord
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-wrap gap-2">
          <input name="fullName" placeholder="Nom du poseur" className={`${field} flex-1`} />
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="06…"
            className={`${field} flex-1`}
          />
        </div>
      ))}
      <button type="button" onClick={() => setRows(rows + 1)} className={`${secondary} self-start`}>
        Ajouter une ligne
      </button>
      <div className="flex flex-wrap gap-3">
        <button disabled={pending} className={primary}>
          Inviter par SMS
        </button>
        <Link href="/" className={`${secondary} flex items-center no-underline`}>
          Plus tard
        </Link>
      </div>
      <Alert text={state?.error} />
    </form>
  );
}
