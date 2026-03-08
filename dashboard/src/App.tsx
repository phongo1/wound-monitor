import { useEffect, useState } from "react";

import { fetchLatestReading, Reading } from "./api/readings";
import { TemperatureCard } from "./components/TemperatureCard";

export default function App() {
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLatest() {
      try {
        const latest = await fetchLatestReading();
        setReading(latest);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }

    loadLatest();

    // TODO: Add polling/live updates later.
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>Smart Bandage Dashboard</h1>
      <p>Minimal starter app. Add polling/charts later.</p>

      {error ? (
        <p style={{ color: "crimson" }}>Error: {error}</p>
      ) : (
        <TemperatureCard
          temperatureC={reading?.temperature_c ?? null}
          deviceId={reading?.device_id}
          timestamp={reading?.timestamp}
        />
      )}
    </main>
  );
}
