-- FlowServe Social: solicitudes del formulario de /social-media/.
-- Supabase → SQL Editor → pegar → Run. Se puede ejecutar más de una vez.
create table if not exists social_enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  business_name text not null,
  contact_name text not null,
  email text not null,
  website_url text,
  instagram_url text,
  facebook_url text,
  category text not null,
  package_id text not null,            -- social-starter | social-growth | social-premium | undecided
  addons text[] not null default '{}', -- p. ej. {front-desk}
  objective text not null,
  language text not null,
  posting_frequency text not null,
  can_supply_media text not null,
  requirements text,
  quoted_monthly_eur numeric,
  quoted_from boolean,
  consent_at timestamptz not null,
  ip_hash text,
  status text not null default 'new'   -- new | contacted | won | lost
);
create index if not exists social_enquiries_time on social_enquiries (created_at desc);
alter table social_enquiries enable row level security;
revoke all on social_enquiries from anon, authenticated;
