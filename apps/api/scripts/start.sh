#!/bin/sh
# Production entrypoint: apply migrations, optionally load demo data on first boot, start the API (+ web app).
set -e
cd "$(dirname "$0")/.."
npx prisma migrate deploy

FIRST_BOOT=$(node -e "import('@prisma/client').then(async ({PrismaClient})=>{const p=new PrismaClient();const n=await p.user.count();console.log(n===0?'yes':'no');await p.\$disconnect()})")
if [ "$FIRST_BOOT" = "yes" ]; then
  echo "[start] empty database — seeding"
  npx tsx prisma/seed.ts
fi

node dist/index.js &
SERVER=$!

if [ "$FIRST_BOOT" = "yes" ] && [ "$SEED_DEMO" = "true" ]; then
  (
    for i in $(seq 1 60); do curl -sf "http://127.0.0.1:${PORT:-4000}/api/health" >/dev/null 2>&1 && break; sleep 2; done
    echo "[start] loading the demo season…"
    API="http://127.0.0.1:${PORT:-4000}/api" node scripts/demo-season.mjs > /tmp/demo-season.log 2>&1 \
      && echo "[start] demo season loaded" || { echo "[start] demo season failed:"; tail -20 /tmp/demo-season.log; }
  ) &
fi

wait $SERVER
