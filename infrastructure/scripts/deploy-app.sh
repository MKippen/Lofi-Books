#!/usr/bin/env bash
# Configure prod secrets and Static Web App backend linkage for lofibooks.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLATFORM_ENV="$REPO_ROOT/infrastructure/.platform-outputs.env"

if [ ! -f "$PLATFORM_ENV" ]; then
  echo "ERROR: infrastructure/.platform-outputs.env not found."
  exit 1
fi

# shellcheck disable=SC1090
source "$PLATFORM_ENV"

OPENAI_KEY="${OPENAI_API_KEY:-}"
MSAL_ID="${MSAL_CLIENT_ID:-${VITE_MSAL_CLIENT_ID:-}}"

if [ -z "$OPENAI_KEY" ] && [ -f "$REPO_ROOT/.env" ]; then
  OPENAI_KEY=$(grep '^OPENAI_API_KEY=' "$REPO_ROOT/.env" | cut -d= -f2- | tr -d '"')
fi
if [ -z "$MSAL_ID" ] && [ -f "$REPO_ROOT/.env" ]; then
  MSAL_ID=$(grep '^VITE_MSAL_CLIENT_ID=' "$REPO_ROOT/.env" | cut -d= -f2- | tr -d '"')
fi

: "${OPENAI_KEY:?Could not find OPENAI_API_KEY in env or .env}"
: "${MSAL_ID:?Could not find MSAL_CLIENT_ID or VITE_MSAL_CLIENT_ID in env or .env}"

az keyvault secret set \
  --vault-name "$KV_NAME" \
  --name "lofibooks-prod-openai-api-key" \
  --value "$OPENAI_KEY" \
  --output none
az keyvault secret set \
  --vault-name "$KV_NAME" \
  --name "lofibooks-prod-msal-client-id" \
  --value "$MSAL_ID" \
  --output none

APP_SERVICE_ID="$(az webapp show -g "$RESOURCE_GROUP" -n "$LOFIBOOKS_API_APP_NAME" --query id -o tsv)"
LINKED_BACKEND="$(az staticwebapp backends show -g "$RESOURCE_GROUP" -n "$LOFIBOOKS_STATIC_SITE_NAME" --query backendResourceId -o tsv 2>/dev/null || true)"
if [ "$LINKED_BACKEND" != "$APP_SERVICE_ID" ]; then
  az staticwebapp backends link \
    -g "$RESOURCE_GROUP" \
    -n "$LOFIBOOKS_STATIC_SITE_NAME" \
    --backend-resource-id "$APP_SERVICE_ID" \
    --backend-region "$LOCATION" \
    --output none
fi

echo "Lofibooks runtime configuration complete."
