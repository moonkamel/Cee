'use server';

import { captionLeaks, cleanCaption, isTone, permissions } from '@preuvio/shared';
import { revalidatePath } from 'next/cache';
import { currentUser } from '@/lib/dal';
import { supabaseServer } from '@/lib/supabase/server';
import type { FormState } from './actions';

// File « À valider » des contenus marketing (section 13) : rien n'est publié sans le dirigeant
// ou l'admin. « Publier » enregistre la légende retenue ; le partage se fait ensuite depuis le
// téléphone (partage natif) ou par téléchargement.

export async function decideMarketing(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!permissions(user.role).marketing) return { error: 'Réservé à l’admin et au dirigeant' };
  const id = String(form.get('id') ?? '');
  const supabase = await supabaseServer();

  if (form.get('decision') === 'ignore') {
    const { error } = await supabase
      .from('marketing_assets')
      .update({ status: 'ignored' })
      .eq('id', id);
    if (error) return { error: 'Contenu déjà traité' };
    revalidatePath('/marketing');
    return { ok: true };
  }

  const tone = form.get('tone');
  if (!isTone(tone)) return { error: 'Choisissez un ton' };
  const caption = cleanCaption(String(form.get('caption') ?? ''));
  if (!caption) return { error: 'La légende est vide' };
  const { data: asset } = await supabase
    .from('marketing_assets')
    .select('jobsites ( address, clients ( full_name ) )')
    .eq('id', id)
    .maybeSingle();
  const jobsite = asset?.jobsites as unknown as {
    address: string;
    clients: { full_name: string } | null;
  } | null;
  if (!jobsite) return { error: 'Contenu introuvable' };
  if (captionLeaks(caption, { address: jobsite.address, client: jobsite.clients?.full_name })) {
    return { error: 'Retirez l’adresse et le nom du client de la légende' };
  }
  const { error } = await supabase
    .from('marketing_assets')
    .update({ status: 'published', tone, generated_text: caption })
    .eq('id', id);
  if (error) return { error: 'Contenu déjà traité' };
  revalidatePath('/marketing');
  return { ok: true };
}
