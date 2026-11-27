# Smart Farm – precision agriculture platform

A full-stack platform that helps farmers measure soil zone by zone, connect an ESP32 soil robot, and get explainable recommendations for crops, irrigation, fertilizer and farm finance. It is bilingual (English / العربية, full RTL).

**Stack:** React 18 + TypeScript + Vite + Tailwind, Recharts, Leaflet · Node 20 + Express + TypeScript · PostgreSQL 16 + Prisma · Vitest/Supertest.

## Features

| Area | What it does |
|---|---|
| Accounts | Sign-up/login/logout, password reset by email, profile, multiple private farms per user. Every query is scoped to the owner |
| Farms & zones | Register a farm by point + area or a drawn boundary. It is split into **256 geo-referenced zones (A1–P16)** clipped to the real boundary. Each zone has its own data; unmeasured zones show **No Measurement Available** |
| ESP32 robot | Device ID + hashed key, QR pairing, HTTPS ingestion with validation, zone mapping (code or GPS), deduplication, batch upload, heartbeat, battery, status, survey progress |
| Soil monitoring | Robot / manual / laboratory sources kept distinct; charts, history, CSV export |
| Crop recommendation | 10 crops (wheat, rice, maize, tomato, potato, cotton, beans, sugarcane, onion, pepper). Weighted score from pH, temperature, moisture, salinity (Maas–Hoffman) and water availability, with per-factor explanations |
| Weather | NASA POWER daily data stored per farm, with fetch time and data date. Previously stored data is kept and flagged when a refresh fails |
| Irrigation | FAO-56 Kc × Hargreaves ET₀, measured moisture vs crop target, rain check, water-use records and charts |
| AI diagnosis | Plant disease (max 3 candidates) and visible nutrient-deficiency symptoms through a pluggable server-side provider. With no provider configured, the result is **UNAVAILABLE**; the app never shows invented output |
| Fertilizer | Combines crop, stage, zone pH/EC, lab N-P-K and AI findings → products, method, timing, required tests. **No invented doses**; sodium is never suggested as a fertilizer |
| BioPod research | Treatment groups, replicates, observations, retention %, mean ± SD, 95 % CI and Welch t-test only with ≥ 2 replicates, CSV export |
| Finance | Seasons, expenses by category, harvests, multiple sales, revenue/cost/profit/margin/cost-per-ton. **Actual and estimated figures are calculated separately**. Editable price list (EGP) |
| Decision support | Per-zone prioritized issues (water, salinity, pH, nutrients, disease, stale data, finance) with evidence, actions and confidence |
| Reports | Farm PDF report, CSV for measurements, finance and BioPod |

## Quick start (development)

Prerequisites: Node 20+, Docker (or any PostgreSQL 14+).

```bash
docker compose up -d db                  # PostgreSQL on :5432
cp server/.env.example server/.env       # then edit JWT_SECRET
npm install
npm run db:migrate -w server             # create schema
npm run db:seed                          # crop reference data + default price estimates
npm run dev                              # API :4000 + web :5173
```

Open http://localhost:5173, create an account, then either register your farm or click **Create demo farm**. The demo farm is clearly labelled and contains simulated readings only.

### Tests & checks

```bash
npm test          # unit + API integration tests (needs the database)
npm run lint      # TypeScript checks for server and web
npm run build     # production build
```

## Production

```bash
npm ci && npm run build
cd server && npx prisma migrate deploy && npm run db:seed
NODE_ENV=production node dist/index.js   # serves the API and web/dist on PORT
```

- Set a strong `JWT_SECRET`, `WEB_ORIGIN`, `PUBLIC_API_URL`, and SMTP for password reset.
- Put the server behind HTTPS (reverse proxy). Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- Persist `UPLOAD_DIR` (plant images) on durable storage.

## Configuration

All settings are in `server/.env` (see `server/.env.example`). Secrets stay on the server and are never sent to the browser.

### AI providers

| Variable | Values |
|---|---|
| `AI_DISEASE_PROVIDER` | `none` (default), `kindwise` (Kindwise crop.health, needs `KINDWISE_API_KEY`), `anthropic` (Claude vision, needs `ANTHROPIC_API_KEY`), `custom` |
| `AI_NUTRIENT_PROVIDER` | `none`, `anthropic`, `custom` |

**Custom AI model:** set `CUSTOM_AI_URL` (and optionally `CUSTOM_AI_TOKEN`). The server POSTs `{image_base64, mime_type, crop, growth_stage, context}` to `<url>/disease` and `<url>/nutrients`. Expected responses:

- `/disease` → `{candidates:[{name, confidence, symptoms, causes, treatment, prevention, advice}], isHealthy?, notes?}`
- `/nutrients` → `{findings:[{nutrient:"N"|"P"|…, confidence, visibleSymptoms, possibleCauses, treatment, fertilizers, additionalTests}], differentials?, notes?}`

Image analysis reports **visible symptoms only**. It does not measure soil nutrient concentrations; confirm with soil or leaf-tissue lab tests.

### NASA POWER

Public API with no key. The server requests daily `T2M, T2M_MAX, T2M_MIN, RH2M, PRECTOTCORR, ALLSKY_SFC_SW_DWN, WS2M` (community `AG`) for the farm coordinates. Data is a few days behind real time. The app shows the data date and fetch time, and never labels it as live.

## ESP32

See [docs/ESP32.md](docs/ESP32.md) for registration, wiring, calibration, the full API contract and a curl test. The firmware is in `firmware/smartfarm_esp32/`.

## Security

- Passwords hashed with bcrypt (cost 12). JWT is kept in an HttpOnly cookie (Bearer is also accepted for API clients).
- Device keys are random 192-bit secrets stored as SHA-256 hashes and compared in constant time.
- Every resource is checked for ownership. Other users' farms return 404.
- Zod validation on all inputs. Rate limits on auth, AI, device and general API routes. Helmet headers.
- Uploads: 8 MB limit, type detected from file content (JPEG/PNG/WebP), random file names, served only to the owner.
- CSV exports neutralise spreadsheet formula injection.

## Scientific references and limits

- Salinity thresholds and slopes: Ayers & Westcot, FAO Irrigation & Drainage Paper 29 (Maas & Hoffman 1977).
- Crop coefficients: Allen et al., FAO-56. ET₀: Hargreaves & Samani (1985).
- Seasonal water needs: FAO Irrigation Water Management Training Manual 3.
- Nutrient symptoms: FAO plant nutrition guides, IPNI 4R, extension literature.

All recommendations support decisions; they do not replace a local agronomist or a laboratory. Default market prices are unverified planning estimates. Edit them with local prices.

## Project layout

```
server/   Express API, Prisma schema/migrations/seed, domain logic (src/lib), tests
web/      React app (pages, components, i18n)
firmware/ ESP32 Arduino sketch
docs/     ESP32 integration guide
```
