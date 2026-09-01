import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models import NotificationStatus


class NotifyRequest(BaseModel):
    user_id: str
    ride_id: str
    message: str


class NotifyResponse(BaseModel):
    ok: bool


class NotificationRead(BaseModel):
    id: uuid.UUID
    user_id: str
    ride_id: str
    message: str
    channel: str
    status: NotificationStatus
    created_at: datetime