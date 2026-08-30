<div align="center">

# 🛡️ FraudShield AI

**AI-Powered Digital Fraud Detection & Risk Analysis Platform**

*Detect Digital Fraud Before It Detects You.*

[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.5-F7931E?logo=scikitlearn&logoColor=white)](https://scikit-learn.org/)
[![Tests](https://img.shields.io/badge/tests-98%20passing-3fb950)](#testing)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)

</div>

---

## Overview

FraudShield AI analyses three of the surfaces attackers actually use — **links, messages and documents** — and returns a single, explainable risk assessment for each one.

Most fraud tools answer *"is this phishing? yes/no"*. That is useless to the person who has to make a decision. FraudShield never returns a bare verdict: every scan comes back with a **0–100 risk score**, a **risk band**, the **top contributing indicators**, a **plain-language explanation**, and a **concrete recommendation** that a non-technical user can act on.

It runs entirely on your own machine. There is no external AI API, no API key, and no dataset download — the classifiers train themselves from a bundled labelled corpus on first boot (about five seconds) and cache to disk.

### Why it exists

Digital payment fraud in India alone runs into thousands of crores a year, and the overwhelming majority of it starts with something mundane: a shortened link, an "URGENT: your account is blocked" SMS, or a forged invoice PDF. The technical signals that give these away — a hyphen-stuffed hostname impersonating a bank, an OTP request paired with a deadline, a PDF whose creation and modification timestamps disagree — are all detectable without any private data. FraudShield packages that detection into something a normal person can use before they click.

---

## Features

### 🔗 URL & Link Analysis
- **28 lexical and structural features** extracted per URL: length distributions, subdomain depth, character entropy, digit ratios, punycode, embedded IPs, `@`-redirects, non-standard ports, hex encoding, risky file extensions
- Detects **brand impersonation** (`sbi-verify-kyc.co`), **credential-harvesting paths**, **URL shorteners**, and **suspicious TLDs**
- A **Random Forest classifier** blended with a weighted rule engine, so the score has both statistical and explainable-by-construction backing

### 💬 Message & SMS Analysis
- **TF-IDF (1–2 grams) + Logistic Regression** over a labelled scam corpus, combined with **15 categories** of scam pattern detection
- Recognises OTP theft, KYC/account-block panic, lottery and prize fraud, fake job offers, investment and crypto fraud, tech-support scams, romance fraud, courier/customs fraud, refund scams, and threat/extortion language
- Surfaces the **exact suspicious phrases** it matched, so the user can see *why*, not just *what*

### 📄 Document Risk Assessment
- Accepts **PDF, PNG, JPG** up to 10 MB
- Structural and metadata analysis: page/object anomalies, producer strings, **creation-vs-modification timestamp conflicts**, embedded JavaScript, encryption flags, image dimension and compression irregularities
- **Optional OCR** via Tesseract. When Tesseract is unavailable the engine degrades gracefully to metadata + structural analysis and says so in the response (`ocr_used: false`) — it never silently returns a weaker result as if it were a full one
- Deliberately framed as **risk assessment, not forensic proof**. Every document response carries a disclaimer; the wording is "potential anomalies detected / requires manual verification", never "this document is forged"

### 📊 Explainable Risk Engine
- Deterministic **weighted rule engine** is authoritative for explanations; the ML classifier adjusts confidence
- **Diminishing-returns aggregation with hard floors**, so a single critical signal is never averaged away by a crowd of benign ones
- Bands: **LOW 0–29 · MEDIUM 30–59 · HIGH 60–79 · CRITICAL 80–100**
- Multi-signal fusion weights: URL `0.35` · Message `0.30` · Document `0.35`
- **Graceful degradation**: if scikit-learn or a model artefact is missing, the engine runs rules-only and reports `mode: heuristic` on `/api/health` instead of failing

### 🔐 Platform
- **JWT authentication** with bcrypt password hashing, role-based access (`USER` / `ADMIN`)
- **Scan history** with pagination, full-text search, and filtering by type and risk band
- **User dashboard**: totals, fraud detections, risk distribution, 14-day trend, recent scans
- **Admin dashboard**: platform-wide analytics, top indicators across all scans, most suspicious recent scans, user management with account suspension
- **Downloadable PDF and HTML reports** that genuinely download, with correct `Content-Disposition` filenames
- Dark cybersecurity-SaaS UI: responsive, keyboard accessible, real loading states, real empty states, real error states

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser — React 18 + TypeScript + Vite + Tailwind v4                │
│                                                                      │
│  Landing · Login · Register · Dashboard · URL / Message / Document   │
│  Scanner · History · Scan Details · Admin                            │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  Axios · Bearer JWT · relative /api
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  FastAPI — routers → services → ML engines                           │
│                                                                      │
│  api/routes/    auth · scan · scans · dashboard · admin · reports     │
│  services/      risk_engine · scan_service · analytics · report       │
│  ml/            url_detector · message_detector · document_analyzer   │
│                 features · datasets · model_store                     │
│  core/          config · security (JWT + bcrypt) · deps · logging     │
└───────────────┬──────────────────────────────────┬───────────────────┘
                │ SQLAlchemy 2.0 (typed ORM)       │ joblib artefacts
                ▼                                  ▼
      ┌───────────────────────┐          ┌────────────────────────┐
      │ PostgreSQL            │          │ Trained models on disk │
      │   ↓ auto-fallback     │          │ RandomForest + TF-IDF  │
      │ SQLite (zero config)  │          │ MODEL_FORMAT_VERSION=3 │
      └───────────────────────┘          └────────────────────────┘
```

### Request lifecycle of a scan

1. **Route** validates the payload with a Pydantic v2 schema (`app/schemas/scan.py`)
2. **Detector** extracts features and produces raw signals — each one a named indicator with a severity and a weight
3. **Risk engine** (`app/services/risk_engine.py`) aggregates signals into a 0–100 score, applies hard floors, assigns the band, and composes the explanation and recommendation
4. **ML model** contributes a probability that nudges the score; when unavailable this step is skipped and the rule score stands alone
5. **Scan service** persists the parent `scans` row plus the modality-specific child row plus a `risk_assessments` row, in one transaction
6. **Response** returns the full assessment: score, band, prediction, indicators, explanation, recommendation, and the persisted `scan_id` for history and reports

### Database schema

| Table | Purpose |
| --- | --- |
| `users` | Accounts, bcrypt hashes, role, active flag |
| `scans` | Parent record for every scan: type, score, band, prediction, timestamps |
| `url_scans` | URL-specific detail: the URL, extracted feature vector |
| `message_scans` | Message body, detected categories, matched suspicious phrases |
| `document_scans` | Filename, MIME type, size, extracted text, metadata, OCR flag |
| `risk_assessments` | Indicators, explanation, recommendation, engine mode and version |

Splitting the modality tables off the parent keeps `scans` narrow for history/pagination queries while letting each analysis type store whatever shape it needs.

---

## Technology stack

| Layer | Choices |
| --- | --- |
| **Frontend** | React 18, TypeScript 5.6 (strict, `verbatimModuleSyntax`), Vite 5, Tailwind CSS v4, hand-rolled shadcn-style primitives (clsx + tailwind-merge + CVA), React Router 6, Axios, Lucide icons, Recharts |
| **Backend** | FastAPI, Uvicorn, Pydantic v2 + pydantic-settings, SQLAlchemy 2.0 typed ORM |
| **Auth** | PyJWT (HS256) + bcrypt, used directly — no passlib |
| **ML** | scikit-learn (RandomForestClassifier, TfidfVectorizer, LogisticRegression), NumPy, joblib |
| **Documents** | pypdf, Pillow, pytesseract (optional), fpdf2 for PDF reports |
| **Database** | PostgreSQL 16 with automatic SQLite fallback |
| **Testing** | pytest + FastAPI `TestClient` (98 tests) and a stdlib end-to-end smoke script |
| **Deployment** | Docker multi-stage builds, nginx reverse proxy, docker compose |

**Why Tailwind v4 and no shadcn CLI:** v4's CSS-first `@theme` keeps the whole design system in one file with no `tailwind.config.js` to drift. The UI primitives are hand-written in the shadcn *style* (composable, `cn()`-merged, variant-driven) rather than generated, so there is no dependency on the CLI or on a component registry — every file in `components/ui/` is readable and owned by this project.

---

## Folder structure

```
FraudShield/
├── backend/
│   ├── app/
│   │   ├── main.py                 FastAPI app, middleware, exception handlers, /api/health
│   │   ├── api/
│   │   │   ├── router.py           Aggregates every route module under /api
│   │   │   └── routes/             auth · scan · scans · dashboard · admin · reports
│   │   ├── core/
│   │   │   ├── config.py           Env-driven Settings with safe development defaults
│   │   │   ├── security.py         bcrypt hashing, JWT encode/decode
│   │   │   ├── deps.py             CurrentUser / AdminUser / DbSession dependencies
│   │   │   └── logging_config.py   Structured console logging
│   │   ├── database/
│   │   │   ├── session.py          Engine, PostgreSQL→SQLite fallback, session factory
│   │   │   └── init_db.py          create_all + idempotent bootstrap accounts
│   │   ├── models/                 SQLAlchemy ORM: user.py, scan.py
│   │   ├── schemas/                Pydantic request/response contracts
│   │   ├── services/               risk_engine · scan_service · analytics · report
│   │   └── ml/
│   │       ├── features.py         28-feature URL extractor
│   │       ├── url_detector.py     Random Forest + rule blend
│   │       ├── message_detector.py TF-IDF + LogisticRegression + 15 pattern categories
│   │       ├── document_analyzer.py PDF/image structural, metadata and OCR analysis
│   │       ├── datasets.py         Bundled labelled training corpus
│   │       └── model_store.py      Training, joblib caching, versioning, warm-up
│   ├── scripts/smoke_api.py        End-to-end smoke test against a live server
│   ├── seed.py                     Idempotent demo data seeder
│   ├── tests/                      98 pytest tests
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.tsx                Vite entrypoint: Router → Auth → Toast providers
│   │   ├── App.tsx                 Route table with guards
│   │   ├── pages/                  The 10 pages + NotFound + AuthShell
│   │   ├── layouts/                PublicLayout, DashboardLayout (sidebar + topbar)
│   │   ├── components/
│   │   │   ├── ui/                 Button, Card, Input, Badge, Alert, Toast, Skeleton…
│   │   │   ├── charts/Charts.tsx   Recharts wrappers, dark-themed
│   │   │   ├── RiskMeter.tsx        Animated 0–100 gauge
│   │   │   ├── ScanResultCard.tsx   The explainable-result surface
│   │   │   └── ScanHistoryTable.tsx
│   │   ├── services/               Axios client + one module per API area
│   │   ├── context/AuthContext.tsx Session state, token persistence, 401 handling
│   │   ├── hooks/                  useAsync, useAuth, useDebounced
│   │   ├── lib/                    cn, risk band helpers, formatters
│   │   ├── types/index.ts          Wire-format types shared by every service
│   │   └── index.css               Tailwind v4 @theme design tokens + @utility
│   ├── nginx.conf                  SPA fallback + /api reverse proxy
│   ├── package.json
│   └── Dockerfile
├── docs/                           Architecture, API reference, ML notes, demo script
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Installation

### Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Python | 3.11+ | 3.12 recommended (tested on 3.12 and 3.14) |
| Node.js | 20+ | Tested on 22 |
| PostgreSQL | 14+ | **Optional** — SQLite is the automatic fallback |
| Tesseract OCR | 5+ | **Optional** — document analysis works without it |

Docker is optional too; a local run needs neither Docker nor PostgreSQL.

### 1. Backend

```bash
cd backend
python -m venv .venv
```

Activate it — Windows (Git Bash):

```bash
source .venv/Scripts/activate
```

macOS / Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the API:

```bash
uvicorn app.main:app --reload --port 8000
```

First boot creates the database schema, seeds the demo and admin accounts, and trains both classifiers (~5 s, cached to `app/ml/artifacts/` afterwards). The API is then on **http://127.0.0.1:8000** with Swagger UI at **/docs**.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` to port 8000, so no CORS configuration is needed.

### 3. Sign in

| Role | Email | Password |
| --- | --- | --- |
| Demo user | `demo@fraudshield.local` | `Demo@12345` |
| Administrator | `admin@fraudshield.local` | `Admin@12345` |

> These are **development defaults** created by `app/database/init_db.py`. Override `ADMIN_PASSWORD` / `DEMO_PASSWORD` via environment variables — or set `CREATE_BOOTSTRAP_USERS=False` — before exposing this anywhere. Nothing in the codebase hardcodes a production credential.

### Optional: OCR

Document scanning works without Tesseract; installing it just adds text extraction from images and scanned PDFs.

- **Windows** — install the [UB Mannheim build](https://github.com/UB-Mannheim/tesseract/wiki) and add it to `PATH`
- **macOS** — `brew install tesseract`
- **Debian/Ubuntu** — `sudo apt install tesseract-ocr`

Confirm what the running server detected:

```bash
curl http://127.0.0.1:8000/api/scan/capabilities
```

---

## Environment variables

Everything has a working default, so the app runs with no `.env` at all. Copy the template to harden it:

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///backend/fraudshield.db` | Connection string. Point at PostgreSQL for a production-style run |
| `SECRET_KEY` | random per start | **Set this in production.** A random key invalidates all tokens on restart |
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token lifetime |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | `admin@fraudshield.local` / `Admin@12345` | Bootstrap admin |
| `DEMO_EMAIL` / `DEMO_PASSWORD` / `DEMO_NAME` | `demo@fraudshield.local` / `Demo@12345` | Bootstrap demo user |
| `CREATE_BOOTSTRAP_USERS` | `True` | Set `False` to skip account seeding entirely |
| `UPLOAD_DIRECTORY` | `backend/uploads` | Where uploaded documents land |
| `MAX_UPLOAD_SIZE_MB` | `10` | Upload cap |
| `ALLOWED_UPLOAD_EXTENSIONS` | `png,jpg,jpeg,pdf` | Accepted document types |
| `MODEL_DIRECTORY` | `backend/app/ml/artifacts` | joblib cache for trained models |
| `TRAIN_MODELS_ON_STARTUP` | `True` | `False` runs rules-only, no training cost |
| `ENVIRONMENT` / `DEBUG` | `development` / `True` | Runtime mode |
| `CORS_ORIGINS` | localhost 5173/4173/3000 | Comma-separated allowed origins |
| `VITE_API_BASE_URL` | *(unset → `/api`)* | Frontend override for a non-proxied API |
| `VITE_PROXY_TARGET` | `http://127.0.0.1:8000` | Where the dev server proxies `/api` |

Generate a real secret key:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## Database configuration

FraudShield **prefers PostgreSQL and falls back to SQLite automatically**. A marker or reviewer with nothing installed still gets a working app; a production deployment gets a real database. The probe happens once at import time in `app/database/session.py`:

1. If `DATABASE_URL` is a SQLite URL, use it directly
2. Otherwise build the engine and run `SELECT 1` with a 5-second connect timeout
3. On success, log `Connected to PostgreSQL` and proceed
4. On *any* failure — unreachable host, wrong credentials, missing driver — log a warning (with the password masked) and transparently switch to `sqlite:///backend/fraudshield.db`

`GET /api/health` always reports which one is actually in use, so a silent fallback is never invisible.

To use PostgreSQL locally:

```bash
createdb fraudshield
```

```bash
export DATABASE_URL="postgresql+psycopg://fraudshield:fraudshield@localhost:5432/fraudshield"
```

Tables are created with `Base.metadata.create_all()` on startup — no migration step is required for a fresh database. (For schema evolution in a longer-lived deployment, add Alembic; see [Future improvements](#future-improvements).)

### Seeding demo data

```bash
cd backend
python seed.py
```

Idempotent: it ensures the demo and admin accounts exist and adds a spread of representative scans across all three types and all four risk bands, so the dashboard and admin analytics have something to show. Safe to re-run. To clear existing scans first:

```bash
python seed.py --reset
```

Credentials come from the environment or the development defaults — the seed script hardcodes none.

---

## Docker

The compose stack runs PostgreSQL, the API, and the nginx-served frontend together:

```bash
docker compose up --build
```

| Service | URL | Notes |
| --- | --- | --- |
| Frontend | http://localhost:3000 | nginx serving the built bundle, proxying `/api` to the API |
| API | http://localhost:8000 | Also reachable at http://localhost:3000/api |
| Swagger UI | http://localhost:8000/docs | Also at http://localhost:3000/docs |
| PostgreSQL | internal only | Not published to the host by default |

Details worth knowing:

- **`backend/Dockerfile`** — `python:3.12-slim`, includes `tesseract-ocr` so OCR is fully functional in the container, runs as a non-root user (uid 10001), and has a `/api/health` healthcheck with a 90-second start period to cover model training
- **`frontend/Dockerfile`** — multi-stage: `node:22-alpine` typechecks and bundles, then `nginx:1.27-alpine` serves ~230 kB gzipped of static output. The final image contains no Node.js
- **`nginx.conf`** — SPA fallback so deep links like `/dashboard/scans/12` resolve, `/api` reverse proxy (which makes CORS a non-issue in Docker), 12 MB body limit for uploads, immutable caching for content-hashed assets
- **Named volumes** — `postgres_data`, `uploads_data`, `model_data` persist the database, uploaded documents, and trained models across restarts
- **Startup order** — the API waits on the database's `pg_isready` healthcheck before booting

Override any default by creating a `.env` beside `docker-compose.yml`:

```bash
POSTGRES_PASSWORD=something-strong
SECRET_KEY=your-generated-key
ADMIN_PASSWORD=your-admin-password
WEB_PORT=3000
```

Useful commands:

```bash
docker compose logs -f backend
```

```bash
docker compose exec backend pytest
```

```bash
docker compose down -v
```

> `docker compose down -v` deletes the named volumes, wiping the database and uploaded files. Omit `-v` to keep them.

---

## API documentation

Interactive docs are generated from the code itself:

- **Swagger UI** — http://127.0.0.1:8000/docs (use **Authorize** to paste a token and try protected endpoints)
- **ReDoc** — http://127.0.0.1:8000/redoc
- **OpenAPI JSON** — http://127.0.0.1:8000/openapi.json

All routes are prefixed `/api`. Protected routes need `Authorization: Bearer <token>`.

### Authentication

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | — | Create an account, returns a token — `201` |
| `POST` | `/api/auth/login` | — | Sign in, returns a token — `200` |
| `GET` | `/api/auth/me` | ✅ | Current user |

### Analysis

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/scan/url` | ✅ | Analyse a URL — `201` |
| `POST` | `/api/scan/message` | ✅ | Analyse a message or SMS — `201` |
| `POST` | `/api/scan/document` | ✅ | Analyse an uploaded document (multipart `file`) — `201` |
| `GET` | `/api/scan/capabilities` | — | Model and OCR availability |

### History, dashboards and reports

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/scans` | ✅ | Paginated history. `page`, `page_size`, `scan_type`, `risk_level`, `search` |
| `GET` | `/api/scans/{id}` | ✅ | One scan in full detail |
| `DELETE` | `/api/scans/{id}` | ✅ | Delete a scan — `204` |
| `GET` | `/api/dashboard/summary` | ✅ | Stats, risk distribution, type distribution, trend, recent scans |
| `GET` | `/api/reports/{scan_id}` | ✅ | Download a report. `?fmt=pdf` (default) or `?fmt=html`; `?format=` also accepted |
| `GET` | `/api/admin/analytics` | 🔑 | Platform analytics — `403` for non-admins |
| `GET` | `/api/admin/users` | 🔑 | All users |
| `PATCH` | `/api/admin/users/{id}/status?is_active=false` | 🔑 | Suspend or re-enable an account |
| `GET` | `/api/health` | — | Status, active database flavour, model state |

✅ authenticated · 🔑 admin only

### Example

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@fraudshield.local","password":"Demo@12345"}'
```

```bash
curl -s -X POST http://127.0.0.1:8000/api/scan/url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://secure-login-verify-account.example.com/login?account=12345"}'
```

Response (abridged — this is real output, not an illustration). Note that the verdict is never delivered alone:

```json
{
  "scan": {
    "scan_id": 37,
    "scan_type": "URL",
    "status": "COMPLETED",
    "created_at": "2026-08-29T15:32:32.745130",
    "target_label": "http://secure-login-verify-account.example.com/login?account=12345"
  },
  "url": "http://secure-login-verify-account.example.com/login?account=12345",
  "prediction": "Phishing",
  "risk_score": 76.28,
  "risk_level": "HIGH",
  "confidence": 0.756,
  "indicators": [
    {
      "code": "SUSPICIOUS_KEYWORDS",
      "label": "4 credential-bait keyword(s)",
      "detail": "The address contains security/finance bait words (account, login, secure, verify) that are typical of pages built to capture logins or payments.",
      "severity": "critical",
      "weight": 24.0
    },
    {
      "code": "NO_HTTPS",
      "label": "No HTTPS encryption",
      "detail": "The link uses plain HTTP, so anything you type can be read in transit.",
      "severity": "high",
      "weight": 14.0
    },
    {
      "code": "MANY_HYPHENS",
      "label": "Heavily hyphenated domain",
      "detail": "The domain contains 3 hyphens, a pattern frequently used to stitch together believable-sounding phrases.",
      "severity": "high",
      "weight": 13.0
    }
  ],
  "explanation": "This address shows strong signs of a phishing attempt. The risk score of 76/100 is driven mainly by 4 credential-bait keyword(s); no https encryption; heavily hyphenated domain. … A further 2 lower-weight signal(s) also contributed.",
  "recommendation": "Do not open this link. Never enter passwords, OTPs, card numbers or UPI PINs on this website. If the message claimed to come from your bank or a service you use, contact them through their official app or a number you already have."
}
```

Full request/response schemas for every endpoint: [`docs/API.md`](docs/API.md).

---

## Testing

98 pytest tests cover the risk engine, all three detectors, and every API route including authorization boundaries:

```bash
cd backend
python -m pytest
```

Tests run against an in-memory SQLite database with model training disabled, so the suite finishes in about 15 seconds and never touches your real data.

There is also an end-to-end smoke test that exercises a **live** server the way the frontend does — real seeded credentials, real query parameters, real multipart uploads, real report downloads:

```bash
cd backend
python scripts/smoke_api.py
```

It asserts the mandatory demo scenarios score correctly, that a `.exe` upload is rejected with `422`, that PDF responses really start with `%PDF-`, that admin analytics is `403` for a normal user, and that suspend/re-enable and delete round-trip properly. This script caught two defects the unit tests missed — the seeded `.local` email domain being rejected at login, and `?format=html` silently returning a PDF — because it uses the exact credentials and parameters the UI and docs advertise.

### Verified demo scenarios

| Input | Score | Band | Prediction |
| --- | --- | --- | --- |
| `http://secure-login-verify-account.example.com/login?account=12345` | 76.28 | **HIGH** | Likely Phishing |
| "URGENT: Your bank account has been blocked… share the OTP" | 93.77 | **CRITICAL** | Scam |
| "Congratulations! You have won Rs.50,000 in our lucky draw…" | 97.81 | **CRITICAL** | Scam |
| "Your OTP for login is 442819. Do not share it with anyone." | 9.90 | **LOW** | Legitimate |
| `https://www.google.com` | low | **LOW** | Legitimate |
| PDF upload with no OCR available | 15.00 | **LOW** | Indicators returned, disclaimer attached |

The genuine OTP notice scoring **LOW** matters as much as the scams scoring high: an engine that flags every message containing "OTP" is not a fraud detector, it is a keyword filter.

---

## Screenshots

> Replace these placeholders with your own captures. `docs/screenshots/` is the conventional home for them.

| | |
| --- | --- |
| **Landing page**<br>![Landing](docs/screenshots/landing.png) | **User dashboard**<br>![Dashboard](docs/screenshots/dashboard.png) |
| **URL scanner result**<br>![URL scanner](docs/screenshots/url-scanner.png) | **Message scanner result**<br>![Message scanner](docs/screenshots/message-scanner.png) |
| **Document scanner**<br>![Document scanner](docs/screenshots/document-scanner.png) | **Scan history**<br>![History](docs/screenshots/history.png) |
| **Scan details**<br>![Scan details](docs/screenshots/scan-details.png) | **Admin analytics**<br>![Admin](docs/screenshots/admin.png) |

---

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layer boundaries, request lifecycle, database schema, design decisions |
| [`docs/API.md`](docs/API.md) | Every endpoint with request/response examples and error shapes |
| [`docs/ML_MODELS.md`](docs/ML_MODELS.md) | Features, training data, metrics, the scoring formula, why hybrid |
| [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) | A timed walkthrough for a live presentation or viva |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Docker, environment hardening, production checklist |

---

## Known limitations

Stated plainly, because a fraud tool that overstates its own certainty is itself a hazard:

- **Document analysis is a risk indicator, not forensic proof.** It detects metadata and structural anomalies that *correlate* with tampering. A carefully forged document can be clean; a legitimate document re-saved by an unusual tool can look suspicious. Every response says so.
- **Training data is bundled and synthetic-leaning.** The corpus is representative and hand-labelled, not a live threat feed. The URL classifier's 1.0 held-out accuracy reflects a cleanly separable dataset, not real-world performance — the rule engine, not the classifier, is what carries the explanation.
- **No live reputation lookups.** No WHOIS, no blocklist API, no certificate transparency. Scoring is purely on-device lexical, structural and semantic analysis, which is what makes it work with no API key and no network dependency.
- **English-centric messages.** Pattern categories and the TF-IDF vocabulary target English and Hinglish scam phrasing. Other languages score lower than they should.
- **OCR quality bounds document text analysis.** Low-resolution or heavily styled scans extract poorly, and without Tesseract there is no text extraction at all.
- **`create_all()` instead of migrations.** Fine for a fresh database; a long-lived deployment needs Alembic.
- **Single-process rate limiting is absent.** There is no throttling on scan endpoints, so a public deployment should sit behind a gateway that provides it.

---

## Future improvements

- **Threat intelligence integration** — optional WHOIS age, certificate transparency and community blocklist lookups, with results as *additional* indicators so the offline path keeps working
- **Browser extension** — scan links in place, before the click
- **Real-time collaborative feed** — anonymised, opt-in sharing of newly detected campaigns across instances
- **Transformer-based message classification** — a small fine-tuned model for multilingual coverage, kept local
- **Alembic migrations** and a proper schema-evolution story
- **Per-user API keys and rate limiting** for programmatic access
- **Bulk CSV scanning** with an async job queue for large batches
- **Explanation feedback loop** — let users mark indicators as helpful or wrong and use it to retune weights
- **Mobile app** sharing the same API, with SMS inbox integration on Android

---

## License

MIT. See the badge above; add a `LICENSE` file before distributing.

---

<div align="center">

**FraudShield AI** — built as a final-year major project.

*Every verdict comes with its reasoning. That is the whole point.*

</div>
