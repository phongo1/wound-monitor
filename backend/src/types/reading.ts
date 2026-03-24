export type Reading = {
  device_id: string;
  temperature_c: number;
  timestamp: number;
};

export type StoredReading = Reading & {
  id: string;
  created_at: string;
};
