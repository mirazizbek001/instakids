# InstaKids — single Railway service
# React + Nginx + Django/Gunicorn in one container.
# This removes the frontend -> separate-backend 503 problem.

FROM node:22-bookworm-slim AS frontend-build
WORKDIR /frontend
COPY frontend/react/package*.json ./
RUN npm ci
COPY frontend/react/ ./
RUN npm run build

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    INSTA_KIDS_DATA_PATH=/tmp/instakids-data

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx gettext \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend-build /frontend/dist /usr/share/nginx/html
COPY railway/nginx.conf.template /etc/nginx/nginx.conf.template
COPY railway/start.sh /start.sh
RUN chmod +x /start.sh \
    && rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf \
    && python manage.py collectstatic --noinput

EXPOSE 8080
CMD ["/start.sh"]
