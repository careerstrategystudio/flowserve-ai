-- Límite de llamadas de prueba desde la web (botón "Talk to the receptionist")
create table if not exists demo_web_calls (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  ip_hash text not null,
  retell_call_id text
);
create index if not exists demo_web_calls_time on demo_web_calls (created_at desc);
alter table demo_web_calls enable row level security;
revoke all on demo_web_calls from anon, authenticated;
