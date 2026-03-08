export type Reading = {
  device_id: string;
  temperature_c: number;
  timestamp: number;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function fetchLatestReading(): Promise<Reading | null> {
  const response = await fetch(`${API_BASE_URL}/api/latest`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch latest reading");
  }

  return (await response.json()) as Reading;
}
