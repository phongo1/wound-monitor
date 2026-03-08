# smart-bandage

Monorepo for smart-bandage:

- `firmware/` (ESP32 + TMP117 placeholders)
- `backend/` (Express + TypeScript API)
- `dashboard/` (React + TypeScript UI)

## Data flow

`TMP117 -> ESP32 firmware -> WiFi HTTP POST -> backend API -> React dashboard`

## Current Scope

- Temperature only
- In-memory backend storage
- No auth, DB, Docker, MQTT, WebSockets, or cloud setup

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

Use `firmware/src/` as your starter code and fill in TODOs for:

- real TMP117 reads over I2C/Qwiic
- real WiFi credentials handling
- proper timestamp source (NTP/RTC)
