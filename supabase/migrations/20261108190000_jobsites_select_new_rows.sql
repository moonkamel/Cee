-- Preuvio — S5 : lecture d'un chantier qu'on vient de créer, dans la même instruction.
-- L'API Supabase relit chaque ligne insérée (INSERT … RETURNING). L'ancienne règle passait
-- uniquement par app.can_see_jobsite(id), qui cherche le chantier dans la table : pendant
-- l'insertion il n'y est pas encore visible, et la création était refusée (42501).
-- Mêmes droits qu'avant : on vérifie d'abord ce qui se lit sur la ligne elle-même.

drop policy jobsites_select on public.jobsites;

create policy jobsites_select on public.jobsites for select to authenticated
  using (
    company_id = (select app.current_company_id())
    and (
      (select app.has_role('office', 'admin', 'owner'))
      or created_by = (select auth.uid())
      or app.can_see_jobsite(id)
    )
  );
