'use client';

import { useActionState } from 'react';
import { sendCode, verifyCode, type FormState } from '@/app/actions';

const field = 'min-h-16 rounded-xl border-2 border-brand bg-surface px-4 text-[24px] font-bold';
const primary =
  'min-h-16 rounded-xl bg-action px-4 text-xl font-bold text-on-action disabled:opacity-60';

/** Connexion par code SMS, sans mot de passe (section 14). */
export function LoginForm() {
  const [sent, send, sending] = useActionState<FormState, FormData>(sendCode, null);
  const [checked, verify, checking] = useActionState<FormState, FormData>(verifyCode, null);

  if (!sent?.ok) {
    return (
      <form action={send} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-base text-text-muted">Numéro de portable</span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required
            defaultValue={sent?.phone}
            className={field}
          />
        </label>
        <button disabled={sending} className={primary}>
          Recevoir le code
        </button>
        {sent?.error ? (
          <p role="alert" className="font-bold text-ko">
            {sent.error}
          </p>
        ) : null}
      </form>
    );
  }
  return (
    <form action={verify} className="flex flex-col gap-4">
      <input type="hidden" name="phone" value={sent.phone} />
      <label className="flex flex-col gap-2">
        <span className="text-base text-text-muted">Code reçu par SMS</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          className={`${field} text-center tracking-[12px]`}
        />
      </label>
      <button disabled={checking} className={primary}>
        Se connecter
      </button>
      {checked?.error ? (
        <p role="alert" className="font-bold text-ko">
          {checked.error}
        </p>
      ) : null}
    </form>
  );
}
