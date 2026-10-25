from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import DriverAvailability, MatchResult
from app.schemas import DriverCandidate, MatchDecision, MatchResultResponse, RideLookup, RideRequest
from app.services.matcher import find_match, rank_drivers

router = APIRouter(tags=["match"])


def _active_drivers(session: Session) -> list[dict]:
    """Every driver currently online, in the shape the matcher expects."""
    driver_rows = session.exec(
        select(DriverAvailability).where(DriverAvailability.is_active == True)
    ).all()
    return [
        {
            "driver_id": driver.driver_id,
            "current_lat": driver.current_lat,
            "current_lng": driver.current_lng,
            "destination_lat": driver.destination_lat,
            "destination_lng": driver.destination_lng,
            "available_from": driver.available_from,
            "available_to": driver.available_to,
        }
        for driver in driver_rows
    ]


@router.post("/match", response_model=MatchDecision)
async def create_match(payload: RideRequest, session: Session = Depends(get_session)) -> MatchDecision:
    """Record how well a new ride fits, without assigning a driver.

    Assignment is a human decision now: drivers volunteer and the rider picks
    one. We still record a MatchResult so the ride detail page can show the best
    available score, but nothing is written back to the booking service, so a
    ride never silently acquires a driver.
    """
    match = find_match(payload.model_dump(), _active_drivers(session))

    match_record = MatchResult(
        ride_id=payload.ride_id,
        driver_id=match["driver_id"] if match else None,
        score=match["score"] if match else None,
        created_at=datetime.utcnow(),
    )
    session.add(match_record)
    session.commit()
    session.refresh(match_record)

    return MatchDecision(
        matched=match is not None,
        driver_id=match["driver_id"] if match else None,
        match_id=match_record.id,
    )


@router.post("/match/candidates", response_model=list[DriverCandidate])
async def list_candidates(
    payload: RideLookup,
    session: Session = Depends(get_session),
) -> list[DriverCandidate]:
    """Rank the currently online drivers for a ride, best fit first.

    Read-only: this never touches the ride and never reserves anybody. The
    booking service uses it to show a driver their eligibility before they
    volunteer, and to score their interest after they do.
    """
    candidates = rank_drivers(payload.model_dump(), _active_drivers(session))
    return [DriverCandidate(**candidate) for candidate in candidates]


@router.get("/matches/{ride_id}", response_model=MatchResultResponse)
async def get_match_result(ride_id: str, session: Session = Depends(get_session)) -> MatchResultResponse:
    match_record = session.exec(select(MatchResult).where(MatchResult.ride_id == ride_id)).first()
    if match_record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    return MatchResultResponse.from_match(match_record)