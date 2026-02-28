#!/usr/bin/env bash
# deploy-app.sh — Deploy an app to a specific environment on the SM2GK cluster.
# Creates the app's MSI, grants Key Vault access, stores secrets, applies K8s overlays.
# Safe to re-run — Bicep and kubectl apply are idempotent.
#
# Usage:
#   bash infrastructure/scripts/deploy-app.sh <app> <env>
#   bash infrastructure/scripts/deploy-app.sh lofibooks preprod
#   bash infrastructure/scripts/deploy-app.sh lofibooks prod
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

APP="${1:?Usage: deploy-app.sh <app> <env>}"
ENV="${2:?Usage: deploy-app.sh <app> <env>}"

# Load platform outputs written by setup-cluster.sh
PLATFORM_ENV="$REPO_ROOT/infrastructure/.platform-outputs.env"
if [ ! -f "$PLATFORM_ENV" ]; then
  echo "ERROR: $PLATFORM_ENV not found. Run setup-cluster.sh first."
  exit 1
fi
# shellcheck disable=SC1090
source "$PLATFORM_ENV"

IDENTITY_BICEP="$REPO_ROOT/infrastructure/bicep/apps/${APP}/identity.bicep"
OVERLAY_DIR="$REPO_ROOT/infrastructure/k8s/apps/${APP}/overlays/${ENV}"

if [ ! -f "$IDENTITY_BICEP" ]; then
  echo "ERROR: No Bicep identity file found at $IDENTITY_BICEP"
  exit 1
fi
if [ ! -d "$OVERLAY_DIR" ]; then
  echo "ERROR: No K8s overlay found at $OVERLAY_DIR"
  exit 1
fi

echo "=== [${APP}/${ENV}] Deploying app identity (MSI) ==="
DEPLOY_NAME="${APP}-${ENV}-identity-$(date +%Y%m%d%H%M)"
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$IDENTITY_BICEP" \
  --parameters env="$ENV" oidcIssuerUrl="$AKS_OIDC_ISSUER" keyVaultName="$KV_NAME" \
  --name "$DEPLOY_NAME" \
  --output none

WORKLOAD_IDENTITY_CLIENT_ID=$(az deployment group show \
  --resource-group "$RESOURCE_GROUP" --name "$DEPLOY_NAME" \
  --query "properties.outputs.clientId.value" -o tsv)
K8S_NAMESPACE=$(az deployment group show \
  --resource-group "$RESOURCE_GROUP" --name "$DEPLOY_NAME" \
  --query "properties.outputs.k8sNamespace.value" -o tsv)

echo "  MSI client ID: $WORKLOAD_IDENTITY_CLIENT_ID"
echo "  K8s namespace: $K8S_NAMESPACE"

echo "=== [${APP}/${ENV}] Storing secrets in Key Vault ==="
# Read app secrets from .env or environment variables
OPENAI_KEY="${OPENAI_API_KEY:-}"
MSAL_ID="${MSAL_CLIENT_ID:-}"

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
  --name "${APP}-${ENV}-openai-api-key" \
  --value "$OPENAI_KEY" --output none
az keyvault secret set \
  --vault-name "$KV_NAME" \
  --name "${APP}-${ENV}-msal-client-id" \
  --value "$MSAL_ID" --output none
echo "  Secrets stored: ${APP}-${ENV}-openai-api-key, ${APP}-${ENV}-msal-client-id"

echo "=== [${APP}/${ENV}] Applying K8s manifests ==="
MANIFESTS_TMP=$(mktemp -d)
cp -r "$OVERLAY_DIR/." "$MANIFESTS_TMP/"

# Substitute runtime values into files with placeholders
export WORKLOAD_IDENTITY_CLIENT_ID
export AZURE_TENANT_ID

for f in workload-sa.yaml secret-provider-class.yaml; do
  if [ -f "$OVERLAY_DIR/$f" ]; then
    envsubst < "$OVERLAY_DIR/$f" > "$MANIFESTS_TMP/$f"
  fi
done
# Copy kustomization and other files
cp "$OVERLAY_DIR/kustomization.yaml" "$MANIFESTS_TMP/kustomization.yaml"

kubectl apply -k "$MANIFESTS_TMP"
rm -rf "$MANIFESTS_TMP"
echo "  K8s manifests applied for namespace: $K8S_NAMESPACE"

# Set GitHub environment secrets if gh is available
if command -v gh &>/dev/null; then
  echo "=== [${APP}/${ENV}] Setting GitHub environment secrets ==="
  GH_ENV="${APP}-${ENV}"
  # Create GitHub environment if it doesn't exist
  gh api --method PUT "repos/${GITHUB_REPO:-MKippen/Lofi-Books}/environments/${GH_ENV}" \
    --silent 2>/dev/null || true
  gh secret set VITE_MSAL_CLIENT_ID --body "$MSAL_ID" \
    --env "$GH_ENV" --repo "${GITHUB_REPO:-MKippen/Lofi-Books}" 2>/dev/null || true
  gh secret set VITE_MSAL_AUTHORITY \
    --body "https://login.microsoftonline.com/consumers" \
    --env "$GH_ENV" --repo "${GITHUB_REPO:-MKippen/Lofi-Books}" 2>/dev/null || true
  echo "  GitHub environment '${GH_ENV}' secrets set"
fi

echo ""
echo "  [${APP}/${ENV}] Deployment complete!"
echo "  Namespace: $K8S_NAMESPACE"
echo ""
echo "  Next: build and push Docker images, then roll out:"
echo "    bash infrastructure/scripts/build-push.sh $APP"
echo "    kubectl rollout status deployment/${APP}-api -n $K8S_NAMESPACE"
echo ""
