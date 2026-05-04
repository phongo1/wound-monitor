alter table public.readings
  add column if not exists sequence_number bigint;

create unique index if not exists readings_device_sequence_number_idx
  on public.readings (device_id, sequence_number)
  where sequence_number is not null;
