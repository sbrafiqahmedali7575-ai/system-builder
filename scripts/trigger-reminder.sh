#!/bin/bash
# Daily Reminder Trigger Script
# Runs against the public production endpoint for System Builder
# Timezone target: 09:00 PM IST (Asia/Kolkata)

BASE_URL="${APP_BASE_URL:-https://rafiqcommitdaily.ai.studio}"
SECRET="${SCHEDULER_SECRET:-commit-daily-scheduler-secret-auth-key-2026}"

echo "[$(date -u)] Triggering System Builder Reminder at ${BASE_URL}..."

curl -s -i -X POST "${BASE_URL}/api/send-daily-reminder" \
  -H "Authorization: Bearer ${SECRET}" \
  -H "Content-Type: application/json"

echo ""
