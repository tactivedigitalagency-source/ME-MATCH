#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v docker >/dev/null || { echo 'Docker belum tersedia. Pasang Docker Engine + Compose di server terlebih dahulu.'; exit 1; }
docker compose version >/dev/null
[ -f .env ] || { echo 'Jalankan node scripts/setup.mjs terlebih dahulu.'; exit 1; }
docker compose up -d db
docker compose build bot
docker compose run --rm bot node src/db/migrate.js
docker compose up -d bot
echo 'Bot dijalankan. Cek: docker compose logs --tail=30 bot'
