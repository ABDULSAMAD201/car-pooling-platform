from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.auth_schemas import AuthResponse, LoginRequest, RegisterRequest, UserResponse, UserUpdate
from app.database import get_session
from app.models import User
from app.security import create_access_token, decode_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

bearer_scheme = HTTPBearer(auto_error=False)

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated. Please sign in again.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> User:
    """Resolve the bearer token on the request into the current user."""
    if credentials is None or not credentials.credentials:
        raise _CREDENTIALS_ERROR

    subject = decode_access_token(credentials.credentials)
    if subject is None:
        raise _CREDENTIALS_ERROR

    try:
        user_id = UUID(subject)
    except ValueError:
        raise _CREDENTIALS_ERROR

    user = session.get(User, user_id)
    if user is None:
        raise _CREDENTIALS_ERROR
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> User | None:
    """Like `get_current_user` but returns None instead of raising.

    Used by routes that keep working for anonymous callers while scoping to the
    account when a valid token is present.
    """
    if credentials is None or not credentials.credentials:
        return None

    subject = decode_access_token(credentials.credentials)
    if subject is None:
        return None

    try:
        user_id = UUID(subject)
    except ValueError:
        return None

    return session.get(User, user_id)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, session: Session = Depends(get_session)) -> AuthResponse:
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        email=payload.email,
        full_name=payload.full_name.strip(),
        phone=payload.phone.strip(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    return AuthResponse(access_token=create_access_token(str(user.id)), user=UserResponse.from_user(user))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)) -> AuthResponse:
    user = session.exec(select(User).where(User.email == payload.email)).first()

    # Same message and comparable work for both branches so the response does
    # not reveal whether an email is registered.
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    return AuthResponse(access_token=create_access_token(str(user.id)), user=UserResponse.from_user(user))


@router.get("/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.from_user(current_user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> UserResponse:
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(current_user, field, value)
    current_user.updated_at = datetime.now(timezone.utc)

    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return UserResponse.from_user(current_user)

class PublicProfile(BaseModel):
    """What one signed-in user may see about another: a name and a car, nothing private."""

    id: str
    full_name: str = ""
    vehicle: str = ""
    vehicle_plate: str = ""


@router.get("/users/lookup", response_model=list[PublicProfile])
def lookup_users(
    ids: str = Query(..., description="Comma-separated user ids (max 50)."),
    _: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[PublicProfile]:
    wanted: list[UUID] = []
    for raw in ids.split(",")[:50]:
        try:
            wanted.append(UUID(raw.strip()))
        except ValueError:
            continue
    if not wanted:
        return []

    users = session.exec(select(User).where(User.id.in_(wanted))).all()
    return [
        PublicProfile(
            id=str(user.id),
            full_name=user.full_name,
            vehicle=" ".join(
                part for part in (user.vehicle_color, user.vehicle_make, user.vehicle_model) if part
            ),
            vehicle_plate=user.vehicle_plate,
        )
        for user in users
    ]
