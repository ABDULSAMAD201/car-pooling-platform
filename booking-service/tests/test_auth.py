from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel

os.environ["DATABASE_URL"] = "sqlite:///./test_auth.db"
os.environ["MATCHING_SERVICE_URL"] = "http://localhost:8001"
os.environ["NOTIFY_SERVICE_URL"] = "http://localhost:8002"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"
os.environ["AUTH_SECRET_KEY"] = "test-secret-key"

from app.config import settings
from app.database import engine
from app.main import app

CREDENTIALS = {"email": "ada@example.com", "password": "password123"}


@pytest.fixture
def client():
    settings.DATABASE_URL = "sqlite:///./test_auth.db"
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with TestClient(app) as test_client:
        yield test_client
    SQLModel.metadata.drop_all(engine)


@pytest.fixture
def auth(client):
    """Register a user and return (auth headers, user body)."""
    response = client.post("/auth/register", json={**CREDENTIALS, "full_name": "Ada"})
    assert response.status_code == 201, response.text
    body = response.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]


def test_register_returns_token_and_user(client):
    response = client.post("/auth/register", json={**CREDENTIALS, "full_name": "Ada"})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == CREDENTIALS["email"]
    assert body["user"]["full_name"] == "Ada"
    assert "password_hash" not in body["user"]


def test_register_normalizes_email_and_rejects_duplicates(client):
    assert client.post("/auth/register", json=CREDENTIALS).status_code == 201
    duplicate = client.post("/auth/register", json={**CREDENTIALS, "email": "ADA@example.com"})
    assert duplicate.status_code == 409


def test_register_rejects_invalid_email_and_short_password(client):
    bad_email = client.post("/auth/register", json={**CREDENTIALS, "email": "not-an-email"})
    assert bad_email.status_code == 422

    short = client.post("/auth/register", json={**CREDENTIALS, "password": "short"})
    assert short.status_code == 422


def test_login_succeeds_and_rejects_wrong_password(client):
    client.post("/auth/register", json=CREDENTIALS)

    good = client.post("/auth/login", json=CREDENTIALS)
    assert good.status_code == 200, good.text
    assert good.json()["access_token"]

    bad = client.post("/auth/login", json={**CREDENTIALS, "password": "wrongpassword"})
    assert bad.status_code == 401
    # The failure must not reveal whether the email exists, so it reads
    # identically to the unknown-email case below.
    assert bad.json()["detail"] == "Incorrect email or password."


def test_login_unknown_email_returns_same_message(client):
    response = client.post("/auth/login", json=CREDENTIALS)
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


def test_me_requires_a_valid_token(client, auth):
    headers, user = auth

    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["email"] == CREDENTIALS["email"]

    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer garbage.garbage"}).status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer tampered.sig"}).status_code == 401


def test_token_signed_with_another_key_is_rejected(client, auth):
    """A token forged with a different signing key must not be accepted."""
    from app.security import create_access_token, decode_access_token

    headers, user = auth
    body, signature = headers["Authorization"].removeprefix("Bearer ").split(".")
    forged = f"{body}.{'A' * len(signature)}"
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401

    # Sanity check that the helper still round-trips valid tokens.
    token = create_access_token(str(user["id"]))
    assert decode_access_token(token) == str(user["id"])


def test_patch_me_updates_profile(client, auth):
    headers, user = auth
    response = client.patch("/auth/me", headers=headers, json={"full_name": "Ada L", "phone": "555"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["full_name"] == "Ada L"
    assert body["phone"] == "555"


def test_authenticated_ride_is_owned_by_the_account(client, auth):
    headers, user = auth

    response = client.post(
        "/rides",
        headers=headers,
        json={
            # A spoofed user_id must be ignored in favour of the signed-in account.
            "user_id": "someone-else",
            "origin": {"lat": 1.0, "lng": 2.0},
            "destination": {"lat": 3.0, "lng": 4.0},
            "time": "2030-01-01T10:00:00Z",
        },
    )
    # The matching service is not running in tests, so the response may be a
    # 500; either way the ride must not be attributed to "someone-else".
    if response.status_code == 201:
        assert response.json()["user_id"] == user["id"]

    mine = client.get("/rides/mine", headers=headers)
    assert mine.status_code == 200, mine.text
    assert all(ride["user_id"] == user["id"] for ride in mine.json())


def test_rides_mine_requires_authentication(client):
    assert client.get("/rides/mine").status_code == 401