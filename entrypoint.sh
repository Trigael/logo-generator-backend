#!/bin/sh

if [ -z "$DB_TRANSACTION_URL" ]; then
  echo "❌ DB_TRANSACTION_URL is not set at runtime"
  exit 1
fi

echo "✅ DB_TRANSACTION_URL loaded: echo $DB_TRANSACTION_URL"

npm run prisma:generate

# ✅ Spusť aplikaci
exec npm run start:prod