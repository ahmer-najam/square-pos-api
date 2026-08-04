#!/usr/bin/env bash
# Smoke-test helpers (requires server running + valid .env)
BASE="${BASE_URL:-http://localhost:3000}"

echo "== Health =="
curl -s "$BASE/health" | jq .

echo "== Locations =="
curl -s "$BASE/api/locations" | jq .

echo "== Catalog items =="
curl -s "$BASE/api/catalog/items" | jq '.items[:3]'
