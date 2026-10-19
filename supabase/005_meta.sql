-- Instagram (Meta): eventos recibidos por webhook y solicitudes de borrado. Se puede ejecutar más de una vez.
create table if not exists meta_events (
  id bigserial primary key,
  received_at timestamptz not null default now(),
  object text, account_id text, sender_id text, kind text, text text, payload jsonb
);
create index if not exists meta_events_time on meta_events (received_at desc);
create index if not exists meta_events_sender on meta_events (sender_id);
create table if not exists meta_deletions (
  id bigserial primary key, requested_at timestamptz not null default now(), user_id text not null, confirmation_code text not null
);
alter table meta_events enable row level security;
alter table meta_deletions enable row level security;
revoke all on meta_events, meta_deletions from anon, authenticated;
