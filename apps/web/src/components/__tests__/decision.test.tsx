import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecisionForm } from '../DecisionForm';

const decide = vi.fn(async (_s: unknown, form: FormData) => {
  calls.push(Object.fromEntries(form.entries()));
  return { ok: true };
});
const calls: Record<string, unknown>[] = [];
vi.mock('@/app/actions', () => ({ decide: (s: unknown, f: FormData) => decide(s, f) }));

afterEach(() => {
  cleanup();
  calls.length = 0;
});

describe('décision sur une photo orange', () => {
  const props = {
    slotId: 's1',
    jobsiteId: 'j1',
    recipients: [{ id: 'p1', name: 'Jean' }],
    aiMessage: 'Plaque illisible, rapprochez-vous',
  };

  it('« Demander au poseur » envoie le message prérempli par l’IA', async () => {
    render(<DecisionForm {...props} />);
    expect((screen.getByLabelText(/Message/) as HTMLInputElement).value).toBe(
      'Plaque illisible, rapprochez-vous',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Demander au poseur' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Décision enregistrée.'),
    );
    expect(calls[0]).toMatchObject({
      choice: 'retake',
      slotId: 's1',
      jobsiteId: 'j1',
      recipientId: 'p1',
    });
  });

  it('« Valider la photo »', async () => {
    render(<DecisionForm {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Valider la photo' }));
    await waitFor(() => expect(calls[0]).toMatchObject({ choice: 'validate', slotId: 's1' }));
  });
});
