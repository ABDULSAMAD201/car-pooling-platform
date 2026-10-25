from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models import Ride, RideInterest, RideStatus, User


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


class OpenRequestResponse(RideResponse):
    """An unassigned ride as shown to drivers browsing for work.

    Extends the rider's own view with the rider's display name so a driver can
    see who they would be collecting. Deliberately omits the rider's phone: that
    is only shared once a driver has actually been picked.
    """

    rider_name: str = ""

    @classmethod
    def from_ride(cls, ride: Ride, rider_name: str = "") -> "OpenRequestResponse":
        base = RideResponse.from_ride(ride)
        return cls(**base.model_dump(), rider_name=rider_name)


class InterestResponse(BaseModel):
    """Confirmation that a driver has put themselves forward for a ride."""

    ride_id: str
    driver_id: str
    score: float | None = None
    pickup_km: float | None = None
    bearing_diff: float | None = None

    @classmethod
    def from_interest(cls, interest: RideInterest) -> "InterestResponse":
        return cls(
            ride_id=interest.ride_id,
            driver_id=interest.driver_id,
            score=interest.score,
            pickup_km=interest.pickup_km,
            bearing_diff=interest.bearing_diff,
        )


class DriverCandidate(BaseModel):
    """One interested driver, as ranked for the rider who owns the ride.

    Carries the driver's vehicle details and contact number because at this
    point the rider has committed to a specific person and needs to be able to
    reach them.
    """

    driver_id: str
    full_name: str = ""
    phone: str = ""
    vehicle_make: str = ""
    vehicle_model: str = ""
    vehicle_color: str = ""
    vehicle_plate: str = ""
    seats_offered: int = 3
    score: float | None = None
    pickup_km: float | None = None
    bearing_diff: float | None = None
    interested_at: datetime

    @classmethod
    def build(
        cls,
        interest: RideInterest,
        driver: User,
    ) -> "DriverCandidate":
        return cls(
            driver_id=interest.driver_id,
            full_name=driver.full_name,
            phone=driver.phone,
            vehicle_make=driver.vehicle_make,
            vehicle_model=driver.vehicle_model,
            vehicle_color=driver.vehicle_color,
            vehicle_plate=driver.vehicle_plate,
            seats_offered=driver.seats_offered,
            score=interest.score,
            pickup_km=interest.pickup_km,
            bearing_diff=interest.bearing_diff,
            interested_at=interest.created_at,
        )


class PickDriverRequest(BaseModel):
    """The rider choosing which interested driver takes their ride."""

    driver_id: str
