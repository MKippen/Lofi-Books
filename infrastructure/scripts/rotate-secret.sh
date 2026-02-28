#!/usr/bin/env bash
# rotate-secret.sh — Update a secret in Key Vault for a specific app+env.
# The CSI driver picks up the new value within 5 minutes — no pod restart needed.
#
# Usage:
#   bash infrastructure/scripts/rotate-secret.sh lofibooks prod openai-api-key sk-proj-...
set -euo pipefail

APP="${1:?Usage: rotate-secret.sh <app> <env> <secret-name> <new-value>}"
ENV="${2:?}"
SECRET_NAME="${3:?}"
NEW_VALUE="${4:?}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck disable=SC1090
source "$REPO_ROOT/infrastructure/.platform-outputs.env"

KV_SECRET_NAME="${APP}-${ENV}-${SECRET_NAME}"
echo "Updating Key Vault secret: $KV_SECRET_NAME in $KV_NAME"
az keyvault secret set --vault-name "$KV_NAME" --name "$KV_SECRET_NAME" --value "$NEW_VALUE" --output none
echo "Done. CSI driver auto-syncs within 5 minutes."
