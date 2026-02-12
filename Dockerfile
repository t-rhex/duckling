# ============================================
# Duckling — Orchestrator Dockerfile
# ============================================
FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Application code (copy first so pip install can find the package)
COPY . .

# Python deps
RUN pip install --no-cache-dir -e ".[dev]"

EXPOSE 8000

CMD ["uvicorn", "orchestrator.app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
