from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def update_booking_status(ride_id: str, *, matched: bool, driver_id: str | None, match_id: str | None) -> None:
    payload = {
        "status": "matched" if matched else "requested",
        "matched_driver_id": driver_id,
        "matched_ride_id": match_id,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.patch(f"{settings.BOOKING_SERVICE_URL}/rides/{ride_id}/status", json=payload)
            response.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.warning("Booking callback failed for ride %s: %s", ride_id, exc)
