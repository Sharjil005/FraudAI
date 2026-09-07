# Architecture

How FraudShield AI is put together, and why it is put together this way.

---

## 1. Layers

```
Request → Router → Schema validation → Service → Detector → Risk engine → Persistence → Response
```

Each layer has exactly one job, and layers only ever call downward:

| Layer | Directory | Responsibility | Never does |
| --- | --- | --- | --- |
| **Routes** | `app/api/routes/` | HTTP concerns: status codes, auth dependencies, headers | Business logic, direct ORM writes |
| **Schemas** | `app/schemas/` | Request/response contracts, field validation | Database access |
| **Services** | `app/services/` | Orchestration, transactions, aggregation | HTTP awareness |
| **ML / detectors** | `app/ml/` | Feature extraction, model inference, raw signal production | Persistence, scoring policy |
| **Risk engine** | `app/services/risk_engine.py` | Turn signals into a score, band, explanation, recommendation | Feature extraction |
| **Models** | `app/models/` | SQLAlchemy ORM table definitions | Business rules |
| **Core** | `app/core/` | Config, security primitives, DI dependencies, logging | Anything domain-specific |

The rule that matters most: **detectors produce signals, the risk engine decides what they are worth.** A detector never returns a score. This is what makes it possible to retune scoring policy in one file without touching three detectors, and it is why every explanation reads consistently regardless of which surface was scanned.

---

## 2. Request lifecycle of a scan

Take `POST /api/scan/url`:

1. **`app/api/routes/scan.py`** — the route declares `current_user: CurrentUser` (a `Depends` chain that decodes the JWT, loads the user, and rejects inactive accounts) and `payload: UrlScanRequest`. FastAPI has already returned `401` or `422` before the handler body runs.

2. **`app/ml/features.py`** — `extract_url_features()` parses the URL and returns 28 numeric features plus the parsed parts. Pure function, no I/O.

3. **`app/ml/url_detector.py`** — runs two things over those features:
   - the **rule set**, which emits `Indicator` objects (`code`, `label`, `detail`, `severity`, `weight`)
   - the **Random Forest**, if a model is loaded, which emits a phishing probability

4. **`app/services/risk_engine.py`** — aggregates the indicators:
   - sorts by weight and applies **diminishing returns** so ten medium signals cannot outrank one critical signal
   - applies **hard floors**: certain codes guarantee a minimum band regardless of what else is present
   - blends the ML probability as a bounded adjustment, never as the primary score
   - assigns the band, then composes the `explanation` from the top indicators and picks the `recommendation` template that matches the band and modality

5. **`app/services/scan_service.py`** — `run_url_scan()` writes, in one transaction:
   - the parent `scans` row (type, score, band, prediction, status, timestamps)
   - the `url_scans` child row (URL, normalised URL, feature vector)
   - the `risk_assessments` row (indicators as JSON, explanation, recommendation, engine mode, version)

6. **Response** — `201 Created` with the full assessment plus `scan.scan_id`, which the frontend uses for the detail page and the report download.

Message and document scans follow the identical path with their own detector and child table. Document scans add an upload step: extension and size are validated before any bytes are parsed, and a rejected file (`.exe`, oversized) never reaches the analyzer.

---

## 3. Why the rule engine is authoritative

The obvious design is "train a classifier, return its probability". FraudShield deliberately does not do that, for three reasons:

**Explainability is a hard requirement, not a feature.** A user who is about to lose money needs to know *why* a link is dangerous. A Random Forest can give feature importances, but "entropy = 0.176" is not an explanation a person can act on. Hand-written rules carry their own human-readable text by construction.

**Rules degrade gracefully; models do not.** If scikit-learn is absent, an artefact is corrupt, or the format version has moved on, the rule engine still produces a complete, correct, explainable assessment. `/api/health` reports `mode: heuristic` and nothing breaks. A model-first design would have to fail the request.

**The training corpus is bundled, not live.** The URL classifier reaches 1.0 accuracy on its held-out split because the dataset is cleanly separable — which means the classifier is confirming what the rules already know, not discovering new knowledge. Treating it as authoritative would be dressing up the dataset's own structure as intelligence. It earns its place as a *confidence adjustment*, which is honest about what it contributes.

So: the classifier can move a score within bounds and sharpen the reported confidence. It cannot override a hard floor, and it cannot invent an indicator.

---

## 4. Scoring model

```
raw_score  = Σ (weightᵢ × decayⁱ)        for indicators sorted by weight, i = 0, 1, 2 …
floored    = max(raw_score, floor(codes present))
ml_adjusted = clamp(floored + bounded_delta(model_probability), 0, 100)
band       = LOW 0–29 · MEDIUM 30–59 · HIGH 60–79 · CRITICAL 80–100
```

The decay term is what makes the aggregation behave sensibly. Plain summation saturates at 100 the moment three medium signals appear; plain averaging lets a crowd of benign observations bury one fatal one. Weighted diminishing returns keeps the first few strong signals dominant while still letting a long tail of weak ones matter a little.

Multi-signal fusion, when more than one surface is available for the same artefact (a message containing a URL, a document containing text):

| Surface | Weight |
| --- | --- |
| URL | 0.35 |
| Message | 0.30 |
| Document | 0.35 |

---

## 5. Database design

```
users ─┬─< scans ─┬─< url_scans
       │          ├─< message_scans
       │          ├─< document_scans
       │          ├─< qr_scans
       │          └─< risk_assessments
```

`scans` is deliberately narrow — type, score, band, prediction, status, `user_id`, timestamps, and a short `target_label`. History and dashboard queries are the hottest paths in the app and they only ever need those columns, so they never touch a wide row or a JSON blob.

Each modality gets its own child table because the three analyses genuinely have nothing in common: a URL has a feature vector, a message has matched phrases and categories, a document has a filename, MIME type, size, extracted text and metadata. Forcing them into one table would mean a dozen mostly-null columns, or a single opaque JSON column that cannot be filtered.

`risk_assessments` is separated from `scans` so the human-facing payload (indicator array, explanation prose, recommendation) can grow without widening the row that pagination reads.

Tables are created with `Base.metadata.create_all()` at startup. That is the right trade for a project that must run immediately after checkout; a long-lived deployment should add Alembic.

---

## 6. PostgreSQL with automatic SQLite fallback

`app/database/session.py` probes the configured database once at import time:

1. SQLite URL → use it directly, no probe needed
2. Otherwise, build the engine with a 5-second connect timeout and run `SELECT 1`
3. Success → log `Connected to PostgreSQL`, done
4. Any failure — unreachable host, bad credentials, missing driver — log a warning with the password masked, dispose the engine, and rebuild against `sqlite:///backend/fraudshield.db`

`GET /api/health` reports the flavour actually in use, so the fallback is never invisible. This is why the app boots on a machine with nothing installed and also runs against real PostgreSQL in Docker with no code change.

---

## 7. Authentication and authorization

- **Hashing** — bcrypt via the `bcrypt` package directly. No passlib; it adds a compatibility layer this project has no use for and has caused version-pinning grief with bcrypt 4.x.
- **Tokens** — PyJWT, HS256, `sub` = user id, `exp` from `ACCESS_TOKEN_EXPIRE_MINUTES`. `SECRET_KEY` defaults to a per-process random value, which means tokens do not survive a restart unless you set it — the safe default.
- **Dependencies** — `app/core/deps.py` exposes `DbSession`, `CurrentUser` and `AdminUser` as annotated types. A route becomes admin-only by changing one annotation, which is far harder to get wrong than an `if` inside the handler.
- **Ownership checks** — every scan-scoped route verifies `scan.user_id == current_user.id` unless the caller is an admin. `403`, not `404`, so the distinction between "not yours" and "does not exist" stays honest.
- **Inactive accounts** — the `CurrentUser` dependency rejects suspended users, so an admin suspension takes effect on the next request rather than at token expiry.

---

## 8. Frontend architecture

```
main.tsx  BrowserRouter → AuthProvider → ToastProvider → App
App.tsx   route table with PublicLayout / GuestOnlyRoute / ProtectedRoute / AdminRoute
```

- **`services/api.ts`** is the single Axios instance. It attaches the bearer token in a request interceptor and, in a response interceptor, clears the session on any `401` that is not itself an auth call. Every service module imports this one client, so there is exactly one place where auth behaviour lives.
- **`context/AuthContext.tsx`** holds session state and persists the token to `localStorage` inside `try/catch` — private-browsing mode degrades to an in-memory session rather than crashing.
- **`hooks/useAsync.ts`** is the single data-fetching primitive: `{ data, error, loading, refresh, setData }`. Every page uses it, so loading, empty and error states are structurally identical across the app.
- **`types/index.ts`** mirrors the wire format exactly, including the uppercase enum values the API sends (`'HIGH'`, `'URL'`, `'ADMIN'`). No transformation layer, so there is nothing to drift.
- **`components/ui/`** are hand-written shadcn-*style* primitives — composable, `cn()`-merged, CVA variants. Written rather than generated, so there is no CLI or registry dependency.
- **Design system** lives entirely in `index.css` as Tailwind v4 `@theme` tokens and `@utility` definitions. There is no `tailwind.config.js` to fall out of sync.

TypeScript runs strict with `verbatimModuleSyntax` and `noUnusedLocals`/`noUnusedParameters`, and `npm run build` typechecks before it bundles — a type error fails the build rather than shipping.

---

## 9. Error handling

Three exception handlers in `app/main.py` mean the frontend only ever has to understand one error shape:

| Handler | Produces |
| --- | --- |
| `RequestValidationError` | `422` with Pydantic errors flattened to `{detail, errors[]}` — `detail` is a single readable sentence the UI can show verbatim |
| `ValueError` | `422` with the message, so a service can reject input without importing `HTTPException` |
| `Exception` | `500` with a generic message; the traceback goes to the log, never to the client |

`apiErrorMessage()` on the frontend is the mirror image: it unwraps `detail`, `errors[]`, and `message`, and translates `ERR_NETWORK` into "Cannot reach the FraudShield API. Make sure the backend is running on port 8000." — the actual cause, most of the time.

---

## 10. Deployment topology

```
                    ┌──────────────────────────┐
  localhost:3000 ──▶│ nginx (frontend image)   │
                    │  /            → SPA      │
                    │  /api, /docs  → backend  │
                    └────────────┬─────────────┘
                                 ▼
                    ┌──────────────────────────┐
  localhost:8000 ──▶│ uvicorn (backend image)  │
                    └────────────┬─────────────┘
                                 ▼
                    ┌──────────────────────────┐
                    │ postgres:16-alpine       │
                    │ (internal network only)  │
                    └──────────────────────────┘
```

Because nginx proxies `/api` on the same origin, the browser makes no cross-origin request in Docker and CORS is irrelevant there. The frontend's default relative `/api` base URL is what makes the same bundle work behind both the Vite dev proxy and nginx, with no rebuild.

See [DEPLOYMENT.md](DEPLOYMENT.md) for hardening.
