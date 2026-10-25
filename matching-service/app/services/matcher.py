from __future__ import annotations

import math


def haversine_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two lat/lng points, in kilometers."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = (math.sin(d_phi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def calculate_bearing(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Initial compass bearing from point 1 to point 2, in degrees (0-360)."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_lambda = math.radians(lng2 - lng1)
    x = math.sin(d_lambda) * math.cos(phi2)
    y = (math.cos(phi1) * math.sin(phi2)
         - math.sin(phi1) * math.cos(phi2) * math.cos(d_lambda))
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def bearing_difference(bearing1: float, bearing2: float) -> float:
    """Smallest angular difference between two bearings, 0-180 degrees."""
    diff = abs(bearing1 - bearing2) % 360
    return diff if diff <= 180 else 360 - diff


MAX_PICKUP_RADIUS_KM = 5.0
MAX_BEARING_DIFF_DEGREES = 45.0
DISTANCE_WEIGHT = 1.0
DIRECTION_WEIGHT = 2.0


def find_match(ride_request: dict, available_drivers: list[dict]) -> dict | None:
    rider_bearing = calculate_bearing(
        ride_request["origin"]["lat"], ride_request["origin"]["lng"],
        ride_request["destination"]["lat"], ride_request["destination"]["lng"],
    )

    candidates = []
    for driver in available_drivers:
        pickup_km = haversine_distance_km(
            driver["current_lat"], driver["current_lng"],
            ride_request["origin"]["lat"], ride_request["origin"]["lng"],
        )
        if pickup_km > MAX_PICKUP_RADIUS_KM:
            continue

        driver_bearing = calculate_bearing(
            driver["current_lat"], driver["current_lng"],
            driver["destination_lat"], driver["destination_lng"],
        )
        bearing_diff = bearing_difference(rider_bearing, driver_bearing)
        if bearing_diff > MAX_BEARING_DIFF_DEGREES:
            continue

        score = (pickup_km * DISTANCE_WEIGHT) + ((bearing_diff / 180) * DIRECTION_WEIGHT)
        candidates.append({"driver": driver, "score": score})

    if not candidates:
        return None

    best = min(candidates, key=lambda c: c["score"])
    return {"driver_id": best["driver"]["driver_id"], "score": best["score"]}


def score_driver(ride_request: dict, driver: dict) -> dict | None:
    """Evaluate one driver against one ride.

    Returns the pickup distance, bearing difference and combined score, or None
    when the driver is outside the pickup radius or heading a different way.
    Used when a driver volunteers for a ride so their interest can be ranked
    against the other interested drivers.
    """
    pickup_km = haversine_distance_km(
        driver["current_lat"], driver["current_lng"],
        ride_request["origin"]["lat"], ride_request["origin"]["lng"],
    )
    if pickup_km > MAX_PICKUP_RADIUS_KM:
        return None

    rider_bearing = calculate_bearing(
        ride_request["origin"]["lat"], ride_request["origin"]["lng"],
        ride_request["destination"]["lat"], ride_request["destination"]["lng"],
    )
    driver_bearing = calculate_bearing(
        driver["current_lat"], driver["current_lng"],
        driver["destination_lat"], driver["destination_lng"],
    )
    bearing_diff = bearing_difference(rider_bearing, driver_bearing)
    if bearing_diff > MAX_BEARING_DIFF_DEGREES:
        return None

    score = (pickup_km * DISTANCE_WEIGHT) + ((bearing_diff / 180) * DIRECTION_WEIGHT)
    return {
        "driver_id": driver["driver_id"],
        "score": score,
        "pickup_km": pickup_km,
        "bearing_diff": bearing_diff,
    }


def rank_drivers(ride_request: dict, available_drivers: list[dict]) -> list[dict]:
    """Every eligible driver for a ride, best score first.

    Ties are broken by driver_id so the ordering is stable across requests.
    """
    scored = [
        result
        for result in (score_driver(ride_request, driver) for driver in available_drivers)
        if result is not None
    ]
    scored.sort(key=lambda item: (item["score"], item["driver_id"]))
    return scored