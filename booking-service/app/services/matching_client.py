from __future__ import annotations

import logging

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
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(f"{settings.MATCHING_SERVICE_URL}/match", json=payload)
            response.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        logger.warning("Matching service call failed for ride %s: %s", ride_id, exc)


async def fetch_candidates(
    origin: dict[str, float], destination: dict[str, float]
) -> list[dict[str, float | str]]:
    """Rank online drivers for a ride. Returns [] if the service is unreachable.

    Eligibility is advisory: a failure here must not stop a driver from
    volunteering, so callers fall back to treating the ride as unranked.
    """
    payload = {"origin": origin, "destination": destination}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{settings.MATCHING_SERVICE_URL}/match/candidates", json=payload
            )
            response.raise_for_status()
            body = response.json()
    except (httpx.HTTPError, httpx.TimeoutException, ValueError) as exc:
        logger.warning("Could not fetch driver candidates: %s", exc)
        return []

    return body if isinstance(body, list) else []
