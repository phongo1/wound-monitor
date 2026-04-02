export type DeviceRecord = {
  device_id: string;
  patient_id: string | null;
  label: string | null;
  baseline_temperature_c: number | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};
