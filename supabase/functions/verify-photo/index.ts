// Contrôle d'un fichier photo envoyé (section 6, S7). Voir docs/decisions/0002-envoi-photos.md.
//
// POST { photo_id: "…" }
//   1. lit la fiche AVEC LA SESSION DE L'APPELANT : la RLS dit s'il a le droit de la voir ;
//   2. télécharge le fichier avec la clé serveur et calcule son SHA-256 ;
//   3. même empreinte que celle calculée par le téléphone : la fiche passe « verified »
//      (seule la clé serveur le peut, voir la migration photo_upload_guard) ;
//      empreinte différente : le fichier abîmé est retiré pour que le téléphone le renvoie.
// Réponses : 200 verified · 404 missing (fiche ou fichier absent) · 409 mismatch.
// Une photo déjà vérifiée n'est jamais retéléchargée ni retirée.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/http.ts';

const BUCKET = 'photos';

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const asServer = createClient(url, serviceKey, { auth: { persistSession: false } });

  const body = (await req.json().catch(() => null)) as { photo_id?: string } | null;
  const photoId = body?.photo_id ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(photoId)) return json(400, { error: 'photo_id requis' });

  // 1. La fiche, telle que l'appelant la voit
  const { data: photo, error } = await asCaller
    .from('photos')
    .select('id, sha256, original_path, upload_status')
    .eq('id', photoId)
    .maybeSingle<{ id: string; sha256: string; original_path: string; upload_status: string }>();
  if (error) return json(401, { error: 'Connexion requise' });
  if (!photo) return json(404, { status: 'missing', error: 'Fiche introuvable' });
  if (photo.upload_status === 'verified') return json(200, { status: 'verified' });

  // 2. Le fichier
  const { data: file } = await asServer.storage.from(BUCKET).download(photo.original_path);
  if (!file) return json(404, { status: 'missing', error: 'Fichier absent' });
  const actual = await sha256Hex(await file.arrayBuffer());

  // 3. Verdict
  if (actual !== photo.sha256) {
    await asServer.storage.from(BUCKET).remove([photo.original_path]);
    return json(409, { status: 'mismatch', error: 'Empreinte différente, fichier à renvoyer' });
  }
  const { error: updateError } = await asServer
    .from('photos')
    .update({ upload_status: 'verified' })
    .eq('id', photo.id);
  if (updateError) return json(500, { error: 'Enregistrement impossible' });
  return json(200, { status: 'verified' });
});
