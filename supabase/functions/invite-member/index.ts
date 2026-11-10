// Invitation d'un salarié par SMS (section 14) : réservée à l'admin et au dirigeant.
//
// POST { phone: "+33…", full_name: "…", role?: "installer", team_id?: "…" }
//   1. vérifie le rôle de l'appelant (sa session, donc la RLS) ;
//   2. crée le compte (téléphone, sans mot de passe) avec la clé serveur ;
//   3. crée le profil AVEC LA SESSION DE L'APPELANT : la RLS et les triggers imposent
//      l'entreprise, le droit d'inviter et l'interdiction de nommer un dirigeant ;
//   4. envoie le SMS d'invitation avec un lien qui pré-remplit le numéro dans l'appli.
// Si l'étape 3 échoue, le compte créé à l'étape 2 est supprimé.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { brevoConfigured, sendSms, smsQuotaTake } from '../_shared/brevo.ts';
import { corsHeaders, json } from '../_shared/http.ts';

const ROLES = ['owner', 'admin', 'office', 'lead', 'installer'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const asServer = createClient(url, serviceKey, { auth: { persistSession: false } });

  const body = (await req.json().catch(() => null)) as {
    phone?: string;
    full_name?: string;
    role?: string;
    team_id?: string | null;
  } | null;
  const phone = body?.phone?.trim() ?? '';
  const fullName = body?.full_name?.trim() ?? '';
  const role = body?.role ?? 'installer';
  if (!/^\+33[1-9]\d{8}$/.test(phone) || !fullName || !ROLES.includes(role)) {
    return json(400, { error: 'Numéro (+33…), nom et rôle valides requis' });
  }

  // 1. Qui appelle ?
  const { data: userData } = await asCaller.auth.getUser();
  const callerId = userData.user?.id;
  if (!callerId) return json(401, { error: 'Connexion requise' });
  const { data: caller } = await asCaller
    .from('profiles')
    .select('role, active, company_id, companies ( name )')
    .eq('id', callerId)
    .maybeSingle<{
      role: string;
      active: boolean;
      company_id: string;
      companies: { name: string } | null;
    }>();
  if (!caller?.active || !['admin', 'owner'].includes(caller.role)) {
    return json(403, { error: 'Seuls l’admin et le dirigeant invitent des salariés' });
  }

  // 2. Compte
  const { data: created, error: createError } = await asServer.auth.admin.createUser({
    phone,
    phone_confirm: true,
  });
  if (createError || !created.user) {
    return json(409, { error: 'Ce numéro a déjà un compte Preuvio' });
  }

  // 3. Profil, avec les droits de l'appelant
  const { error: profileError } = await asCaller.from('profiles').insert({
    id: created.user.id,
    full_name: fullName,
    role,
    team_id: body?.team_id ?? null,
    phone,
  });
  if (profileError) {
    await asServer.auth.admin.deleteUser(created.user.id);
    return json(403, { error: 'Invitation refusée', detail: profileError.message });
  }

  // 4. SMS d'invitation
  const link = `preuvio://login?phone=${encodeURIComponent(phone)}`;
  let smsSent = false;
  if (brevoConfigured() && (await smsQuotaTake(asServer, caller.company_id))) {
    try {
      const company = caller.companies?.name ?? 'votre entreprise';
      await sendSms(
        phone,
        `${company} vous invite sur Preuvio. Installez l'appli puis ouvrez : ${link}`,
      );
      smsSent = true;
    } catch (e) {
      console.error('SMS d’invitation non envoyé', e instanceof Error ? e.message : e);
    }
  }

  return json(201, { user_id: created.user.id, sms_sent: smsSent, link });
});
