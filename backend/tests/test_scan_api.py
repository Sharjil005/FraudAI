"""End-to-end API behaviour for scanning, history, dashboards and reports."""

from __future__ import annotations

import struct
import zlib

from fastapi.testclient import TestClient

DEMO_URL = "http://secure-login-verify-account.example.com/login?account=12345"
DEMO_MESSAGE = (
    "URGENT: Your bank account has been blocked. "
    "Click http://secure-bank-verify.com to verify your details immediately. "
    "Share the OTP received on your phone to complete verification."
)


def _png(width: int = 400, height: int = 300) -> bytes:
    rows = bytearray()
    for _ in range(height):
        rows.append(0)
        rows.extend((210, 210, 210) * width)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">2I5B", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(rows), 6))
        + chunk(b"IEND", b"")
    )


def test_health_endpoint(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_openapi_schema_is_served(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    assert "/api/scan/url" in response.json()["paths"]


def test_scanning_requires_authentication(client: TestClient) -> None:
    assert client.post("/api/scan/url", json={"url": DEMO_URL}).status_code == 401


def test_url_scan_returns_an_explainable_high_risk_result(auth_client: TestClient) -> None:
    response = auth_client.post("/api/scan/url", json={"url": DEMO_URL})
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["risk_score"] >= 60
    assert body["risk_level"] in {"HIGH", "CRITICAL"}
    assert body["prediction"] == "Phishing"
    assert body["indicators"]
    assert body["explanation"]
    assert body["recommendation"]
    assert body["risk_assessment"]["risk_level"] == body["risk_level"]
    assert body["scan"]["scan_id"] > 0


def test_invalid_url_returns_422(auth_client: TestClient) -> None:
    response = auth_client.post("/api/scan/url", json={"url": "definitely not a url"})
    assert response.status_code == 422


def test_message_scan_returns_categories(auth_client: TestClient) -> None:
    response = auth_client.post("/api/scan/message", json={"message": DEMO_MESSAGE})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["risk_score"] >= 60
    assert body["prediction"] == "Scam"
    assert body["detected_categories"]
    assert body["suspicious_phrases"]


def test_lottery_message_scan(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/scan/message",
        json={"message": "Congratulations! You have won Rs.50,000 in our lucky draw. Claim now!"},
    )
    assert response.status_code == 201
    assert response.json()["risk_score"] >= 60


def test_document_scan_returns_analysis_and_disclaimer(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/scan/document",
        files={"file": ("aadhaar_scan_copy.png", _png(), "image/png")},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["filename"] == "aadhaar_scan_copy.png"
    assert body["file_type"] == "png"
    assert body["indicators"]
    assert body["explanation"]
    assert body["disclaimer"]
    assert "ocr_available" in body


def test_unsupported_document_type_is_rejected(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/scan/document",
        files={"file": ("malware.exe", b"MZ\x90\x00binary", "application/octet-stream")},
    )
    assert response.status_code == 422


def test_history_lists_and_filters_scans(auth_client: TestClient) -> None:
    auth_client.post("/api/scan/url", json={"url": DEMO_URL})
    auth_client.post("/api/scan/url", json={"url": "https://www.google.com"})
    auth_client.post("/api/scan/message", json={"message": DEMO_MESSAGE})

    listing = auth_client.get("/api/scans")
    assert listing.status_code == 200
    body = listing.json()
    assert body["meta"]["total"] == 3
    assert len(body["items"]) == 3
    assert {"scan_id", "scan_type", "risk_level", "risk_score", "target_label"} <= body["items"][
        0
    ].keys()

    only_urls = auth_client.get("/api/scans", params={"scan_type": "URL"}).json()
    assert only_urls["meta"]["total"] == 2

    high_risk = auth_client.get("/api/scans", params={"risk_level": "HIGH"}).json()
    assert all(item["risk_level"] == "HIGH" for item in high_risk["items"])

    searched = auth_client.get("/api/scans", params={"search": "google"}).json()
    assert searched["meta"]["total"] == 1


def test_history_pagination(auth_client: TestClient) -> None:
    for _ in range(3):
        auth_client.post("/api/scan/url", json={"url": DEMO_URL})
    page = auth_client.get("/api/scans", params={"page": 1, "page_size": 2}).json()
    assert len(page["items"]) == 2
    assert page["meta"]["total_pages"] == 2


def test_scan_detail_is_returned(auth_client: TestClient) -> None:
    scan_id = auth_client.post("/api/scan/url", json={"url": DEMO_URL}).json()["scan"]["scan_id"]
    response = auth_client.get(f"/api/scans/{scan_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["scan_id"] == scan_id
    assert body["url"] == DEMO_URL
    assert body["indicators"]
    assert body["analysis_details"]


def test_scan_status_can_be_updated_for_triage(auth_client: TestClient) -> None:
    scan_id = auth_client.post("/api/scan/url", json={"url": DEMO_URL}).json()["scan"]["scan_id"]

    response = auth_client.patch(
        f"/api/scans/{scan_id}/status",
        json={"status": "REVIEWED"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "REVIEWED"


def test_case_notes_and_escalation_reason_are_saved(auth_client: TestClient) -> None:
    scan_id = auth_client.post("/api/scan/url", json={"url": DEMO_URL}).json()["scan"]["scan_id"]

    response = auth_client.patch(
        f"/api/scans/{scan_id}/status",
        json={
            "status": "ESCALATED",
            "reviewer_name": "Analyst A",
            "analyst_notes": "Manual review required because the domain impersonates a bank.",
            "escalation_reason": "Brand impersonation",
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ESCALATED"
    assert body["reviewer_name"] == "Analyst A"
    assert body["analyst_notes"] == "Manual review required because the domain impersonates a bank."
    assert body["escalation_reason"] == "Brand impersonation"


def test_case_assignment_and_status_history_are_recorded(auth_client: TestClient) -> None:
    scan_id = auth_client.post("/api/scan/url", json={"url": DEMO_URL}).json()["scan"]["scan_id"]

    response = auth_client.patch(
        f"/api/scans/{scan_id}/status",
        json={
            "status": "REVIEWED",
            "assigned_to": "Analyst B",
            "reviewer_name": "Analyst B",
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["assigned_to"] == "Analyst B"
    assert body["status_history"][-1]["status"] == "REVIEWED"
    assert body["status_history"][-1]["reviewer_name"] == "Analyst B"


def test_analyst_feedback_is_recorded_for_active_learning(auth_client: TestClient) -> None:
    scan_id = auth_client.post("/api/scan/url", json={"url": DEMO_URL}).json()["scan"]["scan_id"]

    response = auth_client.post(
        f"/api/scans/{scan_id}/feedback",
        json={
            "label": "SUSPICIOUS",
            "confidence": 0.92,
            "notes": "Strong phishing pattern matched by custom review.",
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["feedback"]["label"] == "SUSPICIOUS"
    assert body["feedback"]["confidence"] == 0.92
    assert body["feedback"]["notes"] == "Strong phishing pattern matched by custom review."
    assert body["feedback"]["reviewed_by"]


def test_bulk_scan_status_update_applies_to_selected_cases(auth_client: TestClient) -> None:
    first = auth_client.post("/api/scan/url", json={"url": DEMO_URL}).json()["scan"]["scan_id"]
    second = auth_client.post("/api/scan/message", json={"message": "Urgent bank update please verify now"}).json()["scan"]["scan_id"]

    response = auth_client.patch(
        "/api/scans/bulk-status",
        json={
            "scan_ids": [first, second],
            "status": "DISMISSED",
            "reviewer_name": "Ops Lead",
            "assigned_to": "Ops Lead",
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["updated"] == 2
    assert {item["scan_id"] for item in body["items"]} == {first, second}
    assert all(item["status"] == "DISMISSED" for item in body["items"])
    assert all(item["assigned_to"] == "Ops Lead" for item in body["items"])


def test_missing_scan_returns_404(auth_client: TestClient) -> None:
    assert auth_client.get("/api/scans/999999").status_code == 404


def test_users_cannot_read_another_users_scan(
    auth_client: TestClient, client: TestClient
) -> None:
    scan_id = auth_client.post("/api/scan/url", json={"url": DEMO_URL}).json()["scan"]["scan_id"]

    registration = client.post(
        "/api/auth/register",
        json={"name": "Other Person", "email": "other@example.com", "password": "Strong@123"},
    )
    token = registration.json()["access_token"]
    response = client.get(
        f"/api/scans/{scan_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403


def test_dashboard_summary_reflects_scans(auth_client: TestClient) -> None:
    auth_client.post("/api/scan/url", json={"url": DEMO_URL})
    auth_client.post("/api/scan/url", json={"url": "https://www.google.com"})

    response = auth_client.get("/api/dashboard/summary")
    assert response.status_code == 200
    body = response.json()
    assert body["total_scans"] == 2
    assert body["threats_detected"] >= 1
    assert len(body["stats"]) == 4
    assert len(body["risk_distribution"]) == 4
    assert len(body["trend"]) == 14
    assert body["recent_scans"]
    assert body["top_indicators"]
    assert body["sla_summary"]["overdue_cases"] >= 0
    assert body["sla_summary"]["aging_buckets"]
    assert body["workload_summary"]["my_assigned_cases"] >= 0
    assert body["workload_summary"]["unassigned_cases"] >= 0
    assert body["confidence_summary"]["review_required"] >= 0
    assert body["confidence_summary"]["high"] >= 0


def test_dashboard_summary_is_empty_for_a_new_account(auth_client: TestClient) -> None:
    body = auth_client.get("/api/dashboard/summary").json()
    assert body["total_scans"] == 0
    assert body["recent_scans"] == []
    assert body["average_risk_score"] == 0.0


def test_admin_analytics_aggregates_platform_data(admin_client: TestClient) -> None:
    admin_client.post("/api/scan/url", json={"url": DEMO_URL})
    body = admin_client.get("/api/admin/analytics").json()
    assert body["total_users"] >= 1
    assert body["total_scans"] >= 1
    assert body["top_indicators"]
    assert body["users"]
    assert body["model_status"]
    assert body["drift_summary"]["feedback_coverage"] >= 0
    assert "retraining_ready" in body["drift_summary"]


def test_pdf_report_downloads(auth_client: TestClient) -> None:
    scan_id = auth_client.post("/api/scan/url", json={"url": DEMO_URL}).json()["scan"]["scan_id"]
    response = auth_client.get(f"/api/reports/{scan_id}")
    assert response.status_code == 200
    assert response.headers["content-type"] in {"application/pdf", "text/html; charset=utf-8"}
    assert "attachment" in response.headers["content-disposition"]
    assert len(response.content) > 500


def test_html_report_downloads(auth_client: TestClient) -> None:
    scan_id = auth_client.post("/api/scan/message", json={"message": DEMO_MESSAGE}).json()["scan"][
        "scan_id"
    ]
    response = auth_client.get(f"/api/reports/{scan_id}", params={"fmt": "html"})
    assert response.status_code == 200
    assert b"FraudShield" in response.content


def test_report_accepts_the_format_query_alias(auth_client: TestClient) -> None:
    """``?format=html`` must not silently fall through to the PDF default."""
    scan_id = auth_client.post("/api/scan/url", json={"url": DEMO_URL}).json()["scan"]["scan_id"]
    response = auth_client.get(f"/api/reports/{scan_id}", params={"format": "html"})
    assert response.status_code == 200
    assert b"<html" in response.content.lower()
    assert not response.content.startswith(b"%PDF-")


def test_report_rejects_an_unknown_format(auth_client: TestClient) -> None:
    scan_id = auth_client.post("/api/scan/url", json={"url": DEMO_URL}).json()["scan"]["scan_id"]
    assert auth_client.get(f"/api/reports/{scan_id}", params={"fmt": "docx"}).status_code == 422


def test_report_is_not_readable_by_another_user(auth_client: TestClient, client: TestClient) -> None:
    scan_id = auth_client.post("/api/scan/url", json={"url": DEMO_URL}).json()["scan"]["scan_id"]
    intruder = {"name": "Nosy Neighbour", "email": "nosy@example.com", "password": "Sneak@1234"}
    token = client.post("/api/auth/register", json=intruder).json()["access_token"]
    response = client.get(
        f"/api/reports/{scan_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403


def test_scan_can_be_deleted(auth_client: TestClient) -> None:
    scan_id = auth_client.post("/api/scan/url", json={"url": DEMO_URL}).json()["scan"]["scan_id"]
    assert auth_client.delete(f"/api/scans/{scan_id}").status_code == 204
    assert auth_client.get(f"/api/scans/{scan_id}").status_code == 404


def test_capabilities_endpoint_reports_engine_state(client: TestClient) -> None:
    body = client.get("/api/scan/capabilities").json()
    assert "models" in body
    assert "ocr" in body
    assert body["risk_bands"]["HIGH"] == "60-79"
