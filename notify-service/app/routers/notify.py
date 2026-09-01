from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.database import get_session
from app.models import Notification
from app.schemas import NotifyRequest, NotifyResponse, NotificationRead

router = APIRouter()


@router.post("/notify", response_model=NotifyResponse)
def send_notification(payload: NotifyRequest, session: Session = Depends(get_session)):
    # "Sending" is just a log line + a DB row for now.
    # Swap this print for a real SMS/email/push call later —
    # nothing else in this file needs to change when you do.
    print(f"[NOTIFY] user={payload.user_id} ride={payload.ride_id} :: {payload.message}")

    notification = Notification(
        user_id=payload.user_id,
        ride_id=payload.ride_id,
        message=payload.message,
    )
    session.add(notification)
    session.commit()
    session.refresh(notification)

    return NotifyResponse(ok=True)


@router.get("/notifications/{user_id}", response_model=list[NotificationRead])
def get_notifications(user_id: str, session: Session = Depends(get_session)):
    statement = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    )
    return session.exec(statement).all()