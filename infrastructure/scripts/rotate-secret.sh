#!/usr/bin/env bash
set -euo pipefail

APP="${1:?Usage: rotate-secret.sh <app> <env> <secret-name> <new-value>}"
ENV="${2:?}"
SECRET_NAME="${3:?}"
NEW_VALUE="${4:?}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLATFORM_ENV="$REPO_ROOT/infrastructure/.platform-outputs.env"

if [ ! -f "$PLATFORM_ENV" ]; then
  echo "ERROR: infrastructure/.platform-outputs.env not found."
  exit 1
fi

# shellcheck disable=SC1090
source "$PLATFORM_ENV"

KV_SECRET_NAME="${APP}-${ENV}-${SECRET_NAME}"
az keyvault secret set --vault-name "$KV_NAME" --name "$KV_SECRET_NAME" --value "$NEW_VALUE" --output none

if [ "$APP" = "lofibooks" ] && [ "$ENV" = "prod" ] && [ -n "${LOFIBOOKS_API_APP_NAME:-}" ]; then
  APP_ID="$(az webapp show -g "$RESOURCE_GROUP" -n "$LOFIBOOKS_API_APP_NAME" --query id -o tsv)"
  az rest \
    --method post \
    --url "https://management.azure.com${APP_ID}/config/configreferences/appsettings/refresh?api-version=2022-03-01" \
    --output none
fi

echo "Secret updated."
