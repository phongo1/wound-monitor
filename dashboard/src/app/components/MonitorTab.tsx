import { useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { LineChart } from "@mui/x-charts/LineChart";
import { Activity, AlertCircle, Thermometer, TrendingDown, TrendingUp } from "lucide-react";

import {
  assignPatientDevice,
  getPatientMonitoring,
  resetPatientMonitoring,
  type MonitoringSnapshot,
  type Patient,
} from "../../lib/api";

interface TemperatureReading {
  id: string;
  timestamp: number;
  recordedAtMs: number;
  temperature: number;
  time: string;
}

interface MonitorTabProps {
  patients: Patient[];
  onPatientsChanged: () => Promise<void>;
}

interface TemperatureTrendProps {
  baselineTemp: number;
  readings: TemperatureReading[];
}

const TEMPERATURE_UNIT = "°C";
const SELECTED_PATIENT_KEY = "woundcare.monitor.selectedPatient";
const LIVE_POLL_INTERVAL_MS = 5000;

function TemperatureTrend({ baselineTemp, readings }: TemperatureTrendProps) {
  const chartReadings = readings;
  const latestReading = readings[readings.length - 1];
  const temperatures = chartReadings.map((reading) => reading.temperature);
  const minTemperature = Math.min(baselineTemp, ...temperatures);
  const maxTemperature = Math.max(baselineTemp, ...temperatures);
  const firstRecordedAtMs = chartReadings[0]?.recordedAtMs ?? Date.now();
  const elapsedMinutes = chartReadings.map(
    (reading) => (reading.recordedAtMs - firstRecordedAtMs) / 60000,
  );
  const baselineSeries = chartReadings.map(() => baselineTemp);
  const temperatureSeries = chartReadings.map((reading) => reading.temperature);
  const maxElapsedMinutes = Math.max(elapsedMinutes[elapsedMinutes.length - 1] ?? 0, 1);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        useFlexGap
        sx={{ color: "text.secondary" }}
      >
        <Typography variant="body2">
          Baseline: {baselineTemp.toFixed(1)} {TEMPERATURE_UNIT}
        </Typography>
        <Typography variant="body2">
          Range: {minTemperature.toFixed(1)} to {maxTemperature.toFixed(1)} {TEMPERATURE_UNIT}
        </Typography>
        {latestReading && (
          <Typography variant="body2">
            Latest: {latestReading.temperature.toFixed(1)} {TEMPERATURE_UNIT}
          </Typography>
        )}
      </Stack>

      <Box
        sx={{
          width: "100%",
          height: 320,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "grey.200",
          background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
          p: 2,
        }}
      >
        <LineChart
          series={[
            {
              data: baselineSeries,
              label: "Baseline",
              color: "#94a3b8",
              curve: "linear",
              showMark: false,
            },
            {
              data: temperatureSeries,
              label: "Temperature",
              color: "#1976d2",
              curve: "monotoneX",
              showMark: chartReadings.length <= 12,
            },
          ]}
          xAxis={[
            {
              scaleType: "linear",
              data: elapsedMinutes,
              min: 0,
              max: maxElapsedMinutes,
              height: 40,
              tickNumber: Math.min(Math.floor(maxElapsedMinutes) + 1, 8),
              valueFormatter: (value) => {
                const rounded = Math.round(value);
                if (Math.abs(value - rounded) >= 0.001) {
                  return "";
                }

                return new Date(firstRecordedAtMs + rounded * 60000).toLocaleTimeString(
                  "en-US",
                  {
                    hour: "numeric",
                    minute: "2-digit",
                  },
                );
              },
            },
          ]}
          yAxis={[
            {
              width: 40,
              min: Math.floor((minTemperature - 0.5) * 10) / 10,
              max: Math.ceil((maxTemperature + 0.5) * 10) / 10,
              valueFormatter: (value) => value.toFixed(1),
            },
          ]}
          margin={{ top: 16, right: 40, bottom: 48, left: 44 }}
          grid={{ horizontal: true }}
          slotProps={{
            legend: {
              position: { vertical: "top", horizontal: "right" },
            },
          }}
        />
      </Box>
    </Box>
  );
}

export default function MonitorTab({ patients, onPatientsChanged }: MonitorTabProps) {
  const [selectedPatient, setSelectedPatient] = useState(
    () => window.localStorage.getItem(SELECTED_PATIENT_KEY) ?? "",
  );
  const [monitoring, setMonitoring] = useState<MonitoringSnapshot | null>(null);
  const [sensorDeviceId, setSensorDeviceId] = useState("esp32-thing-plus-1");
  const [showSensorDevice, setShowSensorDevice] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!selectedPatient) {
      setMonitoring(null);
      setErrorMessage("");
      window.localStorage.removeItem(SELECTED_PATIENT_KEY);
      return;
    }

    window.localStorage.setItem(SELECTED_PATIENT_KEY, selectedPatient);
    void loadMonitoring(selectedPatient);
  }, [selectedPatient]);

  useEffect(() => {
    if (selectedPatient && !patients.some((patient) => patient.id === selectedPatient)) {
      setSelectedPatient("");
    }
  }, [patients, selectedPatient]);

  useEffect(() => {
    if (!selectedPatient) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadMonitoring(selectedPatient, { silent: true });
    }, LIVE_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedPatient]);

  const loadMonitoring = async (patientId: string, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
    }
    setErrorMessage("");

    try {
      setMonitoring(await getPatientMonitoring(patientId));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load monitoring data.",
      );
      setMonitoring(null);
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  };

  const handleAssignDevice = async () => {
    if (!selectedPatient || !sensorDeviceId.trim()) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await assignPatientDevice(selectedPatient, sensorDeviceId.trim());
      await Promise.all([loadMonitoring(selectedPatient), onPatientsChanged()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to assign device.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetMonitoring = async () => {
    if (!selectedPatient) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await resetPatientMonitoring(selectedPatient);
      setShowResetConfirm(false);
      await Promise.all([loadMonitoring(selectedPatient), onPatientsChanged()]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to reset monitoring data.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const readings: TemperatureReading[] =
    monitoring?.readings.map((reading) => ({
      id: reading.id,
      timestamp: reading.timestamp,
      recordedAtMs: reading.recordedAtMs,
      temperature: reading.temperature,
      time: new Date(reading.recordedAtMs).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    })).sort((left, right) => left.recordedAtMs - right.recordedAtMs) ?? [];

  const baselineTemp = monitoring?.patient.baselineTemperatureC ?? null;
  const currentTemp = readings[readings.length - 1]?.temperature ?? null;
  const delta = currentTemp !== null && baselineTemp !== null ? currentTemp - baselineTemp : 0;
  const rateOfChange =
    monitoring?.heuristic?.reboundRateCPerHour ??
    calculateLastTwoReadingRate(readings);
  const status = monitoring?.heuristic?.severity ?? "safe";

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-gray-900 mb-1">Wound Monitor</h2>
          <p className="text-gray-600">
            Real-time wound temperature monitoring and infection prediction
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-gray-900 mb-4">Select Patient</h3>
          <select
            value={selectedPatient}
            onChange={(e) => setSelectedPatient(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Choose a patient to monitor</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name} - {patient.woundType}
              </option>
            ))}
          </select>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {selectedPatient && isLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-600">
            Loading monitoring data...
          </div>
        )}

        {selectedPatient && !isLoading && monitoring && (
          <>
            {baselineTemp !== null ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Thermometer className="w-5 h-5 text-blue-600" />
                      </div>
                      <h4 className="text-gray-600">Baseline Temp</h4>
                    </div>
                    <p className="text-gray-900">
                      {baselineTemp.toFixed(1)} {TEMPERATURE_UNIT}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-purple-100 p-2 rounded-lg">
                        <Thermometer className="w-5 h-5 text-purple-600" />
                      </div>
                      <h4 className="text-gray-600">Current Temp</h4>
                    </div>
                    <p className="text-gray-900">
                      {currentTemp?.toFixed(1) ?? "--"} {TEMPERATURE_UNIT}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${delta >= 0 ? "bg-red-100" : "bg-green-100"}`}>
                        {delta >= 0 ? (
                          <TrendingUp className="w-5 h-5 text-red-600" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <h4 className="text-gray-600">Delta Change</h4>
                    </div>
                    <p className="text-gray-900">
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(2)} {TEMPERATURE_UNIT}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${rateOfChange >= 0 ? "bg-orange-100" : "bg-blue-100"}`}>
                        <Activity className={`w-5 h-5 ${rateOfChange >= 0 ? "text-orange-600" : "text-blue-600"}`} />
                      </div>
                      <h4 className="text-gray-600">Rate of Change</h4>
                    </div>
                    <p className="text-gray-900">
                      {rateOfChange > 0 ? "+" : ""}
                      {rateOfChange.toFixed(2)} {TEMPERATURE_UNIT}/hr
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <div className={`rounded-xl border-2 p-6 ${getStatusColor(status)}`}>
                    <div className="flex items-center gap-3 mb-3">
                      {getStatusIcon(status)}
                      <h3>Current Status</h3>
                    </div>
                    <p className="uppercase tracking-wide">{status}</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
                    <h3 className="text-gray-900 mb-3">Infection Risk Alert</h3>
                    {monitoring.latestAlert ? (
                      <div className="flex items-start gap-2 text-gray-700">
                        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <div>
                          <p>{monitoring.latestAlert.message}</p>
                          <p className="mt-2 text-sm text-gray-500">
                            Latest alert: {new Date(monitoring.latestAlert.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 text-green-700">
                        <Activity className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <p>No active backend alert for this patient. Continue monitoring.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-gray-900 mb-6">Temperature Trend</h3>
                  {readings.length > 0 ? (
                    <TemperatureTrend baselineTemp={baselineTemp} readings={readings} />
                  ) : (
                    <p className="text-gray-600">No readings recorded yet.</p>
                  )}
                </div>

                <div className="mt-6 space-y-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-gray-900">Sensor Device</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Current patient device: {monitoring.patient.deviceId ?? "Not assigned"}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowSensorDevice((current) => !current)}
                        className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {showSensorDevice ? "Hide" : "Edit"}
                      </button>
                    </div>

                    {showSensorDevice && (
                      <div className="mt-4 flex gap-4 items-end">
                        <div className="flex-1">
                          <label htmlFor="sensorDeviceId" className="block text-gray-700 mb-2">
                            Linked Sensor Device ID
                          </label>
                          <input
                            id="sensorDeviceId"
                            type="text"
                            value={sensorDeviceId}
                            onChange={(e) => setSensorDeviceId(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="esp32-thing-plus-1"
                          />
                        </div>
                        <button
                          onClick={() => {
                            void handleAssignDevice();
                          }}
                          disabled={!sensorDeviceId.trim() || isSubmitting}
                          className="bg-slate-700 text-white px-6 py-3 rounded-lg hover:bg-slate-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? "Linking..." : "Link Sensor"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-gray-900">Monitoring Reset</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Clear the current baseline, readings, and alerts without unlinking the sensor.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        disabled={isSubmitting}
                        className="border border-red-200 bg-red-50 text-red-700 px-6 py-3 rounded-lg hover:bg-red-100 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
                      >
                        Reset Data + Baseline
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
                <Thermometer className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-gray-900 mb-2">Begin Recording Temperatures</h3>
                <p className="text-gray-600">
                  The baseline will be estimated automatically after enough temperature readings are recorded.
                </p>
              </div>
            )}
          </>
        )}

        {showResetConfirm && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/35 px-4">
            <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 shadow-2xl">
              <div className="mb-4 inline-flex rounded-xl bg-red-50 p-3 text-red-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-gray-900 mb-2">Reset Monitoring Data?</h3>
              <p className="text-gray-600">
                This will clear the selected patient&apos;s baseline, readings, and alerts. The
                linked sensor device will stay attached so new uploads can continue.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isSubmitting}
                  className="px-5 py-3 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    void handleResetMonitoring();
                  }}
                  disabled={isSubmitting}
                  className="px-5 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:bg-red-300 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Resetting..." : "Confirm Reset"}
                </button>
              </div>
            </div>
          </div>
        )}

        {!selectedPatient && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
            <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">No Patient Selected</h3>
            <p className="text-gray-600">
              Select a patient from the dropdown above to start monitoring
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function calculateLastTwoReadingRate(readings: TemperatureReading[]): number {
  if (readings.length < 2) {
    return 0;
  }

  const lastTwo = readings.slice(-2);
  const timeDiff = (lastTwo[1].recordedAtMs - lastTwo[0].recordedAtMs) / (1000 * 60 * 60);

  if (timeDiff <= 0) {
    return 0;
  }

  return (lastTwo[1].temperature - lastTwo[0].temperature) / timeDiff;
}


function getStatusColor(status: string) {
  switch (status) {
    case "warning":
      return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "risk":
      return "text-red-600 bg-red-50 border-red-200";
    case "safe":
      return "text-green-600 bg-green-50 border-green-200";
    default:
      return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "warning":
      return <AlertCircle className="w-5 h-5" />;
    case "risk":
      return <AlertCircle className="w-5 h-5" />;
    case "safe":
      return <Activity className="w-5 h-5" />;
    default:
      return <Activity className="w-5 h-5" />;
  }
}
