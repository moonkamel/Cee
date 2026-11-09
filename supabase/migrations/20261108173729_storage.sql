-- Preuvio — S3 : stockage privé des fichiers (section 16).
-- Chaque fichier est rangé sous <company_id>/… ; une entreprise n'atteint jamais le dossier
-- d'une autre. Pas de politique update ni delete : un fichier déposé ne change plus.
-- Le téléchargement passe par des URL signées de 5 minutes, créées côté serveur.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos', 'photos', false, 20971520, array['image/jpeg', 'image/heic', 'image/png', 'image/webp']),
  ('voice-notes', 'voice-notes', false, 10485760, array['audio/mp4', 'audio/m4a', 'audio/aac', 'audio/mpeg', 'audio/webm']),
  ('documents', 'documents', false, 52428800, array['application/pdf', 'image/png', 'image/jpeg', 'application/zip'])
on conflict (id) do nothing;

create policy company_files_select on storage.objects for select to authenticated
  using (
    bucket_id in ('photos', 'voice-notes', 'documents')
    and (storage.foldername(name))[1] = (select app.current_company_id())::text
  );

create policy company_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id in ('photos', 'voice-notes', 'documents')
    and (storage.foldername(name))[1] = (select app.current_company_id())::text
  );
