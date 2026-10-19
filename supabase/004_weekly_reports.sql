-- Informe semanal de Front Desk. Supabase → SQL Editor → pegar → Run. Se puede ejecutar más de una vez.
alter table businesses add column if not exists weekly_report boolean not null default true;
create table if not exists weekly_reports (
  id bigserial primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  week_start date not null,
  sent_to text,
  stats jsonb,
  sent_at timestamptz not null default now(),
  unique (business_id, week_start)
);
alter table weekly_reports enable row level security;
revoke all on weekly_reports from anon, authenticated;
