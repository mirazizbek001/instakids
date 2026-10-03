#!/bin/sh
set -eu

: "${PORT:=8080}"

# If Railway has a Volume mounted at /data, use it automatically.
# If DATABASE_URL is supplied, Django uses PostgreSQL instead.
# If neither is available, keep the app bootable by falling back to writable local storage.
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -d /data ] && [ -w /data ]; then
    export RAILWAY_VOLUME_MOUNT_PATH=/data
    mkdir -p /data/media
    if [ ! -f /data/db.sqlite3 ] && [ -f /app/db.sqlite3 ]; then
      echo "[InstaKids] First run: copying initial SQLite database to /data"
      cp /app/db.sqlite3 /data/db.sqlite3
    fi
  else
    export INSTA_KIDS_DATA_PATH=/tmp/instakids-data
    mkdir -p "$INSTA_KIDS_DATA_PATH/media"
    if [ ! -f "$INSTA_KIDS_DATA_PATH/db.sqlite3" ] && [ -f /app/db.sqlite3 ]; then
      echo "[InstaKids] First run: copying initial SQLite database to fallback storage"
      cp /app/db.sqlite3 "$INSTA_KIDS_DATA_PATH/db.sqlite3"
    fi
    echo "[InstaKids] WARNING: no Railway Volume or DATABASE_URL detected. Falling back to $INSTA_KIDS_DATA_PATH for SQLite storage."
  fi
fi

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[InstaKids] Database: PostgreSQL"
else
  echo "[InstaKids] Database: SQLite (${RAILWAY_VOLUME_MOUNT_PATH:-${INSTA_KIDS_DATA_PATH:-/app}})"
  if [ -z "${RAILWAY_VOLUME_MOUNT_PATH:-}" ]; then
    echo "[InstaKids] WARNING: no Railway Volume detected; SQLite data will be ephemeral."
  fi
fi

python manage.py migrate --noinput

# SQLite is kept to one worker to avoid multi-process write locks.
if [ -n "${DATABASE_URL:-}" ]; then
  WORKERS="${WEB_CONCURRENCY:-3}"
else
  WORKERS=1
fi

# Start Django first; nginx healthcheck will fail until Django is ready.
gunicorn config.wsgi:application \
  --bind 127.0.0.1:8000 \
  --worker-class gthread \
  --workers "$WORKERS" \
  --threads "${GUNICORN_THREADS:-32}" \
  --timeout 120 \
  --graceful-timeout 30 \
  --keep-alive 75 \
  --max-requests 2000 \
  --max-requests-jitter 200 \
  --access-logfile - \
  --error-logfile - &
GUNICORN_PID=$!

cleanup() {
  kill "$GUNICORN_PID" 2>/dev/null || true
  wait "$GUNICORN_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# If gunicorn dies, stop nginx too so the container exits and Railway restarts it
# (otherwise nginx would keep running and serve 502 forever).
(
  while kill -0 "$GUNICORN_PID" 2>/dev/null; do sleep 5; done
  echo "[InstaKids] gunicorn stopped - shutting down nginx so the service restarts"
  nginx -s stop 2>/dev/null || true
) &

# Let nginx be the public process and keep the container alive.
envsubst '${PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf
nginx -t
nginx -g 'daemon off;'
