-- Preuvio — S3 : sécurité au niveau des lignes (sections 14 et 16).
--
-- Règle 1 : une entreprise ne voit jamais les données d'une autre (company_id).
-- Règle 2 : la matrice des rôles de la section 14.
--   installer (poseur)   : ses chantiers (affecté ou créateur)
--   lead (chef d'équipe) : les chantiers de son équipe
--   office (bureau), admin, owner (dirigeant) : tous les chantiers de l'entreprise

-- Fonctions d'accès ------------------------------------------------------------------
-- SECURITY DEFINER : elles lisent profiles sans repasser par ses politiques (pas de récursion).

create function app.current_company_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.company_id from public.profiles p where p.id = auth.uid() and p.active
$$;

create function app.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.active
$$;

create function app.current_team_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.team_id from public.profiles p where p.id = auth.uid() and p.active
$$;

create function app.has_role(variadic roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role::text = any (roles) from public.profiles p where p.id = auth.uid() and p.active), false)
$$;

create function app.can_see_jobsite(p_jobsite_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.jobsites j
    join public.profiles me on me.id = auth.uid() and me.active and me.company_id = j.company_id
    where j.id = p_jobsite_id
      and (
        me.role in ('office', 'admin', 'owner')
        or j.created_by = me.id
        or exists (
          select 1 from public.jobsite_assignees a
          where a.jobsite_id = j.id and a.profile_id = me.id
        )
        or (
          me.role = 'lead' and me.team_id is not null and exists (
            select 1 from public.jobsite_assignees a
            join public.profiles p on p.id = a.profile_id
            where a.jobsite_id = j.id and p.team_id = me.team_id
          )
        )
      )
  )
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;

-- Activation de RLS sur toutes les tables ---------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Raccourcis lisibles dans les politiques
-- (select …) autour des fonctions : évaluées une fois par requête, pas par ligne.

-- companies
create policy companies_select on public.companies for select to authenticated
  using (id = (select app.current_company_id()));
create policy companies_update on public.companies for update to authenticated
  using (id = (select app.current_company_id()) and (select app.has_role('admin', 'owner')));

-- teams
create policy teams_select on public.teams for select to authenticated
  using (company_id = (select app.current_company_id()));
create policy teams_write on public.teams for all to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('admin', 'owner')))
  with check (company_id = (select app.current_company_id()) and (select app.has_role('admin', 'owner')));

-- profiles (les changements de rôle sont contrôlés par trigger, migration 4)
create policy profiles_select on public.profiles for select to authenticated
  using (company_id = (select app.current_company_id()));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (company_id = (select app.current_company_id()) and (select app.has_role('admin', 'owner')));
create policy profiles_update on public.profiles for update to authenticated
  using (company_id = (select app.current_company_id())
         and (id = (select auth.uid()) or (select app.has_role('admin', 'owner'))));

-- clients
create policy clients_select on public.clients for select to authenticated
  using (company_id = (select app.current_company_id()));
create policy clients_insert on public.clients for insert to authenticated
  with check (company_id = (select app.current_company_id()));
create policy clients_update on public.clients for update to authenticated
  using (company_id = (select app.current_company_id()));

-- delegataires : globaux lisibles par tous, ceux de l'entreprise gérés par le bureau
create policy delegataires_select on public.delegataires for select to authenticated
  using (company_id is null or company_id = (select app.current_company_id()));
create policy delegataires_write on public.delegataires for all to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')))
  with check (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')));

-- checklist_templates : globaux lisibles par tous, modèles maison réservés à admin et dirigeant
create policy templates_select on public.checklist_templates for select to authenticated
  using (company_id is null or company_id = (select app.current_company_id()));
create policy templates_write on public.checklist_templates for all to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('admin', 'owner')))
  with check (company_id = (select app.current_company_id()) and (select app.has_role('admin', 'owner')));

-- jobsites
create policy jobsites_select on public.jobsites for select to authenticated
  using (app.can_see_jobsite(id));
create policy jobsites_insert on public.jobsites for insert to authenticated
  with check (company_id = (select app.current_company_id()));
create policy jobsites_update on public.jobsites for update to authenticated
  using (app.can_see_jobsite(id))
  with check (company_id = (select app.current_company_id()));

-- jobsite_assignees : le chef et le bureau affectent ; un poseur peut s'affecter au chantier qu'il crée
create policy assignees_select on public.jobsite_assignees for select to authenticated
  using (app.can_see_jobsite(jobsite_id));
create policy assignees_insert on public.jobsite_assignees for insert to authenticated
  with check (app.can_see_jobsite(jobsite_id)
              and ((select app.has_role('lead', 'office', 'admin', 'owner')) or profile_id = (select auth.uid())));
create policy assignees_delete on public.jobsite_assignees for delete to authenticated
  using (app.can_see_jobsite(jobsite_id) and (select app.has_role('lead', 'office', 'admin', 'owner')));

-- jobsite_operations, proof_slots : tout utilisateur qui voit le chantier
create policy operations_select on public.jobsite_operations for select to authenticated
  using (app.can_see_jobsite(jobsite_id));
create policy operations_insert on public.jobsite_operations for insert to authenticated
  with check (app.can_see_jobsite(jobsite_id));
create policy operations_update on public.jobsite_operations for update to authenticated
  using (app.can_see_jobsite(jobsite_id));

create policy slots_select on public.proof_slots for select to authenticated
  using (app.can_see_jobsite(jobsite_id));
create policy slots_insert on public.proof_slots for insert to authenticated
  with check (app.can_see_jobsite(jobsite_id));
create policy slots_update on public.proof_slots for update to authenticated
  using (app.can_see_jobsite(jobsite_id));

-- photos : le bureau ne photographie pas (section 14) ; pas de suppression physique
create policy photos_select on public.photos for select to authenticated
  using (app.can_see_jobsite(jobsite_id));
create policy photos_insert on public.photos for insert to authenticated
  with check (app.can_see_jobsite(jobsite_id)
              and author_id = (select auth.uid())
              and not (select app.has_role('office')));
create policy photos_update on public.photos for update to authenticated
  using (app.can_see_jobsite(jobsite_id));

-- voice_notes
create policy voice_select on public.voice_notes for select to authenticated
  using (app.can_see_jobsite(jobsite_id));
create policy voice_insert on public.voice_notes for insert to authenticated
  with check (app.can_see_jobsite(jobsite_id) and author_id = (select auth.uid()));
create policy voice_update on public.voice_notes for update to authenticated
  using (app.can_see_jobsite(jobsite_id));

-- photo_requests : demandées par chef, bureau, admin, dirigeant ; vues par le destinataire
create policy requests_select on public.photo_requests for select to authenticated
  using (company_id = (select app.current_company_id())
         and (recipient_id = (select auth.uid()) or (select app.has_role('lead', 'office', 'admin', 'owner'))));
create policy requests_insert on public.photo_requests for insert to authenticated
  with check (app.can_see_jobsite(jobsite_id)
              and requested_by = (select auth.uid())
              and (select app.has_role('lead', 'office', 'admin', 'owner')));
create policy requests_update on public.photo_requests for update to authenticated
  using (company_id = (select app.current_company_id())
         and (recipient_id = (select auth.uid()) or (select app.has_role('lead', 'office', 'admin', 'owner'))));

-- reports
create policy reports_select on public.reports for select to authenticated
  using (app.can_see_jobsite(jobsite_id));
create policy reports_write on public.reports for insert to authenticated
  with check (app.can_see_jobsite(jobsite_id) and (select app.has_role('lead', 'office', 'admin', 'owner')));
create policy reports_update on public.reports for update to authenticated
  using (app.can_see_jobsite(jobsite_id) and (select app.has_role('lead', 'office', 'admin', 'owner')));

-- signatures : le poseur fait signer sur son téléphone ; jamais modifiées
create policy signatures_select on public.signatures for select to authenticated
  using (app.can_see_jobsite(jobsite_id));
create policy signatures_insert on public.signatures for insert to authenticated
  with check (app.can_see_jobsite(jobsite_id));

-- CEE : lots et contrôles gérés par le bureau, visibles du chef d'équipe
create policy batches_select on public.cee_batches for select to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('lead', 'office', 'admin', 'owner')));
create policy batches_write on public.cee_batches for all to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')))
  with check (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')));

create policy batch_jobsites_select on public.cee_batch_jobsites for select to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('lead', 'office', 'admin', 'owner')));
create policy batch_jobsites_write on public.cee_batch_jobsites for all to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')))
  with check (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')));

create policy inspections_select on public.inspections for select to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('lead', 'office', 'admin', 'owner')));
create policy inspections_insert on public.inspections for insert to authenticated
  with check (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')));
create policy inspections_update on public.inspections for update to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')));

create policy thresholds_select on public.cee_thresholds for select to authenticated using (true);

-- exports : bureau, admin, dirigeant (section 14 : ni poseur ni chef)
create policy exports_select on public.exports for select to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')));
create policy exports_insert on public.exports for insert to authenticated
  with check (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')));
create policy exports_update on public.exports for update to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner')));

-- share_links : créés par chef, bureau, admin, dirigeant ; lus par le client via une fonction serveur
create policy share_links_select on public.share_links for select to authenticated
  using (app.can_see_jobsite(jobsite_id) and (select app.has_role('lead', 'office', 'admin', 'owner')));
create policy share_links_insert on public.share_links for insert to authenticated
  with check (app.can_see_jobsite(jobsite_id) and (select app.has_role('lead', 'office', 'admin', 'owner')));
create policy share_links_update on public.share_links for update to authenticated
  using (app.can_see_jobsite(jobsite_id) and (select app.has_role('lead', 'office', 'admin', 'owner')));

-- marketing_assets : créés par le serveur, validés par admin ou dirigeant
create policy marketing_select on public.marketing_assets for select to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('admin', 'owner')));
create policy marketing_update on public.marketing_assets for update to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('admin', 'owner')));

-- subscriptions : lecture admin et dirigeant ; écriture par le webhook Stripe (service_role)
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('admin', 'owner')));

-- notifications : chacun les siennes
create policy notifications_select on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()));

-- audit_log : lecture admin et dirigeant ; écrit uniquement par trigger
create policy audit_select on public.audit_log for select to authenticated
  using (company_id = (select app.current_company_id()) and (select app.has_role('admin', 'owner')));
