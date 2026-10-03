from __future__ import annotations

import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import User, UserRole

# Deliberately permissive: enough to catch typos without rejecting valid
# addresses, and avoids depending on `email-validator` (pydantic[email]).
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_email(value: str) -> str:
    normalized = value.strip().lower()
    if not _EMAIL_RE.match(normalized):
        raise ValueError("Enter a valid email address.")
    return normalized


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    phone: str
    role: UserRole
    home_lat: float | None = None
    home_lng: float | None = None
    home_label: str = ""
    vehicle_make: str = ""
    vehicle_model: str = ""
    vehicle_color: str = ""
    vehicle_plate: str = ""
    seats_offered: int = 3
    created_at: datetime

    @classmethod
    def from_user(cls, user: User) -> "UserResponse":
        return cls(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=user.role,
            home_lat=user.home_lat,
            home_lng=user.home_lng,
            home_label=user.home_label,
            vehicle_make=user.vehicle_make,
            vehicle_model=user.vehicle_model,
            vehicle_color=user.vehicle_color,
            vehicle_plate=user.vehicle_plate,
            seats_offered=user.seats_offered,
            created_at=user.created_at,
        )


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=32)
    role: UserRole = UserRole.rider

    _check_email = field_validator("email")(_validate_email)


class LoginRequest(BaseModel):
    email: str
    password: str

    _check_email = field_validator("email")(_validate_email)


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    full_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    role: UserRole | None = None
    home_lat: float | None = None
    home_lng: float | None = None
    home_label: str | None = Field(default=None, max_length=120)
    vehicle_make: str | None = Field(default=None, max_length=60)
    vehicle_model: str | None = Field(default=None, max_length=60)
    vehicle_color: str | None = Field(default=None, max_length=40)
    vehicle_plate: str | None = Field(default=None, max_length=20)
    seats_offered: int | None = Field(default=None, ge=1, le=8)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse