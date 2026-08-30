"""Seed the database with demo accounts and realistic sample scans.

Run from the ``backend`` directory:

    python seed.py            # add sample data (idempotent for users)
    python seed.py --reset    # wipe existing scans first

Seeding is entirely optional — the application creates its own schema and
bootstrap accounts on first start. This script only makes the dashboards,
charts and history screens look populated for a demo.

Credentials come from the environment (ADMIN_EMAIL / ADMIN_PASSWORD /
DEMO_EMAIL / DEMO_PASSWORD) or from the development defaults in
``app/core/config.py`` — nothing is hardcoded in this file.
"""

from __future__ import annotations

import argparse
import random
import struct
import sys
import zlib
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select

from app.core.config import settings
from app.core.logging_config import configure_logging, get_logger
from app.database.init_db import create_tables, ensure_user
from app.database.session import SessionLocal
from app.models.scan import (
    DocumentScan,
    MessageScan,
    RiskAssessment,
    Scan,
    UrlScan,
)
from app.models.user import User, UserRole
from app.services.scan_service import run_document_scan, run_message_scan, run_url_scan

logger = get_logger("seed")

SAMPLE_URLS = [
    "http://secure-login-verify-account.example.com/login?account=12345",
    "https://www.google.com",
    "http://192.168.44.19/hdfc-netbanking/login.php",
    "https://accounts.google.com/signin",
    "http://paypal.secure-login-update.xyz/verify?user=admin&password=reset",
    "https://github.com/features/actions",
    "http://sbi-kyc-update-portal.tk/update/aadhaar/verify.html",
    "https://www.wikipedia.org/wiki/Phishing",
    "http://amazon-prize-claim.win/reward?claim=now&card=1234",
    "https://docs.python.org/3/library/asyncio.html",
]

SAMPLE_MESSAGES = [
    (
        "URGENT: Your bank account has been blocked. "
        "Click http://secure-bank-verify.com to verify your details immediately. "
        "Share the OTP received on your phone to complete verification."
    ),
    "Congratulations! You have won Rs.50,000 in our lucky draw. Claim now!",
    "Hi, are we still meeting at 4pm today to review the project report?",
    (
        "Dear customer, your KYC is incomplete. Your SIM will be deactivated within 24 hours. "
        "Update now at http://kyc-update-now.tk/verify or call 9876543210."
    ),
    "Your OTP for login is 442819. Valid for 10 minutes. Do not share it with anyone.",
    (
        "WORK FROM HOME! Earn Rs.5000 daily with just 2 hours of part time work. "
        "No experience needed. WhatsApp us on +91 90000 00000 to start today!!!"
    ),
    "Your electricity bill of Rs.1,240 for August is due on 05-09. Pay via the official app.",
    (
        "Double your Bitcoin in 24 hours! Guaranteed 200% returns, limited slots. "
        "Send BTC to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa now."
    ),
    "Your Amazon order #402-8871 has been shipped and arrives tomorrow.",
    (
        "FINAL NOTICE from Income Tax Department: legal action will be taken against you. "
        "Verify your PAN and account number today to avoid arrest."
    ),
]


def _png_bytes(width: int = 640, height: int = 420, *, noise: bool = False) -> bytes:
    """Build a valid PNG in pure Python so seeding needs no sample assets on disk."""
    rng = random.Random(7)
    rows = bytearray()
    for y in range(height):
        rows.append(0)  # filter type: none
        for x in range(width):
            if noise:
                base = rng.randint(0, 255)
                rows.extend((base, base, base))
            else:
                shade = 240 - int((y / height) * 40)
                rows.extend((shade, shade, shade))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">2I5B", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(rows), 6))
        + chunk(b"IEND", b"")
    )


def _pdf_bytes(text: str) -> bytes:
    """Build a minimal single-page PDF with a real text layer."""
    escaped = text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
    stream = f"BT /F1 12 Tf 60 760 Td ({escaped}) Tj ET".encode("latin-1", "replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Producer (Unknown Image Editor 2.1) /Creator (FraudShield Seed) >>",
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for index, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{index} 0 obj\n".encode() + body + b"\nendobj\n"

    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R /Info 6 0 R >>\n"
        f"startxref\n{xref_at}\n%%EOF\n"
    ).encode()
    return bytes(out)


SAMPLE_DOCUMENTS = [
    ("aadhaar_card_scan_copy_final.png", _png_bytes(noise=False)),
    ("salary-slip.pdf", _pdf_bytes("PAY SLIP - Verify account 9988776655 to release payment")),
    ("IMG_20240817_121030.jpg", _png_bytes(320, 220, noise=True)),
    ("bank_statement_edited_copy.pdf", _pdf_bytes("Closing balance 4,82,000.00 - see attached")),
]


def reset_scans() -> None:
    """Delete every scan and its child rows, leaving user accounts intact."""
    with SessionLocal() as db:
        for model in (RiskAssessment, UrlScan, MessageScan, DocumentScan, Scan):
            db.execute(delete(model))
        db.commit()
    logger.info("Cleared all existing scan records.")


def _backdate(scan_ids: list[int], days_window: int = 13) -> None:
    """Spread the seeded scans across the trend window so charts have shape."""
    rng = random.Random(2026)
    now = datetime.now(UTC)
    with SessionLocal() as db:
        for scan_id in scan_ids:
            scan = db.get(Scan, scan_id)
            if scan is None:
                continue
            scan.created_at = now - timedelta(
                days=rng.randint(0, days_window),
                hours=rng.randint(0, 23),
                minutes=rng.randint(0, 59),
            )
        db.commit()


def seed_scans(*, url_count: int, message_count: int, document_count: int) -> list[int]:
    created: list[int] = []
    with SessionLocal() as db:
        users = list(db.execute(select(User).order_by(User.id)).scalars().all())
        if not users:
            logger.error("No users found. Run the application once, or re-run this script.")
            return created

        for index in range(url_count):
            user = users[index % len(users)]
            payload = run_url_scan(db, user, SAMPLE_URLS[index % len(SAMPLE_URLS)])
            created.append(payload["scan"]["scan_id"])

        for index in range(message_count):
            user = users[index % len(users)]
            payload = run_message_scan(db, user, SAMPLE_MESSAGES[index % len(SAMPLE_MESSAGES)])
            created.append(payload["scan"]["scan_id"])

        for index in range(document_count):
            user = users[index % len(users)]
            filename, content = SAMPLE_DOCUMENTS[index % len(SAMPLE_DOCUMENTS)]
            payload = run_document_scan(db, user, filename, content)
            created.append(payload["scan"]["scan_id"])

    return created


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed FraudShield AI with demo data.")
    parser.add_argument(
        "--reset", action="store_true", help="delete existing scans before seeding"
    )
    parser.add_argument("--urls", type=int, default=10, help="number of URL scans to create")
    parser.add_argument(
        "--messages", type=int, default=10, help="number of message scans to create"
    )
    parser.add_argument(
        "--documents", type=int, default=4, help="number of document scans to create"
    )
    parser.add_argument(
        "--users-only", action="store_true", help="create the accounts but no sample scans"
    )
    args = parser.parse_args(argv)

    configure_logging()
    create_tables()

    with SessionLocal() as db:
        admin, admin_created = ensure_user(
            db,
            name=settings.ADMIN_NAME,
            email=settings.ADMIN_EMAIL,
            password=settings.ADMIN_PASSWORD,
            role=UserRole.ADMIN,
        )
        demo, demo_created = ensure_user(
            db,
            name=settings.DEMO_NAME,
            email=settings.DEMO_EMAIL,
            password=settings.DEMO_PASSWORD,
            role=UserRole.USER,
        )
        ensure_user(
            db,
            name="Priya Sharma",
            email="priya@fraudshield.local",
            password=settings.DEMO_PASSWORD,
            role=UserRole.USER,
        )
        logger.info(
            "Admin account %s (%s)",
            admin.email,
            "created" if admin_created else "already present",
        )
        logger.info(
            "Demo account %s (%s)", demo.email, "created" if demo_created else "already present"
        )

    if args.reset:
        reset_scans()

    if args.users_only:
        logger.info("Accounts ready. Skipping sample scans (--users-only).")
        return 0

    with SessionLocal() as db:
        existing = int(db.execute(select(func.count(Scan.id))).scalar() or 0)
    if existing and not args.reset:
        logger.info(
            "%s scans already present — skipping sample scans. Use --reset to regenerate.",
            existing,
        )
        return 0

    logger.info("Running sample analyses (this trains the ML models on first run)…")
    scan_ids = seed_scans(
        url_count=args.urls, message_count=args.messages, document_count=args.documents
    )
    _backdate(scan_ids)

    with SessionLocal() as db:
        total = int(db.execute(select(func.count(Scan.id))).scalar() or 0)
    logger.info("Seeding complete: %s sample scans created (%s total).", len(scan_ids), total)
    logger.info("Sign in with %s to explore the dashboards.", settings.DEMO_EMAIL)
    return 0


if __name__ == "__main__":
    sys.exit(main())
