#!/usr/bin/env bash
set -euo pipefail

# Smoke script for devolved branch: skip Puppeteer and verify prompt flow
PORT=${PORT:-3000}
SERVER_START_CMD=${SERVER_START_CMD:-"node server/index.js"}
ENV_VARS=${ENV_VARS:-"DEV_MINIMAL=1 SKIP_PUPPETEER=1"}

echo "Starting server with: ${ENV_VARS} ${SERVER_START_CMD}"
eval ${ENV_VARS} ${SERVER_START_CMD} &
SERVER_PID=$!
trap "kill $SERVER_PID" EXIT

echo "Waiting for server to start..."
sleep 2

echo "Posting test prompt..."
HTTP_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:${PORT}/prompt?min_flow=1" \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"devolve smoke test"}')

echo "HTTP status: $HTTP_STATUS"
if [ "$HTTP_STATUS" != "201" ] && [ "$HTTP_STATUS" != "200" ]; then
  echo "Smoke test failed: non-200/201 response"
  exit 2
fi

if [ -f samples/latest_prompt.txt ]; then
  echo "samples/latest_prompt.txt exists. Content:";
  head -n 5 samples/latest_prompt.txt || true
else
  echo "samples/latest_prompt.txt missing"
  exit 3
fi

echo "Smoke test passed"
