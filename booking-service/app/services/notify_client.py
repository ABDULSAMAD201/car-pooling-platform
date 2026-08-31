from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def send_notification(user_id: str, ride_id: str, message: str) -> None:
    payload = {"user_id": user_id, "ride_id": ride_id, "message": message}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(f"{settings.NOTIFY_SERVICE_URL}/notify", json=payload)
            response.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.warning("Notify service call failed for ride %s: %s", ride_id, exc)
