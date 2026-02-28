#!/usr/bin/env bash
# build-push.sh — Build and push Docker images for an app to ACR.
# Tags images with git SHA for traceability. Also tags :latest for initial deployment.
#
# Usage:
#   bash infrastructure/scripts/build-push.sh lofibooks
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

APP="${1:?Usage: build-push.sh <app>}"

# Load platform outputs
PLATFORM_ENV="$REPO_ROOT/infrastructure/.platform-outputs.env"
if [ ! -f "$PLATFORM_ENV" ]; then
  echo "ERROR: $PLATFORM_ENV not found. Run setup-cluster.sh first."
  exit 1
fi
# shellcheck disable=SC1090
source "$PLATFORM_ENV"

# Read MSAL build args from .env
MSAL_CLIENT_ID="${VITE_MSAL_CLIENT_ID:-}"
MSAL_AUTHORITY="${VITE_MSAL_AUTHORITY:-https://login.microsoftonline.com/consumers}"
if [ -z "$MSAL_CLIENT_ID" ] && [ -f "$REPO_ROOT/.env" ]; then
  MSAL_CLIENT_ID=$(grep '^VITE_MSAL_CLIENT_ID=' "$REPO_ROOT/.env" | cut -d= -f2- | tr -d '"')
fi

IMAGE_TAG=$(git -C "$REPO_ROOT" rev-parse --short HEAD)

echo "=== Logging in to ACR: $ACR_LOGIN_SERVER ==="
az acr login --name "$ACR_NAME"

echo "=== Building and pushing ${APP} frontend ($IMAGE_TAG) ==="
docker build \
  --platform linux/amd64 \
  --build-arg VITE_MSAL_CLIENT_ID="$MSAL_CLIENT_ID" \
  --build-arg VITE_MSAL_AUTHORITY="$MSAL_AUTHORITY" \
  -t "${ACR_LOGIN_SERVER}/${APP}-frontend:${IMAGE_TAG}" \
  -t "${ACR_LOGIN_SERVER}/${APP}-frontend:latest" \
  "$REPO_ROOT"
docker push "${ACR_LOGIN_SERVER}/${APP}-frontend" --all-tags

echo "=== Building and pushing ${APP} api ($IMAGE_TAG) ==="
docker build \
  --platform linux/amd64 \
  -t "${ACR_LOGIN_SERVER}/${APP}-api:${IMAGE_TAG}" \
  -t "${ACR_LOGIN_SERVER}/${APP}-api:latest" \
  "$REPO_ROOT/server"
docker push "${ACR_LOGIN_SERVER}/${APP}-api" --all-tags

echo ""
echo "Images pushed:"
echo "  ${ACR_LOGIN_SERVER}/${APP}-frontend:${IMAGE_TAG}"
echo "  ${ACR_LOGIN_SERVER}/${APP}-api:${IMAGE_TAG}"
echo ""
echo "To roll out preprod:"
echo "  kubectl set image deployment/${APP}-frontend frontend=${ACR_LOGIN_SERVER}/${APP}-frontend:${IMAGE_TAG} -n ${APP}-preprod"
echo "  kubectl set image deployment/${APP}-api api=${ACR_LOGIN_SERVER}/${APP}-api:${IMAGE_TAG} -n ${APP}-preprod"
echo ""
echo "To roll out prod (after preprod validation):"
echo "  kubectl set image deployment/${APP}-frontend frontend=${ACR_LOGIN_SERVER}/${APP}-frontend:${IMAGE_TAG} -n ${APP}"
echo "  kubectl set image deployment/${APP}-api api=${ACR_LOGIN_SERVER}/${APP}-api:${IMAGE_TAG} -n ${APP}"
