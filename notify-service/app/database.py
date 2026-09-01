from sqlmodel import SQLModel, create_engine, Session

from app.config import settings

engine = create_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=280,
)


def create_db_and_tables() -> None:
    """Creates tables from our SQLModel classes if they don't exist yet.
    No Alembic needed for a service this small — if the schema grows
    later, add Alembic the same way Booking/Matching did."""
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session