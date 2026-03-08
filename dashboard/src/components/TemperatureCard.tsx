type TemperatureCardProps = {
  temperatureC: number | null;
  deviceId?: string;
  timestamp?: number;
};

export function TemperatureCard({ temperatureC, deviceId, timestamp }: TemperatureCardProps) {
  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, maxWidth: 360 }}>
      <h2>Current Temperature</h2>
      {temperatureC === null ? (
        <p>No data yet.</p>
      ) : (
        <p style={{ fontSize: 24, margin: 0 }}>{temperatureC.toFixed(2)} °C</p>
      )}

      {deviceId && <p>Device: {deviceId}</p>}
      {timestamp && <p>Timestamp: {timestamp}</p>}
    </div>
  );
}
