# MASTER PROMPT — BUILD FRAUDSHIELD AI COMPLETE PROJECT AUTONOMOUSLY

You are an expert senior full-stack engineer, AI/ML engineer, UI/UX designer, DevOps engineer, and software architect.

Your task is to build a COMPLETE, WORKING, PRODUCTION-STYLE final-year project called:

# FraudShield AI
## AI-Powered Digital Fraud Detection & Risk Analysis Platform

IMPORTANT: I do NOT want a tutorial, explanation, roadmap, pseudocode, or partial implementation.

I want you to ACTUALLY BUILD THE PROJECT directly in this repository.

You must work autonomously and continuously. Do not stop after creating the initial structure. Do not ask me unnecessary questions. Make reasonable technical decisions yourself.

Your workflow must be:

PLAN INTERNALLY → CREATE FILES → IMPLEMENT FEATURES → INSTALL DEPENDENCIES → FIX ERRORS → TEST → RUN APPLICATION

Continue working until the project is functional.

If something is too complex, implement the best practical working version instead of stopping.

Do not wait for confirmation between phases.

---

# 1. PROJECT OVERVIEW

FraudShield AI is a unified AI-powered digital fraud detection platform.

The platform allows users to analyze:

1. Suspicious URLs
2. Scam messages
3. Suspicious documents

The system should use machine learning, NLP, OCR, heuristic analysis, and a centralized fraud risk scoring engine.

The application should provide:

- Authentication
- User dashboard
- URL phishing detection
- Scam message detection
- Document analysis
- AI risk scoring
- Explainable results
- Scan history
- Analytics
- Admin dashboard
- Downloadable fraud reports

The project must look professional enough for:

- Final year major project
- Resume portfolio
- GitHub portfolio
- Placement interviews

---

# 2. PRIMARY GOAL

Build a COMPLETE WORKING WEB APPLICATION.

Prioritize:

1. Working functionality
2. Professional UI
3. Clean architecture
4. Realistic AI/ML functionality
5. Fast development
6. Easy local setup
7. Demo-ready application

Avoid overengineering.

Every major feature should work end-to-end.

---

# 3. TECH STACK

Use the following stack unless there is a strong technical reason to modify it.

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui or similar professional component library
- React Router
- Axios
- Lucide icons
- Recharts

## Backend

- Python
- FastAPI
- SQLAlchemy
- Pydantic

## Database

- PostgreSQL

For easier local development, automatically support SQLite as fallback if PostgreSQL is not configured.

## Authentication

- JWT authentication
- Password hashing using bcrypt/passlib

## AI / Machine Learning

### URL Detection

Use:

- Scikit-learn
- Random Forest or another practical classifier
- Feature extraction

URL features should include:

- URL length
- Domain length
- Number of dots
- Number of hyphens
- Number of digits
- Number of special characters
- HTTPS presence
- IP address usage
- Suspicious keywords
- Number of subdomains
- URL entropy if practical
- Presence of @ symbol
- Redirect indicators

If no trained dataset is available locally:

Create a practical hybrid system:

ML-style feature scoring + heuristic detection.

The application MUST still work immediately after installation.

Do not depend on downloading a huge dataset.

---

### Scam Message Detection

Use NLP techniques.

Analyze:

- Urgency language
- Prize/reward scams
- OTP requests
- Bank impersonation
- Financial threats
- Credential requests
- Suspicious links
- Cryptocurrency scams
- Lottery scams
- Job scams
- KYC scams

Use a hybrid approach:

- TF-IDF + lightweight classifier if possible
- Rule-based suspicious phrase detection
- Keyword weighting
- Text pattern analysis

The system must work without requiring an external paid AI API.

Return:

- Scam probability
- Risk score
- Risk level
- Suspicious phrases
- Explanation

---

### Document Analysis

Users should be able to upload:

- PNG
- JPG
- JPEG
- PDF

Implement:

- File validation
- OCR extraction
- Metadata inspection where available
- Basic image anomaly checks
- Suspicious keyword detection
- Text consistency indicators

Use:

- Tesseract OCR if installed

BUT IMPORTANT:

The application must gracefully work even if Tesseract is not installed.

Implement fallback document analysis using:

- File metadata
- Filename analysis
- PDF text extraction where possible
- Image properties
- Basic heuristics

Do not make the entire application fail because OCR is unavailable.

Clearly label document analysis as:

"Risk Assessment / Suspicious Document Analysis"

Do NOT claim forensic certainty.

---

# 4. APPLICATION ARCHITECTURE

Use this architecture:

User
↓
React Frontend
↓
FastAPI Backend
├── Authentication Service
├── URL Fraud Detection Service
├── Scam Message Detection Service
├── Document Analysis Service
├── Fraud Risk Scoring Engine
├── Explainability Engine
├── Report Generator
↓
PostgreSQL / SQLite
↓
Analytics Dashboard

Use clean separation of concerns.

---

# 5. REQUIRED PROJECT STRUCTURE

Create something similar to:

fraudshield-ai/

frontend/
    src/
        components/
        pages/
        layouts/
        services/
        hooks/
        context/
        types/
        utils/
    public/
    package.json

backend/
    app/
        main.py
        api/
        core/
        database/
        models/
        schemas/
        services/
        ml/
        utils/
    tests/
    requirements.txt

docs/

docker-compose.yml
README.md
.env.example
.gitignore

You may improve this structure if needed.

---

# 6. FRONTEND DESIGN REQUIREMENTS

Create a MODERN CYBERSECURITY / AI SAAS DASHBOARD.

Design style:

- Professional
- Modern
- Dark mode
- Cybersecurity aesthetic
- Clean
- Premium
- Not overly flashy
- Responsive

Use:

- Dark background
- Cards
- Subtle gradients
- Good spacing
- Professional typography
- Icons
- Risk badges
- Progress bars
- Charts

Primary concept:

AI security intelligence dashboard.

Do NOT create a generic college project UI.

Make it look like a real SaaS product.

---

# 7. REQUIRED FRONTEND PAGES

Create all of the following pages.

## 7.1 Landing Page

Include:

Hero section:

"Detect Digital Fraud Before It Detects You."

Description:

FraudShield AI uses artificial intelligence to analyze suspicious URLs, messages, and documents.

Buttons:

- Get Started
- Explore Features

Feature cards:

- Phishing URL Detection
- Scam Message Detection
- Document Risk Analysis
- AI Risk Intelligence

How it works section.

Technology section.

Professional footer.

---

## 7.2 Login Page

Fields:

- Email
- Password

Features:

- Validation
- Show/hide password
- Error handling
- Link to register

---

## 7.3 Register Page

Fields:

- Name
- Email
- Password
- Confirm Password

Validation required.

---

## 7.4 User Dashboard

Show:

Top statistics:

- Total Scans
- Threats Detected
- High Risk Scans
- Safe Scans

Charts:

- Risk distribution
- Scan activity over time

Recent scans table.

Quick action cards:

- Scan URL
- Analyze Message
- Analyze Document

Show professional empty states when database is empty.

---

## 7.5 URL Scanner

Create an attractive scanner interface.

Input:

Suspicious URL

Button:

Analyze URL

Show loading animation while scanning.

Result card should include:

URL

Prediction:

Safe / Suspicious / Phishing

Risk score:

Example:

87 / 100

Risk meter.

Detected indicators.

Example:

- Suspicious keyword detected
- Excessive URL length
- Multiple subdomains
- IP address detected

AI explanation.

Recommendation.

Example:

"Do not enter passwords, OTPs, or financial information on this website."

---

## 7.6 Message Scanner

Textarea for:

SMS
Email
WhatsApp message
Other suspicious messages

Button:

Analyze Message

Result:

Classification

Risk score

Risk meter

Detected suspicious phrases

Detected scam patterns

Explanation

Recommended action

Example categories:

- Safe
- Suspicious
- Scam

---

## 7.7 Document Scanner

Upload interface.

Support:

PNG
JPG
JPEG
PDF

Show:

File preview where practical.

Analysis result:

- Document risk score
- Risk level
- OCR extracted text if available
- Metadata observations
- Suspicious indicators
- Analysis explanation

Clearly include disclaimer:

"This result is an automated risk assessment and does not constitute forensic verification."

---

## 7.8 Scan History

Create table with:

- Scan ID
- Type
- Date
- Risk Score
- Risk Level
- Status

Include:

- Search
- Filters
- Pagination if practical
- Click row to view details

---

## 7.9 Scan Details Page

Show complete analysis.

Sections:

Scan information

Risk score

Risk meter

Classification

Suspicious indicators

AI explanation

Recommendation

Technical analysis details

Button:

Download Report

---

## 7.10 Admin Dashboard

Implement role-based admin access.

Show:

- Total users
- Total scans
- Fraud detections
- High risk percentage

Charts:

- Scan type distribution
- Risk distribution
- Recent activity

Table:

Recent suspicious scans.

---

# 8. BACKEND REQUIREMENTS

Create clean REST APIs.

Implement proper:

- Validation
- Error handling
- Authentication
- Authorization
- Logging
- Documentation

FastAPI Swagger documentation should work automatically.

API structure:

POST /api/auth/register

POST /api/auth/login

GET /api/auth/me


POST /api/scan/url

POST /api/scan/message

POST /api/scan/document


GET /api/scans

GET /api/scans/{id}


GET /api/dashboard/summary


GET /api/admin/analytics


GET /api/reports/{scan_id}

Implement sensible request and response schemas.

---

# 9. DATABASE DESIGN

Create the following tables.

## users

Fields:

id
name
email
password_hash
role
created_at

---

## scans

Fields:

id
user_id
scan_type
status
created_at

---

## url_scans

Fields:

id
scan_id
url
prediction
risk_score
confidence
indicators
analysis_details

---

## message_scans

Fields:

id
scan_id
message_text
prediction
risk_score
confidence
indicators
analysis_details

---

## document_scans

Fields:

id
scan_id
filename
file_type
risk_score
extracted_text
metadata
indicators
analysis_details

---

## risk_assessments

Fields:

id
scan_id
overall_score
risk_level
recommendation
explanation

You may improve normalization where necessary.

Use SQLAlchemy migrations or automatic table initialization for speed.

---

# 10. URL FRAUD DETECTION ENGINE

Create:

backend/app/ml/url_detector.py

The detector must:

1. Validate URL
2. Extract features
3. Calculate suspicious indicators
4. Generate risk score
5. Classify result

Risk levels:

0-29 = LOW
30-59 = MEDIUM
60-79 = HIGH
80-100 = CRITICAL

Classification:

Safe
Suspicious
Phishing

Implement realistic detection logic.

Example suspicious keywords:

login
verify
secure
account
update
banking
confirm
password
signin
wallet
payment
free
gift
bonus

Also detect:

- Very long URLs
- Excessive subdomains
- IP addresses instead of domains
- @ symbols
- Multiple hyphens
- Excessive digits
- Suspicious TLD patterns
- HTTP instead of HTTPS

Return structured JSON.

---

# 11. SCAM MESSAGE DETECTION ENGINE

Create:

backend/app/ml/message_detector.py

Implement:

Text normalization.

Pattern detection.

Risk indicators.

Detect categories:

- Lottery scam
- Prize scam
- Banking scam
- OTP scam
- KYC scam
- Job scam
- Investment scam
- Crypto scam
- Impersonation scam
- Urgency/social engineering

Example suspicious phrases:

"urgent"

"act now"

"limited time"

"verify your account"

"share OTP"

"you have won"

"click here"

"claim your prize"

"bank account blocked"

"update KYC"

"send money"

"guaranteed return"

"double your money"

Do not simply check one keyword.

Use weighted analysis.

Return:

prediction

risk_score

confidence

detected_categories

suspicious_phrases

explanation

recommendation

---

# 12. DOCUMENT ANALYSIS ENGINE

Create:

backend/app/ml/document_analyzer.py

Implement:

File validation.

Safe upload handling.

File size limit.

PDF handling.

Image handling.

Try OCR if available.

Gracefully fallback if unavailable.

Analyze:

- File extension consistency
- File metadata
- OCR extracted text
- Suspicious words
- Image dimensions
- Basic image quality anomalies
- Unusual filename patterns

Return:

risk_score

risk_level

indicators

extracted_text

metadata

explanation

recommendation

DO NOT claim that the document is definitely fake.

Use wording such as:

"Potential anomalies detected."

"Requires manual verification."

---

# 13. FRAUD RISK SCORING ENGINE

Create:

backend/app/services/risk_engine.py

The engine should normalize all module results.

For single scans:

Use that module's score.

For future multi-input analysis:

Support weighted combination.

Default weights:

URL = 0.35

MESSAGE = 0.30

DOCUMENT = 0.35

Risk categories:

0-29 LOW

30-59 MEDIUM

60-79 HIGH

80-100 CRITICAL

Generate recommendations.

Example:

LOW:

"No major suspicious indicators detected. Continue following standard security practices."

MEDIUM:

"Some suspicious characteristics were identified. Verify the source before interacting."

HIGH:

"Multiple suspicious indicators were detected. Avoid sharing sensitive information."

CRITICAL:

"High probability of fraudulent activity. Do not interact, enter credentials, send money, or share OTPs."

---

# 14. EXPLAINABLE AI

This is important.

Never return only:

"Phishing: Yes"

Instead provide:

WHY the result was generated.

Example:

"Risk is elevated because the URL is unusually long, contains account verification keywords, and uses multiple nested subdomains."

For every detector:

Return:

- Top indicators
- Explanation
- Recommendation

Make explanations understandable for non-technical users.

---

# 15. DASHBOARD ANALYTICS

Create meaningful analytics.

User dashboard:

- Total scans
- Safe scans
- Suspicious scans
- High/critical scans
- Recent scans
- Scan trends

Admin dashboard:

- Total users
- Total scans
- Fraud detection rate
- Scan type distribution
- Risk distribution
- Recent high risk scans

Use Recharts.

If no real data exists:

Show clean empty states.

Optionally seed demo data ONLY for development.

---

# 16. REPORT GENERATION

Implement downloadable scan reports.

Generate a professional PDF or HTML print-friendly report.

Include:

FraudShield AI branding

Scan ID

Scan type

Date

Risk score

Risk level

Prediction

Detected indicators

Analysis explanation

Recommendation

Disclaimer

If PDF generation adds dependency complexity, use a reliable lightweight library.

The report must actually download.

---

# 17. AUTHENTICATION

Implement JWT authentication.

Roles:

USER

ADMIN

Protect:

Dashboard

Scan history

Admin routes

Create a development admin account automatically or document how to create one.

Example development admin:

admin@fraudshield.local

Password should NOT be hardcoded in production configuration.

Use environment variables or seed script.

---

# 18. ERROR HANDLING

Handle:

Invalid URLs

Empty messages

Unsupported file types

Large files

Expired tokens

Unauthorized users

Server errors

Database failures

Missing OCR dependency

Missing ML model

Never allow the application to crash unnecessarily.

Return user-friendly error messages.

---

# 19. LOADING STATES

Implement professional loading states.

Examples:

URL scan:

"Analyzing URL patterns..."

Message:

"Running AI fraud analysis..."

Document:

"Extracting document intelligence..."

Use skeletons/spinners/progress animations.

---

# 20. RESPONSIVENESS

Application must work on:

Desktop

Laptop

Tablet

Mobile

Sidebar should collapse on smaller screens.

Tables should remain usable.

---

# 21. SEED DATA

Create an optional development seed script.

Include:

Admin user.

Demo user.

Sample scan records.

Do NOT depend on seed data for application functionality.

---

# 22. TESTING

At minimum implement:

Backend tests for:

- URL feature extraction
- URL risk classification
- Message risk detection
- Risk scoring
- Authentication basics

Run tests and fix obvious failures.

---

# 23. DOCKER

Create:

Dockerfile for frontend if practical.

Dockerfile for backend.

docker-compose.yml.

Services:

frontend

backend

database

The project should be runnable with:

docker compose up --build

If Docker configuration becomes difficult due to environment constraints, still provide complete Docker files and ensure local non-Docker setup works.

---

# 24. README

Create a HIGH QUALITY README.md.

Include:

Project overview

Features

Architecture

Technology stack

Folder structure

Installation instructions

Environment variables

How to run frontend

How to run backend

Database configuration

Docker instructions

API documentation

Screenshots placeholders

Future improvements

Disclaimer

Resume-ready project description

---

# 25. ENVIRONMENT FILE

Create:

.env.example

Include:

DATABASE_URL

SECRET_KEY

ACCESS_TOKEN_EXPIRE_MINUTES

ADMIN_EMAIL

ADMIN_PASSWORD

UPLOAD_DIRECTORY

Environment variables must work with sensible development defaults where safe.

---

# 26. CODE QUALITY

Requirements:

- Use clear naming
- Avoid duplicate logic
- Add comments only where useful
- Keep files reasonably modular
- Avoid huge monolithic files
- Use type hints in Python
- Use TypeScript types
- Use reusable frontend components

Do NOT leave fake placeholder implementations for major features.

If a sophisticated ML model is impractical, create a legitimate hybrid heuristic + lightweight ML-style implementation that works.

The project must be DEMOABLE.

---

# 27. IMPORTANT DEMO SCENARIOS

The application must successfully demonstrate these examples.

### URL Example 1

Input:

http://secure-login-verify-account.example.com/login?account=12345

Expected:

High risk / Phishing

Indicators:

- HTTP instead of HTTPS
- Suspicious keywords
- Excessive subdomain structure

---

### Message Example 1

Input:

"URGENT! Your bank account will be blocked today. Verify your account immediately and share your OTP to avoid suspension."

Expected:

High risk / Scam

Indicators:

- Urgency
- Bank impersonation
- OTP request
- Threat language

---

### Message Example 2

Input:

"Congratulations! You have won ₹50,000. Click the link now to claim your prize before midnight."

Expected:

High risk / Scam

Indicators:

- Prize scam
- Urgency
- Suspicious call to action

---

### Document Example

Upload sample image/PDF.

Expected:

Document analysis result.

Even if OCR is unavailable, system must return meaningful analysis rather than fail.

---

# 28. DEVELOPMENT EXECUTION ORDER

Execute the following internally without stopping:

PHASE 1

Inspect existing repository.

Create architecture.

Create backend.

Create frontend.

Configure dependencies.

---

PHASE 2

Implement database.

Implement authentication.

Test authentication.

---

PHASE 3

Implement URL detector.

Implement message detector.

Implement document analyzer.

Implement risk engine.

---

PHASE 4

Implement all backend APIs.

Test endpoints.

---

PHASE 5

Build professional frontend.

Connect frontend APIs.

Implement authentication flow.

---

PHASE 6

Build dashboards.

Build history.

Build scan details.

Build admin panel.

---

PHASE 7

Implement report generation.

---

PHASE 8

Add Docker.

Add README.

Add environment configuration.

---

PHASE 9

Run the application.

Fix:

- Import errors
- TypeScript errors
- API errors
- CORS issues
- Database issues
- Broken routes

---

PHASE 10

Perform final review.

Check that:

- Frontend runs
- Backend runs
- Authentication works
- URL scanning works
- Message scanning works
- Document analysis works
- Scan history works
- Dashboard works
- Admin dashboard works
- Reports work

---

# 29. AUTONOMOUS EXECUTION RULES

IMPORTANT:

Do not stop after writing files.

Do not repeatedly ask:

"Should I continue?"

Do not provide long explanations instead of coding.

Do not wait for approval.

Do not create only mockups.

Actually implement functionality.

You have permission to:

- Create files
- Modify files
- Install dependencies
- Run commands
- Run tests
- Fix errors
- Refactor code

Make reasonable assumptions.

If a command fails:

Diagnose it.

Fix the problem.

Continue.

If a dependency causes problems:

Use a stable alternative.

Do not abandon the feature.

---

# 30. FINAL ACCEPTANCE CHECKLIST

Before declaring completion, verify:

[ ] Project structure exists

[ ] Frontend builds successfully

[ ] Backend starts successfully

[ ] Database initializes

[ ] User registration works

[ ] Login works

[ ] JWT authentication works

[ ] Protected routes work

[ ] URL scanner works

[ ] Message scanner works

[ ] Document scanner works

[ ] Risk scoring works

[ ] Explanations work

[ ] Scan history works

[ ] Dashboard works

[ ] Admin analytics works

[ ] Report download works

[ ] Responsive UI works

[ ] README exists

[ ] .env.example exists

[ ] Docker files exist

[ ] Tests exist

[ ] No obvious broken imports

[ ] No major placeholder pages

---

# FINAL INSTRUCTION

START BUILDING NOW.

Do not give me a tutorial.

Do not just describe the architecture.

Do not ask me to manually create files.

Work directly inside the current project directory.

Continue autonomously through implementation, debugging, testing, and refinement.

Only stop when you have built the maximum possible complete working version of FraudShield AI in this repository.

At the end, provide ONLY a concise summary containing:

1. What was built
2. How to run frontend
3. How to run backend
4. How to run Docker
5. Demo credentials
6. Known limitations, if any