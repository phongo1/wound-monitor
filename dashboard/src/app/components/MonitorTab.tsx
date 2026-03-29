import { useEffect, useState } from 'react';
import { Box, LinearProgress, Stack, Typography } from '@mui/material';
import { AlertCircle, TrendingUp, TrendingDown, Activity, Thermometer } from 'lucide-react';
import type { Patient } from './PatientsTab';

interface TemperatureReading {
  timestamp: string;
  temperature: number;
  time: string;
}

interface MonitorTabProps {
  patients: Patient[];
}

interface TemperatureTrendProps {
  baselineTemp: number;
  readings: TemperatureReading[];
}

const TEMPERATURE_UNIT = '°C';

function getTrendProgress(
  temperature: number,
  minTemperature: number,
  maxTemperature: number,
) {
  if (maxTemperature <= minTemperature) {
    return 100;
  }

  return 15 + ((temperature - minTemperature) / (maxTemperature - minTemperature)) * 85;
}

function TemperatureTrend({ baselineTemp, readings }: TemperatureTrendProps) {
  const latestReading = readings[readings.length - 1];
  const temperatures = readings.map((reading) => reading.temperature);
  const minTemperature = Math.min(baselineTemp, ...temperatures);
  const maxTemperature = Math.max(baselineTemp, ...temperatures);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        useFlexGap
        sx={{ color: 'text.secondary' }}
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

      <Box sx={{ maxHeight: 320, overflowY: 'auto', pr: 1 }}>
        <Stack spacing={2}>
          {readings.map((reading, index) => {
            const isLatest = index === readings.length - 1;

            return (
              <Box
                key={reading.timestamp}
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  alignItems: 'center',
                  gridTemplateColumns: { xs: '1fr', sm: '80px 1fr 92px' },
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {reading.time}
                </Typography>

                <Box>
                  <LinearProgress
                    variant="determinate"
                    value={getTrendProgress(
                      reading.temperature,
                      minTemperature,
                      maxTemperature,
                    )}
                    sx={{
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: 'grey.100',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 999,
                        backgroundColor: isLatest ? 'primary.main' : 'primary.light',
                      },
                    }}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.75 }}
                  >
                    {index === 0 ? 'Baseline reading' : `Reading ${index + 1}`}
                  </Typography>
                </Box>

                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, textAlign: { sm: 'right' } }}
                >
                  {reading.temperature.toFixed(1)} {TEMPERATURE_UNIT}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}

export default function MonitorTab({ patients }: MonitorTabProps) {
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [baselineTemp, setBaselineTemp] = useState<number | null>(null);
  const [currentTemp, setCurrentTemp] = useState<number | null>(null);
  const [readings, setReadings] = useState<TemperatureReading[]>([]);
  const [inputTemp, setInputTemp] = useState('');

  useEffect(() => {
    if (selectedPatient) {
      setBaselineTemp(null);
      setCurrentTemp(null);
      setReadings([]);
    }
  }, [selectedPatient]);

  const handleSetBaseline = () => {
    if (!inputTemp) {
      return;
    }

    const temp = parseFloat(inputTemp);
    const now = new Date();
    const newReading: TemperatureReading = {
      timestamp: now.toISOString(),
      temperature: temp,
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setBaselineTemp(temp);
    setReadings([newReading]);
    setCurrentTemp(temp);
    setInputTemp('');
  };

  const handleAddReading = () => {
    if (!inputTemp || baselineTemp === null) {
      return;
    }

    const temp = parseFloat(inputTemp);
    const now = new Date();
    const newReading: TemperatureReading = {
      timestamp: now.toISOString(),
      temperature: temp,
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setReadings((currentReadings) => [...currentReadings, newReading]);
    setCurrentTemp(temp);
    setInputTemp('');
  };

  const calculateDelta = () => {
    if (currentTemp !== null && baselineTemp !== null) {
      return (currentTemp - baselineTemp).toFixed(2);
    }

    return '0.00';
  };

  const calculateRateOfChange = () => {
    if (readings.length < 2) {
      return '0.00';
    }

    const lastTwo = readings.slice(-2);
    const timeDiff =
      (new Date(lastTwo[1].timestamp).getTime() - new Date(lastTwo[0].timestamp).getTime()) /
      (1000 * 60 * 60);

    if (timeDiff <= 0) {
      return '0.00';
    }

    const tempDiff = lastTwo[1].temperature - lastTwo[0].temperature;
    return (tempDiff / timeDiff).toFixed(2);
  };

  const getStatus = () => {
    if (currentTemp === null || baselineTemp === null) {
      return 'unknown';
    }

    const delta = currentTemp - baselineTemp;

    if (delta >= 2.0) {
      return 'risk';
    }

    if (delta >= 1.0) {
      return 'warning';
    }

    return 'safe';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'risk':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'safe':
        return <Activity className="w-5 h-5" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5" />;
      case 'risk':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  const status = getStatus();
  const delta = parseFloat(calculateDelta());
  const rateOfChange = parseFloat(calculateRateOfChange());

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-gray-900 mb-1">Wound Monitor</h2>
          <p className="text-gray-600">Real-time wound temperature monitoring and infection prediction</p>
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

        {selectedPatient && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-gray-900 mb-4">Temperature Input</h3>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label htmlFor="tempInput" className="block text-gray-700 mb-2">
                    Temperature ({TEMPERATURE_UNIT})
                  </label>
                  <input
                    id="tempInput"
                    type="number"
                    step="0.1"
                    value={inputTemp}
                    onChange={(e) => setInputTemp(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="37.0"
                  />
                </div>
                {baselineTemp === null ? (
                  <button
                    onClick={handleSetBaseline}
                    disabled={!inputTemp}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Set Baseline
                  </button>
                ) : (
                  <button
                    onClick={handleAddReading}
                    disabled={!inputTemp}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Add Reading
                  </button>
                )}
              </div>
            </div>

            {baselineTemp !== null && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Thermometer className="w-5 h-5 text-blue-600" />
                      </div>
                      <h4 className="text-gray-600">Baseline Temp</h4>
                    </div>
                    <p className="text-gray-900">{baselineTemp.toFixed(1)} {TEMPERATURE_UNIT}</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-purple-100 p-2 rounded-lg">
                        <Thermometer className="w-5 h-5 text-purple-600" />
                      </div>
                      <h4 className="text-gray-600">Current Temp</h4>
                    </div>
                    <p className="text-gray-900">{currentTemp?.toFixed(1)} {TEMPERATURE_UNIT}</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${delta >= 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                        {delta >= 0 ? (
                          <TrendingUp className={`w-5 h-5 ${delta >= 0 ? 'text-red-600' : 'text-green-600'}`} />
                        ) : (
                          <TrendingDown className={`w-5 h-5 ${delta >= 0 ? 'text-red-600' : 'text-green-600'}`} />
                        )}
                      </div>
                      <h4 className="text-gray-600">Delta Change</h4>
                    </div>
                    <p className="text-gray-900">{delta > 0 ? '+' : ''}{delta.toFixed(2)} {TEMPERATURE_UNIT}</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${rateOfChange >= 0 ? 'bg-orange-100' : 'bg-blue-100'}`}>
                        <Activity className={`w-5 h-5 ${rateOfChange >= 0 ? 'text-orange-600' : 'text-blue-600'}`} />
                      </div>
                      <h4 className="text-gray-600">Rate of Change</h4>
                    </div>
                    <p className="text-gray-900">{rateOfChange > 0 ? '+' : ''}{rateOfChange} {TEMPERATURE_UNIT}/hr</p>
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
                    <div className="space-y-2">
                      {status === 'safe' && (
                        <div className="flex items-start gap-2 text-green-700">
                          <Activity className="w-5 h-5 mt-0.5 flex-shrink-0" />
                          <p>No infection risk detected. Continue monitoring.</p>
                        </div>
                      )}
                      {status === 'warning' && (
                        <div className="flex items-start gap-2 text-yellow-700">
                          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                          <p>Moderate temperature increase detected. Monitor closely for signs of infection.</p>
                        </div>
                      )}
                      {status === 'risk' && (
                        <div className="flex items-start gap-2 text-red-700">
                          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                          <p>High infection risk! Immediate medical attention recommended. Temperature significantly elevated.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-gray-900 mb-6">Temperature Trend</h3>
                  <TemperatureTrend baselineTemp={baselineTemp} readings={readings} />
                </div>
              </>
            )}

            {baselineTemp === null && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
                <Thermometer className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-gray-900 mb-2">Set Baseline Temperature</h3>
                <p className="text-gray-600">Enter the initial wound temperature to begin monitoring</p>
              </div>
            )}
          </>
        )}

        {!selectedPatient && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
            <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">No Patient Selected</h3>
            <p className="text-gray-600">Select a patient from the dropdown above to start monitoring</p>
          </div>
        )}
      </div>
    </div>
  );
}
