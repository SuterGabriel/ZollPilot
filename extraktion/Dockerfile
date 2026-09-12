# syntax=docker/dockerfile:1
# Der Extraktionsdienst: Python, Tesseract, kein Node, kein Modell.
#
# Drei Stufen:
#   basis   Laufzeit mit Tesseract (deu, eng) und den Abhängigkeiten aus uv.lock
#   test    dazu Testabhängigkeiten, Tests und Testbelege; pytest läuft beim Build.
#           Für die Entwicklung auf Windows der Weg zu OCR-Tests und zur
#           Bewertung (docs/EXTRAKTION.md):
#             docker build --target test -t zollpilot-extraktion:test -f extraktion/Dockerfile .
#   final   das Image für compose.yml, ohne Tests, als unprivilegierter Nutzer
#
# Build-Kontext ist die Repo-Wurzel (.dockerignore lässt nur extraktion/ und
# testdaten/ hinein), weil die Bewertung testdaten/belege/ neben dem Paket
# erwartet — dieselbe Ordnung wie im Repo.

FROM python:3.13-slim AS basis
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/repo/extraktion/.venv
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-deu tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.12.12 /uv /uvx /bin/
WORKDIR /repo/extraktion
COPY extraktion/pyproject.toml extraktion/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY extraktion/zollpilot_extraktion ./zollpilot_extraktion
RUN uv sync --frozen --no-dev

FROM basis AS test
# Node und das Regelwerk dazu, damit die Entscheidung je Akte auch hier
# geprüft wird (src/cli.mjs) — sonst bliebe die Bewertung im Container blind.
RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json rules.yaml pflichtmatrix.yaml zustaendigkeiten.yaml /repo/
COPY src /repo/src
RUN cd /repo && npm ci --omit=dev --ignore-scripts
RUN uv sync --frozen
COPY extraktion/tests ./tests
COPY testdaten /repo/testdaten
RUN uv run --no-sync pytest

FROM basis AS final
RUN useradd --system --uid 10001 --no-create-home zollpilot
USER zollpilot
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=5s --start-period=10s --retries=20 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if b'\"ok\"' in urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=3).read() else 1)"]
CMD ["/repo/extraktion/.venv/bin/uvicorn", "zollpilot_extraktion.dienst:app", "--host", "0.0.0.0", "--port", "8080"]
