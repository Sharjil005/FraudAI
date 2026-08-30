"""Authentication endpoints and access control."""

from __future__ import annotations

from fastapi.testclient import TestClient

NEW_ACCOUNT = {
    "name": "Aarav Mehta",
    "email": "aarav@example.com",
    "password": "Strong@123",
}


def test_register_returns_a_token_and_user(client: TestClient) -> None:
    response = client.post("/api/auth/register", json=NEW_ACCOUNT)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == NEW_ACCOUNT["email"]
    assert body["user"]["role"] == "USER"
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]


def test_duplicate_email_is_rejected(client: TestClient) -> None:
    client.post("/api/auth/register", json=NEW_ACCOUNT)
    response = client.post("/api/auth/register", json=NEW_ACCOUNT)
    assert response.status_code == 409


def test_email_is_case_insensitive(client: TestClient) -> None:
    client.post("/api/auth/register", json=NEW_ACCOUNT)
    response = client.post(
        "/api/auth/login",
        json={"email": "AARAV@Example.com", "password": NEW_ACCOUNT["password"]},
    )
    assert response.status_code == 200


def test_weak_password_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register", json={**NEW_ACCOUNT, "email": "weak@example.com", "password": "abc"}
    )
    assert response.status_code == 422


def test_invalid_email_is_rejected(client: TestClient) -> None:
    response = client.post("/api/auth/register", json={**NEW_ACCOUNT, "email": "not-an-email"})
    assert response.status_code == 422


def test_login_with_wrong_password_fails(client: TestClient) -> None:
    client.post("/api/auth/register", json=NEW_ACCOUNT)
    response = client.post(
        "/api/auth/login", json={"email": NEW_ACCOUNT["email"], "password": "Wrong@1234"}
    )
    assert response.status_code == 401
    assert "password" in response.json()["detail"].lower()


def test_login_for_unknown_user_fails(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login", json={"email": "ghost@example.com", "password": "Strong@123"}
    )
    assert response.status_code == 401


def test_me_requires_a_token(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_a_malformed_token(client: TestClient) -> None:
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert response.status_code == 401


def test_me_returns_the_current_user(auth_client: TestClient) -> None:
    response = auth_client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == "analyst@example.com"


def test_admin_routes_are_closed_to_regular_users(auth_client: TestClient) -> None:
    assert auth_client.get("/api/admin/analytics").status_code == 403


def test_admin_routes_are_open_to_admins(admin_client: TestClient) -> None:
    response = admin_client.get("/api/admin/analytics")
    assert response.status_code == 200
    assert "total_users" in response.json()


def test_seeded_local_domain_accounts_can_register_and_log_in(client: TestClient) -> None:
    """The bootstrap accounts live on ``.local``, which email_validator rejects by default."""
    account = {"name": "Demo User", "email": "demo@fraudshield.local", "password": "Demo@12345"}
    assert client.post("/api/auth/register", json=account).status_code == 201

    response = client.post(
        "/api/auth/login",
        json={"email": "  Demo@FraudShield.LOCAL  ", "password": account["password"]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["user"]["email"] == "demo@fraudshield.local"


def test_other_reserved_domains_are_still_rejected(client: TestClient) -> None:
    for email in ("x@evil.invalid", "x@thing.onion", "a@b", "@nope.com"):
        response = client.post("/api/auth/register", json={**NEW_ACCOUNT, "email": email})
        assert response.status_code == 422, f"{email} should be rejected: {response.text}"
