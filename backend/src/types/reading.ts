export type Reading = {
  device_id: string;
  temperature_c: number;
  timestamp: number;
  sequence_number?: number | null;
};

export type StoredReading = Reading & {
  id: string;
  created_at: string;
};
