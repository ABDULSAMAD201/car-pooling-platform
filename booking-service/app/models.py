from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class UserRole(str, Enum):
    rider = "rider"
    driver = "driver"
    both = "both"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    email: str = Field(index=True, unique=True)
    full_name: str = ""
    phone: str = ""
    password_hash: str
    role: UserRole = Field(default=UserRole.rider, index=True)
    home_lat: float | None = None
    home_lng: float | None = None
    home_label: str = ""
    # Driver-specific profile fields.
    vehicle_make: str = ""
    vehicle_model: str = ""
    vehicle_color: str = ""
    vehicle_plate: str = ""
    seats_offered: int = 3
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RideStatus(str, Enum):
    requested = "requested"
    matched = "matched"
    confirmed = "confirmed"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class Ride(SQLModel, table=True):
    __tablename__ = "rides"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    user_id: str = Field(index=True)
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float
    requested_time: datetime
    status: RideStatus = Field(default=RideStatus.requested, index=True)
    matched_driver_id: str | None = None
    matched_ride_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RideInterest(SQLModel, table=True):
    """A driver volunteering to take a ride that has not been assigned yet.

    Drivers express interest and the rider chooses from the interested pool, so
    a ride only gets a `matched_driver_id` once somebody has accepted it. The
    score is snapshotted from the matching service at the moment of interest so
    the rider's list can be ranked without re-scoring every candidate later.
    """

    __tablename__ = "ride_interest"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    ride_id: str = Field(index=True)
    driver_id: str = Field(index=True)
    score: float | None = None
    pickup_km: float | None = None
    bearing_diff: float | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
