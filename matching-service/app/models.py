from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class DriverAvailability(SQLModel, table=True):
    __tablename__ = "driver_availability"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    driver_id: str = Field(index=True)
    current_lat: float
    current_lng: float
    is_active: bool = Field(default=True, index=True)
    available_from: datetime | None = None
    available_to: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MatchResult(SQLModel, table=True):
    __tablename__ = "match_results"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    ride_id: str = Field(index=True)
    driver_id: str | None = None
    score: float | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
