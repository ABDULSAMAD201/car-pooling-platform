from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models import Ride, RideStatus


class Location(BaseModel):
    lat: float
    lng: float


class RideCreateRequest(BaseModel):
    user_id: str
    origin: Location
    destination: Location
    time: datetime


class RideStatusUpdate(BaseModel):
    status: RideStatus
    matched_driver_id: str | None = None
    matched_ride_id: str | None = None


class RideResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: str
    origin: Location
    destination: Location
    requested_time: datetime
    status: RideStatus
    matched_driver_id: str | None = None
    matched_ride_id: str | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_ride(cls, ride: Ride) -> "RideResponse":
        return cls(
            id=ride.id,
            user_id=ride.user_id,
            origin=Location(lat=ride.origin_lat, lng=ride.origin_lng),
            destination=Location(lat=ride.destination_lat, lng=ride.destination_lng),
            requested_time=ride.requested_time,
            status=ride.status,
            matched_driver_id=ride.matched_driver_id,
            matched_ride_id=ride.matched_ride_id,
            created_at=ride.created_at,
            updated_at=ride.updated_at,
        )
