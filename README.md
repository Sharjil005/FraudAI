# FraudShield AI

FraudShield AI is a full-stack fraud detection platform designed to identify suspicious URLs, scam messages, and risky documents before a user clicks, responds, or downloads. It combines lightweight ML models with rule-based explainability so the result is not just a label, but a score, evidence, and recommended action.

The project includes:
- a FastAPI backend for analysis, authentication, scan storage, and reporting
- a React + TypeScript frontend dashboard for users and admins
- a browser extension for quick link and text scanning
- a Docker setup for local or demo deployment

## Why this project exists

FraudShield focuses on the attack surfaces most people encounter every day:
- links sent through chat, email, or websites
- SMS or scam messages with urgency, impersonation, or payment requests
- PDF/image documents that contain phishing or fake operational details

Instead of returning a single yes/no verdict, the platform explains the risk with:
- a 0–100 risk score
- a risk band
- the main indicators that contributed
- a plain-language explanation
- a concrete recommendation

## Core features

### URL and link analysis
- Extracts 28 lexical and structural URL features, including host/path lengths, subdomain depth, character entropy, digit ratios, punycode, embedded IPs, `@` redirects, non-standard ports, encoding, URL shorteners, and risky file extensions.
- Detects suspicious keywords, credential-harvesting paths, lookalike brand names, and risky hostname patterns.
- Blends a Random Forest probability with weighted, human-readable rules. URL analysis is offline: the submitted destination is parsed, not visited.

### Message and SMS analysis
- Uses a TF-IDF vectorizer with one- and two-word n-grams and a Logistic Regression classifier.
- Adds pattern checks for scam categories such as OTP theft, account/KYC pressure, prize fraud, fake jobs, investment scams, tech support, romance, courier/customs, refunds, and threats.
- Returns matched phrases and indicators so users can see why a message was flagged.

### Document risk assessment
- Accepts PDF, PNG, JPG, and JPEG files up to the configured upload limit (10 MB by default).
- Examines PDF structure and metadata, timestamps, producer information, encryption and JavaScript signals, plus image properties and extracted text.
- Uses Tesseract OCR when installed. Without it, structural and metadata analysis still runs and the response indicates OCR availability/use.
- This is a risk assessment, not forensic proof that a document is genuine or forged.

### QR and UPI payment scanner
- Available in the dashboard at `/dashboard/scan/qr`; accepts an image upload, a pasted UPI URI/VPA/URL payload, or a camera capture (camera access requires browser permission and a secure context such as localhost/HTTPS).
- Decodes common QR images using OpenCV and pyzbar when available, then parses UPI fields such as VPA, payee name, amount, currency, transaction note, and merchant code.
- Checks for collect-request/payment-intent inversion (for example, being asked to enter a PIN to receive money), impersonating VPAs, mismatched brands and payment handles, deceptive transaction notes, and suspicious URLs embedded in the QR payload.
- Returns the decoded payment details alongside the same risk score, indicators, explanation, recommendation, history entry, and report options as other scans. QR/UPI analysis is rules-based and can call the URL analyzer for embedded links; it is not a separately trained ML classifier.

### Social Safety Circle
- Send and manage friend requests, create private groups, and add or remove group members.
- Share a saved scan as a threat alert with friends or groups, view received alerts, and mark alerts as read. Shared scan details are access-checked for recipients.
- Invitations can use SMTP when `SMTP_HOST` and `SMTP_PORT` are configured. In development, messages are written as HTML files under `backend/app/emails/` for preview.

### Analyst review and case workflow
- The Review Queue surfaces HIGH and CRITICAL scans, supports risk filtering and CSV export, and allows bulk mark-reviewed or dismiss actions.
- Scan details support assignment, reviewer name, notes, escalation reason, status changes, and a case timeline. Statuses include PENDING, COMPLETED, REVIEWED, ESCALATED, and DISMISSED.
- Dashboard summaries include queue aging/SLA indicators, workload counts, confidence buckets, recent scans, risk distribution, scan trends, and top indicators.

### Dashboards, governance, and reports
- User dashboard: activity totals, risk distribution, scan-type distribution, 14-day trends, recent scans, scan comparison, and live API/model/OCR capability status.
- Admin dashboard: platform-wide analytics, high-risk filters, suspicious-scan CSV export, user activation/suspension, model metadata, training-run status, and feedback/drift governance summaries.
- Scan results and history support downloadable PDF reports; scan details also support HTML reports.
- Feedback can be submitted through the scan feedback API and used to retrain the URL and message models. Admins can trigger retraining from the dashboard. Governance metrics are indicators based on available feedback and model metadata, not a substitute for a production model-monitoring service.
- JWT authentication, bcrypt password hashing, and role-based access (`USER` / `ADMIN`) protect the application.

### Browser extension
- Optional Chrome/Edge Manifest V3 extension with a popup scanner and right-click actions for links, selected text, or the current page URL.
- Sends URL/message scan requests to the local FraudShield API and displays an in-page verdict with risk band, score, and explanation; can fall back to a browser notification on restricted pages.
- The extension is a local development/demo helper. Its default API URL is `http://localhost:8000/api` and it uses the configured demo account for automatic development login; change those settings before using it in another environment.

## How analysis works

1. The frontend submits a URL, message, document, or QR/UPI target to the authenticated FastAPI endpoint. Pydantic validates structured input; upload routes enforce file type and size limits.
2. The relevant analyzer extracts modality-specific signals. URL and message analyzers combine scikit-learn models with explicit rules; QR analysis parses payment data and applies payment-fraud rules; document analysis inspects structure, metadata, and OCR text when available.
3. The risk engine combines weighted indicators into a 0–100 score and risk band, then builds the explanation and recommended action. The ML probability supports URL/message scoring; deterministic signals remain available when models cannot load.
4. The scan service persists a common scan record, a modality-specific detail record, and its risk assessment in one database transaction.
5. The API returns the verdict and evidence. The frontend renders the result, while history, dashboards, sharing, analyst workflow, and reporting use the saved scan ID.

## Tech stack

### Backend and API
- Python 3.11+, FastAPI, Uvicorn, Pydantic v2, and pydantic-settings
- SQLAlchemy 2.x with PostgreSQL via psycopg; SQLite is the zero-configuration local fallback
- PyJWT (HS256) and bcrypt for authentication
- scikit-learn, NumPy, and joblib for training, prediction, and model artifact caching
- pypdf, Pillow, OpenCV headless, and pyzbar for document/QR processing; pytesseract is optional OCR
- fpdf2 for PDF report generation; pytest and HTTPX for tests

### Frontend
- React 18, TypeScript 5.6, Vite 5, and Tailwind CSS v4
- React Router, Axios, Recharts, Lucide icons, and project-owned UI primitives using CVA, clsx, and tailwind-merge

### Browser extension
- Chrome/Edge Manifest V3, JavaScript service worker, popup UI, context menus, content script, and Chrome extension storage/notifications APIs

### Deployment
- Docker and Docker Compose for PostgreSQL, FastAPI, and the frontend
- Multi-stage frontend build and Nginx static hosting/API reverse proxy

## Project structure

```text
FraudShield/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── database/
│   │   ├── ml/
│   │   │   ├── qr_detector.py       QR decoding, UPI parsing, payment-risk rules
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── api/routes/social.py     Safety Circle and shared threat alerts
│   │   ├── main.py
│   │   └── __init__.py
│   ├── scripts/
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── seed.py
│   └── pytest.ini
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── nginx.conf
│   └── Dockerfile
├── extension/
│   ├── popup/
│   ├── background.js
│   ├── content.js
│   ├── manifest.json
│   └── README.md
├── docs/
│   └── ARCHITECTURE.md
├── .env.example
├── docker-compose.yml
├── generate_project_overview_pdf.py
├── README.md
└── MASTER PROMPT — BUILD FRAUDSHIELD AI COMPLETE PROJECT AUTONOMOUSLY.md
```

## Getting started

### Prerequisites
- Python 3.11 or newer
- Node.js 20 or newer
- Optional: Docker
- Optional: Tesseract OCR for better document text extraction

### 1) Backend setup

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

Windows PowerShell:
```powershell
.\.venv\Scripts\Activate.ps1
```

Windows Git Bash / bash:
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

The API will be available at:
- http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs

### 2) Frontend setup

Open a second terminal and run:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at:
- http://localhost:5173

### 3) Optional: Docker setup

From the repository root:

```bash
docker compose up --build
```

This starts:
- backend on http://localhost:8000
- frontend on http://localhost:3000
- PostgreSQL in the Docker network

### 4) Optional: install the browser extension

The extension is an unpacked Manifest V3 extension for local Chrome/Edge development:

1. Start the backend on `http://localhost:8000`.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge and enable **Developer mode**.
3. Choose **Load unpacked** and select this repository's `extension/` directory.
4. Pin FraudShield AI, then use the popup or right-click a link, selected text, or page to scan it.

The extension has local-demo defaults. Configure its API URL and authentication settings before pointing it at a different environment; do not rely on seeded demo credentials for a public deployment. See [extension/README.md](extension/README.md) for details.

## Environment configuration

Copy the sample config:

```bash
cp .env.example .env
```

The app has safe defaults and can run without a custom .env file, but production deployments should set stronger values such as:
- `SECRET_KEY`
- `ADMIN_PASSWORD`
- `DEMO_PASSWORD`
- `POSTGRES_PASSWORD`

The repo also supports automatic fallback to SQLite if PostgreSQL is unavailable.

## Default demo accounts

These are created during startup when bootstrap users are enabled:

| Role | Email | Password |
| --- | --- | --- |
| Demo user | demo@fraudshield.local | Demo@12345 |
| Admin | admin@fraudshield.local | Admin@12345 |

You can change these values in `.env` or by editing the environment variables used by the backend.

## How to use the app

1. Start the backend and frontend.
2. Sign in with a demo account.
3. Choose one of the supported scan types:
   - URL inspection
   - message/SMS analysis
   - document upload analysis
   - QR image/camera scan or pasted UPI URI/VPA
4. Review the returned score, indicators, decoded details, explanation, and recommendation.
5. Use scan history to reopen results and download reports. Share a saved threat with a friend or Safety Circle group from the scan details.
6. Analysts can work HIGH/CRITICAL cases in the Review Queue, assign and annotate cases, escalate them, or bulk mark/dismiss selected scans.
7. Admins can review platform analytics and model/governance status, manage user accounts, export suspicious scans, and trigger feedback-based URL/message retraining.

The optional extension sends URL and message scans to the same API. Scans and shared alerts still require the backend and database to be available.

## API overview

All application API routes use the `/api` prefix. Protected routes require `Authorization: Bearer <token>`; sign in through `/api/auth/login` to obtain one. The live Swagger UI at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) and ReDoc at `/redoc` include the complete request/response schemas.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register`, `/api/auth/login` | Create an account or sign in |
| `GET` | `/api/auth/me` | Read the current user |
| `POST` | `/api/scan/url` | Analyze a URL |
| `POST` | `/api/scan/message` | Analyze a message or SMS |
| `POST` | `/api/scan/document` | Analyze an uploaded PDF/image |
| `POST` | `/api/scan/qr` | Analyze a pasted QR payload, UPI URI, VPA, or URL |
| `POST` | `/api/scan/qr/upload` | Decode and analyze an uploaded QR image |
| `GET` | `/api/scan/capabilities` | Report model, OCR, and upload capabilities |
| `GET` | `/api/scans` | Paginate/search/filter scan history |
| `GET`, `DELETE` | `/api/scans/{scan_id}` | Read or delete a scan (subject to access rules) |
| `PATCH` | `/api/scans/{scan_id}/status` | Update analyst status, assignment, and case notes |
| `PATCH` | `/api/scans/bulk-status` | Apply a triage update to multiple scans |
| `POST` | `/api/scans/{scan_id}/feedback` | Record a scan label/feedback and request feedback-based retraining |
| `GET` | `/api/dashboard/summary` | Current user's stats, trends, queue, and workload |
| `GET` | `/api/admin/analytics` | Admin-only platform and governance analytics |
| `POST` | `/api/admin/model/retrain` | Admin-only model retraining from eligible feedback |
| `GET` | `/api/admin/users` | Admin-only account listing |
| `PATCH` | `/api/admin/users/{user_id}/status` | Admin-only account activation/suspension |
| `GET` | `/api/reports/{scan_id}?fmt=pdf\|html` | Download a scan report |
| `GET` | `/api/social/friends`, `/api/social/groups`, `/api/social/alerts` | Read Safety Circle connections, groups, and received alerts |
| `POST`, `DELETE` | `/api/social/*` | Manage friend requests/groups, share alerts, and mark alerts read |
| `GET` | `/api/health` | Check service, database, and model status |

## Testing

Run the backend test suite:

```bash
cd backend
python -m pytest
```

There is also a smoke script for live API validation:

```bash
cd backend
python scripts/smoke_api.py
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — project architecture and design notes
- [extension/README.md](extension/README.md) — browser extension setup and usage
- [FraudShield_Project_Overview.pdf](docs/FraudShield_Project_Overview.pdf) — project overview document

## Notes

- Document scoring is meant to be explanatory and risk-oriented, not forensic proof.
- URL/message models use a bundled, project-sized labeled corpus; model scores are not a claim of production-grade threat-intelligence coverage. Rule-based indicators provide explicit evidence alongside the ML estimates.
- The project does not use external paid AI APIs or live reputation/blocklist lookups. A local run can work without PostgreSQL or OCR; PostgreSQL and Tesseract are optional, with SQLite and reduced document analysis as fallbacks.
- Feedback-based retraining is limited to eligible URL and message feedback. QR detection is rule-based, and document detection uses structural/metadata analysis plus optional OCR.
- The extension is optional, requires a running local API, and has local-demo authentication defaults. Review its configuration before using it beyond a local demonstration.

## License

This project is currently intended for educational and project-based use. Add a proper license file before public or commercial distribution.
