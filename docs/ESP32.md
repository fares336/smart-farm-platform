# ESP32 robot integration

The robot sends soil readings to the Smart Farm API over **Wi-Fi (HTTPS)**. USB is used only to flash the firmware and view the serial monitor. A robot plugged into a computer over USB does **not** send data to the platform by itself.

## 1. Register the robot

1. Open **Robot** in the web app and click **Generate device ID & key**.
2. Copy the `device_id` (e.g. `SF-7KQ2M9XA`) and `device_key` (`sfk_…`). The key is shown **once**. The server stores only its SHA-256 hash. Use **New key** to rotate it.
3. The QR code holds `{"server","device_id","device_key"}` as JSON, for provisioning apps.

## 2. Flash the firmware

`firmware/smartfarm_esp32/smartfarm_esp32.ino`

- Arduino IDE → Boards Manager → install **esp32 by Espressif** (≥ 2.0.6) → board **ESP32 Dev Module**.
- Library Manager → install **ArduinoJson** (v7).
- Set `WIFI_SSID`, `WIFI_PASSWORD`, `SERVER_URL`, `DEVICE_ID`, `DEVICE_KEY`.
- Calibrate the sensors (see below), then upload.

Typical wiring (3.3 V logic, use ADC1 pins because ADC2 is unavailable while Wi-Fi is on):

| Sensor | ESP32 pin | Notes |
|---|---|---|
| Capacitive soil moisture v1.2/v2.0 | GPIO34 | Calibrate dry/wet raw values |
| Analog pH module (e.g. DFRobot SEN0161/0169) | GPIO35 | 2-point calibration with pH 7 and pH 4 buffers |
| Analog EC module (e.g. DFRobot DFR0300) | GPIO32 | Calibrate with 1.413 mS/cm standard |
| DS18B20 temperature probe (optional) | any GPIO + 4.7 kΩ pull-up | Return `NAN` if not installed |
| Battery divider (optional) | GPIO33 | Set `BAT_DIVIDER` |

> Low-cost analog pH/EC probes drift. Recalibrate them regularly and check them against laboratory results. The platform stores the values exactly as received and does not correct them.

## 3. API contract

Base URL: `https://<server>/api/device/v1`

Headers on every request:

```
X-Device-Id: SF-XXXXXXXX
Authorization: Bearer sfk_xxxxxxxx   (or X-Device-Key: sfk_xxxxxxxx)
Content-Type: application/json
```

### POST `/measurements`

Single reading, or `{"readings":[…]}` with up to 100 readings (useful for offline buffering).

```json
{
  "zone_id": "C7",
  "moisture": 23.4,
  "ph": 7.6,
  "ec": 2.1,
  "temperature": 22.8,
  "timestamp": 1795800000,
  "message_id": "SF-7KQ2M9XA-1042",
  "gps": { "lat": 30.0451, "lng": 31.2362 },
  "battery": 78
}
```

| Field | Required | Validation |
|---|---|---|
| `zone_id` | yes, unless `gps` is inside the farm boundary | `A1`–`P16` (rows A–P north→south, columns 1–16 west→east) |
| `moisture` | at least one sensor value | 0–100 % (volumetric) |
| `ph` | | 0–14 |
| `ec` | | 0–30 dS/m (= mS/cm) |
| `temperature` | | −20–70 °C |
| `timestamp` | recommended | Unix seconds/ms or ISO-8601. Rejected if > 10 min in the future. If missing or before 2023 (unsynced clock), server time is used and noted on the reading |
| `message_id` | recommended | Unique per reading. Retries with the same id are deduplicated |
| `gps` | optional | Used to find the zone when `zone_id` is absent |
| `battery` | optional | 0–100 % |

Deduplication: by `message_id`, otherwise by (device, zone, timestamp).

Responses:

- `201` – at least one reading stored
- `200` – nothing new (duplicates only)
- `422` – all readings rejected (per-reading reasons in `results`)
- `401` – bad device credentials
- `429` – rate limit (120 requests/min per IP)

```json
{ "stored": 1, "duplicates": 0, "rejected": 0, "results": [{ "index": 0, "status": "stored", "id": "…", "zone": "C7" }] }
```

### POST `/heartbeat`

`{"battery": 80, "firmware": "1.0.0", "zone_id": "C7", "error": "optional message"}` → updates connection status, battery, firmware and current zone.

### GET `/config`

Returns the device id, farm id/name and server time. Useful for checking credentials.

## 4. Status shown in the app

| Status | Meaning |
|---|---|
| Sending data | Last stored reading < 2 min ago |
| Connected | Any contact within `ROBOT_ONLINE_MINUTES` (default 10) |
| Error | Latest contact reported an error or only rejected readings |
| Disconnected | No contact within `ROBOT_ONLINE_MINUTES` |

Survey progress counts the distinct zones measured by robots within `SURVEY_WINDOW_DAYS` (default 30).

## 5. Test without hardware

```bash
curl -X POST http://localhost:4000/api/device/v1/measurements \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: SF-XXXXXXXX" -H "Authorization: Bearer sfk_xxx" \
  -d '{"zone_id":"A1","moisture":24.5,"ph":7.6,"ec":2.1,"temperature":23.4,"message_id":"test-1"}'
```
