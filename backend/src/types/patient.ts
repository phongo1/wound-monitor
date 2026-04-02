export type PatientRecord = {
  id: string;
  name: string;
  age: number;
  wound_type: string;
  admission_date: string;
  device_id: string | null;
  baseline_temperature_c: number | null;
};

export type CreatePatientInput = {
  name: string;
  age: number;
  wound_type: string;
  admission_date: string;
};
