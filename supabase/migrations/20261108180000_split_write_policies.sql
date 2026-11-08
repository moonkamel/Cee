-- Preuvio — S4 : politiques d'écriture séparées par action.
-- Les politiques « for all » s'appliquaient aussi à la lecture, en plus des politiques
-- « for select » : deux politiques évaluées par lecture (conseiller de performance Supabase).
-- Mêmes droits qu'avant, découpés en insert / update / delete.

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('teams', 'teams_write', $q$company_id = (select app.current_company_id()) and (select app.has_role('admin', 'owner'))$q$),
      ('delegataires', 'delegataires_write', $q$company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner'))$q$),
      ('checklist_templates', 'templates_write', $q$company_id = (select app.current_company_id()) and (select app.has_role('admin', 'owner'))$q$),
      ('cee_batches', 'batches_write', $q$company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner'))$q$),
      ('cee_batch_jobsites', 'batch_jobsites_write', $q$company_id = (select app.current_company_id()) and (select app.has_role('office', 'admin', 'owner'))$q$)
    ) as t(tbl, old_policy, expr)
  loop
    execute format('drop policy %I on public.%I', r.old_policy, r.tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)',
                   r.tbl || '_insert', r.tbl, r.expr);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
                   r.tbl || '_update', r.tbl, r.expr, r.expr);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)',
                   r.tbl || '_delete', r.tbl, r.expr);
  end loop;
end $$;
