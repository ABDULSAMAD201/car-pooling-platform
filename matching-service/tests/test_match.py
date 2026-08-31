from __future__ import annotations

import os
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel

os.environ["DATABASE_URL"] = "sqlite:///./test_matching.db"
os.environ["BOOKING_SERVICE_URL"] = "http://localhost:8000"

from app.database import engine
from app.main import app


@pytest.fixture
def client():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with TestClient(app) as test_client:
        yield test_client
    SQLModel.metadata.drop_all(engine)


def test_post_driver_availability_and_match_returns_match(client):
    driver_payload = {
        "driver_id": "driver-42",
        "current_lat": 10.0,
        "current_lng": 20.0,
    }
    driver_response = client.post("/drivers/availability", json=driver_payload)
    assert driver_response.status_code == 201, driver_response.text

    ride_payload = {
        "ride_id": "ride-1",
        "origin": {"lat": 1.0, "lng": 2.0},
        "destination": {"lat": 3.0, "lng": 4.0},
        "time": datetime.now(timezone.utc).isoformat(),
    }

    response = client.post("/match", json=ride_payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["matched"] is True
    assert body["driver_id"] == "driver-42"

    result = client.get("/matches/ride-1")
    assert result.status_code == 200, result.text
    assert result.json()["ride_id"] == "ride-1"


def test_match_returns_false_when_no_drivers_are_available(client):
    ride_payload = {
        "ride_id": "ride-2",
        "origin": {"lat": 7.0, "lng": 8.0},
        "destination": {"lat": 9.0, "lng": 10.0},
        "time": datetime.now(timezone.utc).isoformat(),
    }

    response = client.post("/match", json=ride_payload)
    assert response.status_code == 200, response.text
    assert response.json()["matched"] is False
    assert response.json()["driver_id"] is None
