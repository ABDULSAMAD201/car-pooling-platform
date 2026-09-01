from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlmodel import Session, text

from app.database import engine

router = APIRouter()


@router.get("/health")
def health_check():
    try:
        with Session(engine) as session:
            session.exec(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unhealthy"})