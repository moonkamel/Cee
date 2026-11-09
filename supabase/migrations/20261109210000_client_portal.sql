-- Page client et PV de réception (section 12, S16). Le client n'a pas de compte : tout passe par
-- un jeton de lien (32 octets aléatoires, stocké haché), vérifié par des fonctions réservées au
-- serveur (Edge Function client-portal). Le PV signé n'est jamais modifié ; son PDF y est attaché
-- une seule fois.

alter table public.companies
  add column phone text,
  add column google_review_url text check (google_review_url is null or google_review_url ~ '^https://');

-- Visibilité d'une photo pour le client : les preuves sont visibles sauf si le bureau les masque
-- (client_hidden), les photos « Divers » masquées sauf si le bureau les montre (client_visible).
alter table public.photos add column client_hidden boolean not null default false;

alter table public.share_links
  add column purpose text not null default 'client' check (purpose in ('client', 'client_mode')),
  add column require_sms boolean not null default false,
  add column sms_code_hash text,
  add column sms_code_expires_at timestamptz,
  add column failed_attempts integer not null default 0,
  add column last_seen_at timestamptz;

alter table public.signatures
  add column share_link_id uuid references public.share_links (id),
  add column pv_content jsonb,
  add column pdf_path text,
  add column pdf_sha256 public.sha256_hex;

-- PV signé : jamais modifié ni supprimé ; seul son PDF est attaché, une fois.
drop trigger no_change on public.signatures;
create function app.signatures_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Un PV signé ne se supprime pas' using errcode = 'P0001';
  end if;
  if (to_jsonb(new) - 'pdf_path' - 'pdf_sha256') is distinct from (to_jsonb(old) - 'pdf_path' - 'pdf_sha256')
     or (old.pdf_path is not null
         and (new.pdf_path, new.pdf_sha256) is distinct from (old.pdf_path, old.pdf_sha256)) then
    raise exception 'Un PV signé ne change pas' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger no_change before update or delete on public.signatures
  for each row execute function app.signatures_guard();

-- Jeton → lien valable (ni révoqué, ni expiré). Empreinte : SHA-256 du jeton, en hexadécimal.
create function app.token_hash(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
$$;
create function app.valid_link(p_token text) returns public.share_links
language sql stable security definer set search_path = '' as $$
  select * from public.share_links
  where token_hash = app.token_hash(p_token) and revoked_at is null and expires_at > now()
$$;

-- Ce que voit le client ---------------------------------------------------------------------------
create function public.client_portal(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.share_links;
  v_out jsonb;
begin
  v_link := app.valid_link(p_token);
  if v_link.id is null then
    return null;
  end if;
  update public.share_links set last_seen_at = now() where id = v_link.id;
  select jsonb_build_object(
    'link', jsonb_build_object('id', v_link.id, 'require_sms', v_link.require_sms, 'expires_at', v_link.expires_at,
                               'purpose', v_link.purpose),
    'company', jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'logo_path', c.logo_path,
                                  'brand_color', c.brand_color, 'google_review_url', c.google_review_url,
                                  'rge', c.rge_qualifications),
    'jobsite', jsonb_build_object('id', j.id, 'reference', j.reference, 'address', j.address,
                                  'planned_start', j.planned_start, 'planned_end', j.planned_end,
                                  'client_name', cl.full_name, 'has_phone', cl.phone is not null,
                                  'has_email', cl.email is not null,
                                  'operations', coalesce((select jsonb_agg(o.label order by o.created_at)
                                                          from public.jobsite_operations o where o.jobsite_id = j.id), '[]')),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'phase', coalesce(s.phase, 'divers'), 'label', coalesce(s.instruction, p.caption, ''),
               'taken_at', p.device_taken_at, 'thumbnail_path', p.thumbnail_path, 'original_path', p.original_path,
               'extracted', p.ai_result -> 'verdict' -> 'extracted')
             order by p.device_taken_at)
      from public.photos p left join public.proof_slots s on s.id = p.proof_slot_id
      where p.jobsite_id = j.id and p.deleted_at is null and p.source = 'camera' and p.upload_status <> 'pending'
        and ((p.proof_slot_id is not null and s.applicable and not p.client_hidden)
             or (p.proof_slot_id is null and p.client_visible))), '[]'),
    'report', (
      select jsonb_build_object('pdf_path', r.pdf_path, 'content', r.content)
      from public.reports r
      where r.jobsite_id = j.id and r.kind = 'completion'
      order by (r.pdf_path is not null) desc, r.created_at desc, r.version desc limit 1),
    'signature', (
      select jsonb_build_object('id', g.id, 'signed_at', g.signed_at, 'signer_name', g.signer_name,
                                'has_reserves', g.has_reserves, 'reserves', g.reserves, 'pdf_path', g.pdf_path)
      from public.signatures g where g.jobsite_id = j.id order by g.signed_at desc limit 1)
  ) into v_out
  from public.jobsites j
  join public.companies c on c.id = j.company_id
  left join public.clients cl on cl.id = j.client_id
  where j.id = v_link.jobsite_id;
  return v_out;
end $$;

-- Code SMS facultatif : 5 essais au plus, valable 10 minutes. Renvoie le téléphone du client.
create function public.client_code_set(p_token text, p_code_hash text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.share_links;
  v_phone text;
begin
  v_link := app.valid_link(p_token);
  if v_link.id is null then
    raise exception 'Lien invalide ou expiré' using errcode = 'P0001';
  end if;
  if v_link.failed_attempts >= 5 then
    raise exception 'Trop d''essais : demandez un nouveau lien à l''entreprise' using errcode = 'P0001';
  end if;
  select cl.phone into v_phone from public.jobsites j join public.clients cl on cl.id = j.client_id
  where j.id = v_link.jobsite_id;
  if v_phone is null then
    raise exception 'Pas de téléphone pour ce client' using errcode = 'P0001';
  end if;
  update public.share_links set sms_code_hash = p_code_hash, sms_code_expires_at = now() + interval '10 minutes'
  where id = v_link.id;
  return v_phone;
end $$;

-- Signature du PV : une seule par chantier ; code SMS vérifié si le lien l'exige.
create function public.client_sign(
  p_token text, p_signer_name text, p_reserves text, p_signature_path text, p_document_sha256 text,
  p_pv jsonb, p_marketing_consent boolean, p_code text, p_ip inet, p_user_agent text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_link public.share_links;
  v_id uuid;
begin
  v_link := app.valid_link(p_token);
  if v_link.id is null then
    raise exception 'Lien invalide ou expiré' using errcode = 'P0001';
  end if;
  if v_link.failed_attempts >= 5 then
    raise exception 'Trop d''essais : demandez un nouveau lien à l''entreprise' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.signatures where jobsite_id = v_link.jobsite_id) then
    raise exception 'Le PV de ce chantier est déjà signé' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_signer_name, ''))) = 0 then
    raise exception 'Nom du signataire requis' using errcode = 'P0001';
  end if;
  if v_link.require_sms then
    if v_link.sms_code_hash is null or v_link.sms_code_expires_at < now()
       or app.token_hash(p_code) <> v_link.sms_code_hash then
      update public.share_links set failed_attempts = failed_attempts + 1 where id = v_link.id;
      -- Le compteur doit survivre à l'erreur : on la renvoie sans annuler la transaction.
      return null;
    end if;
  end if;
  insert into public.signatures (company_id, jobsite_id, share_link_id, signer_name, signature_path,
    document_sha256, has_reserves, reserves, sms_verified, marketing_consent, signer_ip, user_agent, pv_content)
  values (v_link.company_id, v_link.jobsite_id, v_link.id, trim(p_signer_name), p_signature_path,
    p_document_sha256, nullif(trim(coalesce(p_reserves, '')), '') is not null,
    nullif(trim(coalesce(p_reserves, '')), ''), v_link.require_sms, coalesce(p_marketing_consent, false),
    p_ip, left(p_user_agent, 500), p_pv)
  returning id into v_id;
  update public.share_links set sms_code_hash = null where id = v_link.id;
  return v_id;
end $$;

-- PDF du PV attaché une fois, par le serveur.
create function public.client_store_pv(p_token text, p_signature uuid, p_pdf_path text, p_pdf_sha256 text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_link public.share_links;
begin
  v_link := app.valid_link(p_token);
  if v_link.id is null then
    raise exception 'Lien invalide ou expiré' using errcode = 'P0001';
  end if;
  update public.signatures set pdf_path = p_pdf_path, pdf_sha256 = p_pdf_sha256
  where id = p_signature and jobsite_id = v_link.jobsite_id and pdf_path is null;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'client_portal(text)', 'client_code_set(text, text)',
    'client_sign(text, text, text, text, text, jsonb, boolean, text, inet, text)',
    'client_store_pv(text, uuid, text, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Mode client dans l'appli : le poseur affecté obtient un lien d'un jour pour tendre son téléphone.
create function public.client_mode_link(p_jobsite uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  if auth.uid() is null or not app.can_see_jobsite(p_jobsite) then
    raise exception 'Chantier inconnu' using errcode = '42501';
  end if;
  -- 32 octets issus de deux UUID v4 (générateur aléatoire sûr), en base64url.
  v_token := translate(encode(decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex'),
                              'base64'), '+/=', '-_');
  insert into public.share_links (company_id, jobsite_id, token_hash, expires_at, purpose, created_by)
  select company_id, id, app.token_hash(v_token), now() + interval '1 day', 'client_mode', auth.uid()
  from public.jobsites where id = p_jobsite;
  return v_token;
end $$;
revoke all on function public.client_mode_link(uuid) from public, anon;
grant execute on function public.client_mode_link(uuid) to authenticated;
