from __future__ import annotations

import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel

os.environ["DATABASE_URL"] = "sqlite:///./test_booking.db"
os.environ["MATCHING_SERVICE_URL"] = "http://localhost:8001"
os.environ["NOTIFY_SERVICE_URL"] = "http://localhost:8002"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"

from app.config import settings
from app.database import engine
from app.main import app


@pytest.fixture
def client():
    settings.DATABASE_URL = "sqlite:///./test_booking.db"
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with TestClient(app) as test_client:
        yield test_client
    SQLModel.metadata.drop_all(engine)


def test_create_ride_and_fetch_it(client):
    payload = {
        "user_id": "user-123",
        "origin": {"lat": 1.0, "lng": 2.0},
        "destination": {"lat": 3.0, "lng": 4.0},
        "time": datetime.now(timezone.utc).isoformat(),
    }

    response = client.post("/rides", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["user_id"] == "user-123"
    assert body["status"] == "requested"
    assert body["origin"]["lat"] == 1.0

    ride_id = body["id"]
    fetch = client.get(f"/rides/{ride_id}")
    assert fetch.status_code == 200, fetch.text
    assert fetch.json()["id"] == ride_id


def test_get_ride_not_found(client):
    response = client.get("/rides/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
