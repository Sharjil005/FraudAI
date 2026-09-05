"""Tests for the Social Safety Circle features."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.core.security import hash_password


def _create_test_user(db: Session, email: str, name: str) -> User:
    user = User(
        name=name,
        email=email,
        password_hash=hash_password("Testing@123"),
        role=UserRole.USER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _get_auth_headers(client: TestClient, email: str) -> dict:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "Testing@123"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_friend_request_lifecycle(client: TestClient, auth_client: TestClient, db: Session) -> None:
    # 1. Create a second user
    receiver_email = "samad@example.com"
    _create_test_user(db, receiver_email, "Samad")

    # 2. Send friend request from the default auth_client user (analyst@example.com) to Samad
    response = auth_client.post("/api/social/friends/request", json={"email": receiver_email})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "PENDING"
    assert body["friend_email"] == receiver_email
    assert body["friend_name"] == "Samad"
    request_id = body["id"]

    # 3. Log in as Samad and check pending requests
    samad_headers = _get_auth_headers(client, receiver_email)
    response = client.get("/api/social/friends/requests", headers=samad_headers)
    assert response.status_code == 200
    reqs = response.json()
    assert len(reqs) == 1
    assert reqs[0]["id"] == request_id
    assert reqs[0]["friend_email"] == "analyst@example.com"  # The sender from Samad's perspective

    # 4. Accept request as Samad
    response = client.post(f"/api/social/friends/accept/{request_id}", headers=samad_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "ACCEPTED"

    # 5. Verify friends list on both sides
    # For Samad:
    response = client.get("/api/social/friends", headers=samad_headers)
    assert response.status_code == 200
    friends_samad = response.json()
    assert len(friends_samad) == 1
    assert friends_samad[0]["email"] == "analyst@example.com"

    # For Analyst:
    response = auth_client.get("/api/social/friends")
    assert response.status_code == 200
    friends_analyst = response.json()
    assert len(friends_analyst) == 1
    assert friends_analyst[0]["email"] == receiver_email


def test_duplicate_or_invalid_friend_requests(auth_client: TestClient, db: Session) -> None:
    # Try adding self
    response = auth_client.post("/api/social/friends/request", json={"email": "analyst@example.com"})
    assert response.status_code == 400
    assert "cannot send a friend request to yourself" in response.json()["detail"]

    # Try adding unregistered email
    response = auth_client.post("/api/social/friends/request", json={"email": "nonexistent@example.com"})
    assert response.status_code == 400
    assert "not registered" in response.json()["detail"]


def test_safety_group_crud(client: TestClient, auth_client: TestClient, db: Session) -> None:
    # 1. Create a friend connection
    friend_email = "jaid@example.com"
    friend = _create_test_user(db, friend_email, "Jaid")

    req_response = auth_client.post("/api/social/friends/request", json={"email": friend_email})
    assert req_response.status_code == 201
    req_id = req_response.json()["id"]

    jaid_headers = _get_auth_headers(client, friend_email)
    client.post(f"/api/social/friends/accept/{req_id}", headers=jaid_headers)

    # 2. Create safety group
    group_name = "Tech Safety Circle"
    response = auth_client.post("/api/social/groups", json={"name": group_name})
    assert response.status_code == 201
    group = response.json()
    assert group["name"] == group_name
    assert len(group["members"]) == 1  # Only the creator initially
    group_id = group["id"]

    # 3. Add friend to group
    response = auth_client.post(
        f"/api/social/groups/{group_id}/members",
        json={"friend_id": friend.id},
    )
    assert response.status_code == 200
    assert response.json()["email"] == friend_email

    # 4. Fetch groups list
    response = auth_client.get("/api/social/groups")
    assert response.status_code == 200
    groups_list = response.json()
    assert len(groups_list) == 1
    assert groups_list[0]["name"] == group_name
    assert len(groups_list[0]["members"]) == 2


def test_threat_sharing_and_alerts(client: TestClient, auth_client: TestClient, db: Session) -> None:
    # 1. Setup friends (Analyst <-> Jay)
    jay_email = "jay@example.com"
    jay = _create_test_user(db, jay_email, "Jay")
    req_response = auth_client.post("/api/social/friends/request", json={"email": jay_email})
    req_id = req_response.json()["id"]
    jay_headers = _get_auth_headers(client, jay_email)
    client.post(f"/api/social/friends/accept/{req_id}", headers=jay_headers)

    # 2. Run a scan as Analyst
    scan_response = auth_client.post(
        "/api/scan/url",
        json={"url": "http://secure-login-verify-account.example.com/login?account=12345"},
    )
    assert scan_response.status_code == 201
    scan_id = scan_response.json()["scan"]["scan_id"]

    # 3. Share threat alert with Jay
    share_note = "Got this bank verification scam link today. Be careful!"
    share_response = auth_client.post(
        "/api/social/share",
        json={
            "scan_id": scan_id,
            "friend_ids": [jay.id],
            "group_ids": [],
            "note": share_note,
        },
    )
    assert share_response.status_code == 201
    assert share_response.json()["shared_count"] == 1

    # 4. Log in as Jay and check received alerts
    alerts_response = client.get("/api/social/alerts", headers=jay_headers)
    assert alerts_response.status_code == 200
    alerts = alerts_response.json()
    assert len(alerts) == 1
    alert_id = alerts[0]["id"]
    assert alerts[0]["scan_id"] == scan_id
    assert alerts[0]["sender_name"] == "Test User"  # Default name of auth_client user
    assert alerts[0]["note"] == share_note
    assert alerts[0]["risk_level"] == "HIGH"
    assert alerts[0]["is_read"] is False

    # 5. Access the shared scan as Jay (Priya) -> Should succeed now (No 403!)
    scan_detail_response = client.get(f"/api/scans/{scan_id}", headers=jay_headers)
    assert scan_detail_response.status_code == 200
    assert scan_detail_response.json()["scan_id"] == scan_id

    # 6. Try accessing the scan as a stranger -> Should fail (403 Forbidden!)
    stranger_email = "stranger@example.com"
    _create_test_user(db, stranger_email, "Stranger")
    stranger_headers = _get_auth_headers(client, stranger_email)
    scan_detail_response = client.get(f"/api/scans/{scan_id}", headers=stranger_headers)
    assert scan_detail_response.status_code == 403

    # 7. Dismiss/Read the alert as Jay
    read_response = client.post(f"/api/social/alerts/{alert_id}/read", headers=jay_headers)
    assert read_response.status_code == 200
    assert read_response.json()["is_read"] is True

    # 8. Check unread alerts for Jay -> Should be empty
    unread_response = client.get("/api/social/alerts?unread_only=true", headers=jay_headers)
    assert unread_response.status_code == 200
    assert len(unread_response.json()) == 0

    # 9. Check general alerts for Jay -> Should still contain it
    general_response = client.get("/api/social/alerts?unread_only=false", headers=jay_headers)
    assert general_response.status_code == 200
    assert len(general_response.json()) == 1
    assert general_response.json()[0]["is_read"] is True
