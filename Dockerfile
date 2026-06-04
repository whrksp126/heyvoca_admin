# ── 1) React SPA 빌드 (node) ──
FROM node:20-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# vite outDir = ../app/static/spa → /build/app/static/spa
RUN npm run build

# ── 2) Flask 런타임 (python) ──
FROM python:3.11-slim

ENV TZ=Asia/Seoul \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && \
    apt-get install -y --no-install-recommends default-mysql-client tzdata && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# 빌드된 SPA 산출물을 이미지에 포함 (.dockerignore 로 host 의 app/static/spa 는 제외됨)
COPY --from=frontend /build/app/static/spa ./app/static/spa

ENV FLASK_APP=run.py
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "run:app"]
