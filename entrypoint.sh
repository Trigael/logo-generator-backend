if [ -z "$DB_TRANSACTION_URL" ]; then
  echo "❌ DB_TRANSACTION_URL is not set at runtime"
  exit 1
fi

echo "✅ DB_TRANSACTION_URL is set"

npm run prisma:generate

exec npm run start:prod
