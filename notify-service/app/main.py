import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_db_and_tables
from app.routers import notify
from app.health import router as health_router

app = FastAPI(title="Notify Service")

# The frontend reads notifications straight from this service, so browsers
# need CORS headers. Origins are configurable, matching Booking Service.
_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notify.router)
app.include_router(health_router)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()