from fastapi import FastAPI

from app.database import create_db_and_tables
from app.routers import notify
from app.health import router as health_router

# No CORS middleware here on purpose — Notify is internal-only,
# called by Booking Service, never directly by the frontend.
app = FastAPI(title="Notify Service")

app.include_router(notify.router)
app.include_router(health_router)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()