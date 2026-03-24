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
  baseline_temperature_c double precision,
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
  kind text not null default 'temperature_rise',
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create index if not exists alerts_device_status_created_at_idx
  on public.alerts (device_id, status, created_at desc);

drop trigger if exists readings_create_temperature_alert on public.readings;
drop function if exists public.create_temperature_alert_for_reading();

create or replace function public.get_device_temperature_heuristic(
  p_device_id text,
  p_window_minutes integer default null
)
returns table (
  device_id text,
  window_minutes integer,
  min_readings integer,
  warning_delta_c double precision,
  risk_delta_c double precision,
  warning_rate_c_per_hour double precision,
  risk_rate_c_per_hour double precision,
  baseline_temperature_c double precision,
  reading_count integer,
  latest_reading_id uuid,
  latest_temperature_c double precision,
  latest_timestamp bigint,
  earliest_reading_id uuid,
  earliest_temperature_c double precision,
  earliest_timestamp bigint,
  delta_c double precision,
  elapsed_minutes double precision,
  rate_c_per_hour double precision,
  meets_warning boolean,
  meets_risk boolean
)
language sql
stable
as $$
with settings as (
  select
    d.device_id,
    d.baseline_temperature_c,
    coalesce(p_window_minutes, s.window_minutes, 120) as window_minutes,
    coalesce(s.min_readings, 3) as min_readings,
    coalesce(s.warning_delta_c, 1.0) as warning_delta_c,
    coalesce(s.risk_delta_c, 2.0) as risk_delta_c,
    coalesce(s.warning_rate_c_per_hour, 0.3) as warning_rate_c_per_hour,
    coalesce(s.risk_rate_c_per_hour, 0.6) as risk_rate_c_per_hour
  from public.devices d
  left join public.device_alert_settings s on s.device_id = d.device_id
  where d.device_id = p_device_id
),
latest_ts as (
  select max(r.timestamp) as latest_timestamp
  from public.readings r
  join settings s on s.device_id = r.device_id
),
windowed as (
  select r.*
  from public.readings r
  join settings s on s.device_id = r.device_id
  cross join latest_ts l
  where l.latest_timestamp is not null
    and r.timestamp >= l.latest_timestamp - (s.window_minutes::bigint * 60 * 1000)
    and r.timestamp <= l.latest_timestamp
),
ordered as (
  select
    w.*,
    row_number() over (order by w.timestamp asc, w.created_at asc, w.id asc) as earliest_rank,
    row_number() over (order by w.timestamp desc, w.created_at desc, w.id desc) as latest_rank,
    count(*) over () as reading_count
  from windowed w
),
metrics as (
  select
    max(o.reading_count) as reading_count,
    max(case when o.latest_rank = 1 then o.id end) as latest_reading_id,
    max(case when o.latest_rank = 1 then o.temperature_c end) as latest_temperature_c,
    max(case when o.latest_rank = 1 then o.timestamp end) as latest_timestamp,
    max(case when o.earliest_rank = 1 then o.id end) as earliest_reading_id,
    max(case when o.earliest_rank = 1 then o.temperature_c end) as earliest_temperature_c,
    max(case when o.earliest_rank = 1 then o.timestamp end) as earliest_timestamp
  from ordered o
)
select
  s.device_id,
  s.window_minutes,
  s.min_readings,
  s.warning_delta_c,
  s.risk_delta_c,
  s.warning_rate_c_per_hour,
  s.risk_rate_c_per_hour,
  s.baseline_temperature_c,
  coalesce(m.reading_count, 0) as reading_count,
  m.latest_reading_id,
  m.latest_temperature_c,
  m.latest_timestamp,
  m.earliest_reading_id,
  m.earliest_temperature_c,
  m.earliest_timestamp,
  case
    when m.latest_temperature_c is null or m.earliest_temperature_c is null then null
    else m.latest_temperature_c - m.earliest_temperature_c
  end as delta_c,
  case
    when m.latest_timestamp is null or m.earliest_timestamp is null then null
    else (m.latest_timestamp - m.earliest_timestamp) / 60000.0
  end as elapsed_minutes,
  case
    when m.latest_timestamp is null
      or m.earliest_timestamp is null
      or m.latest_timestamp = m.earliest_timestamp
      or m.latest_temperature_c is null
      or m.earliest_temperature_c is null
    then null
    else ((m.latest_temperature_c - m.earliest_temperature_c) * 3600000.0)
      / (m.latest_timestamp - m.earliest_timestamp)
  end as rate_c_per_hour,
  case
    when coalesce(m.reading_count, 0) < s.min_readings then false
    when m.latest_timestamp is null or m.earliest_timestamp is null or m.latest_timestamp = m.earliest_timestamp then false
    else
      (m.latest_temperature_c - m.earliest_temperature_c) >= s.warning_delta_c
      and (((m.latest_temperature_c - m.earliest_temperature_c) * 3600000.0)
        / (m.latest_timestamp - m.earliest_timestamp)) >= s.warning_rate_c_per_hour
  end as meets_warning,
  case
    when coalesce(m.reading_count, 0) < s.min_readings then false
    when m.latest_timestamp is null or m.earliest_timestamp is null or m.latest_timestamp = m.earliest_timestamp then false
    else
      (m.latest_temperature_c - m.earliest_temperature_c) >= s.risk_delta_c
      and (((m.latest_temperature_c - m.earliest_temperature_c) * 3600000.0)
        / (m.latest_timestamp - m.earliest_timestamp)) >= s.risk_rate_c_per_hour
  end as meets_risk
from settings s
left join metrics m on true;
$$;

create or replace view public.device_temperature_heuristics as
select h.*
from public.devices d
cross join lateral public.get_device_temperature_heuristic(d.device_id, null) h;

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
