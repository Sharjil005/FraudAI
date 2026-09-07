"""Email service: dispatches HTML emails via SMTP or logs to file in development."""

import logging
import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

logger = logging.getLogger(__name__)

EMAILS_DIR = Path(__file__).resolve().parents[2] / "emails"


def send_html_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send an HTML email. Falls back to writing to local file in development."""
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", "no-reply@fraudshield.local")

    # Check if SMTP configuration is complete
    if smtp_host and smtp_port:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_from
            msg["To"] = to_email

            part = MIMEText(html_body, "html")
            msg.attach(part)

            # Connect and send
            port = int(smtp_port)
            if port == 465:
                # SSL
                with smtplib.SMTP_SSL(smtp_host, port, timeout=10) as server:
                    if smtp_user and smtp_pass:
                        server.login(smtp_user, smtp_pass)
                    server.sendmail(smtp_from, to_email, msg.as_string())
            else:
                # STARTTLS or Standard
                with smtplib.SMTP(smtp_host, port, timeout=10) as server:
                    if port == 587:
                        server.starttls()
                    if smtp_user and smtp_pass:
                        server.login(smtp_user, smtp_pass)
                    server.sendmail(smtp_from, to_email, msg.as_string())

            logger.info(f"Email successfully sent to {to_email} via SMTP ({smtp_host}:{smtp_port})")
            return True
        except Exception as e:
            logger.error(f"Failed to send email via SMTP to {to_email}: {e}. Falling back to mock email.")

    # FALLBACK: Write to local folder so developers can view the HTML email directly
    try:
        EMAILS_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"invite_{to_email}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        filepath = EMAILS_DIR / filename

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html_body)

        logger.info("==================== [MOCK EMAIL DISPATCHED] ====================")
        logger.info(f"To: {to_email}")
        logger.info(f"Subject: {subject}")
        logger.info(f"HTML invite saved for preview at: file:///{filepath.as_posix()}")
        logger.info("==================================================================")
        return True
    except Exception as err:
        logger.error(f"Failed to write mock email to disk: {err}")
        return False


def send_friend_invite_email(sender_name: str, receiver_email: str, accept_url: str) -> bool:
    """Send a beautifully styled friend invitation email matching FraudShield's theme."""
    subject = f"🛡️ Join {sender_name}'s Safety Circle on FraudShield AI"

    html_body = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{
            background-color: #020617;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 0;
        }}
        .container {{
            max-width: 600px;
            margin: 40px auto;
            background-color: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        }}
        .header {{
            background: linear-gradient(135deg, #22d3ee, #6366f1);
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            color: #0f172a;
            font-weight: 800;
            letter-spacing: 0.05em;
        }}
        .content {{
            padding: 40px 30px;
            line-height: 1.6;
        }}
        .content p {{
            margin: 0 0 20px 0;
            font-size: 15px;
            color: #94a3b8;
        }}
        .content strong {{
            color: #f8fafc;
        }}
        .highlight-card {{
            background-color: #1e293b;
            border: 1px solid #334155;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
        }}
        .highlight-card h2 {{
            margin: 0 0 10px 0;
            font-size: 18px;
            color: #22d3ee;
        }}
        .btn {{
            display: inline-block;
            background: linear-gradient(135deg, #22d3ee, #6366f1);
            color: #020617 !important;
            text-decoration: none;
            padding: 12px 30px;
            font-weight: bold;
            font-size: 14px;
            border-radius: 12px;
            box-shadow: 0 4px 14px 0 rgba(34, 211, 238, 0.3);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        .footer {{
            background-color: #0b0f19;
            padding: 20px 30px;
            text-align: center;
            border-top: 1px solid #1e293b;
        }}
        .footer p {{
            margin: 0;
            font-size: 12px;
            color: #64748b;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>FRAUDSHIELD AI</h1>
        </div>
        <div class="content">
            <div class="highlight-card">
                <h2>Collaboration Request</h2>
                <p style="color: #e2e8f0; margin-bottom: 0;">
                    <strong>{sender_name}</strong> wants to connect and share security threat alerts with you.
                </p>
            </div>
            <p>
                FraudShield AI's **Safety Circle** allows trusted friends and family to instantly warn each other about suspicious links, phishing messages, or tampered documents.
            </p>
            <p>
                If Samad, Jay, or anyone in your circle flags a threat, they can broadcast it to you immediately so you know to stay safe.
            </p>
            <div style="text-align: center; margin-top: 30px; margin-bottom: 20px;">
                <a href="{accept_url}" class="btn">Connect & Join Circle</a>
            </div>
            <p style="font-size: 13px; text-align: center; color: #475569;">
                If you do not have an account, clicking the button will guide you to sign up and link your circle automatically.
            </p>
        </div>
        <div class="footer">
            <p>FraudShield AI — AI-Powered Digital Fraud Protection</p>
        </div>
    </div>
</body>
</html>
"""
    return send_html_email(receiver_email, subject, html_body)
