from __future__ import annotations

from fastapi import FastAPI

from app.database import create_db_and_tables
from app.health import router as health_router
from app.routers.drivers import router as drivers_router
from app.routers.match import router as match_router

app = FastAPI(title="Matching Service")

app.include_router(health_router)
app.include_router(match_router)
app.include_router(drivers_router)


@app.on_event("startup")
def startup() -> None:
    create_db_and_tables()


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "matching-service", "status": "ok"}
