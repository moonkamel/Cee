// Message lisible d'une invitation refusée : limite de l'offre, essai terminé, ou cas général.
export async function inviteErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: { json?: () => Promise<unknown> } })?.context;
  let detail = '';
  try {
    const body = (await context?.json?.()) as { detail?: string; error?: string } | undefined;
    detail = body?.detail ?? body?.error ?? '';
  } catch {
    // corps illisible : message général
  }
  const known = /(Offre limitée[^"]*|Essai terminé[^"]*)/.exec(detail);
  return known?.[1] ?? 'Invitation refusée (numéro déjà inscrit ou droits insuffisants)';
}
