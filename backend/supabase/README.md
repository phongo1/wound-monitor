Run [schema.sql](/smart-bandage/backend/supabase/schema.sql) in the Supabase SQL editor to create neccessary tables.

What it creates:
- `patients` for patient records
- `devices` for bandage/device assignment and baseline temperature
- `readings` for incoming temperature measurements
- `alerts` for backend-generated warning/risk events
- `latest_device_readings` view for fast dashboard queries

Detection behavior:
- Inserting a row into `readings` checks `devices.baseline_temperature_c`
- `delta >= 1.0 C` creates a `warning` alert
- `delta >= 2.0 C` creates a `risk` alert
- If a device has no baseline configured, no alert is generated

Important:
- RLS is enabled on all tables
- The current backend writes through the service role key, which bypasses RLS
- If you use the anon key from the frontend later, you will need explicit RLS policies

Minimal setup example:

```sql
insert into public.patients (name, age, wound_type, admission_date)
values ('Jane Doe', 54, 'Surgical', current_date)
returning id;
```

```sql
insert into public.devices (device_id, patient_id, label, baseline_temperature_c)
values ('bandage-001', '<patient-uuid>', 'Right forearm', 34.2);
```
