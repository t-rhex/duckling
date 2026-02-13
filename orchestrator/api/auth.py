"""API authentication middleware for Duckling."""

from __future__ import annotations

from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from orchestrator.services.config import get_settings

_bearer = HTTPBearer(auto_error=False)


async def require_api_key(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> str:
    """Validate the bearer token against DUCKLING_API_KEY.

    If DUCKLING_API_KEY is empty (dev mode), authentication is skipped.
    """
    settings = get_settings()
    api_key = settings.api_key

    # Dev mode: no key configured = no auth required
    if not api_key:
        return "anonymous"

    if not credentials or credentials.credentials != api_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials
