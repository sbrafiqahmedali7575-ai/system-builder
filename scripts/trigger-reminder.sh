#!/bin/bash
# Daily Reminder Trigger Script
# Runs against the public production endpoint for System Builder
# Timezone target: 09:00 PM IST (Asia/Kolkata)

BASE_URL="${APP_BASE_URL:-https://systembuilder08.ai.studio}"
if [ -z "${SCHEDULER_SECRET:-}" ]; then
  echo "Error: SCHEDULER_SECRET must be set in the environment." >&2
  exit 1
fi

SECRET="$SCHEDULER_SECRET"

echo "[$(date -u)] Triggering System Builder Reminder at ${BASE_URL}..."

curl -s -i -X POST "${BASE_URL}/api/send-daily-reminder" \
  -H "Authorization: Bearer ${SECRET}" \
  -H "Content-Type: application/json"

echo ""
