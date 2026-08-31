from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import DriverAvailability, MatchResult
from app.schemas import MatchDecision, MatchResultResponse, RideRequest
from app.services.booking_client import update_booking_status
from app.services.matcher import find_match

router = APIRouter(tags=["match"])


@router.post("/match", response_model=MatchDecision)
async def create_match(payload: RideRequest, session: Session = Depends(get_session)) -> MatchDecision:
    driver_rows = session.exec(
        select(DriverAvailability).where(DriverAvailability.is_active == True)
    ).all()
    available_drivers = [
        {
            "driver_id": driver.driver_id,
            "current_lat": driver.current_lat,
            "current_lng": driver.current_lng,
            "available_from": driver.available_from,
            "available_to": driver.available_to,
        }
        for driver in driver_rows
    ]

    match = find_match(payload.model_dump(), available_drivers)
    matched = match is not None
    match_record = MatchResult(
        ride_id=payload.ride_id,
        driver_id=match["driver_id"] if matched else None,
        score=match["score"] if matched else None,
        created_at=datetime.utcnow(),
    )
    session.add(match_record)
    session.commit()
    session.refresh(match_record)

    await update_booking_status(
        payload.ride_id,
        matched=matched,
        driver_id=match["driver_id"] if matched else None,
        match_id=str(match_record.id) if match_record else None,
    )

    return MatchDecision(
        matched=matched,
        driver_id=match["driver_id"] if matched else None,
        match_id=match_record.id if match_record else None,
    )


@router.get("/matches/{ride_id}", response_model=MatchResultResponse)
async def get_match_result(ride_id: str, session: Session = Depends(get_session)) -> MatchResultResponse:
    match_record = session.exec(select(MatchResult).where(MatchResult.ride_id == ride_id)).first()
    if match_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    return MatchResultResponse.from_match(match_record)
