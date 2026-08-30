"""End-to-end smoke test against a running FraudShield API.

Exercises every endpoint the frontend calls, plus the mandatory demo scenarios.
Run with:  backend/.venv/Scripts/python.exe scripts/smoke_api.py
"""

from __future__ import annotations

import io
import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000/api"
FAILURES: list[str] = []


def request(
    method: str,
    path: str,
    *,
    token: str | None = None,
    payload: dict | None = None,
    raw: tuple[bytes, str] | None = None,
    expect: int = 200,
):
    url = f"{BASE}{path}"
    body = None
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        body = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    if raw is not None:
        body, headers["Content-Type"] = raw

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            status = response.status
            content = response.read()
            content_type = response.headers.get("Content-Type", "")
            disposition = response.headers.get("Content-Disposition", "")
    except urllib.error.HTTPError as error:  # noqa: PERF203
        status = error.code
        content = error.read()
        content_type = error.headers.get("Content-Type", "")
        disposition = ""

    ok = status == expect
    if not ok:
        FAILURES.append(f"{method} {path} -> {status} (expected {expect}): {content[:200]!r}")
    print(f"{'OK ' if ok else 'FAIL'} {method:6} {path:38} {status}")

    if "application/json" in content_type:
        return json.loads(content or b"null"), disposition
    return content, disposition


def multipart(filename: str, data: bytes, content_type: str) -> tuple[bytes, str]:
    boundary = "----FraudShieldSmoke"
    buffer = io.BytesIO()
    buffer.write(f"--{boundary}\r\n".encode())
    buffer.write(
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode()
    )
    buffer.write(f"Content-Type: {content_type}\r\n\r\n".encode())
    buffer.write(data)
    buffer.write(f"\r\n--{boundary}--\r\n".encode())
    return buffer.getvalue(), f"multipart/form-data; boundary={boundary}"


def check(label: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"OK   {label}")
    else:
        FAILURES.append(f"{label} — {detail}")
        print(f"FAIL {label} — {detail}")


def main() -> int:
    print("== auth ==")
    login, _ = request(
        "POST",
        "/auth/login",
        payload={"email": "demo@fraudshield.local", "password": "Demo@12345"},
    )
    token = login["access_token"]
    admin_login, _ = request(
        "POST",
        "/auth/login",
        payload={"email": "admin@fraudshield.local", "password": "Admin@12345"},
    )
    admin_token = admin_login["access_token"]

    me, _ = request("GET", "/auth/me", token=token)
    check("GET /auth/me returns is_active", "is_active" in me, f"keys={sorted(me)}")

    request("POST", "/auth/login", payload={"email": "demo@fraudshield.local", "password": "wrong"}, expect=401)
    request("GET", "/auth/me", expect=401)

    print("\n== capabilities ==")
    request("GET", "/scan/capabilities", token=token)

    print("\n== mandatory demo scenarios ==")
    url_result, _ = request(
        "POST",
        "/scan/url",
        token=token,
        payload={"url": "http://secure-login-verify-account.example.com/login?account=12345"},
        expect=201,
    )
    check(
        "demo phishing URL scores HIGH/CRITICAL",
        url_result["risk_level"] in {"HIGH", "CRITICAL"},
        f"{url_result['risk_score']} {url_result['risk_level']} {url_result['prediction']}",
    )
    check(
        "demo phishing URL predicted Phishing",
        "phish" in url_result["prediction"].lower(),
        url_result["prediction"],
    )
    check("URL result carries indicators", len(url_result["indicators"]) > 0)
    check("URL result carries explanation", bool(url_result["explanation"].strip()))
    check("URL result carries recommendation", bool(url_result["recommendation"].strip()))
    print(f"     -> {url_result['risk_score']} {url_result['risk_level']} / {url_result['prediction']}")

    bank_message = (
        "URGENT: Your bank account has been blocked due to suspicious activity. "
        "Verify your identity immediately by clicking http://sbi-verify-kyc.co/login "
        "and share the OTP sent to your phone. Failure to act within 2 hours will "
        "result in permanent closure."
    )
    msg_result, _ = request(
        "POST", "/scan/message", token=token, payload={"message": bank_message}, expect=201
    )
    check(
        "URGENT bank/OTP message scores HIGH/CRITICAL",
        msg_result["risk_level"] in {"HIGH", "CRITICAL"},
        f"{msg_result['risk_score']} {msg_result['risk_level']}",
    )
    check("bank message predicted Scam", "scam" in msg_result["prediction"].lower(), msg_result["prediction"])
    print(f"     -> {msg_result['risk_score']} {msg_result['risk_level']} / {msg_result['prediction']}")

    lottery = (
        "Congratulations! You have won Rs.50,000 in our lucky draw. To claim your prize, "
        "send your bank account number, IFSC code and a processing fee of Rs.499 to this "
        "number immediately."
    )
    lot_result, _ = request(
        "POST", "/scan/message", token=token, payload={"message": lottery}, expect=201
    )
    check(
        "lottery message scores HIGH/CRITICAL",
        lot_result["risk_level"] in {"HIGH", "CRITICAL"},
        f"{lot_result['risk_score']} {lot_result['risk_level']}",
    )
    print(f"     -> {lot_result['risk_score']} {lot_result['risk_level']} / {lot_result['prediction']}")

    genuine, _ = request(
        "POST",
        "/scan/message",
        token=token,
        payload={
            "message": "Your OTP for login is 442819. It is valid for 10 minutes. "
            "Do not share it with anyone, including bank staff."
        },
        expect=201,
    )
    print(f"     genuine OTP notice -> {genuine['risk_score']} {genuine['risk_level']}")

    safe_url, _ = request(
        "POST", "/scan/url", token=token, payload={"url": "https://www.google.com"}, expect=201
    )
    check(
        "google.com scores LOW",
        safe_url["risk_level"] == "LOW",
        f"{safe_url['risk_score']} {safe_url['risk_level']}",
    )

    print("\n== document scan (no OCR required) ==")
    pdf_bytes = (
        b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\n"
        b"trailer<</Root 1 0 R>>\n%%EOF\n"
    )
    doc_result, _ = request(
        "POST",
        "/scan/document",
        token=token,
        raw=multipart("URGENT-invoice-payment-update.pdf", pdf_bytes, "application/pdf"),
        expect=201,
    )
    check("document scan returns indicators", len(doc_result["indicators"]) > 0)
    check("document scan carries disclaimer", bool(doc_result.get("disclaimer")))
    check(
        "document disclaimer avoids forensic certainty",
        "not" in (doc_result.get("disclaimer") or "").lower(),
        doc_result.get("disclaimer", ""),
    )
    print(
        f"     -> {doc_result['risk_score']} {doc_result['risk_level']} / "
        f"{doc_result['prediction']} (ocr_used={doc_result.get('ocr_used')})"
    )
    request("POST", "/scan/document", token=token, raw=multipart("payload.exe", b"MZ\x90\x00", "application/octet-stream"), expect=422)

    print("\n== history + detail ==")
    history, _ = request("GET", "/scans?page=1&page_size=5", token=token)
    check("history returns items", len(history["items"]) > 0)
    check("history returns meta", "total_pages" in history["meta"])
    request("GET", "/scans?page=1&page_size=5&scan_type=URL", token=token)
    request("GET", "/scans?page=1&page_size=5&risk_level=HIGH", token=token)
    request("GET", "/scans?page=1&page_size=5&search=login", token=token)

    scan_id = url_result["scan"]["scan_id"]
    detail, _ = request("GET", f"/scans/{scan_id}", token=token)
    check("detail exposes url field", detail.get("url") is not None)
    request("GET", "/scans/99999999", token=token, expect=404)

    print("\n== dashboard ==")
    summary, _ = request("GET", "/dashboard/summary", token=token)
    for key in ("stats", "risk_distribution", "scan_type_distribution", "trend", "recent_scans"):
        check(f"summary contains {key}", key in summary, f"keys={sorted(summary)}")

    print("\n== reports ==")
    pdf, disposition = request("GET", f"/reports/{scan_id}?fmt=pdf", token=token)
    check("PDF report body is a PDF", isinstance(pdf, bytes) and pdf[:5] == b"%PDF-", str(pdf[:16]))
    check("PDF sends attachment filename", "filename" in disposition, disposition)
    html, html_disposition = request("GET", f"/reports/{scan_id}?fmt=html", token=token)
    check(
        "HTML report body is HTML",
        isinstance(html, bytes) and b"<html" in html.lower(),
        str(html[:60]),
    )
    check("HTML sends attachment filename", "filename" in html_disposition, html_disposition)
    alias, _ = request("GET", f"/reports/{scan_id}?format=html", token=token)
    check(
        "?format=html alias also yields HTML",
        isinstance(alias, bytes) and b"<html" in alias.lower(),
        str(alias[:60]),
    )

    print("\n== admin ==")
    request("GET", "/admin/analytics", token=token, expect=403)
    analytics, _ = request("GET", "/admin/analytics", token=admin_token)
    for key in ("stats", "top_indicators", "recent_suspicious_scans", "users", "model_status"):
        check(f"analytics contains {key}", key in analytics, f"keys={sorted(analytics)}")
    check(
        "analytics users expose is_active",
        all("is_active" in row for row in analytics["users"]),
        str(analytics["users"][:1]),
    )
    users, _ = request("GET", "/admin/users", token=admin_token)
    target = next((row for row in users if row["role"] != "ADMIN"), None)
    if target:
        suspended, _ = request(
            "PATCH", f"/admin/users/{target['id']}/status?is_active=false", token=admin_token
        )
        check("suspend sets is_active false", suspended["is_active"] is False, str(suspended))
        restored, _ = request(
            "PATCH", f"/admin/users/{target['id']}/status?is_active=true", token=admin_token
        )
        check("re-enable sets is_active true", restored["is_active"] is True, str(restored))

    print("\n== delete ==")
    throwaway, _ = request(
        "POST",
        "/scan/url",
        token=token,
        payload={"url": "https://example.org/temp-smoke"},
        expect=201,
    )
    request("DELETE", f"/scans/{throwaway['scan']['scan_id']}", token=token, expect=204)
    request("GET", f"/scans/{throwaway['scan']['scan_id']}", token=token, expect=404)

    print("\n" + "=" * 60)
    if FAILURES:
        print(f"{len(FAILURES)} FAILURE(S):")
        for failure in FAILURES:
            print(f"  - {failure}")
        return 1
    print("All smoke checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
