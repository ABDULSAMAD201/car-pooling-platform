from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def create_match_request(ride_id: str, origin: dict[str, float], destination: dict[str, float], time: str) -> None:
    payload = {
        "ride_id": ride_id,
        "origin": origin,
        "destination": destination,
        "time": time,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(f"{settings.MATCHING_SERVICE_URL}/match", json=payload)
            response.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.warning("Matching service call failed for ride %s: %s", ride_id, exc)
