"""Pytest fixtures: isolated in-memory database and an authenticated API client."""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("CREATE_BOOTSTRAP_USERS", "False")
os.environ.setdefault("TRAIN_MODELS_ON_STARTUP", "False")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.database.session import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)


@pytest.fixture(autouse=True)
def _fresh_schema() -> Iterator[None]:
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db() -> Iterator[Session]:
    with TestSession() as session:
        yield session


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    def override_get_db() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _make_user(db: Session, *, email: str, password: str, role: UserRole) -> User:
    user = User(
        name="Test User" if role is UserRole.USER else "Test Admin",
        email=email,
        password_hash=hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def user_credentials() -> dict[str, str]:
    return {"email": "analyst@example.com", "password": "Testing@123"}


@pytest.fixture
def auth_client(client: TestClient, db: Session, user_credentials: dict[str, str]) -> TestClient:
    _make_user(
        db,
        email=user_credentials["email"],
        password=user_credentials["password"],
        role=UserRole.USER,
    )
    response = client.post("/api/auth/login", json=user_credentials)
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture
def admin_client(client: TestClient, db: Session) -> TestClient:
    credentials = {"email": "root@example.com", "password": "Testing@123"}
    _make_user(db, email=credentials["email"], password=credentials["password"], role=UserRole.ADMIN)
    response = client.post("/api/auth/login", json=credentials)
    assert response.status_code == 200, response.text
    client.headers.update({"Authorization": f"Bearer {response.json()['access_token']}"})
    return client
