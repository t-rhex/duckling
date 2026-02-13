"""
Demo Auth Service — a simple FastAPI auth service.

This is the demo repo that the Duckling agent will operate on.
It has intentionally flaky tests and bugs for the agent to fix.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

app = FastAPI(title="Auth Service", version="0.1.0")

# ── In-memory "database" ─────────────────────────────────────────

_users: dict[str, dict] = {}
_sessions: dict[str, dict] = {}


# ── Models ────────────────────────────────────────────────────────


class UserCreate(BaseModel):
    email: str = Field(..., description="User email")
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: str


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    session_token: str
    expires_at: str
    user_id: str


class TokenRefreshRequest(BaseModel):
    session_token: str


# ── Helpers ───────────────────────────────────────────────────────


def hash_password(password: str) -> str:
    """Hash a password with SHA256. (Demo only — use bcrypt in production.)"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash."""
    return hash_password(password) == hashed


def create_session(user_id: str, duration_hours: int = 24) -> dict:
    """Create a new session token."""
    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
    session = {
        "token": token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
    }
    _sessions[token] = session
    return session


def validate_session(token: str) -> Optional[dict]:
    """Validate a session token and return the session if valid."""
    session = _sessions.get(token)
    if not session:
        return None

    # BUG: This comparison is broken — it compares string to datetime
    # The agent should fix this to properly parse the ISO string
    expires_at = session["expires_at"]
    if expires_at < datetime.now(timezone.utc).isoformat():
        del _sessions[token]
        return None

    return session


# ── Routes ────────────────────────────────────────────────────────


@app.post("/auth/register", response_model=UserResponse, status_code=201)
async def register(body: UserCreate):
    """Register a new user."""
    # Check if email already exists
    for user in _users.values():
        if user["email"] == body.email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": body.email,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _users[user_id] = user

    return UserResponse(
        id=user_id,
        email=user["email"],
        name=user["name"],
        created_at=user["created_at"],
    )


@app.post("/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    """Login and receive a session token."""
    # Find user by email
    user = None
    for u in _users.values():
        if u["email"] == body.email:
            user = u
            break

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    session = create_session(user["id"])

    return LoginResponse(
        session_token=session["token"],
        expires_at=session["expires_at"],
        user_id=user["id"],
    )


@app.post("/auth/refresh", response_model=LoginResponse)
async def refresh_token(body: TokenRefreshRequest):
    """Refresh an existing session token."""
    session = validate_session(body.session_token)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    # Delete old session
    del _sessions[body.session_token]

    # Create new session
    new_session = create_session(session["user_id"])

    return LoginResponse(
        session_token=new_session["token"],
        expires_at=new_session["expires_at"],
        user_id=session["user_id"],
    )


@app.get("/auth/me", response_model=UserResponse)
async def get_current_user(token: str):
    """Get the current user's profile."""
    session = validate_session(token)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    user = _users.get(session["user_id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        created_at=user["created_at"],
    )


@app.delete("/auth/logout")
async def logout(token: str):
    """Logout and invalidate the session token."""
    if token in _sessions:
        del _sessions[token]
    # BUG: Should return a proper response, currently returns None
    # which causes a 200 with null body


@app.get("/health")
async def health():
    """Health check."""
    return {
        "status": "healthy",
        "users_count": len(_users),
        "active_sessions": len(_sessions),
    }
