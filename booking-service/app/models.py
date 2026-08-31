from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


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
