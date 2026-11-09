'use client';

import { useActionState } from 'react';
import { inviteMember, type FormState } from '@/app/actions';

const field = 'min-h-12 rounded-xl border-2 border-brand bg-surface px-3';

/** Invitation par SMS (section 14) : le salarié touche le lien, il est connecté. */
export function InviteForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(inviteMember, null);
  return (
    <form
      action={action}
      className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-4 sm:items-end"
    >
      <label className="flex flex-col gap-1">
        <span className="text-base text-text-muted">Nom</span>
        <input name="fullName" required className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base text-text-muted">Portable</span>
        <input name="phone" type="tel" required className={field} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-base text-text-muted">Rôle</span>
        <select name="role" defaultValue="installer" className={field}>
          <option value="installer">Poseur</option>
          <option value="lead">Chef d’équipe</option>
          <option value="office">Bureau</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <button
        disabled={pending}
        className="min-h-12 rounded-xl bg-action px-4 font-bold text-on-action"
      >
        Inviter par SMS
      </button>
      {state?.error ? (
        <p role="alert" className="font-bold text-ko sm:col-span-4">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="font-bold text-ok sm:col-span-4">
          Invitation envoyée.
        </p>
      ) : null}
    </form>
  );
}
