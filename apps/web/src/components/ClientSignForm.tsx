'use client';

import { MARKETING_CONSENT_LABEL, PV_TITLE } from '@preuvio/shared';
import { palette } from '@preuvio/ui-tokens';
import { useActionState, useEffect, useRef, useState } from 'react';
import { sendSignCode, signPv, type SignState } from '@/app/c/actions';

const ink = palette('light').text;
const primary =
  'min-h-14 rounded-xl bg-action px-4 text-xl font-bold text-on-action disabled:opacity-60';
const secondary =
  'min-h-12 rounded-xl border-2 border-brand bg-surface px-4 text-lg font-bold text-brand disabled:opacity-60';

/** Cadre de signature au doigt (ou à la souris) ; renvoie une image PNG. */
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ink;
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvas}
        aria-label="Cadre de signature : signez avec le doigt"
        className="h-48 w-full touch-none rounded-xl border-2 border-brand bg-surface"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = e.currentTarget.getContext('2d')!;
          const [x, y] = point(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 0.1, y + 0.1);
          ctx.stroke();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d')!;
          const [x, y] = point(e);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          setEmpty(false);
          onChange(e.currentTarget.toDataURL('image/png'));
        }}
      />
      <button
        type="button"
        disabled={empty}
        className="min-h-12 self-start rounded-lg border border-border px-4"
        onClick={() => {
          const c = canvas.current!;
          c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
          setEmpty(true);
          onChange(null);
        }}
      >
        Effacer
      </button>
    </div>
  );
}

/** Signature du PV : sans ou avec réserves, nom, signature, consentement, code SMS facultatif. */
export function ClientSignForm({
  token,
  defaultName,
  requireSms,
  works,
}: {
  token: string;
  defaultName: string;
  requireSms: boolean;
  works: string[];
}) {
  const [state, action, pending] = useActionState<SignState, FormData>(signPv, null);
  const [code, sendCode, sending] = useActionState<SignState, FormData>(sendSignCode, null);
  const [signature, setSignature] = useState<string | null>(null);
  const [reception, setReception] = useState<'none' | 'reserves'>('none');

  if (state?.ok) {
    return (
      <p role="status" className="text-xl font-bold text-ok">
        PV signé. Merci ! Vous le recevez par SMS ou e-mail.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <h3 className="text-xl font-bold">{PV_TITLE}</h3>
        <p>Travaux : {works.join(', ') || 'travaux du chantier'}.</p>
        <p>
          En signant, vous déclarez réceptionner ces travaux, sans réserve ou avec les réserves
          indiquées ci-dessous.
        </p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="signature" value={signature ?? ''} />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-lg font-bold">Réception</legend>
          <label className="flex min-h-12 items-center gap-3 text-lg">
            <input
              type="radio"
              name="reception"
              value="none"
              checked={reception === 'none'}
              onChange={() => setReception('none')}
              className="h-6 w-6"
            />
            Sans réserve
          </label>
          <label className="flex min-h-12 items-center gap-3 text-lg">
            <input
              type="radio"
              name="reception"
              value="reserves"
              checked={reception === 'reserves'}
              onChange={() => setReception('reserves')}
              className="h-6 w-6"
            />
            Avec réserves
          </label>
          {reception === 'reserves' ? (
            <label className="flex flex-col gap-1">
              <span>Vos réserves (tapez ou dictez avec le micro du clavier)</span>
              <textarea
                name="reserves"
                rows={3}
                required
                className="rounded-lg border border-border bg-surface p-3 text-lg"
              />
            </label>
          ) : null}
        </fieldset>
        <label className="flex flex-col gap-1">
          <span className="text-lg font-bold">Votre nom</span>
          <input
            name="signer"
            required
            defaultValue={defaultName}
            autoComplete="name"
            className="min-h-14 rounded-lg border border-border bg-surface px-3 text-lg"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold">Signature</span>
          <SignaturePad onChange={setSignature} />
        </div>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent" className="mt-1 h-6 w-6 shrink-0" />
          <span>{MARKETING_CONSENT_LABEL} (facultatif)</span>
        </label>
        {requireSms ? (
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              formAction={sendCode}
              disabled={sending}
              formNoValidate
              className={`${secondary} self-start`}
            >
              {code?.codeSent ? 'Renvoyer le code' : 'Recevoir le code par SMS'}
            </button>
            {code?.error ? (
              <span role="alert" className="font-bold text-ko">
                {code.error}
              </span>
            ) : null}
            <label className="flex flex-col gap-1">
              <span className="text-lg font-bold">Code reçu par SMS</span>
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                className="min-h-14 rounded-lg border border-border bg-surface px-3 text-center text-2xl tracking-[12px]"
              />
            </label>
          </div>
        ) : null}
        <button disabled={pending || !signature} className={primary}>
          Signer le PV
        </button>
        {state?.error ? (
          <p role="alert" className="text-lg font-bold text-ko">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
