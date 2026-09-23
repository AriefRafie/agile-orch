FROM python:3.11-slim

WORKDIR /app

# System dependencies for WeasyPrint PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 \
    libffi-dev libcairo2 && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-dev.txt
RUN pip install alembic

# Copy project files
COPY . .

# Start the application
# --timeout-graceful-shutdown: long-lived SSE connections (/notifications/stream)
# otherwise block --reload restarts indefinitely while a browser tab is open.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--timeout-graceful-shutdown", "3"]