#!/usr/bin/env bash
# setup-azure.sh — One-time Azure platform setup for Lofi-Books AKS cluster.
# Run from the repo root after `az login`.
#
# Usage:
#   export AZURE_SUBSCRIPTION_ID=<your-sub-id>
#   export OPENAI_API_KEY=<your-key>        # Or reads from .env
#   export GITHUB_REPO=MKippen/Lofi-Books  # For OIDC federation
#   bash infrastructure/scripts/setup-azure.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:?Set AZURE_SUBSCRIPTION_ID}"
LOCATION="eastus"
ENVIRONMENT="prod"
RESOURCE_GROUP="rg-lofi-books-${ENVIRONMENT}"
GITHUB_REPO="${GITHUB_REPO:-MKippen/Lofi-Books}"

# Read OpenAI key from .env if not set
if [ -z "${OPENAI_API_KEY:-}" ]; then
  if [ -f "$REPO_ROOT/.env" ]; then
    OPENAI_API_KEY=$(grep '^OPENAI_API_KEY=' "$REPO_ROOT/.env" | cut -d= -f2- | tr -d '"')
    echo "Read OpenAI API key from .env"
  else
    echo "ERROR: Set OPENAI_API_KEY env var or create .env file"
    exit 1
  fi
fi

# Read MSAL client ID from .env or env
MSAL_CLIENT_ID="${MSAL_CLIENT_ID:-}"
if [ -z "$MSAL_CLIENT_ID" ] && [ -f "$REPO_ROOT/.env" ]; then
  MSAL_CLIENT_ID=$(grep '^VITE_MSAL_CLIENT_ID=' "$REPO_ROOT/.env" | cut -d= -f2- | tr -d '"')
fi
: "${MSAL_CLIENT_ID:?Set MSAL_CLIENT_ID or VITE_MSAL_CLIENT_ID in .env}"

echo "=== Setting subscription ==="
az account set --subscription "$SUBSCRIPTION_ID"

echo "=== Deploying Bicep infrastructure ==="
DEPLOY_NAME="lofi-books-${ENVIRONMENT}-$(date +%Y%m%d%H%M)"
az deployment sub create \
  --location "$LOCATION" \
  --template-file "$REPO_ROOT/infrastructure/bicep/main.bicep" \
  --parameters "$REPO_ROOT/infrastructure/bicep/parameters/prod.bicepparam" \
  --name "$DEPLOY_NAME" \
  --output none

echo "=== Getting deployment outputs ==="
AKS_NAME=$(az deployment sub show --name "$DEPLOY_NAME" --query "properties.outputs.aksClusterName.value" -o tsv)
AKS_OIDC_ISSUER=$(az deployment sub show --name "$DEPLOY_NAME" --query "properties.outputs.aksOidcIssuerUrl.value" -o tsv)
ACR_SERVER=$(az deployment sub show --name "$DEPLOY_NAME" --query "properties.outputs.acrLoginServer.value" -o tsv)
KV_NAME=$(az deployment sub show --name "$DEPLOY_NAME" --query "properties.outputs.keyVaultName.value" -o tsv)
WORKLOAD_CLIENT_ID=$(az deployment sub show --name "$DEPLOY_NAME" --query "properties.outputs.workloadIdentityClientId.value" -o tsv)
WORKLOAD_PRINCIPAL_ID=$(az deployment sub show --name "$DEPLOY_NAME" --query "properties.outputs.workloadIdentityPrincipalId.value" -o tsv)
AZURE_TENANT_ID=$(az account show --query "tenantId" -o tsv)

echo "AKS: $AKS_NAME"
echo "ACR: $ACR_SERVER"
echo "Key Vault: $KV_NAME"
echo "Workload Identity Client ID: $WORKLOAD_CLIENT_ID"
echo "AKS OIDC Issuer: $AKS_OIDC_ISSUER"

echo "=== Getting AKS credentials ==="
az aks get-credentials \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_NAME" \
  --overwrite-existing

echo "=== Storing secrets in Key Vault ==="
az keyvault secret set --vault-name "$KV_NAME" --name "openai-api-key" --value "$OPENAI_API_KEY" --output none
az keyvault secret set --vault-name "$KV_NAME" --name "msal-client-id" --value "$MSAL_CLIENT_ID" --output none
echo "Secrets stored in Key Vault"

echo "=== Creating Workload Identity federated credential (K8s SA → MSI) ==="
az identity federated-credential create \
  --name "lofi-books-k8s-fed-cred" \
  --identity-name "id-lofi-books-workload-${ENVIRONMENT}" \
  --resource-group "$RESOURCE_GROUP" \
  --issuer "$AKS_OIDC_ISSUER" \
  --subject "system:serviceaccount:lofi-books:lofi-books-workload-sa" \
  --audiences "api://AzureADTokenExchange" \
  --output none
echo "Workload Identity federated credential created"

echo "=== Creating GitHub Actions OIDC service principal (no expiring secrets) ==="
SP_NAME="sp-lofi-books-github-actions-${ENVIRONMENT}"
GITHUB_SUBJECT="repo:${GITHUB_REPO}:ref:refs/heads/releasev1"

# Create or get existing service principal
SP_APP_ID=$(az ad sp list --display-name "$SP_NAME" --query "[0].appId" -o tsv 2>/dev/null || true)
if [ -z "$SP_APP_ID" ]; then
  SP_APP_ID=$(az ad sp create-for-rbac --name "$SP_NAME" --skip-assignment --query "appId" -o tsv)
  echo "Created service principal: $SP_APP_ID"
else
  echo "Using existing service principal: $SP_APP_ID"
fi

# Grant Contributor on the resource group + AcrPush on ACR
az role assignment create \
  --assignee "$SP_APP_ID" \
  --role "Contributor" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}" \
  --output none 2>/dev/null || true

ACR_ID=$(az acr show --name "acrlofibooks${ENVIRONMENT}" --resource-group "$RESOURCE_GROUP" --query "id" -o tsv)
az role assignment create \
  --assignee "$SP_APP_ID" \
  --role "AcrPush" \
  --scope "$ACR_ID" \
  --output none 2>/dev/null || true

# Create OIDC federated credential for the releasev1 branch
SP_OBJECT_ID=$(az ad sp show --id "$SP_APP_ID" --query "id" -o tsv)
az ad app federated-credential create \
  --id "$(az ad sp show --id "$SP_APP_ID" --query "appId" -o tsv)" \
  --parameters "{
    \"name\": \"github-actions-releasev1\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"${GITHUB_SUBJECT}\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" \
  --output none 2>/dev/null || echo "Federated credential may already exist"
echo "GitHub Actions OIDC federated credential created"

echo "=== Installing NGINX Ingress Controller ==="
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx --force-update
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.replicaCount=1 \
  --set controller.nodeSelector."kubernetes\.io/os"=linux \
  --set controller.resources.requests.cpu=100m \
  --set controller.resources.requests.memory=128Mi \
  --set controller.resources.limits.cpu=250m \
  --set controller.resources.limits.memory=256Mi \
  --wait --timeout=5m
echo "NGINX Ingress Controller installed"

echo "=== Installing cert-manager ==="
helm repo add jetstack https://charts.jetstack.io --force-update
helm repo update
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set crds.enabled=true \
  --set resources.requests.cpu=50m \
  --set resources.requests.memory=64Mi \
  --wait --timeout=5m
echo "cert-manager installed"

echo "=== Applying K8s manifests ==="
# Substitute placeholders in manifests that need runtime values
export WORKLOAD_IDENTITY_CLIENT_ID="$WORKLOAD_CLIENT_ID"
export AZURE_TENANT_ID

MANIFESTS_TMP=$(mktemp -d)
cp -r "$REPO_ROOT/infrastructure/k8s/." "$MANIFESTS_TMP/"

# Substitute env vars in the two files that have placeholders
envsubst < "$REPO_ROOT/infrastructure/k8s/security/workload-sa.yaml" > "$MANIFESTS_TMP/security/workload-sa.yaml"
envsubst < "$REPO_ROOT/infrastructure/k8s/security/secret-provider-class.yaml" > "$MANIFESTS_TMP/security/secret-provider-class.yaml"

kubectl apply -k "$MANIFESTS_TMP"
rm -rf "$MANIFESTS_TMP"
echo "K8s manifests applied"

echo "=== Waiting for ingress LoadBalancer IP (up to 5 min) ==="
for i in $(seq 1 30); do
  INGRESS_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx \
    -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)
  if [ -n "$INGRESS_IP" ]; then
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 10
done

# Set GitHub Actions variables and secrets if gh CLI is available
ACR_NAME_VALUE="acrlofibooks${ENVIRONMENT}"
if command -v gh &>/dev/null; then
  echo "=== Setting GitHub Actions variables and secrets ==="
  gh variable set AZURE_CLIENT_ID --body "$SP_APP_ID" --repo "$GITHUB_REPO"
  gh variable set AZURE_TENANT_ID --body "$AZURE_TENANT_ID" --repo "$GITHUB_REPO"
  gh variable set AZURE_SUBSCRIPTION_ID --body "$SUBSCRIPTION_ID" --repo "$GITHUB_REPO"
  gh variable set ACR_NAME --body "$ACR_NAME_VALUE" --repo "$GITHUB_REPO"
  gh variable set ACR_LOGIN_SERVER --body "$ACR_SERVER" --repo "$GITHUB_REPO"
  gh secret set VITE_MSAL_CLIENT_ID --body "$MSAL_CLIENT_ID" --repo "$GITHUB_REPO"
  gh secret set VITE_MSAL_AUTHORITY --body "https://login.microsoftonline.com/consumers" --repo "$GITHUB_REPO"
  echo "GitHub variables and secrets set via gh CLI"
fi

echo ""
echo "========================================================="
echo "  SETUP COMPLETE"
echo "========================================================="
echo ""
echo "ACR Login Server:   $ACR_SERVER"
echo "Key Vault:          $KV_NAME"
echo "AKS Cluster:        $AKS_NAME"
echo ""
echo "GitHub Actions — set these in repo Settings > Variables (if not set by gh CLI above):"
echo "  AZURE_CLIENT_ID       = $SP_APP_ID"
echo "  AZURE_TENANT_ID       = $AZURE_TENANT_ID"
echo "  AZURE_SUBSCRIPTION_ID = $SUBSCRIPTION_ID"
echo "  ACR_NAME              = $ACR_NAME_VALUE"
echo "  ACR_LOGIN_SERVER      = $ACR_SERVER"
echo ""
echo "GitHub Actions — set these in repo Settings > Secrets (if not set by gh CLI above):"
echo "  VITE_MSAL_CLIENT_ID  = $MSAL_CLIENT_ID"
echo "  VITE_MSAL_AUTHORITY  = https://login.microsoftonline.com/consumers"
echo ""
if [ -n "${INGRESS_IP:-}" ]; then
  echo "DNS: Create an A record in GoDaddy:"
  echo "  lofibooks.sm2gk.com  →  $INGRESS_IP"
else
  echo "DNS: Run this to get ingress IP when ready:"
  echo "  kubectl get svc ingress-nginx-controller -n ingress-nginx"
fi
echo ""
echo "Entra App Registration (manual):"
echo "  Add redirect URI: https://lofibooks.sm2gk.com/"
echo "  Enable ID token issuance"
echo ""
