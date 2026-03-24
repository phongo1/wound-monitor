create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age integer check (age is null or age >= 0),
  wound_type text not null,
  admission_date date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists patients_set_updated_at on public.patients;
create trigger patients_set_updated_at
before update on public.patients
for each row
execute function public.set_updated_at();

create table if not exists public.devices (
  device_id text primary key,
  patient_id uuid references public.patients(id) on delete set null,
  label text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists devices_set_updated_at on public.devices;
create trigger devices_set_updated_at
before update on public.devices
for each row
execute function public.set_updated_at();

create index if not exists devices_patient_id_idx on public.devices (patient_id);

create table if not exists public.device_alert_settings (
  device_id text primary key references public.devices(device_id) on delete cascade,
  window_minutes integer not null default 120 check (window_minutes >= 5 and window_minutes <= 1440),
  min_readings integer not null default 3 check (min_readings >= 2 and min_readings <= 1000),
  warning_delta_c double precision not null default 1.0 check (warning_delta_c >= 0),
  risk_delta_c double precision not null default 2.0 check (risk_delta_c >= warning_delta_c),
  warning_rate_c_per_hour double precision not null default 0.3 check (warning_rate_c_per_hour >= 0),
  risk_rate_c_per_hour double precision not null default 0.6 check (risk_rate_c_per_hour >= warning_rate_c_per_hour),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists device_alert_settings_set_updated_at on public.device_alert_settings;
create trigger device_alert_settings_set_updated_at
before update on public.device_alert_settings
for each row
execute function public.set_updated_at();

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  temperature_c double precision not null check (temperature_c > 0 and temperature_c < 100),
  timestamp bigint not null check (timestamp > 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists readings_device_timestamp_idx
  on public.readings (device_id, timestamp desc);

create index if not exists readings_timestamp_idx
  on public.readings (timestamp desc);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  reading_id uuid not null unique references public.readings(id) on delete cascade,
  severity text not null check (severity in ('warning', 'risk')),
  kind text not null default 'temperature_change_over_time',
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create index if not exists alerts_device_status_created_at_idx
  on public.alerts (device_id, status, created_at desc);

create or replace view public.latest_device_readings as
select distinct on (r.device_id)
  r.id,
  r.device_id,
  r.temperature_c,
  r.timestamp,
  r.created_at
from public.readings r
order by r.device_id, r.timestamp desc;

alter table public.patients enable row level security;
alter table public.devices enable row level security;
alter table public.device_alert_settings enable row level security;
alter table public.readings enable row level security;
alter table public.alerts enable row level security;
