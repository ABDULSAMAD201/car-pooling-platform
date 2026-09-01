import uuid
from datetime import datetime
from enum import Enum

from sqlmodel import SQLModel, Field


class NotificationStatus(str, Enum):
    sent = "sent"
    failed = "failed"


class Notification(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: str = Field(index=True)
    ride_id: str = Field(index=True)
    message: str
    channel: str = Field(default="log")  # swap for "sms"/"email"/"push" later
    status: NotificationStatus = Field(default=NotificationStatus.sent)
    created_at: datetime = Field(default_factory=datetime.utcnow)