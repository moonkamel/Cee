-- Sous-ensemble de pgTAP (plan, ok, is, isnt, throws_ok, lives_ok, finish) pour exécuter
-- supabase/tests sans l'extension pgTAP. La CI utilise le vrai pgTAP.
-- Seules les fonctions qui écrivent dans le tableau des résultats sont SECURITY DEFINER :
-- le SQL testé s'exécute toujours avec le rôle de la session (authenticated, anon…).

create table extensions._tap (n serial primary key, ok boolean not null, description text);
create table extensions._tap_plan (planned integer);
grant usage on schema extensions to public;

create function extensions._tap_record(p_ok boolean, p_desc text) returns text
language plpgsql security definer set search_path = extensions as $$
declare v_n integer;
begin
  insert into extensions._tap (ok, description) values (coalesce(p_ok, false), p_desc) returning n into v_n;
  return case when coalesce(p_ok, false) then 'ok ' else 'not ok ' end || v_n || ' - ' || coalesce(p_desc, '');
end $$;

create function extensions.plan(p integer) returns text
language plpgsql security definer set search_path = extensions as $$
begin
  truncate extensions._tap restart identity;
  truncate extensions._tap_plan;
  insert into extensions._tap_plan values (p);
  return '1..' || p;
end $$;

create function extensions.ok(p_ok boolean, p_desc text default '') returns text
language sql as $$ select extensions._tap_record(p_ok, p_desc) $$;

create function extensions.is(p_have anyelement, p_want anyelement, p_desc text default '') returns text
language plpgsql as $$
begin
  if p_have is not distinct from p_want then
    return extensions._tap_record(true, p_desc);
  end if;
  return extensions._tap_record(false, p_desc || ' (obtenu : ' || coalesce(p_have::text, 'NULL')
    || ', attendu : ' || coalesce(p_want::text, 'NULL') || ')');
end $$;

create function extensions.isnt(p_have anyelement, p_want anyelement, p_desc text default '') returns text
language sql as $$ select extensions._tap_record(p_have is distinct from p_want, p_desc) $$;

create function extensions.throws_ok(p_sql text, p_errcode text, p_errmsg text, p_desc text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return extensions._tap_record(false, p_desc || ' (aucune erreur levée)');
exception when others then
  if p_errcode is not null and sqlstate <> p_errcode then
    return extensions._tap_record(false, p_desc || ' (code ' || sqlstate || ' au lieu de ' || p_errcode || ' : ' || sqlerrm || ')');
  end if;
  if p_errmsg is not null and sqlerrm <> p_errmsg then
    return extensions._tap_record(false, p_desc || ' (message : ' || sqlerrm || ')');
  end if;
  return extensions._tap_record(true, p_desc);
end $$;

create function extensions.lives_ok(p_sql text, p_desc text default '') returns text
language plpgsql as $$
begin
  execute p_sql;
  return extensions._tap_record(true, p_desc);
exception when others then
  return extensions._tap_record(false, p_desc || ' (' || sqlstate || ' : ' || sqlerrm || ')');
end $$;

create function extensions.finish() returns setof text
language plpgsql security definer set search_path = extensions as $$
declare v_planned integer; v_run integer; v_failed integer;
begin
  select planned into v_planned from extensions._tap_plan;
  select count(*), count(*) filter (where not ok) into v_run, v_failed from extensions._tap;
  if v_planned is not null and v_planned <> v_run then
    return next '# Prévu ' || v_planned || ' tests, ' || v_run || ' exécutés';
  end if;
  if v_failed > 0 then
    return next '# ' || v_failed || ' test(s) en échec sur ' || v_run;
  end if;
end $$;

grant execute on all functions in schema extensions to public;
