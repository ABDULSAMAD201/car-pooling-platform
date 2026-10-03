from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlmodel import SQLModel, Field


class NotificationStatus(str, Enum):
    sent = "sent"
    failed = "failed"


class Notification(SQLModel, table=True):
    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
    )

    user_id: str = Field(index=True)
    ride_id: str = Field(index=True)
    message: str

    channel: str = Field(
        default="log"
    )  # swap for "sms"/"email"/"push" later

    status: NotificationStatus = Field(
        default=NotificationStatus.sent
    )

    # Always store timezone-aware UTC timestamps
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
