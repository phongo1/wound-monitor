import { useEffect, useState } from "react";

import { fetchLatestReading, Reading } from "./api/readings";
import { TemperatureCard } from "./components/TemperatureCard";

export default function App() {
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadLatest() {
      setError(null);

      try {
        const latest = await fetchLatestReading();
        setReading(latest);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    }

    loadLatest();

    // TODO: Add polling/live updates later.
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Smart Bandage
          </p>
          <h1 className="text-3xl font-semibold">Temperature Dashboard</h1>
          <p className="text-sm text-slate-600">
            Minimal starter app. Add polling and history later.
          </p>
        </header>

        {isLoading ? (
          <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Current Temperature</h2>
            <p className="mt-4 text-slate-600">Loading latest reading...</p>
          </section>
        ) : error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Error: {error}
          </p>
        ) : (
          <TemperatureCard
            temperatureC={reading?.temperature_c ?? null}
            deviceId={reading?.device_id}
            timestamp={reading?.timestamp}
          />
        )}
      </div>
    </main>
  );
}
