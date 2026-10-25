from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models import DriverAvailability, MatchResult


class Location(BaseModel):
    lat: float
    lng: float


class RideRequest(BaseModel):
    ride_id: str
    origin: Location
    destination: Location
    time: datetime


class DriverAvailabilityCreate(BaseModel):
    driver_id: str
    current_lat: float
    current_lng: float
    destination_lat: float
    destination_lng: float
    available_from: datetime | None = None
    available_to: datetime | None = None


class DriverAvailabilityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    driver_id: str
    current_lat: float
    current_lng: float
    destination_lat: float
    destination_lng: float
    is_active: bool
    available_from: datetime | None = None
    available_to: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_driver(cls, driver: DriverAvailability) -> "DriverAvailabilityResponse":
        return cls(
            id=driver.id,
            driver_id=driver.driver_id,
            current_lat=driver.current_lat,
            current_lng=driver.current_lng,
            destination_lat=driver.destination_lat,
            destination_lng=driver.destination_lng,
            is_active=driver.is_active,
            available_from=driver.available_from,
            available_to=driver.available_to,
            created_at=driver.created_at,
            updated_at=driver.updated_at,
        )


class MatchResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ride_id: str
    driver_id: str | None = None
    score: float | None = None
    created_at: datetime

    @classmethod
    def from_match(cls, result: MatchResult) -> "MatchResultResponse":
        return cls(
            id=result.id,
            ride_id=result.ride_id,
            driver_id=result.driver_id,
            score=result.score,
            created_at=result.created_at,
        )


class MatchDecision(BaseModel):
    matched: bool
    driver_id: str | None = None
    match_id: UUID | None = None


class RideLookup(BaseModel):
    """Ask how well each active driver fits an existing ride.

    Used to show a driver their eligibility before they volunteer, and to
    score their interest once they do. Does not assign anybody.
    """

    origin: Location
    destination: Location


class DriverCandidate(BaseModel):
    driver_id: str
    score: float
    pickup_km: float
    bearing_diff: float
