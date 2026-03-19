type TemperatureCardProps = {
  temperatureC: number | null;
  deviceId?: string;
  timestamp?: number;
};

function formatTimestamp(timestamp?: number): string | null {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000).toLocaleString();
}

export function TemperatureCard({ temperatureC, deviceId, timestamp }: TemperatureCardProps) {
  const formattedTimestamp = formatTimestamp(timestamp);

  return (
    <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Current Temperature</h2>
      {temperatureC === null ? (
        <p className="mt-4 text-slate-600">No readings yet. Send one from the backend or ESP32.</p>
      ) : (
        <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
          {temperatureC.toFixed(2)} <span className="text-xl text-slate-500">deg C</span>
        </p>
      )}

      {deviceId && <p className="mt-4 text-sm text-slate-600">Device: {deviceId}</p>}
      {formattedTimestamp && (
        <p className="mt-1 text-sm text-slate-600">Last updated: {formattedTimestamp}</p>
      )}
    </section>
  );
}
