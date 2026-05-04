# smart-bandage

Monorepo for smart-bandage:

- `firmware/` (ESP32 + TMP117 placeholders)
- `backend/` (Express + TypeScript API)
- `dashboard/` (React + TypeScript UI)
- `test-data/` (synthetic temperature datasets + heuristic verification script)

## Data flow

`TMP117 -> ESP32 firmware -> WiFi HTTP POST -> backend API -> React dashboard`

Firmware readings include a per-device `sequence_number`. The backend uses it to
report dropped readings without stopping the live system:

```bash
curl "http://localhost:3000/api/reliability?device_id=bandage_01&last=1000"
```

## Quick start

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

Runs on `http://localhost:3000` by default.

### 2) Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Opens a simple UI that fetches `GET /api/latest`.

### 3) Firmware

`firmware/src/`:

- real TMP117 reads over I2C/Qwiic
- real WiFi credentials handling
- proper timestamp source (NTP/RTC)
