from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
from reportlab.lib.units import inch
from reportlab.lib import colors

TITLE = "FraudShield AI – Project Overview"

CONTENT = """
FraudShield AI is an explainable fraud detection platform that analyzes suspicious digital content such as URLs, messages, and documents. It helps users assess whether a link, text, or document is risky before they act on it.

The platform is built to solve a practical real-world problem: online fraud is increasing rapidly, and users often do not understand whether a message, link, or file is malicious. FraudShield responds by producing a 0–100 risk score, a risk band, suspicious indicators, explanations, and actionable recommendations.

Project Objective
The main goal of the project is to build a local AI-powered security system that can detect phishing URLs, scam messages, and suspicious documents while remaining explainable to end users.

Core Features
- URL and link analysis for phishing detection
- Message and SMS scam detection
- Document risk assessment for PDF, PNG, and JPG files
- Explainable risk scoring
- User dashboard and admin analytics
- Downloadable PDF and HTML reports
- JWT-based authentication and secure access control

Why This Project Matters
Most fraud tools give only a simple yes/no answer. FraudShield goes beyond that by explaining why a result is risky and what the user should do next. This makes it more useful, realistic, and trustworthy for both people and professors evaluating the project.

Tech Stack
Frontend:
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios
- Recharts
- Lucide icons

Backend:
- Python
- FastAPI
- Uvicorn
- Pydantic
- SQLAlchemy
- JWT
- bcrypt

Database:
- PostgreSQL
- SQLite fallback

AI / ML:
- scikit-learn
- RandomForestClassifier
- LogisticRegression
- TF-IDF vectorizer
- NumPy
- joblib

Document Tools:
- PyPDF
- Pillow
- pytesseract
- fpdf2

Deployment and Testing:
- Docker
- Docker Compose
- Nginx
- pytest
- FastAPI TestClient

System Architecture
The application follows a layered architecture with a frontend, backend API, services, ML layer, and database layer. The frontend communicates with the backend through Axios and JWT-protected API calls. The backend validates user input, extracts features, applies ML models, calculates the risk score, stores results, and returns the final explanation to the user.

How the Project Works
1. User signs in using email and password.
2. The user chooses a scan type: URL, message, or document.
3. The frontend sends the request to the backend API.
4. Backend validates the payload and authenticates the user.
5. The selected detector extracts features and analyzes the input.
6. The risk engine aggregates indicators, applies weights, and calculates a final 0–100 score.
7. The platform returns explanation, indicators, recommendation, and scan metadata.
8. The result is saved in the database and displayed in history and dashboard views.

AI and ML Components
URL Detection:
The URL detector extracts structural and lexical features such as domain length, subdomain depth, suspicious keywords, hyphenated hosts, embedded IPs, risky TLDs, and encoded payloads. These features are passed into a Random Forest classifier for prediction.

Message Detection:
The message detector converts text into numeric features through TF-IDF and uses Logistic Regression to classify scam or legitimate content. It also checks scam categories such as OTP theft, account block alerts, prize fraud, investment scams, extortion, and fake job offers.

Document Detection:
The document analyzer checks metadata, structure, encryption flags, suspicious PDF properties, image irregularities, and text content from OCR when available. It is designed as a risk assessment tool, not as absolute forensic proof.

Explainable Risk Engine
This is one of the strongest parts of the project. Instead of saying only “phishing” or “safe,” the engine produces:
- risk score
- risk band
- important indicators
- plain-language explanation
- recommendation for the user

This is essential for trust and usability. It makes the system understandable to users and professors alike.

Database and Security Design
The project stores user accounts, scan data, and modality-specific analysis in a relational database. It provides role-based access with normal users and admins. Passwords are stored securely using bcrypt, and user sessions are protected with JWT tokens.

Dashboard and Reporting
Users can view previous scans, trends, risk distribution, summary metrics, and details for each report. Admins can access platform analytics and manage user status. Reports can be downloaded in HTML or PDF format.

Deployment and Testing
The system is containerized using Docker and Docker Compose. It supports both PostgreSQL and SQLite fallback. Tests are written using pytest and FastAPI TestClient, and a smoke test script validates live API behavior, authorization, uploads, and report downloads.

Conclusion
FraudShield AI is a full-stack, AI-powered fraud detection platform that brings together machine learning, explainability, web development, backend engineering, and security. It demonstrates practical understanding of real-world cybersecurity challenges and showcases the ability to build a complete, usable product rather than only a simple academic demo.
"""


def build_pdf(output_path: str):
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Title'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        alignment=1,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=18,
    )
    heading_style = ParagraphStyle(
        'HeadingStyle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#0B5FFF'),
        spaceBefore=12,
        spaceAfter=8,
    )
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10.5,
        leading=15,
        alignment=1,
        spaceAfter=6,
        textColor=colors.HexColor('#111827'),
    )
    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=10.5,
        leading=14,
        leftIndent=18,
        bulletIndent=10,
        spaceAfter=4,
        textColor=colors.HexColor('#111827'),
    )

    doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=0.7 * inch, leftMargin=0.7 * inch, topMargin=0.7 * inch, bottomMargin=0.7 * inch)
    story = []
    story.append(Paragraph(TITLE, title_style))
    story.append(Spacer(1, 0.2 * inch))

    sections = {
        'Overview': 'FraudShield AI is an explainable fraud detection platform that analyzes suspicious digital content such as URLs, messages, and documents. It helps users assess whether a link, text, or document is risky before they act on it.',
        'Project Objective': 'The main goal of the project is to build a local AI-powered security system that can detect phishing URLs, scam messages, and suspicious documents while remaining explainable to end users.',
        'Core Features': ['URL and link analysis for phishing detection', 'Message and SMS scam detection', 'Document risk assessment for PDF, PNG, and JPG files', 'Explainable risk scoring', 'User dashboard and admin analytics', 'Downloadable PDF and HTML reports', 'JWT-based authentication and secure access control'],
        'Tech Stack': 'The project combines React, TypeScript, FastAPI, Python, SQLAlchemy, PostgreSQL/SQLite, scikit-learn, Docker, and several document-processing libraries to build a complete AI-powered web application.',
        'System Architecture': 'The application follows a layered architecture with a frontend, backend API, services, ML layer, and database layer. The frontend communicates with the backend through Axios and JWT-protected API calls.',
        'How It Works': 'The user signs in, chooses the scan type, sends the input to the API, validates the payload, runs the feature extraction and ML models, computes the final risk score, and shows the results in a dashboard.',
        'AI / ML Components': 'URL detection uses Random Forest over structural features; message detection uses TF-IDF plus Logistic Regression; document analysis checks metadata, structural anomalies, and OCR output when available.',
        'Explainable Risk Engine': 'The engine creates a risk score, band, key indicators, plain-language explanation, and recommendations so the system is understandable rather than opaque.',
        'Deployment and Testing': 'The system supports Docker deployment, PostgreSQL and SQLite fallback, and automated testing using pytest and smoke tests for live API behavior.',
        'Conclusion': 'FraudShield AI is a full-stack, AI-powered fraud detection platform that combines machine learning, explainability, web development, backend engineering, and security into one functional project.',
    }

    for heading, content in sections.items():
        story.append(Paragraph(heading, heading_style))
        if isinstance(content, list):
            story.append(ListFlowable(
                [ListItem(Paragraph(item, bullet_style), bulletType='bullet') for item in content],
                bulletType='bullet',
                leftIndent=12,
            ))
        else:
            story.append(Paragraph(content, body_style))
        story.append(Spacer(1, 0.08 * inch))

    doc.build(story)


if __name__ == '__main__':
    output_path = 'docs/FraudShield_Project_Overview.pdf'
    build_pdf(output_path)
    print(f'PDF generated: {output_path}')
