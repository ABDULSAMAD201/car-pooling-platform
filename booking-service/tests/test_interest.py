from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone


import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel

os.environ["DATABASE_URL"] = "sqlite:///./test_interest.db"
os.environ["MATCHING_SERVICE_URL"] = "http://localhost:8001"
os.environ["NOTIFY_SERVICE_URL"] = "http://localhost:8002"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"

from app.config import settings
from app.database import engine
from app.main import app


@pytest.fixture
def client():
    settings.DATABASE_URL = "sqlite:///./test_interest.db"
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with TestClient(app) as test_client:
        yield test_client
    SQLModel.metadata.drop_all(engine)


def register(client: TestClient, email: str, role: str = "rider") -> tuple[str, dict]:
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "testpassword123",
            "full_name": f"Person {role}",
            "phone": "03338413725",
            "role": role,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    return body["access_token"], body["user"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def book_ride(client: TestClient, token: str) -> str:
    response = client.post(
        "/rides",
        headers=auth(token),
        json={
            "user_id": "ignored-because-authenticated",
            "origin": {"lat": 31.5204, "lng": 74.3587},
            "destination": {"lat": 31.5490, "lng": 74.3430},
            "time": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_full_interest_and_pick_flow(client):
    rider_token, rider = register(client, "rider@example.com", "rider")
    driver_token, driver = register(client, "driver@example.com", "driver")
    ride_id = book_ride(client, rider_token)

    # A driver sees the open ride, with the rider's name but not their phone.
    requests = client.get("/rides/requests", headers=auth(driver_token))
    assert requests.status_code == 200, requests.text
    open_rides = requests.json()
    assert len(open_rides) == 1
    assert open_rides[0]["id"] == ride_id
    assert open_rides[0]["rider_name"] == "Person rider"
    assert "phone" not in open_rides[0]

    # Volunteering is recorded and is safe to repeat.
    first = client.post(f"/rides/{ride_id}/interest", headers=auth(driver_token))
    assert first.status_code == 201, first.text
    again = client.post(f"/rides/{ride_id}/interest", headers=auth(driver_token))
    assert again.status_code == 201, again.text
    assert again.json()["driver_id"] == driver["id"]

    # The rider sees the interested driver, and this time with contact details.
    candidates = client.get(f"/rides/{ride_id}/candidates", headers=auth(rider_token))
    assert candidates.status_code == 200, candidates.text
    listed = candidates.json()
    assert len(listed) == 1
    assert listed[0]["driver_id"] == driver["id"]
    assert listed[0]["phone"] == "03338413725"

    # Picking confirms the ride and attaches the driver.
    picked = client.post(
        f"/rides/{ride_id}/pick",
        headers=auth(rider_token),
        json={"driver_id": driver["id"]},
    )
    assert picked.status_code == 200, picked.text
    body = picked.json()
    assert body["status"] == "confirmed"
    assert body["matched_driver_id"] == driver["id"]

    # Once assigned, the ride is no longer open to other drivers.
    again_requests = client.get("/rides/requests", headers=auth(driver_token))
    assert again_requests.json() == []

    # And nobody may pick a second driver.
    second = client.post(
        f"/rides/{ride_id}/pick",
        headers=auth(rider_token),
        json={"driver_id": driver["id"]},
    )
    assert second.status_code == 409


def test_rider_cannot_volunteer_for_own_ride(client):
    rider_token, rider = register(client, "solo@example.com", "both")
    ride_id = book_ride(client, rider_token)

    response = client.post(f"/rides/{ride_id}/interest", headers=auth(rider_token))
    assert response.status_code == 400


def test_pure_rider_cannot_browse_or_volunteer(client):
    rider_token, _ = register(client, "rider2@example.com", "rider")
    driver_token, driver = register(client, "driver2@example.com", "driver")
    ride_id = book_ride(client, driver_token)

    browse = client.get("/rides/requests", headers=auth(rider_token))
    assert browse.status_code == 403

    express = client.post(f"/rides/{ride_id}/interest", headers=auth(rider_token))
    assert express.status_code == 403


def test_cannot_pick_a_driver_who_never_volunteered(client):
    rider_token, _ = register(client, "rider3@example.com", "rider")
    _, stranger = register(client, "stranger@example.com", "driver")
    ride_id = book_ride(client, rider_token)

    response = client.post(
        f"/rides/{ride_id}/pick",
        headers=auth(rider_token),
        json={"driver_id": stranger["id"]},
    )
    assert response.status_code == 400


def test_only_the_rider_can_see_and_pick_for_a_ride(client):
    rider_token, _ = register(client, "rider4@example.com", "rider")
    other_token, _ = register(client, "other@example.com", "rider")
    ride_id = book_ride(client, rider_token)

    assert client.get(f"/rides/{ride_id}/candidates", headers=auth(other_token)).status_code == 404
    assert (
        client.post(
            f"/rides/{ride_id}/pick",
            headers=auth(other_token),
            json={"driver_id": "someone"},
        ).status_code
        == 404
    )


def test_withdraw_interest_removes_the_driver_from_the_pool(client):
    rider_token, _ = register(client, "rider5@example.com", "rider")
    driver_token, driver = register(client, "driver5@example.com", "driver")
    ride_id = book_ride(client, rider_token)

    client.post(f"/rides/{ride_id}/interest", headers=auth(driver_token))
    assert len(client.get(f"/rides/{ride_id}/candidates", headers=auth(rider_token)).json()) == 1

    removed = client.delete(f"/rides/{ride_id}/interest", headers=auth(driver_token))
    assert removed.status_code == 204
    assert client.get(f"/rides/{ride_id}/candidates", headers=auth(rider_token)).json() == []

    # Withdrawing twice is a no-op, not an error.
    assert client.delete(f"/rides/{ride_id}/interest", headers=auth(driver_token)).status_code == 204


def test_cancel_requires_being_the_rider_or_chosen_driver(client):
    rider_token, _ = register(client, "rider6@example.com", "rider")
    bystander_token, _ = register(client, "bystander@example.com", "rider")
    ride_id = book_ride(client, rider_token)

    # A signed-in bystander cannot cancel somebody else's ride.
    denied = client.patch(f"/rides/{ride_id}/cancel", headers=auth(bystander_token))
    assert denied.status_code == 404

    # Nor can an anonymous caller.
    assert client.patch(f"/rides/{ride_id}/cancel").status_code == 401

    # The rider themselves can.
    assert client.patch(f"/rides/{ride_id}/cancel", headers=auth(rider_token)).status_code == 200


def test_status_write_route_is_not_publicly_writable(client):
    """The old unauthenticated status endpoint let anyone rewrite any ride.

    The route has been removed rather than locked, so it no longer exists at
    any status code and cannot be reached with or without a token.
    """
    rider_token, _ = register(client, "rider7@example.com", "rider")
    ride_id = book_ride(client, rider_token)

    # No such route any more, so nothing can be written.
    anonymous = client.patch(f"/rides/{ride_id}/status", json={"status": "confirmed"})
    assert anonymous.status_code == 404

    # Not even the ride's own rider can reach it.
    as_owner = client.patch(
        f"/rides/{ride_id}/status",
        headers=auth(rider_token),
        json={"status": "confirmed"},
    )
    assert as_owner.status_code == 404

    # And the ride is genuinely untouched by the attempt.
    assert client.get(f"/rides/{ride_id}").json()["status"] == "requested"


def test_accepted_ride_appears_in_the_drivers_own_list(client):
    rider_token, _ = register(client, "rider8@example.com", "rider")
    driver_token, driver = register(client, "driver8@example.com", "driver")
    ride_id = book_ride(client, rider_token)

    assert client.get("/rides/mine/interested", headers=auth(driver_token)).json() == []

    client.post(f"/rides/{ride_id}/interest", headers=auth(driver_token))
    interested = client.get("/rides/mine/interested", headers=auth(driver_token))
    assert [item["id"] for item in interested.json()] == [ride_id]

    client.post(
        f"/rides/{ride_id}/pick", headers=auth(rider_token), json={"driver_id": driver["id"]}
    )
    after = client.get("/rides/mine/interested", headers=auth(driver_token)).json()
    assert after[0]["status"] == "confirmed"