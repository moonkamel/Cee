// Structure de la base locale. Les lignes sont stockées en JSON : le téléphone d'un poseur
// ne contient que quelques dizaines de chantiers, et aucun changement de schéma n'est
// nécessaire quand le serveur ajoute une colonne.

export const LOCAL_SCHEMA = `
create table if not exists local_rows (
  tbl text not null,
  id text not null,
  data text not null,
  primary key (tbl, id)
);
create table if not exists outbox (
  seq integer primary key autoincrement,
  op text not null check (op in ('insert', 'update')),
  tbl text not null,
  row_id text not null,
  payload text not null,
  attempts integer not null default 0,
  next_attempt_at integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'rejected')),
  last_error text
);
create index if not exists outbox_row on outbox (tbl, row_id);
create table if not exists sync_state (
  key text primary key,
  value text not null
);
`;
