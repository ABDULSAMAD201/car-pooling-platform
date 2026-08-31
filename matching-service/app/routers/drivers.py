from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import DriverAvailability
from app.schemas import DriverAvailabilityCreate, DriverAvailabilityResponse

router = APIRouter(prefix="/drivers", tags=["drivers"])


@router.post("/availability", response_model=DriverAvailabilityResponse, status_code=status.HTTP_201_CREATED)
async def register_driver_availability(payload: DriverAvailabilityCreate, session: Session = Depends(get_session)) -> DriverAvailabilityResponse:
    availability = session.exec(
        select(DriverAvailability).where(DriverAvailability.driver_id == payload.driver_id)
    ).first()

    if availability is None:
        availability = DriverAvailability(
            driver_id=payload.driver_id,
            current_lat=payload.current_lat,
            current_lng=payload.current_lng,
            is_active=True,
            available_from=payload.available_from,
            available_to=payload.available_to,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(availability)
    else:
        availability.current_lat = payload.current_lat
        availability.current_lng = payload.current_lng
        availability.is_active = True
        availability.available_from = payload.available_from
        availability.available_to = payload.available_to
        availability.updated_at = datetime.utcnow()

    session.commit()
    session.refresh(availability)
    return DriverAvailabilityResponse.from_driver(availability)


@router.get("/availability", response_model=list[DriverAvailabilityResponse])
async def list_active_drivers(
    active_only: bool = Query(default=True),
    session: Session = Depends(get_session),
) -> list[DriverAvailabilityResponse]:
    statement = select(DriverAvailability)
    if active_only:
        statement = statement.where(DriverAvailability.is_active == True)
    statement = statement.order_by(DriverAvailability.created_at.desc())
    drivers = session.exec(statement).all()
    return [DriverAvailabilityResponse.from_driver(driver) for driver in drivers]
