from __future__ import annotations
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_db_and_tables
from app.health import router as health_router
from app.routers.auth import router as auth_router
from app.routers.rides import router as rides_router

app = FastAPI(title="Booking Service")


@app.get("/cpu-burn")
def cpu_burn():
    """TEMPORARY — only for demonstrating CPU-based autoscaling.
    Remove this before any real deployment."""
    end = time.time() + 0.5
    x = 0
    while time.time() < end:
        x += 1
    return {"burned": x}

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(rides_router)


@app.on_event("startup")
def startup() -> None:
    create_db_and_tables()


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "booking-service", "status": "ok"}
