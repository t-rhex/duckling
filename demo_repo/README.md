# Auth Service (Demo)

A simple FastAPI auth service used to demonstrate the Duckling autonomous coding platform.

## Known Issues (for Duckling to fix!)

1. **Flaky test: `test_session_expiry`** — The session expiry comparison in `validate_session()` uses string comparison instead of proper datetime parsing
2. **Flaky test: `test_rate_limiter_concurrent`** — The `TokenBucket` has a race condition where concurrent requests can both consume the same token
3. **Bug: `test_logout_success`** — The `logout()` endpoint doesn't return a response body

## Running Tests

```bash
pip install -e ".[dev]"
pytest -v
```

## Running the Server

```bash
uvicorn app.main:app --reload
```
