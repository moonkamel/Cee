-- Envoi des photos (section 6, S7) : seul le serveur, après contrôle de l'empreinte SHA-256
-- par la fonction verify-photo (clé de service, donc sans utilisateur), marque une photo
-- « verified ». Un poseur peut signaler « uploaded », jamais faire régresser une photo vérifiée.
create function app.photos_upload_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.upload_status = 'verified' then
    new.upload_status := 'verified';
  elsif new.upload_status = 'verified' then
    raise exception 'Seul le serveur marque une photo vérifiée' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger e_photos_upload_guard before insert or update on public.photos
  for each row execute function app.photos_upload_guard();
