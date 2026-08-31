from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import Ride, RideStatus
from app.schemas import RideCreateRequest, RideResponse, RideStatusUpdate
from app.services.matching_client import create_match_request
from app.services.notify_client import send_notification

router = APIRouter(prefix="/rides", tags=["rides"])


def _serialize_ride(ride: Ride) -> RideResponse:
    return RideResponse.from_ride(ride)


@router.post("", response_model=RideResponse, status_code=status.HTTP_201_CREATED)
async def create_ride(payload: RideCreateRequest, session: Session = Depends(get_session)) -> RideResponse:
    ride = Ride(
        user_id=payload.user_id,
        origin_lat=payload.origin.lat,
        origin_lng=payload.origin.lng,
        destination_lat=payload.destination.lat,
        destination_lng=payload.destination.lng,
        requested_time=payload.time,
        status=RideStatus.requested,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    session.add(ride)
    session.commit()
    session.refresh(ride)

    await create_match_request(
        ride_id=str(ride.id),
        origin={"lat": ride.origin_lat, "lng": ride.origin_lng},
        destination={"lat": ride.destination_lat, "lng": ride.destination_lng},
        time=ride.requested_time.isoformat(),
    )

    return _serialize_ride(ride)


@router.get("/{ride_id}", response_model=RideResponse)
async def get_ride(ride_id: UUID, session: Session = Depends(get_session)) -> RideResponse:
    ride = session.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")
    return _serialize_ride(ride)


@router.get("", response_model=list[RideResponse])
async def list_rides(user_id: str = Query(...), session: Session = Depends(get_session)) -> list[RideResponse]:
    statement = select(Ride).where(Ride.user_id == user_id).order_by(Ride.created_at.desc())
    rides = session.exec(statement).all()
    return [_serialize_ride(ride) for ride in rides]


@router.patch("/{ride_id}/cancel", response_model=RideResponse)
async def cancel_ride(ride_id: UUID, session: Session = Depends(get_session)) -> RideResponse:
    ride = session.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")
    if ride.status == RideStatus.completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Completed rides cannot be cancelled")

    ride.status = RideStatus.cancelled
    ride.updated_at = datetime.now(timezone.utc)
    session.add(ride)
    session.commit()
    session.refresh(ride)

    await send_notification(str(ride.user_id), str(ride.id), f"Ride {ride.id} has been cancelled.")
    return _serialize_ride(ride)


@router.patch("/{ride_id}/status", response_model=RideResponse)
async def update_ride_status(ride_id: UUID, payload: RideStatusUpdate, session: Session = Depends(get_session)) -> RideResponse:
    ride = session.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")

    ride.status = payload.status
    if payload.matched_driver_id is not None:
        ride.matched_driver_id = payload.matched_driver_id
    if payload.matched_ride_id is not None:
        ride.matched_ride_id = payload.matched_ride_id
    ride.updated_at = datetime.now(timezone.utc)
    session.add(ride)
    session.commit()
    session.refresh(ride)

    await send_notification(str(ride.user_id), str(ride.id), f"Ride {ride.id} status updated to {ride.status.value}.")
    return _serialize_ride(ride)
