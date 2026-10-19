-- FlowServe Voice — esquema de base de datos (Supabase / Postgres)
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede ejecutar más de una vez sin romper nada.

create extension if not exists pgcrypto;

-- ---------- Negocios ----------
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                 -- identificador corto, p. ej. 'halden-demo'
  name text not null,
  business_type text,                        -- 'a massage studio', 'a nail and lash salon'
  city text default 'Dublin',
  address text,
  timezone text not null default 'Europe/Dublin',
  default_country_code text not null default '353',
  owner_email text,
  notify_bookings boolean not null default true,
  calendar_id text,                          -- ID del Google Calendar compartido con la cuenta de servicio
  phone_e164 text,                           -- número de FlowServe que atiende la recepcionista (+3531...)
  transfer_number text,                      -- opcional: móvil del dueño para urgencias
  hours jsonb not null default '{}'::jsonb,  -- {"mon":[["09:00","18:00"]], ...}
  closures jsonb not null default '[]'::jsonb, -- ["2026-12-25", ...]
  services jsonb not null default '[]'::jsonb, -- [{"id","name","duration_min","price_eur","aliases":[]}]
  capacity int not null default 1,           -- cuántas citas a la vez
  slot_step_min int not null default 15,
  min_notice_min int not null default 120,
  buffer_min int not null default 0,
  booking_window_days int not null default 60,
  deposit_eur numeric,
  cancel_policy_hours int default 24,
  late_cancel_note text,
  booking_confirmation_note text,
  faq text,
  greeting text,
  voice_id text,
  llm_model text,
  retell_llm_id text,
  retell_agent_id text,
  plan_minutes int not null default 300,     -- minutos incluidos en el plan
  is_demo boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- quién puede ver cada negocio en el panel
create table if not exists members (
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  primary key (business_id, user_id)
);

-- ---------- Llamadas ----------
create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  retell_call_id text unique not null,
  direction text,                            -- inbound | outbound
  from_number text,
  to_number text,
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_s int,
  caller_name text,
  outcome text,                              -- booked | rescheduled | cancelled | message | escalated | info | spam | other
  summary text,
  sentiment text,
  transcript text,
  disconnection_reason text,
  inbox_item_id uuid,                        -- si es una devolución de llamada
  created_at timestamptz not null default now()
);
create index if not exists calls_biz_started on calls (business_id, started_at desc);

-- ---------- Citas creadas por la recepcionista ----------
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  gcal_event_id text unique,
  client_name text,
  client_phone text,
  service_id text,
  service_name text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'booked',     -- booked | cancelled
  retell_call_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists appts_biz_start on appointments (business_id, starts_at);

-- ---------- Bandeja ----------
create table if not exists inbox_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null,                        -- message | escalation
  retell_call_id text,
  caller_name text,
  caller_phone text,
  question text,
  summary text,
  urgency text default 'normal',
  status text not null default 'open',       -- open | calling | done
  owner_instruction text,
  callback_call_id text,
  callback_result text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists inbox_biz_status on inbox_items (business_id, status, created_at desc);

-- ---------- Seguridad (RLS) ----------
-- El navegador del dueño solo puede LEER lo de sus negocios. Todo lo que escribe pasa por /api con la clave de servicio.
alter table businesses enable row level security;
alter table members enable row level security;
alter table calls enable row level security;
alter table appointments enable row level security;
alter table inbox_items enable row level security;

create or replace function is_member(b uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from members m where m.business_id = b and m.user_id = auth.uid()) $$;

drop policy if exists "members read business" on businesses;
create policy "members read business" on businesses for select using (is_member(id));
drop policy if exists "members read own membership" on members;
create policy "members read own membership" on members for select using (user_id = auth.uid());
drop policy if exists "members read calls" on calls;
create policy "members read calls" on calls for select using (is_member(business_id));
drop policy if exists "members read appointments" on appointments;
create policy "members read appointments" on appointments for select using (is_member(business_id));
drop policy if exists "members read inbox" on inbox_items;
create policy "members read inbox" on inbox_items for select using (is_member(business_id));

-- El navegador solo ve estas columnas del negocio (no los IDs internos de Retell ni el calendario)
revoke select on businesses from anon, authenticated;
grant select (id, slug, name, city, phone_e164, hours, services, plan_minutes, is_demo, active) on businesses to authenticated;
revoke insert, update, delete on businesses, members, calls, appointments, inbox_items from anon, authenticated;

-- ---------- Negocio demo (para el número que llaman los prospectos) ----------
insert into businesses (slug, name, business_type, city, address, owner_email, calendar_id, hours, services, capacity,
  deposit_eur, cancel_policy_hours, late_cancel_note, faq, is_demo, plan_minutes)
values (
  'halden-demo', 'Halden Wellness Studio', 'a massage and wellness studio (this is a demo business)', 'Dublin',
  'Rathmines, Dublin 6 (demo address)', 'CAMBIA_ESTO@tuemail.com', 'CAMBIA_ESTO_ID_DEL_CALENDARIO_DEMO',
  '{"mon":[["10:00","19:00"]],"tue":[["10:00","19:00"]],"wed":[["10:00","19:00"]],"thu":[["10:00","20:00"]],"fri":[["10:00","19:00"]],"sat":[["10:00","16:00"]],"sun":[]}',
  '[{"id":"relax","name":"Relaxation Massage","duration_min":60,"price_eur":75,"aliases":["relaxing","swedish","full body"]},
    {"id":"deep","name":"Deep Tissue Massage","duration_min":60,"price_eur":80,"aliases":["deep tissue","sports"]},
    {"id":"back","name":"Back, Neck and Shoulders","duration_min":30,"price_eur":45,"aliases":["back","neck","shoulder"]},
    {"id":"stone","name":"Hot Stone Massage","duration_min":75,"price_eur":95,"aliases":["hot stone","stones"]}]',
  1, null, 24, 'Please give at least 24 hours notice if you need to cancel or move your booking.',
  'This is a FlowServe demo line. If the caller asks, explain that it is a demonstration of the FlowServe AI receptionist for Irish salons and clinics, and that no real appointment is booked with a real studio. Parking: on-street pay and display. Gift vouchers available. Payment by card or cash.',
  true, 1000
) on conflict (slug) do nothing;

-- Para darte acceso al panel (después de entrar una vez en /app con tu email):
-- insert into members (business_id, user_id)
-- select b.id, u.id from businesses b, auth.users u where b.slug = 'halden-demo' and u.email = 'TU_EMAIL';

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
