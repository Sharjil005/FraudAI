# ---- FraudShield AI :: backend image ----------------------------------------
# Python 3.12 has prebuilt wheels for numpy / scikit-learn / Pillow, so the
# build needs no compiler and stays fast.
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# tesseract-ocr powers document OCR. The app degrades gracefully without it,
# but the image includes it so the Document Scanner is fully functional.
# libpq5 is the runtime library psycopg[binary] links against.
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
        tesseract-ocr \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Requirements are copied first so dependency layers cache across code edits.
COPY requirements.txt ./
RUN pip install --requirement requirements.txt

COPY app ./app
COPY scripts ./scripts
COPY tests ./tests
COPY seed.py pytest.ini ./

# Model artefacts and uploads are written at runtime; create them up front and
# hand ownership to the unprivileged user the container runs as.
RUN mkdir -p /app/uploads /app/app/ml/artifacts \
    && useradd --create-home --uid 10001 fraudshield \
    && chown -R fraudshield:fraudshield /app
USER fraudshield

ENV UPLOAD_DIRECTORY=/app/uploads \
    MODEL_DIRECTORY=/app/app/ml/artifacts \
    ENVIRONMENT=production \
    DEBUG=False

EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=90s --retries=5 \
    CMD curl --fail --silent http://127.0.0.1:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
