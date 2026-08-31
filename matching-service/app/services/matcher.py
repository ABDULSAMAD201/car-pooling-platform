from __future__ import annotations


def find_match(ride_request: dict, available_drivers: list[dict]) -> dict | None:
    """
    PLACEHOLDER matcher — replace with real geospatial matching algorithm later.
    Currently just returns the first active driver, or None if none available.
    """
    if not available_drivers:
        return None

    driver = available_drivers[0]
    return {
        "driver_id": driver.get("driver_id"),
        "current_lat": driver.get("current_lat"),
        "current_lng": driver.get("current_lng"),
        "score": 1.0,
    }
