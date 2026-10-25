from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel import Session, select

from app.database import get_session
from app.models import Ride, RideInterest, RideStatus, User, UserRole
from app.routers.auth import get_current_user, get_optional_user
from app.schemas import (
    DriverCandidate,
    InterestResponse,
    OpenRequestResponse,
    PickDriverRequest,
    RideCreateRequest,
    RideResponse,
)
from app.services.matching_client import create_match_request, fetch_candidates
from app.services.notify_client import send_notification

router = APIRouter(prefix="/rides", tags=["rides"])

# A ride can only be worked on while it is still waiting for somebody to pick
# it up. Once a driver is chosen the pool is closed.
OPEN_STATUSES = (RideStatus.requested,)


def _serialize_ride(ride: Ride) -> RideResponse:
    return RideResponse.from_ride(ride)


def _get_ride_or_404(ride_id: UUID, session: Session) -> Ride:
    ride = session.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")
    return ride


def _require_owner(ride: Ride, current_user: User) -> None:
    """Riders may only act on rides they booked."""
    if ride.user_id != str(current_user.id):
        # Deliberately 404 rather than 403 so one rider cannot probe for the
        # existence of another rider's trips by guessing ids.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")


def _lookup_users(session: Session, user_ids: set[str]) -> dict[str, User]:
    """Fetch users by their string ids, skipping any that are not valid UUIDs.

    The id columns are UUIDs while rides and interests store them as strings,
    so every lookup has to convert before it can hit the database.
    """
    uuid_ids: list[UUID] = []
    for value in user_ids:
        try:
            uuid_ids.append(UUID(value))
        except ValueError:
            # A malformed stored id can never resolve to a user; ignore it
            # rather than failing the whole request.
            continue

    if not uuid_ids:
        return {}
    found = session.exec(select(User).where(User.id.in_(uuid_ids))).all()
    return {str(user.id): user for user in found}


def _require_driver(current_user: User) -> None:
    if current_user.role not in (UserRole.driver, UserRole.both):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only drivers can respond to ride requests.",
        )


def _is_open(ride: Ride) -> bool:
    return ride.status in OPEN_STATUSES


@router.post("", response_model=RideResponse, status_code=status.HTTP_201_CREATED)
async def create_ride(
    payload: RideCreateRequest,
    session: Session = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> RideResponse:
    # When a caller is signed in we ignore any user_id in the body and attribute
    # the ride to the account, so one user cannot book on another's behalf.
    # Anonymous callers keep the original user_id behaviour.
    owner_id = str(current_user.id) if current_user is not None else payload.user_id

    ride = Ride(
        user_id=owner_id,
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

    # Records how well the ride fits the drivers who are online, but assigns
    # nobody: the rider picks from whoever expresses interest.
    await create_match_request(
        ride_id=str(ride.id),
        origin={"lat": ride.origin_lat, "lng": ride.origin_lng},
        destination={"lat": ride.destination_lat, "lng": ride.destination_lng},
        time=ride.requested_time.isoformat(),
    )

    return _serialize_ride(ride)


@router.get("/requests", response_model=list[OpenRequestResponse])
async def list_open_requests(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[OpenRequestResponse]:
    """Unassigned rides a driver can pick up, newest first.

    Riders do not see their own requests here — they manage those from their
    own ride list — and neither does anyone else.
    """
    _require_driver(current_user)

    statement = (
        select(Ride)
        .where(Ride.status.in_(OPEN_STATUSES))
        .where(Ride.user_id != str(current_user.id))
        .order_by(Ride.created_at.desc())
    )
    rides = session.exec(statement).all()

    # One query for every rider name rather than one per ride.
    riders = _lookup_users(session, {ride.user_id for ride in rides})

    return [
        OpenRequestResponse.from_ride(
            ride, riders[ride.user_id].full_name if ride.user_id in riders else ""
        )
        for ride in rides
    ]


@router.get("/mine", response_model=list[RideResponse])
async def list_my_rides(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[RideResponse]:
    """Every ride belonging to the signed-in account, newest first."""
    statement = (
        select(Ride)
        .where(Ride.user_id == str(current_user.id))
        .order_by(Ride.created_at.desc())
    )
    rides = session.exec(statement).all()
    return [_serialize_ride(ride) for ride in rides]


@router.get("/mine/interested", response_model=list[RideResponse])
async def list_rides_i_am_interested_in(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[RideResponse]:
    """Rides this driver has volunteered for, whether or not they got picked.

    Resolved with an explicit lookup rather than a join: `Ride.id` is a UUID
    column while `RideInterest.ride_id` is a string, so the two can never
    compare equal in SQL.
    """
    interests = session.exec(
        select(RideInterest)
        .where(RideInterest.driver_id == str(current_user.id))
        .order_by(RideInterest.created_at.desc())
    ).all()

    rides: list[Ride] = []
    for interest in interests:
        try:
            ride = session.get(Ride, UUID(interest.ride_id))
        except ValueError:
            # Interest rows pointing at an unparseable ride id are skipped.
            continue
        if ride is not None:
            rides.append(ride)

    return [_serialize_ride(ride) for ride in rides]


@router.get("/{ride_id}", response_model=RideResponse)
async def get_ride(ride_id: UUID, session: Session = Depends(get_session)) -> RideResponse:
    ride = _get_ride_or_404(ride_id, session)
    return _serialize_ride(ride)


@router.post("/{ride_id}/interest", response_model=InterestResponse, status_code=status.HTTP_201_CREATED)
async def express_interest(
    ride_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> InterestResponse:
    """A driver putting themselves forward for an unassigned ride.

    The rider still has to choose, so this only records intent. Repeating the
    call is a no-op rather than an error, which keeps a double-click or a
    retried request from looking like a failure.
    """
    _require_driver(current_user)
    ride = _get_ride_or_404(ride_id, session)

    if ride.user_id == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot volunteer for your own ride.",
        )
    if not _is_open(ride):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This ride is no longer available.",
        )

    existing = session.exec(
        select(RideInterest).where(
            RideInterest.ride_id == str(ride.id),
            RideInterest.driver_id == str(current_user.id),
        )
    ).first()
    if existing is not None:
        return InterestResponse.from_interest(existing)

    # Snapshot the fit score now so the rider's list can be ranked without
    # re-scoring every interested driver later.
    candidates = await fetch_candidates(
        origin={"lat": ride.origin_lat, "lng": ride.origin_lng},
        destination={"lat": ride.destination_lat, "lng": ride.destination_lng},
    )
    fit = next(
        (item for item in candidates if item.get("driver_id") == str(current_user.id)),
        None,
    )

    interest = RideInterest(
        ride_id=str(ride.id),
        driver_id=str(current_user.id),
        score=float(fit["score"]) if fit else None,
        pickup_km=float(fit["pickup_km"]) if fit else None,
        bearing_diff=float(fit["bearing_diff"]) if fit else None,
        created_at=datetime.now(timezone.utc),
    )
    session.add(interest)
    session.commit()
    session.refresh(interest)

    await send_notification(
        ride.user_id,
        str(ride.id),
        f"A driver is interested in your ride {ride.id}.",
    )
    return InterestResponse.from_interest(interest)


@router.delete("/{ride_id}/interest", status_code=status.HTTP_204_NO_CONTENT)
async def withdraw_interest(
    ride_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    """A driver pulling back before the rider chooses."""
    interest = session.exec(
        select(RideInterest).where(
            RideInterest.ride_id == str(ride_id),
            RideInterest.driver_id == str(current_user.id),
        )
    ).first()
    # Nothing to withdraw is the desired end state either way, so this is a
    # no-op rather than a 404.
    if interest is not None:
        session.delete(interest)
        session.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{ride_id}/candidates", response_model=list[DriverCandidate])
async def list_interested_drivers(
    ride_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[DriverCandidate]:
    """Drivers who volunteered for this ride, best fit first.

    Only the rider who booked the ride can see this list. Contact details are
    included because the rider is about to commit to one of these people.
    """
    ride = _get_ride_or_404(ride_id, session)
    _require_owner(ride, current_user)

    interests = session.exec(
        select(RideInterest).where(RideInterest.ride_id == str(ride.id))
    ).all()
    if not interests:
        return []

    driver_ids = {interest.driver_id for interest in interests}
    drivers = _lookup_users(session, driver_ids)

    candidates = [
        DriverCandidate.build(interest, drivers[interest.driver_id])
        for interest in interests
        if interest.driver_id in drivers
    ]
    # Unscored drivers (the matching service was unreachable when they
    # volunteered) sort last but are never hidden from the rider.
    candidates.sort(key=lambda item: (item.score is None, item.score if item.score is not None else 0.0))
    return candidates


@router.post("/{ride_id}/pick", response_model=RideResponse)
async def pick_driver(
    ride_id: UUID,
    payload: PickDriverRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RideResponse:
    """The rider choosing which interested driver takes their ride."""
    ride = _get_ride_or_404(ride_id, session)
    _require_owner(ride, current_user)

    if not _is_open(ride):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A driver has already been chosen for this ride.",
        )

    interest = session.exec(
        select(RideInterest).where(
            RideInterest.ride_id == str(ride.id),
            RideInterest.driver_id == payload.driver_id,
        )
    ).first()
    if interest is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That driver did not express interest in this ride.",
        )

    ride.matched_driver_id = payload.driver_id
    ride.status = RideStatus.confirmed
    ride.updated_at = datetime.now(timezone.utc)
    session.add(ride)
    session.commit()
    session.refresh(ride)

    driver = _lookup_users(session, {payload.driver_id}).get(payload.driver_id)
    driver_label = driver.full_name if driver is not None and driver.full_name else "Your driver"
    await send_notification(
        payload.driver_id,
        str(ride.id),
        f"You were chosen for ride {ride.id}. The rider will meet you at pickup.",
    )
    await send_notification(
        ride.user_id,
        str(ride.id),
        f"{driver_label} will take your ride {ride.id}.",
    )
    return _serialize_ride(ride)


@router.patch("/{ride_id}/cancel", response_model=RideResponse)
async def cancel_ride(
    ride_id: UUID,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RideResponse:
    """Cancel a ride. Only the rider who booked it, or its chosen driver, may."""
    ride = _get_ride_or_404(ride_id, session)
    is_owner = ride.user_id == str(current_user.id)
    is_chosen_driver = ride.matched_driver_id == str(current_user.id)
    if not (is_owner or is_chosen_driver):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found")

    if ride.status in (RideStatus.completed, RideStatus.cancelled):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This ride can no longer be cancelled.",
        )

    ride.status = RideStatus.cancelled
    ride.updated_at = datetime.now(timezone.utc)
    session.add(ride)
    session.commit()
    session.refresh(ride)

    # Whoever is not the person who cancelled still needs to know.
    recipient = ride.matched_driver_id or ride.user_id
    await send_notification(str(recipient), str(ride.id), f"Ride {ride.id} has been cancelled.")
    return _serialize_ride(ride)