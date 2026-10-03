from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone

# PBKDF2 parameters. 200k iterations is a reasonable 2024-era work factor;
# raise it as hardware improves.
_ITERATIONS = 200_000
_SALT_BYTES = 16
_TOKEN_TTL = timedelta(days=30)


def _secret_key() -> bytes:
    """Resolve the signing key from the environment.

    Falls back to a process-local random key so local development works out of
    the box. That fallback means tokens do not survive a restart and will not
    validate across replicas, so AUTH_SECRET_KEY must be set in any real
    deployment (docker-compose, k8s).
    """
    configured = os.environ.get("AUTH_SECRET_KEY", "").strip()
    if configured:
        return configured.encode("utf-8")
    global _EPHEMERAL_KEY
    try:
        return _EPHEMERAL_KEY
    except NameError:
        _EPHEMERAL_KEY = secrets.token_bytes(32)
        return _EPHEMERAL_KEY


def hash_password(password: str) -> str:
    """Hash a password as `pbkdf2_sha256$<iterations>$<salt>$<hash>`."""
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS)
    return "$".join(
        [
            "pbkdf2_sha256",
            str(_ITERATIONS),
            base64.b64encode(salt).decode("ascii"),
            base64.b64encode(digest).decode("ascii"),
        ]
    )


def verify_password(password: str, stored_hash: str) -> bool:
    """Constant-time check of a password against a stored hash."""
    try:
        algorithm, iterations_text, salt_text, digest_text = stored_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_text)
        expected = base64.b64decode(digest_text)
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, int(iterations_text)
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(candidate, expected)


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64d(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)


def create_access_token(user_id: str) -> str:
    """Create a signed token carrying the user id and an expiry."""
    # `exp` is stored as an epoch second so it compares cheaply.
    payload = {
        "sub": user_id,
        "exp": int((datetime.now(timezone.utc) + _TOKEN_TTL).timestamp()),
    }

    body = _b64e(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = _b64e(hmac.new(_secret_key(), body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{signature}"


def decode_access_token(token: str) -> str | None:
    """Validate a token and return its user id, or None if it is invalid/expired."""
    try:
        body, signature = token.split(".")
    except ValueError:
        return None

    expected_signature = _b64e(
        hmac.new(_secret_key(), body.encode("ascii"), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(signature, expected_signature):
        return None

    try:
        payload = json.loads(_b64d(body))
    except (ValueError, TypeError):
        return None

    if not isinstance(payload, dict):
        return None

    exp = payload.get("exp")
    subject = payload.get("sub")
    if not isinstance(exp, int) or not isinstance(subject, str):
        return None
    if exp < int(datetime.now(timezone.utc).timestamp()):
        return None
    return subject