'use client';

import {
  MARKETING_TONES,
  type MarketingCaptions,
  type MarketingTone,
  shareFileName,
  TONE_LABELS,
} from '@preuvio/shared';
import { useActionState, useEffect, useState } from 'react';
import type { FormState } from '@/app/actions';
import { decideMarketing } from '@/app/marketing-actions';

const field = 'min-h-12 rounded-lg border border-border bg-surface px-3';
const primary =
  'min-h-12 rounded-xl bg-action px-4 text-lg font-bold text-on-action disabled:opacity-60';
const secondary = 'min-h-12 rounded-xl border border-border px-4 font-bold disabled:opacity-60';

/** Ton et légende : changer de ton reprend la légende de l'IA, tant qu'elle n'est pas retouchée. */
export function MarketingReviewForm({
  id,
  captions,
  tone,
}: {
  id: string;
  captions: Partial<MarketingCaptions>;
  tone: MarketingTone;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideMarketing, null);
  const [current, setCurrent] = useState<MarketingTone>(tone);
  const [caption, setCaption] = useState(captions[tone] ?? '');
  const [edited, setEdited] = useState(false);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 font-bold">Ton de la légende</legend>
        {MARKETING_TONES.map((t) => (
          <label
            key={t}
            className="flex min-h-12 items-center gap-2 rounded-lg border border-border px-3"
          >
            <input
              type="radio"
              name="tone"
              value={t}
              checked={current === t}
              onChange={() => {
                setCurrent(t);
                if (!edited) setCaption(captions[t] ?? '');
              }}
              className="h-5 w-5"
            />
            {TONE_LABELS[t]}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="font-bold">Légende</span>
        <textarea
          name="caption"
          rows={4}
          value={caption}
          onChange={(e) => {
            setCaption(e.target.value);
            setEdited(true);
          }}
          className={`${field} py-2`}
        />
        <span className="text-base text-text-muted">Jamais d’adresse ni de nom du client.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button name="decision" value="publish" disabled={pending} className={primary}>
          Publier
        </button>
        <button name="decision" value="ignore" disabled={pending} className={secondary}>
          Ignorer
        </button>
        {state?.error ? (
          <span role="alert" className="font-bold text-ko">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

type Files = { square: File; story: File } | null;

/**
 * Partage natif du téléphone (V1) vers n'importe quelle appli, sinon téléchargement. Les visuels
 * sont chargés à l'avance : le navigateur n'accepte le partage que juste après le toucher.
 */
export function MarketingShare({
  id,
  company,
  caption,
}: {
  id: string;
  company: string;
  caption: string;
}) {
  const [files, setFiles] = useState<Files>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async (format: 'square' | 'story') => {
      const blob = await (await fetch(`/marketing/${id}/${format}`)).blob();
      return new File([blob], shareFileName(company, format), { type: 'image/jpeg' });
    };
    Promise.all([load('square'), load('story')])
      .then(([square, story]) => alive && setFiles({ square, story }))
      .catch(() => alive && setFiles(null));
    return () => {
      alive = false;
    };
  }, [id, company]);

  const canShare =
    files !== null &&
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [files.square] });

  const share = async (file: File) => {
    try {
      await navigator.share({ files: [file], text: caption });
    } catch {
      // partage annulé par l'utilisateur
    }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(caption);
    setMessage('Légende copiée');
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      {canShare ? (
        <>
          <button type="button" className={primary} onClick={() => share(files.square)}>
            Partager le carré
          </button>
          <button type="button" className={secondary} onClick={() => share(files.story)}>
            Partager le vertical
          </button>
        </>
      ) : null}
      <a
        href={`/marketing/${id}/square?telecharger=1`}
        className={`${secondary} flex items-center no-underline`}
      >
        Télécharger le carré
      </a>
      <a
        href={`/marketing/${id}/story?telecharger=1`}
        className={`${secondary} flex items-center no-underline`}
      >
        Télécharger le vertical
      </a>
      <button type="button" className={secondary} onClick={copy}>
        Copier la légende
      </button>
      {message ? (
        <span role="status" className="font-bold text-ok">
          {message}
        </span>
      ) : null}
    </div>
  );
}
