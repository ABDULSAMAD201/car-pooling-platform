from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.database import get_session

# In-memory SQLite for tests — never touches your real Neon DB
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


def get_session_override():
    with Session(engine) as session:
        yield session


app.dependency_overrides[get_session] = get_session_override
client = TestClient(app)


def setup_module():
    SQLModel.metadata.create_all(engine)


def test_send_notification():
    response = client.post(
        "/notify",
        json={"user_id": "u1", "ride_id": "r1", "message": "Your ride is confirmed"},
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_get_notifications():
    client.post(
        "/notify",
        json={"user_id": "u2", "ride_id": "r2", "message": "Your ride was cancelled"},
    )
    response = client.get("/notifications/u2")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["message"] == "Your ride was cancelled"