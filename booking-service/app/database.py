from __future__ import annotations

from collections.abc import Generator

from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings


def get_engine() -> Engine:
    db_url = settings.DATABASE_URL
    engine_kwargs: dict[str, object] = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }
    if db_url.startswith("sqlite"):
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(db_url, **engine_kwargs)


engine = get_engine()


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
