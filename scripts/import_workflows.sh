#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKFLOW_DIR="${ROOT_DIR}/workflows/exports"
SERVICE_NAME="${N8N_SERVICE_NAME:-n8n}"

if ! docker compose ps --services --status running | grep -qx "${SERVICE_NAME}"; then
  echo "n8n container is not running. Start the stack with: docker compose up -d" >&2
  exit 1
fi

docker compose exec -u node "${SERVICE_NAME}" n8n import:workflow --separate --input=/workspace/workflows/exports
